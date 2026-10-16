// Splits "--- yaml ---" frontmatter from a Markdown/MDX page.
//
// Pages come from AI output and repository files, so the YAML is untrusted: it's parsed
// with the JSON schema (plain strings, numbers, booleans, null, lists and maps; no custom
// tags), and invalid YAML is ignored instead of failing the page.
const yaml = require("js-yaml");

const FENCE = /^﻿?\s*---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/**
 * @param {string} text
 * @returns {{ data: object, content: string }} content is the page without its frontmatter
 */
function parseFrontmatter(text) {
    const source = String(text ?? "");
    const match = FENCE.exec(source);
    if (!match) return { data: {}, content: source };

    let data = {};
    try {
        const parsed = yaml.load(match[1] || "", { schema: yaml.JSON_SCHEMA });
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed;
    } catch {
        // Invalid YAML: keep the page, drop the metadata.
    }
    return { data, content: source.slice(match[0].length) };
}

module.exports = { parseFrontmatter };
