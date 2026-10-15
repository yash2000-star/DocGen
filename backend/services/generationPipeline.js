// The doc-generation pipeline, run by the job worker (backend/jobs/) for dashboard
// generations, anonymous previews and push-triggered updates.
//
// Each run works in its own folder, repos/<tenant>/<project>/<jobId>/: the clone goes in
// src/ and new pages in out/. Pages are copied into the live docs folder only once the
// whole run has succeeded, so a failed or cancelled run never leaves half a site behind.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const cloneRepo = require("../gitServices");
const scanCodeFiles = require("../codeScanner");
const { generatePage, generateArchitectBlueprint, generateDocs } = require("../aiWriter");
const { DOCS_DIR, REPOS_DIR, ROOT_DIR, isSafeSegment, parseGithubRepoUrl } = require("../lib/paths");
const { meterClient } = require("../ai/usage");

const BUILD_SCRIPT = path.join(ROOT_DIR, "build", "build.js");
const PAGE_DELAY_MS = 3000; // Rate limiting between AI calls

class PipelineError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
    }
}

// Thrown when the job running the pipeline was cancelled (or taken over by another worker).
class CancelledError extends Error {
    constructor(message = "Cancelled.") {
        super(message);
        this.name = "CancelledError";
    }
}

// The run's private folders. cleanup() deletes them; call it when the run ends either way.
function createWorkspace(tenantName, projectName, runId) {
    const runName = isSafeSegment(runId) ? runId : `run-${Date.now()}-${process.pid}`;
    const root = path.join(REPOS_DIR, tenantName, projectName, runName);
    fs.rmSync(root, { recursive: true, force: true });
    const outDir = path.join(root, "out");
    fs.mkdirSync(outDir, { recursive: true });
    return {
        root,
        srcDir: path.join(root, "src"),
        outDir,
        cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
    };
}

// Copies the run's finished pages over the live docs folder. Pages the run didn't write
// (older pages, manual ones) are kept, as before.
function publishPages(outDir, tenantName, projectName) {
    const targetDir = path.join(DOCS_DIR, tenantName, projectName);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(outDir, targetDir, { recursive: true, force: true });
    return targetDir;
}

// A repo that doesn't exist or is private fails the same way every time: don't retry it.
async function cloneOrExplain(repoUrl, targetPath) {
    try {
        return await cloneRepo(repoUrl, targetPath);
    } catch (error) {
        if (/not found|could not read Username|Authentication failed|access denied/i.test(error.message)) {
            throw new PipelineError("Couldn't clone the repository. Check that it exists and is public.", 404);
        }
        throw error;
    }
}

// Progress callbacks are best-effort: a failure to report must never fail the run.
function makeReporter(onProgress) {
    return async (progress) => {
        try {
            await onProgress?.(progress);
        } catch (error) {
            console.error("[Pipeline] Couldn't report progress:", error.message);
        }
    };
}

async function checkCancelled(shouldCancel) {
    if (shouldCancel && await shouldCancel()) throw new CancelledError();
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
 * @param {string} [options.runId] - Names the run's workspace folder (the job id)
 * @param {(progress: { step: string, message: string, pagesDone?: number, pagesTotal?: number }) => any} [options.onProgress]
 * @param {() => boolean | Promise<boolean>} [options.shouldCancel] - Checked between steps; true stops the run with CancelledError
 * @returns {Promise<{ generatedCount: number, pages: object[], usage: { calls: number, inputTokens: number, outputTokens: number } }>}
 */
async function generateProjectDocs({ repoUrl, tenantName, projectName, maxPages = Infinity, llm, runId, onProgress, shouldCancel }) {
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
    const report = makeReporter(onProgress);
    const workspace = createWorkspace(tenantName, projectName, runId);

    try {
        console.log(`\n[Pipeline] Starting generation for ${repoUrl}...`);
        await report({ step: "cloning", message: "Cloning the repository" });
        const downloadedFolderPath = await cloneOrExplain(repoUrl, workspace.srcDir);

        const { codeFiles, contextFiles } = scanCodeFiles(downloadedFolderPath);
        console.log(`[Pipeline] Inspector found ${codeFiles.length} code files + ${contextFiles.length} context files.`);

        if (codeFiles.length === 0 && contextFiles.length === 0) {
            throw new PipelineError("No valid code files found in this repository.", 404);
        }
        await checkCancelled(shouldCancel);

        // ═══════════════════════════════════════════════════════════
        // PHASE 1: SUPER-ARCHITECT — Design the entire doc site
        // ═══════════════════════════════════════════════════════════
        console.log(`\n[Pipeline] 🏗️  Triggering Super-Architect Phase...`);
        await report({ step: "planning", message: `Planning the docs from ${codeFiles.length + contextFiles.length} files` });
        const blueprint = await generateArchitectBlueprint(codeFiles, contextFiles, projectName, runLlm);
        const plannedPages = blueprint.pages.slice(0, maxPages);

        // ═══════════════════════════════════════════════════════════
        // PHASE 2: GHOSTWRITER — Write each page from the plan
        // ═══════════════════════════════════════════════════════════
        const writtenPages = [];
        for (const [index, pagePlan] of plannedPages.entries()) {
            await checkCancelled(shouldCancel);
            if (!isSafeSegment(pagePlan.slug)) {
                console.warn(`[Pipeline] Skipping page with unsafe slug: ${pagePlan.slug}`);
                continue;
            }
            if (index > 0) await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS));

            await report({
                step: "writing",
                message: `Writing "${String(pagePlan.title || pagePlan.slug).slice(0, 80)}"`,
                pagesDone: index,
                pagesTotal: plannedPages.length,
            });
            const markdownOutput = await generatePage(pagePlan, codeFiles, contextFiles, blueprint, runLlm);

            if (markdownOutput) {
                const mdFilePath = path.join(workspace.outDir, `${pagePlan.slug}.mdx`);
                fs.writeFileSync(mdFilePath, markdownOutput);
                console.log(`📄 Wrote: ${pagePlan.title}`);
                writtenPages.push(pagePlan);
            }
        }

        if (writtenPages.length === 0) {
            throw new PipelineError("The AI writer did not produce any pages. Check the backend logs and your AI provider settings.", 502);
        }
        await checkCancelled(shouldCancel);

        // Navigation only lists pages that were actually written, so the sidebar has no dead links.
        // The live docs.json is read so regenerating keeps the user's branding.
        const liveDocsJson = path.join(DOCS_DIR, tenantName, projectName, "docs.json");
        const siteConfig = readExistingSiteConfig(liveDocsJson) || defaultSiteConfig(blueprint, projectName);
        siteConfig.navigation = buildNavigation(writtenPages);
        fs.writeFileSync(path.join(workspace.outDir, "docs.json"), JSON.stringify(siteConfig, null, 2));

        await report({ step: "saving", message: `Saving ${writtenPages.length} pages`, pagesDone: plannedPages.length, pagesTotal: plannedPages.length });
        publishPages(workspace.outDir, tenantName, projectName);
        console.log(`[Pipeline] ✅ Published ${writtenPages.length} pages and docs.json.`);

        console.log(`[Pipeline] Tokens used: ${usage.inputTokens} in, ${usage.outputTokens} out across ${usage.calls} calls.`);
        return { generatedCount: writtenPages.length, pages: writtenPages, usage };
    } catch (error) {
        // Keep the tokens spent before the failure, so the run record still shows them.
        error.usage = usage;
        throw error;
    } finally {
        workspace.cleanup();
    }
}

// Source files a push may update the docs for.
const WEBHOOK_EXTENSIONS = new Set([".js", ".ts", ".py", ".go"]);

// Keeps only plain relative paths to supported source files (a crafted payload could
// contain "../" or absolute paths).
function filterChangedFiles(files) {
    return [...new Set((files || []).filter((file) =>
        typeof file === "string" &&
        file.length <= 500 &&
        !path.isAbsolute(file) &&
        !file.split(/[/\\]/).includes("..") &&
        WEBHOOK_EXTENSIONS.has(path.extname(file))
    ))];
}

/**
 * Rewrites the reference page of each changed source file (push-triggered updates).
 * Like generateProjectDocs, pages are published only if the whole run succeeds.
 *
 * @param {object} options
 * @param {string[]} options.files - Paths relative to the repository root
 * @returns {Promise<{ generatedCount: number, usage: object }>}
 */
async function updateDocsForFiles({ repoUrl, tenantName, projectName, files, llm, runId, onProgress, shouldCancel }) {
    if (!isSafeSegment(tenantName) || !isSafeSegment(projectName)) {
        throw new PipelineError("Invalid tenant or project name.", 400);
    }
    if (!llm?.client) {
        throw new PipelineError("No AI provider is connected.", 400);
    }

    const { client: meteredClient, totals: usage } = meterClient(llm.client);
    const runLlm = { ...llm, client: meteredClient };
    const report = makeReporter(onProgress);
    const workspace = createWorkspace(tenantName, projectName, runId);
    const filesToProcess = filterChangedFiles(files);
    let generatedCount = 0;

    try {
        await report({ step: "cloning", message: "Cloning the repository" });
        const downloadedFolderPath = await cloneOrExplain(repoUrl, workspace.srcDir);

        for (const [index, relativeFilePath] of filesToProcess.entries()) {
            await checkCancelled(shouldCancel);
            const fullPath = path.join(downloadedFolderPath, relativeFilePath);
            if (!fullPath.startsWith(downloadedFolderPath + path.sep) || !fs.existsSync(fullPath)) continue;

            await report({ step: "writing", message: `Updating the page for ${relativeFilePath.slice(-80)}`, pagesDone: index, pagesTotal: filesToProcess.length });
            const content = fs.readFileSync(fullPath, "utf-8");
            const markdownOutput = await generateDocs({ path: fullPath, code: content }, runLlm);

            if (markdownOutput) {
                const parsedPath = path.parse(relativeFilePath);
                const nestedDir = path.join(workspace.outDir, parsedPath.dir);
                fs.mkdirSync(nestedDir, { recursive: true });
                fs.writeFileSync(path.join(nestedDir, `${parsedPath.name}.mdx`), markdownOutput);
                console.log(`[Pipeline] Updated page for ${relativeFilePath}`);
                generatedCount++;
            }
        }
        await checkCancelled(shouldCancel);

        if (generatedCount > 0) {
            await report({ step: "saving", message: `Saving ${generatedCount} pages`, pagesDone: filesToProcess.length, pagesTotal: filesToProcess.length });
            publishPages(workspace.outDir, tenantName, projectName);
        }
        return { generatedCount, usage };
    } catch (error) {
        error.usage = usage;
        error.generatedCount = generatedCount;
        throw error;
    } finally {
        workspace.cleanup();
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

module.exports = {
    generateProjectDocs,
    updateDocsForFiles,
    filterChangedFiles,
    runBuild,
    buildProject,
    PipelineError,
    CancelledError,
};
