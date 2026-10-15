const express = require("express");
const validator = require("validator");
const { config } = require("../config");
const supabase = require("../lib/supabase");
const { sendSuccessEmail } = require("../emailService");
const { generateProjectDocs, buildProject } = require("../services/generationPipeline");
const { getPreviewLLM } = require("../services/aiCredentials");
const { startRun, finishRun } = require("../services/buildEvents");
const { describeAiError } = require("../ai/httpErrors");
const { isSafeSegment } = require("../lib/paths");

const router = express.Router();

// PUBLIC ROUTE: No auth required, but strictly limited!
// Generates a small preview (config.preview.maxPages pages) for a public GitHub repo.
// Anonymous visitors have no AI key, so this uses the server's own preview credential
// (PREVIEW_AI_*). Without one the preview is off.
router.post("/github", async (req, res) => {
    const tenantName  = typeof req.body.tenantName === "string" ? req.body.tenantName.trim() : "";
    const projectName = typeof req.body.projectName === "string" ? req.body.projectName.trim() : "";
    const email = typeof req.body.email === "string" && validator.isEmail(req.body.email.trim())
        ? req.body.email.trim()
        : "";

    if (!isSafeSegment(tenantName) || !isSafeSegment(projectName)) {
        return res.status(400).json({ error: "Missing or invalid repository details." });
    }

    // The preview only ever documents the public GitHub repo matching the URL.
    const repoUrl = `https://github.com/${tenantName}/${projectName}`;

    const llm = getPreviewLLM();

    // --- 1. Decide what to do based on the existing project row ---
    const { data: existingProject, error: searchError } = await supabase
        .from('projects')
        .select('id, status, user_id')
        .eq('tenant_name', tenantName)
        .eq('project_name', projectName)
        .limit(1)
        .maybeSingle();

    if (searchError) {
        console.error("Public API lookup failed:", searchError);
        return res.status(500).json({ error: "Failed to look up the project." });
    }

    if (existingProject) {
        // Cache Hit: It's already done!
        if (existingProject.status === 'successful') {
            console.log(`[Public API] 🟢 Cache hit! Docs for ${projectName} already exist.`);
            return res.json({
                message: "Documentation already exists! Redirecting...",
                tenant: tenantName,
                version: projectName,
                cached: true
            });
        }

        // Conflict: Someone else is already generating it right now!
        if (existingProject.status === 'running') {
            console.log(`[Public API] 🟡 Generation already in progress for ${projectName}.`);
            return res.status(409).json({
                error: "Documentation generation is already in progress. Please check back in a few minutes."
            });
        }

        if (!llm) {
            return res.status(503).json({ error: "Free previews are turned off on this server. Sign in and connect your own AI provider to generate docs." });
        }

        // A project someone has claimed is regenerated from their dashboard, not from here.
        if (existingProject.user_id) {
            return res.status(409).json({
                error: "This project is managed by its owner and can't be regenerated from a preview."
            });
        }

        // Recovery: It exists but previously failed. Try again.
        await supabase.from('projects')
            .update({ status: 'running', repo_url: repoUrl })
            .eq('id', existingProject.id);
    } else {
        if (!llm) {
            return res.status(503).json({ error: "Free previews are turned off on this server. Sign in and connect your own AI provider to generate docs." });
        }

        // Brand New: Insert an orphan row (user_id is null until the owner signs in and claims it)
        const { error: insertError } = await supabase.from('projects').insert({
            tenant_name: tenantName,
            project_name: projectName,
            repo_url: repoUrl,
            status: 'running',
            user_id: null,
        });

        if (insertError) {
            // 23505 = unique violation: another request created it a moment ago.
            if (insertError.code === '23505') {
                return res.status(409).json({
                    error: "Documentation generation is already in progress. Please check back in a few minutes."
                });
            }
            console.error("Public API insert failed:", insertError);
            return res.status(500).json({ error: "Failed to create the project." });
        }
    }

    const setStatus = (status) => supabase.from('projects')
        .update({ status })
        .eq('tenant_name', tenantName)
        .eq('project_name', projectName);

    const runId = await startRun({ tenantName, projectName, eventType: 'preview', triggeredBy: 'public', provider: llm.provider, model: llm.writerModel });
    let result;

    try {
        // --- 2. THE GENERATION PROCESS (preview is capped to save credits) ---
        console.log(`\n [Public API] Starting free preview request for ${repoUrl}...`);
        result = await generateProjectDocs({
            repoUrl,
            tenantName,
            projectName,
            maxPages: config.preview.maxPages,
            llm,
        });

        // --- 3. Wait for the build so the docs exist before we redirect ---
        await buildProject(tenantName, projectName);

        // Mark as successful in DB ONLY AFTER the worker is completely done
        await setStatus('successful');
        await finishRun(runId, { status: 'successful', filesCount: result.generatedCount, usage: result.usage });

        if (email && config.email.enabled) {
            sendSuccessEmail(email, tenantName, projectName);
        }

        // --- 4. THE FINAL RESPONSE ---
        res.json({
            message: "Documentation generated successfully!",
            tenant: tenantName,
            version: projectName,
            cached: false
        });

    } catch (error) {
        const ai = describeAiError(error);
        console.error("Public API Error:", ai ? `${ai.code}: ${ai.message} ${ai.providerMessage || ''}` : error);
        await setStatus('failed');
        await finishRun(runId, {
            status: 'failed',
            filesCount: result?.generatedCount || 0,
            usage: error.usage || result?.usage,
            errorMessage: ai ? ai.message : error.message,
        });
        if (!res.headersSent) {
            // Problems with the server's own AI credential are the administrator's, not the visitor's.
            res.status(ai ? 503 : error.statusCode || 500).json({
                error: ai ? "The free preview is unavailable right now. Try again later." : error.statusCode ? error.message : "Failed to generate preview."
            });
        }
    }
});

module.exports = router;
