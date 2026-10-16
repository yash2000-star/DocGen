const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");

// Shallow-clones a repository into targetPath, replacing anything already there.
// Each job clones into its own folder (see generationPipeline.createWorkspace), so two
// runs for the same project never share or delete each other's checkout.
async function cloneRepo(repoUrl, targetPath) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    console.log(`Cloning repository from ${repoUrl}...`);
    await simpleGit().clone(repoUrl, targetPath, ["--depth", "1"]);
    console.log(`Successfully cloned to ${targetPath}`);

    return targetPath;
}

module.exports = cloneRepo;
