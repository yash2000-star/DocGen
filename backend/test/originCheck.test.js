const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";

const { createOriginCheck } = require("../lib/originCheck");
const { hasValidSignature } = require("../services/webhookSecrets");

function run(middleware, req) {
    let status = null;
    let nextCalled = false;
    const res = { status(code) { status = code; return this; }, json() { return this; } };
    middleware({ headers: {}, ...req }, res, () => { nextCalled = true; });
    return { status, nextCalled };
}

test("state-changing requests from other sites are refused", () => {
    const check = createOriginCheck(["https://app.docgen.dev/"]);
    assert.equal(run(check, { method: "POST", headers: { origin: "https://evil.example" } }).status, 403);
    assert.equal(run(check, { method: "DELETE", headers: { origin: "null" } }).status, 403);
    assert.ok(run(check, { method: "POST", headers: { origin: "https://APP.docgen.dev" } }).nextCalled);
    assert.ok(run(check, { method: "POST" }).nextCalled, "no Origin: not a cross-site browser request");
    assert.ok(run(check, { method: "GET", headers: { origin: "https://evil.example" } }).nextCalled, "reads are allowed");
});

test("webhook signatures are checked against the project's own secret", () => {
    const body = Buffer.from('{"ref":"refs/heads/main"}');
    const sign = (secret) => "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(hasValidSignature(body, sign("whsec_a"), "whsec_a"), true);
    assert.equal(hasValidSignature(body, sign("whsec_b"), "whsec_a"), false, "another project's secret");
    assert.equal(hasValidSignature(body, sign("whsec_a"), null), false, "project without a secret");
    assert.equal(hasValidSignature(body, "", "whsec_a"), false);
    assert.equal(hasValidSignature(body, "sha256=00", "whsec_a"), false);
});
