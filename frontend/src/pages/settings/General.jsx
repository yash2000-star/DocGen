import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/auth";

const PRESETS = ['#6366f1','#0f766e','#db2777','#d97706','#16a34a','#2563eb','#9333ea','#0f172a'];

export default function General() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    supabase.from('projects').select('project_name, primary_color, logo_url').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setProjectName(data.project_name || "");
          setPrimaryColor(data.primary_color || "#6366f1");
          setLogoUrl(data.logo_url || "");
        }
        setLoading(false);
      });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('projects')
      .update({
        project_name: projectName,
        primary_color: primaryColor,
        logo_url: logoUrl
      })
      .eq('id', id);

    if (error) {
      console.error(error);
      alert("Failed to save changes.");
    } else {
      alert("Project configuration updated successfully!");
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <div style={{ display: "flex", gap: "60px", maxWidth: "1100px" }}>
      
      {/* LEFT: Forms */}
      <div style={{ flex: 1 }}>
        
        {/* ROW 1: Project Name */}
        <div style={{ display: "flex", gap: "40px", borderBottom: "1px solid #e2e8f0", paddingBottom: "40px", marginBottom: "40px" }}>
          <div style={{ width: "240px", flexShrink: 0 }}>
            <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", margin: "0 0 4px 0" }}>Project name</h2>
            <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
              Name displayed on the topbar
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>Deployment name</label>
            <input 
              type="text" 
              value={projectName} 
              onChange={(e) => setProjectName(e.target.value)}
              style={{ width: "100%", maxWidth: "400px", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "8px", outline: "none", fontSize: "14px", color: "#0f172a", marginBottom: "16px", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}
            />
          </div>
        </div>

        {/* ROW 2: Branding */}
        <div style={{ display: "flex", gap: "40px", paddingBottom: "40px" }}>
          <div style={{ width: "240px", flexShrink: 0 }}>
            <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", margin: "0 0 4px 0" }}>Branding</h2>
            <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
              Configure your primary brand color and logo.
            </p>
          </div>
          <div style={{ flex: 1 }}>
            
            {/* Primary Color Picker */}
            <div style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "12px" }}>Primary Color</label>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
                {PRESETS.map(color => (
                  <button 
                    key={color}
                    onClick={() => setPrimaryColor(color)}
                    style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: color, border: primaryColor === color ? `2px solid #0f172a` : "1px solid #e2e8f0", cursor: "pointer", transition: "transform 0.1s", transform: primaryColor === color ? "scale(1.1)" : "scale(1)" }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input 
                  type="text" 
                  value={primaryColor} 
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: "120px", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", outline: "none", fontSize: "14px", color: "#0f172a" }}
                />
              </div>
            </div>

            {/* Logo URL */}
            <div style={{ marginBottom: "32px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>Logo URL</label>
              <input 
                type="url" 
                value={logoUrl} 
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                style={{ width: "100%", maxWidth: "400px", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "8px", outline: "none", fontSize: "14px", color: "#0f172a", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}
              />
            </div>

            {/* Save Button */}
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ 
                backgroundColor: "#0f172a", color: "#ffffff", padding: "8px 16px", 
                border: "none", borderRadius: "8px", fontWeight: "500", fontSize: "13px",
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>

          </div>
        </div>

      </div>

      {/* RIGHT: Live Preview Mockup Sidebar */}
      <div style={{ width: "300px", flexShrink: 0 }}>
        <div style={{ position: "sticky", top: "40px" }}>
          <p style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600", color: "#64748b", marginBottom: "12px" }}>Live Preview</p>
          <div style={{ backgroundColor: "white", height: "300px", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
            <div style={{ width: "80px", borderRight: "1px solid #e2e8f0", padding: "12px", backgroundColor: "#f9fafb" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "4px", backgroundColor: primaryColor, marginBottom: "20px", backgroundSize: "cover", backgroundPosition: "center", backgroundImage: logoUrl ? `url(${logoUrl})` : 'none' }}></div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#e2e8f0", borderRadius: "4px", marginBottom: "12px" }}></div>
              <div style={{ width: "80%", height: "8px", backgroundColor: primaryColor, borderRadius: "4px" }}></div>
            </div>
            <div style={{ flex: 1, padding: "20px" }}>
              <div style={{ width: "60%", height: "16px", backgroundColor: "#e2e8f0", borderRadius: "4px", marginBottom: "16px" }}></div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#f8fafc", borderRadius: "4px", marginBottom: "8px" }}></div>
              <div style={{ width: "90%", height: "8px", backgroundColor: "#f8fafc", borderRadius: "4px", marginBottom: "24px" }}></div>
              <button style={{ padding: "6px 12px", backgroundColor: primaryColor, color: "white", border: "none", borderRadius: "4px", fontSize: "10px" }}>Primary Action</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
