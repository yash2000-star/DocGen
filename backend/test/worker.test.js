const test = require("node:test");
const assert = require("node:assert/strict");

// The queue module creates a Supabase client on load; these tests replace its functions.
process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";

const queue = require("../jobs/queue");
const { createWorker, classifyFailure, retryDelaySeconds } = require("../jobs/worker");
const { LLMError } = require("../ai/errors");
const { PipelineError, CancelledError, filterChangedFiles } = require("../services/generationPipeline");

const quiet = { log() {}, warn() {}, error() {} };

test("classifyFailure retries temporary problems and fails the rest at once", () => {
    assert.equal(classifyFailure(new LLMError("rate_limited")).retry, true);
    assert.equal(classifyFailure(new LLMError("provider_unavailable")).retry, true);
    assert.equal(classifyFailure(new LLMError("network")).retry, true);

    const invalid = classifyFailure(new LLMError("invalid_key", { providerMessage: "bad key" }));
    assert.equal(invalid.retry, false);
    assert.equal(invalid.code, "invalid_key");
    assert.match(invalid.message, /rejected.*\(bad key\)/);

    assert.equal(classifyFailure(new LLMError("not_configured")).code, "ai_not_connected");
    assert.equal(classifyFailure(new PipelineError("No code", 404)).retry, false);
    assert.equal(classifyFailure(new PipelineError("No code", 404)).code, "invalid_input");
    assert.equal(classifyFailure(new PipelineError("Writer produced nothing", 502)).retry, true);
    assert.equal(classifyFailure(new Error("socket hang up")).retry, true);

    const credential = Object.assign(new Error("Can't decrypt"), { name: "CredentialError", status: 409, code: "key_unreadable" });
    assert.equal(classifyFailure(credential).retry, false);
});

test("retryDelaySeconds doubles each attempt and is capped", () => {
    assert.equal(retryDelaySeconds(1, 30), 30);
    assert.equal(retryDelaySeconds(2, 30), 60);
    assert.equal(retryDelaySeconds(3, 30), 120);
    assert.equal(retryDelaySeconds(20, 30), 900);
});

test("filterChangedFiles keeps plain relative paths to supported source files", () => {
    assert.deepEqual(
        filterChangedFiles(["src/a.js", "src/a.js", "README.md", "../etc/passwd.js", "/abs/x.ts", "lib/b.py", 42, "a/../../c.go"]),
        ["src/a.js", "lib/b.py"]
    );
});

// Replaces queue functions for one test and records what the worker did.
function stubQueue(jobs, overrides = {}) {
    const calls = { completed: [], failed: [], cancelled: [], released: [], touched: [] };
    const pending = [...jobs];
    const original = {};
    const stubs = {
        claimNextJob: async () => pending.shift() || null,
        touchJob: async (id, fields) => {
            calls.touched.push({ id, fields });
            return { owned: true, cancelRequested: false };
        },
        completeJob: async (job, result) => { calls.completed.push({ job, result }); return true; },
        failJob: async (job, failure) => { calls.failed.push({ job, failure }); return failure.retryInSeconds != null ? "retrying" : "failed"; },
        markCancelled: async (job) => { calls.cancelled.push(job); return true; },
        releaseJob: async (job) => { calls.released.push(job); },
        requeueStaleJobs: async () => [],
        ...overrides,
    };
    for (const [name, fn] of Object.entries(stubs)) {
        original[name] = queue[name];
        queue[name] = fn;
    }
    return { calls, pending, restore: () => Object.assign(queue, original) };
}

function job(id, extra = {}) {
    return { id, project_id: "p1", event_type: "generation", attempts: 1, max_attempts: 3, cancel_requested: false, payload: {}, ...extra };
}

async function waitFor(condition, timeoutMs = 2000) {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting");
        await new Promise((r) => setTimeout(r, 5));
    }
}

test("the worker runs jobs, reports progress and records results", async (t) => {
    const { calls, restore } = stubQueue([job("j1")]);
    t.after(restore);

    const worker = createWorker({
        concurrency: 1, pollMs: 10, log: quiet,
        handlers: {
            generation: async (j, ctx) => {
                await ctx.reportProgress({ step: "writing", pagesDone: 1, pagesTotal: 2 });
                return { filesCount: 2, usage: { inputTokens: 5, outputTokens: 7 } };
            },
        },
    }).start();
    t.after(() => worker.stop());

    await waitFor(() => calls.completed.length === 1);
    assert.deepEqual(calls.completed[0].result, { filesCount: 2, usage: { inputTokens: 5, outputTokens: 7 } });
    assert.deepEqual(calls.touched[0].fields, { progress: { step: "writing", pagesDone: 1, pagesTotal: 2 } });
});

test("the worker runs at most `concurrency` jobs at once", async (t) => {
    const { calls, restore } = stubQueue([job("a", { project_id: "p1" }), job("b", { project_id: "p2" }), job("c", { project_id: "p3" })]);
    t.after(restore);

    let running = 0;
    let maxRunning = 0;
    const worker = createWorker({
        concurrency: 2, pollMs: 10, log: quiet,
        handlers: {
            generation: async () => {
                running++;
                maxRunning = Math.max(maxRunning, running);
                await new Promise((r) => setTimeout(r, 40));
                running--;
                return { filesCount: 1 };
            },
        },
    }).start();
    t.after(() => worker.stop());

    await waitFor(() => calls.completed.length === 3);
    assert.equal(maxRunning, 2);
});

test("temporary failures are retried with backoff; permanent ones are not", async (t) => {
    const { calls, restore } = stubQueue([job("temp", { attempts: 2 }), job("perm", { project_id: "p2" })]);
    t.after(restore);

    const worker = createWorker({
        concurrency: 1, pollMs: 10, retryBaseSeconds: 10, log: quiet,
        handlers: {
            generation: async (j) => {
                if (j.id === "temp") throw Object.assign(new LLMError("provider_unavailable"), { usage: { inputTokens: 3, outputTokens: 0 } });
                throw new LLMError("quota_exceeded");
            },
        },
    }).start();
    t.after(() => worker.stop());

    await waitFor(() => calls.failed.length === 2);
    const temp = calls.failed.find((f) => f.job.id === "temp").failure;
    assert.equal(temp.retryInSeconds, 20); // second attempt: 10 * 2
    assert.deepEqual(temp.usage, { inputTokens: 3, outputTokens: 0 });
    assert.equal(calls.failed.find((f) => f.job.id === "perm").failure.retryInSeconds, undefined);
});

test("a cancel request reaches the handler, which stops", async (t) => {
    let cancelled = false;
    const { calls, restore } = stubQueue([job("j1")], {
        touchJob: async () => ({ owned: true, cancelRequested: cancelled }),
    });
    t.after(restore);

    const worker = createWorker({
        concurrency: 1, pollMs: 10, heartbeatSeconds: 0.01, log: quiet,
        handlers: {
            generation: async (j, ctx) => {
                cancelled = true;
                await new Promise((r) => setTimeout(r, 50)); // a heartbeat brings the request in
                if (await ctx.shouldCancel()) throw new CancelledError();
                return { filesCount: 1 };
            },
        },
    }).start();
    t.after(() => worker.stop());

    await waitFor(() => calls.cancelled.length === 1);
    assert.equal(calls.completed.length, 0);
});

test("a job taken over by another worker is dropped, not overwritten", async (t) => {
    const { calls, restore } = stubQueue([job("j1")], {
        touchJob: async () => ({ owned: false, cancelRequested: false }),
    });
    t.after(restore);

    let stoppedEarly = false;
    const worker = createWorker({
        concurrency: 1, pollMs: 10, log: quiet,
        handlers: {
            generation: async (j, ctx) => {
                await ctx.reportProgress({ step: "writing" });
                stoppedEarly = await ctx.shouldCancel();
                return { filesCount: 1 };
            },
        },
    }).start();

    await waitFor(() => stoppedEarly);
    await new Promise((r) => setTimeout(r, 30));
    await worker.stop();
    assert.equal(calls.completed.length, 0);
    assert.equal(calls.failed.length, 0);
});

test("stop() hands running jobs back to the queue", async (t) => {
    const { calls, restore } = stubQueue([job("j1")]);
    t.after(restore);

    let started = false;
    const worker = createWorker({
        concurrency: 1, pollMs: 10, log: quiet,
        handlers: { generation: () => { started = true; return new Promise(() => {}); } },
    }).start();

    await waitFor(() => started);
    await worker.stop();
    assert.deepEqual(calls.released.map((j) => j.id), ["j1"]);
});
