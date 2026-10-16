// Retries an AI call when the failure is temporary (rate limit, provider outage, network).
// Used for providers whose SDK can't retry without hiding the real error.
const { LLMError } = require("./errors");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {() => Promise<T>} fn - Must throw LLMError so the code can be checked
 * @param {object} [options]
 * @param {number} [options.attempts] - Total tries including the first
 * @param {number} [options.baseDelayMs] - Doubled after each failure, with jitter
 * @returns {Promise<T>}
 * @template T
 */
async function withRetries(fn, { attempts = 3, baseDelayMs = 1000 } = {}) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const retryable = error instanceof LLMError && error.retryable;
            if (!retryable || attempt >= attempts) throw error;
            const delay = baseDelayMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5);
            await sleep(delay);
        }
    }
}

module.exports = { withRetries };
