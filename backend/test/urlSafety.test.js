const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkBaseUrl, isPrivateAddress } = require("../lib/urlSafety");

const publicDns = async () => [{ address: "93.184.216.34" }];
const privateDns = async () => [{ address: "10.0.0.5" }];

test("classifies private and public addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"]) {
        assert.equal(isPrivateAddress(address), true, address);
    }
    for (const address of ["8.8.8.8", "93.184.216.34", "2606:4700::1111", "::ffff:8.8.8.8"]) {
        assert.equal(isPrivateAddress(address), false, address);
    }
});

test("public mode accepts https endpoints that resolve publicly", async () => {
    assert.deepEqual(await checkBaseUrl("https://api.example.com/v1/?x=1#y", { allowPrivate: false, lookup: publicDns }), { ok: true, url: "https://api.example.com/v1" });
});

test("public mode blocks private targets and plain http", async () => {
    const blocked = [
        ["https://internal.example.com/v1", privateDns],
        ["https://169.254.169.254/latest", publicDns],
        ["https://[::1]/v1", publicDns],
        ["https://[::ffff:127.0.0.1]/v1", publicDns],
        ["http://api.example.com/v1", publicDns],
    ];
    for (const [url, lookup] of blocked) {
        const result = await checkBaseUrl(url, { allowPrivate: false, lookup });
        assert.equal(result.ok, false, url);
    }
});

test("rejects credentials in the URL, other schemes and garbage", async () => {
    for (const url of ["https://user:pass@api.example.com", "ftp://api.example.com", "not a url", ""]) {
        assert.equal((await checkBaseUrl(url, { allowPrivate: true })).ok, false, url);
    }
});

test("self-hosting mode allows localhost over http", async () => {
    assert.deepEqual(await checkBaseUrl("http://localhost:11434/v1/", { allowPrivate: true }), { ok: true, url: "http://localhost:11434/v1" });
});

test("unresolvable hosts are rejected in public mode", async () => {
    const result = await checkBaseUrl("https://nope.invalid/v1", { allowPrivate: false, lookup: async () => { throw new Error("ENOTFOUND"); } });
    assert.equal(result.ok, false);
});
