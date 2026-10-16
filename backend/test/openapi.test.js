const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { findOpenApiSpec, buildApiReference, isSpecFileName, mdxText } = require("../openapi");
const { compileSafeMdx } = require("../mdx/safeMdx");

const PETSTORE = fs.readFileSync(path.join(__dirname, "fixtures/petstore.yaml"), "utf8");

function repoWith(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oas-"));
    for (const [name, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), body);
    }
    return dir;
}

// Text of a compiled tree, and the components it uses.
function inspect(tree) {
    const text = [];
    const components = [];
    (function walk(node) {
        if (!node) return;
        if (node.t === "text") text.push(node.v);
        if (node.t === "jsx") components.push({ n: node.n, p: node.p });
        (node.c || []).forEach(walk);
    })(tree);
    return { text: text.join(""), components };
}

test("finds specs by name first, then by content; ignores symlinks and tests", () => {
    assert.equal(isSpecFileName("api/openapi.yaml"), true);
    assert.equal(isSpecFileName("swagger.json"), true);
    assert.equal(isSpecFileName("openapi-v2.yml"), true);
    assert.equal(isSpecFileName("config.yaml"), false);

    const named = repoWith({ "docs/api/openapi.yaml": PETSTORE, "deep/a/b/openapi.yaml": PETSTORE, "test/openapi.yaml": PETSTORE });
    assert.equal(findOpenApiSpec(named).specPath, "docs/api/openapi.yaml");

    const sniffed = repoWith({ "api/spec.yml": PETSTORE, "config/app.yml": "port: 3000\n", "package.json": "{}" });
    assert.equal(findOpenApiSpec(sniffed).specPath, "api/spec.yml");

    const none = repoWith({ "openapi.yaml": "not: a spec\n", "x.json": "{}" });
    assert.equal(findOpenApiSpec(none), null);

    const outside = repoWith({ "real.yaml": PETSTORE });
    const linked = repoWith({ "index.js": "" });
    fs.symlinkSync(path.join(outside, "real.yaml"), path.join(linked, "openapi.yaml"));
    assert.equal(findOpenApiSpec(linked), null);
});

test("builds an overview and one page per operation, grouped by tag", () => {
    const { pages, navigation, summary } = buildApiReference(require("js-yaml").load(PETSTORE), { specPath: "openapi.yaml" });
    assert.deepEqual(summary, { specPath: "openapi.yaml", operations: 4, tags: ["Pets", "Store"], truncated: false });
    assert.deepEqual(pages.map((p) => p.slug), ["api-reference", "api-reference/list-pets", "api-reference/create-pet", "api-reference/delete-pets-pet-id", "api-reference/get-inventory"]);
    assert.deepEqual(navigation, [
        { group: "API reference", tab: "API reference", pages: ["api-reference"] },
        { group: "Pets", tab: "API reference", pages: ["api-reference/list-pets", "api-reference/create-pet", "api-reference/delete-pets-pet-id"] },
        { group: "Store", tab: "API reference", pages: ["api-reference/get-inventory"] },
    ]);
});

test("every generated page compiles to a safe tree, with the spec's text intact", () => {
    const { pages } = buildApiReference(require("js-yaml").load(PETSTORE));
    for (const page of pages) {
        const compiled = compileSafeMdx(page.mdx);
        assert.equal(compiled.ok, true, `${page.slug}: ${compiled.error?.message}`);
    }

    const overview = inspect(compileSafeMdx(pages[0].mdx).tree);
    assert.match(overview.text, /Use \{petId\} placeholders\. <script>alert\('x'\)<\/script>/, "braces and tags are shown as text");
    assert.ok(!overview.components.some((c) => c.n === "script"));
    assert.match(overview.text, /https:\/\/eu\.petstore\.example\.com\/v1/, "server variables use their defaults");

    const list = compileSafeMdx(pages[1].mdx);
    const listInfo = inspect(list.tree);
    assert.match(listInfo.text, /Supports limit and \{cursor\} paging/);
    const playground = listInfo.components.find((c) => c.n === "ApiPlayground");
    assert.deepEqual(playground.p, { method: "GET", endpoint: "https://eu.petstore.example.com/v1/pets" });
    const limit = listInfo.components.find((c) => c.n === "ParamField" && c.p.name === "limit");
    assert.deepEqual(limit.p, { name: "limit", type: "integer (int32)", query: true });
    assert.match(listInfo.text, /Defaults to 20/);
    assert.ok(listInfo.components.some((c) => c.n === "ParamField" && c.p.name === "Authorization" && c.p.header && c.p.required));
    assert.ok(listInfo.components.some((c) => c.n === "ResponseField" && c.p.name === "id" && c.p.required), "array items' fields, allOf merged");
    assert.match(pages[1].mdx, /\| `401` \| Not signed in \\\| expired \|/);

    const create = inspect(compileSafeMdx(pages[2].mdx).tree);
    const bodyFields = create.components.filter((c) => c.n === "ParamField" && c.p.body).map((c) => `${c.p.name}:${c.p.type}${c.p.required ? "!" : ""}`);
    assert.deepEqual(bodyFields, ["name:string!", "tag:string", "owner:object", "name:string", "email:string (email)"], "readOnly id is not a body field; nested owner fields");
    assert.match(create.text, /The pet's name, e\.g\. \{name\}/);
    assert.match(create.text, /One of: dog, cat/);
    assert.ok(create.components.some((c) => c.n === "Expandable"));
    assert.match(pages[2].mdx, /```bash cURL\ncurl --request POST/);
    assert.match(pages[2].mdx, /"owner": \{\n\s+"name": "Ada"/, "the response example from the spec");
    assert.match(pages[2].mdx, /json=\{"name": "string"|json=\{"name":"string"/);

    const del = pages[3];
    assert.match(del.mdx, /Deprecated/);
    assert.ok(inspect(compileSafeMdx(del.mdx).tree).components.some((c) => c.n === "ParamField" && c.p.name === "petId" && c.p.path && c.p.required), "path-level parameters apply");

    const inventory = inspect(compileSafeMdx(pages[4].mdx).tree);
    assert.ok(inventory.components.some((c) => c.n === "ParamField" && c.p.name === "X-API-Key" && c.p.header), "operation security overrides the default");
});

test("Swagger 2.0 specs are supported", () => {
    const spec = {
        swagger: "2.0", info: { title: "Old API", version: "1" }, host: "api.old.example", basePath: "/v2", schemes: ["https"],
        securityDefinitions: { key: { type: "apiKey", in: "query", name: "api_key" } }, security: [{ key: [] }],
        paths: { "/users": { post: { summary: "Create user", parameters: [{ in: "body", name: "body", required: true, schema: { $ref: "#/definitions/User" } }],
            responses: { 200: { description: "OK", schema: { $ref: "#/definitions/User" } } } } } },
        definitions: { User: { type: "object", required: ["email"], properties: { email: { type: "string" }, age: { type: "integer" } } } },
    };
    const { pages } = buildApiReference(spec);
    const page = inspect(compileSafeMdx(pages[1].mdx).tree);
    assert.deepEqual(page.components.find((c) => c.n === "ApiPlayground").p, { method: "POST", endpoint: "https://api.old.example/v2/users" });
    assert.ok(page.components.some((c) => c.n === "ParamField" && c.p.name === "email" && c.p.body && c.p.required));
    assert.ok(page.components.some((c) => c.n === "ParamField" && c.p.name === "api_key" && c.p.query));
    assert.match(pages[1].mdx, /--url 'https:\/\/api\.old\.example\/v2\/users\?api_key=<api_key>'/);
});

test("mdxText escapes outside code only", () => {
    assert.equal(mdxText("a {b} <c> `d {e}` ```\n{f}\n```"), "a \\{b\\} &lt;c&gt; `d {e}` ```\n{f}\n```");
});

test("large specs are capped", () => {
    const paths = {};
    for (let i = 0; i < 230; i++) paths[`/r${i}`] = { get: { responses: { 200: { description: "ok" } } } };
    const { pages, summary } = buildApiReference({ openapi: "3.1.0", info: { title: "Big" }, paths });
    assert.equal(summary.operations, 200);
    assert.equal(summary.truncated, true);
    assert.equal(pages.length, 201);
    assert.match(pages[0].mdx, /230 endpoints; the first 200/);
});
