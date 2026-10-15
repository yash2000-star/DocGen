const { test, describe, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createLLMClient, LLMError } = require("../ai");
const { jsonResponse, anthropicStream, fakeFetch } = require("./helpers");

async function rejectsWithCode(promise, code) {
    await assert.rejects(promise, (error) => {
        assert.ok(error instanceof LLMError, `expected LLMError, got ${error}`);
        assert.equal(error.code, code);
        return true;
    });
}

describe("Anthropic adapter", () => {
    test("streams a message with server-side fallbacks and returns text and usage", async () => {
        const fetch = fakeFetch([anthropicStream({ text: "# Intro" })]);
        const client = createLLMClient({ provider: "anthropic", apiKey: "sk-ant-test", fetch, maxRetries: 0 });
        const result = await client.generateText({ model: "claude-opus-5-5", system: "Be brief.", prompt: "Write", temperature: 0.4 });

        assert.equal(result.text, "# Intro");
        assert.equal(result.truncated, false);
        assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 7 });

        const [request] = fetch.requests;
        assert.match(request.url, /\/v1\/messages/);
        assert.equal(request.headers.get("x-api-key"), "sk-ant-test");
        assert.match(request.headers.get("anthropic-beta"), /server-side-fallback-2026-07-01/);
        assert.equal(request.json.fallbacks, "default");
        assert.equal(request.json.stream, true);
        assert.equal(request.json.system, "Be brief.");
        assert.equal(request.json.temperature, undefined, "sampling parameters are not sent to Claude");
        assert.deepEqual(request.json.messages, [{ role: "user", content: "Write" }]);
    });

    test("reports truncation at max_tokens", async () => {
        const fetch = fakeFetch([anthropicStream({ stopReason: "max_tokens" })]);
        const result = await createLLMClient({ provider: "anthropic", apiKey: "k", fetch, maxRetries: 0 }).generateText({ model: "m", prompt: "p" });
        assert.equal(result.truncated, true);
    });

    test("turns a refusal into a refused error", async () => {
        const fetch = fakeFetch([anthropicStream({ text: "", stopReason: "refusal" })]);
        await rejectsWithCode(createLLMClient({ provider: "anthropic", apiKey: "k", fetch, maxRetries: 0 }).generateText({ model: "m", prompt: "p" }), "refused");
    });

    for (const [status, type, code] of [
        [401, "authentication_error", "invalid_key"],
        [403, "permission_error", "permission_denied"],
        [402, "billing_error", "quota_exceeded"],
        [404, "not_found_error", "model_not_found"],
        [429, "rate_limit_error", "rate_limited"],
        [529, "overloaded_error", "provider_unavailable"],
    ]) {
        test(`maps HTTP ${status} to ${code}`, async () => {
            const fetch = fakeFetch([jsonResponse(status, { type: "error", error: { type, message: "nope" } })]);
            await rejectsWithCode(createLLMClient({ provider: "anthropic", apiKey: "k", fetch, maxRetries: 0 }).generateText({ model: "m", prompt: "p" }), code);
        });
    }

    test("tests the key without generating, and flags models the key can't use", async () => {
        const fetch = fakeFetch([
            jsonResponse(200, { data: [], has_more: false, first_id: null, last_id: null }),
            jsonResponse(200, { id: "claude-opus-5-5", type: "model", display_name: "Claude Opus 5.5" }),
            jsonResponse(404, { type: "error", error: { type: "not_found_error", message: "model: nope" } }),
        ]);
        const client = createLLMClient({ provider: "anthropic", apiKey: "k", fetch, maxRetries: 0 });
        const result = await client.testConnection({ models: ["claude-opus-5-5", "nope", "claude-opus-5-5"] });
        assert.deepEqual(result, { ok: true, unavailableModels: ["nope"] });
        assert.equal(fetch.requests.length, 3, "duplicate models are checked once");
        assert.ok(fetch.requests.every((r) => r.method === "GET"));
    });
});

describe("OpenAI-compatible adapter", () => {
    const completion = { id: "c1", object: "chat.completion", model: "m-1", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "Done" } }], usage: { prompt_tokens: 3, completion_tokens: 4 } };

    test("OpenAI: uses max_completion_tokens and no temperature", async () => {
        const fetch = fakeFetch([jsonResponse(200, completion)]);
        const result = await createLLMClient({ provider: "openai", apiKey: "sk-test", fetch, maxRetries: 0 })
            .generateText({ model: "m-1", system: "S", prompt: "P", maxTokens: 500, temperature: 0.5 });
        assert.equal(result.text, "Done");
        assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 4 });
        const [request] = fetch.requests;
        assert.equal(request.url, "https://api.openai.com/v1/chat/completions");
        assert.equal(request.headers.get("authorization"), "Bearer sk-test");
        assert.equal(request.json.max_completion_tokens, 500);
        assert.equal(request.json.max_tokens, undefined);
        assert.equal(request.json.temperature, undefined);
        assert.deepEqual(request.json.messages, [{ role: "system", content: "S" }, { role: "user", content: "P" }]);
    });

    test("Ollama: custom base URL, no key needed, sends max_tokens and temperature", async () => {
        const fetch = fakeFetch([jsonResponse(200, completion)]);
        await createLLMClient({ provider: "ollama", baseUrl: "http://gpu-box:11434/v1", fetch, maxRetries: 0 })
            .generateText({ model: "llama3", prompt: "P", maxTokens: 100, temperature: 0.2 });
        const [request] = fetch.requests;
        assert.equal(request.url, "http://gpu-box:11434/v1/chat/completions");
        assert.equal(request.json.max_tokens, 100);
        assert.equal(request.json.temperature, 0.2);
    });

    test("fixed-URL providers ignore a supplied base URL", async () => {
        const fetch = fakeFetch([jsonResponse(200, completion)]);
        await createLLMClient({ provider: "openai", apiKey: "k", baseUrl: "http://169.254.169.254", fetch, maxRetries: 0 }).generateText({ model: "m", prompt: "p" });
        assert.match(fetch.requests[0].url, /^https:\/\/api\.openai\.com\//);
    });

    test("an exhausted balance (429 insufficient_quota) is quota_exceeded, not a rate limit", async () => {
        const fetch = fakeFetch([jsonResponse(429, { error: { message: "You exceeded your current quota", type: "insufficient_quota", code: "insufficient_quota" } })]);
        await rejectsWithCode(createLLMClient({ provider: "openai", apiKey: "k", fetch, maxRetries: 0 }).generateText({ model: "m", prompt: "p" }), "quota_exceeded");
    });

    test("a bad key is invalid_key", async () => {
        const fetch = fakeFetch([jsonResponse(401, { error: { message: "Incorrect API key", type: "invalid_request_error", code: "invalid_api_key" } })]);
        await rejectsWithCode(createLLMClient({ provider: "openai", apiKey: "k", fetch, maxRetries: 0 }).testConnection(), "invalid_key");
    });

    test("an unreachable endpoint is a network error", async () => {
        const fetch = async () => { throw new TypeError("fetch failed"); };
        await rejectsWithCode(createLLMClient({ provider: "custom", baseUrl: "http://localhost:1/v1", fetch, maxRetries: 0 }).testConnection(), "network");
    });

    test("OpenRouter: checks the key with /key because /models is public", async () => {
        const fetch = fakeFetch([jsonResponse(401, { error: { message: "No auth credentials found", code: 401 } })]);
        await rejectsWithCode(createLLMClient({ provider: "openrouter", apiKey: "sk-or-bad", fetch, maxRetries: 0 }).testConnection(), "invalid_key");
        assert.equal(fetch.requests[0].url, "https://openrouter.ai/api/v1/key");
    });

    test("connection test lists models and reports missing ones", async () => {
        const fetch = fakeFetch([jsonResponse(200, { object: "list", data: [{ id: "llama3", object: "model" }] })]);
        const result = await createLLMClient({ provider: "ollama", fetch, maxRetries: 0 }).testConnection({ models: ["llama3", "qwen"] });
        assert.deepEqual(result, { ok: true, unavailableModels: ["qwen"] });
    });

    test("a refusal message becomes refused", async () => {
        const refused = { ...completion, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: null, refusal: "I can't help with that." } }] };
        const fetch = fakeFetch([jsonResponse(200, refused)]);
        await rejectsWithCode(createLLMClient({ provider: "openai", apiKey: "k", fetch, maxRetries: 0 }).generateText({ model: "m", prompt: "p" }), "refused");
    });
});

describe("Gemini adapter", () => {
    const realFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = realFetch; });

    const generateResponse = { candidates: [{ content: { role: "model", parts: [{ text: "Hi" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } };

    test("generates text with a system instruction", async () => {
        globalThis.fetch = fakeFetch([jsonResponse(200, generateResponse)]);
        const result = await createLLMClient({ provider: "gemini", apiKey: "AIza-test" }).generateText({ model: "gemini-2.5-pro", system: "S", prompt: "P", maxTokens: 100 });
        assert.equal(result.text, "Hi");
        assert.deepEqual(result.usage, { inputTokens: 5, outputTokens: 2 });
        const [request] = globalThis.fetch.requests;
        assert.match(request.url, /models\/gemini-2\.5-pro:generateContent/);
        assert.equal(request.json.generationConfig.maxOutputTokens, 100);
        assert.ok(JSON.stringify(request.json.systemInstruction).includes("S"));
    });

    test("a bad key (400 API key not valid) is invalid_key and is not retried", async () => {
        globalThis.fetch = fakeFetch([jsonResponse(400, { error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } })]);
        await rejectsWithCode(createLLMClient({ provider: "gemini", apiKey: "bad" }).testConnection(), "invalid_key");
        assert.equal(globalThis.fetch.requests.length, 1);
    });

    test("retries a temporary outage, then succeeds", async () => {
        globalThis.fetch = fakeFetch([
            jsonResponse(503, { error: { code: 503, message: "The model is overloaded.", status: "UNAVAILABLE" } }),
            jsonResponse(200, generateResponse),
        ]);
        const result = await createLLMClient({ provider: "gemini", apiKey: "k", retryBaseDelayMs: 1 }).generateText({ model: "m", prompt: "p" });
        assert.equal(result.text, "Hi");
        assert.equal(globalThis.fetch.requests.length, 2);
    });
});

describe("createLLMClient", () => {
    test("rejects unknown providers and missing keys", () => {
        assert.throws(() => createLLMClient({ provider: "nope", apiKey: "k" }), (e) => e.code === "not_configured");
        assert.throws(() => createLLMClient({ provider: "anthropic" }), (e) => e.code === "invalid_key");
        assert.throws(() => createLLMClient({ provider: "custom" }), (e) => e.code === "invalid_base_url");
    });
});

describe("provider messages", () => {
    test("keep the provider's own message, not the raw response body", async () => {
        const anthropicFetch = fakeFetch([jsonResponse(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } })]);
        await assert.rejects(createLLMClient({ provider: "anthropic", apiKey: "k", fetch: anthropicFetch, maxRetries: 0 }).generateText({ model: "m", prompt: "p" }),
            (e) => e.providerMessage === "invalid x-api-key");
        const openaiFetch = fakeFetch([jsonResponse(401, { error: { message: "Incorrect API key provided", type: "invalid_request_error", code: "invalid_api_key" } })]);
        await assert.rejects(createLLMClient({ provider: "openai", apiKey: "k", fetch: openaiFetch, maxRetries: 0 }).testConnection(),
            (e) => e.providerMessage === "Incorrect API key provided");
    });
});
