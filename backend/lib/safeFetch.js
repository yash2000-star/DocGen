// fetch() for addresses users choose (custom AI endpoints, the docs API playground), which
// only ever connects to the public internet.
//
// checkBaseUrl() rejects a URL whose host resolves to a private address, but DNS can change
// between that check and the request (DNS rebinding). Here the address is checked again at
// connection time, on the exact IP the socket connects to, so a hostname that re-resolves
// to 127.0.0.1 or 169.254.169.254 still can't reach internal services.
const dns = require("dns");
const net = require("net");
const { Agent, fetch: undiciFetch } = require("undici");
const { isPrivateAddress } = require("./urlSafety");

class BlockedAddressError extends Error {
    constructor(host) {
        super(`${host} is not a public internet address.`);
        this.name = "BlockedAddressError";
        this.code = "EBLOCKEDADDRESS";
    }
}

// net.connect-style lookup that refuses private addresses.
function publicOnlyLookup(hostname, options, callback) {
    if (typeof options === "function") [options, callback] = [{}, options];
    dns.lookup(hostname, { all: true, family: options?.family || 0 }, (error, addresses) => {
        if (error) return callback(error);
        if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
            return callback(new BlockedAddressError(hostname));
        }
        if (options?.all) return callback(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
    });
}

const publicAgent = new Agent({ connect: { lookup: publicOnlyLookup } });

function hostOf(input) {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    return url.hostname.replace(/^\[|\]$/g, "");
}

/**
 * Like fetch, but refuses to connect anywhere that isn't a public address. Redirects are
 * not followed unless the caller asks (each hop would be checked the same way).
 * Throws BlockedAddressError for private hosts (also as the cause of a fetch TypeError).
 */
async function publicOnlyFetch(input, init = {}) {
    // Literal IPs skip DNS, so check them here.
    const host = hostOf(input);
    if (net.isIP(host) && isPrivateAddress(host)) throw new BlockedAddressError(host);
    return undiciFetch(input, { redirect: "manual", ...init, dispatcher: publicAgent });
}

function isBlockedAddressError(error) {
    return error?.code === "EBLOCKEDADDRESS" || error?.cause?.code === "EBLOCKEDADDRESS";
}

module.exports = { publicOnlyFetch, publicOnlyLookup, isBlockedAddressError, BlockedAddressError };
