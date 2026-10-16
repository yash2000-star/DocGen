// Compiles a docs page (MDX) into a plain-data render tree that the browser draws
// without running any code from the page.
//
// Docs are written by AI from repository content, so a page can contain anything a repo
// author (or a prompt injection in their README) slips in. MDX normally allows code:
// `import`/`export`, `{expressions}`, and props like onClick={...}. Here:
//   - import/export and {expressions} are removed ({/* comments */} silently)
//   - only components from ./components.js are kept; unknown ones are unwrapped (text kept)
//   - props must be plain data and on the component's allow-list; event handlers are dropped
//   - links and images may only use http(s), mailto or relative addresses
//
// Render tree nodes:
//   { t: "root", c: [...] }
//   { t: "text", v: "..." }
//   { t: "el",  n: "p" | "a" | ..., p: {props}, c: [...] }   plain HTML element
//   { t: "jsx", n: "Card" | ...,     p: {props}, c: [...] }   docs component

const { unified } = require("unified");
const remarkParse = require("remark-parse").default;
const remarkMdx = require("remark-mdx").default;
const remarkGfm = require("remark-gfm").default;
const remarkRehype = require("remark-rehype").default;
const GithubSlugger = require("github-slugger").default;
const { parseFrontmatter } = require("../../lib/frontmatter");
const { COMPONENTS, HTML_ELEMENTS, URL_PROPS } = require("./components");

const MDX_JSX = ["mdxJsxFlowElement", "mdxJsxTextElement"];
const parser = unified().use(remarkParse).use(remarkMdx).use(remarkGfm);
const toHast = unified().use(remarkRehype, { passThrough: MDX_JSX });

// Removed together with their content: what's inside is code or embedded pages, not docs.
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math"]);

// Components that sit inside a line of text. Every other component is a block.
const INLINE_COMPONENTS = new Set(["Badge", "Tooltip"]);

// Elements whose whitespace-only text children React would warn about.
const NO_TEXT_CHILDREN = new Set(["table", "thead", "tbody", "tfoot", "tr", "ul", "ol"]);
const UNSAFE = Symbol("unsafe");

// ─── Prop values ──────────────────────────────────────────────────────────────

// Turns an expression prop like cols={2} or body={{ name: "x" }} into plain data.
// Anything that isn't a literal (calls, identifiers, functions, spreads) is UNSAFE.
function literalValue(node) {
    switch (node?.type) {
        case "Literal":
            return node.regex ? UNSAFE : node.value;
        case "TemplateLiteral":
            return node.expressions.length === 0 ? node.quasis.map((q) => q.value.cooked).join("") : UNSAFE;
        case "UnaryExpression": {
            if (node.operator !== "-" && node.operator !== "+") return UNSAFE;
            const value = literalValue(node.argument);
            return typeof value === "number" ? (node.operator === "-" ? -value : value) : UNSAFE;
        }
        case "ArrayExpression": {
            const items = node.elements.map((el) => (el === null ? null : literalValue(el)));
            return items.includes(UNSAFE) ? UNSAFE : items;
        }
        case "ObjectExpression": {
            const object = {};
            for (const prop of node.properties) {
                if (prop.type !== "Property" || prop.computed || prop.method || prop.kind !== "init") return UNSAFE;
                const key = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
                if (typeof key !== "string" && typeof key !== "number") return UNSAFE;
                if (key === "__proto__" || key === "constructor" || key === "prototype") return UNSAFE;
                const value = literalValue(prop.value);
                if (value === UNSAFE) return UNSAFE;
                object[key] = value;
            }
            return object;
        }
        default:
            return UNSAFE;
    }
}

function expressionValue(attributeValue) {
    const program = attributeValue.data?.estree;
    const statement = program?.body?.[0];
    if (!program || program.body.length !== 1 || statement.type !== "ExpressionStatement") return UNSAFE;
    return literalValue(statement.expression);
}

// http(s), mailto, and relative addresses only. Browsers ignore whitespace and control
// characters inside a scheme ("java\tscript:"), so those are removed before checking.
function isSafeUrl(value) {
    if (typeof value !== "string") return false;
    const compact = value.replace(/[\u0000- \u007f]/g, "");
    const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i);
    return !scheme || ["http", "https", "mailto"].includes(scheme[1].toLowerCase());
}

/**
 * Reads a JSX element's attributes into props, keeping only allowed names and plain data.
 */
function jsxProps(node, allowed, warnings) {
    const props = {};
    for (const attribute of node.attributes || []) {
        if (attribute.type !== "mdxJsxAttribute") {
            warnings.push(`Removed {...spread} props on <${node.name}>`);
            continue;
        }
        const { name } = attribute;
        if (!allowed.includes(name)) {
            warnings.push(`Removed unsupported prop "${name}" on <${node.name}>`);
            continue;
        }
        let value;
        if (attribute.value === null || attribute.value === undefined) value = true;
        else if (typeof attribute.value === "string") value = attribute.value;
        else value = expressionValue(attribute.value);

        if (value === UNSAFE) {
            warnings.push(`Removed prop "${name}" on <${node.name}>: only plain values are allowed`);
            continue;
        }
        if (URL_PROPS.has(name) && !isSafeUrl(value)) {
            warnings.push(`Removed unsafe ${name} on <${node.name}>`);
            continue;
        }
        props[name] = value;
    }
    return props;
}

// ─── MDX syntax tree: remove code, check components ───────────────────────────

const isCommentExpression = (node) => /^\s*\/\*[\s\S]*\*\/\s*$/.test(node.value || "");

function sanitizeMdast(parent, warnings) {
    const next = [];
    for (const node of parent.children || []) {
        if (node.type === "mdxjsEsm") {
            warnings.push("Removed import/export statement");
            continue;
        }
        if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
            if (!isCommentExpression(node)) warnings.push("Removed {expression}");
            continue;
        }
        if (MDX_JSX.includes(node.type)) {
            const name = node.name;
            if (name && DROP_WITH_CONTENT.has(name.toLowerCase())) {
                warnings.push(`Removed <${name}> and its content`);
                continue;
            }
            const allowed = name && (COMPONENTS[name] || HTML_ELEMENTS[name]);
            if (!allowed) {
                if (name) warnings.push(`Removed unknown component <${name}> (kept its content)`);
                sanitizeMdast(node, warnings);
                next.push(...node.children); // unwrap
                continue;
            }
            node.data = { ...(node.data || {}), safeProps: jsxProps(node, allowed, warnings) };
        }
        sanitizeMdast(node, warnings);

        // A block component written on one line (<Step title="x">text</Step>) is parsed
        // inside a paragraph. Unwrap it, so containers like <Steps> see their real children
        // and no <div> ends up inside a <p>.
        if (node.type === "paragraph" && isOnlyBlockComponents(node)) {
            for (const child of node.children) {
                if (child.type === "mdxJsxTextElement") next.push({ ...child, type: "mdxJsxFlowElement" });
            }
            continue;
        }
        next.push(node);
    }
    if (parent.children) parent.children = next;
}

function isOnlyBlockComponents(paragraph) {
    let components = 0;
    for (const child of paragraph.children || []) {
        if (child.type === "text" && !child.value.trim()) continue;
        if (child.type !== "mdxJsxTextElement" || !COMPONENTS[child.name] || INLINE_COMPONENTS.has(child.name)) return false;
        components++;
    }
    return components > 0;
}

// ─── HTML tree → render tree ──────────────────────────────────────────────────

function textContent(node) {
    if (node.type === "text") return node.value;
    return (node.children || []).map(textContent).join("");
}

// "javascript JavaScript", 'js title="app.js" {1,3-4}' → { title, highlight }
function parseCodeMeta(meta = "") {
    const highlight = (meta.match(/\{([\d,\s-]+)\}/) || [])[1]?.replace(/\s/g, "");
    const titleAttr = meta.match(/title=["']([^"']+)["']/);
    const bare = meta.replace(/\{[\d,\s-]+\}/g, "").replace(/\w+=["'][^"']*["']/g, "").trim();
    const title = titleAttr ? titleAttr[1] : bare || undefined;
    return { title, highlight: highlight || undefined };
}

function elementProps(tag, properties = {}) {
    const allowed = HTML_ELEMENTS[tag] || [];
    const props = {};
    for (const name of allowed) {
        let value = properties[name];
        if (value === undefined || value === null) continue;
        if (name === "className") {
            // Only the language class on code (from ```lang fences); nothing else.
            value = [].concat(value).filter((c) => /^language-[\w+#.-]+$/.test(c)).join(" ");
            if (!value) continue;
        }
        if (URL_PROPS.has(name) && !isSafeUrl(value)) continue;
        props[name] = value;
    }
    if (tag === "input") {
        if (props.type !== "checkbox") return null; // only task-list checkboxes
        props.readOnly = true;
    }
    return props;
}

function toRenderTree(node, slugger, parentTag) {
    const children = () => (node.children || [])
        .flatMap((child) => toRenderTree(child, slugger, node.tagName || node.name))
        .filter(Boolean);

    switch (node.type) {
        case "root":
            return { t: "root", c: children() };
        case "text":
            if (NO_TEXT_CHILDREN.has(parentTag) && !node.value.trim()) return null;
            return { t: "text", v: node.value };
        case "element": {
            const tag = node.tagName;
            // ```lang fences become <CodeBlock language title highlight>code</CodeBlock>
            if (tag === "pre" && node.children?.[0]?.tagName === "code") {
                const code = node.children[0];
                const language = [].concat(code.properties?.className || [])
                    .map((c) => String(c).replace(/^language-/, ""))[0] || "text";
                const { title, highlight } = parseCodeMeta(code.data?.meta || "");
                const p = { language };
                if (title) p.title = title;
                if (highlight) p.highlight = highlight;
                return { t: "jsx", n: "CodeBlock", p, c: [{ t: "text", v: textContent(code).replace(/\n$/, "") }] };
            }
            if (!HTML_ELEMENTS[tag]) return children(); // unwrap
            const props = elementProps(tag, node.properties);
            if (props === null) return null;
            if (/^h[1-6]$/.test(tag)) props.id = slugger.slug(textContent(node));
            return { t: "el", n: tag, p: props, c: children() };
        }
        case "mdxJsxFlowElement":
        case "mdxJsxTextElement": {
            const props = { ...(node.data?.safeProps || {}) };
            if (HTML_ELEMENTS[node.name]) {
                if (node.name === "input" && props.type !== "checkbox") return null;
                return { t: "el", n: node.name, p: props, c: children() };
            }
            return { t: "jsx", n: node.name, p: props, c: children() };
        }
        default:
            return children(); // comments, raw, doctype: keep only their children, if any
    }
}

/**
 * @param {string} source - MDX, with or without --- frontmatter
 * @returns {{ ok: true, tree: object, warnings: string[] } | { ok: false, error: { message: string, line?: number, column?: number } }}
 */
function compileSafeMdx(source) {
    const text = String(source || "");
    const content = parseFrontmatter(text).content;
    // Report error lines against the whole file, frontmatter included.
    const lineOffset = content && text.indexOf(content) > 0 ? text.slice(0, text.indexOf(content)).split("\n").length - 1 : 0;

    let mdast;
    try {
        mdast = parser.runSync(parser.parse(content));
    } catch (error) {
        const message = error.reason || error.message;
        // Some errors only carry their position in the message, as "(line:column-...)".
        const inMessage = String(message).match(/\((\d+):(\d+)/);
        const contentLine = error.line ?? error.place?.line ?? error.place?.start?.line ?? (inMessage ? Number(inMessage[1]) : undefined);
        const line = contentLine === undefined ? undefined : contentLine + lineOffset;
        const column = error.column ?? error.place?.column ?? error.place?.start?.column ?? (inMessage ? Number(inMessage[2]) : undefined);
        return { ok: false, error: { message, line, column } };
    }

    const warnings = [];
    sanitizeMdast(mdast, warnings);
    const hast = toHast.runSync(mdast);
    const tree = toRenderTree(hast, new GithubSlugger());
    return { ok: true, tree, warnings: [...new Set(warnings)] };
}

module.exports = { compileSafeMdx, isSafeUrl, parseCodeMeta };
