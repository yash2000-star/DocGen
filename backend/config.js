// Central place for environment configuration.
// Every backend module (and build/build.js) should read settings from here
// instead of calling dotenv or reading process.env directly.
const path = require("path");

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

    gemini: {
        apiKey: env.GEMINI_API_KEY,
        writerModel: env.GEMINI_WRITER_MODEL || "gemini-3-flash-preview",
        editorModel: env.GEMINI_EDITOR_MODEL || "gemini-2.5-flash-lite",
        chatModel: env.GEMINI_CHAT_MODEL || "gemini-2.5-pro",
        embeddingModel: env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
    },

    // Optional: use Vertex AI (Google Cloud) for the writer instead of a Gemini API key.
    vertex: {
        project: env.GOOGLE_CLOUD_PROJECT || env.ANTHROPIC_VERTEX_PROJECT_ID,
        location: env.GOOGLE_CLOUD_REGION || env.CLOUD_ML_REGION || "us-east5",
    },

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

    // How many pages an anonymous "free preview" may generate.
    previewMaxPages: Number(env.PREVIEW_MAX_PAGES) || 3,
};

config.razorpay.enabled = Boolean(config.razorpay.keyId && config.razorpay.keySecret);
config.email.enabled = Boolean(config.email.user && config.email.pass);
config.ai = {
    writerEnabled: Boolean(config.vertex.project || config.gemini.apiKey),
    geminiEnabled: Boolean(config.gemini.apiKey),
};

// Throws with a readable list when a setting the server can't run without is missing.
function assertRequiredConfig() {
    const missing = [];
    if (!config.supabase.url) missing.push("SUPABASE_URL");
    if (!config.supabase.serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}\n` +
            `  → Copy backend/.env.example to backend/.env and fill them in.`
        );
    }
}

// Prints which optional features are switched off, so a fresh setup explains itself.
function logOptionalFeatures(log = console.log) {
    if (!config.ai.writerEnabled) {
        log("[Config] AI writer disabled: set GEMINI_API_KEY (or GOOGLE_CLOUD_PROJECT for Vertex AI).");
    }
    if (!config.ai.geminiEnabled) {
        log("[Config] Search embeddings and Ask AI disabled: set GEMINI_API_KEY.");
    }
    if (!config.razorpay.enabled) {
        log("[Config] Billing disabled: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable it.");
    }
    if (!config.email.enabled) {
        log("[Config] Email notifications disabled: set EMAIL_USER and EMAIL_PASS to enable them.");
    }
}

module.exports = { config, assertRequiredConfig, logOptionalFeatures };
