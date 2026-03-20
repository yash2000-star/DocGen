import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/auth";
import { createProject, updateProjectStatus } from "../lib/projects";
import Navbar from "../components/dashboard/Navbar";
import { apiFetch } from '../lib/api';

export default function NewProject() {
  const navigate = useNavigate();
  
  // State Machine
  const [step, setStep] = useState("form"); // 'form' | 'generating' | 'done'
  const [repoUrl, setRepoUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState(null);

  // Auto-extract project name from GitHub URL
  const handleUrlChange = (e) => {
    const url = e.target.value;
    setRepoUrl(url);
    const parts = url.split("/");
    const extracted = parts[parts.length - 1];
    if (extracted) {
      // Remove .git if they copied the clone URL
      setProjectName(extracted.replace(".git", ""));
    }
  };

  // The core submit logic
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!repoUrl || !projectName) {
      setError("Please fill in all fields");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const tenantName = user.user_metadata?.user_name || user.email.split("@")[0];

    // 1. Create project row in Supabase first
    const { data: project, error: dbErr } = await createProject({
      repo_url: repoUrl,
      project_name: projectName,
      tenant_name: tenantName,
      status: "building"
    });

    if (dbErr) {
      setError(dbErr.message);
      return;
    }

    setProjectId(project.id);
    setStep("generating");

    try {
      // 2. Call the existing backend route
      const res = await apiFetch(`/api/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          projectName,
          tenantName
        })
      });

      // 3. Update project status based on result
      if (res.ok) {
        const result = await res.json();
        // Fallback to 10 files if backend doesn't return count yet
        const fileCount = result.fileProcessed || 10; 
        await updateProjectStatus(project.id, "live", fileCount);
      } else {
        await updateProjectStatus(project.id, "failed", 0);
        setError("Generation failed. Check server logs.");
      }
    } catch (err) {
      await updateProjectStatus(project.id, "failed", 0);
      setError("Server connection failed. Is the backend running?");
    }
  };

  // Polling logic — check status every 3 seconds while generating
  useEffect(() => {
    if (step !== "generating" || !projectId) return;
    
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("projects")
        .select("status")
        .eq("id", projectId)
        .single();
        
      if (data?.status === "live") {
        setStep("done");
        clearInterval(interval);
      } else if (data?.status === "failed") {
        setError("Build failed in the background.");
        setStep("form"); // Kick them back to form to try again
        clearInterval(interval);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [step, projectId]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "600px", margin: "60px auto", padding: "0 20px" }}>
        
        {/* Step Indicator */}
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

          {/* UI: STEP 1 - FORM */}
          {step === "form" && (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: "24px", fontWeight: "600", color: "var(--text-heading)", margin: "0 0 8px 0" }}>Import Repository</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "15px", marginBottom: "24px" }}>Connect a GitHub repository to generate documentation.</p>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "var(--text-heading)" }}>GitHub Repository URL</label>
                <input 
                  type="url" 
                  placeholder="https://github.com/username/repo" 
                  value={repoUrl} 
                  onChange={handleUrlChange} 
                  required 
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", fontSize: "15px", outline: "none" }} 
                />
              </div>

              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "var(--text-heading)" }}>Project Name</label>
                <input 
                  type="text" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)} 
                  required 
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)", color: "var(--text-main)", fontSize: "15px", outline: "none" }} 
                />
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => navigate("/dashboard")} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-main)", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: "10px 16px", backgroundColor: "var(--primary-brand)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
                  Generate Docs
                </button>
              </div>
            </form>
          )}

          {/* UI: STEP 2 - GENERATING */}
          {step === "generating" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ width: "48px", height: "48px", border: "4px solid var(--border-color)", borderTopColor: "var(--primary-brand)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 24px" }}>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>Building your documentation</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "15px", fontFamily: "monospace" }}>AI is analyzing repository files...</p>
            </div>
          )}

          {/* UI: STEP 3 - DONE */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: "64px", height: "64px", backgroundColor: "#ecfdf5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#059669" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>Generation Complete!</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "15px", marginBottom: "32px" }}>Your documentation is ready to view.</p>
              
              <button onClick={() => navigate("/dashboard")} style={{ padding: "12px 24px", backgroundColor: "var(--primary-brand)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer" }}>
                Go to Dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}