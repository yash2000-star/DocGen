import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { JobSteps } from "../components/JobProgress";
import { useJobPolling } from "../lib/jobs";

const API_URL = import.meta.env.VITE_API_URL;

async function loadPreviewJob(jobId) {
  const res = await fetch(`${API_URL}/api/public/jobs/${jobId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const COLORS = { heading: "#111827", muted: "#6b7280", border: "#d1d5db", accent: "#10b981" };

export default function Explore() {
  const { tenant, version } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const { job } = useJobPolling(jobId, loadPreviewJob);

  // State to track if we got a fast cache hit
  const [isCached, setIsCached] = useState(false);

  const hasFetched = useRef(false);

  // Start (or join) the preview once; the server answers with a job to follow.
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    (async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const email = searchParams.get('email') || "";

        const res = await apiFetch('/api/public/github', {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectName: version, tenantName: tenant, email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to start preview generation.");

        if (data.cached) {
          setIsCached(true);
          setTimeout(() => navigate(`/docs/${tenant}/${version}`), 1000);
          return;
        }
        setJobId(data.jobId);
      } catch (err) {
        setError(err.message || "Failed to generate preview. The repository might be private or too large.");
      }
    })();
  }, [tenant, version, navigate]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "successful") {
      setTimeout(() => navigate(`/docs/${tenant}/${version}`), 800);
    } else if (job.status === "failed" || job.status === "cancelled") {
      setError(job.error || "The preview couldn't be generated. Try again later.");
    }
  }, [job, tenant, version, navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
      
      {/* Top Header Mockup */}
      <div style={{ width: "100%", padding: "20px 40px", display: "flex", justifyContent: "space-between", backgroundColor: "#fff", borderBottom: "1px solid #eaeaea" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "18px", color: "#111827" }}>
          <div style={{ width: "24px", height: "24px", backgroundColor: "#10b981", borderRadius: "4px" }}></div>
          DocGen
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginTop: "60px", display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "600px", width: "100%" }}>
        
        <h1 style={{ fontSize: "24px", fontWeight: "600", color: "#111827", marginBottom: "8px" }}>{version}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#6b7280", marginBottom: "40px" }}>
          <span style={{ width: "8px", height: "8px", backgroundColor: "#3b82f6", borderRadius: "50%" }}></span>
          Public Repository
        </div>

        {/* The Loading Card */}
        <div style={{ backgroundColor: "#fff", padding: "40px", borderRadius: "16px", border: "1px solid #eaeaea", width: "100%", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          
          {/* Instant Cache UI State */}
          {isCached ? (
             <div style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeIn 0.5s ease-in" }}>
               <div style={{ width: "48px", height: "48px", backgroundColor: "#d1fae5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
               </div>
               <h2 style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 8px 0", color: "#111827" }}>Documentation Found!</h2>
               <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>Taking you to your live docs...</p>
             </div>
          ) : (
            <>
              {/* Active Loading State */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
                {!error && job?.status !== "successful" && (
                    <>
                        <div style={{ width: "32px", height: "32px", border: "3px solid #f3f3f3", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
                    </>
                )}
                <h2 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 8px 0" }}>Creating your docs</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>This usually takes a few minutes. You can keep this page open; it updates as the docs are written.</p>
              </div>

              {error ? (
                <div style={{ color: "#ef4444", fontSize: "14px", textAlign: "center", padding: "16px", backgroundColor: "#fef2f2", borderRadius: "8px" }}>{error}</div>
              ) : (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <JobSteps job={job} colors={COLORS} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}