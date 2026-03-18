const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");

async function cloneRepo(repoUrl, projectName){
    const git = simpleGit();

    const targetPath = path.join(__dirname, "../repos", projectName);

    if(fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        console.log(`Delete old repo cache: ${projectName}`);
    }

    console.log(`Cloning repository from ${repoUrl}...`);
    await git.clone(repoUrl, targetPath);
    console.log(`Successfully cloned to ${targetPath}`);

    return targetPath;
}

module.exports = cloneRepo;