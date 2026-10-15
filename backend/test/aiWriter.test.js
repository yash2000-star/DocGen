const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { generateArchitectBlueprint, generatePage } = require("../aiWriter");
const { LLMError } = require("../ai/errors");

// A stand-in for createLLMClient(): answers each call with the next scripted reply.
function scriptedLlm(replies) {
    const calls = [];
    const client = {
        async generateText(args) {
            calls.push(args);
            const reply = replies.shift();
            if (reply instanceof Error) throw reply;
            return { text: reply?.text ?? reply, truncated: Boolean(reply?.truncated), usage: { inputTokens: 1, outputTokens: 1 } };
        },
    };
    return { llm: { client, writerModel: "writer-model", criticModel: "critic-model" }, calls };
}

const codeFiles = [{ path: "/repos/a/b/index.js", code: "console.log('hi')" }];
const plan = { projectName: "Demo", pages: [{ slug: "introduction", title: "Introduction", group: "Get Started", type: "synthetic", purpose: "p", sourceContext: "all", writingInstructions: "w" }] };

describe("architect", () => {
    test("uses the writer model and parses JSON wrapped in a code fence", async () => {
        const { llm, calls } = scriptedLlm(["```json\n" + JSON.stringify(plan) + "\n```"]);
        const blueprint = await generateArchitectBlueprint(codeFiles, [], "demo", llm);
        assert.equal(blueprint.pages[0].slug, "introduction");
        assert.equal(calls[0].model, "writer-model");
        assert.match(calls[0].prompt, /index\.js/);
    });

    test("drops pages without a slug, title or group", async () => {
        const messy = { pages: [...plan.pages, { title: "No slug" }] };
        const { llm } = scriptedLlm([JSON.stringify(messy)]);
        assert.equal((await generateArchitectBlueprint(codeFiles, [], "demo", llm)).pages.length, 1);
    });

    test("falls back to a basic plan when the reply isn't valid JSON", async () => {
        const { llm } = scriptedLlm(["Sure! Here is a plan: ..."]);
        const blueprint = await generateArchitectBlueprint(codeFiles, [], "demo", llm);
        assert.deepEqual(blueprint.pages.map((p) => p.slug), ["introduction", "quickstart"]);
    });

    test("stops the run on a bad key instead of falling back", async () => {
        const { llm } = scriptedLlm([new LLMError("invalid_key", { provider: "anthropic" })]);
        await assert.rejects(generateArchitectBlueprint(codeFiles, [], "demo", llm), (e) => e.code === "invalid_key");
    });

    test("falls back on a temporary provider problem", async () => {
        const { llm } = scriptedLlm([new LLMError("provider_unavailable", { provider: "anthropic" })]);
        assert.equal((await generateArchitectBlueprint(codeFiles, [], "demo", llm)).pages.length, 2);
    });
});

describe("page writer and critic", () => {
    test("writes with the writer model, then reviews with the critic model", async () => {
        const { llm, calls } = scriptedLlm(["---\ntitle: draft\n---\nDraft", "---\ntitle: final\n---\nFinal"]);
        const page = await generatePage(plan.pages[0], codeFiles, [], plan, llm);
        assert.match(page, /Final/);
        assert.deepEqual(calls.map((c) => c.model), ["writer-model", "critic-model"]);
    });

    test("keeps the draft when the critic's review is cut off", async () => {
        const { llm } = scriptedLlm(["---\ntitle: d\n---\nDraft body", { text: "---\ntitle: d\n---\nHalf", truncated: true }]);
        assert.match(await generatePage(plan.pages[0], codeFiles, [], plan, llm), /Draft body/);
    });

    test("keeps the draft when the critic hits a temporary error", async () => {
        const { llm } = scriptedLlm(["Draft body", new LLMError("rate_limited", { provider: "openai" })]);
        assert.equal(await generatePage(plan.pages[0], codeFiles, [], plan, llm), "Draft body");
    });

    test("stops the run when the critic model doesn't exist", async () => {
        const { llm } = scriptedLlm(["Draft body", new LLMError("model_not_found", { provider: "openai" })]);
        await assert.rejects(generatePage(plan.pages[0], codeFiles, [], plan, llm), (e) => e.code === "model_not_found");
    });

    test("skips just this page on a temporary writer error", async () => {
        const { llm } = scriptedLlm([new LLMError("network", { provider: "ollama" })]);
        assert.equal(await generatePage(plan.pages[0], codeFiles, [], plan, llm), null);
    });

    test("targeted pages get only the files they asked for", async () => {
        const files = [{ path: "/r/a/b/routes.js", code: "ROUTES_CODE" }, { path: "/r/a/b/other.js", code: "OTHER_CODE" }];
        const { llm, calls } = scriptedLlm(["Draft", "Final"]);
        await generatePage({ ...plan.pages[0], sourceContext: "routes.js" }, files, [], plan, llm);
        assert.match(calls[0].prompt, /ROUTES_CODE/);
        assert.doesNotMatch(calls[0].prompt, /OTHER_CODE/);
    });
});
