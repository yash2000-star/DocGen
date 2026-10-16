// Turns AI and credential errors into HTTP responses, shared by every route that
// calls a user's AI provider.
const { LLMError } = require("./errors");

// HTTP status for each LLMError code.
const LLM_STATUS = {
    invalid_key: 400,
    permission_denied: 400,
    quota_exceeded: 400,
    model_not_found: 400,
    bad_request: 400,
    refused: 400,
    invalid_base_url: 400,
    not_configured: 400,
    rate_limited: 429,
    provider_unavailable: 502,
    network: 502,
};

/**
 * @param {Error} error
 * @returns {{ status: number, code: string, message: string, providerMessage?: string } | null}
 *   null when the error isn't an AI or credential error (let the caller handle it).
 */
function describeAiError(error) {
    if (error instanceof LLMError) {
        if (error.code === "not_configured") {
            return { status: 400, code: "ai_not_connected", message: "Connect an AI provider in Settings → AI providers first." };
        }
        return { status: LLM_STATUS[error.code] || 502, code: error.code, message: error.message, providerMessage: error.providerMessage };
    }
    if (error?.name === "CredentialError") {
        return { status: error.status, code: error.code, message: error.message };
    }
    return null;
}

module.exports = { LLM_STATUS, describeAiError };
