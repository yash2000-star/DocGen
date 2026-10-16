const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { collectRepoFacts, checkPage, factCheckPage, createQualityReport, unlinkBroken } = require("../quality/factCheck");

function fixtureRepo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "facts-"));
    const files = {
        "package.json": JSON.stringify({ name: "todo-app", scripts: { dev: "vite", build: "vite build", "db:seed": "node seed.js" }, dependencies: { express: "^5" }, devDependencies: { vite: "^7" } }),
        "src/server.js": "const port = process.env.PORT_NUMBER || 3000;\nconst key = process.env.WEATHER_API_KEY;",
        ".env.example": "WEATHER_API_KEY=\n",
        "requirements.txt": "Flask==3.0\nrequests>=2\n",
        "README.md": "# Todo",
    };
    for (const [name, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), body);
    }
    const scanned = Object.entries(files).map(([name, code]) => ({ path: path.join(dir, name), code }));
    return { dir, facts: collectRepoFacts(dir, { codeFiles: scanned, contextFiles: [] }) };
}

const slugs = new Set(["introduction", "quickstart", "api-reference"]);

test("real references pass", () => {
    const { facts } = fixtureRepo();
    const page = `---
title: "Quickstart"
---
Edit \`src/server.js\` and set \`WEATHER_API_KEY\` in \`.env\` (copy \`.env.example\`). Uses Node.js and \`res.json\`.

\`\`\`bash
npm install
npm install express
npm run dev
yarn build
pnpm db:seed
pip install -r requirements.txt
pip install flask requests==2.31
npm install -g vercel
\`\`\`

See the [Quickstart](/quickstart), [the reference](/api-reference#auth), [GitHub](https://github.com).
<Card title="Intro" href="/introduction">x</Card>`;
    assert.deepEqual(checkPage(page, facts, slugs), []);
});

test("invented files, env vars, scripts, packages and links are found", () => {
    const { facts } = fixtureRepo();
    const page = `---
title: "Setup"
---
Open \`config/database.yml\` and set \`DATABASE_URL\`.

\`\`\`bash
export REDIS_HOST=localhost
npm run migrate
npm install express-validator
pip install django
\`\`\`

\`\`\`javascript
const secret = process.env.JWT_SECRET;
\`\`\`

Read [Deployment](/deployment) and <Card title="x" href="/setup">y</Card>.`;
    const found = checkPage(page, facts, slugs).map((i) => `${i.kind}:${i.value}`).sort();
    assert.deepEqual(found, [
        "env:DATABASE_URL", "env:JWT_SECRET", "env:REDIS_HOST",
        "file:config/database.yml",
        "link:/deployment", "link:/setup",
        "package:django", "package:express-validator",
        "script:npm run migrate",
    ]);
});

test("the critic fixes the page once; remaining broken links become plain text", async () => {
    const { facts } = fixtureRepo();
    const page = `---\ntitle: "Setup"\n---\nSet \`DATABASE_URL\`. Read [Deployment](/deployment).\n`;
    const prompts = [];
    const llm = {
        criticModel: "critic",
        client: {
            generateText: async ({ prompt }) => {
                prompts.push(prompt);
                // Fixes the env var but keeps the bad link.
                return { text: `---\ntitle: "Setup"\n---\nSet \`WEATHER_API_KEY\`. Read [Deployment](/deployment).\n` };
            },
        },
    };
    const result = await factCheckPage(page, { facts, slugs, llm, relevantSource: "SOURCE", label: "Setup" });
    assert.equal(prompts.length, 1);
    assert.match(prompts[0], /environment variable `DATABASE_URL`/);
    assert.match(prompts[0], /- \/quickstart/);
    assert.match(prompts[0], /SOURCE/);
    assert.equal(result.found.length, 2);
    assert.deepEqual(result.remaining, []);
    assert.match(result.mdx, /Read Deployment\./);
    assert.match(result.mdx, /WEATHER_API_KEY/);

    const { report, add } = createQualityReport();
    add("setup", result);
    assert.deepEqual(report, { pagesChecked: 1, issuesFound: 2, issuesFixed: 2, remaining: [] });
});

test("a clean page costs no AI call", async () => {
    const { facts } = fixtureRepo();
    let calls = 0;
    const llm = { criticModel: "c", client: { generateText: async () => { calls++; return { text: "" }; } } };
    const result = await factCheckPage("---\ntitle: x\n---\nSee [Quickstart](/quickstart).", { facts, slugs, llm });
    assert.equal(calls, 0);
    assert.equal(result.found.length, 0);
});

test("unlinkBroken keeps the text and drops Card hrefs", () => {
    assert.equal(unlinkBroken('A [b](/x) c <Card title="t" href="/x">d</Card> ![img](/x)', ["/x"]), 'A b c <Card title="t">d</Card> ![img](/x)');
});
