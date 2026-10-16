const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// An in-memory stand-in for the Supabase tables the editor uses.
const db = { projects: [], page_revisions: [] };
let nextId = 1;
function query(table) {
    const filters = [];
    let op = "select";
    let payload = null;
    let order = null;
    let limit = Infinity;
    const api = {
        select() { return api; },
        insert(rows) { op = "insert"; payload = rows; return api; },
        delete() { op = "delete"; return api; },
        eq(col, val) { filters.push((r) => r[col] === val); return api; },
        in(col, vals) { filters.push((r) => vals.includes(r[col])); return api; },
        order(col, { ascending }) { if (!order) order = { col, ascending }; return api; },
        limit(n) { limit = n; return api; },
        run() {
            if (op === "insert") {
                const created = payload.map((row) => ({ id: nextId++, created_at: new Date(Date.now() + nextId).toISOString(), ...row }));
                db[table].push(...created);
                return created;
            }
            let matched = db[table].filter((r) => filters.every((f) => f(r)));
            if (op === "delete") {
                db[table] = db[table].filter((r) => !matched.includes(r));
                return [];
            }
            if (order) matched = [...matched].sort((a, b) => (a[order.col] < b[order.col] ? -1 : 1) * (order.ascending ? 1 : -1));
            return matched.slice(0, limit);
        },
        maybeSingle() { return Promise.resolve({ data: api.run()[0] || null, error: null }); },
        then(resolve) { resolve({ data: api.run(), error: null }); },
    };
    return api;
}
require.cache[path.join(__dirname, "../lib/supabase.js")] = { exports: { from: query } };

const pages = require("../services/sitePages");
const revisions = require("../services/pageRevisions");
const { publishPages } = require("../services/generationPipeline");
const { DOCS_DIR, REPOS_DIR } = require("../lib/paths");

const TENANT = `zz-editor-test-${process.pid}`;
const write = (dir, file, content) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), content); };
const page = (title, body = "Text.") => `---\ntitle: "${title}"\n---\n\n${body}\n`;
test.after(() => {
    fs.rmSync(path.join(DOCS_DIR, TENANT), { recursive: true, force: true });
    fs.rmSync(path.join(REPOS_DIR, TENANT), { recursive: true, force: true });
});

test("page routes can't leave the site folder", () => {
    assert.equal(pages.normalizeRoute("/Guides/quickstart.mdx"), "Guides/quickstart");
    assert.equal(pages.normalizeRoute("api-reference/add-pet"), "api-reference/add-pet");
    for (const bad of ["../secrets", "a/../../b", "/etc/passwd/..", "", "a//b", ".hidden", "a/b/c/d/e", "a b", null]) {
        assert.equal(pages.normalizeRoute(bad), null, String(bad));
    }
    assert.equal(pages.slugify("Héllo, World! v2"), "hello-world-v2");
});

test("pages, etags and navigation on disk", () => {
    const dir = path.join(DOCS_DIR, TENANT, "site");
    write(dir, "intro.mdx", page("Introduction"));
    write(dir, "guides/setup.mdx", page("Setup"));
    write(dir, "docs.json", JSON.stringify({ name: "site", colors: { primary: "#000" }, navigation: [{ group: "Start", pages: ["intro", "missing"] }] }));

    const site = pages.listPages(TENANT, "site");
    assert.deepEqual(Object.keys(site.pages).sort(), ["guides/setup", "intro"]);
    assert.equal(site.pages.intro.title, "Introduction");
    assert.deepEqual(site.navigation.map((g) => [g.group, g.pages]), [["Start", ["intro"]], ["Other pages", ["guides/setup"]]], "missing pages dropped, unlisted appended");

    const read = pages.readPage(TENANT, "site", "intro");
    assert.equal(read.etag, pages.etagOf(read.content));
    const { etag } = pages.writePage(TENANT, "site", "intro", page("Intro", "New"));
    assert.notEqual(etag, read.etag);
    assert.equal(pages.readPage(TENANT, "site", "intro").title, "Intro");

    pages.addToNavigation(TENANT, "site", "guides/setup", "Guides");
    let config = JSON.parse(fs.readFileSync(path.join(dir, "docs.json"), "utf8"));
    assert.deepEqual(config.navigation, [{ group: "Start", pages: ["intro"] }, { group: "Guides", pages: ["guides/setup"] }]);
    assert.deepEqual(config.colors, { primary: "#000" }, "other settings are kept");

    assert.throws(() => pages.setNavigation(TENANT, "site", [{ group: "A", pages: ["nope"] }]), /no page "nope"/);
    assert.throws(() => pages.setNavigation(TENANT, "site", [{ group: "A", pages: ["intro"] }, { group: "B", pages: ["intro"] }]), /listed twice/);
    assert.throws(() => pages.setNavigation(TENANT, "site", [{ group: " ", pages: [] }]), /needs a name/);
    const nav = pages.setNavigation(TENANT, "site", [{ group: "Reference", tab: "API reference", pages: ["guides/setup"] }, { group: "Start", tab: "Documentation", pages: ["intro"] }]);
    assert.deepEqual(nav.map((g) => [g.group, g.tab]), [["Reference", "API reference"], ["Start", null]], "the default tab is stored as no tab");

    assert.equal(pages.deletePage(TENANT, "site", "intro"), true);
    config = JSON.parse(fs.readFileSync(path.join(dir, "docs.json"), "utf8"));
    assert.deepEqual(config.navigation, [{ group: "Reference", tab: "API reference", pages: ["guides/setup"] }], "the empty group goes too");
    assert.equal(pages.readPage(TENANT, "site", "intro"), null);
});

test("a page's latest revision says whether a person edited it", () => {
    const states = revisions.pageStates([
        { id: 5, route: "a", source: "editor", deleted: false },
        { id: 4, route: "b", source: "update", deleted: false },
        { id: 3, route: "a", source: "generation", deleted: false },
        { id: 2, route: "c", source: "editor", deleted: true },
        { id: 1, route: "b", source: "restore", deleted: false },
    ]);
    assert.equal(states.get("a").handEdited, true);
    assert.equal(states.get("b").handEdited, false, "an AI update after a restore means the page follows the AI again");
    assert.equal(states.get("c").deletedByHand, true);
    assert.deepEqual(revisions.revisionsToPrune([{ id: 3, route: "a" }, { id: 2, route: "a" }, { id: 1, route: "a" }, { id: 9, route: "b" }], 2), [1]);
});

test("AI runs never overwrite a page edited by hand: they leave a suggestion", async () => {
    db.projects.push({ id: "p1", tenant_name: TENANT, project_name: "live" });
    const live = path.join(DOCS_DIR, TENANT, "live");
    write(live, "edited.mdx", page("Edited", "My words"));
    write(live, "ai.mdx", page("AI", "Old AI text"));
    write(live, "same.mdx", page("Same"));
    write(live, "api-reference/kept.mdx", page("Kept", "Hand-tuned endpoint"));
    write(live, "api-reference/stale.mdx", page("Stale"));
    db.page_revisions.push(
        { id: nextId++, project_id: "p1", route: "edited", kind: "revision", source: "editor", deleted: false, content: page("Edited", "My words"), created_at: "2026-01-02T00:00:00Z" },
        { id: nextId++, project_id: "p1", route: "gone", kind: "revision", source: "editor", deleted: true, content: page("Gone"), created_at: "2026-01-02T00:00:00Z" },
        { id: nextId++, project_id: "p1", route: "api-reference/kept", kind: "revision", source: "editor", deleted: false, content: "x", created_at: "2026-01-02T00:00:00Z" },
        { id: nextId++, project_id: "p1", route: "edited", kind: "suggestion", source: "update", deleted: false, content: "older suggestion", created_at: "2026-01-01T00:00:00Z" },
    );

    const out = path.join(REPOS_DIR, TENANT, "run", "out");
    write(out, "edited.mdx", page("Edited", "AI rewrite"));
    write(out, "ai.mdx", page("AI", "New AI text"));
    write(out, "same.mdx", page("Same"));
    write(out, "gone.mdx", page("Gone", "Back again"));
    write(out, "new.mdx", page("New"));
    write(out, "api-reference/kept.mdx", page("Kept", "Generated"));
    write(out, "api-reference/fresh.mdx", page("Fresh"));

    const result = await publishPages(out, TENANT, "live", { source: "update", jobId: "11111111-1111-1111-1111-111111111111", replaceApiReference: true });

    assert.equal(fs.readFileSync(path.join(live, "edited.mdx"), "utf8"), page("Edited", "My words"), "the hand-edited page is untouched");
    assert.match(fs.readFileSync(path.join(live, "ai.mdx"), "utf8"), /New AI text/);
    assert.equal(fs.existsSync(path.join(live, "gone.mdx")), false, "a page deleted by hand stays deleted");
    assert.ok(fs.existsSync(path.join(live, "new.mdx")));
    assert.match(fs.readFileSync(path.join(live, "api-reference/kept.mdx"), "utf8"), /Hand-tuned/, "hand-edited API pages survive the refresh");
    assert.equal(fs.existsSync(path.join(live, "api-reference/stale.mdx")), false, "old generated API pages are removed");
    assert.ok(fs.existsSync(path.join(live, "api-reference/fresh.mdx")));

    assert.deepEqual(result.suggested.sort(), ["api-reference/kept", "edited"]);
    assert.deepEqual(result.published.sort(), ["ai", "api-reference/fresh", "new"], "unchanged pages aren't recorded");
    const suggestions = db.page_revisions.filter((r) => r.kind === "suggestion");
    assert.equal(suggestions.filter((r) => r.route === "edited").length, 1, "the older suggestion was replaced");
    assert.match(suggestions.find((r) => r.route === "edited").content, /AI rewrite/);
    assert.equal(suggestions.find((r) => r.route === "edited").job_id, "11111111-1111-1111-1111-111111111111");
    const aiHistory = db.page_revisions.filter((r) => r.route === "ai" && r.kind === "revision").map((r) => r.source);
    assert.deepEqual(aiHistory, ["baseline", "update"], "what was there before history started is kept");
});

test("regenerating keeps pages it didn't write in their groups", () => {
    const { keepOtherPages } = require("../services/generationPipeline");
    const fresh = [{ group: "Get Started", pages: ["introduction", "quickstart"] }, { group: "Pets", tab: "API reference", pages: ["api-reference/add-pet"] }];
    const live = [
        { group: "Get Started", pages: ["introduction", "faq"] },
        { group: "Updates", tab: "Changelog", pages: ["release-notes", "deleted-page"] },
        { group: "Pets", tab: "API reference", pages: ["api-reference/old-endpoint"] },
    ];
    const exists = (route) => route !== "deleted-page";
    assert.deepEqual(keepOtherPages(fresh, live, exists), [
        { group: "Get Started", pages: ["introduction", "quickstart", "faq"] },
        { group: "Pets", tab: "API reference", pages: ["api-reference/add-pet"] },
        { group: "Updates", tab: "Changelog", pages: ["release-notes"] },
    ]);
    assert.equal(keepOtherPages(fresh, undefined, exists), fresh);
});
