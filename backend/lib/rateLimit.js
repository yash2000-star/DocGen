// A small in-memory rate limiter for endpoints that call out to AI providers.
// Per server process only; a shared store (Redis/Postgres) can replace it when the
// backend runs on more than one machine.

/**
 * @param {object} options
 * @param {number} options.windowMs
 * @param {number} options.max - Requests allowed per key per window
 * @param {(req) => string} options.key
 */
function createRateLimiter({ windowMs, max, key }) {
    const hits = new Map();

    return function rateLimit(req, res, next) {
        const now = Date.now();
        const id = key(req);
        const recent = (hits.get(id) || []).filter((time) => now - time < windowMs);

        if (recent.length >= max) {
            const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({
                error: { code: "too_many_requests", message: `Too many attempts. Try again in ${retryAfter} seconds.` },
            });
        }

        recent.push(now);
        hits.set(id, recent);

        // Forget idle keys so the map doesn't grow forever.
        if (hits.size > 10000) {
            for (const [k, times] of hits) if (now - times[times.length - 1] >= windowMs) hits.delete(k);
        }
        next();
    };
}

module.exports = { createRateLimiter };
