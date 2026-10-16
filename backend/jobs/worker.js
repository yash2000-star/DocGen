// Runs queued jobs: claims up to `concurrency` at a time, sends heartbeats while they run,
// retries temporary failures with backoff, and recovers jobs whose worker died.
//
// It runs inside the API server by default (backend/server.js). Set WORKER_CONCURRENCY=0
// there and run `npm run worker` to run workers as separate processes instead; any number
// of workers can share the queue.
const queue = require("./queue");
const defaultHandlers = require("./handlers");
const { describeAiError } = require("../ai/httpErrors");
const { LLMError } = require("../ai/errors");
const { PipelineError } = require("../services/generationPipeline");

const MAX_RETRY_DELAY_SECONDS = 15 * 60;

/**
 * Decides whether a failed attempt is worth retrying, and what to tell the user.
 * Problems the user has to fix (a rejected key, no credit, a repo with no code) fail at once;
 * temporary ones (rate limits, provider outages, network, crashes) are retried.
 * @returns {{ retry: boolean, message: string, code: string }}
 */
function classifyFailure(error) {
    const ai = describeAiError(error);
    if (error instanceof LLMError) {
        const message = ai.providerMessage ? `${ai.message} (${ai.providerMessage})` : ai.message;
        return { retry: error.retryable, message, code: ai.code };
    }
    if (ai) {
        // Credential errors: only a storage hiccup is temporary.
        return { retry: ai.status >= 500 && ai.code === "storage_error", message: ai.message, code: ai.code };
    }
    if (error instanceof PipelineError) {
        return { retry: error.statusCode >= 500, message: error.message, code: error.statusCode >= 500 ? "pipeline_error" : "invalid_input" };
    }
    return { retry: true, message: error?.message || "The job failed unexpectedly.", code: "internal_error" };
}

// 30s, 60s, 120s... (with retryBaseSeconds = 30), capped at 15 minutes.
function retryDelaySeconds(attempt, baseSeconds) {
    return Math.min(baseSeconds * 2 ** Math.max(0, attempt - 1), MAX_RETRY_DELAY_SECONDS);
}

/**
 * @param {object} options
 * @param {number} options.concurrency - Jobs run at once by this worker
 * @param {number} [options.pollMs] - How often to look for work when idle
 * @param {number} [options.heartbeatSeconds]
 * @param {number} [options.staleSeconds] - A running job with no heartbeat for this long is recovered
 * @param {number} [options.retryBaseSeconds] - First retry delay; doubles each attempt
 * @param {object} [options.handlers] - { [event_type]: async (job, ctx) => ({ filesCount, usage }) }
 */
function createWorker({
    concurrency,
    pollMs = 2000,
    heartbeatSeconds = 15,
    staleSeconds = 120,
    retryBaseSeconds = 30,
    handlers = defaultHandlers,
    log = console,
} = {}) {
    const active = new Map(); // job id → { job, heartbeat }
    let stopped = true;
    let polling = false;
    let pollAgain = false;
    let pollTimer = null;
    let sweepTimer = null;

    function schedulePoll(ms) {
        clearTimeout(pollTimer);
        if (!stopped) pollTimer = setTimeout(poll, ms);
    }

    async function poll() {
        if (stopped) return;
        if (polling) {
            pollAgain = true;
            return;
        }
        polling = true;
        pollAgain = false;
        try {
            while (!stopped && active.size < concurrency) {
                const job = await queue.claimNextJob();
                if (!job) break;
                const entry = { job, heartbeat: null };
                active.set(job.id, entry);
                runJob(entry).finally(() => {
                    active.delete(job.id);
                    schedulePoll(0);
                });
            }
        } catch (error) {
            log.error("[Worker] Couldn't claim a job:", error.message);
        } finally {
            polling = false;
            schedulePoll(pollAgain ? 0 : pollMs);
        }
    }

    async function runJob(entry) {
        const { job } = entry;
        const label = `${job.event_type} ${job.id} (attempt ${job.attempts}/${job.max_attempts})`;
        log.log(`[Worker] Started ${label}`);

        let cancelRequested = job.cancel_requested;
        let lost = false;
        const track = ({ owned, cancelRequested: cancel }) => {
            if (!owned) lost = true;
            if (cancel) cancelRequested = true;
        };
        const touch = async (fields) => {
            try {
                track(await queue.touchJob(job.id, fields));
            } catch (error) {
                log.error(`[Worker] Couldn't update job ${job.id}:`, error.message);
            }
        };

        const ctx = {
            reportProgress: (progress) => touch({ progress }),
            update: (fields) => touch(fields),
            shouldCancel: async () => cancelRequested || lost,
        };
        entry.heartbeat = setInterval(() => touch(), heartbeatSeconds * 1000);

        try {
            const handler = handlers[job.event_type];
            if (!handler) throw new PipelineError(`Unknown job type: ${job.event_type}`, 400);

            const result = await handler(job, ctx);
            if (lost) return log.warn(`[Worker] ${label} finished, but another worker had taken it over. Result dropped.`);
            await queue.completeJob(job, result);
            log.log(`[Worker] Finished ${label}: ${result.filesCount} pages`);
        } catch (error) {
            if (lost) return log.warn(`[Worker] Stopped ${label}: another worker took it over.`);

            if (error?.name === "CancelledError") {
                await queue.markCancelled(job, { usage: error.usage, filesCount: error.generatedCount });
                return log.log(`[Worker] Cancelled ${label}`);
            }

            const failure = classifyFailure(error);
            const outcome = await queue.failJob(job, {
                errorMessage: failure.message,
                usage: error?.usage,
                filesCount: error?.generatedCount,
                code: failure.code,
                retryInSeconds: failure.retry ? retryDelaySeconds(job.attempts, retryBaseSeconds) : undefined,
            });
            log.error(`[Worker] ${label} ${outcome === "retrying" ? "failed, will retry" : outcome}: ${failure.code}: ${failure.message}`);
            if (failure.code === "internal_error") log.error(error);
        } finally {
            clearInterval(entry.heartbeat);
        }
    }

    async function sweep() {
        try {
            const recovered = await queue.requeueStaleJobs({ staleSeconds, retrySeconds: retryBaseSeconds });
            if (recovered.length) {
                log.warn(`[Worker] Recovered ${recovered.length} job(s) whose worker stopped responding.`);
                schedulePoll(0);
            }
        } catch (error) {
            log.error("[Worker] Couldn't check for stalled jobs:", error.message);
        }
    }

    const nudge = () => schedulePoll(0);

    return {
        start() {
            if (!stopped || concurrency <= 0) return this;
            stopped = false;
            queue.events.on("enqueued", nudge);
            sweep();
            sweepTimer = setInterval(sweep, Math.max(5, Math.floor(staleSeconds / 4)) * 1000);
            schedulePoll(0);
            log.log(`[Worker] ${queue.WORKER_ID} running up to ${concurrency} job(s) at a time.`);
            return this;
        },

        /**
         * Stops claiming work and hands running jobs back to the queue, so another worker
         * (or this server after a restart) starts them again without waiting for them to
         * go stale. The work in progress is abandoned.
         */
        async stop() {
            if (stopped) return;
            stopped = true;
            clearTimeout(pollTimer);
            clearInterval(sweepTimer);
            queue.events.off("enqueued", nudge);
            await Promise.all([...active.values()].map(({ job, heartbeat }) => {
                clearInterval(heartbeat);
                return queue.releaseJob(job).catch((error) => log.error(`[Worker] Couldn't release job ${job.id}:`, error.message));
            }));
        },

        get activeCount() {
            return active.size;
        },
    };
}

module.exports = { createWorker, classifyFailure, retryDelaySeconds };
