// Counts the tokens an AI client uses across a run (for example one doc generation).

/**
 * Wraps a client from createLLMClient so every generateText call adds to the totals.
 * lastError() returns the most recent failed call's error, so a run whose pages all
 * failed can report the provider's reason instead of a generic one.
 * @returns {{ client: object, totals: { calls: number, inputTokens: number, outputTokens: number }, lastError: () => Error|null }}
 */
function meterClient(client) {
    const totals = { calls: 0, inputTokens: 0, outputTokens: 0 };
    let lastError = null;
    const metered = Object.create(client);
    metered.generateText = async (args) => {
        let result;
        try {
            result = await client.generateText(args);
        } catch (error) {
            lastError = error;
            throw error;
        }
        totals.calls += 1;
        totals.inputTokens += result.usage?.inputTokens || 0;
        totals.outputTokens += result.usage?.outputTokens || 0;
        return result;
    };
    return { client: metered, totals, lastError: () => lastError };
}

module.exports = { meterClient };
