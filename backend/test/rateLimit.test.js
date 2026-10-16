const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimiter } = require("../lib/rateLimit");

function fakeRes() {
    return { statusCode: 200, headers: {}, body: null, set(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}

test("allows up to max requests per key, then returns 429", () => {
    const limit = createRateLimiter({ windowMs: 60000, max: 2, key: (req) => req.user.id });
    let passed = 0;
    for (let i = 0; i < 3; i++) {
        const res = fakeRes();
        limit({ user: { id: "a" } }, res, () => passed++);
        if (i === 2) {
            assert.equal(res.statusCode, 429);
            assert.equal(res.body.error.code, "too_many_requests");
            assert.ok(Number(res.headers["Retry-After"]) > 0);
        }
    }
    assert.equal(passed, 2);
    // Another user has their own budget.
    limit({ user: { id: "b" } }, fakeRes(), () => passed++);
    assert.equal(passed, 3);
});
