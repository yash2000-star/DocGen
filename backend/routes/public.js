const express = require("express");
const validator = require("validator");
const supabase = require("../lib/supabase");
const { getPreviewLLM } = require("../services/aiCredentials");
const { enqueueJob, getJob } = require("../jobs/queue");
const { isSafeSegment } = require("../lib/paths");

const router = express.Router();

// PUBLIC ROUTE: No auth required, but strictly limited!
// Queues a small preview (config.preview.maxPages pages) of a public GitHub repo and
// returns a job id to follow with GET /api/public/jobs/:id.
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

    // Cache hit: the docs already exist.
    if (existingProject?.status === 'successful' || existingProject?.status === 'live') {
        console.log(`[Public API] 🟢 Cache hit! Docs for ${projectName} already exist.`);
        return res.json({
            message: "Documentation already exists! Redirecting...",
            tenant: tenantName,
            version: projectName,
            cached: true
        });
    }

    // Someone already started a preview of this repo: watch that one.
    if (existingProject) {
        const activeJob = await findActivePreview(existingProject.id);
        if (activeJob) {
            return res.status(202).json({ message: "Documentation is already being generated.", jobId: activeJob.id, tenant: tenantName, version: projectName });
        }
    }

    // A project someone has claimed is regenerated from their dashboard, not from here.
    if (existingProject?.user_id) {
        return res.status(409).json({
            error: "This project is managed by its owner and can't be regenerated from a preview."
        });
    }

    const llm = getPreviewLLM();
    if (!llm) {
        return res.status(503).json({ error: "Free previews are turned off on this server. Sign in and connect your own AI provider to generate docs." });
    }

    let projectId = existingProject?.id;
    if (projectId) {
        await supabase.from('projects').update({ repo_url: repoUrl }).eq('id', projectId);
    } else {
        // Brand new: an orphan row (user_id is null until the owner signs in and claims it).
        const { data: inserted, error: insertError } = await supabase.from('projects').insert({
            tenant_name: tenantName,
            project_name: projectName,
            repo_url: repoUrl,
            status: 'queued',
            user_id: null,
        }).select('id').single();

        if (insertError) {
            // 23505 = unique violation: another request created it a moment ago.
            if (insertError.code === '23505') {
                return res.status(409).json({ error: "Documentation generation is already in progress. Please check back in a few minutes." });
            }
            console.error("Public API insert failed:", insertError);
            return res.status(500).json({ error: "Failed to create the project." });
        }
        projectId = inserted.id;
    }

    // --- 2. Queue the preview (capped to config.preview.maxPages pages to save credits) ---
    const { jobId } = await enqueueJob({
        projectId,
        eventType: 'preview',
        triggeredBy: 'public',
        payload: { repoUrl, tenantName, projectName, email: email || undefined },
        provider: llm.provider,
        model: llm.writerModel,
    });
    console.log(`[Public API] Queued a free preview of ${repoUrl} (job ${jobId}).`);

    res.status(202).json({ message: "Preview queued.", jobId, tenant: tenantName, version: projectName });
});

async function findActivePreview(projectId) {
    const { data } = await supabase
        .from('build_events')
        .select('id')
        .eq('project_id', projectId)
        .eq('event_type', 'preview')
        .in('status', ['queued', 'running'])
        .order('created_at', { ascending: false })
        .limit(1);
    return data?.[0] || null;
}

// Progress of a free preview, for the page the visitor is waiting on. Only preview jobs
// are visible here, and only what the waiting page needs.
router.get("/jobs/:id", async (req, res) => {
    const job = await getJob(req.params.id);
    if (!job || job.event_type !== 'preview') {
        return res.status(404).json({ error: "Preview not found." });
    }

    const { data: project } = await supabase
        .from('projects')
        .select('tenant_name, project_name')
        .eq('id', job.project_id)
        .maybeSingle();

    // Problems with the server's own AI credential are the administrator's, not the visitor's:
    // only problems with the repository itself are explained.
    const error = job.status === 'failed'
        ? (job.progress?.code === 'invalid_input' && job.error_message) || "The free preview couldn't be generated. Try again later."
        : null;

    res.json({
        status: job.status,
        progress: job.progress,
        error,
        tenant: project?.tenant_name,
        version: project?.project_name,
    });
});

module.exports = router;
