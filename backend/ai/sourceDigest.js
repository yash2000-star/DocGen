// Builds the source-code section of a prompt within a token budget.
//
// Repos can be far larger than a model's context window. Files are added in order of
// importance (README, package.json, entry points and routes, other code, then markup
// and styles) until the budget runs out; files that didn't fit are listed by name so
// the model still knows they exist.

const CHARS_PER_TOKEN = 4; // rough average for English and code

function estimateTokens(text) {
    return Math.ceil(String(text || "").length / CHARS_PER_TOKEN);
}

// The last few path segments: enough to show structure without machine-specific prefixes.
function shortPath(file) {
    return file.path.split(/[/\\]/).slice(-3).join("/");
}

// Higher scores are included first.
function codeFileScore(file) {
    const p = file.path.replace(/\\/g, "/").toLowerCase();
    const name = p.split("/").pop();
    let score = 0;
    if (/^(index|main|app|server|cli)\.[a-z]+$/.test(name)) score += 50;
    if (/(^|\/)(routes?|api|controllers?|handlers?|endpoints?)\//.test(p) || /(route|controller|handler)s?\./.test(name)) score += 30;
    if (/(^|\/)(models?|schemas?|services?|lib|core)\//.test(p)) score += 20;
    if (/(^|\/)(tests?|__tests__|spec|e2e|fixtures?|mocks?|examples?)\//.test(p) || /\.(test|spec)\./.test(name)) score -= 60;
    if (/(^|\/)(scripts?|migrations?)\//.test(p)) score -= 10;
    score -= p.split("/").length * 2; // shallower files tend to matter more
    return score;
}

/**
 * @param {object} options
 * @param {Array<{path: string, code: string, type?: string}>} options.codeFiles
 * @param {Array<{path: string, code: string, type: string}>} [options.contextFiles]
 * @param {number} options.budgetTokens - Total size allowed for the digest
 * @param {object} [options.maxChars] - Per-file caps by kind: readme, package, code, html, style
 * @returns {{ text: string, included: string[], omitted: string[] }}
 */
function buildSourceDigest({ codeFiles, contextFiles = [], budgetTokens, maxChars = {} }) {
    const caps = { readme: 12000, package: 6000, code: 8000, html: 5000, style: 3000, ...maxChars };
    let remaining = budgetTokens * CHARS_PER_TOKEN;
    const parts = [];
    const included = [];
    const omitted = [];

    const add = (file, cap, fence) => {
        const name = file.type === "readme" ? "README.md" : file.type === "package" ? "package.json" : shortPath(file);
        let body = file.code.length > cap ? `${file.code.slice(0, cap)}\n… (truncated)` : file.code;
        const header = `\n### ${name}\n`;
        const wrap = (b) => (fence === null ? `${header}${b}\n` : `${header}\`\`\`${fence}\n${b}\n\`\`\`\n`);
        let section = wrap(body);

        if (section.length > remaining) {
            // Keep a useful slice of the file if a reasonable amount still fits.
            const room = remaining - (wrap("").length + 20);
            if (room < 800) {
                omitted.push(name);
                return;
            }
            body = `${body.slice(0, room)}\n… (truncated)`;
            section = wrap(body);
        }
        parts.push(section);
        included.push(name);
        remaining -= section.length;
    };

    const readme = contextFiles.find((f) => f.type === "readme");
    if (readme) add(readme, caps.readme, null);
    const pkg = contextFiles.find((f) => f.type === "package");
    if (pkg) add(pkg, caps.package, null);

    const ranked = [...codeFiles].sort((a, b) => codeFileScore(b) - codeFileScore(a) || a.path.localeCompare(b.path));
    for (const file of ranked) add(file, caps.code, "");
    for (const file of contextFiles.filter((f) => f.type === "html")) add(file, caps.html, "html");
    for (const file of contextFiles.filter((f) => f.type === "style")) add(file, caps.style, "css");

    let text = parts.join("");
    if (omitted.length > 0) {
        text += `\n### Files not shown (prompt size limit)\n${omitted.map((n) => `- ${n}`).join("\n")}\n`;
    }
    return { text, included, omitted };
}

module.exports = { buildSourceDigest, estimateTokens, codeFileScore, CHARS_PER_TOKEN };
