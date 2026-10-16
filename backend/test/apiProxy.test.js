const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { proxyRequest, ProxyError } = require("../services/apiProxy");

const rejectsWith = (promise, status, pattern) =>
    assert.rejects(promise, (e) => e instanceof ProxyError && e.status === status && (!pattern || pattern.test(e.message)));

function server(handler) {
    const s = http.createServer(handler).listen(0);
    return { url: `http://localhost:${s.address().port}`, close: () => s.close() };
}

test("internal addresses are refused in production mode", async () => {
    const internal = server((req, res) => res.end('{"secret":true}'));
    try {
        for (const targetUrl of [`${internal.url}/`, "http://127.0.0.1:4599/", "http://169.254.169.254/latest/meta-data/", "http://[::1]:4599/", "http://10.1.2.3/"]) {
            await rejectsWith(proxyRequest({ targetUrl, targetMethod: "GET" }, { allowPrivate: false }), 403, /public APIs/);
        }
    } finally {
        internal.close();
    }
});

test("only http(s) URLs and normal methods are accepted", async () => {
    await rejectsWith(proxyRequest({ targetUrl: "file:///etc/passwd", targetMethod: "GET" }, { allowPrivate: true }), 400);
    await rejectsWith(proxyRequest({ targetUrl: "gopher://x", targetMethod: "GET" }, { allowPrivate: true }), 400);
    await rejectsWith(proxyRequest({ targetUrl: "not a url", targetMethod: "GET" }, { allowPrivate: true }), 400);
    await rejectsWith(proxyRequest({ targetUrl: "https://user:pw@api.example.com/", targetMethod: "GET" }, { allowPrivate: true }), 400);
    await rejectsWith(proxyRequest({ targetUrl: "https://api.example.com/", targetMethod: "TRACE" }, { allowPrivate: true }), 400);
});

test("forwards JSON, doesn't follow redirects, and sends no cookies or auth", async () => {
    let seenHeaders;
    const api = server((req, res) => {
        seenHeaders = req.headers;
        if (req.url === "/redirect") { res.writeHead(302, { location: "http://169.254.169.254/" }); return res.end(); }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ got: JSON.parse(body || "null") })); });
    });
    try {
        const ok = await proxyRequest({ targetUrl: `${api.url}/users`, targetMethod: "post", payload: { name: "Ada" } }, { allowPrivate: true });
        assert.deepEqual(ok, { status: 200, data: { got: { name: "Ada" } } });
        assert.equal(seenHeaders.cookie, undefined);
        assert.equal(seenHeaders.authorization, undefined);

        const redirect = await proxyRequest({ targetUrl: `${api.url}/redirect`, targetMethod: "GET" }, { allowPrivate: true });
        assert.equal(redirect.status, 302);
    } finally {
        api.close();
    }
});

test("responses over 1 MB are refused", async () => {
    const big = server((req, res) => res.end("x".repeat(1024 * 1024 + 10)));
    try {
        await rejectsWith(proxyRequest({ targetUrl: `${big.url}/`, targetMethod: "GET" }, { allowPrivate: true }), 502, /1 MB/);
    } finally {
        big.close();
    }
});
