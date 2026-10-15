// The job queue: generation runs are rows in build_events (see the job_queue migration).
//
// The API enqueues a job and returns at once. A worker (./worker.js) claims it, runs it,
// reports progress and records the outcome. Every write a worker makes is guarded by its
// own id (locked_by), so a worker that lost its job to the stale-job sweep can't overwrite
// what the new owner does.
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const supabase = require("../lib/supabase");
const { DIST_DIR } = require("../lib/paths");

const WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString("hex")}`;

// Lets the worker in this process start a job the moment it's enqueued instead of
// waiting for its next poll.
const events = new EventEmitter();

// Columns a member of the project may see. The payload (it can hold an email address)
// and the worker id stay on the server.
const PUBLIC_COLUMNS = [
    "id", "project_id", "event_type", "status", "triggered_by", "files_count", "created_at",
    "provider", "model", "input_tokens", "output_tokens", "error_message", "finished_at",
    "attempts", "max_attempts", "run_after", "started_at", "progress", "cancel_requested",
].join(", ");

const QUEUED_PROGRESS = { step: "queued", message: "Waiting for a worker" };

function truncate(message, max = 1000) {
    return message ? String(message).slice(0, max) : null;
}

async function setProjectStatus(projectId, status) {
    const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
    if (error) console.error("[Queue] Couldn't update the project status:", error.message);
}

async function findQueuedJob(projectId) {
    const { data, error } = await supabase
        .from("build_events")
        .select("id, event_type, payload")
        .eq("project_id", projectId)
        .eq("status", "queued")
        .maybeSingle();
    if (error) throw error;
    return data;
}

/**
 * Adds a job. A project has at most one waiting job: if one is already waiting, nothing
 * is added and `duplicate` is true, with the waiting job's id.
 *
 * @param {object} job
 * @param {string} job.projectId
 * @param {"generation"|"preview"|"webhook"} job.eventType
 * @param {string} job.triggeredBy - "dashboard", "public" or "github"
 * @param {object} job.payload - What the handler needs (repo, user, files...)
 * @param {string} [job.provider]
 * @param {string} [job.model]
 * @returns {Promise<{ jobId: string, duplicate: boolean }>}
 */
async function enqueueJob({ projectId, eventType, triggeredBy, payload, provider, model, maxAttempts }) {
    const row = {
        project_id: projectId,
        event_type: eventType,
        status: "queued",
        triggered_by: triggeredBy,
        payload,
        provider: provider || null,
        model: model || null,
        progress: QUEUED_PROGRESS,
    };
    if (maxAttempts) row.max_attempts = maxAttempts;

    const { data, error } = await supabase.from("build_events").insert(row).select("id").single();
    if (error) {
        // 23505: the project already has a waiting job (build_events_one_queued_per_project).
        if (error.code === "23505") {
            const waiting = await findQueuedJob(projectId);
            if (waiting) return { jobId: waiting.id, duplicate: true };
            // It was claimed between our insert and this lookup: the slot is free now.
            return enqueueJob({ projectId, eventType, triggeredBy, payload, provider, model, maxAttempts });
        }
        throw error;
    }

    await markProjectWaiting(projectId);
    events.emit("enqueued");
    return { jobId: data.id, duplicate: false };
}

// A project with a running job stays "running"; otherwise it shows as waiting.
async function markProjectWaiting(projectId) {
    const { data: running } = await supabase
        .from("build_events")
        .select("id")
        .eq("project_id", projectId)
        .eq("status", "running")
        .limit(1);
    if (!running?.length) await setProjectStatus(projectId, "queued");
}

/**
 * Queues docs updates for files changed by a push. Pushes that arrive while an update is
 * already waiting are folded into it; a waiting full generation already covers them.
 * @returns {Promise<{ jobId: string, merged: boolean, skipped: boolean }>}
 */
async function enqueueWebhookUpdate({ projectId, payload, provider, model }) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const waiting = await findQueuedJob(projectId);
        if (!waiting) {
            const { jobId, duplicate } = await enqueueJob({ projectId, eventType: "webhook", triggeredBy: "github", payload, provider, model });
            if (!duplicate) return { jobId, merged: false, skipped: false };
            continue; // Another push queued one first; merge into it.
        }
        if (waiting.event_type !== "webhook") {
            return { jobId: waiting.id, merged: false, skipped: true };
        }

        const files = [...new Set([...(waiting.payload?.files || []), ...payload.files])];
        const { data, error } = await supabase
            .from("build_events")
            .update({ payload: { ...waiting.payload, files } })
            .eq("id", waiting.id)
            .eq("status", "queued") // A worker may have claimed it meanwhile.
            .select("id");
        if (error) throw error;
        if (data.length) return { jobId: waiting.id, merged: true, skipped: false };
    }
    throw new Error("Couldn't queue the docs update: the queue kept changing.");
}

/** A job as members may see it, or null. */
async function getJob(jobId) {
    const { data, error } = await supabase
        .from("build_events")
        .select(PUBLIC_COLUMNS)
        .eq("id", jobId)
        .maybeSingle();
    if (error) {
        // An id that isn't a uuid can't match any job.
        if (error.code === "22P02") return null;
        throw error;
    }
    return data;
}

/**
 * Cancels a job. A waiting job is cancelled at once; a running one is asked to stop and
 * stops at its next step (the page being written is finished first).
 * @returns {Promise<object|null>} The job afterwards, or null if it doesn't exist
 */
async function cancelJob(jobId) {
    const { data: cancelled, error } = await supabase
        .from("build_events")
        .update({
            status: "cancelled",
            cancel_requested: true,
            finished_at: new Date().toISOString(),
            progress: { step: "cancelled", message: "Cancelled before it started" },
        })
        .eq("id", jobId)
        .eq("status", "queued")
        .select("project_id");
    if (error) throw error;

    if (cancelled.length) {
        await settleProjectStatus(cancelled[0].project_id, "cancelled");
    } else {
        const { error: runningError } = await supabase
            .from("build_events")
            .update({ cancel_requested: true })
            .eq("id", jobId)
            .eq("status", "running");
        if (runningError) throw runningError;
    }
    return getJob(jobId);
}

/** Claims the next job that's ready, or returns null. */
async function claimNextJob(workerId = WORKER_ID) {
    const { data, error } = await supabase.rpc("claim_next_job", { p_worker: workerId });
    if (error) throw error;
    return data?.[0] || null;
}

/**
 * Updates a running job this worker holds (progress, heartbeat).
 * @returns {Promise<{ owned: boolean, cancelRequested: boolean }>}
 *   owned is false when the job is no longer this worker's (it was requeued or finished).
 */
async function touchJob(jobId, fields = {}, workerId = WORKER_ID) {
    const { data, error } = await supabase
        .from("build_events")
        .update({ ...fields, heartbeat_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("status", "running")
        .eq("locked_by", workerId)
        .select("cancel_requested");
    if (error) throw error;
    if (!data.length) return { owned: false, cancelRequested: false };
    return { owned: true, cancelRequested: data[0].cancel_requested };
}

// Finishes a job this worker holds. Returns false if it wasn't ours any more.
async function finishJob(job, fields, workerId = WORKER_ID) {
    const { data, error } = await supabase
        .from("build_events")
        .update(fields)
        .eq("id", job.id)
        .eq("status", "running")
        .eq("locked_by", workerId)
        .select("id");
    if (error) throw error;
    return data.length > 0;
}

function usageColumns(usage) {
    return { input_tokens: usage?.inputTokens || 0, output_tokens: usage?.outputTokens || 0 };
}

async function completeJob(job, { filesCount = 0, usage } = {}, workerId = WORKER_ID) {
    const owned = await finishJob(job, {
        status: "successful",
        files_count: filesCount,
        ...usageColumns(usage),
        error_message: null,
        locked_by: null,
        finished_at: new Date().toISOString(),
        progress: { step: "done", message: filesCount === 1 ? "1 page written" : `${filesCount} pages written` },
        payload: scrubPayload(job.payload),
    }, workerId);
    if (owned) await settleProjectStatus(job.project_id, "successful");
    return owned;
}

/**
 * Records a failed attempt. With `retryInSeconds` the job goes back to the queue (if it
 * has attempts left and no newer job is waiting for the project); otherwise it fails.
 * @returns {Promise<"retrying"|"failed"|"lost">}
 */
async function failJob(job, { errorMessage, usage, filesCount = 0, retryInSeconds, code } = {}, workerId = WORKER_ID) {
    const message = truncate(errorMessage);

    if (retryInSeconds != null && job.attempts < job.max_attempts) {
        const runAfter = new Date(Date.now() + retryInSeconds * 1000).toISOString();
        try {
            const owned = await finishJob(job, {
                status: "queued",
                locked_by: null,
                heartbeat_at: null,
                run_after: runAfter,
                error_message: message,
                ...usageColumns(usage),
                progress: { step: "queued", message: `Retrying in ${formatDelay(retryInSeconds)} (attempt ${job.attempts + 1} of ${job.max_attempts})`, retryAt: runAfter },
            }, workerId);
            if (!owned) return "lost";
            await setProjectStatus(job.project_id, "queued");
            return "retrying";
        } catch (error) {
            // 23505: a newer job for this project is already waiting, and it supersedes this one.
            if (error.code !== "23505") throw error;
        }
    }

    const owned = await finishJob(job, {
        status: "failed",
        files_count: filesCount,
        ...usageColumns(usage),
        error_message: message,
        locked_by: null,
        finished_at: new Date().toISOString(),
        progress: { step: "failed", message: "Failed", code: code || null },
        payload: scrubPayload(job.payload),
    }, workerId);
    if (!owned) return "lost";
    await settleProjectStatus(job.project_id, "failed");
    return "failed";
}

async function markCancelled(job, { usage, filesCount = 0 } = {}, workerId = WORKER_ID) {
    const owned = await finishJob(job, {
        status: "cancelled",
        files_count: filesCount,
        ...usageColumns(usage),
        locked_by: null,
        finished_at: new Date().toISOString(),
        progress: { step: "cancelled", message: "Cancelled" },
        payload: scrubPayload(job.payload),
    }, workerId);
    if (owned) await settleProjectStatus(job.project_id, "cancelled");
    return owned;
}

/**
 * Hands a running job back to the queue without counting the attempt (the worker is
 * shutting down). If a newer job is already waiting, the stale-job sweep handles it.
 */
async function releaseJob(job, workerId = WORKER_ID) {
    try {
        await finishJob(job, {
            status: "queued",
            locked_by: null,
            heartbeat_at: null,
            run_after: new Date().toISOString(),
            attempts: Math.max(0, job.attempts - 1),
            progress: { step: "queued", message: "Waiting for a worker (the previous one restarted)" },
        }, workerId);
    } catch (error) {
        if (error.code !== "23505") throw error;
    }
}

/**
 * Sets the project's status after a job ends. Another job that's running or waiting for
 * the project wins; a cancelled run leaves the project as it was (live docs stay live).
 */
async function settleProjectStatus(projectId, outcome) {
    const { data: active } = await supabase
        .from("build_events")
        .select("status")
        .eq("project_id", projectId)
        .in("status", ["running", "queued"]);
    if (active?.some((j) => j.status === "running")) return setProjectStatus(projectId, "running");
    if (active?.length) return setProjectStatus(projectId, "queued");

    if (outcome !== "cancelled") return setProjectStatus(projectId, outcome);

    const { data: project } = await supabase
        .from("projects")
        .select("tenant_name, project_name")
        .eq("id", projectId)
        .maybeSingle();
    const hasDocs = project && fs.existsSync(path.join(DIST_DIR, project.tenant_name, project.project_name));
    return setProjectStatus(projectId, hasDocs ? "successful" : "failed");
}

/** Puts jobs whose worker stopped responding back in the queue (or fails them). */
async function requeueStaleJobs({ staleSeconds, retrySeconds }) {
    const { data, error } = await supabase.rpc("requeue_stale_jobs", {
        p_stale_seconds: staleSeconds,
        p_retry_seconds: retrySeconds,
    });
    if (error) throw error;
    return data || [];
}

// Finished jobs don't need the requester's email any more.
function scrubPayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const { email, ...rest } = payload;
    return rest;
}

function formatDelay(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)} min`;
}

module.exports = {
    WORKER_ID,
    events,
    enqueueJob,
    enqueueWebhookUpdate,
    getJob,
    cancelJob,
    claimNextJob,
    touchJob,
    completeJob,
    failJob,
    markCancelled,
    releaseJob,
    requeueStaleJobs,
    settleProjectStatus,
};
