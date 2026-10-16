/*
  TODO: Update your router configuration in App.jsx to treat /settings as a parent layout!
  Example:
  <Route path="/dashboard/:id/settings" element={<ProjectSettings />}>
    <Route index element={<DomainSetup />} />
    <Route path="domain" element={<DomainSetup />} />
    <Route path="general" element={<GeneralSettings />} />
    <Route path="billing" element={<BillingSettings />} />
    <Route path="security" element={<SecuritySettingsPage />} />
  </Route>
*/

import { useState, useEffect } from "react";
import { Link, useLocation, Outlet, useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../lib/auth";
import { deleteProject } from "../lib/projects";
import SecuritySettings from '../components/dashboard/SecuritySettings';
import { apiFetch } from '../lib/api';
import UpgradeButton from '../components/dashboard/UpgradeButton';

const PRESETS = ['#6366f1','#0f766e','#db2777','#d97706','#16a34a','#2563eb','#9333ea','#0f172a'];

export function DomainSetup() {
  const context = useOutletContext();
  if (!context) return <h2>Domain Setup</h2>; 
  const { domainInput, setDomainInput, isSavingDomain, handleSaveDomain, project } = context;

  return (
    <div style={{ maxWidth: "800px" }}>
      <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#0f172a", marginBottom: "8px", marginTop: 0 }}>Domain setup</h2>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "32px", marginTop: 0 }}>
        Host your documentation on your own URL. Point a CNAME record to <strong>cname.prismify.dev</strong>.
      </p>
      
      <div style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "32px" }}>
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>Domain URL</label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <span style={{ padding: "10px 12px", backgroundColor: "#f8fafc", color: "#64748b", fontSize: "14px", borderRight: "1px solid #e2e8f0" }}>https://</span>
            <input 
              type="text" 
              value={domainInput} 
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="docs.yourstartup.com"
              style={{ flex: 1, padding: "10px 12px", border: "none", outline: "none", fontSize: "14px", color: "#0f172a" }}
            />
          </div>
        </div>

        <button 
          onClick={handleSaveDomain} 
          disabled={isSavingDomain || domainInput === (project?.custom_domain || "")}
          style={{ 
            padding: "10px 20px", backgroundColor: "#0f172a", color: "#ffffff", 
            border: "none", borderRadius: "8px", fontWeight: "500", 
            cursor: (isSavingDomain || domainInput === (project?.custom_domain || "")) ? "not-allowed" : "pointer", 
            opacity: (isSavingDomain || domainInput === (project?.custom_domain || "")) ? 0.7 : 1 
          }}
        >
          {isSavingDomain ? "Saving..." : "Save Domain"}
        </button>
      </div>
    </div>
  );
}

export function GeneralSettings() {
  const context = useOutletContext();
  if (!context) return <h2>General Settings</h2>;
  const { primaryColor, setPrimaryColor, logoUrl, setLogoUrl, handleSave, saving, saved, setShowModal } = context;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "32px", maxWidth: "1000px" }}>
      <div>
        <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#0f172a", marginBottom: "8px", marginTop: 0 }}>General Settings</h2>
        <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "32px", marginTop: 0 }}>Manage your general project properties here.</p>
        
        {/* Theme Customizer Panel */}
        <div style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "32px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "24px", marginTop: 0 }}>Theme Configuration</h3>
          
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "12px" }}>Primary Brand Color</label>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
              {PRESETS.map(color => (
                <button 
                  key={color}
                  onClick={() => setPrimaryColor(color)}
                  style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: color, border: primaryColor === color ? `2px solid #0f172a` : "none", cursor: "pointer" }}
                />
              ))}
            </div>
            <input 
              type="text" 
              value={primaryColor} 
              onChange={(e) => setPrimaryColor(e.target.value)}
              style={{ width: "120px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}
            />
          </div>

          <div style={{ marginBottom: "32px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>Logo URL (Optional)</label>
            <input 
              type="url" 
              value={logoUrl} 
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
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

        {/* Danger Zone Panel */}
        <div style={{ padding: "32px", borderRadius: "12px", border: "1px solid #fecaca", backgroundColor: "#fef2f2" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#dc2626", marginBottom: "8px", marginTop: 0 }}>Danger Zone</h2>
          <p style={{ fontSize: "14px", color: "#991b1b", marginBottom: "24px", marginTop: 0 }}>These actions cannot be undone.</p>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

      {/* RIGHT MOCKUP SIDEBAR */}
      <div>
        <div style={{ position: "sticky", top: "40px" }}>
          <p style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600", color: "#64748b", marginBottom: "12px" }}>Live Preview</p>
          <div style={{ backgroundColor: "white", height: "300px", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}>
            <div style={{ width: "80px", borderRight: "1px solid #e2e8f0", padding: "12px", backgroundColor: "#f9fafb" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "4px", backgroundColor: primaryColor, marginBottom: "20px" }}></div>
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

export function SecuritySettingsPage() {
  return (
    <div style={{ maxWidth: "800px" }}>
      <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#0f172a", marginBottom: "8px", marginTop: 0 }}>Security</h2>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "32px", marginTop: 0 }}>Manage authentication and SSO.</p>
      <SecuritySettings />
    </div>
  );
}

export function BillingSettings() {
  return (
    <div style={{ maxWidth: "800px" }}>
      <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#0f172a", marginBottom: "8px", marginTop: 0 }}>Plan & Billing</h2>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "32px", marginTop: 0 }}>Manage your workspace subscription.</p>
      <div style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px", marginTop: 0 }}>Current Plan</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
          You are currently on the Free plan. Upgrade to unlock unlimited AI generations and custom domains.
        </p>
        <UpgradeButton />
      </div>
    </div>
  );
}

export default function ProjectSettings() {
  const location = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [domainInput, setDomainInput] = useState('');
  const [isSavingDomain, setIsSavingDomain] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) {
          setProject(data);
          setPrimaryColor(data.primary_color || '#6366f1');
          setLogoUrl(data.logo_url || '');
          setDomainInput(data.custom_domain || '');
        }
        setLoading(false);
      });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant: project.tenant_name, version: project.project_name, primaryColor, logoUrl, fontFamily: 'sans-serif', darkMode: false
        })
      });

      await supabase.from('projects').update({ primary_color: primaryColor, logo_url: logoUrl }).eq('id', id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error(error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

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

  const handleDelete = async () => {
    await apiFetch(`/api/projects/${project.tenant_name}/${project.project_name}`, { method: 'DELETE' });
    await deleteProject(project.id);
    navigate('/dashboard', { replace: true });
  };

  // Helper for active styling
  const isActive = (paths) => {
    const curPath = location.pathname;
    return paths.some(p => curPath.endsWith(p));
  };

  const navItem = (label, paths, icon) => {
    const active = isActive(paths);
    const color = active ? "#059669" : "#64748b";
    
    // We add the logic to navigate based on current layout ID
    const targetPath = paths[0] === '/' || paths[0] === '' 
      ? `/dashboard/${id}/settings` 
      : `/dashboard/${id}/settings/${paths[0].replace(/^\//, '')}`;

    return (
      <Link to={targetPath} style={{
        display: "flex", alignItems: "center", gap: "10px", padding: "6px 8px",
        borderRadius: "6px", textDecoration: "none", fontSize: "13px",
        fontWeight: "500", color: color, backgroundColor: "transparent",
        transition: "all 0.2s"
      }}>
        <div style={{ color: color, display: "flex", alignItems: "center" }}>
          {icon}
        </div>
        {label}
      </Link>
    );
  };

  const headerStyle = {
    fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase",
    letterSpacing: "0.05em", margin: "0 0 8px 8px"
  };

  if (loading) return <div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }}></div>;
  if (!project) return <div style={{ padding: "40px" }}>Project not found.</div>;

  const canConfirmDelete = confirmText === project.project_name;

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 65px)", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Left Column (Sub-Sidebar) */}
      <div style={{ width: "240px", borderRight: "1px solid #e2e8f0", backgroundColor: "#fafafa", padding: "24px 16px", flexShrink: 0 }}>
        
        <h3 style={headerStyle}>Project Settings</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "24px" }}>
          {navItem("Domain setup", ["/", "/domain"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>)}
          {navItem("Authentication", ["/authentication"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>)}
          {navItem("Add-ons", ["/addons"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>)}
          {navItem("General", ["/general"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>)}
        </div>
        <h3 style={{ ...headerStyle, marginTop: "24px" }}>AI Features</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "24px" }}>
          {navItem("AI providers", ["/ai"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"></path><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle></svg>)}
          {navItem("Agent Integration", ["/agent"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path></svg>)}
        </div>

        <h3 style={{ ...headerStyle, marginTop: "24px" }}>Deployment</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "24px" }}>
          {navItem("Git settings", ["/git"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="6" y1="9" x2="6" y2="15"></line></svg>)}
          {navItem("GitHub app", ["/github"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>)}
        </div>

        <h3 style={{ ...headerStyle, marginTop: "24px" }}>Security & Access</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "24px" }}>
          {navItem("API keys", ["/api-keys"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>)}
        </div>

        <h3 style={{ ...headerStyle, marginTop: "24px" }}>Workspace</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "24px" }}>
          {navItem("Members", ["/members"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>)}
          {navItem("Billing", ["/billing"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>)}
          {navItem("My profile", ["/profile"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>)}
        </div>

        <h3 style={{ ...headerStyle, marginTop: "24px" }}>Advanced</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItem("Exports", ["/exports"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>)}
          {navItem("Danger zone", ["/danger-zone"], <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>)}
        </div>
      </div>

      {/* Right Column (Content Area) */}
      <div style={{ flex: 1, backgroundColor: "#ffffff", padding: "40px 48px", overflowY: "auto", position: "relative" }}>
        
        {/* Child routes inject their components here */}
        <Outlet 
          context={{ 
            project, primaryColor, setPrimaryColor, logoUrl, setLogoUrl, 
            handleSave, saving, saved, domainInput, setDomainInput, 
            isSavingDomain, handleSaveDomain, confirmText, setConfirmText, 
            handleDelete, canConfirmDelete, showModal, setShowModal 
          }} 
        />
        
        {/* FALLBACK RENDER IF APP.JSX HASN'T BEEN UPDATED YET TO NESTED ROUTING */}
        {isActive(["/", "/settings"]) && !location.pathname.includes("/domain") && !location.pathname.includes("/general") && (
          <div style={{ paddingBottom: "100px" }}>
            <p style={{ color: "#f59e0b", backgroundColor: "#fffbeb", padding: "16px", borderRadius: "8px", border: "1px solid #fcd34d", marginBottom: "40px", fontSize: "14px" }}>
              <strong>Notice:</strong> Please update App.jsx to treat <code>/dashboard/:id/settings</code> as a layout containing nested routes. Until then, you can view your legacy configuration panels by scrolling down.
            </p>
            <DomainSetup />
            <div style={{ height: "64px" }} />
            <GeneralSettings />
          </div>
        )}

      </div>
      
      {/* Delete Confirmation Modal (Moved out of general settings so it mounts at the Root level nicely) */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px", width: "100%", maxWidth: "400px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", color: "#dc2626", marginTop: 0 }}>Delete {project.project_name}?</h2>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>This will permanently delete the project and files. This action cannot be undone.</p>
            
            <input 
              type="text" 
              placeholder={`Type ${project.project_name} to confirm`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "24px" }}
            />
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => { setShowModal(false); setConfirmText(''); }} style={{ padding: "10px 16px", background: "none", border: "1px solid #e2e8f0", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={!canConfirmDelete} style={{ padding: "10px 16px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "8px", cursor: canConfirmDelete ? "pointer" : "not-allowed", opacity: canConfirmDelete ? 1 : 0.5 }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}