// Google Gemini via the official @google/genai SDK.
const { GoogleGenAI, ApiError } = require("@google/genai");
const { LLMError, codeFromStatus } = require("../errors");
const { withRetries } = require("../retry");

const PROVIDER = "gemini";
const DEFAULT_MAX_TOKENS = 16000;

function toLLMError(error) {
    if (error instanceof LLMError) return error;
    if (error instanceof ApiError && typeof error.status === "number") {
        // Gemini answers a bad key with 400 "API key not valid" rather than 401.
        const invalidKey = error.status === 400 && /api key not valid|API_KEY_INVALID/i.test(error.message);
        return new LLMError(invalidKey ? "invalid_key" : codeFromStatus(error.status), {
            provider: PROVIDER,
            status: error.status,
            providerMessage: error.message,
            cause: error,
        });
    }
    return new LLMError("network", { provider: PROVIDER, providerMessage: error?.message, cause: error });
}

/**
 * @param {object} options
 * @param {string} options.apiKey
 * @param {number} [options.retryBaseDelayMs] - First retry delay; tests make it tiny
 */
function createGeminiAdapter({ apiKey, retryBaseDelayMs } = {}) {
    // The SDK's own retryOptions replace ApiError with a generic error (losing the status),
    // so retries are done by withRetries on our normalized errors instead.
    const client = new GoogleGenAI({ apiKey });
    const retry = (fn) => withRetries(fn, { baseDelayMs: retryBaseDelayMs });

    return {
        provider: PROVIDER,

        async generateText({ model, system, prompt, maxTokens = DEFAULT_MAX_TOKENS, temperature }) {
            const response = await retry(async () => {
                try {
                    return await client.models.generateContent({
                        model,
                        contents: prompt,
                        config: {
                            maxOutputTokens: maxTokens,
                            ...(system ? { systemInstruction: system } : {}),
                            ...(typeof temperature === "number" ? { temperature } : {}),
                        },
                    });
                } catch (error) {
                    throw toLLMError(error);
                }
            });

            const candidate = response.candidates?.[0];
            if (!candidate && response.promptFeedback?.blockReason) {
                throw new LLMError("refused", { provider: PROVIDER, providerMessage: response.promptFeedback.blockReason });
            }

            return {
                text: response.text || "",
                model,
                truncated: candidate?.finishReason === "MAX_TOKENS",
                usage: {
                    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
                    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
                },
            };
        },

        async listModels() {
            return retry(async () => {
                try {
                    const models = [];
                    for await (const model of await client.models.list()) {
                        // Only models that can write text are useful as writer or critic.
                        if (model.supportedActions && !model.supportedActions.includes("generateContent")) continue;
                        const id = String(model.name || "").replace(/^models\//, "");
                        models.push({ id, label: model.displayName || id });
                    }
                    return models;
                } catch (error) {
                    throw toLLMError(error);
                }
            });
        },

        async testConnection({ models = [] } = {}) {
            const available = new Set((await this.listModels()).map((m) => m.id));
            return { ok: true, unavailableModels: [...new Set(models.filter(Boolean))].filter((m) => !available.has(m)) };
        },
    };
}

module.exports = { createGeminiAdapter };
