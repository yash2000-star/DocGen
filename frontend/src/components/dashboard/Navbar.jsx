import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { logout, supabase } from "../../lib/auth"; // <-- Make sure supabase is exported from your auth.js!

// The 5 onboarding steps [cite: 279-285]
const STEPS = [
  { key: 'imported_repo',       label: 'Import your first repository' },
  { key: 'viewed_docs',         label: 'View your generated docs' },
  { key: 'tried_ask_ai',        label: 'Try the Ask AI chat' },
  { key: 'configured_brand',    label: 'Configure your brand color' },
  { key: 'added_custom_domain', label: 'Add a custom domain' },
];

export default function Navbar() {
  const { user } = useAuth();
  
  // Onboarding State
  const [onboarding, setOnboarding] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 1. Fetch the user's onboarding progress on mount
  useEffect(() => {
    if (!user) return;

    const fetchOnboarding = async () => {
      let { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // If they don't have a row yet, let's create one silently
      if (!data && error?.code === 'PGRST116') {
        const { data: newData } = await supabase
          .from('user_onboarding')
          .insert({ user_id: user.id })
          .select()
          .single();
        data = newData;
      }
      
      setOnboarding(data);
    };

    fetchOnboarding();
  }, [user]);

  // 2. Close dropdown if user clicks outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate how many steps are left [cite: 286]
  const remaining = STEPS.filter(s => !onboarding?.[s.key]).length;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)" }}>
      
      {/* LEFT: Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "24px", height: "24px", backgroundColor: "var(--primary-brand)", borderRadius: "6px" }}></div>
        <span style={{ fontWeight: "700", fontSize: "18px", color: "var(--text-heading)" }}>DocGen</span>
      </div>

      {/* RIGHT: Actions & Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        
        {/* NEW: Onboarding Checklist Dropdown [cite: 287-311] */}
        {remaining > 0 && (
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", backgroundColor: "white", border: "1px solid var(--border-color)", borderRadius: "99px", cursor: "pointer", fontSize: "13px", fontWeight: "600", color: "var(--text-heading)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Things to do
              <span style={{ backgroundColor: "#f1f5f9", padding: "2px 6px", borderRadius: "99px", fontSize: "11px", color: "var(--text-muted)" }}>
                {remaining}
              </span>
            </button>

            {dropdownOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', width: '280px', zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "var(--text-heading)" }}>Get started with DocGen</h3>
                {STEPS.map(s => {
                  const isDone = onboarding?.[s.key];
                  return (
                    <div key={s.key} style={{ display: 'flex', gap: '10px', padding: '8px 0', alignItems: 'flex-start' }}>
                      <div style={{ marginTop: "2px", width: "16px", height: "16px", borderRadius: "4px", border: isDone ? "none" : "1px solid #cbd5e1", backgroundColor: isDone ? "#059669" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isDone && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: "500", textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#94a3b8' : 'var(--text-heading)' }}>
                        {s.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <span style={{ fontSize: "14px", color: "var(--text-muted)", marginLeft: "8px" }}>{user?.email}</span>
        
        <Link 
          to="/dashboard/new" 
          style={{ padding: "8px 16px", backgroundColor: "var(--text-heading)", color: "var(--bg-main)", borderRadius: "6px", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}
        >
          New Project
        </Link>
        <button onClick={logout} style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-main)", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}>
          Logout
        </button>
      </div>
    </div>
  );
}