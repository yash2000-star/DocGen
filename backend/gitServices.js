const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");
const { REPOS_DIR } = require("./lib/paths");

// Clones into repos/<tenant>/<project> so two tenants with the same repo name don't collide.
async function cloneRepo(repoUrl, tenantName, projectName) {
    const git = simpleGit();

    const targetPath = path.join(REPOS_DIR, tenantName, projectName);

    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        console.log(`Delete old repo cache: ${tenantName}/${projectName}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    console.log(`Cloning repository from ${repoUrl}...`);
    await git.clone(repoUrl, targetPath, ["--depth", "1"]);
    console.log(`Successfully cloned to ${targetPath}`);

    return targetPath;
}

module.exports = cloneRepo;
