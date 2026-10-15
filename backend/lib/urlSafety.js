// Checks user-supplied base URLs before the server sends requests to them.
// Known gap: DNS is checked here, not at connection time, so a hostname that changes its
// DNS answer between the check and the request (DNS rebinding) isn't caught yet.
// Without this, "Ollama" or "OpenAI-compatible" endpoints could be pointed at internal
// services (cloud metadata, databases) and the server would call them on the user's behalf.
const dns = require("dns").promises;
const net = require("net");

// IPv4/IPv6 ranges that aren't on the public internet.
const blockList = new net.BlockList();
for (const [address, prefix] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
    ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
]) blockList.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
    ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
]) blockList.addSubnet(address, prefix, "ipv6");
// Not listed: ::ffff:0:0/96 (IPv4-mapped). Node's BlockList matches every IPv4 address
// against that rule, so mapped addresses are unwrapped below instead.

function isPrivateAddress(address) {
    const value = String(address);
    const dotted = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (dotted) return blockList.check(dotted[1], "ipv4");
    // URL parsing rewrites [::ffff:127.0.0.1] as [::ffff:7f00:1].
    const hex = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hex) {
        const [high, low] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
        return blockList.check(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`, "ipv4");
    }
    const family = net.isIPv6(address) ? "ipv6" : "ipv4";
    return blockList.check(address, family);
}

/**
 * Validates a base URL for an AI endpoint.
 *
 * @param {string} value
 * @param {object} options
 * @param {boolean} options.allowPrivate - Allow http, localhost and private addresses (self-hosting)
 * @param {(host: string) => Promise<{address: string}[]>} [options.lookup] - DNS lookup, injectable for tests
 * @returns {Promise<{ ok: true, url: string } | { ok: false, reason: string }>}
 */
async function checkBaseUrl(value, { allowPrivate, lookup = (host) => dns.lookup(host, { all: true }) }) {
    let url;
    try {
        url = new URL(String(value || "").trim());
    } catch {
        return { ok: false, reason: "Enter a full URL, like https://example.com/v1." };
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { ok: false, reason: "Only http and https URLs are supported." };
    }
    if (url.username || url.password) {
        return { ok: false, reason: "Put the API key in the key field, not in the URL." };
    }

    // Normalize: no trailing slash, no query or fragment.
    url.hash = "";
    url.search = "";
    const normalized = url.toString().replace(/\/+$/, "");

    if (allowPrivate) return { ok: true, url: normalized };

    if (url.protocol !== "https:") {
        return { ok: false, reason: "Use an https URL." };
    }

    const host = url.hostname.replace(/^\[|\]$/g, "");
    let addresses;
    if (net.isIP(host)) {
        addresses = [host];
    } else {
        try {
            addresses = (await lookup(host)).map((entry) => entry.address);
        } catch {
            return { ok: false, reason: `Couldn't resolve ${host}.` };
        }
    }

    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        return { ok: false, reason: "This server only connects to public AI endpoints." };
    }

    return { ok: true, url: normalized };
}

module.exports = { checkBaseUrl, isPrivateAddress };
