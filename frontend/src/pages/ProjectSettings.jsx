import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/auth";
import { deleteProject } from "../lib/projects";
import Navbar from "../components/dashboard/Navbar";

// Standard preset colors [cite: 284-285]
const PRESETS = ['#6366f1','#0f766e','#db2777','#d97706','#16a34a','#2563eb','#9333ea','#0f172a'];

export default function ProjectSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Theme State
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Danger Zone State [cite: 339-346]
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setProject(data);
          setPrimaryColor(data.primary_color || '#6366f1');
          setLogoUrl(data.logo_url || '');
        }
        setLoading(false);
      });
  }, [id]);

  // Handle Save Theme [cite: 295-309]
  const handleSave = async () => {
    setSaving(true);
    
    // 1. Call Backend to save JSON and rebuild
    await fetch('http://localhost:4000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: project.tenant_name,
        version: project.project_name,
        primaryColor,
        logoUrl,
        fontFamily: 'sans-serif',
        darkMode: false
      })
    });

    // 2. Update Supabase
    await supabase.from('projects')
      .update({ primary_color: primaryColor, logo_url: logoUrl })
      .eq('id', id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Handle Delete Project [cite: 368-379]
  const handleDelete = async () => {
    // 1. Delete backend files and vectors FIRST [cite: 380]
    await fetch(`http://localhost:4000/api/projects/${project.tenant_name}/${project.project_name}`, {
      method: 'DELETE'
    });

    // 2. Delete Supabase row
    await deleteProject(project.id);
    
    // 3. Redirect to dashboard
    navigate('/dashboard', { replace: true });
  };

  if (loading) return <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)" }}><Navbar /></div>;
  if (!project) return <div style={{ padding: "40px" }}>Project not found.</div>;

  const canConfirmDelete = confirmText === project.project_name;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: "60px" }}>
      <Navbar />
      
      <div style={{ maxWidth: "900px", margin: "40px auto", padding: "0 32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "32px" }}>Settings</h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "32px" }}>
          
          {/* LEFT: Forms */}
          <div>
            {/* Theme Customizer Panel */}
            <div style={{ backgroundColor: "var(--bg-main)", padding: "32px", borderRadius: "12px", border: "1px solid var(--border-color)", marginBottom: "32px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "24px" }}>Theme Configuration</h2>
              
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "12px" }}>Primary Brand Color</label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  {PRESETS.map(color => (
                    <button 
                      key={color}
                      onClick={() => setPrimaryColor(color)}
                      style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: color, border: primaryColor === color ? `2px solid var(--text-heading)` : "none", cursor: "pointer" }}
                    />
                  ))}
                </div>
                <input 
                  type="text" 
                  value={primaryColor} 
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: "120px", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
                />
              </div>

              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>Logo URL (Optional)</label>
                <input 
                  type="url" 
                  value={logoUrl} 
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                />
              </div>

              <button 
                onClick={handleSave} 
                disabled={saving}
                style={{ padding: "10px 20px", backgroundColor: primaryColor, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "500", cursor: saving ? "not-allowed" : "pointer" }}
              >
                {saving ? "Saving & Rebuilding..." : (saved ? "Saved!" : "Save Changes")}
              </button>
            </div>

            {/* Danger Zone Panel [cite: 310-316] */}
            <div style={{ padding: "32px", borderRadius: "12px", border: "1px solid #fecaca", backgroundColor: "#fef2f2" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#dc2626", marginBottom: "8px" }}>Danger Zone</h2>
              <p style={{ fontSize: "14px", color: "#991b1b", marginBottom: "24px" }}>These actions cannot be undone.</p>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "24px", borderBottom: "1px solid #fecaca", marginBottom: "24px" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "600", color: "#991b1b", margin: 0 }}>Delete Project</h3>
                  <p style={{ fontSize: "13px", color: "#b91c1c", margin: "4px 0 0 0" }}>Permanently remove this project and all documentation.</p>
                </div>
                <button onClick={() => setShowModal(true)} style={{ padding: "8px 16px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "6px", fontWeight: "500", cursor: "pointer" }}>
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview Mockup  */}
          <div>
            <div style={{ position: "sticky", top: "40px" }}>
              <p style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "12px" }}>Live Preview</p>
              <div style={{ backgroundColor: "white", height: "300px", borderRadius: "12px", border: "1px solid var(--border-color)", overflow: "hidden", display: "flex", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
                {/* Fake Sidebar */}
                <div style={{ width: "80px", borderRight: "1px solid var(--border-color)", padding: "12px", backgroundColor: "#f9fafb" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "4px", backgroundColor: primaryColor, marginBottom: "20px" }}></div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#e5e7eb", borderRadius: "4px", marginBottom: "12px" }}></div>
                  <div style={{ width: "80%", height: "8px", backgroundColor: primaryColor, borderRadius: "4px" }}></div>
                </div>
                {/* Fake Content */}
                <div style={{ flex: 1, padding: "20px" }}>
                  <div style={{ width: "60%", height: "16px", backgroundColor: "#d1d5db", borderRadius: "4px", marginBottom: "16px" }}></div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#f3f4f6", borderRadius: "4px", marginBottom: "8px" }}></div>
                  <div style={{ width: "90%", height: "8px", backgroundColor: "#f3f4f6", borderRadius: "4px", marginBottom: "24px" }}></div>
                  <button style={{ padding: "6px 12px", backgroundColor: primaryColor, color: "white", border: "none", borderRadius: "4px", fontSize: "10px" }}>Primary Action</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal [cite: 336-346] */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ backgroundColor: "var(--bg-main)", padding: "32px", borderRadius: "12px", width: "100%", maxWidth: "400px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#dc2626" }}>Delete {project.project_name}?</h2>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "24px" }}>This will permanently delete the project, documentation files, and vector embeddings. This action cannot be undone.</p>
            
            <input 
              type="text" 
              placeholder={`Type ${project.project_name} to confirm`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", marginBottom: "24px" }}
            />
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => { setShowModal(false); setConfirmText(''); }} style={{ padding: "10px 16px", background: "none", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={!canConfirmDelete} style={{ padding: "10px 16px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: canConfirmDelete ? "pointer" : "not-allowed", opacity: canConfirmDelete ? 1 : 0.5 }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}