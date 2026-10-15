// Helpers for turning user-supplied names into filesystem paths safely.
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..", "..");
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const REPOS_DIR = path.join(ROOT_DIR, "repos");

// A single path segment: GitHub owner/repo names and page slugs.
// Letters, digits, dot, dash and underscore only, and never "." or "..".
const SAFE_SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,99}$/;

function isSafeSegment(value) {
    return typeof value === "string" && SAFE_SEGMENT.test(value) && !value.includes("..");
}

// Accepts https://github.com/<owner>/<repo>[.git][/] and returns { owner, repo }, or null.
function parseGithubRepoUrl(repoUrl) {
    if (typeof repoUrl !== "string") return null;
    const match = repoUrl.trim().match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
    if (!match || !isSafeSegment(match[1]) || !isSafeSegment(match[2])) return null;
    return { owner: match[1], repo: match[2] };
}

module.exports = { ROOT_DIR, DOCS_DIR, DIST_DIR, REPOS_DIR, isSafeSegment, parseGithubRepoUrl };
