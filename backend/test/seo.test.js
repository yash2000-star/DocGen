const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";

const { renderTree, resolveDocHref } = require("../seo/renderTree");
const { renderDocument, renderSitemap, renderLlmsTxt, renderRobots, loadSite } = require("../seo/site");
const { compileSafeMdx } = require("../mdx/safeMdx");
const { normalizeNavigation, tabsOf, neighbours } = require("../../lib/siteManifest");
const { normalizeDomain, verifyDomain, DomainError } = require("../services/customDomains");
const { DIST_DIR } = require("../lib/paths");

const ctx = { origin: "https://docs.example.com", base: "/docs/acme/widgets", sitePrefix: "/docs/acme/widgets" };

test("renders a compiled page as escaped, semantic HTML", () => {
    const { tree } = compileSafeMdx(`## Install <Badge>New</Badge>

Run \`npm i\` & see [Quickstart](/quickstart) or [GitHub](https://github.com).

<Note>Watch out for "quotes" & &lt;brackets&gt;.</Note>

<Card title="API" href="/api-reference">Every endpoint</Card>

<Accordion title="FAQ">Answer</Accordion>

<ParamField name="limit" type="integer" query required>How many.</ParamField>

\`\`\`js app.js
if (a < b && c > d) alert("x")
\`\`\`
`);
    const html = renderTree(tree, ctx);
    assert.match(html, /<h2 id="install-new">Install <span class="badge">New<\/span><\/h2>/);
    assert.match(html, /<a href="\/docs\/acme\/widgets\/quickstart">Quickstart<\/a>/);
    assert.match(html, /<a href="https:\/\/github.com">GitHub<\/a>/);
    assert.match(html, /<aside class="callout callout-note">/);
    assert.match(html, /&quot;quotes&quot; &amp;/);
    assert.match(html, /<a class="card" href="\/docs\/acme\/widgets\/api-reference"><strong>API<\/strong>/);
    assert.match(html, /<details><summary>FAQ<\/summary>Answer<\/details>/);
    assert.match(html, /<code>limit<\/code> <span class="type">integer<\/span> <span class="in">query<\/span> <span class="required">required<\/span>/);
    assert.match(html, /<figcaption>app\.js<\/figcaption><pre><code class="language-js">if \(a &lt; b &amp;&amp; c &gt; d\) alert\(&quot;x&quot;\)<\/code><\/pre>/);
    assert.ok(!/<script|onerror|javascript:/i.test(html));
});

test("hostile trees can't inject markup", () => {
    const tree = { t: "root", c: [
        { t: "el", n: "a", p: { href: "java\tscript:alert(1)", onclick: "x" }, c: [{ t: "text", v: "<img src=x onerror=alert(1)>" }] },
        { t: "el", n: "script", p: {}, c: [{ t: "text", v: "alert(1)" }] },
        { t: "el", n: "img", p: { src: "data:text/html,x", alt: '"><script>' } },
        { t: "jsx", n: "Card", p: { title: "</strong><script>", href: "javascript:alert(1)" }, c: [] },
    ] };
    const html = renderTree(tree, ctx);
    assert.ok(!html.includes("<script"), html);
    assert.ok(!/href="java/i.test(html) && !/onclick|src="data/i.test(html), html);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("links follow the viewer's rules, including custom domains", () => {
    assert.equal(resolveDocHref("quickstart", "/docs/a/b", "/docs/a/b"), "/docs/a/b/quickstart");
    assert.equal(resolveDocHref("./guides/setup.mdx#env", "/docs/a/b", "/docs/a/b"), "/docs/a/b/guides/setup#env");
    assert.equal(resolveDocHref("/docs/a/b/x", "", "/docs/a/b"), "/x", "custom domain");
    assert.equal(resolveDocHref("/quickstart", "", "/docs/a/b"), "/quickstart");
    assert.equal(resolveDocHref("#top", "/docs/a/b"), "#top");
    assert.equal(resolveDocHref("javascript:alert(1)", "/docs/a/b"), null);
});

const site = {
    name: "Widgets",
    description: "Widgets for everyone.",
    builtAt: "2026-10-16T10:00:00.000Z",
    pages: {
        introduction: { title: "Introduction", description: "What Widgets does.", group: "Get Started" },
        quickstart: { title: "Quickstart", description: "", group: "Get Started" },
        "api-reference": { title: "API reference", description: "Every endpoint.", group: "API reference" },
        "api-reference/list-widgets": { title: "List widgets", description: "", group: "Widgets" },
    },
    navigation: normalizeNavigation([
        { group: "Get Started", pages: ["introduction", "quickstart", "missing-page"] },
        { group: "API reference", tab: "API reference", pages: ["api-reference"] },
        { group: "Widgets", tab: "API reference", pages: ["api-reference/list-widgets"] },
    ], {
        introduction: {}, quickstart: {}, "api-reference": {}, "api-reference/list-widgets": {},
    }),
};

test("navigation: missing pages dropped, tabs, previous/next within a tab", () => {
    assert.deepEqual(site.navigation.map((g) => [g.group, g.tab, g.pages.length]), [["Get Started", null, 2], ["API reference", "API reference", 1], ["Widgets", "API reference", 1]]);
    assert.deepEqual(tabsOf(site.navigation).map((t) => t.tab), ["Documentation", "API reference"]);
    assert.deepEqual(neighbours(site.navigation, "quickstart"), { previous: "introduction", next: null }, "the next tab isn't 'next'");
    assert.deepEqual(neighbours(site.navigation, "api-reference"), { previous: null, next: "api-reference/list-widgets" });
});

test("a page has its own title, description, canonical, social tags and structured data", () => {
    const page = { title: "Quickstart", tree: compileSafeMdx("Install it &lt;/script&gt; in **two** minutes.").tree };
    const html = renderDocument({ site, config: { metadata: { "og:image": "https://cdn.example.com/og.png" } }, route: "quickstart", page, ctx });
    assert.match(html, /<title>Quickstart - Widgets<\/title>/);
    assert.match(html, /<meta name="description" content="Install it &lt;\/script&gt; in two minutes\.">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/docs\.example\.com\/docs\/acme\/widgets\/quickstart">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/cdn\.example\.com\/og\.png">/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(html, /<link rel="alternate" type="text\/markdown" href="https:\/\/docs\.example\.com\/docs\/acme\/widgets\/quickstart\.md">/);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.equal(ld["@type"], "TechArticle");
    assert.equal(ld.headline, "Quickstart");
    assert.match(html, /<a href="\/docs\/acme\/widgets\/introduction" rel="prev">← Introduction<\/a>/);
    assert.match(html, /aria-current="page">Quickstart</);
    assert.equal((html.match(/<script/g) || []).length, 1, "only the JSON-LD block");
});

test("missing pages get a noindex 404 document", () => {
    const html = renderDocument({ site, config: {}, route: "nope", page: null, ctx });
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.ok(!html.includes('rel="canonical"'));
    assert.match(html, /Page not found/);
});

test("with the app's index.html, the page goes inside #root", () => {
    const template = '<!doctype html><html><head><title>frontend</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
    const html = renderDocument({ site, config: {}, route: "introduction", page: { title: "Introduction", tree: { t: "root", c: [] } }, ctx, template });
    assert.match(html, /<title>Introduction - Widgets<\/title>/);
    assert.match(html, /<div id="root"><header class="site">/);
    assert.match(html, /<script type="module" src="\/assets\/app\.js">/);
    assert.match(html, /<p class="lead">What Widgets does\.<\/p>/);
});

test("sitemap, llms.txt and robots.txt", () => {
    const sitemap = renderSitemap(site, ctx);
    assert.equal((sitemap.match(/<url>/g) || []).length, 4);
    assert.match(sitemap, /<loc>https:\/\/docs\.example\.com\/docs\/acme\/widgets\/api-reference\/list-widgets<\/loc><lastmod>2026-10-16<\/lastmod>/);
    const llms = renderLlmsTxt(site, ctx);
    assert.match(llms, /^# Widgets\n\n> Widgets for everyone\./);
    assert.match(llms, /- \[Introduction\]\(https:\/\/docs\.example\.com\/docs\/acme\/widgets\/introduction\.md\): What Widgets does\./);
    assert.match(renderRobots("https://app.example.com"), /Disallow: \/dashboard\nDisallow: \/api\//);
    assert.match(renderRobots("https://docs.acme.com", { allowAll: true }), /Allow: \/\nSitemap: https:\/\/docs\.acme\.com\/sitemap\.xml/);
});

test("sites built before site.json still load from docs.json", () => {
    const dir = path.join(DIST_DIR, "seo-test-tenant", "old-site");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "docs.json"), JSON.stringify({ name: "Old", navigation: [{ group: "G", pages: ["intro"] }] }));
    fs.writeFileSync(path.join(dir, "intro.page.json"), JSON.stringify({ title: "Intro", tree: { t: "root", c: [] } }));
    try {
        const loaded = loadSite("seo-test-tenant", "old-site");
        assert.deepEqual(loaded.site.pages, { intro: { title: "Intro", description: "", group: "G" } });
        assert.equal(loadSite("../etc", "x"), null);
    } finally {
        fs.rmSync(path.join(DIST_DIR, "seo-test-tenant"), { recursive: true, force: true });
    }
});

test("custom domains are normalized and verified by DNS TXT record", async () => {
    assert.equal(normalizeDomain("https://Docs.Example.com/path?x"), "docs.example.com");
    for (const bad of ["localhost", "127.0.0.1", "example", "-bad.com", "a..b.com", "app.docgen.dev"]) {
        assert.throws(() => normalizeDomain(bad, { appHostnames: ["app.docgen.dev"] }), DomainError, bad);
    }
});
