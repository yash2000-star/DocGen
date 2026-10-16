// Public docs pages as real HTML: what search engines, link previews (Slack, X, LinkedIn)
// and readers without JavaScript see at /docs/<tenant>/<project>/<page>. Each page has its
// own title, description, canonical URL, Open Graph and Twitter tags, structured data and
// content; the docs app takes over in the browser.
const fs = require("fs");
const path = require("path");
const { DIST_DIR, isSafeSegment } = require("../lib/paths");
const { normalizeNavigation, tabsOf, neighbours } = require("../../lib/siteManifest");
const { renderTree, escapeHtml, textOf } = require("./renderTree");

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}

function siteDir(tenant, project) {
    return path.join(DIST_DIR, tenant, project);
}

/**
 * The published site's manifest and docs.json, or null if it isn't published.
 * Sites built before site.json existed get one derived from docs.json and the pages.
 */
function loadSite(tenant, project) {
    if (!isSafeSegment(tenant) || !isSafeSegment(project)) return null;
    const dir = siteDir(tenant, project);
    if (!fs.existsSync(dir)) return null;
    const config = readJson(path.join(dir, "docs.json")) || {};
    let site = readJson(path.join(dir, "site.json"));
    if (!site) {
        const pages = {};
        for (const group of config.navigation || []) {
            for (const entry of group.pages || []) {
                const route = typeof entry === "string" ? entry : entry?.page || entry?.route;
                if (!route || pages[route]) continue;
                const page = readJson(path.join(dir, `${route}.page.json`));
                if (page) pages[route] = { title: page.title || route, description: "", group: group.group };
            }
        }
        site = { name: config.name || project, description: config.description || "", pages, navigation: normalizeNavigation(config.navigation, pages) };
    }
    if (!site.pages || Object.keys(site.pages).length === 0) return null;
    return { site, config };
}

/** A compiled page (page.json), or null. route may contain "/" (nested pages). */
function loadPage(tenant, project, route) {
    const segments = String(route).split("/");
    if (!segments.every(isSafeSegment)) return null;
    return readJson(path.join(siteDir(tenant, project), ...segments) + ".page.json");
}

/** The raw MDX of a page (for "view as Markdown" and AI agents), or null. */
function loadMarkdown(tenant, project, route) {
    const segments = String(route).split("/");
    if (!segments.every(isSafeSegment)) return null;
    const file = path.join(siteDir(tenant, project), ...segments) + ".mdx";
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

/** Every published site, for the sitemap index. */
function listSites() {
    const sites = [];
    let tenants = [];
    try { tenants = fs.readdirSync(DIST_DIR, { withFileTypes: true }); } catch { return sites; }
    for (const tenant of tenants) {
        if (!tenant.isDirectory() || !isSafeSegment(tenant.name)) continue;
        for (const project of fs.readdirSync(path.join(DIST_DIR, tenant.name), { withFileTypes: true })) {
            if (project.isDirectory() && isSafeSegment(project.name) && fs.existsSync(path.join(DIST_DIR, tenant.name, project.name, "docs.json"))) {
                sites.push({ tenant: tenant.name, project: project.name });
            }
        }
    }
    return sites;
}

function firstRoute(site) {
    return site.navigation?.[0]?.pages?.[0] || Object.keys(site.pages)[0];
}

function describe(site, route, page) {
    const fromPage = site.pages[route]?.description;
    if (fromPage) return fromPage;
    // First paragraph of the page.
    const firstParagraph = (page?.tree?.c || []).find((node) => node.t === "el" && node.n === "p");
    const text = textOf(firstParagraph).replace(/\s+/g, " ").trim();
    if (text) return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
    return site.description || `${site.name} documentation`;
}

// JSON inside <script> must not be able to close the tag.
const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

const STYLES = `
*{box-sizing:border-box}body{margin:0;font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#fff}
a{color:#2563eb}header.site{display:flex;align-items:center;gap:24px;padding:14px 24px;border-bottom:1px solid #e2e8f0}
header.site .name{font-weight:700;color:#0f172a;text-decoration:none}header.site nav a{margin-right:16px;text-decoration:none;color:#64748b}
.layout{display:flex;max-width:1200px;margin:0 auto}aside.nav{width:260px;flex-shrink:0;padding:24px;border-right:1px solid #e2e8f0}
aside.nav h2{font-size:13px;margin:20px 0 6px}aside.nav ul{list-style:none;margin:0;padding:0}aside.nav li a{display:block;padding:4px 0;font-size:14px;color:#475569;text-decoration:none}
aside.nav li a[aria-current]{color:#0f172a;font-weight:600}main{flex:1;min-width:0;padding:40px 48px;max-width:820px}
main .lead{font-size:18px;color:#64748b}pre{background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;overflow:auto}code{font-family:ui-monospace,Menlo,monospace;font-size:.9em}
.callout{border-left:4px solid #3b82f6;background:#f8fafc;padding:10px 14px;margin:16px 0;border-radius:6px}.callout-warning,.callout-danger{border-color:#f59e0b}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.card{display:block;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-decoration:none;color:inherit}
.field{border-bottom:1px solid #e2e8f0;padding:10px 0}.field .type,.field .in{color:#64748b;font-size:13px}.field .required{color:#dc2626;font-size:12px}
table{border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:6px 10px}nav.pager{display:flex;justify-content:space-between;margin-top:48px}
footer.site{border-top:1px solid #e2e8f0;padding:24px;color:#64748b;font-size:13px;text-align:center}
@media (max-width:800px){.layout{display:block}aside.nav{width:auto;border-right:0;border-bottom:1px solid #e2e8f0}main{padding:24px 16px}}
`;

/**
 * @param {object} args
 * @param {object} args.site - site.json
 * @param {object} args.config - docs.json
 * @param {string} args.route
 * @param {object|null} args.page - page.json (null → a 404 page)
 * @param {object} args.ctx - { origin, base, sitePrefix, appUrl? }
 * @param {string} [args.template] - The docs app's index.html; the page is placed inside its #root
 */
function renderDocument({ site, config, route, page, ctx, template }) {
    const notFound = !page;
    const pageInfo = site.pages[route] || {};
    const title = notFound ? "Page not found" : page.title || pageInfo.title || route;
    const description = notFound ? `This page doesn't exist in the ${site.name} documentation.` : describe(site, route, page);
    const url = `${ctx.origin}${ctx.base}/${route}`;
    const ogImage = config?.metadata?.["og:image"];

    const head = [
        `<meta name="description" content="${escapeHtml(description)}">`,
        notFound ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${escapeHtml(url)}">`,
        `<meta property="og:type" content="article">`,
        `<meta property="og:site_name" content="${escapeHtml(site.name)}">`,
        `<meta property="og:title" content="${escapeHtml(title)}">`,
        `<meta property="og:description" content="${escapeHtml(description)}">`,
        notFound ? "" : `<meta property="og:url" content="${escapeHtml(url)}">`,
        /^https:\/\//i.test(ogImage || "") ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : "",
        `<meta name="twitter:card" content="${/^https:\/\//i.test(ogImage || "") ? "summary_large_image" : "summary"}">`,
        `<meta name="twitter:title" content="${escapeHtml(title)}">`,
        `<meta name="twitter:description" content="${escapeHtml(description)}">`,
        notFound ? "" : `<link rel="alternate" type="text/markdown" href="${escapeHtml(url)}.md">`,
        notFound ? "" : `<script type="application/ld+json">${safeJson({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: title,
            description,
            url,
            isPartOf: { "@type": "WebSite", name: site.name, url: `${ctx.origin}${ctx.base}/${firstRoute(site)}` },
            ...(site.builtAt ? { dateModified: site.builtAt } : {}),
        })}</script>`,
    ].filter(Boolean).join("\n");

    const nav = tabsOf(site.navigation).map((tab) => tab.groups.map((group) => `<h2>${escapeHtml(group.group)}</h2><ul>${group.pages.map((r) =>
        `<li><a href="${escapeHtml(`${ctx.base}/${r}`)}"${r === route ? ' aria-current="page"' : ""}>${escapeHtml(site.pages[r]?.title || r)}</a></li>`).join("")}</ul>`).join("")).join("");

    const { previous, next } = notFound ? {} : neighbours(site.navigation, route);
    const pager = previous || next ? `<nav class="pager">${previous ? `<a href="${escapeHtml(`${ctx.base}/${previous}`)}" rel="prev">← ${escapeHtml(site.pages[previous]?.title || previous)}</a>` : "<span></span>"}${next ? `<a href="${escapeHtml(`${ctx.base}/${next}`)}" rel="next">${escapeHtml(site.pages[next]?.title || next)} →</a>` : ""}</nav>` : "";

    const article = notFound
        ? `<h1>Page not found</h1><p>This page doesn't exist. <a href="${escapeHtml(`${ctx.base}/${firstRoute(site)}`)}">Go to the first page</a>.</p>`
        : page.error
            ? `<h1>${escapeHtml(title)}</h1><p>This page can't be shown right now.</p>`
            : `<article><h1>${escapeHtml(title)}</h1>${pageInfo.description ? `<p class="lead">${escapeHtml(pageInfo.description)}</p>` : ""}${renderTree(page.tree, ctx)}</article>${pager}`;

    const body = `<header class="site"><a class="name" href="${escapeHtml(`${ctx.base}/${firstRoute(site)}`)}">${escapeHtml(site.name)}</a>${ctx.appUrl ? `<nav><a href="${escapeHtml(ctx.appUrl)}">Open the interactive docs</a></nav>` : ""}</header>
<div class="layout"><aside class="nav" aria-label="Documentation">${nav}</aside><main>${article}</main></div>
<footer class="site">${escapeHtml(site.name)} documentation · Powered by DocGen</footer>`;

    const fullTitle = `${title} - ${site.name}`;
    if (template && template.includes('<div id="root"></div>')) {
        return template
            .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`)
            .replace(/<\/head>/i, `${head}\n<style>${STYLES}</style>\n</head>`)
            .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
    }
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
${head}
<style>${STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function renderSitemap(site, ctx) {
    const lastmod = site.builtAt ? `<lastmod>${escapeHtml(site.builtAt.slice(0, 10))}</lastmod>` : "";
    const routes = site.navigation.flatMap((group) => group.pages);
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `<url><loc>${escapeHtml(`${ctx.origin}${ctx.base}/${route}`)}</loc>${lastmod}</url>`).join("\n")}
</urlset>
`;
}

function renderSitemapIndex(sites, origin) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sites.map((s) => `<sitemap><loc>${escapeHtml(`${origin}/docs/${s.tenant}/${s.project}/sitemap.xml`)}</loc></sitemap>`).join("\n")}
</sitemapindex>
`;
}

/** llms.txt (llmstxt.org): the site's pages for AI agents, linking each page's Markdown. */
function renderLlmsTxt(site, ctx) {
    const lines = [`# ${site.name}`, ""];
    if (site.description) lines.push(`> ${site.description.replace(/\s+/g, " ")}`, "");
    for (const tab of tabsOf(site.navigation)) {
        for (const group of tab.groups) {
            lines.push(`## ${group.group}`, "");
            for (const route of group.pages) {
                const info = site.pages[route] || {};
                lines.push(`- [${info.title || route}](${ctx.origin}${ctx.base}/${route}.md)${info.description ? `: ${info.description.replace(/\s+/g, " ")}` : ""}`);
            }
            lines.push("");
        }
    }
    return lines.join("\n");
}

function renderRobots(origin, { allowAll = false } = {}) {
    return [
        "User-agent: *",
        allowAll ? "Allow: /" : "Allow: /docs/",
        ...(allowAll ? [] : ["Disallow: /dashboard", "Disallow: /api/", "Disallow: /settings"]),
        `Sitemap: ${origin}/sitemap.xml`,
        "",
    ].join("\n");
}

module.exports = { loadSite, loadPage, loadMarkdown, listSites, firstRoute, renderDocument, renderSitemap, renderSitemapIndex, renderLlmsTxt, renderRobots };
