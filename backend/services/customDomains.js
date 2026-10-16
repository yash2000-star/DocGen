// Custom domains for docs sites (docs.example.com). A domain only serves a site after its
// owner proves control of it with a DNS TXT record:
//   _docgen-verify.docs.example.com  TXT  "docgen-verify=<token>"
// so nobody can claim someone else's domain, and the first project to verify gets it.
const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");
const supabase = require("../lib/supabase");

const TXT_PREFIX = "_docgen-verify";
const HOSTNAME = /^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;

class DomainError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/** "https://Docs.Example.com/path" → "docs.example.com", or throws DomainError. */
function normalizeDomain(input, { appHostnames = [] } = {}) {
    let value = String(input || "").trim().toLowerCase();
    value = value.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
    if (!value || net.isIP(value) || !HOSTNAME.test(value)) {
        throw new DomainError(400, "Enter a domain name like docs.example.com.");
    }
    if (appHostnames.includes(value) || value === "localhost") {
        throw new DomainError(400, "That's this app's own domain.");
    }
    return value;
}

function verificationRecord(domain, token) {
    return { name: `${TXT_PREFIX}.${domain}`, value: `docgen-verify=${token}` };
}

function status(project) {
    if (!project?.custom_domain) return { domain: null };
    return {
        domain: project.custom_domain,
        verified: Boolean(project.custom_domain_verified_at),
        verifiedAt: project.custom_domain_verified_at,
        record: project.custom_domain_token ? verificationRecord(project.custom_domain, project.custom_domain_token) : null,
    };
}

async function getProject(projectId) {
    const { data, error } = await supabase
        .from("projects")
        .select("id, custom_domain, custom_domain_token, custom_domain_verified_at")
        .eq("id", projectId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** Sets (or replaces) the project's domain; it starts unverified with a fresh token. */
async function setDomain(projectId, input, { appHostnames }) {
    const domain = normalizeDomain(input, { appHostnames });
    const { data: taken } = await supabase
        .from("projects")
        .select("id")
        .ilike("custom_domain", domain)
        .not("custom_domain_verified_at", "is", null)
        .neq("id", projectId)
        .limit(1);
    if (taken?.length) throw new DomainError(409, "That domain is already verified by another docs site.");

    const token = crypto.randomBytes(16).toString("hex");
    const { data, error } = await supabase
        .from("projects")
        .update({ custom_domain: domain, custom_domain_token: token, custom_domain_verified_at: null })
        .eq("id", projectId)
        .select("id, custom_domain, custom_domain_token, custom_domain_verified_at")
        .single();
    if (error) throw error;
    clearCache();
    return status(data);
}

async function removeDomain(projectId) {
    const { error } = await supabase
        .from("projects")
        .update({ custom_domain: null, custom_domain_token: null, custom_domain_verified_at: null })
        .eq("id", projectId);
    if (error) throw error;
    clearCache();
    return { domain: null };
}

/**
 * Looks up the TXT record and marks the domain verified if it matches.
 * @param {Function} [resolveTxt] - Injectable for tests
 */
async function verifyDomain(projectId, { resolveTxt = (name) => dns.resolveTxt(name) } = {}) {
    const project = await getProject(projectId);
    if (!project?.custom_domain || !project.custom_domain_token) throw new DomainError(400, "Add a domain first.");
    if (project.custom_domain_verified_at) return status(project);

    const record = verificationRecord(project.custom_domain, project.custom_domain_token);
    let records = [];
    try {
        records = (await resolveTxt(record.name)).map((chunks) => chunks.join(""));
    } catch {
        records = [];
    }
    if (!records.includes(record.value)) {
        throw new DomainError(422, `The TXT record wasn't found yet. Add ${record.name} with the value ${record.value}. DNS changes can take a few minutes.`);
    }

    const { data, error } = await supabase
        .from("projects")
        .update({ custom_domain_verified_at: new Date().toISOString() })
        .eq("id", projectId)
        .select("id, custom_domain, custom_domain_token, custom_domain_verified_at")
        .single();
    if (error) {
        // 23505: another project verified the same domain first.
        if (error.code === "23505") throw new DomainError(409, "That domain is already verified by another docs site.");
        throw error;
    }
    clearCache();
    return status(data);
}

// host → { tenant, project } | null, for routing requests. Cached briefly.
const cache = new Map();
const CACHE_MS = 60 * 1000;
function clearCache() {
    cache.clear();
}

/** The site a verified custom domain serves, or null. */
async function findVerifiedDomain(host) {
    const key = String(host || "").toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.site;
    const { data, error } = await supabase
        .from("projects")
        .select("tenant_name, project_name")
        .ilike("custom_domain", key)
        .not("custom_domain_verified_at", "is", null)
        .limit(1);
    if (error) throw error;
    const site = data?.[0] ? { tenant: data[0].tenant_name, project: data[0].project_name } : null;
    if (cache.size > 5000) cache.clear();
    cache.set(key, { at: Date.now(), site });
    return site;
}

module.exports = { normalizeDomain, verificationRecord, setDomain, removeDomain, verifyDomain, findVerifiedDomain, getProject, status, DomainError, clearCache };
