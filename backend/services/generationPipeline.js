// The doc-generation pipeline shared by the dashboard route (/api/github)
// and the anonymous free-preview route (/api/public/github).
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const cloneRepo = require("../gitServices");
const scanCodeFiles = require("../codeScanner");
const { generatePage, generateArchitectBlueprint } = require("../aiWriter");
const { DOCS_DIR, ROOT_DIR, isSafeSegment, parseGithubRepoUrl } = require("../lib/paths");
const { meterClient } = require("../ai/usage");

const BUILD_SCRIPT = path.join(ROOT_DIR, "build", "build.js");
const PAGE_DELAY_MS = 3000; // Rate limiting between AI calls

class PipelineError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

function defaultSiteConfig(blueprint, projectName) {
    return {
        "$schema": "https://mintlify.com/docs.json",
        "name": blueprint.projectName || projectName.charAt(0).toUpperCase() + projectName.slice(1),
        "logo": { "light": "/logo/light.svg", "dark": "/logo/dark.svg" },
        "theme": "mint",
        "colors": { "primary": "#3b82f6", "light": "#ffffff", "dark": "#000000" }
    };
}

// Reads the existing docs.json so regenerating keeps the user's branding.
function readExistingSiteConfig(docsJsonPath) {
    if (!fs.existsSync(docsJsonPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(docsJsonPath, "utf8"));
    } catch (e) {
        console.log(`[Pipeline] Failed to parse existing config, creating fresh.`);
        return null;
    }
}

// Groups written pages into Mintlify-style navigation, keeping the Architect's order.
function buildNavigation(pages) {
    const groupMap = {};
    for (const page of pages) {
        if (!groupMap[page.group]) groupMap[page.group] = [];
        groupMap[page.group].push(page.slug);
    }
    return Object.entries(groupMap).map(([group, slugs]) => ({ group, pages: slugs }));
}

/**
 * Clones a GitHub repo, plans the doc site, writes each page, and saves docs.json.
 * Does not run the build; call runBuild() afterwards.
 *
 * @param {object} options
 * @param {string} options.repoUrl - https://github.com/<owner>/<repo>
 * @param {string} options.tenantName
 * @param {string} options.projectName
 * @param {number} [options.maxPages] - Cap on generated pages (used by the free preview).
 * @param {object} options.llm - The AI to write with: { client, writerModel, criticModel } from getUserLLM()
 * @returns {Promise<{ generatedCount: number, pages: object[], usage: { calls: number, inputTokens: number, outputTokens: number } }>}
 */
async function generateProjectDocs({ repoUrl, tenantName, projectName, maxPages = Infinity, llm }) {
    if (!isSafeSegment(tenantName) || !isSafeSegment(projectName)) {
        throw new PipelineError("Invalid tenant or project name.", 400);
    }
    if (!parseGithubRepoUrl(repoUrl)) {
        throw new PipelineError("Repository URL must look like https://github.com/<owner>/<repo>.", 400);
    }
    if (!llm?.client) {
        throw new PipelineError("No AI provider is connected.", 400);
    }

    // Count every token this run uses, across the architect, writer and critic.
    const { client: meteredClient, totals: usage } = meterClient(llm.client);
    const runLlm = { ...llm, client: meteredClient };

    try {
        console.log(`\n[Pipeline] Starting generation for ${repoUrl}...`);
        const downloadedFolderPath = await cloneRepo(repoUrl, tenantName, projectName);

        const { codeFiles, contextFiles } = scanCodeFiles(downloadedFolderPath);
        console.log(`[Pipeline] Inspector found ${codeFiles.length} code files + ${contextFiles.length} context files.`);

        if (codeFiles.length === 0 && contextFiles.length === 0) {
            throw new PipelineError("No valid code files found in this repository.", 404);
        }

        const targetDir = path.join(DOCS_DIR, tenantName, projectName);
        fs.mkdirSync(targetDir, { recursive: true });

        // ═══════════════════════════════════════════════════════════
        // PHASE 1: SUPER-ARCHITECT — Design the entire doc site
        // ═══════════════════════════════════════════════════════════
        console.log(`\n[Pipeline] 🏗️  Triggering Super-Architect Phase...`);
        const blueprint = await generateArchitectBlueprint(codeFiles, contextFiles, projectName, runLlm);
        const plannedPages = blueprint.pages.slice(0, maxPages);

        // ═══════════════════════════════════════════════════════════
        // PHASE 2: GHOSTWRITER — Write each page from the plan
        // ═══════════════════════════════════════════════════════════
        const writtenPages = [];
        for (const [index, pagePlan] of plannedPages.entries()) {
            if (!isSafeSegment(pagePlan.slug)) {
                console.warn(`[Pipeline] Skipping page with unsafe slug: ${pagePlan.slug}`);
                continue;
            }
            if (index > 0) await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS));

            const markdownOutput = await generatePage(pagePlan, codeFiles, contextFiles, blueprint, runLlm);

            if (markdownOutput) {
                const mdFilePath = path.join(targetDir, `${pagePlan.slug}.mdx`);
                fs.writeFileSync(mdFilePath, markdownOutput);
                console.log(`📄 Saved: ${pagePlan.title} → ${mdFilePath}`);
                writtenPages.push(pagePlan);
            }
        }

        if (writtenPages.length === 0) {
            throw new PipelineError("The AI writer did not produce any pages. Check the backend logs and your AI provider settings.", 502);
        }

        // Navigation only lists pages that were actually written, so the sidebar has no dead links.
        const docsJsonPath = path.join(targetDir, "docs.json");
        const siteConfig = readExistingSiteConfig(docsJsonPath) || defaultSiteConfig(blueprint, projectName);
        siteConfig.navigation = buildNavigation(writtenPages);
        fs.writeFileSync(docsJsonPath, JSON.stringify(siteConfig, null, 2));
        console.log(`[Pipeline] ✅ docs.json saved with ${writtenPages.length} pages.`);

        console.log(`[Pipeline] Tokens used: ${usage.inputTokens} in, ${usage.outputTokens} out across ${usage.calls} calls.`);
        return { generatedCount: writtenPages.length, pages: writtenPages, usage };
    } catch (error) {
        // Keep the tokens spent before the failure, so the run record still shows them.
        error.usage = usage;
        throw error;
    }
}

/**
 * Runs build/build.js for one project (or a single route) in a child process.
 * Resolves when the build exits with code 0 and rejects otherwise.
 */
function runBuild(args) {
    return new Promise((resolve, reject) => {
        const buildProcess = spawn(process.execPath, [BUILD_SCRIPT, ...args]);

        buildProcess.stdout.on("data", (data) => process.stdout.write(`[Worker] ${data}`));
        buildProcess.stderr.on("data", (data) => process.stderr.write(`[Worker Error] ${data}`));

        buildProcess.on("error", reject);
        buildProcess.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Build worker exited with code ${code}`));
        });
    });
}

function buildProject(tenantName, projectName) {
    return runBuild(["--scope", `${tenantName}/${projectName}`]);
}

module.exports = { generateProjectDocs, runBuild, buildProject, PipelineError };
