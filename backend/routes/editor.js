// The editor's API: a project's pages, navigation, history and AI suggestions.
//
//   GET    /api/projects/:id/pages                 pages, navigation, which pages are edited by hand
//   POST   /api/projects/:id/pages                 { title, group? } → a new page
//   GET    /api/projects/:id/page?route=           one page's source and its etag
//   PUT    /api/projects/:id/page?route=           { content, baseEtag } → publish
//   DELETE /api/projects/:id/page?route=           delete
//   PUT    /api/projects/:id/navigation            { navigation: [{ group, tab?, pages }] }
//   GET    /api/projects/:id/history?route=        the page's versions
//   GET    /api/projects/:id/revisions/:revision   one version's content
//   POST   /api/projects/:id/revisions/:revision/restore   { baseEtag }
//   GET    /api/projects/:id/suggestion?route=     the AI update waiting for review
//   POST   /api/projects/:id/suggestion/accept?route=      { baseEtag, content? }
//   POST   /api/projects/:id/suggestion/dismiss?route=
//   POST   /api/projects/:id/preview               { content } → the compiled page, or its error
//
// Viewers can read; editors and admins can change pages. Every change is validated (the
// page must compile), checked against the version the editor started from (etag), written
// to disk, recorded in the page history, and published by rebuilding the site.
const express = require("express");
const supabase = require("../lib/supabase");
const { compileSafeMdx } = require("../mdx/safeMdx");
const { createRateLimiter } = require("../lib/rateLimit");
const pages = require("../services/sitePages");
const revisions = require("../services/pageRevisions");
const { parseFrontmatter } = require("../../lib/frontmatter");

const { PageError } = pages;

/** The project and the user's role on it, or null (unknown and not-a-member look the same). */
async function projectRole(projectId, userId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(projectId))) return null;
    const { data: project } = await supabase.from("projects").select("id, user_id, tenant_name, project_name").eq("id", projectId).maybeSingle();
    if (!project) return null;
    if (project.user_id === userId) return { project, role: "admin" };
    const { data: member } = await supabase.from("project_members").select("role").eq("project_id", project.id).eq("user_id", userId).maybeSingle();
    return member ? { project, role: member.role } : null;
}

// Changes to one project's files run one at a time in this process, so two saves can't
// both pass the version check before either writes. (Publishing runs outside the lock.)
const locks = new Map();
function withProjectLock(projectId, fn) {
    const run = (locks.get(projectId) || Promise.resolve()).then(fn);
    const tail = run.catch(() => {});
    locks.set(projectId, tail);
    tail.then(() => { if (locks.get(projectId) === tail) locks.delete(projectId); });
    return run;
}

function compileError(compiled) {
    const { message, line, column } = compiled.error;
    return new PageError(400, `This page has a syntax error${line ? ` on line ${line}` : ""}: ${message}`, { line, column });
}

/**
 * @param {object} deps
 * @param {Function} deps.requireAuth
 * @param {Function} deps.csrfProtection
 * @param {(tenant: string, project: string) => Promise<void>} deps.buildProject
 */
function createEditorRouter({ requireAuth, csrfProtection, buildProject }) {
    const router = express.Router();
    const previewLimit = createRateLimiter({ windowMs: 60 * 1000, max: 120, key: (req) => req.user?.id || req.ip });
    const writeLimit = createRateLimiter({ windowMs: 60 * 1000, max: 60, key: (req) => req.user?.id || req.ip });

    // Loads the project and checks the role. Writes need editor or admin.
    const access = (need) => async (req, res, next) => {
        try {
            const found = await projectRole(req.params.id, req.user.id);
            if (!found) return res.status(404).json({ error: "Project not found" });
            if (need === "write" && !["admin", "editor"].includes(found.role)) {
                return res.status(403).json({ error: "Only project editors and admins can change pages." });
            }
            req.project = found.project;
            req.role = found.role;
            next();
        } catch (error) {
            next(error);
        }
    };

    const handle = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        } catch (error) {
            if (error instanceof PageError) {
                const { status, message, ...extra } = error;
                return res.status(status).json({ error: message, ...extra });
            }
            console.error("[Editor]", error);
            res.status(500).json({ error: "Something went wrong." });
        }
    };

    const routeParam = (req) => {
        const route = pages.normalizeRoute(req.query.route);
        if (!route) throw new PageError(400, "Invalid page.");
        return route;
    };
    const names = (req) => [req.project.tenant_name, req.project.project_name];

    // Publishes: rebuilds the site. The change is saved either way; a failed build is reported.
    async function publish(req) {
        try {
            await buildProject(...names(req));
            return { published: true };
        } catch (error) {
            console.error(`[Editor] Build failed for ${names(req).join("/")}:`, error.message);
            return { published: false, buildError: "Saved, but the site couldn't be rebuilt. Check the backend log." };
        }
    }

    // Before the first recorded change to a page, keep what it was, so it can be restored.
    async function ensureBaseline(projectId, route, current) {
        const history = await revisions.pageHistory(projectId, route);
        if (!history.length && current) await revisions.recordRevisions(projectId, [{ route, source: "baseline", content: current.content, message: "Before editing" }]);
    }

    function checkEtag(current, baseEtag) {
        if (current && baseEtag !== current.etag) {
            throw new PageError(409, "This page changed since you opened it.", { current: { content: current.content, etag: current.etag } });
        }
    }

    // Validates, writes and records one change to a page.
    async function savePage(req, route, content, { source, baseEtag, message, allowCreate = false }) {
        if (typeof content !== "string" || !content.trim()) throw new PageError(400, "The page is empty.");
        if (Buffer.byteLength(content) > pages.MAX_PAGE_BYTES) throw new PageError(413, "This page is too long (200 KB at most).");
        const compiled = compileSafeMdx(content);
        if (!compiled.ok) throw compileError(compiled);
        return withProjectLock(req.project.id, () => writeChecked(req, route, content, { source, baseEtag, message, allowCreate, warnings: compiled.warnings }));
    }

    async function writeChecked(req, route, content, { source, baseEtag, message, allowCreate, warnings }) {
        const [tenant, project] = names(req);
        const current = pages.readPage(tenant, project, route);
        if (!current && !allowCreate) throw new PageError(404, "This page doesn't exist anymore.");
        checkEtag(current, baseEtag);

        await ensureBaseline(req.project.id, route, current);
        const written = pages.writePage(tenant, project, route, content);
        await revisions.recordRevisions(req.project.id, [{ route, source, content, authorId: req.user.id, message }]);
        revisions.pruneHistory(req.project.id).catch((error) => console.error("[Editor] Pruning history failed:", error.message));
        return { ...written, warnings };
    }

    router.get("/:id/pages", requireAuth, access("read"), handle(async (req, res) => {
        const site = pages.listPages(...names(req));
        const summaries = await revisions.revisionSummaries(req.project.id);
        const states = revisions.pageStates(summaries);
        const handEdited = [...states].filter(([route, state]) => state.handEdited && site.pages[route]).map(([route]) => route);
        const suggestions = (await revisions.suggestedRoutes(req.project.id)).filter((route) => site.pages[route]);
        res.json({ ...site, tenant: req.project.tenant_name, project: req.project.project_name, handEdited, suggestions, canEdit: req.role !== "viewer" });
    }));

    router.post("/:id/pages", requireAuth, csrfProtection, writeLimit, access("write"), handle(async (req, res) => {
        const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
        if (!title || title.length > 120) throw new PageError(400, "Give the page a title (120 characters at most).");
        const folder = req.body.folder ? pages.normalizeRoute(req.body.folder) : "";
        if (folder === null) throw new PageError(400, "Invalid folder.");
        const slug = pages.slugify(title);
        if (!slug) throw new PageError(400, "The title needs at least one letter or digit.");
        const route = pages.normalizeRoute(folder ? `${folder}/${slug}` : slug);
        if (!route) throw new PageError(400, "Invalid page name.");
        if (pages.readPage(...names(req), route)) throw new PageError(409, `A page named "${route}" already exists.`);

        const saved = await savePage(req, route, pages.newPageContent(title), { source: "editor", allowCreate: true, message: "Created" });
        await withProjectLock(req.project.id, () => pages.addToNavigation(...names(req), route, req.body.group));
        res.status(201).json({ ...saved, ...(await publish(req)) });
    }));

    router.get("/:id/page", requireAuth, access("read"), handle(async (req, res) => {
        const route = routeParam(req);
        const page = pages.readPage(...names(req), route);
        if (!page) throw new PageError(404, "This page doesn't exist.");
        const [history, suggestion] = await Promise.all([revisions.pageHistory(req.project.id, route), revisions.latestSuggestion(req.project.id, route)]);
        const handEdited = Boolean(history[0] && revisions.HUMAN_SOURCES.has(history[0].source) && !history[0].deleted);
        res.json({
            ...page,
            handEdited,
            suggestion: suggestion ? { id: suggestion.id, source: suggestion.source, message: suggestion.message, createdAt: suggestion.created_at } : null,
        });
    }));

    router.put("/:id/page", requireAuth, csrfProtection, writeLimit, access("write"), handle(async (req, res) => {
        const route = routeParam(req);
        const message = typeof req.body?.message === "string" ? req.body.message : undefined;
        const saved = await savePage(req, route, req.body?.content, { source: "editor", baseEtag: req.body?.baseEtag, message });
        res.json({ ...saved, ...(await publish(req)) });
    }));

    router.delete("/:id/page", requireAuth, csrfProtection, writeLimit, access("write"), handle(async (req, res) => {
        const route = routeParam(req);
        await withProjectLock(req.project.id, async () => {
            const current = pages.readPage(...names(req), route);
            if (!current) throw new PageError(404, "This page doesn't exist.");
            await ensureBaseline(req.project.id, route, current);
            // The deleted version is kept in the history, so the page can be restored.
            await revisions.recordRevisions(req.project.id, [{ route, source: "editor", content: current.content, deleted: true, authorId: req.user.id, message: "Deleted" }]);
            await revisions.clearSuggestions(req.project.id, route);
            pages.deletePage(...names(req), route);
        });
        res.json({ deleted: true, ...(await publish(req)) });
    }));

    router.put("/:id/navigation", requireAuth, csrfProtection, writeLimit, access("write"), handle(async (req, res) => {
        if (JSON.stringify(req.body?.navigation ?? null).length > 100000) throw new PageError(400, "The navigation is too large.");
        const navigation = await withProjectLock(req.project.id, () => pages.setNavigation(...names(req), req.body?.navigation));
        res.json({ navigation, ...(await publish(req)) });
    }));

    router.get("/:id/history", requireAuth, access("read"), handle(async (req, res) => {
        res.json({ revisions: await revisions.pageHistory(req.project.id, routeParam(req)) });
    }));

    router.get("/:id/revisions/:revision", requireAuth, access("read"), handle(async (req, res) => {
        const revision = await revisions.getRevision(req.project.id, req.params.revision);
        if (!revision) throw new PageError(404, "That version doesn't exist.");
        res.json(revision);
    }));

    router.post("/:id/revisions/:revision/restore", requireAuth, csrfProtection, writeLimit, access("write"), handle(async (req, res) => {
        const revision = await revisions.getRevision(req.project.id, req.params.revision);
        if (!revision || revision.kind !== "revision") throw new PageError(404, "That version doesn't exist.");
        const existed = Boolean(pages.readPage(...names(req), revision.route));
        const when = new Date(revision.created_at).toISOString().slice(0, 16).replace("T", " ");
        const saved = await savePage(req, revision.route, revision.content, {
            source: "restore", baseEtag: req.body?.baseEtag, allowCreate: true, message: `Restored the version from ${when} UTC`,
        });
        if (!existed) await withProjectLock(req.project.id, () => pages.addToNavigation(...names(req), revision.route));
        res.json({ ...saved, content: revision.content, ...(await publish(req)) });
    }));

    router.get("/:id/suggestion", requireAuth, access("read"), handle(async (req, res) => {
        const suggestion = await revisions.latestSuggestion(req.project.id, routeParam(req));
        if (!suggestion) throw new PageError(404, "There's no suggestion for this page.");
        res.json(suggestion);
    }));

    // Accepting publishes the suggestion (or the editor's merge of it); the page stays
    // edited by hand, so later AI updates are suggestions too.
    router.post("/:id/suggestion/accept", requireAuth, csrfProtection, writeLimit, access("write"), handle(async (req, res) => {
        const route = routeParam(req);
        const suggestion = await revisions.latestSuggestion(req.project.id, route);
        if (!suggestion) throw new PageError(404, "There's no suggestion for this page.");
        const content = typeof req.body?.content === "string" ? req.body.content : suggestion.content;
        const saved = await savePage(req, route, content, { source: "editor", baseEtag: req.body?.baseEtag, message: "Accepted the AI suggestion" });
        await revisions.clearSuggestions(req.project.id, route);
        res.json({ ...saved, content, ...(await publish(req)) });
    }));

    router.post("/:id/suggestion/dismiss", requireAuth, csrfProtection, writeLimit, access("write"), handle(async (req, res) => {
        await revisions.clearSuggestions(req.project.id, routeParam(req));
        res.json({ dismissed: true });
    }));

    // The editor's live preview: the same compiler the published site uses.
    router.post("/:id/preview", requireAuth, csrfProtection, previewLimit, access("read"), handle(async (req, res) => {
        const content = req.body?.content;
        if (typeof content !== "string") throw new PageError(400, "Missing content.");
        if (Buffer.byteLength(content) > pages.MAX_PAGE_BYTES) throw new PageError(413, "This page is too long (200 KB at most).");
        const compiled = compileSafeMdx(content);
        if (!compiled.ok) return res.json({ ok: false, error: compiled.error });
        const { data } = parseFrontmatter(content);
        res.json({ ok: true, tree: compiled.tree, warnings: compiled.warnings, title: typeof data.title === "string" ? data.title : "", description: typeof data.description === "string" ? data.description : "" });
    }));

    return router;
}

module.exports = { createEditorRouter, projectRole };
