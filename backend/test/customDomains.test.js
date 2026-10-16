const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

// A tiny stand-in for the Supabase query builder: one projects table in memory.
const rows = [{ id: "p1", tenant_name: "acme", project_name: "docs", custom_domain: "docs.acme.dev", custom_domain_token: "abc123", custom_domain_verified_at: null }];
function query(table) {
    const filters = [];
    let update = null;
    const api = {
        select() { return api; },
        update(values) { update = values; return api; },
        eq(col, val) { filters.push((r) => r[col] === val); return api; },
        neq(col, val) { filters.push((r) => r[col] !== val); return api; },
        ilike(col, val) { filters.push((r) => String(r[col] || "").toLowerCase() === val.toLowerCase()); return api; },
        not(col, op, val) { filters.push((r) => r[col] !== null && r[col] !== undefined); return api; },
        limit() { return api; },
        run() {
            const matched = rows.filter((r) => filters.every((f) => f(r)));
            if (update) matched.forEach((r) => Object.assign(r, update));
            return matched;
        },
        maybeSingle() { return Promise.resolve({ data: api.run()[0] || null, error: null }); },
        single() { const m = api.run(); return Promise.resolve({ data: m[0], error: null }); },
        then(resolve) { resolve({ data: api.run(), error: null }); },
    };
    assert.equal(table, "projects");
    return api;
}
require.cache[path.join(__dirname, "../lib/supabase.js")] = { exports: { from: query } };
const { verifyDomain, findVerifiedDomain, DomainError, clearCache } = require("../services/customDomains");

test("a domain is verified only when its TXT record has the project's token", async () => {
    clearCache();
    assert.equal(await findVerifiedDomain("docs.acme.dev"), null);

    await assert.rejects(verifyDomain("p1", { resolveTxt: async () => [["docgen-verify=wrong"]] }), (e) => e instanceof DomainError && e.status === 422);
    await assert.rejects(verifyDomain("p1", { resolveTxt: async () => { throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }); } }), (e) => e.status === 422);
    assert.equal(rows[0].custom_domain_verified_at, null);

    let askedFor;
    const status = await verifyDomain("p1", { resolveTxt: async (name) => { askedFor = name; return [["v=spf1 -all"], ["docgen-verify=", "abc123"]]; } });
    assert.equal(askedFor, "_docgen-verify.docs.acme.dev");
    assert.equal(status.verified, true, "TXT strings split in chunks are joined");
    assert.ok(rows[0].custom_domain_verified_at);
    assert.deepEqual(await findVerifiedDomain("DOCS.acme.dev"), { tenant: "acme", project: "docs" }, "verifying clears the cache");
});
