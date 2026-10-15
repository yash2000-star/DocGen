// Counts the tokens an AI client uses across a run (for example one doc generation).

/**
 * Wraps a client from createLLMClient so every generateText call adds to the totals.
 * @returns {{ client: object, totals: { calls: number, inputTokens: number, outputTokens: number } }}
 */
function meterClient(client) {
    const totals = { calls: 0, inputTokens: 0, outputTokens: 0 };
    const metered = Object.create(client);
    metered.generateText = async (args) => {
        const result = await client.generateText(args);
        totals.calls += 1;
        totals.inputTokens += result.usage?.inputTokens || 0;
        totals.outputTokens += result.usage?.outputTokens || 0;
        return result;
    };
    return { client: metered, totals };
}

module.exports = { meterClient };
