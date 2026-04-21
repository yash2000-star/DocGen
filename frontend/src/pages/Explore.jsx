import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function Explore() {
  const { tenant, version } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(null);
  
  // State to track if we got a fast cache hit
  const [isCached, setIsCached] = useState(false); 

  const hasFetched = useRef(false);

  const steps = [
    "Analyzing your repository...",
    "Building documentation structure...",
    "Generating page content with AI...",
    "Applying your branding..."
  ];

  useEffect(() => {
    // 1. Start the UI progress animation immediately, OUTSIDE the fetch lock!
    // This prevents React Strict Mode from freezing the timer on remount.
    const progressTimer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 4000);

    async function generatePreview() {
      // 2. Lock the fetch so we don't spam your backend API
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        const repoUrl = `https://github.com/${tenant}/${version}`;
        const searchParams = new URLSearchParams(window.location.search);
        const email = searchParams.get('email') || "";

        const res = await apiFetch('/api/public/github', {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl, projectName: version, tenantName: tenant, email })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to start preview generation.");
        }

        // --- THE INSTANT CACHE UX FIX ---
        if (data.cached) {
          clearInterval(progressTimer);
          setIsCached(true); // Instantly change the UI!
          
          // Wait 1 second so the user sees the success message, then navigate
          setTimeout(() => {
              navigate(`/docs/${tenant}/${version}`);
          }, 1000);
          return;
        }

        // --- NEW REPO SUCCESS ---
        clearInterval(progressTimer);
        setCurrentStep(steps.length - 1); // Snap to the final step visually
        
        setTimeout(() => {
          navigate(`/docs/${tenant}/${version}`);
        }, 1500);

      } catch (err) {
        clearInterval(progressTimer);
        setError(err.message || "Failed to generate preview. The repository might be private or too large.");
      }
    }

    generatePreview();

    // Clean up the timer when we leave the page
    return () => { 
      clearInterval(progressTimer);
    };
  }, [tenant, version, navigate]);

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
                {!error && (
                    <>
                        <div style={{ width: "32px", height: "32px", border: "3px solid #f3f3f3", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
                    </>
                )}
                <h2 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 8px 0" }}>Creating your docs</h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>The documentation process typically takes 1-3 minutes to complete</p>
              </div>

              {error ? (
                <div style={{ color: "#ef4444", fontSize: "14px", textAlign: "center", padding: "16px", backgroundColor: "#fef2f2", borderRadius: "8px" }}>{error}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;
                    
                    return (
                      <div key={index} style={{ display: "flex", alignItems: "center", gap: "12px", opacity: (isCompleted || isActive) ? 1 : 0.4, transition: "opacity 0.3s" }}>
                        <div style={{ 
                          width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          backgroundColor: isCompleted ? "#111827" : "transparent",
                          border: isCompleted ? "none" : isActive ? "2px solid #111827" : "2px dashed #d1d5db"
                        }}>
                          {isCompleted && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: isActive ? "600" : "500", color: "#111827" }}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}