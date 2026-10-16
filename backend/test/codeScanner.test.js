const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const scanCodeFiles = require("../codeScanner");

test("the scanner never follows symlinks out of the repository", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "outside-"));
    fs.writeFileSync(path.join(outside, "secret.env"), "SUPABASE_SERVICE_ROLE_KEY=do-not-leak");
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "repo-"));
    fs.writeFileSync(path.join(repo, "index.js"), "console.log('hi')");
    fs.symlinkSync(path.join(outside, "secret.env"), path.join(repo, "config.json"));
    fs.symlinkSync(outside, path.join(repo, "linked-dir"));
    fs.writeFileSync(path.join(repo, "big.js"), "x".repeat(60000));

    const { codeFiles, contextFiles } = scanCodeFiles(repo);
    const all = [...codeFiles, ...contextFiles];
    assert.deepEqual(all.map((f) => path.basename(f.path)), ["index.js"]);
    assert.ok(!all.some((f) => f.code.includes("do-not-leak")));
});
