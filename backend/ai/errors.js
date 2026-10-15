// One error type for every AI provider, so routes and the UI can react the same way
// whether the key belongs to Anthropic, OpenAI, Gemini or a self-hosted model.

const LLM_ERROR_CODES = {
    invalid_key: "The API key was rejected. Check that you copied the whole key.",
    permission_denied: "This key isn't allowed to use that model or endpoint.",
    quota_exceeded: "This key is out of credit or over its spending limit.",
    rate_limited: "The provider is rate limiting this key. Try again in a minute.",
    model_not_found: "That model doesn't exist or this key can't access it.",
    bad_request: "The provider rejected the request.",
    refused: "The model declined to answer this request.",
    provider_unavailable: "The provider is having problems. Try again shortly.",
    network: "Couldn't reach the provider. Check the base URL and your network.",
    invalid_base_url: "That base URL isn't allowed.",
    not_configured: "No AI provider is connected yet.",
};

// Retryable failures are worth trying again later; the others need the user to change something.
const RETRYABLE = new Set(["rate_limited", "provider_unavailable", "network"]);

class LLMError extends Error {
    /**
     * @param {keyof LLM_ERROR_CODES} code
     * @param {object} [details]
     * @param {string} [details.provider]
     * @param {number} [details.status] - HTTP status from the provider, when there was one
     * @param {string} [details.providerMessage] - The provider's own message, for logs and debugging
     */
    constructor(code, { provider, status, providerMessage, cause } = {}) {
        super(LLM_ERROR_CODES[code] || LLM_ERROR_CODES.bad_request, cause ? { cause } : undefined);
        this.name = "LLMError";
        this.code = LLM_ERROR_CODES[code] ? code : "bad_request";
        this.provider = provider;
        this.status = status;
        this.providerMessage = providerMessage;
        this.retryable = RETRYABLE.has(this.code);
    }

    // Safe to send to the browser: no stack, no raw provider payload beyond its message.
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            provider: this.provider,
            retryable: this.retryable,
            providerMessage: this.providerMessage,
        };
    }
}

// Maps an HTTP status (and optional provider error type/code) to one of our codes.
function codeFromStatus(status, providerType = "") {
    const type = String(providerType || "").toLowerCase();
    if (type.includes("insufficient_quota") || type.includes("billing") || status === 402) return "quota_exceeded";
    if (status === 401) return "invalid_key";
    if (status === 403) return "permission_denied";
    if (status === 404) return "model_not_found";
    if (status === 429) return "rate_limited";
    if (status === 408 || status === 529 || (status >= 500 && status <= 599)) return "provider_unavailable";
    if (status >= 400 && status <= 499) return "bad_request";
    return "network";
}

module.exports = { LLMError, LLM_ERROR_CODES, codeFromStatus };
