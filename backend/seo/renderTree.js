// Renders a compiled page tree (backend/mdx/safeMdx.js) as plain, semantic HTML for
// search engines, link previews and readers without JavaScript. The docs app replaces it
// with the interactive version when it loads.
//
// Everything is escaped, only allowlisted elements and attributes are written, and
// components become ordinary HTML (callouts → <aside>, accordions → <details>, ...).

const HTML_ELEMENTS = new Set([
    "p", "strong", "em", "del", "code", "pre", "blockquote", "hr", "br", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
    "div", "span", "sup", "sub", "kbd", "details", "summary", "input",
]);
const VOID = new Set(["br", "hr", "img", "input"]);
const ATTRIBUTES = new Set(["href", "src", "alt", "title", "id", "width", "height", "align", "start", "type", "checked", "disabled", "className"]);

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Browsers ignore spaces and control characters in a URL scheme ("java\tscript:").
function isScriptUrl(value) {
    const compact = [...String(value)].filter((ch) => ch.charCodeAt(0) > 32).join("");
    return /^(javascript|data|vbscript):/i.test(compact);
}

/**
 * Same rules as the viewer's lib/docLinks.js: "/slug", "slug" and "./slug.mdx" point at
 * pages of this site; /docs/<tenant>/<project>/... links are rewritten on custom domains.
 */
function resolveDocHref(href, base, sitePrefix) {
    if (typeof href !== "string" || !href || isScriptUrl(href)) return null;
    if (sitePrefix && base !== sitePrefix && (href === sitePrefix || href.startsWith(`${sitePrefix}/`) || href.startsWith(`${sitePrefix}#`))) {
        href = href.slice(sitePrefix.length) || "/";
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("//")) return href;
    if ((base && href.startsWith("/docs/")) || href.startsWith("/api/")) return href;
    const [pathPart, hash = ""] = href.split("#");
    const slug = pathPart.replace(/^\.?\/+/, "").replace(/\.mdx?$/i, "").replace(/\/+$/, "");
    const target = slug ? `${base}/${slug}` : base || "/";
    return hash ? `${target}#${hash}` : target;
}

function attributes(props = {}, ctx) {
    let out = "";
    for (const [name, value] of Object.entries(props)) {
        if (!ATTRIBUTES.has(name) || value === null || value === undefined || value === false) continue;
        let v = value;
        if (name === "href") v = resolveDocHref(value, ctx.base, ctx.sitePrefix);
        if (name === "src" && isScriptUrl(value)) v = null;
        if (v === null) continue;
        const attr = name === "className" ? "class" : name;
        out += v === true ? ` ${attr}` : ` ${attr}="${escapeHtml(v)}"`;
    }
    return out;
}

function textOf(node) {
    if (!node) return "";
    if (node.t === "text") return node.v;
    return (node.c || []).map(textOf).join("");
}

const CALLOUTS = { Note: "note", Tip: "tip", Info: "info", Warning: "warning", Danger: "danger", Check: "check" };

function renderComponent(node, inner, ctx) {
    const p = node.p || {};
    const title = (value, tag = "strong") => (value ? `<${tag}>${escapeHtml(value)}</${tag}>` : "");
    if (CALLOUTS[node.n]) return `<aside class="callout callout-${CALLOUTS[node.n]}">${inner}</aside>`;
    switch (node.n) {
        case "Callout": return `<aside class="callout">${title(p.title)}${inner}</aside>`;
        case "Steps": return `<ol class="steps">${inner}</ol>`;
        case "Step": return `<li>${title(p.title, "h3")}${inner}</li>`;
        case "Tabs": case "CodeGroup": case "AccordionGroup": return `<div class="${node.n.toLowerCase()}">${inner}</div>`;
        case "Tab": return `<section>${title(p.title, "h4")}${inner}</section>`;
        case "Accordion": case "Expandable": return `<details><summary>${escapeHtml(p.title || "More")}</summary>${inner}</details>`;
        case "CardGroup": return `<div class="cards">${inner}</div>`;
        case "Card": {
            const href = resolveDocHref(p.href, ctx.base, ctx.sitePrefix);
            const body = `${title(p.title)}${inner}`;
            return href ? `<a class="card" href="${escapeHtml(href)}">${body}</a>` : `<div class="card">${body}</div>`;
        }
        case "Frame": return `<figure>${inner}${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ""}</figure>`;
        case "Update": return `<section class="update">${title(p.label, "h3")}${p.date ? `<p><time>${escapeHtml(p.date)}</time></p>` : ""}${inner}</section>`;
        case "Badge": return `<span class="badge">${inner}</span>`;
        case "Tooltip": return `<abbr title="${escapeHtml(p.tip || "")}">${inner || escapeHtml(p.text || "")}</abbr>`;
        case "CodeBlock": {
            const lang = String(p.language || "").replace(/[^\w+-]/g, "");
            return `<figure class="code">${p.title ? `<figcaption>${escapeHtml(p.title)}</figcaption>` : ""}<pre><code${lang ? ` class="language-${lang}"` : ""}>${escapeHtml(textOf(node))}</code></pre></figure>`;
        }
        case "ParamField": case "ResponseField": {
            const where = ["path", "query", "header", "body"].find((k) => p[k]);
            return `<div class="field"><code>${escapeHtml(p.name || "")}</code>${p.type ? ` <span class="type">${escapeHtml(p.type)}</span>` : ""}${where ? ` <span class="in">${where}</span>` : ""}${p.required ? ` <span class="required">required</span>` : ""}${inner ? `<div>${inner}</div>` : ""}</div>`;
        }
        case "RequestExample": return `<section class="example"><h4>Request example</h4>${inner}</section>`;
        case "ResponseExample": return `<section class="example"><h4>Response example</h4>${inner}</section>`;
        case "ApiPlayground": case "CodeGenerator": return `<p class="api"><code>${escapeHtml(`${p.method || "GET"} ${p.endpoint || ""}`.trim())}</code></p>`;
        default: return inner; // Unknown component: keep its content.
    }
}

/**
 * @param {object} tree - Compiled page
 * @param {{ base: string, sitePrefix?: string }} ctx - base: /docs/<tenant>/<project> ("" on a custom domain)
 */
function renderTree(node, ctx) {
    if (!node) return "";
    if (node.t === "text") return escapeHtml(node.v);
    const inner = (node.c || []).map((child) => renderTree(child, ctx)).join("");
    if (node.t === "root") return inner;
    if (node.t === "jsx") return renderComponent(node, inner, ctx);
    if (node.t === "el" && HTML_ELEMENTS.has(node.n)) {
        const attrs = attributes(node.p, ctx);
        return VOID.has(node.n) ? `<${node.n}${attrs}>` : `<${node.n}${attrs}>${inner}</${node.n}>`;
    }
    return inner;
}

module.exports = { renderTree, escapeHtml, resolveDocHref, textOf };
