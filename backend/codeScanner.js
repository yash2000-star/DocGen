const fs = require("fs");
const path = require("path");

const IGNORE_LIST = ["node_modules", ".git", "dist", "build", ".next", "coverage", "__pycache__", ".venv"];

// Extensions for primary code files (the AI will document these deeply)
const CODE_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".py", ".go", ".java", ".rb", ".php", ".rs", ".swift"];

// Extensions for context files (the AI reads these for understanding, not direct documentation)
const CONTEXT_EXTENSIONS = [".html", ".css", ".scss", ".json", ".md", ".mdx", ".yaml", ".yml", ".toml", ".env.example"];

// Special files that provide critical project-level context
const SPECIAL_FILES = ["package.json", "README.md", "readme.md", "README.rst", ".env.example", "requirements.txt", "Cargo.toml", "go.mod", "tsconfig.json", "Dockerfile", "docker-compose.yml"];

/**
 * Scans a repository for all relevant files.
 * Returns an object with two arrays:
 *   - codeFiles: Primary source code files to be documented
 *   - contextFiles: Supporting files that provide project context
 */
function scanCodeFiles(dir, codeFiles = [], contextFiles = []) {
    const folderName = path.basename(dir);
    if (IGNORE_LIST.includes(folderName)) {
        return { codeFiles, contextFiles };
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanCodeFiles(fullPath, codeFiles, contextFiles);
        } else {
            const ext = path.extname(item).toLowerCase();
            const content = fs.readFileSync(fullPath, "utf-8");

            // Cap file size to avoid blowing up AI context windows
            if (content.length > 50000) continue;

            if (CODE_EXTENSIONS.includes(ext)) {
                codeFiles.push({
                    path: fullPath,
                    code: content,
                    type: "code"
                });
            } else if (CONTEXT_EXTENSIONS.includes(ext) || SPECIAL_FILES.includes(item)) {
                contextFiles.push({
                    path: fullPath,
                    code: content,
                    type: item === "package.json" ? "package" :
                          item.toLowerCase().startsWith("readme") ? "readme" :
                          item.endsWith(".html") ? "html" :
                          item.endsWith(".css") || item.endsWith(".scss") ? "style" :
                          "config"
                });
            }
        }
    }

    return { codeFiles, contextFiles };
}

module.exports = scanCodeFiles;
