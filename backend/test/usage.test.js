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
