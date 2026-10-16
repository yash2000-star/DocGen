// Page history and AI suggestions (table public.page_revisions).
//
// The docs files are the source of truth; this records every version of a page so it can
// be viewed and restored. A page whose latest revision was written by a person ("editor"
// or "restore") is edited by hand: AI runs don't overwrite it, they leave a suggestion.
const supabase = require("../lib/supabase");

const HUMAN_SOURCES = new Set(["editor", "restore"]);
const KEEP_PER_PAGE = 50; // newest revisions kept per page
const SUMMARY = "id, route, kind, source, deleted, author_id, job_id, message, created_at";

async function projectIdFor(tenantName, projectName) {
    const { data, error } = await supabase.from("projects").select("id")
        .eq("tenant_name", tenantName).eq("project_name", projectName).maybeSingle();
    if (error) throw error;
    return data?.id || null;
}

/** Every revision of the project's pages (no content), newest first. */
async function revisionSummaries(projectId) {
    const { data, error } = await supabase.from("page_revisions").select(SUMMARY)
        .eq("project_id", projectId).eq("kind", "revision")
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .limit(20000);
    if (error) throw error;
    return data || [];
}

/**
 * The state of each page with history: route → { handEdited, deletedByHand, latest }.
 * @param {object[]} summaries - From revisionSummaries (newest first)
 */
function pageStates(summaries) {
    const states = new Map();
    for (const revision of summaries) {
        if (states.has(revision.route)) continue;
        const human = HUMAN_SOURCES.has(revision.source);
        states.set(revision.route, { handEdited: human && !revision.deleted, deletedByHand: human && revision.deleted, latest: revision });
    }
    return states;
}

/** Ids of revisions beyond the newest KEEP_PER_PAGE of each page. */
function revisionsToPrune(summaries, keep = KEEP_PER_PAGE) {
    const counts = new Map();
    const prune = [];
    for (const revision of summaries) {
        const count = (counts.get(revision.route) || 0) + 1;
        counts.set(revision.route, count);
        if (count > keep) prune.push(revision.id);
    }
    return prune;
}

async function pruneHistory(projectId) {
    const ids = revisionsToPrune(await revisionSummaries(projectId));
    for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase.from("page_revisions").delete().in("id", ids.slice(i, i + 200));
        if (error) throw error;
    }
}

/**
 * Records revisions (and suggestions) in one insert.
 * @param {string} projectId
 * @param {{ route: string, source: string, content: string, kind?: string, deleted?: boolean, authorId?: string, jobId?: string, message?: string }[]} rows
 */
async function recordRevisions(projectId, rows) {
    if (!rows.length) return [];
    const { data, error } = await supabase.from("page_revisions").insert(rows.map((row) => ({
        project_id: projectId,
        route: row.route,
        kind: row.kind || "revision",
        source: row.source,
        content: row.content,
        deleted: Boolean(row.deleted),
        author_id: row.authorId || null,
        job_id: row.jobId || null,
        message: row.message ? String(row.message).slice(0, 300) : null,
    }))).select(SUMMARY);
    if (error) throw error;
    return data;
}

/** History of one page (no content), newest first. */
async function pageHistory(projectId, route) {
    const { data, error } = await supabase.from("page_revisions").select(SUMMARY)
        .eq("project_id", projectId).eq("route", route).eq("kind", "revision")
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .limit(KEEP_PER_PAGE);
    if (error) throw error;
    return data || [];
}

async function getRevision(projectId, id) {
    if (!/^\d{1,18}$/.test(String(id))) return null;
    const { data, error } = await supabase.from("page_revisions").select(`${SUMMARY}, content`)
        .eq("project_id", projectId).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
}

/** The waiting AI suggestion for a page, with content, or null. */
async function latestSuggestion(projectId, route) {
    const { data, error } = await supabase.from("page_revisions").select(`${SUMMARY}, content`)
        .eq("project_id", projectId).eq("route", route).eq("kind", "suggestion")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
    if (error) throw error;
    return data?.[0] || null;
}

/** Routes with a waiting suggestion. */
async function suggestedRoutes(projectId) {
    const { data, error } = await supabase.from("page_revisions").select("route")
        .eq("project_id", projectId).eq("kind", "suggestion").limit(5000);
    if (error) throw error;
    return [...new Set((data || []).map((row) => row.route))];
}

async function clearSuggestions(projectId, route) {
    const { error } = await supabase.from("page_revisions").delete()
        .eq("project_id", projectId).eq("route", route).eq("kind", "suggestion");
    if (error) throw error;
}

module.exports = {
    HUMAN_SOURCES,
    KEEP_PER_PAGE,
    projectIdFor,
    revisionSummaries,
    pageStates,
    revisionsToPrune,
    pruneHistory,
    recordRevisions,
    pageHistory,
    getRevision,
    latestSuggestion,
    suggestedRoutes,
    clearSuggestions,
};
