// Encrypts users' AI provider keys at rest with AES-256-GCM.
//
// Stored format: v1.<iv>.<auth tag>.<ciphertext>, each part base64url.
// The "associated data" (for example "<user id>:<provider>") is authenticated but not
// stored, so a ciphertext copied onto another user's row fails to decrypt.
const crypto = require("crypto");

const VERSION = "v1";
const IV_BYTES = 12;

// Accepts the master key as base64 (44 chars) or hex (64 chars); returns a 32-byte Buffer.
function parseMasterKey(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    const key = /^[0-9a-f]{64}$/i.test(trimmed) ? Buffer.from(trimmed, "hex") : Buffer.from(trimmed, "base64");
    if (key.length !== 32) {
        throw new Error("AI_KEY_ENCRYPTION_KEY must be 32 bytes, as base64 or hex. Generate one with: openssl rand -base64 32");
    }
    return key;
}

function encryptSecret(plaintext, associatedData, masterKey) {
    if (!masterKey) throw new Error("Encryption key is not configured.");
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
    cipher.setAAD(Buffer.from(associatedData, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv, tag, ciphertext].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

function decryptSecret(blob, associatedData, masterKey) {
    if (!masterKey) throw new Error("Encryption key is not configured.");
    const [version, iv, tag, ciphertext] = String(blob).split(".");
    if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
        throw new Error("Unrecognized encrypted secret format.");
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(associatedData, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    // final() throws if the ciphertext, tag or associated data were changed.
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

// The last 4 characters, shown in the UI so users can tell keys apart.
function keyHint(secret) {
    const value = String(secret || "");
    return value.length >= 8 ? value.slice(-4) : "";
}

module.exports = { parseMasterKey, encryptSecret, decryptSecret, keyHint };
