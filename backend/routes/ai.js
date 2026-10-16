// /api/ai — connect your own AI provider keys.
//
// Every route acts on the signed-in user's own credentials only.
// Errors share one shape: { error: { code, message, ... } }.
const express = require("express");
const { listProviders } = require("../ai/providers");
const { LLMError } = require("../ai/errors");
const { LLM_STATUS } = require("../ai/httpErrors");
const credentials = require("../services/aiCredentials");
const { createRateLimiter } = require("../lib/rateLimit");
const { config } = require("../config");

function sendError(res, error) {
    if (error instanceof LLMError) {
        return res.status(LLM_STATUS[error.code] || 502).json({ error: error.toJSON() });
    }
    if (error instanceof credentials.CredentialError) {
        return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    }
    console.error("[AI credentials] Unexpected error:", error);
    return res.status(500).json({ error: { code: "internal_error", message: "Something went wrong." } });
}

// Wraps a handler so every failure goes through sendError.
const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (error) {
        sendError(res, error);
    }
};

/**
 * @param {object} middleware
 * @param {Function} middleware.requireAuth - Sets req.user
 * @param {Function} middleware.csrfProtection - Cross-site request check (lib/originCheck.js)
 */
function createAiRouter({ requireAuth, csrfProtection }) {
    const router = express.Router();

    // Calls that reach the provider are limited per user.
    const providerCallLimit = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, key: (req) => req.user.id });

    // The provider catalog is public: it's the same for everyone and contains no secrets.
    router.get("/providers", (req, res) => {
        res.json({
            providers: listProviders(),
            enabled: config.byok.enabled,
            allowPrivateEndpoints: config.byok.allowPrivateEndpoints,
        });
    });

    router.get("/credentials", requireAuth, handle(async (req, res) => {
        res.json({ credentials: await credentials.listCredentials(req.user.id) });
    }));

    router.put("/credentials/:provider", csrfProtection, requireAuth, providerCallLimit, handle(async (req, res) => {
        const { apiKey, baseUrl, writerModel, criticModel, makeDefault } = req.body || {};
        const result = await credentials.saveCredential(req.user.id, req.params.provider, {
            apiKey, baseUrl, writerModel, criticModel, makeDefault: makeDefault === true,
        });
        res.json(result);
    }));

    router.post("/credentials/:provider/test", csrfProtection, requireAuth, providerCallLimit, handle(async (req, res) => {
        res.json(await credentials.testCredential(req.user.id, req.params.provider));
    }));

    router.get("/credentials/:provider/models", requireAuth, providerCallLimit, handle(async (req, res) => {
        res.json({ models: await credentials.listModels(req.user.id, req.params.provider) });
    }));

    router.post("/credentials/:provider/default", csrfProtection, requireAuth, handle(async (req, res) => {
        await credentials.setDefault(req.user.id, req.params.provider);
        res.json({ credentials: await credentials.listCredentials(req.user.id) });
    }));

    router.delete("/credentials/:provider", csrfProtection, requireAuth, handle(async (req, res) => {
        await credentials.deleteCredential(req.user.id, req.params.provider);
        res.json({ credentials: await credentials.listCredentials(req.user.id) });
    }));

    return router;
}

module.exports = { createAiRouter };
