import { createElement, Fragment } from "react";
import { docComponents } from "./registry";
import { resolveDocHref } from "../../lib/docLinks";

const VOID_ELEMENTS = new Set(["br", "hr", "img", "input"]);

// The server already limits pages to these; checking again here means a tampered page
// file still can't add <script>, <iframe> or event handlers.
const HTML_ELEMENTS = new Set([
  "p", "strong", "em", "del", "code", "pre", "blockquote", "hr", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
  "div", "span", "sup", "sub", "kbd", "details", "summary", "input",
]);

// Browsers ignore spaces and control characters in a URL scheme ("java\tscript:").
function isScriptUrl(value) {
  const compact = [...String(value)].filter((ch) => ch.charCodeAt(0) > 32).join("");
  return /^(javascript|data|vbscript):/i.test(compact);
}

function safeProps(props = {}) {
  const result = {};
  for (const [name, value] of Object.entries(props)) {
    if (/^on/i.test(name) || name === "dangerouslySetInnerHTML" || name === "ref" || name === "style") continue;
    if ((name === "href" || name === "src") && isScriptUrl(value)) continue;
    result[name] = value;
  }
  return result;
}

// Builds React elements from a compiled page (see backend/mdx/safeMdx.js). The tree is
// plain data: no code from the page ever runs here, and only known components render.
function renderNode(node, key, linkBase) {
  if (!node) return null;
  if (node.t === "text") return node.v;

  const children = (node.c || []).map((child, index) => renderNode(child, index, linkBase));
  if (node.t === "root") return createElement(Fragment, null, ...children);

  const type = docComponents[node.n] || (node.t === "el" && HTML_ELEMENTS.has(node.n) ? node.n : null);
  // An unknown component (newer page than this viewer): show its content.
  if (!type) return createElement(Fragment, { key }, ...children);

  const props = { ...safeProps(node.p), key };
  // Links to other pages are written as "/slug"; point them at this docs site.
  if (linkBase && typeof props.href === "string") props.href = resolveDocHref(props.href, linkBase);
  if (node.t === "el" && VOID_ELEMENTS.has(node.n)) return createElement(type, props);
  // Spread so a single text child arrives as a string (CodeBlock relies on that).
  return createElement(type, props, ...children);
}

/**
 * @param {object} props
 * @param {object} props.tree - Compiled page
 * @param {string} [props.linkBase] - /docs/<tenant>/<project>, to resolve links between pages
 */
export default function SafeMdxRenderer({ tree, linkBase }) {
  return renderNode(tree, undefined, linkBase);
}
