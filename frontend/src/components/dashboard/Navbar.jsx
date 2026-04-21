import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { logout, supabase } from "../../lib/auth"; 
import CommandPalette from "./CommandPalette";

const STEPS = [
  { key: 'imported_repo',       label: 'Import your first repository' },
  { key: 'viewed_docs',         label: 'View your generated docs' },
  { key: 'tried_ask_ai',        label: 'Try the Ask AI chat' },
  { key: 'configured_brand',    label: 'Configure your brand color' },
  { key: 'added_custom_domain', label: 'Add a custom domain' },
];

export default function Navbar() {
  const { user } = useAuth();
  
  const [onboarding, setOnboarding] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const fetchOnboarding = async () => {
      let { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .single();

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

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const remaining = STEPS.filter(s => !onboarding?.[s.key]).length;
  
  // Get user initial for avatar
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "12px 24px", backgroundColor: "#ffffff", height: "65px", borderBottom: "none", boxShadow: "none" }}>
      
      {/* RIGHT SIDE ONLY: Search, Actions, Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        
        {/* 1. Mintlify Search Bar */}
       {/* 1. Mintlify Search Bar */}
        <div 
          onClick={() => window.dispatchEvent(new CustomEvent("open-dashboard-search"))}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 12px", width: "240px", cursor: "pointer", color: "#94a3b8" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span style={{ fontSize: "13px", fontWeight: "500" }}>Search</span>
          </div>
          <span style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", fontWeight: "600", color: "#64748b" }}>⌘K</span>
        </div>

        {/* Removed Inbox Icon as per Mintlify UI */}

        {/* 3. Things to do Dropdown (Your existing logic) */}
        {remaining > 0 && (
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 12px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "99px", cursor: "pointer", fontSize: "13px", fontWeight: "600", color: "#334155", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#10b981"><path d="M12 2L2 22h20L12 2z"/></svg>
              Things to do
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#94a3b8" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>

            {dropdownOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', width: '280px', zIndex: 100, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>Get started with DocGen</h3>
                {STEPS.map(s => {
                  const isDone = onboarding?.[s.key];
                  return (
                    <div key={s.key} style={{ display: 'flex', gap: '10px', padding: '8px 0', alignItems: 'flex-start' }}>
                      <div style={{ marginTop: "2px", width: "16px", height: "16px", borderRadius: "4px", border: isDone ? "none" : "1px solid #cbd5e1", backgroundColor: isDone ? "#059669" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isDone && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: "500", textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#94a3b8' : '#334155' }}>
                        {s.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. Mintlify Avatar (Click to Logout for now) */}
        <button 
          onClick={logout} 
          title="Sign out"
          style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#9333ea", color: "#ffffff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginLeft: "4px" }}
        >
          {userInitial}
        </button>
        
      </div>

      <CommandPalette />
    </div>
  );
}