// OpenAI and every OpenAI-compatible API (OpenRouter, Ollama, LM Studio, vLLM, Groq, ...)
// via the official OpenAI SDK pointed at the provider's base URL.
const OpenAI = require("openai");
const { LLMError, codeFromStatus } = require("../errors");

const DEFAULT_MAX_TOKENS = 16000;

// True if the connection was refused because the endpoint resolves to a private address
// (lib/safeFetch.js). The SDK wraps it, so look through the cause chain.
function isBlockedAddress(error) {
    for (let e = error, depth = 0; e && depth < 5; e = e.cause, depth++) {
        if (e.code === "EBLOCKEDADDRESS") return true;
    }
    return false;
}

function toLLMError(error, provider) {
    if (error instanceof LLMError) return error;
    if (isBlockedAddress(error)) {
        return new LLMError("invalid_base_url", { provider, providerMessage: "This server only connects to public AI endpoints.", cause: error });
    }
    if (error instanceof OpenAI.APIConnectionError) {
        return new LLMError("network", { provider, providerMessage: error.message, cause: error });
    }
    if (error instanceof OpenAI.APIError && typeof error.status === "number") {
        // OpenAI reports an exhausted balance as 429 with code "insufficient_quota".
        return new LLMError(codeFromStatus(error.status, error.code || error.type), {
            provider,
            status: error.status,
            // error.error is the parsed error object; its message is cleaner than error.message.
            providerMessage: error.error?.message || error.message,
            cause: error,
        });
    }
    return new LLMError("network", { provider, providerMessage: error?.message, cause: error });
}

/**
 * @param {object} options
 * @param {string} options.provider - Catalog id (openai, openrouter, ollama, custom)
 * @param {string} options.baseUrl
 * @param {string} [options.apiKey] - Optional for self-hosted endpoints
 * @param {Function} [options.fetch] - Custom fetch, used by tests
 * @param {number} [options.maxRetries]
 */
function createOpenAIAdapter({ provider, baseUrl, apiKey, fetch, maxRetries = 2 } = {}) {
    // The SDK requires a key string; local servers like Ollama ignore it.
    const client = new OpenAI({
        apiKey: apiKey || "not-needed",
        baseURL: baseUrl,
        maxRetries,
        ...(fetch ? { fetch } : {}),
    });

    return {
        provider,

        /**
         * Sends one prompt and returns the model's text.
         * `temperature` is only sent to OpenAI-compatible servers; OpenAI's reasoning models reject it.
         */
        async generateText({ model, system, prompt, maxTokens = DEFAULT_MAX_TOKENS, temperature }) {
            const messages = [];
            if (system) messages.push({ role: "system", content: system });
            messages.push({ role: "user", content: prompt });

            const isOpenAI = provider === "openai";
            let completion;
            try {
                completion = await client.chat.completions.create({
                    model,
                    messages,
                    // OpenAI renamed max_tokens; compatible servers still expect the old name.
                    ...(isOpenAI ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
                    ...(!isOpenAI && typeof temperature === "number" ? { temperature } : {}),
                });
            } catch (error) {
                throw toLLMError(error, provider);
            }

            const choice = completion.choices?.[0];
            if (choice?.message?.refusal) {
                throw new LLMError("refused", { provider, providerMessage: choice.message.refusal });
            }

            return {
                text: choice?.message?.content || "",
                model: completion.model || model,
                truncated: choice?.finish_reason === "length",
                usage: {
                    inputTokens: completion.usage?.prompt_tokens ?? 0,
                    outputTokens: completion.usage?.completion_tokens ?? 0,
                },
            };
        },

        async listModels() {
            try {
                const models = [];
                for await (const model of client.models.list()) {
                    models.push({ id: model.id, label: model.id });
                }
                return models;
            } catch (error) {
                throw toLLMError(error, provider);
            }
        },

        // /models checks the key on OpenAI without spending tokens. OpenRouter's /models is
        // public, so its key is checked against /key first.
        async testConnection({ models = [] } = {}) {
            if (provider === "openrouter") {
                try {
                    await client.get("/key");
                } catch (error) {
                    throw toLLMError(error, provider);
                }
            }
            const available = new Set((await this.listModels()).map((m) => m.id));
            return { ok: true, unavailableModels: [...new Set(models.filter(Boolean))].filter((m) => !available.has(m)) };
        },
    };
}

module.exports = { createOpenAIAdapter };
