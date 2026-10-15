// Records each generation run in build_events, which the project's activity feed shows:
// what triggered it, which provider and model, how many tokens, and why it failed.
const supabase = require("../lib/supabase");

/**
 * Starts a run. Never throws: a logging failure must not stop doc generation.
 * @returns {Promise<string|null>} The run id, or null if it couldn't be recorded
 */
async function startRun({ tenantName, projectName, eventType, triggeredBy, provider, model }) {
    try {
        const { data: project } = await supabase
            .from("projects")
            .select("id")
            .eq("tenant_name", tenantName)
            .eq("project_name", projectName)
            .maybeSingle();
        if (!project) return null;

        const { data, error } = await supabase
            .from("build_events")
            .insert({ project_id: project.id, event_type: eventType, status: "running", triggered_by: triggeredBy, provider, model })
            .select("id")
            .single();
        if (error) throw error;
        return data.id;
    } catch (error) {
        console.error("[Runs] Couldn't record the start of a run:", error.message);
        return null;
    }
}

/**
 * Finishes a run with its outcome and token usage. Never throws.
 * @param {string|null} runId
 * @param {object} outcome
 * @param {"successful"|"failed"} outcome.status
 */
async function finishRun(runId, { status, filesCount = 0, usage, errorMessage } = {}) {
    if (!runId) return;
    try {
        const { error } = await supabase
            .from("build_events")
            .update({
                status,
                files_count: filesCount,
                input_tokens: usage?.inputTokens || 0,
                output_tokens: usage?.outputTokens || 0,
                error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
                finished_at: new Date().toISOString(),
            })
            .eq("id", runId);
        if (error) throw error;
    } catch (error) {
        console.error("[Runs] Couldn't record the end of a run:", error.message);
    }
}

module.exports = { startRun, finishRun };
