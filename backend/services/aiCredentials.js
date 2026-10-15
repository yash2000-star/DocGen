// Users' own AI provider keys: save (encrypted), test, list models, pick a default,
// and build a ready-to-use client for generation.
//
// This is the only module that decrypts keys. Keys are never returned to the browser;
// the API only ever sends back the last 4 characters.
const supabase = require("../lib/supabase");
const { config } = require("../config");
const { encryptSecret, decryptSecret, keyHint } = require("../lib/secretBox");
const { checkBaseUrl } = require("../lib/urlSafety");
const { getProvider } = require("../ai/providers");
const { createLLMClient, LLMError } = require("../ai");

const MAX_MODEL_NAME = 200;
const MAX_KEY_LENGTH = 1000;

class CredentialError extends Error {
    constructor(status, code, message) {
        super(message);
        this.name = "CredentialError";
        this.status = status;
        this.code = code;
    }
}

// Binds each ciphertext to its owner and provider (see secretBox.js).
const associatedData = (userId, provider) => `${userId}:${provider}`;

function assertEnabled() {
    if (!config.byok.enabled) {
        throw new CredentialError(503, "byok_disabled", "Saving AI keys isn't enabled on this server. The administrator needs to set AI_KEY_ENCRYPTION_KEY.");
    }
}

function requireProvider(provider) {
    const definition = getProvider(provider);
    if (!definition) throw new CredentialError(400, "unknown_provider", `Unknown AI provider: ${provider}`);
    return definition;
}

function toPublic(row) {
    return {
        provider: row.provider,
        hasKey: Boolean(row.encrypted_key),
        keyHint: row.key_hint || "",
        baseUrl: row.base_url || null,
        writerModel: row.writer_model,
        criticModel: row.critic_model,
        isDefault: row.is_default,
        lastTestedAt: row.last_tested_at,
        lastTestOk: row.last_test_ok,
        updatedAt: row.updated_at,
    };
}

function cleanModel(value) {
    return typeof value === "string" ? value.trim().slice(0, MAX_MODEL_NAME) : "";
}

// Endpoints users type in themselves must not redirect the server somewhere else.
const noRedirectFetch = (url, init = {}) => fetch(url, { ...init, redirect: "error" });

async function resolveBaseUrl(definition, requestedBaseUrl) {
    if (!definition.baseUrlEditable) return null;
    const value = requestedBaseUrl || definition.baseUrl;
    if (!value) {
        throw new LLMError("invalid_base_url", { provider: definition.id, providerMessage: "A base URL is required for this provider." });
    }
    const result = await checkBaseUrl(value, { allowPrivate: config.byok.allowPrivateEndpoints });
    if (!result.ok) {
        throw new LLMError("invalid_base_url", { provider: definition.id, providerMessage: result.reason });
    }
    return result.url;
}

function buildClient(definition, apiKey, baseUrl) {
    return createLLMClient({
        provider: definition.id,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        fetch: definition.baseUrlEditable ? noRedirectFetch : undefined,
    });
}

async function getRow(userId, provider) {
    const { data, error } = await supabase
        .from("ai_credentials")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", provider)
        .maybeSingle();
    if (error) throw new CredentialError(500, "storage_error", "Couldn't read saved AI keys.");
    return data;
}

function decryptRowKey(row) {
    if (!row.encrypted_key) return null;
    try {
        return decryptSecret(row.encrypted_key, associatedData(row.user_id, row.provider), config.byok.masterKey);
    } catch {
        throw new CredentialError(409, "key_unreadable", "This saved key can't be decrypted, probably because the server's encryption key changed. Enter the key again.");
    }
}

async function listCredentials(userId) {
    assertEnabled();
    const { data, error } = await supabase
        .from("ai_credentials")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
    if (error) throw new CredentialError(500, "storage_error", "Couldn't read saved AI keys.");
    return data.map(toPublic);
}

/**
 * Tests the key and models with the provider, then saves them encrypted.
 * Nothing is saved if the provider rejects the key.
 *
 * @param {string} userId
 * @param {string} provider
 * @param {object} input
 * @param {string} [input.apiKey] - Omit to keep the saved key and only change other settings
 * @param {string} [input.baseUrl]
 * @param {string} [input.writerModel]
 * @param {string} [input.criticModel]
 * @param {boolean} [input.makeDefault]
 */
async function saveCredential(userId, provider, input = {}) {
    assertEnabled();
    const definition = requireProvider(provider);
    const existing = await getRow(userId, provider);

    const newKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
    if (newKey.length > MAX_KEY_LENGTH) throw new CredentialError(400, "invalid_key_format", "That key is too long.");
    const apiKey = newKey || (existing ? decryptRowKey(existing) : null);
    if (definition.keyRequired && !apiKey) {
        throw new CredentialError(400, "missing_key", "Enter an API key for this provider.");
    }

    const baseUrl = await resolveBaseUrl(definition, input.baseUrl ?? existing?.base_url);
    const writerModel = cleanModel(input.writerModel) || existing?.writer_model || definition.defaultModels.writer;
    if (!writerModel) throw new CredentialError(400, "missing_model", "Choose a writer model.");
    // The critic reviews drafts; without a separate choice it uses the writer model.
    const criticModel = cleanModel(input.criticModel) || existing?.critic_model || definition.defaultModels.critic || writerModel;

    // Throws LLMError (invalid key, unreachable endpoint, ...) before anything is saved.
    const test = await buildClient(definition, apiKey, baseUrl).testConnection({ models: [writerModel, criticModel] });

    const row = {
        user_id: userId,
        provider,
        encrypted_key: apiKey ? encryptSecret(apiKey, associatedData(userId, provider), config.byok.masterKey) : null,
        key_hint: keyHint(apiKey),
        base_url: baseUrl,
        writer_model: writerModel,
        critic_model: criticModel,
        last_tested_at: new Date().toISOString(),
        last_test_ok: test.unavailableModels.length === 0,
    };

    const { error } = await supabase.from("ai_credentials").upsert(row, { onConflict: "user_id,provider" });
    if (error) throw new CredentialError(500, "storage_error", "Couldn't save the AI key.");

    // The first provider a user connects becomes their default automatically.
    const { count } = await supabase
        .from("ai_credentials")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_default", true);
    if (input.makeDefault || !count) await setDefault(userId, provider);

    return {
        credential: toPublic(await getRow(userId, provider)),
        unavailableModels: test.unavailableModels,
    };
}

// Re-tests a saved key, records the result, and returns it.
async function testCredential(userId, provider) {
    assertEnabled();
    const definition = requireProvider(provider);
    const row = await getRow(userId, provider);
    if (!row) throw new CredentialError(404, "not_found", "This provider isn't connected.");

    const record = (ok) => supabase
        .from("ai_credentials")
        .update({ last_tested_at: new Date().toISOString(), last_test_ok: ok })
        .eq("id", row.id);

    try {
        const client = buildClient(definition, decryptRowKey(row), row.base_url);
        const result = await client.testConnection({ models: [row.writer_model, row.critic_model] });
        await record(result.unavailableModels.length === 0);
        return result;
    } catch (error) {
        if (error instanceof LLMError) await record(false);
        throw error;
    }
}

async function listModels(userId, provider) {
    assertEnabled();
    const definition = requireProvider(provider);
    const row = await getRow(userId, provider);
    if (!row) throw new CredentialError(404, "not_found", "This provider isn't connected.");
    const models = await buildClient(definition, decryptRowKey(row), row.base_url).listModels();
    return models.sort((a, b) => a.id.localeCompare(b.id));
}

async function setDefault(userId, provider) {
    assertEnabled();
    requireProvider(provider);
    const { data, error } = await supabase.rpc("set_default_ai_credential", { p_user_id: userId, p_provider: provider });
    if (error) throw new CredentialError(500, "storage_error", "Couldn't change the default provider.");
    if (!data) throw new CredentialError(404, "not_found", "This provider isn't connected.");
}

async function deleteCredential(userId, provider) {
    assertEnabled();
    requireProvider(provider);
    const { data: deleted, error } = await supabase
        .from("ai_credentials")
        .delete()
        .eq("user_id", userId)
        .eq("provider", provider)
        .select("is_default");
    if (error) throw new CredentialError(500, "storage_error", "Couldn't remove the AI key.");
    if (!deleted || deleted.length === 0) throw new CredentialError(404, "not_found", "This provider isn't connected.");

    // Keep a default if the user still has other providers.
    if (deleted[0].is_default) {
        const { data: next } = await supabase
            .from("ai_credentials")
            .select("provider")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (next) await setDefault(userId, next.provider);
    }
}

/**
 * A ready-to-use client for one of the user's providers (their default if none is named).
 * Used by the generation pipeline.
 *
 * @returns {Promise<{ client: object, provider: string, writerModel: string, criticModel: string }>}
 */
async function getUserLLM(userId, provider) {
    assertEnabled();
    let query = supabase.from("ai_credentials").select("*").eq("user_id", userId);
    query = provider ? query.eq("provider", provider) : query.eq("is_default", true);
    const { data: row, error } = await query.maybeSingle();
    if (error) throw new CredentialError(500, "storage_error", "Couldn't read saved AI keys.");
    if (!row) throw new LLMError("not_configured", { provider });

    const definition = requireProvider(row.provider);
    return {
        client: buildClient(definition, decryptRowKey(row), row.base_url),
        provider: row.provider,
        writerModel: row.writer_model,
        criticModel: row.critic_model,
        promptBudgetTokens: config.promptBudgetTokens,
    };
}

/**
 * The server's own AI credential, used only for the anonymous free preview.
 * Returns null when the administrator hasn't set one up (the preview is then off).
 */
function getPreviewLLM() {
    if (!config.preview.enabled) return null;
    const definition = getProvider(config.preview.provider);
    if (!definition) {
        console.error(`[Preview] Unknown PREVIEW_AI_PROVIDER "${config.preview.provider}". The free preview is off.`);
        return null;
    }
    const writerModel = config.preview.writerModel || definition.defaultModels.writer;
    if (!writerModel) {
        console.error(`[Preview] Set PREVIEW_AI_WRITER_MODEL for ${definition.label}. The free preview is off.`);
        return null;
    }
    try {
        return {
            // The administrator chose this endpoint, so it isn't held to the user-endpoint rules.
            client: createLLMClient({
                provider: definition.id,
                apiKey: config.preview.apiKey || undefined,
                baseUrl: config.preview.baseUrl || undefined,
            }),
            provider: definition.id,
            writerModel,
            criticModel: config.preview.criticModel || definition.defaultModels.critic || writerModel,
            promptBudgetTokens: config.promptBudgetTokens,
        };
    } catch (error) {
        console.error(`[Preview] Can't use the preview AI credential: ${error.providerMessage || error.message}`);
        return null;
    }
}

module.exports = {
    CredentialError,
    listCredentials,
    saveCredential,
    testCredential,
    listModels,
    setDefault,
    deleteCredential,
    getUserLLM,
    getPreviewLLM,
};
