const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ensureValidMdx, escapeToMarkdown } = require("../mdx/repair");
const { compileSafeMdx } = require("../mdx/safeMdx");
const { LLMError } = require("../ai/errors");

function scriptedLlm(replies) {
    const calls = [];
    return {
        calls,
        llm: {
            criticModel: "critic-model",
            client: {
                async generateText(args) {
                    calls.push(args);
                    const reply = replies.shift();
                    if (reply instanceof Error) throw reply;
                    return { text: reply, truncated: false, usage: {} };
                },
            },
        },
    };
}

const broken = '---\ntitle: "Setup"\n---\n\nUse a <Note> for {braces}.\n\n<Steps>\n<Step title="Open">\nRun it.\n';
const fixed = '---\ntitle: "Setup"\n---\n\nUse a note for \\{braces\\}.\n\n<Steps>\n<Step title="Open">\nRun it.\n</Step>\n</Steps>\n';

test("valid pages pass without any AI call", async () => {
    const { llm, calls } = scriptedLlm([]);
    const result = await ensureValidMdx(fixed, llm);
    assert.equal(result.repairs, 0);
    assert.equal(calls.length, 0);
});

test("a broken page is sent to the critic model with the error, and the fix is used", async () => {
    const { llm, calls } = scriptedLlm(["```mdx\n" + fixed + "```"]);
    const result = await ensureValidMdx(broken, llm, "Setup");
    assert.deepEqual([result.repairs, result.fallback], [1, false]);
    assert.equal(result.mdx.trim(), fixed.trim());
    assert.equal(calls[0].model, "critic-model");
    assert.match(calls[0].prompt, /ERROR at line \d+/);
    assert.match(calls[0].prompt, /AROUND THE ERROR/);
});

test("when repairs keep failing, the text is published as plain markdown", async () => {
    const { llm, calls } = scriptedLlm([broken, broken]);
    const result = await ensureValidMdx(broken, llm);
    assert.equal(calls.length, 2);
    assert.equal(result.fallback, true);
    assert.ok(compileSafeMdx(result.mdx).ok);
    assert.match(result.mdx, /Run it\./);
});

test("a temporary AI error falls back instead of failing the page", async () => {
    const { llm } = scriptedLlm([new LLMError("rate_limited", { provider: "x" })]);
    assert.equal((await ensureValidMdx(broken, llm)).fallback, true);
});

test("a bad key stops the run", async () => {
    const { llm } = scriptedLlm([new LLMError("invalid_key", { provider: "x" })]);
    await assert.rejects(ensureValidMdx(broken, llm), (e) => e.code === "invalid_key");
});

test("plain-markdown fallback leaves code and frontmatter alone", () => {
    const out = escapeToMarkdown('---\ntitle: "<x>"\n---\n\nA <b> {c} `d<e {f}`\n\n```js\nif (a < b) { x() }\n```');
    assert.match(out, /title: "<x>"/);
    assert.match(out, /A &lt;b> &#123;c&#125; `d<e \{f\}`/);
    assert.match(out, /if \(a < b\) \{ x\(\) \}/);
});
