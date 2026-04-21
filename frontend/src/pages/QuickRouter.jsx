import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/auth";

export default function QuickRouter() {
  const { tenant, version } = useParams();
  const navigate = useNavigate();
  // State machine: 'checking' | 'not-found' | 'ready-to-generate'
  const [status, setStatus] = useState("checking"); 
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function routeUser() {
      // 1. Check if it exists in our database
      const { data, error } = await supabase
        .from('projects')
        .select('id')
        .eq('tenant_name', tenant)
        .eq('project_name', version)
        .single();

      if (data && !error) {
        // It exists! Send them to the live docs
        navigate(`/docs/${tenant}/${version}`, { replace: true });
        return;
      }

      // 2. Not in DB. Let's ask GitHub if this repo actually exists!
      try {
        const githubRes = await fetch(`https://api.github.com/repos/${tenant}/${version}`);
        
        if (githubRes.ok) {
          // Repo exists and is public! Show the email form.
          setStatus("ready-to-generate");
        } else {
          // Repo is private, deleted, or a typo. Show the "Not Found" UI.
          setStatus("not-found");
        }
      } catch (err) {
        // Network error catching
        setStatus("not-found");
      }
    }
    
    routeUser();
  }, [tenant, version, navigate]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!email) return;
    navigate(`/explore/${tenant}/${version}?email=${encodeURIComponent(email)}`);
  };

  // UI: Loading State
  if (status === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa", color: "#111827", fontFamily: "system-ui" }}>
        <div style={{ width: "40px", height: "40px", border: "3px solid #f3f3f3", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // UI: Mintlify-style "Not Found" Error Page
  if (status === "not-found") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "400", color: "#6b7280", marginBottom: "16px" }}>Repository not found</h2>
        <a href="/" style={{ color: "#111827", textDecoration: "underline", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}>
          Back to home
        </a>
      </div>
    );
  }

  // UI: The Generation Form (Only shows if GitHub verified it!)
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
      {/* Navbar */}
      <div style={{ padding: "16px 24px", backgroundColor: "#fff", borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "24px", height: "24px", backgroundColor: "#10b981", borderRadius: "4px" }}></div>
        <span style={{ fontWeight: "600", color: "#111827" }}>DocGen</span>
        <span style={{ color: "#6b7280" }}>/ {tenant} / {version}</span>
      </div>

      <div style={{ maxWidth: "600px", margin: "60px auto", padding: "0 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        
        <div style={{ width: "64px", height: "64px", backgroundColor: "#d1fae5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px", color: "#059669", fontWeight: "bold", fontSize: "24px" }}>
          {version.charAt(0).toUpperCase()}
        </div>
        <h1 style={{ fontSize: "20px", fontWeight: "600", color: "#111827", margin: "0 0 8px 0", textDecoration: "underline" }}>{version}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6b7280", marginBottom: "40px" }}>
          <span style={{ width: "8px", height: "8px", backgroundColor: "#3b82f6", borderRadius: "50%" }}></span>
          Public Repository
        </div>

        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid #eaeaea", padding: "32px", width: "100%", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#111827", margin: "0 0 8px 0" }}>Create a new documentation site</h2>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0, lineHeight: "1.5" }}>
              No documentation has been generated for this repository. Enter your email below so we can notify you when the process is complete.
            </p>
          </div>

          <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", color: "#1d4ed8", fontSize: "14px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Process takes 1-3 minutes to complete after it starts
          </div>

          <form onSubmit={handleCreate}>
            <input 
              type="email" 
              placeholder="Email to notify (required)" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: "12px 16px", borderRadius: "8px", border: "1px solid #d1d5db", marginBottom: "16px", fontSize: "14px", outline: "none" }}
            />
            <button 
              type="submit" 
              disabled={!email}
              style={{ width: "100%", padding: "12px", backgroundColor: email ? "#111827" : "#f3f4f6", color: email ? "#fff" : "#9ca3af", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: email ? "pointer" : "not-allowed", transition: "all 0.2s" }}
            >
              Create documentation
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}