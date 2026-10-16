// Checks generated pages against the repository they document.
//
// Models sometimes invent things that look plausible: a config file that doesn't exist, an
// environment variable the code never reads, an `npm run migrate` script, a package that
// isn't a dependency, or a link to a page that wasn't written. These are cheap to detect
// without AI, so each page is checked; a page with problems goes back to the critic model
// once with the exact list, and anything still wrong is reported on the run.
const fs = require("fs");
const path = require("path");
const { parseFrontmatter } = require("../../lib/frontmatter");
const { ensureValidMdx } = require("../mdx/repair");
const { stripCodeFence } = require("../ai/text");
const { isFatalLLMError } = require("../ai/errors");

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "__pycache__", ".venv", "vendor"]);
const MAX_FILES = 20000;

// Extensions that make a backticked word a file path ("config.js", "src/app.py").
const FILE_EXTENSIONS = new Set([
    "js", "mjs", "cjs", "ts", "jsx", "tsx", "py", "go", "rb", "java", "php", "rs", "swift", "kt", "cs", "c", "h", "cpp",
    "json", "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "md", "mdx", "txt", "html", "css", "scss", "sh", "sql", "lock", "xml", "gradle",
]);
// Files that are normal to mention even though they aren't committed.
const ALWAYS_OK_FILES = new Set([".env", ".env.local", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "node_modules"]);
// Environment variables every platform has.
const ALWAYS_OK_ENV = new Set(["NODE_ENV", "PATH", "HOME", "PYTHONPATH", "GOPATH", "JAVA_HOME", "NODE_OPTIONS", "CI"]);
// Package-manager commands that aren't scripts.
const PM_BUILTINS = new Set(["add", "install", "i", "remove", "rm", "uninstall", "init", "create", "dlx", "exec", "x", "why", "upgrade", "up", "update",
    "global", "config", "cache", "info", "link", "unlink", "publish", "pack", "login", "logout", "outdated", "audit", "ci", "run", "test", "start", "version", "help", "list", "ls"]);
const SHELL_LANGS = new Set(["bash", "sh", "shell", "zsh", "console", "terminal", "powershell", "ps1", "cmd", "env", "dotenv", "ini", "text", "txt", ""]);

const normalizePyName = (name) => name.toLowerCase().replace(/[-_.]+/g, "-");

/**
 * What the repository actually contains, for checking pages against.
 * @param {string} repoDir - The cloned repository
 * @param {{ codeFiles: object[], contextFiles: object[] }} scanned - From codeScanner
 */
function collectRepoFacts(repoDir, { codeFiles = [], contextFiles = [] } = {}) {
    const files = [];
    (function walk(dir, prefix) {
        if (files.length >= MAX_FILES) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (entry.isSymbolicLink()) continue;
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                if (!IGNORED_DIRS.has(entry.name)) walk(path.join(dir, entry.name), rel);
            } else if (files.length < MAX_FILES) {
                files.push(rel);
            }
        }
    })(repoDir, "");

    const scanned = [...codeFiles, ...contextFiles];
    const envTokens = new Set();
    for (const file of scanned) {
        for (const match of String(file.code).matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)) envTokens.add(match[0]);
    }

    const scripts = new Set();
    const packages = new Set();
    const ownNames = new Set();
    let hasPackageJson = false;
    for (const file of scanned) {
        const base = path.basename(file.path);
        if (base === "package.json") {
            hasPackageJson = true;
            try {
                const pkg = JSON.parse(file.code);
                if (pkg.name) ownNames.add(pkg.name);
                for (const name of Object.keys(pkg.scripts || {})) scripts.add(name);
                for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
                    for (const name of Object.keys(pkg[field] || {})) packages.add(name);
                }
            } catch {
                // Not valid JSON: nothing to learn from it.
            }
        } else if (/^requirements.*\.txt$/i.test(base)) {
            for (const line of String(file.code).split("\n")) {
                const name = line.trim().split(/[<>=!~;\[\s]/)[0];
                if (name && !name.startsWith("#") && !name.startsWith("-")) packages.add(normalizePyName(name));
            }
        } else if (base === "pyproject.toml" || base === "setup.py") {
            for (const match of String(file.code).matchAll(/["']([A-Za-z0-9][A-Za-z0-9_.-]*)\s*(?:[<>=!~;\[][^"']*)?["']/g)) packages.add(normalizePyName(match[1]));
            const name = String(file.code).match(/name\s*=\s*["']([^"']+)["']/);
            if (name) ownNames.add(normalizePyName(name[1]));
        }
    }

    return { files, envTokens, scripts, packages, ownNames, hasPackageJson };
}

// Code blocks, then the prose with code blocks removed.
function splitCode(body) {
    const blocks = [];
    const prose = body.replace(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm, (_, fence, info, code) => {
        blocks.push({ lang: info.trim().split(/\s+/)[0].toLowerCase(), code });
        return "\n";
    });
    return { blocks, prose };
}

// Words that look like file names but aren't: product names and common calls.
const NOT_FILES = new Set(["node.js", "next.js", "vue.js", "nuxt.js", "express.js", "react.js", "three.js", "d3.js", "chart.js", "ember.js",
    "alpine.js", "solid.js", "svelte.js", "deno.js", "bun.js", "res.json", "req.json", "response.json", "request.json", "ctx.json", "express.json"]);

function looksLikeFilePath(value) {
    const v = value.replace(/^\.\//, "");
    if (!/^[\w@.-]+(?:\/[\w@.-]+)*$/.test(v) || /^v?\d+(\.\d+)+$/.test(v) || NOT_FILES.has(v.toLowerCase())) return false;
    const base = path.basename(v);
    if (/^\.[\w-]/.test(base)) return true; // dotfiles: .env.example, .eslintrc
    const ext = base.includes(".") ? base.split(".").pop().toLowerCase() : "";
    return FILE_EXTENSIONS.has(ext);
}

function fileExists(facts, value) {
    const v = value.replace(/^\.\//, "").replace(/\/+$/, "");
    if (ALWAYS_OK_FILES.has(v)) return true;
    if (v === ".env" || v.startsWith(".env.")) return facts.files.some((f) => path.basename(f).startsWith(".env"));
    return facts.files.some((f) => f === v || f.endsWith(`/${v}`));
}

function slugFromHref(href) {
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("//") || href.startsWith("/docs/")) return null;
    const pathPart = href.split("#")[0].split("?")[0];
    // Relative links to files in the repo (README.md, ./src) aren't page links.
    if (!pathPart.startsWith("/") && /\.\w+$/.test(pathPart) && !/\.mdx?$/i.test(pathPart)) return null;
    return pathPart.replace(/^\.?\/+/, "").replace(/\.mdx?$/i, "").replace(/\/+$/, "") || null;
}

/**
 * @param {string} mdx
 * @param {object} facts - collectRepoFacts()
 * @param {Set<string>} slugs - Pages that exist on the site
 * @returns {{ kind: "file"|"env"|"script"|"package"|"link", value: string }[]}
 */
function checkPage(mdx, facts, slugs) {
    const { content } = parseFrontmatter(mdx);
    const { blocks, prose } = splitCode(content);
    const issues = new Map();
    const add = (kind, value) => issues.set(`${kind}:${value}`, { kind, value });

    // Inline code in the prose.
    for (const match of prose.matchAll(/`([^`\n]+)`/g)) {
        const token = match[1].trim();
        if (looksLikeFilePath(token) && !fileExists(facts, token)) add("file", token.replace(/^\.\//, ""));
        if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(token) && !facts.envTokens.has(token) && !ALWAYS_OK_ENV.has(token)) add("env", token);
    }

    for (const { lang, code } of blocks) {
        // Environment variables read in code or set in shell/.env blocks.
        const envNames = [
            ...[...code.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]),
            ...[...code.matchAll(/os\.(?:environ\[|environ\.get\(|getenv\()\s*["']([A-Z][A-Z0-9_]+)["']/g)].map((m) => m[1]),
        ];
        if (SHELL_LANGS.has(lang)) {
            envNames.push(...[...code.matchAll(/^\s*(?:export\s+|set\s+)?([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\s*=/gm)].map((m) => m[1]));
        }
        for (const name of envNames) {
            if (!facts.envTokens.has(name) && !ALWAYS_OK_ENV.has(name)) add("env", name);
        }

        if (!SHELL_LANGS.has(lang)) continue;
        for (const line of code.split("\n")) {
            const cmd = line.replace(/^\s*[$>]\s*/, "").trim();

            const run = cmd.match(/^(npm|pnpm|yarn|bun)\s+run\s+([\w:.-]+)/) || cmd.match(/^(yarn|pnpm|bun)\s+([\w:.-]+)(?:\s|$)/);
            if (run && !PM_BUILTINS.has(run[2]) && !facts.scripts.has(run[2])) add("script", `${run[1]} run ${run[2]}`.replace(/^(yarn|pnpm|bun) run /, "$1 "));

            const npmInstall = cmd.match(/^(?:npm|pnpm|yarn|bun)\s+(?:install|i|add)\s+(.+)/);
            if (npmInstall && !/(^|\s)(-g|--global)(\s|$)/.test(npmInstall[1])) {
                for (const arg of npmInstall[1].split(/\s+/)) {
                    if (!arg || arg.startsWith("-") || /[&|;]/.test(arg)) continue;
                    const name = arg.startsWith("@") ? arg.split("@").slice(0, 2).join("@") : arg.split("@")[0];
                    if (name && !facts.packages.has(name) && !facts.ownNames.has(name)) add("package", name);
                }
            }

            const pip = cmd.match(/^(?:python3?\s+-m\s+)?pip3?\s+install\s+(.+)/);
            if (pip) {
                const args = pip[1].split(/\s+/);
                for (let i = 0; i < args.length; i++) {
                    const arg = args[i];
                    if (!arg || /[&|;]/.test(arg) || arg === "." ) continue;
                    if (arg === "-r" || arg === "-e" || arg === "--requirement") { i++; continue; }
                    if (arg.startsWith("-")) continue;
                    const name = normalizePyName(arg.split(/[<>=!~\[]/)[0]);
                    if (name && !facts.packages.has(name) && !facts.ownNames.has(name)) add("package", name);
                }
            }
        }
    }

    // Links to pages: markdown [text](href) (not images) and href="..." props.
    const hrefs = [
        ...[...prose.matchAll(/(?<!!)\[[^\]\n]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]),
        ...[...prose.matchAll(/\bhref\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]),
    ];
    for (const href of hrefs) {
        const slug = slugFromHref(href);
        if (slug && !slugs.has(slug)) add("link", href);
    }

    return [...issues.values()];
}

function describeIssue({ kind, value }) {
    switch (kind) {
        case "file": return `the file \`${value}\` (no such file in the repository)`;
        case "env": return `the environment variable \`${value}\` (the code never uses it)`;
        case "script": return `the command \`${value}\` (no such script in package.json)`;
        case "package": return `the package \`${value}\` (not a dependency of the project)`;
        case "link": return `a link to \`${value}\` (no such page on the site)`;
        default: return value;
    }
}

function fixPrompt(mdx, issues, { relevantSource, slugs }) {
    return `This MDX documentation page mentions things that don't exist in the project it documents. Correct the page.

For each item below, remove the claim or replace it with what the source code actually shows. Don't add anything the source doesn't support. Keep everything else unchanged: the frontmatter, the structure, the components and the wording of correct parts.

## Not in the project
${issues.map((issue) => `- ${describeIssue(issue)}`).join("\n")}

## Pages that exist on the site (link only to these, as /slug)
${[...slugs].map((slug) => `- /${slug}`).join("\n")}

## Source code
${relevantSource || "(not available)"}

## The page
${mdx}

Output ONLY the corrected MDX, starting with the --- frontmatter. No explanation, no code fences around it.`;
}

// Turns links to pages that don't exist into plain text, keeping the link text.
function unlinkBroken(mdx, brokenHrefs) {
    let out = mdx;
    for (const href of brokenHrefs) {
        const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`(?<!!)\\[([^\\]\\n]*)\\]\\(\\s*${escaped}(?:\\s+"[^"]*")?\\s*\\)`, "g"), "$1");
        out = out.replace(new RegExp(`\\s+href\\s*=\\s*["']${escaped}["']`, "g"), "");
    }
    return out;
}

/**
 * Checks a page and, if needed, has the critic model fix it once.
 * @returns {Promise<{ mdx: string, found: object[], remaining: object[] }>}
 */
async function factCheckPage(mdx, { facts, slugs, llm, relevantSource, label = "page" }) {
    const found = checkPage(mdx, facts, slugs);
    if (found.length === 0) return { mdx, found, remaining: [] };

    console.log(`[FactCheck] "${label}": ${found.length} reference(s) not in the repository. Asking the critic to fix them.`);
    let current = mdx;
    try {
        const result = await llm.client.generateText({ model: llm.criticModel, prompt: fixPrompt(mdx, found, { relevantSource, slugs }) });
        const candidate = stripCodeFence(String(result.text || "")).trim();
        if (candidate && !result.truncated) {
            const checked = await ensureValidMdx(candidate, llm, label);
            if (checked) current = checked.mdx;
        }
    } catch (error) {
        if (isFatalLLMError(error)) throw error;
        console.error(`[FactCheck] Fix pass failed for "${label}":`, error.message);
    }

    let remaining = checkPage(current, facts, slugs);
    // Links that still point nowhere become plain text rather than dead links.
    const broken = remaining.filter((issue) => issue.kind === "link").map((issue) => issue.value);
    if (broken.length) {
        current = unlinkBroken(current, broken);
        remaining = remaining.filter((issue) => issue.kind !== "link");
    }
    return { mdx: current, found, remaining };
}

/** Collects per-page results into the run's quality report. */
function createQualityReport() {
    const report = { pagesChecked: 0, issuesFound: 0, issuesFixed: 0, remaining: [] };
    return {
        report,
        add(page, { found, remaining }) {
            report.pagesChecked += 1;
            report.issuesFound += found.length;
            report.issuesFixed += found.length - remaining.length;
            for (const issue of remaining) if (report.remaining.length < 50) report.remaining.push({ page, ...issue });
        },
    };
}

module.exports = { collectRepoFacts, checkPage, factCheckPage, createQualityReport, unlinkBroken, describeIssue };
