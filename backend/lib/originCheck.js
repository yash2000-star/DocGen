// Cross-site request protection for the dashboard API.
//
// Signed-in requests authenticate with an "Authorization: Bearer <token>" header, which
// browsers never attach on their own, so a hostile page can't make a signed-in request on
// a user's behalf (the classic CSRF attack needs ambient cookies). As a second layer,
// state-changing requests that come from a browser must come from the dashboard's origin.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * @param {string[]} allowedOrigins - e.g. ["https://app.example.com"]
 */
function createOriginCheck(allowedOrigins) {
    const allowed = new Set(allowedOrigins.map((origin) => origin.replace(/\/+$/, "").toLowerCase()));
    return function originCheck(req, res, next) {
        if (SAFE_METHODS.has(req.method)) return next();
        const origin = req.headers.origin;
        // No Origin header: not a browser request from another site (servers, CLIs, tests).
        if (!origin || allowed.has(String(origin).toLowerCase())) return next();
        return res.status(403).json({ error: "Requests to this API must come from the DocGen dashboard." });
    };
}

module.exports = { createOriginCheck };
