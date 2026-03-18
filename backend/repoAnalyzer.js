const fs = require("fs");
const path = require("path");

function analyzeRepo(repoPath) {
    const codeMap = {
        controllers: [],
        routes: [],
        services: [],
        models: [],
        utils: [],
        other: []
    };

    const ignoreDirs = [
        "node_modules",
        ".git",
        "dist",
        "build",
        "coverage",
        ".next",
    ];

    function scan(dir) {
        if (!fs.existsSync(dir)) return;

        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (!ignoreDirs.includes(item)) {
                    scan(fullPath);
                }
            } else {
                const relativePath = path.relative(repoPath, fullPath);
                const fileRoute = relativePath.replace(/\\/g, "/");

                const lowerPath = fileRoute.toLowerCase();

               if (lowerPath.includes("controller")) {
          codeMap.controllers.push(fileRoute);
        } else if (lowerPath.includes("route")) {
          codeMap.routes.push(fileRoute);
        } else if (lowerPath.includes("service")) {
          codeMap.services.push(fileRoute);
        } else if (lowerPath.includes("model") && !lowerPath.includes("node_modules")) {
          codeMap.models.push(fileRoute);
        } else if (lowerPath.includes("util") || lowerPath.includes("helper")) {
          codeMap.utils.push(fileRoute);
        } else if (lowerPath.endsWith(".js") || lowerPath.endsWith(".ts") || lowerPath.endsWith(".py") || lowerPath.endsWith(".go")) {
          codeMap.other.push(fileRoute);
        }
      }
    }
  } 

  scan(repoPath);
  return codeMap;
}

module.exports = analyzeRepo;