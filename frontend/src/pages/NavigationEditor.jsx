import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/auth";
import { apiFetch } from '../lib/api';

export default function NavigationEditor() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  
  // The state holding the ordered list of categories
  const [categories, setCategories] = useState(["Getting Started", "API Reference"]);
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // 1. Fetch the project details
  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single()
      .then(({ data }) => setProject(data));
  }, [id]);

  // 2. Fetch the existing navigation array from the built docs.json
  useEffect(() => {
    if (!project) return;
    
    const API_URL = import.meta.env.VITE_API_URL;
    fetch(`${API_URL}/api/static/${project.tenant_name}/${project.project_name}/docs.json`, { cache: "no-store" })
      .then(res => {
        if (res.ok) return res;
        return fetch(`${API_URL}/api/static/${project.tenant_name}/${project.project_name}/mint.json`, { cache: "no-store" });
      })
      .then(res => res.ok ? res.json() : null)
      .then(config => {
         if (config?.navigation && Array.isArray(config.navigation)) {
             // Mintlify allows objects or strings. We will map everything to clean strings for the editor.
             const flatNav = config.navigation.map(n => typeof n === 'string' ? n : n.group);
             if (flatNav.length > 0) setCategories(flatNav);
         }
      })
      .catch(console.error);
  }, [project]);

  // --- REORDERING LOGIC ---
  const moveUp = (index) => {
    if (index === 0) return;
    const newCats = [...categories];
    [newCats[index - 1], newCats[index]] = [newCats[index], newCats[index - 1]];
    setCategories(newCats);
  };

  const moveDown = (index) => {
    if (index === categories.length - 1) return;
    const newCats = [...categories];
    [newCats[index + 1], newCats[index]] = [newCats[index], newCats[index + 1]];
    setCategories(newCats);
  };

  const removeCategory = (index) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const addCategory = () => {
    if (!newCategory.trim() || categories.includes(newCategory.trim())) return;
    setCategories([...categories, newCategory.trim()]);
    setNewCategory("");
  };

  // --- SAVE TO BACKEND & SYNC TO GITHUB ---
  const saveNavigation = async () => {
    setSaving(true);
    try {
      // 1. Save to your local Express backend
      await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant: project.tenant_name,
          version: project.project_name,
          navigation: categories 
        })
      });

      // 2. Fetch the existing full config so we don't accidentally delete Theme settings
      const API_URL = import.meta.env.VITE_API_URL;
      let resConfig = await fetch(`${API_URL}/api/static/${project.tenant_name}/${project.project_name}/docs.json`, { cache: "no-store" });
      if (!resConfig.ok) {
        resConfig = await fetch(`${API_URL}/api/static/${project.tenant_name}/${project.project_name}/mint.json`, { cache: "no-store" });
      }
      const currentConfig = resConfig.ok ? await resConfig.json() : {};

      // 3. Merge the existing config with our new navigation array
      const updatedConfig = { ...currentConfig, navigation: categories };

      // 4. Grab the GitHub access token from the Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const githubToken = session?.provider_token;

      // 5. If the user logged in with GitHub, push the commit!
      if (githubToken) {
        await apiFetch('/api/github/save-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant: project.tenant_name,
            version: project.project_name,
            configData: updatedConfig,
            githubToken
          })
        });
      }

      alert("Navigation saved and synced to GitHub! Rebuilding engine...");
    } catch (error) {
      console.error(error);
      alert("Failed to save navigation.");
    } finally {
      setSaving(false);
    }
  };

  if (!project) return <div style={{ padding: "40px" }}>Loading Navigation Editor...</div>;

  return (
    <div style={{ paddingBottom: "60px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "800px", margin: "40px auto", padding: "0 32px" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#0f172a", margin: "0 0 8px 0" }}>Sidebar Navigation</h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              Drag or move categories to define the exact order they appear in your sidebar.
            </p>
          </div>
          
          <button 
            onClick={saveNavigation} 
            disabled={saving}
            style={{ 
              padding: "10px 20px", backgroundColor: "#0f172a", color: "#ffffff", 
              border: "none", borderRadius: "8px", fontWeight: "600", cursor: saving ? "not-allowed" : "pointer"
            }}
          >
            {saving ? "Saving & Rebuilding..." : "Save Sidebar Order"}
          </button>
        </div>

        {/* Add New Category Input */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <input 
            type="text" 
            placeholder="e.g. Authentication" 
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            style={{ flex: 1, padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none" }}
          />
          <button 
            onClick={addCategory}
            style={{ padding: "0 20px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", fontWeight: "600", color: "#0f172a", cursor: "pointer" }}
          >
            Add Category
          </button>
        </div>

        {/* The Reorderable List */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
          {categories.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>No categories defined yet.</div>
          )}
          
          {categories.map((cat, index) => (
            <div key={index} style={{ 
              display: "flex", alignItems: "center", justifyContent: "space-between", 
              padding: "16px 20px", borderBottom: index === categories.length - 1 ? "none" : "1px solid #e2e8f0",
              backgroundColor: "#f8fafc"
            }}>
              
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "14px" }}>{index + 1}.</span>
                <strong style={{ color: "#0f172a", fontSize: "15px" }}>{cat}</strong>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button onClick={() => moveUp(index)} disabled={index === 0} style={{ background: "none", border: "none", cursor: index === 0 ? "not-allowed" : "pointer", opacity: index === 0 ? 0.3 : 1 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                </button>
                <button onClick={() => moveDown(index)} disabled={index === categories.length - 1} style={{ background: "none", border: "none", cursor: index === categories.length - 1 ? "not-allowed" : "pointer", opacity: index === categories.length - 1 ? 0.3 : 1 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div style={{ width: "1px", height: "24px", backgroundColor: "#e2e8f0", margin: "0 8px" }}></div>
                <button onClick={() => removeCategory(index)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}