import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase, getGithubLogin } from "../lib/auth";
import { createProject } from "../lib/projects";
import Navbar from "../components/dashboard/Navbar";
import { apiFetch } from '../lib/api';
import { JobSteps } from "../components/JobProgress";
import { useJobPolling } from "../lib/jobs";

async function loadJob(jobId) {
  const res = await apiFetch(`/api/jobs/${jobId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).job;
}

// https://github.com/<owner>/<repo>[.git][/] → { owner, repo }, or null.
function parseRepoUrl(url) {
  const match = String(url).trim().match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  return match ? { owner: match[1], repo: match[2] } : null;
}

export default function NewProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState("form"); 
  const [repoUrl, setRepoUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState(null);
  
  const [jobId, setJobId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const { job } = useJobPolling(jobId, loadJob);
  // "checking" | "ready" | "missing" (no provider connected) | "disabled" (server can't store keys)
  const [aiStatus, setAiStatus] = useState("checking");

  // undefined while loading, then the GitHub username or null (signed in with email only).
  const [githubLogin, setGithubLogin] = useState(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setGithubLogin(getGithubLogin(data?.user)));
  }, []);

  // Docs are written with the user's own AI provider, so check one is connected.
  useEffect(() => {
    apiFetch("/api/ai/credentials")
      .then(async (res) => {
        if (res.status === 503) return setAiStatus("disabled");
        const data = await res.json().catch(() => ({}));
        setAiStatus(res.ok && data.credentials?.length > 0 ? "ready" : "missing");
      })
      .catch(() => setAiStatus("ready")); // Backend unreachable: let the submit report it.
  }, []);

  // The docs live at /docs/<owner>/<repo>, so the project name is the repository's name.
  useEffect(() => {
    const passedRepo = searchParams.get("repo");
    if (passedRepo) {
      setRepoUrl(passedRepo);
      setProjectName(parseRepoUrl(passedRepo)?.repo || "");
    }
  }, [searchParams]);

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setRepoUrl(url);
    setProjectName(parseRepoUrl(url)?.repo || "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      setError("Enter a GitHub repository URL like https://github.com/<owner>/<repo>.");
      return;
    }

    // Docs for github.com/<owner>/<repo> can only be created by <owner>.
    const { data: { user } } = await supabase.auth.getUser();
    if (!githubLogin) {
      setError("Sign in with GitHub to import your repositories. DocGen publishes docs under your GitHub username, so it needs to know it.");
      return;
    }
    if (parsed.owner.toLowerCase() !== githubLogin.toLowerCase()) {
      setError(`You can only import repositories under your GitHub account (${githubLogin}). Organization repositories aren't supported yet.`);
      return;
    }
    const tenantName = githubLogin;

    // --- BULLETPROOF PRE-FLIGHT CHECK ---
    // Using .limit(1) prevents crashes if duplicates accidentally exist
    const { data: existingProjects, error: searchError } = await supabase
      .from('projects')
      .select('id, user_id, status')
      .eq('tenant_name', tenantName)
      .eq('project_name', projectName)
      .limit(1); 

    if (existingProjects && existingProjects.length > 0) {
      const existingProject = existingProjects[0];

      if (existingProject.user_id === user.id) {
          // Scenario A: You own it. Go directly to dashboard.
          navigate(`/dashboard/${existingProject.id}`);
          return;
      } else if (existingProject.user_id === null) {
          // Scenario B: It's an orphan. Claim it, then go to dashboard.
          await supabase.from('projects').update({ user_id: user.id }).eq('id', existingProject.id);
          navigate(`/dashboard/${existingProject.id}`);
          return;
      }
    }

    // --- Scenario C: BRAND NEW PROJECT FLOW ---
    const { data: project, error: dbErr } = await createProject({
      repo_url: repoUrl,
      project_name: projectName,
      tenant_name: tenantName,
      status: "queued"
    });

    if (dbErr) {
      setError(dbErr.message);
      return;
    }

    setProjectId(project.id);
    setStep("generating");

    // The server queues the run and answers at once; a worker writes the docs and
    // reports progress on the job, which this page polls.
    apiFetch(`/api/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl, projectName, tenantName })
    })
    .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (data.jobId && (res.ok || data.code === "already_queued")) return setJobId(data.jobId);
        if (data.code === "ai_not_connected") setAiStatus("missing");
        throw new Error(data.error || `Generation failed (HTTP ${res.status}).`);
    })
    .catch(async err => {
      // TypeError means fetch itself failed (backend down or unreachable).
      setError(err instanceof TypeError
        ? "Server connection failed or timed out. Is the backend running?"
        : err.message);
      setStep("form");
      // Don't leave the project stuck waiting if the backend rejected the request.
      await supabase.from('projects').update({ status: 'failed' }).eq('id', project.id);
    });
  };

  // What to show is derived from the job once it finishes.
  const view = step === "generating" && job?.status === "successful" ? "done"
    : step === "generating" && job?.status === "failed" ? "failed"
    : step === "generating" && job?.status === "cancelled" ? "cancelled"
    : step;
  const shownError = view === "failed"
    ? job.error_message || "Generation failed. See the project's activity feed for details."
    : error;

  const handleCancel = async () => {
    setCancelling(true);
    const res = await apiFetch(`/api/jobs/${jobId}/cancel`, { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => ({}));
      setError(data?.error || "Couldn't cancel the generation.");
      setCancelling(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "600px", margin: "60px auto", padding: "0 20px" }}>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "40px", fontSize: "14px", fontWeight: "500", color: "var(--text-muted)" }}>
          <span style={{ color: step === "form" ? "var(--primary-brand)" : "var(--text-main)" }}>1. Repository</span>
          <span style={{ color: "var(--border-color)" }}>──────────</span>
          <span style={{ color: view === "generating" ? "var(--primary-brand)" : (view === "done" ? "var(--text-main)" : "var(--text-muted)") }}>2. Generating</span>
          <span style={{ color: "var(--border-color)" }}>──────────</span>
          <span style={{ color: view === "done" ? "var(--primary-brand)" : "var(--text-muted)" }}>3. Done</span>
        </div>

        <div style={{ backgroundColor: "var(--bg-main)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "40px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          
          {shownError && (
            <div data-testid="new-project-error" style={{ marginBottom: "24px", padding: "12px", backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: "8px", fontSize: "14px", border: "1px solid #fecaca" }}>
              {shownError}
            </div>
          )}

          {step === "form" && (aiStatus === "missing" || aiStatus === "disabled") && (
            <div data-testid="ai-provider-notice" style={{ marginBottom: "24px", padding: "14px 16px", backgroundColor: "#eff6ff", color: "#1e3a8a", borderRadius: "8px", fontSize: "14px", border: "1px solid #bfdbfe" }}>
              {aiStatus === "missing" ? (
                <>
                  <strong>Connect your AI provider first.</strong> DocGen writes your docs with your own AI account (Claude, OpenAI, Gemini, OpenRouter or a self-hosted model).{" "}
                  <Link to="/settings/ai" style={{ color: "#1d4ed8", fontWeight: 600 }}>Connect a provider →</Link>
                </>
              ) : (
                <>Doc generation isn't enabled on this server yet. The administrator needs to set <code>AI_KEY_ENCRYPTION_KEY</code>.</>
              )}
            </div>
          )}

          {step === "form" && githubLogin === null && (
            <div data-testid="github-notice" style={{ marginBottom: "24px", padding: "14px 16px", backgroundColor: "#eff6ff", color: "#1e3a8a", borderRadius: "8px", fontSize: "14px", border: "1px solid #bfdbfe" }}>
              <strong>Sign in with GitHub to import repositories.</strong> Docs are published at /docs/&lt;owner&gt;/&lt;repo&gt;, so DocGen only lets the repository's owner create them.
            </div>
          )}

          {step === "form" && (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", color: "var(--text-heading)", margin: "0 0 8px 0" }}>Import Repository</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "15px", marginBottom: "24px" }}>Connect a GitHub repository to generate documentation.</p>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "var(--text-heading)" }}>GitHub Repository URL</label>
                <input type="url" placeholder="https://github.com/username/repo" value={repoUrl} onChange={handleUrlChange} required style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", fontSize: "15px", outline: "none" }} />
              </div>

              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "var(--text-heading)" }}>Project Name</label>
                <input type="text" value={projectName} readOnly placeholder="Taken from the repository URL" style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", color: "var(--text-muted)", fontSize: "15px", outline: "none" }} />
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => navigate("/dashboard")} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-main)", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={aiStatus !== "ready" || !githubLogin} style={{ padding: "10px 16px", backgroundColor: "var(--primary-brand)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: "500", cursor: aiStatus === "ready" && githubLogin ? "pointer" : "not-allowed", opacity: aiStatus === "ready" && githubLogin ? 1 : 0.5 }}>Generate Docs</button>
              </div>
            </form>
          )}

          {view === "generating" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid #f3f3f3", borderTop: "3px solid var(--primary-brand)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <h2 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 8px 0", color: "var(--text-heading)" }}>Creating your docs</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 32px 0" }}>This usually takes a few minutes. You can leave this page; the run continues and shows in the project's activity feed.</p>

              <JobSteps job={job} />

              <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
                <button type="button" onClick={() => navigate(`/dashboard/${projectId}`)} style={{ padding: "8px 14px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-main)", fontSize: "13px", fontWeight: "500", cursor: "pointer" }}>Go to project</button>
                {jobId && job?.status !== "successful" && (
                  <button type="button" data-testid="cancel-job" onClick={handleCancel} disabled={cancelling || job?.cancel_requested} style={{ padding: "8px 14px", background: "none", border: "1px solid #fecaca", borderRadius: "8px", color: "#dc2626", fontSize: "13px", fontWeight: "500", cursor: cancelling ? "default" : "pointer", opacity: cancelling || job?.cancel_requested ? 0.6 : 1 }}>
                    {cancelling || job?.cancel_requested ? "Cancelling…" : "Cancel"}
                  </button>
                )}
              </div>
            </div>
          )}

          {view === "cancelled" && (
            <div data-testid="job-cancelled" style={{ textAlign: "center", padding: "10px 0" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", margin: "0 0 8px 0" }}>Generation cancelled</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "0 0 24px 0" }}>No pages were published from this run.</p>
              <button onClick={() => navigate(`/dashboard/${projectId}`)} style={{ padding: "10px 20px", backgroundColor: "var(--primary-brand)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                Go to project
              </button>
            </div>
          )}

          {view === "failed" && (
            <div style={{ textAlign: "center" }}>
              <button onClick={() => navigate(`/dashboard/${projectId}`)} style={{ padding: "10px 20px", backgroundColor: "var(--primary-brand)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                Go to project
              </button>
            </div>
          )}

          {view === "done" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: "64px", height: "64px", backgroundColor: "#ecfdf5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#059669" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>Generation Complete!</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "15px", marginBottom: "32px" }}>Your documentation is ready to view.</p>
              
              <button onClick={() => navigate(`/dashboard/${projectId}`)} style={{ padding: "12px 24px", backgroundColor: "var(--primary-brand)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer" }}>
                Go to Project Home
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}