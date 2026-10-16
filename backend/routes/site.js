// Public docs sites as crawlable HTML (see seo/site.js):
//   /docs/<tenant>/<project>/<page>      the page, server-rendered
//   /docs/<tenant>/<project>/<page>.md   its Markdown (for "view as Markdown" and AI agents)
//   /docs/<tenant>/<project>/sitemap.xml, /llms.txt
//   /sitemap.xml, /robots.txt            for the whole server
// and, on a verified custom domain, the same site at the root of that domain.
const express = require("express");
const fs = require("fs");
const path = require("path");
const { loadSite, loadPage, loadMarkdown, listSites, firstRoute, renderDocument, renderSitemap, renderSitemapIndex, renderLlmsTxt, renderRobots } = require("../seo/site");

/** The Content-Security-Policy for HTML pages (the docs app runs in them). */
function pageCsp(config) {
    const supabase = config.supabase.url ? new URL(config.supabase.url).origin : "";
    const supabaseWs = supabase.replace(/^http/, "ws");
    return [
        "default-src 'self'",
        "script-src 'self' https://checkout.razorpay.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: https:",
        `connect-src 'self' ${supabase} ${supabaseWs} https://*.supabase.co wss://*.supabase.co`.trim(),
        "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'self'",
    ].join("; ");
}

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {(host: string) => Promise<{ tenant: string, project: string } | null>} deps.findCustomDomain - Verified domains only
 */
function createSiteRouter({ config, findCustomDomain }) {
    const router = express.Router();
    const csp = pageCsp(config);

    // The docs app's index.html, when this server also serves the frontend build.
    let cachedTemplate = { mtime: 0, html: null };
    function template() {
        if (!config.frontend.serve) return null;
        const file = path.join(config.frontend.distDir, "index.html");
        try {
            const { mtimeMs } = fs.statSync(file);
            if (mtimeMs !== cachedTemplate.mtime) cachedTemplate = { mtime: mtimeMs, html: fs.readFileSync(file, "utf8") };
            return cachedTemplate.html;
        } catch {
            return null;
        }
    }

    // Serves one page of a site. base is /docs/<tenant>/<project>, or "" on a custom domain.
    function servePage(req, res, next, { tenant, project, route, base, origin }) {
        const loaded = loadSite(tenant, project);
        if (!loaded) return next();
        const { site, config: docsConfig } = loaded;
        const sitePrefix = `/docs/${tenant}/${project}`;

        if (!route) return res.redirect(301, `${base}/${firstRoute(site)}`);

        if (route.endsWith(".md")) {
            const markdown = loadMarkdown(tenant, project, route.slice(0, -3));
            if (markdown === null) return res.status(404).type("text/plain").send("Not found");
            res.set("Cache-Control", "public, max-age=60");
            return res.type("text/markdown; charset=utf-8").send(markdown);
        }

        const page = loadPage(tenant, project, route);
        const tpl = template();
        const appUrl = !tpl && base && config.frontendUrl !== origin ? `${config.frontendUrl}${sitePrefix}/${route}` : null;
        const html = renderDocument({ site, config: docsConfig, route, page, ctx: { origin, base, sitePrefix, appUrl }, template: tpl });
        res.set("Content-Security-Policy", csp);
        res.set("Cache-Control", page ? "public, max-age=60" : "no-store");
        res.status(page ? 200 : 404).type("html").send(html);
    }

    // ── Custom domains: the whole host is one docs site ─────────────────────
    router.use(async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        if (req.path.startsWith("/api/") || req.path.startsWith("/assets/")) return next();
        const host = String(req.hostname || "").toLowerCase();
        if (!host || config.appHostnames.includes(host)) return next();
        let site;
        try {
            site = await findCustomDomain(host);
        } catch {
            return next();
        }
        if (!site) return next();

        const origin = `https://${host}`;
        const route = decodeURIComponent(req.path.replace(/^\/+|\/+$/g, ""));
        if (route === "robots.txt") return res.type("text/plain").send(renderRobots(origin, { allowAll: true }));
        if (route === "sitemap.xml" || route === "llms.txt") {
            const loaded = loadSite(site.tenant, site.project);
            if (!loaded) return next();
            const ctx = { origin, base: "" };
            return route === "sitemap.xml"
                ? res.type("application/xml").send(renderSitemap(loaded.site, ctx))
                : res.type("text/plain; charset=utf-8").send(renderLlmsTxt(loaded.site, ctx));
        }
        // Static files of the docs app are served by the frontend handler.
        if (/\.(js|css|svg|png|jpe?g|ico|woff2?|map|json|webmanifest)$/i.test(route)) return next();
        return servePage(req, res, next, { tenant: site.tenant, project: site.project, route, base: "", origin });
    });

    // ── Sites under /docs/<tenant>/<project> ────────────────────────────────
    router.get("/docs/:tenant/:project/sitemap.xml", (req, res, next) => {
        const loaded = loadSite(req.params.tenant, req.params.project);
        if (!loaded) return next();
        res.type("application/xml").send(renderSitemap(loaded.site, { origin: config.publicUrl, base: `/docs/${req.params.tenant}/${req.params.project}` }));
    });

    router.get("/docs/:tenant/:project/llms.txt", (req, res, next) => {
        const loaded = loadSite(req.params.tenant, req.params.project);
        if (!loaded) return next();
        res.type("text/plain; charset=utf-8").send(renderLlmsTxt(loaded.site, { origin: config.publicUrl, base: `/docs/${req.params.tenant}/${req.params.project}` }));
    });

    router.get(["/docs/:tenant/:project", "/docs/:tenant/:project/*route"], (req, res, next) => {
        const { tenant, project } = req.params;
        const route = [].concat(req.params.route || []).join("/");
        servePage(req, res, next, { tenant, project, route, base: `/docs/${tenant}/${project}`, origin: config.publicUrl });
    });

    router.get("/sitemap.xml", (req, res) => {
        res.type("application/xml").send(renderSitemapIndex(listSites(), config.publicUrl));
    });

    router.get("/robots.txt", (req, res) => {
        res.type("text/plain").send(renderRobots(config.publicUrl));
    });

    return router;
}

module.exports = { createSiteRouter, pageCsp };
