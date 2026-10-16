// API reference pages generated from an OpenAPI 3.x (or Swagger 2.0) spec in the repo.
//
// These pages are built straight from the spec, without AI: they cost no tokens, and every
// endpoint, parameter and field is exactly what the spec says. Each operation gets a page
// under api-reference/ with its parameters, request body, responses, code samples and a
// "Try it" playground, and api-reference is an overview listing every endpoint.
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const SPEC_NAME = /^(openapi|swagger)([._-][\w.-]*)?\.(ya?ml|json)$/i;
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "__pycache__", ".venv", "vendor", "test", "tests", "__tests__", "examples", "fixtures"]);
const MAX_SPEC_BYTES = 2 * 1024 * 1024;
const MAX_OPERATIONS = 200;
const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];
const BASE = "api-reference";

/** True for file names that look like an OpenAPI spec (openapi.yaml, swagger.json, ...). */
function isSpecFileName(file) {
    return SPEC_NAME.test(path.basename(String(file)));
}

function isValidSpec(spec) {
    return spec && typeof spec === "object" && spec.paths && typeof spec.paths === "object" &&
        (String(spec.openapi || "").startsWith("3.") || String(spec.swagger) === "2.0");
}

function parseSpec(text) {
    // JSON is YAML too; the JSON schema means no custom tags or executable types.
    return yaml.load(text, { schema: yaml.JSON_SCHEMA });
}

/**
 * Finds the repository's OpenAPI spec: files named like openapi.yaml / swagger.json first
 * (shallowest path wins), then any YAML/JSON file that declares `openapi:` or `swagger:`.
 * @returns {{ specPath: string, spec: object } | null}
 */
function findOpenApiSpec(repoDir) {
    const named = [];
    const others = [];
    (function walk(dir, rel, depth) {
        if (depth > 6 || named.length + others.length > 400) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (entry.isSymbolicLink()) continue;
            const childRel = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(path.join(dir, entry.name), childRel, depth + 1);
            } else if (/\.(ya?ml|json)$/i.test(entry.name)) {
                (isSpecFileName(entry.name) ? named : others).push(childRel);
            }
        }
    })(repoDir, "", 0);

    const byDepth = (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b);
    const tryFile = (rel, sniff) => {
        const full = path.join(repoDir, rel);
        try {
            const stat = fs.lstatSync(full);
            if (!stat.isFile() || stat.size > MAX_SPEC_BYTES) return null;
            const text = fs.readFileSync(full, "utf8");
            if (sniff && !/^\s*["']?(openapi|swagger)["']?\s*:/m.test(text.slice(0, 4000))) return null;
            const spec = parseSpec(text);
            return isValidSpec(spec) ? { specPath: rel, spec } : null;
        } catch {
            return null;
        }
    };
    for (const rel of named.sort(byDepth)) {
        const found = tryFile(rel, false);
        if (found) return found;
    }
    for (const rel of others.sort(byDepth).slice(0, 200)) {
        if (/package(-lock)?\.json$|tsconfig|\.eslintrc|composer\.json/i.test(rel)) continue;
        const found = tryFile(rel, true);
        if (found) return found;
    }
    return null;
}

// ─── Text helpers ──────────────────────────────────────────────────────────

// Spec text becomes MDX, so characters MDX treats as code or tags are escaped. Code spans
// and fenced blocks are left alone (MDX shows them literally).
function mdxText(value) {
    const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
    return text.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part, i) => {
        if (i % 2 === 1) return part;
        return part
            .replace(/\\/g, "\\\\")
            .replace(/[{}]/g, (ch) => `\\${ch}`)
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }).join("");
}

// A value for a JSX attribute: one line, no double quotes.
function attr(value) {
    return String(value ?? "").replace(/\s+/g, " ").replace(/"/g, "'").trim();
}

// For YAML frontmatter values.
function yamlString(value) {
    return JSON.stringify(String(value ?? "").replace(/\s+/g, " ").trim());
}

function firstSentence(text, max = 160) {
    const plain = String(text || "").replace(/[`*_#>\[\]]/g, "").replace(/\s+/g, " ").trim();
    const sentence = (plain.match(/^.*?[.!?](\s|$)/) || [plain])[0].trim();
    return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

function kebab(value) {
    return String(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
        .slice(0, 90) || "endpoint";
}

function humanize(operationId) {
    const words = kebab(operationId).split("-").join(" ");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

// ─── Spec helpers ──────────────────────────────────────────────────────────

function createResolver(spec) {
    const lookup = (ref) => {
        if (typeof ref !== "string" || !ref.startsWith("#/")) return undefined;
        return ref.slice(2).split("/").reduce((node, key) => (node == null ? node : node[key.replace(/~1/g, "/").replace(/~0/g, "~")]), spec);
    };
    // Follows $ref chains (with a cycle guard).
    return function resolve(node, depth = 0) {
        let current = node;
        const seen = new Set();
        while (current && typeof current === "object" && current.$ref && depth < 20) {
            if (seen.has(current.$ref)) return {};
            seen.add(current.$ref);
            current = lookup(current.$ref) || {};
            depth++;
        }
        return current || {};
    };
}

function baseUrl(spec) {
    if (spec.swagger) {
        const scheme = (spec.schemes || ["https"])[0];
        return spec.host ? `${scheme}://${spec.host}${spec.basePath || ""}` : spec.basePath || "";
    }
    let url = spec.servers?.[0]?.url || "";
    // Fill server variables with their defaults: {region} → us-east-1
    for (const [name, variable] of Object.entries(spec.servers?.[0]?.variables || {})) {
        url = url.replace(`{${name}}`, variable.default ?? "");
    }
    return url.replace(/\/+$/, "");
}

function typeLabel(schema, resolve) {
    const s = resolve(schema);
    if (s.type === "array") return `${typeLabel(s.items || {}, resolve)}[]`;
    if (s.oneOf || s.anyOf) return (s.oneOf || s.anyOf).map((x) => typeLabel(x, resolve)).join(" | ");
    const type = Array.isArray(s.type) ? s.type.filter((t) => t !== "null").join(" | ") : s.type || (s.properties ? "object" : "any");
    return s.format ? `${type} (${s.format})` : type;
}

// Object properties of a schema (allOf merged; first option of oneOf/anyOf).
function objectShape(schema, resolve) {
    const s = resolve(schema);
    if (s.allOf) {
        return s.allOf.reduce((acc, part) => {
            const shape = objectShape(part, resolve);
            return { properties: { ...acc.properties, ...shape.properties }, required: [...acc.required, ...shape.required] };
        }, { properties: { ...(s.properties || {}) }, required: [...(s.required || [])] });
    }
    if (!s.properties && (s.oneOf || s.anyOf)) return objectShape((s.oneOf || s.anyOf)[0], resolve);
    return { properties: s.properties || {}, required: s.required || [] };
}

function describeSchema(schema, resolve) {
    const s = resolve(schema);
    const parts = [];
    if (s.description) {
        const text = mdxText(s.description);
        parts.push(/[.!?:)]$/.test(text) ? text : `${text}.`);
    }
    if (Array.isArray(s.enum) && s.enum.length) parts.push(`One of: ${s.enum.slice(0, 20).map((v) => `\`${String(v).replace(/`/g, "")}\``).join(", ")}.`);
    if (s.default !== undefined) parts.push(`Defaults to \`${JSON.stringify(s.default).replace(/`/g, "")}\`.`);
    if (s.deprecated) parts.push("Deprecated.");
    return parts.join(" ");
}

// <ParamField>/<ResponseField> elements for an object's properties, nested up to depth 3.
function fieldsFor(schema, { resolve, component, location, prefix = "", depth = 0 }) {
    const s = resolve(schema);
    const target = s.type === "array" ? resolve(s.items || {}) : s;
    const { properties, required } = objectShape(target, resolve);
    const lines = [];
    for (const [name, propSchema] of Object.entries(properties).slice(0, 60)) {
        const prop = resolve(propSchema);
        if (prop.readOnly && component === "ParamField") continue;
        if (prop.writeOnly && component === "ResponseField") continue;
        const flags = [location, required.includes(name) ? "required" : ""].filter(Boolean).join(" ");
        const open = `<${component} name="${attr(prefix + name)}" type="${attr(typeLabel(prop, resolve))}"${flags ? " " + flags : ""}>`;
        const description = describeSchema(prop, resolve);
        const inner = prop.type === "array" ? resolve(prop.items || {}) : prop;
        const nested = depth < 2 && Object.keys(objectShape(inner, resolve).properties).length
            ? fieldsFor(prop, { resolve, component, location, prefix: "", depth: depth + 1 })
            : "";
        lines.push(open);
        if (description) lines.push(description);
        if (nested) lines.push(`<Expandable title="properties">`, nested, `</Expandable>`);
        lines.push(`</${component}>`);
    }
    return lines.join("\n");
}

function exampleFor(schema, resolve, depth = 0) {
    const s = resolve(schema);
    if (s.example !== undefined) return s.example;
    if (s.default !== undefined) return s.default;
    if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
    if (depth > 4) return null;
    if (s.allOf || s.properties || s.type === "object") {
        const { properties } = objectShape(s, resolve);
        const out = {};
        for (const [name, prop] of Object.entries(properties).slice(0, 30)) {
            if (!resolve(prop).writeOnly) out[name] = exampleFor(prop, resolve, depth + 1);
        }
        return out;
    }
    if (s.oneOf || s.anyOf) return exampleFor((s.oneOf || s.anyOf)[0], resolve, depth + 1);
    const type = Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type;
    switch (type) {
        case "array": return [exampleFor(s.items || {}, resolve, depth + 1)];
        case "integer": return 0;
        case "number": return 0.0;
        case "boolean": return true;
        case "string": return { "date-time": "2024-01-01T00:00:00Z", date: "2024-01-01", email: "user@example.com", uuid: "3fa85f64-5717-4562-b3fc-2c963f66afa6", uri: "https://example.com" }[s.format] || "string";
        default: return null;
    }
}

function jsonContent(content = {}) {
    const key = Object.keys(content).find((type) => /json/i.test(type)) || Object.keys(content)[0];
    return key ? { type: key, media: content[key] } : null;
}

// Normalizes an operation (OpenAPI 3 or Swagger 2) into what the page needs.
function normalizeOperation(spec, pathKey, method, pathItem, op, resolve) {
    const params = [...(pathItem.parameters || []), ...(op.parameters || [])]
        .map((p) => resolve(p))
        .filter((p) => p && p.name && p.in);
    // Operation-level parameters override path-level ones with the same name and location.
    const unique = new Map();
    for (const p of params) unique.set(`${p.in}:${p.name}`, p);

    let body = null;
    if (spec.swagger) {
        const bodyParam = [...unique.values()].find((p) => p.in === "body");
        const formParams = [...unique.values()].filter((p) => p.in === "formData");
        if (bodyParam) body = { type: "application/json", schema: bodyParam.schema || {}, required: bodyParam.required, description: bodyParam.description };
        else if (formParams.length) {
            body = {
                type: "application/x-www-form-urlencoded",
                schema: { type: "object", properties: Object.fromEntries(formParams.map((p) => [p.name, { type: p.type, description: p.description, format: p.format, enum: p.enum }])), required: formParams.filter((p) => p.required).map((p) => p.name) },
            };
        }
    } else if (op.requestBody) {
        const rb = resolve(op.requestBody);
        const content = jsonContent(rb.content);
        if (content) body = { type: content.type, schema: content.media?.schema || {}, required: rb.required, description: rb.description, example: content.media?.example ?? Object.values(content.media?.examples || {})[0]?.value };
    }

    const responses = Object.entries(op.responses || {}).map(([status, response]) => {
        const r = resolve(response);
        const content = spec.swagger ? (r.schema ? { type: "application/json", media: { schema: r.schema, example: r.examples?.["application/json"] } } : null) : jsonContent(r.content);
        return { status, description: r.description || "", schema: content?.media?.schema, example: content?.media?.example ?? Object.values(content?.media?.examples || {})[0]?.value };
    });

    return {
        method,
        path: pathKey,
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        tag: op.tags?.[0],
        deprecated: op.deprecated,
        params: [...unique.values()].filter((p) => ["path", "query", "header", "cookie"].includes(p.in)),
        body,
        responses,
        security: op.security ?? spec.security ?? [],
    };
}

function securityParams(spec, security, resolve) {
    const schemes = spec.swagger ? spec.securityDefinitions || {} : spec.components?.securitySchemes || {};
    const out = [];
    for (const requirement of security) {
        for (const name of Object.keys(requirement || {})) {
            const scheme = resolve(schemes[name] || {});
            if (scheme.type === "apiKey") out.push({ in: scheme.in, name: scheme.name, description: scheme.description || `API key (${name}).` });
            else if (scheme.type === "http" && /basic/i.test(scheme.scheme)) out.push({ in: "header", name: "Authorization", description: "Basic authentication: `Basic <base64(username:password)>`.", sample: "Basic <credentials>" });
            else if (scheme.type === "http" || scheme.type === "oauth2" || scheme.type === "openIdConnect" || scheme.type === "basic") {
                out.push({ in: "header", name: "Authorization", description: scheme.description || "Bearer token: `Bearer <token>`.", sample: "Bearer <token>" });
            }
        }
        if (out.length) break; // The first satisfiable requirement is enough to document.
    }
    const seen = new Set();
    return out.filter((p) => !seen.has(`${p.in}:${p.name}`) && seen.add(`${p.in}:${p.name}`));
}

function codeSamples(op, url, authParams) {
    const headers = {};
    for (const p of authParams) if (p.in === "header") headers[p.name] = p.sample || `<${p.name.toLowerCase()}>`;
    const query = authParams.filter((p) => p.in === "query").map((p) => `${encodeURIComponent(p.name)}=<${p.name}>`);
    const fullUrl = query.length ? `${url}?${query.join("&")}` : url;
    const bodyExample = op.body ? op.body.example ?? exampleFor(op.body.schema, op.resolve) : null;
    if (op.body) headers["Content-Type"] = op.body.type;
    const method = op.method.toUpperCase();
    const json = bodyExample !== null && bodyExample !== undefined ? JSON.stringify(bodyExample, null, 2) : null;

    const curl = [`curl --request ${method} \\`, `  --url '${fullUrl}'${Object.keys(headers).length || json ? " \\" : ""}`];
    const headerEntries = Object.entries(headers);
    headerEntries.forEach(([k, v], i) => curl.push(`  --header '${k}: ${v}'${i < headerEntries.length - 1 || json ? " \\" : ""}`));
    if (json) curl.push(`  --data '${json.replace(/'/g, "'\\''")}'`);

    const jsLines = [`const response = await fetch("${fullUrl}", {`, `  method: "${method}",`];
    if (headerEntries.length) jsLines.push(`  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, "\n  ")},`);
    if (json) jsLines.push(`  body: JSON.stringify(${json.replace(/\n/g, "\n  ")}),`);
    jsLines.push("});", "const data = await response.json();");

    const pyArgs = [`"${fullUrl}"`];
    if (headerEntries.length) pyArgs.push(`headers=${JSON.stringify(headers)}`);
    if (json) pyArgs.push(`json=${JSON.stringify(bodyExample).replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None")}`);
    const py = ["import requests", "", `response = requests.${op.method}(${pyArgs.join(", ")})`, "print(response.json())"];

    return ["<RequestExample>", "<CodeGroup>", "", "```bash cURL", ...curl, "```", "", "```javascript JavaScript", ...jsLines, "```", "", "```python Python", ...py, "```", "", "</CodeGroup>", "</RequestExample>"].join("\n");
}

function operationPage(spec, op, { slug, server, resolve }) {
    const method = op.method.toUpperCase();
    const title = op.summary || (op.operationId ? humanize(op.operationId) : `${method} ${op.path}`);
    const description = firstSentence(op.description || op.summary || `${method} ${op.path}`);
    const url = `${server}${op.path}`;
    const authParams = securityParams(spec, op.security, resolve);
    const sections = [
        "---",
        `title: ${yamlString(title)}`,
        `description: ${yamlString(description)}`,
        `api: ${yamlString(`${method} ${op.path}`)}`,
        "---",
        "",
        `<Badge type="${op.method}">${method}</Badge> \`${op.path.replace(/`/g, "")}\`${op.deprecated ? " <Badge type=\"deprecated\">Deprecated</Badge>" : ""}`,
        "",
    ];
    if (op.description) sections.push(mdxText(op.description), "");
    if (/^https?:\/\//i.test(server)) sections.push(`<ApiPlayground method="${method}" endpoint="${attr(url)}" />`, "");

    if (authParams.length) {
        sections.push("## Authorization", "");
        for (const p of authParams) {
            sections.push(`<ParamField name="${attr(p.name)}" type="string" ${p.in === "query" ? "query" : "header"} required>`, mdxText(p.description), "</ParamField>");
        }
        sections.push("");
    }

    for (const [location, heading] of [["path", "Path parameters"], ["query", "Query parameters"], ["header", "Headers"], ["cookie", "Cookies"]]) {
        const params = op.params.filter((p) => p.in === location);
        if (!params.length) continue;
        sections.push(`## ${heading}`, "");
        for (const p of params) {
            const schema = p.schema || { type: p.type, format: p.format, enum: p.enum, items: p.items, default: p.default };
            const flag = location === "cookie" ? "" : ` ${location}`;
            sections.push(`<ParamField name="${attr(p.name)}" type="${attr(typeLabel(schema, resolve))}"${flag}${p.required || location === "path" ? " required" : ""}>`);
            const text = [p.description ? mdxText(p.description) : "", describeSchema({ ...resolve(schema), description: undefined }, resolve)].filter(Boolean).join(" ");
            if (text) sections.push(text);
            sections.push("</ParamField>");
        }
        sections.push("");
    }

    if (op.body) {
        sections.push("## Body", "");
        sections.push(`Content type: \`${op.body.type}\`.${op.body.description ? " " + mdxText(op.body.description) : ""}`, "");
        const fields = fieldsFor(op.body.schema, { resolve, component: "ParamField", location: "body" });
        if (fields) sections.push(fields, "");
    }

    const success = op.responses.find((r) => /^2\d\d$/.test(r.status)) || op.responses.find((r) => r.status === "default");
    if (success) {
        sections.push(`## Response`, "", `\`${success.status}\`${success.description ? " " + mdxText(success.description) : ""}`, "");
        if (success.schema) {
            const fields = fieldsFor(success.schema, { resolve, component: "ResponseField" });
            if (fields) sections.push(fields, "");
        }
    }
    const others = op.responses.filter((r) => r !== success);
    if (others.length) {
        sections.push("## Other responses", "", "| Status | Description |", "| --- | --- |");
        for (const r of others) sections.push(`| \`${r.status}\` | ${mdxText(r.description).replace(/\n+/g, " ").replace(/\|/g, "\\|") || "-"} |`);
        sections.push("");
    }

    sections.push(codeSamples({ ...op, resolve }, url, authParams), "");
    const examples = op.responses.filter((r) => r.schema || r.example !== undefined).slice(0, 3);
    if (examples.length) {
        sections.push("<ResponseExample>", "<CodeGroup>", "");
        for (const r of examples) {
            const example = r.example !== undefined ? r.example : exampleFor(r.schema, resolve);
            sections.push(`\`\`\`json ${r.status}`, JSON.stringify(example, null, 2), "```", "");
        }
        sections.push("</CodeGroup>", "</ResponseExample>", "");
    }

    return { slug, title, mdx: sections.join("\n") };
}

/**
 * Builds the API reference from a spec.
 * @returns {{ pages: { slug: string, title: string, mdx: string }[], navigation: { group: string, pages: string[] }[],
 *            summary: { specPath: string, operations: number, tags: string[], truncated: boolean } }}
 */
function buildApiReference(spec, { specPath = "openapi.yaml" } = {}) {
    const resolve = createResolver(spec);
    const server = baseUrl(spec);

    const operations = [];
    for (const [pathKey, rawItem] of Object.entries(spec.paths || {})) {
        const pathItem = resolve(rawItem);
        for (const method of METHODS) {
            if (pathItem[method] && typeof pathItem[method] === "object") {
                operations.push(normalizeOperation(spec, pathKey, method, pathItem, pathItem[method], resolve));
            }
        }
    }
    const truncated = operations.length > MAX_OPERATIONS;
    const included = operations.slice(0, MAX_OPERATIONS);

    // Tag order: the spec's tags list first, then tags as they appear.
    const tagOrder = [...(spec.tags || []).map((t) => t.name), ...included.map((op) => op.tag || "Endpoints")]
        .filter((tag, i, all) => tag && all.indexOf(tag) === i);

    const used = new Set();
    const pages = [];
    const byTag = new Map(tagOrder.map((tag) => [tag, []]));
    for (const op of included) {
        let name = kebab(op.operationId || `${op.method}-${op.path}`);
        while (used.has(name)) name = `${name}-${used.size}`;
        used.add(name);
        const slug = `${BASE}/${name}`;
        const page = operationPage(spec, op, { slug, server, resolve });
        pages.push(page);
        byTag.get(op.tag || "Endpoints").push({ slug, title: page.title, method: op.method.toUpperCase(), path: op.path });
    }

    // Overview: base URL, authentication, and every endpoint by group.
    const info = spec.info || {};
    const overview = [
        "---",
        `title: ${yamlString("API reference")}`,
        `description: ${yamlString(firstSentence(info.description || `Every endpoint of the ${info.title || "API"}, generated from its OpenAPI spec.`))}`,
        "---",
        "",
    ];
    if (info.description) overview.push(mdxText(info.description), "");
    overview.push(`<Info>Generated from \`${specPath.replace(/`/g, "")}\`${info.version ? ` (version ${mdxText(info.version)})` : ""}. Every endpoint, parameter and field below comes straight from the spec.</Info>`, "");
    if (server) overview.push("## Base URL", "", "```text", server, "```", "");
    const auth = securityParams(spec, spec.security || [], resolve);
    if (auth.length) {
        overview.push("## Authentication", "");
        for (const p of auth) overview.push(`- ${p.in === "query" ? "Query parameter" : "Header"} \`${p.name}\`: ${mdxText(p.description)}`);
        overview.push("");
    }
    for (const [tag, ops] of byTag) {
        if (!ops.length) continue;
        overview.push(`## ${mdxText(tag)}`, "");
        const tagInfo = (spec.tags || []).find((t) => t.name === tag);
        if (tagInfo?.description) overview.push(mdxText(tagInfo.description), "");
        overview.push("| Endpoint | Description |", "| --- | --- |");
        for (const op of ops) overview.push(`| \`${op.method} ${op.path.replace(/`/g, "")}\` | [${mdxText(op.title).replace(/[\[\]|]/g, "")}](/${op.slug}) |`);
        overview.push("");
    }
    if (truncated) overview.push(`<Note>The spec has ${operations.length} endpoints; the first ${MAX_OPERATIONS} are documented.</Note>`, "");
    pages.unshift({ slug: BASE, title: "API reference", mdx: overview.join("\n") });

    // The reference gets its own tab in the docs header.
    const navigation = [{ group: "API reference", tab: "API reference", pages: [BASE] }];
    for (const [tag, ops] of byTag) if (ops.length) navigation.push({ group: tag, tab: "API reference", pages: ops.map((op) => op.slug) });

    return { pages, navigation, summary: { specPath, operations: included.length, tags: [...byTag.keys()].filter((t) => byTag.get(t).length), truncated } };
}

module.exports = { findOpenApiSpec, buildApiReference, isSpecFileName, mdxText, parseSpec, API_REFERENCE_DIR: BASE };
