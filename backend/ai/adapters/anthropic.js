// Claude via the official Anthropic SDK.
const Anthropic = require("@anthropic-ai/sdk");
const { LLMError, codeFromStatus } = require("../errors");

const PROVIDER = "anthropic";
const DEFAULT_MAX_TOKENS = 64000; // streaming, so large outputs don't hit HTTP timeouts
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function toLLMError(error) {
    if (error instanceof LLMError) return error;
    if (error instanceof Anthropic.APIConnectionError) {
        return new LLMError("network", { provider: PROVIDER, providerMessage: error.message, cause: error });
    }
    if (error instanceof Anthropic.APIError && typeof error.status === "number") {
        return new LLMError(codeFromStatus(error.status, error.type), {
            provider: PROVIDER,
            status: error.status,
            // error.error is the parsed response body; its message is cleaner than error.message.
            providerMessage: error.error?.error?.message || error.message,
            cause: error,
        });
    }
    return new LLMError("network", { provider: PROVIDER, providerMessage: error?.message, cause: error });
}

/**
 * @param {object} options
 * @param {string} options.apiKey
 * @param {Function} [options.fetch] - Custom fetch, used by tests
 * @param {number} [options.maxRetries]
 */
function createAnthropicAdapter({ apiKey, fetch, maxRetries = 2 } = {}) {
    // The SDK retries 408/409/429/5xx and connection errors with backoff.
    const client = new Anthropic({ apiKey, maxRetries, ...(fetch ? { fetch } : {}) });

    return {
        provider: PROVIDER,

        /**
         * Sends one prompt and returns the model's text.
         * `temperature` is ignored: current Claude models don't accept sampling parameters.
         */
        async generateText({ model, system, prompt, maxTokens = DEFAULT_MAX_TOKENS }) {
            let message;
            try {
                // "default" fallbacks re-run a policy-declined request on the model's
                // server-defined fallback. Models without fallback support just run alone.
                message = await client.beta.messages
                    .stream({
                        model,
                        max_tokens: maxTokens,
                        ...(system ? { system } : {}),
                        messages: [{ role: "user", content: prompt }],
                        betas: [FALLBACK_BETA],
                        fallbacks: "default",
                    })
                    .finalMessage();
            } catch (error) {
                throw toLLMError(error);
            }

            if (message.stop_reason === "refusal") {
                throw new LLMError("refused", {
                    provider: PROVIDER,
                    providerMessage: message.stop_details?.explanation || message.stop_details?.category || undefined,
                });
            }

            const text = message.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join("");

            return {
                text,
                model: message.model,
                truncated: message.stop_reason === "max_tokens",
                usage: {
                    inputTokens: message.usage?.input_tokens ?? 0,
                    outputTokens: message.usage?.output_tokens ?? 0,
                },
            };
        },

        async listModels() {
            try {
                const models = [];
                for await (const model of client.models.list()) {
                    models.push({ id: model.id, label: model.display_name || model.id });
                }
                return models;
            } catch (error) {
                throw toLLMError(error);
            }
        },

        // Checks the key without spending tokens, then checks each model this key will use.
        async testConnection({ models = [] } = {}) {
            try {
                await client.models.list({ limit: 1 });
                const unavailableModels = [];
                for (const model of new Set(models.filter(Boolean))) {
                    try {
                        await client.models.retrieve(model);
                    } catch (error) {
                        if (!(error instanceof Anthropic.NotFoundError)) throw error;
                        unavailableModels.push(model);
                    }
                }
                return { ok: true, unavailableModels };
            } catch (error) {
                throw toLLMError(error);
            }
        },
    };
}

module.exports = { createAnthropicAdapter };
