// Central place for environment configuration.
// Every backend module (and build/build.js) should read settings from here
// instead of calling dotenv or reading process.env directly.
const path = require("path");
const { parseMasterKey } = require("./lib/secretBox");

require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const env = process.env;

const config = {
    nodeEnv: env.NODE_ENV || "development",
    port: Number(env.PORT) || 4000,
    frontendUrl: (env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, ""),

    supabase: {
        url: env.SUPABASE_URL,
        // The backend needs the service-role key because it writes rows on behalf
        // of users. SUPABASE_KEY is still accepted for older .env files.
        serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY,
    },

    // Users write docs with their own AI keys (Settings → AI providers). The server's own
    // AI credential is optional and only powers the anonymous free preview, which is off
    // unless the administrator sets PREVIEW_AI_PROVIDER and its key (or base URL).
    preview: {
        provider: env.PREVIEW_AI_PROVIDER || "",
        apiKey: env.PREVIEW_AI_API_KEY || "",
        baseUrl: env.PREVIEW_AI_BASE_URL || "",
        writerModel: env.PREVIEW_AI_WRITER_MODEL || "",
        criticModel: env.PREVIEW_AI_CRITIC_MODEL || "",
        // How many pages an anonymous preview may generate.
        maxPages: Number(env.PREVIEW_MAX_PAGES) || 3,
    },

    // Largest prompt (in tokens) sent to a model for one call. Repos bigger than this are
    // summarized: the most important files go in full, the rest are listed by name.
    promptBudgetTokens: Number(env.AI_PROMPT_BUDGET_TOKENS) || 60000,

    razorpay: {
        keyId: env.RAZORPAY_KEY_ID,
        keySecret: env.RAZORPAY_KEY_SECRET,
        webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
        proPlanId: env.RAZORPAY_PRO_PLAN_ID,
    },

    email: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
    },

    github: {
        // Secret set on the repo's GitHub webhook. Push-triggered updates are off without it.
        webhookSecret: env.GITHUB_WEBHOOK_SECRET || "",
    },

    // Bring-your-own-key: users' AI provider keys are encrypted with this master key.
    byok: {
        masterKey: null,
        configError: null,
        // Self-hosted models (Ollama, LM Studio) live on localhost or a private network.
        // Allowed by default in development, off in production unless set explicitly.
        allowPrivateEndpoints: env.ALLOW_PRIVATE_AI_ENDPOINTS
            ? env.ALLOW_PRIVATE_AI_ENDPOINTS === "true"
            : (env.NODE_ENV || "development") !== "production",
    },
};

try {
    config.byok.masterKey = parseMasterKey(env.AI_KEY_ENCRYPTION_KEY);
} catch (err) {
    config.byok.configError = err.message;
}
config.byok.enabled = Boolean(config.byok.masterKey);

config.razorpay.enabled = Boolean(config.razorpay.keyId && config.razorpay.keySecret);
config.email.enabled = Boolean(config.email.user && config.email.pass);
config.preview.enabled = Boolean(config.preview.provider && (config.preview.apiKey || config.preview.baseUrl));

// Throws with a readable list when a setting the server can't run without is missing.
function assertRequiredConfig() {
    const missing = [];
    if (!config.supabase.url) missing.push("SUPABASE_URL");
    if (!config.supabase.serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    if (config.byok.configError) {
        throw new Error(config.byok.configError);
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}\n` +
            `  → Copy backend/.env.example to backend/.env and fill them in.`
        );
    }
}

// Prints which optional features are switched off, so a fresh setup explains itself.
function logOptionalFeatures(log = console.log) {
    if (!config.byok.enabled) {
        log("[Config] Doc generation and Ask AI disabled: set AI_KEY_ENCRYPTION_KEY (openssl rand -base64 32) so users can connect their AI keys.");
    }
    if (!config.preview.enabled) {
        log("[Config] Anonymous free preview disabled: set PREVIEW_AI_PROVIDER and PREVIEW_AI_API_KEY to enable it.");
    }
    if (!config.razorpay.enabled) {
        log("[Config] Billing disabled: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable it.");
    }
    if (!config.email.enabled) {
        log("[Config] Email notifications disabled: set EMAIL_USER and EMAIL_PASS to enable them.");
    }
}

module.exports = { config, assertRequiredConfig, logOptionalFeatures };
