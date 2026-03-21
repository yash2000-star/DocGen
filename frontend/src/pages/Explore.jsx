import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function Explore() {
  const { tenant, version } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(null);

  const steps = [
    "Analyzing your repository...",
    "Building documentation structure...",
    "Generating page content with AI...",
    "Applying your branding..."
  ];

  useEffect(() => {
    let isMounted = true;

    async function generatePreview() {
      try {
        // Step 1: Tell the backend to start the generation
        // (Note: We need to make a public/unauthenticated version of your /api/github route for this to work perfectly without logging in)
        const repoUrl = `https://github.com/${tenant}/${version}`;
        
        // Simulating the loading steps for the UI animation
        for (let i = 0; i < steps.length; i++) {
            if (!isMounted) return;
            setCurrentStep(i);
            // Fake delay for UI purposes (in a real app, you'd use WebSockets for real-time progress)
            await new Promise(res => setTimeout(res, 3000)); 
        }

        // Once finished, redirect them to sign up to claim it!
        navigate(`/login?claim=${tenant}/${version}`);

      } catch (err) {
        if (isMounted) setError("Failed to generate preview. The repository might be private or too large.");
      }
    }

    generatePreview();

    return () => { isMounted = false; };
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
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
             <div style={{ width: "32px", height: "32px", border: "3px solid #f3f3f3", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
             <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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
        </div>
      </div>
    </div>
  );
}