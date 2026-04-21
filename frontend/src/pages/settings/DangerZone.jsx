import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/auth";

export default function DangerZone() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  
  const [deploymentReason, setDeploymentReason] = useState("");
  const [orgReason, setOrgReason] = useState("");
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) setProject(data);
        setLoading(false);
      });
  }, [id]);

  const handleDeleteDeployment = async () => {
    const confirmed = window.confirm(`Are you absolutely sure you want to delete ${project?.project_name}?`);
    if (!confirmed) return;

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await fetch(`${API_URL}/api/projects/${project?.tenant_name}/${project?.project_name}`, {
        method: 'DELETE'
      }).catch(err => console.warn("Backend delete placeholder failed", err));

      const { error } = await supabase.from('projects').delete().eq('id', id);
      
      if (error) {
        console.error(error);
        alert("Failed to delete deployment.");
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred during deletion.");
    }
  };

  const handleDeleteOrg = async () => {
    const confirmed = window.confirm(`CRITICAL: Are you absolutely sure you want to delete the entire organization ${project?.tenant_name}?`);
    if (!confirmed) return;

    alert("Delete Organization backend endpoint would be called here.");
    // In reality, this would wipe the whole tenant.
  };

  const rowStyle = {
    display: "flex",
    gap: "60px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "40px",
    marginBottom: "40px",
  };

  const lastRowStyle = {
    display: "flex",
    gap: "60px",
  };

  const leftColStyle = {
    width: "280px",
    flexShrink: 0
  };

  const rightColStyle = {
    flex: 1,
    maxWidth: "600px"
  };

  const h2Style = {
    fontSize: "14px",
    fontWeight: "600",
    color: "#0f172a",
    margin: "0 0 8px 0"
  };

  const pStyle = {
    color: "#64748b",
    fontSize: "13px",
    margin: 0,
    lineHeight: "1.5"
  };

  const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#334155",
    marginBottom: "12px"
  };

  const textareaStyle = {
    width: "100%",
    minHeight: "80px",
    padding: "12px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    outline: "none",
    fontSize: "14px",
    color: "#0f172a",
    marginBottom: "20px",
    resize: "vertical",
    fontFamily: "Inter, system-ui, sans-serif"
  };

  const btnStyle = {
    backgroundColor: "#ef4444",
    color: "#ffffff",
    padding: "10px 20px",
    border: "none",
    borderRadius: "8px",
    fontWeight: "500",
    fontSize: "13px",
    cursor: "pointer",
    display: "inline-block"
  };

  if (loading) return null;

  return (
    <div style={{ maxWidth: "1100px", fontFamily: "Inter, system-ui, sans-serif" }}>
      
      {/* ROW 1: Delete Deployment */}
      <div style={rowStyle}>
        <div style={leftColStyle}>
          <h2 style={h2Style}>Delete my deployment</h2>
          <p style={pStyle}>
            Your deployment will be deleted and cannot be restored. This is irreversible.
          </p>
        </div>

        <div style={rightColStyle}>
          <label style={labelStyle}>Reason for deletion <span style={{ color: "#ef4444" }}>*</span></label>
          <textarea 
            value={deploymentReason}
            onChange={(e) => setDeploymentReason(e.target.value)}
            placeholder="Why are you deleting your deployment?"
            style={textareaStyle}
          />
          
          <button onClick={handleDeleteDeployment} style={btnStyle}>
            Delete {project?.project_name || 'Deployment'}
          </button>
        </div>
      </div>

      {/* ROW 2: Delete Organization */}
      <div style={lastRowStyle}>
        <div style={leftColStyle}>
          <h2 style={h2Style}>Delete my organization</h2>
          <p style={pStyle}>
            Your organization will be deleted and cannot be restored. This is irreversible.
          </p>
        </div>

        <div style={rightColStyle}>
          <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "8px", padding: "16px", marginBottom: "24px", display: "flex", gap: "12px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <p style={{ margin: 0, fontSize: "13px", color: "#b45309", lineHeight: "1.5" }}>
              <strong>CRITICAL ACTION:</strong> This will permanently delete your entire organization, all deployments, team members, and data. This cannot be undone.
            </p>
          </div>

          <label style={labelStyle}>Reason for deletion <span style={{ color: "#ef4444" }}>*</span></label>
          <textarea 
            value={orgReason}
            onChange={(e) => setOrgReason(e.target.value)}
            placeholder="Why are you deleting your organization?"
            style={textareaStyle}
          />
          
          <button onClick={handleDeleteOrg} style={btnStyle}>
            Delete {project?.tenant_name || 'Freelancer'}
          </button>
        </div>
      </div>
    
    </div>
  );
}
