const fs = require("fs");
const path = require("path");

const IGNORE_LIST = ["node_modules", ".git", "dist", "build", "public"];

function scanCodeFiles(dir, files = []) {
    const folderName = path.basename(dir);
    if (IGNORE_LIST.includes(folderName)) {
        return files;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            scanCodeFiles(fullPath, files)
        } else {

            if(
                item.endsWith(".js") ||
                item.endsWith(".ts") ||
                item.endsWith(".py") ||
                item.endsWith(".go")
            ) {
                const content = fs.readFileSync(fullPath, "utf-8");

                files.push({
                    path: fullPath,
                    code: content
                });
            }
        }
    }

    return files;
}

module.exports = scanCodeFiles;

