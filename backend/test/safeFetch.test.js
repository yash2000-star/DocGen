const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { publicOnlyFetch, publicOnlyLookup, isBlockedAddressError } = require("../lib/safeFetch");
const { createOpenAIAdapter } = require("../ai/adapters/openai");

test("refuses literal private IPs before connecting", async () => {
    for (const url of ["http://127.0.0.1:4599/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://10.0.0.5/", "http://[::ffff:127.0.0.1]/"]) {
        await assert.rejects(publicOnlyFetch(url), (e) => isBlockedAddressError(e), url);
    }
});

test("refuses hostnames that resolve to private addresses, at connection time", async () => {
    // localhost resolves to 127.0.0.1: the check happens in the socket's DNS lookup.
    const server = http.createServer((req, res) => res.end("internal")).listen(0);
    const { port } = server.address();
    try {
        await assert.rejects(publicOnlyFetch(`http://localhost:${port}/`), (e) => isBlockedAddressError(e));
    } finally {
        server.close();
    }
});

test("the lookup passes public addresses through", (t, done) => {
    // Stub dns by looking up a literal public address (dns.lookup returns it as is).
    publicOnlyLookup("93.184.215.14", { all: true }, (error, addresses) => {
        assert.equal(error, null);
        assert.equal(addresses[0].address, "93.184.215.14");
        done();
    });
});

test("an AI endpoint blocked at connection time is reported as an invalid base URL", async () => {
    const client = createOpenAIAdapter({ provider: "custom", baseUrl: "http://localhost:4599/v1", apiKey: "k", fetch: publicOnlyFetch, maxRetries: 0 });
    await assert.rejects(
        client.generateText({ model: "m", messages: [{ role: "user", content: "hi" }] }),
        (e) => e.code === "invalid_base_url" && /public AI endpoints/.test(e.providerMessage)
    );
});
