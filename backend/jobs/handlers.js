// What each kind of job does. A handler gets the claimed job and a context from the
// worker, and returns { filesCount, usage }. Throwing fails the attempt; the worker
// decides whether to retry (see classifyFailure in ./worker.js).
const { config } = require("../config");
const supabase = require("../lib/supabase");
const { generateProjectDocs, updateDocsForFiles, buildProject } = require("../services/generationPipeline");
const { getUserLLM, getPreviewLLM } = require("../services/aiCredentials");
const { sendSuccessEmail } = require("../emailService");
const { LLMError } = require("../ai/errors");

/**
 * @typedef {object} JobContext
 * @property {(progress: object) => Promise<void>} reportProgress
 * @property {() => Promise<boolean>} shouldCancel
 * @property {(fields: object) => Promise<void>} update - Records fields on the job (provider, model)
 */

// The provider and model are read again when the job runs: the user may have changed
// their key or default model since it was queued.
async function recordModel(ctx, llm) {
    await ctx.update({ provider: llm.provider, model: llm.writerModel });
}

async function build(ctx, { tenantName, projectName }) {
    await ctx.reportProgress({ step: "building", message: "Building the docs site" });
    await buildProject(tenantName, projectName);
}

/** A full generation started from the dashboard, written with the user's own AI key. */
async function generation(job, ctx) {
    const { repoUrl, tenantName, projectName, userId } = job.payload;
    const llm = await getUserLLM(userId);
    await recordModel(ctx, llm);

    const result = await generateProjectDocs({
        repoUrl, tenantName, projectName, llm,
        runId: job.id,
        onProgress: ctx.reportProgress,
        shouldCancel: ctx.shouldCancel,
    });
    await build(ctx, { tenantName, projectName });

    const { error } = await supabase.rpc("increment_usage", {
        p_user_id: userId,
        p_month: new Date().toISOString().slice(0, 7),
        p_field: "generations",
    });
    if (error) console.error("[Jobs] Couldn't count the generation:", error.message);

    return { filesCount: result.generatedCount, usage: result.usage };
}

/** The anonymous free preview, written with the server's preview key (if the admin set one). */
async function preview(job, ctx) {
    const { repoUrl, tenantName, projectName, email } = job.payload;
    const llm = getPreviewLLM();
    if (!llm) throw new LLMError("not_configured", { providerMessage: "Free previews are turned off on this server." });
    await recordModel(ctx, llm);

    const result = await generateProjectDocs({
        repoUrl, tenantName, projectName, llm,
        maxPages: config.preview.maxPages,
        runId: job.id,
        onProgress: ctx.reportProgress,
        shouldCancel: ctx.shouldCancel,
    });
    await build(ctx, { tenantName, projectName });

    if (email && config.email.enabled) {
        sendSuccessEmail(email, tenantName, projectName);
    }
    return { filesCount: result.generatedCount, usage: result.usage };
}

/** Rewrites pages for files changed by a push, with the project owner's AI key. */
async function webhook(job, ctx) {
    const { repoUrl, tenantName, projectName, userId, files } = job.payload;
    const llm = await getUserLLM(userId);
    await recordModel(ctx, llm);

    const result = await updateDocsForFiles({
        repoUrl, tenantName, projectName, files, llm,
        runId: job.id,
        onProgress: ctx.reportProgress,
        shouldCancel: ctx.shouldCancel,
    });
    if (result.generatedCount > 0) await build(ctx, { tenantName, projectName });
    return { filesCount: result.generatedCount, usage: result.usage };
}

module.exports = { generation, preview, webhook };
