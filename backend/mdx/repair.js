// Makes sure a generated page compiles before it's published.
//
// Models occasionally write MDX that doesn't parse: an unclosed <Steps>, or a bare "<" or
// "{" in prose. The page then can't render. When that happens the critic model gets the
// compiler's error and is asked to fix only that. If it still fails after a few tries, the
// page's component tags and braces are escaped so its text is published as plain markdown.
const { compileSafeMdx } = require("./safeMdx");
const { isFatalLLMError } = require("../ai/errors");
const { stripCodeFence } = require("../ai/text");

const MAX_REPAIRS = 2;

// The lines around an error, numbered, so the model can find the problem.
function excerpt(mdx, line) {
    if (!line) return "";
    const lines = mdx.split("\n");
    const from = Math.max(0, line - 4);
    return lines.slice(from, line + 3).map((text, i) => `${String(from + i + 1).padStart(4)} | ${text}`).join("\n");
}

function repairPrompt(mdx, error) {
    const where = error.line ? ` at line ${error.line}${error.column ? `, column ${error.column}` : ""}` : "";
    return `This MDX documentation page fails to compile.

ERROR${where}: ${error.message}
${error.line ? `\nAROUND THE ERROR:\n${excerpt(mdx, error.line)}\n` : ""}
Fix ONLY what breaks compilation. Common fixes:
- Close every component tag that was opened (for example </Steps>, </Card>, </Accordion>).
- In normal text, write a literal "<" as &lt; and a literal "{" or "}" as \\{ or \\} (code blocks and \`inline code\` are fine as they are).
- Do not use import or export statements, or JavaScript expressions in {braces}.

Do not change the wording, structure or frontmatter otherwise.
Output ONLY the complete corrected MDX, starting with the --- frontmatter. No explanation. No wrapper code fences.

THE PAGE:
${mdx}`;
}

// Escapes "<", "{" and "}" outside code so the page parses as plain markdown.
function escapeToMarkdown(mdx) {
    let inFence = false;
    let inFrontmatter = mdx.startsWith("---");
    return mdx.split("\n").map((line, index) => {
        if (inFrontmatter) {
            if (index > 0 && line.trim() === "---") inFrontmatter = false;
            return line;
        }
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            return line;
        }
        if (inFence) return line;
        // Leave `inline code` alone; escape everything else.
        return line.split(/(`+[^`]*`+)/).map((part, i) => (i % 2 === 1 ? part
            : part.replace(/</g, "&lt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;"))).join("");
    }).join("\n");
}

/**
 * @param {string} mdx - A generated page
 * @param {object} llm - { client, criticModel }
 * @param {string} [label] - Page title, for logs
 * @returns {Promise<{ mdx: string, repairs: number, fallback: boolean, warnings: string[] } | null>}
 *   null when the page can't be made to compile at all (skip it).
 */
async function ensureValidMdx(mdx, llm, label = "page") {
    let current = mdx;
    for (let attempt = 0; ; attempt++) {
        const result = compileSafeMdx(current);
        if (result.ok) {
            if (attempt > 0) console.log(`🔧 Repaired "${label}" after ${attempt} attempt(s).`);
            return { mdx: current, repairs: attempt, fallback: false, warnings: result.warnings };
        }
        console.warn(`⚠️  "${label}" doesn't compile: ${result.error.message}`);
        if (attempt >= MAX_REPAIRS) break;

        try {
            const response = await llm.client.generateText({ model: llm.criticModel, prompt: repairPrompt(current, result.error) });
            if (response.truncated || !response.text.trim()) break;
            current = stripCodeFence(response.text);
        } catch (error) {
            if (isFatalLLMError(error)) throw error;
            break; // a temporary error: fall back below
        }
    }

    const plain = escapeToMarkdown(current);
    const result = compileSafeMdx(plain);
    if (result.ok) {
        console.warn(`⚠️  Published "${label}" as plain markdown: its components couldn't be repaired.`);
        return { mdx: plain, repairs: MAX_REPAIRS, fallback: true, warnings: result.warnings };
    }
    console.error(`❌ Skipping "${label}": it still doesn't compile (${result.error.message}).`);
    return null;
}

module.exports = { ensureValidMdx, escapeToMarkdown };
