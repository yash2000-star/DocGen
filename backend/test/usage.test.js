const { test } = require("node:test");
const assert = require("node:assert/strict");
const { meterClient } = require("../ai/usage");

test("adds up tokens across calls and leaves other methods working", async () => {
    const client = {
        async generateText() { return { text: "x", usage: { inputTokens: 10, outputTokens: 3 } }; },
        async listModels() { return [{ id: "m" }]; },
        async testConnection() { return { ok: true, models: await this.listModels() }; },
    };
    const { client: metered, totals } = meterClient(client);
    await metered.generateText({});
    await metered.generateText({});
    assert.deepEqual(totals, { calls: 2, inputTokens: 20, outputTokens: 6 });
    assert.deepEqual((await metered.testConnection()).models, [{ id: "m" }]);
});

test("meterClient remembers the last failed call's error", async () => {
    const boom = new Error("overloaded");
    let fail = true;
    const { client, lastError } = meterClient({ generateText: async () => { if (fail) throw boom; return { text: "ok", usage: {} }; } });
    assert.equal(lastError(), null);
    await assert.rejects(client.generateText({}), /overloaded/);
    assert.equal(lastError(), boom);
    fail = false;
    await client.generateText({});
    assert.equal(lastError(), boom);
});
