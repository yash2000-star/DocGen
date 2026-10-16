// A docs site's pages and navigation on disk (docs/<owner>/<repo>/), for the editor.
//
// Page routes are relative paths without the extension ("quickstart",
// "api-reference/add-pet"). Every segment must be a safe name, so a route can never point
// outside the site's folder.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DOCS_DIR, isSafeSegment } = require("../lib/paths");
const { parseFrontmatter } = require("../../lib/frontmatter");
const { normalizeNavigation, DEFAULT_TAB } = require("../../lib/siteManifest");

const MAX_PAGE_BYTES = 200 * 1024;
const MAX_DEPTH = 4;

class PageError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        Object.assign(this, extra);
    }
}

function siteDir(tenant, project) {
    if (!isSafeSegment(tenant) || !isSafeSegment(project)) throw new PageError(400, "Invalid project.");
    return path.join(DOCS_DIR, tenant, project);
}

/** "Guides/quickstart.mdx" or "/guides/quickstart" → "guides/quickstart", or null. */
function normalizeRoute(input) {
    if (typeof input !== "string") return null;
    const route = input.trim().replace(/^\/+|\/+$/g, "").replace(/\.(mdx|md)$/i, "");
    const segments = route.split("/");
    if (!route || segments.length > MAX_DEPTH || !segments.every(isSafeSegment)) return null;
    return route;
}

function slugify(title) {
    return String(title || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const etagOf = (content) => crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);

/** The page's file (existing .mdx, else existing .md, else the .mdx it would be). */
function pageFile(dir, route) {
    const base = path.join(dir, ...route.split("/"));
    if (fs.existsSync(`${base}.mdx`)) return `${base}.mdx`;
    if (fs.existsSync(`${base}.md`)) return `${base}.md`;
    return `${base}.mdx`;
}

// Writes through a temporary file, so readers never see half a page.
function writeAtomic(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, file);
}

/** Every page file under the site folder: [{ route, file }]. Symlinks are skipped. */
function scanPages(dir, prefix = "", depth = 1) {
    if (!fs.existsSync(dir)) return [];
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
            if (depth < MAX_DEPTH && isSafeSegment(entry.name)) found.push(...scanPages(path.join(dir, entry.name), `${prefix}${entry.name}/`, depth + 1));
        } else if (entry.isFile() && /\.(mdx|md)$/i.test(entry.name)) {
            const route = normalizeRoute(`${prefix}${entry.name}`);
            if (route && !found.some((p) => p.route === route)) found.push({ route, file: path.join(dir, entry.name) });
        }
    }
    return found;
}

function titleFromRoute(route) {
    const last = route.split("/").pop().replace(/[-_]+/g, " ");
    return last.charAt(0).toUpperCase() + last.slice(1);
}

function pageMeta(content, route) {
    const { data, content: body } = parseFrontmatter(content);
    const heading = /^#\s+(.+)$/m.exec(body)?.[1];
    return {
        title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : heading?.trim() || titleFromRoute(route),
        description: typeof data.description === "string" ? data.description.trim() : "",
        group: typeof data.group === "string" ? data.group : undefined,
    };
}

function readSiteConfig(dir) {
    for (const name of ["docs.json", "mint.json"]) {
        const file = path.join(dir, name);
        if (!fs.existsSync(file)) continue;
        try {
            const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { file, config: parsed };
        } catch {
            // An unreadable config is replaced on the next save.
        }
    }
    return { file: path.join(dir, "docs.json"), config: null };
}

function writeSiteConfig(dir, project, mutate) {
    const { config } = readSiteConfig(dir);
    const next = mutate(config ? { ...config } : { name: project, navigation: [] });
    writeAtomic(path.join(dir, "docs.json"), JSON.stringify(next, null, 2));
    return next;
}

/** Pages with titles, and the navigation as the published site shows it. */
function listPages(tenant, project) {
    const dir = siteDir(tenant, project);
    const pages = {};
    for (const { route, file } of scanPages(dir)) {
        pages[route] = pageMeta(fs.readFileSync(file, "utf8"), route);
    }
    const { config } = readSiteConfig(dir);
    const navigation = normalizeNavigation(config?.navigation, pages);
    return { exists: fs.existsSync(dir), pages, navigation };
}

function readPage(tenant, project, route) {
    const dir = siteDir(tenant, project);
    const file = pageFile(dir, route);
    if (!fs.existsSync(file)) return null;
    const content = fs.readFileSync(file, "utf8");
    return { route, content, etag: etagOf(content), ...pageMeta(content, route) };
}

function writePage(tenant, project, route, content) {
    if (Buffer.byteLength(content) > MAX_PAGE_BYTES) throw new PageError(413, "This page is too long (200 KB at most).");
    const file = pageFile(siteDir(tenant, project), route);
    writeAtomic(file, content);
    return { route, etag: etagOf(content) };
}

// Each group as docs.json stores it.
const storedGroup = (group) => ({ group: group.group, ...(group.tab ? { tab: group.tab } : {}), pages: group.pages });

/** Adds a page to a group (created at the end of the Documentation tab if it's new). */
function addToNavigation(tenant, project, route, groupName) {
    const dir = siteDir(tenant, project);
    const { pages } = listPages(tenant, project);
    writeSiteConfig(dir, project, (config) => {
        const navigation = normalizeNavigation(config.navigation, pages).map((g) => ({ ...g, pages: g.pages.filter((r) => r !== route) }));
        const name = String(groupName || "").trim().slice(0, 80) || navigation.find((g) => !g.tab)?.group || "Guides";
        let group = navigation.find((g) => g.group === name);
        if (!group) navigation.push((group = { group: name, tab: null, pages: [] }));
        group.pages.push(route);
        return { ...config, navigation: navigation.filter((g) => g.pages.length).map(storedGroup) };
    });
}

function deletePage(tenant, project, route) {
    const dir = siteDir(tenant, project);
    const file = pageFile(dir, route);
    if (!fs.existsSync(file)) return false;
    fs.rmSync(file);
    if (readSiteConfig(dir).config) {
        writeSiteConfig(dir, project, (config) => ({
            ...config,
            navigation: (Array.isArray(config.navigation) ? config.navigation : [])
                .map((g) => (g && typeof g === "object" ? { ...g, pages: (g.pages || []).filter((p) => p !== route) } : g))
                .filter((g) => !g || typeof g !== "object" || (g.pages || []).length),
        }));
    }
    return true;
}

/**
 * Validates and saves the navigation from the editor.
 * @param {{ group: string, tab?: string, pages: string[] }[]} groups
 */
function setNavigation(tenant, project, groups) {
    if (!Array.isArray(groups) || groups.length > 100) throw new PageError(400, "Invalid navigation.");
    const dir = siteDir(tenant, project);
    const { pages } = listPages(tenant, project);
    const seen = new Set();
    const clean = [];
    for (const entry of groups) {
        const name = typeof entry?.group === "string" ? entry.group.trim() : "";
        if (!name || name.length > 80) throw new PageError(400, "Every group needs a name (80 characters at most).");
        const tab = typeof entry.tab === "string" && entry.tab.trim() && entry.tab.trim() !== DEFAULT_TAB ? entry.tab.trim().slice(0, 40) : null;
        if (!Array.isArray(entry.pages) || entry.pages.length > 500) throw new PageError(400, `Invalid pages in "${name}".`);
        const routes = [];
        for (const raw of entry.pages) {
            const route = normalizeRoute(raw);
            if (!route || !pages[route]) throw new PageError(400, `There's no page "${String(raw).slice(0, 100)}".`);
            if (seen.has(route)) throw new PageError(400, `"${route}" is listed twice.`);
            seen.add(route);
            routes.push(route);
        }
        clean.push({ group: name, tab, pages: routes });
    }
    const config = writeSiteConfig(dir, project, (current) => ({ ...current, navigation: clean.filter((g) => g.pages.length).map(storedGroup) }));
    return normalizeNavigation(config.navigation, pages);
}

/** A new page's starting content. */
function newPageContent(title) {
    const safeTitle = String(title).replace(/["\\\n\r]/g, "").trim();
    return `---\ntitle: "${safeTitle}"\ndescription: ""\n---\n\nStart writing here.\n`;
}

module.exports = {
    PageError,
    MAX_PAGE_BYTES,
    siteDir,
    normalizeRoute,
    slugify,
    etagOf,
    scanPages,
    pageMeta,
    listPages,
    readPage,
    writePage,
    deletePage,
    addToNavigation,
    setNavigation,
    readSiteConfig,
    newPageContent,
};
