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
const { LLMError } = require("../ai/errors");
const { collectRepoFacts, factCheckPage, createQualityReport, unlinkBroken } = require("../quality/factCheck");
const { findOpenApiSpec, buildApiReference, API_REFERENCE_DIR } = require("../openapi");

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

// Writes the generated API reference pages into the run's output folder.
function writeApiReference(outDir, apiReference) {
    for (const page of apiReference.pages) {
        const file = path.join(outDir, `${page.slug}.mdx`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, page.mdx);
    }
}

// Generated API pages from an earlier run are replaced, not mixed with the new ones (an
// endpoint removed from the spec must disappear from the site).
function removeLiveApiReference(tenantName, projectName) {
    const liveDir = path.join(DOCS_DIR, tenantName, projectName);
    fs.rmSync(path.join(liveDir, API_REFERENCE_DIR), { recursive: true, force: true });
    fs.rmSync(path.join(liveDir, `${API_REFERENCE_DIR}.mdx`), { force: true });
}

// Nav groups the API reference added last time, so a refresh can swap them out.
function withApiNavigation(siteConfig, apiReference) {
    const oldGroups = new Set(siteConfig.apiReference?.groups || []);
    const navigation = (siteConfig.navigation || []).filter((group) => !oldGroups.has(group.group));
    if (!apiReference) {
        delete siteConfig.apiReference;
        siteConfig.navigation = navigation;
        return siteConfig;
    }
    siteConfig.navigation = [...navigation, ...apiReference.navigation];
    siteConfig.apiReference = { specPath: apiReference.summary.specPath, groups: apiReference.navigation.map((g) => g.group) };
    return siteConfig;
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
    const { client: meteredClient, totals: usage, lastError } = meterClient(llm.client);
    const runLlm = { ...llm, client: meteredClient };
    const report = makeReporter(onProgress);
    const workspace = createWorkspace(tenantName, projectName, runId);

    try {
        console.log(`\n[Pipeline] Starting generation for ${repoUrl}...`);
        await report({ step: "cloning", message: "Cloning the repository" });
        const downloadedFolderPath = await cloneOrExplain(repoUrl, workspace.srcDir);

        const { codeFiles, contextFiles } = scanCodeFiles(downloadedFolderPath);
        console.log(`[Pipeline] Inspector found ${codeFiles.length} code files + ${contextFiles.length} context files.`);

        // An OpenAPI spec gives an exact API reference without any AI.
        const openapi = findOpenApiSpec(downloadedFolderPath);
        const apiReference = openapi ? buildApiReference(openapi.spec, { specPath: openapi.specPath }) : null;
        if (apiReference) {
            console.log(`[Pipeline] OpenAPI spec ${openapi.specPath}: ${apiReference.summary.operations} endpoints.`);
            await report({ step: "planning", message: `Found the API spec ${openapi.specPath.slice(-60)} (${apiReference.summary.operations} endpoints)` });
        }

        if (codeFiles.length === 0 && contextFiles.length === 0) {
            throw new PipelineError("No valid code files found in this repository.", 404);
        }
        await checkCancelled(shouldCancel);

        // What the repository really contains, to check each page against.
        const facts = collectRepoFacts(downloadedFolderPath, { codeFiles, contextFiles });
        const quality = createQualityReport();

        // ═══════════════════════════════════════════════════════════
        // PHASE 1: SUPER-ARCHITECT — Design the entire doc site
        // ═══════════════════════════════════════════════════════════
        console.log(`\n[Pipeline] 🏗️  Triggering Super-Architect Phase...`);
        await report({ step: "planning", message: `Planning the docs from ${codeFiles.length + contextFiles.length} files` });
        const blueprint = await generateArchitectBlueprint(codeFiles, contextFiles, projectName, runLlm, { apiReference: apiReference?.summary });
        if (apiReference) blueprint.apiReference = apiReference.summary;
        // The API reference owns its slugs.
        const plannedPages = blueprint.pages
            .filter((page) => page.slug !== API_REFERENCE_DIR && !String(page.slug).startsWith(`${API_REFERENCE_DIR}/`))
            .slice(0, maxPages);
        const siteSlugs = new Set([...plannedPages.map((page) => page.slug), ...(apiReference?.pages.map((page) => page.slug) || [])]);

        // ═══════════════════════════════════════════════════════════
        // PHASE 2: GHOSTWRITER — Write each page from the plan
        // ═══════════════════════════════════════════════════════════
        const writtenPages = [];
        const outputs = new Map(); // slug → MDX, written once every page is done
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
            const markdownOutput = await generatePage(pagePlan, codeFiles, contextFiles, blueprint, runLlm, {
                onDraft: async (mdx, { relevantSource }) => {
                    const result = await factCheckPage(mdx, { facts, slugs: siteSlugs, llm: runLlm, relevantSource, label: pagePlan.title });
                    quality.add(pagePlan.slug, result);
                    return result.mdx;
                },
            });

            if (markdownOutput) {
                outputs.set(pagePlan.slug, markdownOutput);
                console.log(`📄 Wrote: ${pagePlan.title}`);
                writtenPages.push(pagePlan);
            }
        }

        // Links to planned pages that failed to write would be dead: make them plain text.
        const missing = plannedPages.filter((page) => !outputs.has(page.slug)).flatMap((page) => [`/${page.slug}`, page.slug, `./${page.slug}`]);
        for (const [slug, mdx] of outputs) {
            fs.writeFileSync(path.join(workspace.outDir, `${slug}.mdx`), missing.length ? unlinkBroken(mdx, missing) : mdx);
        }
        if (apiReference) writeApiReference(workspace.outDir, apiReference);

        if (writtenPages.length === 0) {
            // Every page failed: if the provider was the reason (outage, rate limit), say so.
            if (lastError() instanceof LLMError) throw lastError();
            throw new PipelineError("The AI writer did not produce any pages. Check the backend logs and your AI provider settings.", 502);
        }
        await checkCancelled(shouldCancel);

        // Navigation only lists pages that were actually written, so the sidebar has no dead links.
        // The live docs.json is read so regenerating keeps the user's branding.
        const liveDocsJson = path.join(DOCS_DIR, tenantName, projectName, "docs.json");
        const siteConfig = readExistingSiteConfig(liveDocsJson) || defaultSiteConfig(blueprint, projectName);
        siteConfig.navigation = buildNavigation(writtenPages);
        delete siteConfig.apiReference; // the navigation was rebuilt from scratch
        withApiNavigation(siteConfig, apiReference);
        fs.writeFileSync(path.join(workspace.outDir, "docs.json"), JSON.stringify(siteConfig, null, 2));

        const apiPages = apiReference?.pages.length || 0;
        await report({ step: "saving", message: `Saving ${writtenPages.length + apiPages} pages`, pagesDone: plannedPages.length, pagesTotal: plannedPages.length });
        removeLiveApiReference(tenantName, projectName);
        publishPages(workspace.outDir, tenantName, projectName);
        console.log(`[Pipeline] ✅ Published ${writtenPages.length} written pages, ${apiPages} API reference pages and docs.json.`);

        const { report: qualityReport } = quality;
        console.log(`[Pipeline] Fact check: ${qualityReport.issuesFound} found, ${qualityReport.issuesFixed} fixed, ${qualityReport.remaining.length} left.`);
        console.log(`[Pipeline] Tokens used: ${usage.inputTokens} in, ${usage.outputTokens} out across ${usage.calls} calls.`);
        return {
            generatedCount: writtenPages.length + apiPages,
            pages: writtenPages,
            usage,
            quality: { ...qualityReport, apiReference: apiReference?.summary || null },
        };
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
async function updateDocsForFiles({ repoUrl, tenantName, projectName, files, llm, runId, onProgress, shouldCancel, refreshApiReference = false }) {
    if (!isSafeSegment(tenantName) || !isSafeSegment(projectName)) {
        throw new PipelineError("Invalid tenant or project name.", 400);
    }
    if (!llm?.client) {
        throw new PipelineError("No AI provider is connected.", 400);
    }

    const { client: meteredClient, totals: usage, lastError } = meterClient(llm.client);
    const runLlm = { ...llm, client: meteredClient };
    const report = makeReporter(onProgress);
    const workspace = createWorkspace(tenantName, projectName, runId);
    const filesToProcess = filterChangedFiles(files);
    let generatedCount = 0;

    try {
        await report({ step: "cloning", message: "Cloning the repository" });
        const downloadedFolderPath = await cloneOrExplain(repoUrl, workspace.srcDir);

        // Pages are fact-checked against the repository, and may link to the site's pages.
        const facts = collectRepoFacts(downloadedFolderPath, scanCodeFiles(downloadedFolderPath));
        const liveDocsJson = path.join(DOCS_DIR, tenantName, projectName, "docs.json");
        const siteConfig = readExistingSiteConfig(liveDocsJson);
        const siteSlugs = new Set((siteConfig?.navigation || []).flatMap((group) => group.pages || []).filter((slug) => typeof slug === "string"));
        for (const file of filesToProcess) siteSlugs.add(file.replace(/\.[^./]+$/, ""));
        const quality = createQualityReport();

        for (const [index, relativeFilePath] of filesToProcess.entries()) {
            await checkCancelled(shouldCancel);
            const fullPath = path.join(downloadedFolderPath, relativeFilePath);
            if (!fullPath.startsWith(downloadedFolderPath + path.sep) || !fs.existsSync(fullPath)) continue;
            // Never follow a symlink (the file or a folder above it) out of the clone: it
            // could point at the server's own files.
            const cloneRoot = fs.realpathSync(downloadedFolderPath);
            if (!fs.realpathSync(fullPath).startsWith(cloneRoot + path.sep)) continue;
            const stat = fs.lstatSync(fullPath);
            if (!stat.isFile() || stat.size > 50000) continue;

            await report({ step: "writing", message: `Updating the page for ${relativeFilePath.slice(-80)}`, pagesDone: index, pagesTotal: filesToProcess.length });
            const content = fs.readFileSync(fullPath, "utf-8");
            const markdownOutput = await generateDocs({ path: fullPath, code: content }, runLlm, {
                onDraft: async (mdx, { relevantSource }) => {
                    const result = await factCheckPage(mdx, { facts, slugs: siteSlugs, llm: runLlm, relevantSource, label: relativeFilePath });
                    quality.add(relativeFilePath, result);
                    return result.mdx;
                },
            });

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

        if (generatedCount === 0 && filesToProcess.length > 0 && lastError() instanceof LLMError) throw lastError();

        // The spec changed: rebuild the API reference (no AI involved).
        let apiReference = null;
        if (refreshApiReference) {
            const openapi = findOpenApiSpec(downloadedFolderPath);
            apiReference = openapi ? buildApiReference(openapi.spec, { specPath: openapi.specPath }) : null;
            if (apiReference) writeApiReference(workspace.outDir, apiReference);
            if (siteConfig) {
                withApiNavigation(siteConfig, apiReference);
                fs.writeFileSync(path.join(workspace.outDir, "docs.json"), JSON.stringify(siteConfig, null, 2));
            }
        }
        const apiPages = apiReference?.pages.length || 0;

        if (generatedCount > 0 || refreshApiReference) {
            await report({ step: "saving", message: `Saving ${generatedCount + apiPages} pages`, pagesDone: filesToProcess.length, pagesTotal: filesToProcess.length });
            if (refreshApiReference) removeLiveApiReference(tenantName, projectName);
            publishPages(workspace.outDir, tenantName, projectName);
        }
        return {
            generatedCount: generatedCount + apiPages,
            usage,
            quality: { ...quality.report, apiReference: apiReference?.summary || null },
        };
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
