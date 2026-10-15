const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { parseMasterKey, encryptSecret, decryptSecret, keyHint } = require("../lib/secretBox");

const key = crypto.randomBytes(32);

test("round-trips a secret", () => {
    const blob = encryptSecret("sk-ant-secret-value", "user-1:anthropic", key);
    assert.match(blob, /^v1\./);
    assert.ok(!blob.includes("secret-value"));
    assert.equal(decryptSecret(blob, "user-1:anthropic", key), "sk-ant-secret-value");
});

test("uses a fresh IV every time", () => {
    assert.notEqual(encryptSecret("same", "a", key), encryptSecret("same", "a", key));
});

test("refuses a ciphertext moved to another user or provider", () => {
    const blob = encryptSecret("sk-secret", "user-1:openai", key);
    assert.throws(() => decryptSecret(blob, "user-2:openai", key));
    assert.throws(() => decryptSecret(blob, "user-1:anthropic", key));
});

test("detects tampering", () => {
    const parts = encryptSecret("sk-secret", "a", key).split(".");
    const ciphertext = Buffer.from(parts[3], "base64url");
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString("base64url");
    assert.throws(() => decryptSecret(parts.join("."), "a", key));
});

test("fails with the wrong master key", () => {
    const blob = encryptSecret("sk-secret", "a", key);
    assert.throws(() => decryptSecret(blob, "a", crypto.randomBytes(32)));
});

test("parses base64 and hex master keys and rejects bad lengths", () => {
    const raw = crypto.randomBytes(32);
    assert.deepEqual(parseMasterKey(raw.toString("base64")), raw);
    assert.deepEqual(parseMasterKey(raw.toString("hex")), raw);
    assert.equal(parseMasterKey(undefined), null);
    assert.throws(() => parseMasterKey("too-short"), /32 bytes/);
});

test("key hint shows only the last 4 characters of long keys", () => {
    assert.equal(keyHint("sk-ant-abcdefgh1234"), "1234");
    assert.equal(keyHint("short"), "");
    assert.equal(keyHint(null), "");
});
