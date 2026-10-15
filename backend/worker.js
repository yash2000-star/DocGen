// Standalone job worker: `npm run worker`. Runs queued doc generations without serving
// the API. Use it with WORKER_CONCURRENCY=0 on the API server to scale workers separately.
const { config, assertRequiredConfig } = require("./config");

try {
    assertRequiredConfig();
} catch (err) {
    console.error(`\n[Config] ${err.message}\n`);
    process.exit(1);
}

const { createWorker } = require("./jobs/worker");

const worker = createWorker({ ...config.jobs, concurrency: config.jobs.concurrency || 2 }).start();

let stopping = false;
async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`[Worker] ${signal} received: handing running jobs back to the queue.`);
    await worker.stop();
    process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
