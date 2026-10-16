// The docs "Try it" API playground (ApiPlayground component) sends requests through the
// backend to avoid browser CORS limits. Anyone can call it, so it must not become a way
// into the server's network: it only reaches public addresses (checked when connecting,
// see lib/safeFetch.js), doesn't follow redirects, forwards no credentials, and limits time
// and response size.
const { publicOnlyFetch, isBlockedAddressError } = require("../lib/safeFetch");

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

class ProxyError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Reads at most `limit` bytes of the body.
async function readLimited(response, limit) {
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) {
            await reader.cancel().catch(() => {});
            throw new ProxyError(502, "The API's response is larger than 1 MB.");
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
}

/**
 * @param {object} request - { targetUrl, targetMethod, payload } from the playground
 * @param {object} options
 * @param {boolean} options.allowPrivate - Allow localhost/private targets (local development)
 * @param {Function} [options.fetch] - Used when allowPrivate is true; defaults to global fetch
 * @returns {Promise<{ status: number, data: any }>}
 */
async function proxyRequest({ targetUrl, targetMethod, payload }, { allowPrivate, fetch: plainFetch = fetch } = {}) {
    const method = String(targetMethod || "").toUpperCase();
    if (!METHODS.has(method)) throw new ProxyError(400, "Unsupported HTTP method.");

    let url;
    try {
        url = new URL(String(targetUrl || ""));
    } catch {
        throw new ProxyError(400, "The endpoint must be a full URL, like https://api.example.com/v1/users.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new ProxyError(400, "Only http and https endpoints can be called.");
    if (url.username || url.password) throw new ProxyError(400, "Credentials in the URL aren't allowed.");

    const init = {
        method,
        headers: { "content-type": "application/json", accept: "application/json, text/plain;q=0.9, */*;q=0.1" },
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
    };
    if (payload !== undefined && payload !== null && method !== "GET" && method !== "DELETE") {
        init.body = JSON.stringify(payload);
    }

    let response;
    try {
        response = allowPrivate ? await plainFetch(url, init) : await publicOnlyFetch(url, init);
    } catch (error) {
        if (isBlockedAddressError(error)) throw new ProxyError(403, "The API playground can only call public APIs.");
        if (error.name === "TimeoutError" || error.cause?.name === "TimeoutError") throw new ProxyError(504, "The API didn't answer within 10 seconds.");
        throw new ProxyError(502, "Couldn't reach the API.");
    }

    const text = await readLimited(response, MAX_RESPONSE_BYTES);
    let data = text;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        // Not JSON: show the text.
    }
    return { status: response.status, data };
}

module.exports = { proxyRequest, ProxyError, METHODS };
