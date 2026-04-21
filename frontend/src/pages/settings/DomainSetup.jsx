import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/auth";

export default function DomainSetup() {
  const { id } = useParams();
  const [domainInput, setDomainInput] = useState("");
  const [project, setProject] = useState(null);
  const [isSavingDomain, setIsSavingDomain] = useState(false);

  useEffect(() => {
    // Only load if not already loaded from parent? Actually, fresh fetch is fine.
    supabase.from('projects').select('custom_domain, project_name').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setProject(data);
          setDomainInput(data.custom_domain || '');
        }
      });
  }, [id]);

  const handleSaveDomain = async () => {
    setIsSavingDomain(true);
    let cleanDomain = domainInput.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (cleanDomain === "") cleanDomain = null; 

    const { error } = await supabase.from('projects').update({ custom_domain: cleanDomain }).eq('id', id);
    if (error) {
      alert("Failed to save. That domain might already be used by someone else!");
    } else {
      setProject(prev => ({ ...prev, custom_domain: cleanDomain }));
      alert("Custom domain successfully linked to this project!");
    }
    setIsSavingDomain(false);
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "1000px", gap: "40px" }}>
      
      {/* Left side: Title and Description */}
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: "16px", fontWeight: "600", color: "#0f172a", marginBottom: "8px", marginTop: 0 }}>Set up your custom domain</h2>
        <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
          This domain will be assigned to your Production Deployment
        </p>
      </div>

      {/* Right side: Input Field and Button */}
      <div style={{ flex: 1.5 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
           <label style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>Enter your domain URL</label>
           <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
             Host at <span style={{ backgroundColor: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>/docs</span>
             <div style={{ width: "32px", height: "18px", backgroundColor: "#e2e8f0", borderRadius: "99px", position: "relative" }}>
                <div style={{ width: "14px", height: "14px", backgroundColor: "white", borderRadius: "50%", position: "absolute", top: "2px", left: "2px" }}></div>
             </div>
           </div>
        </div>
        <p style={{ color: "#64748b", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>
           You can host your domain as a subdomain or a subpath
        </p>
        
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", backgroundColor: "#ffffff" }}>
            <span style={{ padding: "10px 12px", color: "#64748b", fontSize: "14px", borderRight: "1px solid #e2e8f0" }}>https://</span>
            <input 
              type="text" 
              value={domainInput} 
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="docs.yourstartup.com"
              style={{ flex: 1, padding: "10px 12px", border: "none", outline: "none", fontSize: "14px", color: "#0f172a" }}
            />
          </div>
          <button 
            onClick={handleSaveDomain} 
            disabled={isSavingDomain || domainInput === (project?.custom_domain || "")}
            style={{ 
              padding: "10px 20px", backgroundColor: "#0f172a", color: "#ffffff", 
              border: "none", borderRadius: "8px", fontWeight: "600", fontSize: "13px",
              cursor: (isSavingDomain || domainInput === (project?.custom_domain || "")) ? "not-allowed" : "pointer", 
              opacity: (isSavingDomain || domainInput === (project?.custom_domain || "")) ? 0.7 : 1,
              whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px"
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            {isSavingDomain ? "Saving..." : "Add domain"}
          </button>
        </div>
      </div>
    
    </div>
  );
}
