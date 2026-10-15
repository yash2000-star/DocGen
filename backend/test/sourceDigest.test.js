const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildSourceDigest, codeFileScore, estimateTokens } = require("../ai/sourceDigest");

const file = (path, size = 100, type = "code") => ({ path: `/repos/acme/app/${path}`, code: "x".repeat(size), type });

test("ranks entry points and routes above helpers, and tests last", () => {
    const ranked = ["src/utils/format.js", "test/app.test.js", "src/routes/users.js", "index.js"]
        .map((p) => file(p))
        .sort((a, b) => codeFileScore(b) - codeFileScore(a))
        .map((f) => f.path.split("/app/")[1]);
    assert.deepEqual(ranked, ["index.js", "src/routes/users.js", "src/utils/format.js", "test/app.test.js"]);
});

test("puts README and package.json first and stays within the budget", () => {
    const codeFiles = Array.from({ length: 40 }, (_, i) => file(`src/module${i}.js`, 3000));
    const contextFiles = [
        { path: "/repos/acme/app/package.json", code: '{"name":"app"}', type: "package" },
        { path: "/repos/acme/app/README.md", code: "# App", type: "readme" },
    ];
    const { text, included, omitted } = buildSourceDigest({ codeFiles, contextFiles, budgetTokens: 10000 });

    assert.deepEqual(included.slice(0, 2), ["README.md", "package.json"]);
    assert.ok(estimateTokens(text) <= 10000 + 200, `digest is ${estimateTokens(text)} tokens`);
    assert.ok(omitted.length > 0, "some files are left out");
    assert.equal(included.length + omitted.length, 42, "every file is either included or listed");
    assert.match(text, /### Files not shown \(prompt size limit\)/);
    for (const name of omitted) assert.ok(text.includes(`- ${name}`));
});

test("caps each file and includes everything when it fits", () => {
    const { text, omitted } = buildSourceDigest({ codeFiles: [file("index.js", 20000)], budgetTokens: 60000, maxChars: { code: 4000 } });
    assert.equal(omitted.length, 0);
    assert.match(text, /… \(truncated\)/);
    assert.ok(text.length < 4500);
});
