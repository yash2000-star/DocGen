// Entry point for talking to any AI provider with a user's own key.
//
//   const client = createLLMClient({ provider: "anthropic", apiKey });
//   const { text, usage } = await client.generateText({ model, system, prompt });
//
// Every client has the same methods:
//   generateText({ model, system, prompt, maxTokens, temperature }) → { text, model, truncated, usage }
//   listModels() → [{ id, label }]
//   testConnection({ models }) → { ok: true, unavailableModels: [...] }   (throws on a bad key)
// and throws LLMError with a provider-independent `code`.
const { getProvider } = require("./providers");
const { LLMError } = require("./errors");
const { createAnthropicAdapter } = require("./adapters/anthropic");
const { createOpenAIAdapter } = require("./adapters/openai");
const { createGeminiAdapter } = require("./adapters/gemini");

/**
 * @param {object} options
 * @param {string} options.provider - Catalog id from ./providers
 * @param {string} [options.apiKey]
 * @param {string} [options.baseUrl] - Only used by providers with an editable base URL
 * @param {Function} [options.fetch] - Custom fetch, used by tests
 * @param {number} [options.maxRetries] - SDK retries for temporary failures (default 2)
 * @param {number} [options.retryBaseDelayMs] - First retry delay where we retry ourselves (Gemini)
 */
function createLLMClient({ provider, apiKey, baseUrl, fetch, maxRetries, retryBaseDelayMs } = {}) {
    const definition = getProvider(provider);
    if (!definition) throw new LLMError("not_configured", { provider, providerMessage: `Unknown provider: ${provider}` });
    if (definition.keyRequired && !apiKey) throw new LLMError("invalid_key", { provider, providerMessage: "No API key provided." });

    switch (definition.adapter) {
        case "anthropic":
            return createAnthropicAdapter({ apiKey, fetch, maxRetries });
        case "gemini":
            return createGeminiAdapter({ apiKey, retryBaseDelayMs });
        case "openai": {
            const resolvedBaseUrl = definition.baseUrlEditable ? (baseUrl || definition.baseUrl) : definition.baseUrl;
            if (!resolvedBaseUrl) throw new LLMError("invalid_base_url", { provider, providerMessage: "A base URL is required." });
            return createOpenAIAdapter({ provider, baseUrl: resolvedBaseUrl, apiKey, fetch, maxRetries });
        }
        default:
            throw new LLMError("not_configured", { provider });
    }
}

module.exports = { createLLMClient, LLMError };
