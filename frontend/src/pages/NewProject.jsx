import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/auth";
import { createProject } from "../lib/projects";
import Navbar from "../components/dashboard/Navbar";
import { apiFetch } from '../lib/api';

export default function NewProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState("form"); 
  const [repoUrl, setRepoUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState(null);
  
  const [currentProgressStep, setCurrentProgressStep] = useState(0);
  // "checking" | "ready" | "missing" (no provider connected) | "disabled" (server can't store keys)
  const [aiStatus, setAiStatus] = useState("checking");

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

  const progressSteps = [
    "Cloning repository...",
    "Analyzing code architecture...",
    "Generating AI documentation...",
    "Compiling static site..."
  ];

  useEffect(() => {
    const passedRepo = searchParams.get("repo");
    if (passedRepo) {
      setRepoUrl(passedRepo);
      const parts = passedRepo.split("/");
      const extracted = parts[parts.length - 1];
      if (extracted) setProjectName(extracted.replace(".git", ""));
    }
  }, [searchParams]);

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setRepoUrl(url);
    const parts = url.split("/");
    const extracted = parts[parts.length - 1];
    if (extracted) setProjectName(extracted.replace(".git", ""));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!repoUrl || !projectName) {
      setError("Please fill in all fields");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const tenantName = user.user_metadata?.user_name || user.email.split("@")[0];

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
      status: "running" 
    });

    if (dbErr) {
      setError(dbErr.message);
      return;
    }

    setProjectId(project.id);
    setStep("generating");

    apiFetch(`/api/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl, projectName, tenantName })
    })
    .then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.code === "ai_not_connected") setAiStatus("missing");
          throw new Error(data.error || `Generation failed (HTTP ${res.status}).`);
        }
        // AI Phase is done, Background Factory Worker is now compiling!
        setCurrentProgressStep(3); // Jump to "Compiling static site..."
    })
    .catch(async err => {
      // TypeError means fetch itself failed (backend down or unreachable).
      setError(err instanceof TypeError
        ? "Server connection failed or timed out. Is the backend running?"
        : err.message);
      setStep("form");
      // Don't leave the project stuck in "running" if the backend rejected the request.
      await supabase.from('projects').update({ status: 'failed' }).eq('id', project.id);
    });
  };

  useEffect(() => {
    if (step !== "generating") return;
    
    const timer = setInterval(() => {
      setCurrentProgressStep(prev => prev < 2 ? prev + 1 : prev); 
    }, 4500); 
    
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step !== "generating" || !projectId) return;
    
    // 1. Supabase Realtime (Instant updates)
    const subscription = supabase
      .channel('project-generation-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` },
        (payload) => {
          if (payload.new.status === 'successful' || payload.new.status === 'live') {
            setCurrentProgressStep(3); 
            setTimeout(() => setStep("done"), 1200); 
          } else if (payload.new.status === 'failed') {
            setError("Build failed in the background. Please check the logs.");
            setStep("form");
          }
        }
      )
      .subscribe();
      
    // 2. Polling Fallback (Fires every 4s in case Realtime is disabled on the Postgres table)
    const pollInterval = setInterval(async () => {
      const { data } = await supabase.from('projects').select('status').eq('id', projectId).single();
      if (data && (data.status === 'successful' || data.status === 'live')) {
        setCurrentProgressStep(3); 
        setTimeout(() => setStep("done"), 1200); 
      } else if (data && data.status === 'failed') {
        setError("Build failed in the background. Please check the logs.");
        setStep("form");
      }
    }, 4000);

    return () => {
      supabase.removeChannel(subscription);
      clearInterval(pollInterval);
    };
  }, [step, projectId]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "600px", margin: "60px auto", padding: "0 20px" }}>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "40px", fontSize: "14px", fontWeight: "500", color: "var(--text-muted)" }}>
          <span style={{ color: step === "form" ? "var(--primary-brand)" : "var(--text-main)" }}>1. Repository</span>
          <span style={{ color: "var(--border-color)" }}>──────────</span>
          <span style={{ color: step === "generating" ? "var(--primary-brand)" : (step === "done" ? "var(--text-main)" : "var(--text-muted)") }}>2. Generating</span>
          <span style={{ color: "var(--border-color)" }}>──────────</span>
          <span style={{ color: step === "done" ? "var(--primary-brand)" : "var(--text-muted)" }}>3. Done</span>
        </div>

        <div style={{ backgroundColor: "var(--bg-main)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "40px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          
          {error && (
            <div style={{ marginBottom: "24px", padding: "12px", backgroundColor: "#fef2f2", color: "#dc2626", borderRadius: "8px", fontSize: "14px", border: "1px solid #fecaca" }}>
              {error}
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
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} required style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", fontSize: "15px", outline: "none" }} />
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => navigate("/dashboard")} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-main)", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={aiStatus !== "ready"} style={{ padding: "10px 16px", backgroundColor: "var(--primary-brand)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: "500", cursor: aiStatus === "ready" ? "pointer" : "not-allowed", opacity: aiStatus === "ready" ? 1 : 0.5 }}>Generate Docs</button>
              </div>
            </form>
          )}

          {step === "generating" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid #f3f3f3", borderTop: "3px solid var(--primary-brand)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <h2 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 8px 0", color: "var(--text-heading)" }}>Creating your docs</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 32px 0" }}>This process typically takes 1-3 minutes to complete.</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", maxWidth: "300px" }}>
                {progressSteps.map((progressText, index) => {
                  const isCompleted = index < currentProgressStep;
                  const isActive = index === currentProgressStep;
                  
                  return (
                    <div key={index} style={{ display: "flex", alignItems: "center", gap: "12px", opacity: (isCompleted || isActive) ? 1 : 0.4, transition: "opacity 0.3s" }}>
                      <div style={{ 
                        width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        backgroundColor: isCompleted ? "var(--text-heading)" : "transparent",
                        border: isCompleted ? "none" : isActive ? "2px solid var(--text-heading)" : "2px dashed var(--border-color)"
                      }}>
                        {isCompleted && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg-main)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: isActive ? "600" : "500", color: "var(--text-heading)" }}>{progressText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === "done" && (
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