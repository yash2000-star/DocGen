// Each project has its own GitHub webhook secret. GitHub signs every push with it, and
// /api/webhook checks the signature with the secret of the project the push is for, so
// knowing one project's secret doesn't let anyone trigger (and spend AI credits on)
// another project.
//
// Secrets are stored encrypted in project_secrets (backend-only table), bound to their
// project id so a ciphertext can't be copied onto another project.
const crypto = require("crypto");
const { config } = require("../config");
const supabase = require("../lib/supabase");
const { encryptSecret, decryptSecret } = require("../lib/secretBox");

const associatedData = (projectId) => `webhook:${projectId}`;

function newSecret() {
    return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

/** The project's secret, or null if it has none yet (or it can't be decrypted). */
async function getWebhookSecret(projectId) {
    const { data, error } = await supabase
        .from("project_secrets")
        .select("webhook_secret_encrypted")
        .eq("project_id", projectId)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    try {
        return decryptSecret(data.webhook_secret_encrypted, associatedData(projectId), config.byok.masterKey);
    } catch {
        return null;
    }
}

/** Replaces the project's secret with a new one and returns it. */
async function rotateWebhookSecret(projectId) {
    const secret = newSecret();
    const { error } = await supabase.from("project_secrets").upsert({
        project_id: projectId,
        webhook_secret_encrypted: encryptSecret(secret, associatedData(projectId), config.byok.masterKey),
    });
    if (error) throw error;
    return secret;
}

/** The project's secret, creating one the first time. */
async function getOrCreateWebhookSecret(projectId) {
    return (await getWebhookSecret(projectId)) || rotateWebhookSecret(projectId);
}

/** Checks GitHub's X-Hub-Signature-256 header against the raw body, in constant time. */
function hasValidSignature(rawBody, signatureHeader, secret) {
    if (!secret) return false;
    const signature = String(signatureHeader || "");
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

module.exports = { getWebhookSecret, rotateWebhookSecret, getOrCreateWebhookSecret, hasValidSignature };
