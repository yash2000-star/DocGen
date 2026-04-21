import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, logout } from "../../lib/auth";

export default function CommandPalette() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projects, setProjects] = useState([]);
  const inputRef = useRef(null);

  // 1. Listen for Cmd+K or Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") setIsOpen(false);
    };

    const handleOpenSearch = () => setIsOpen(true);
    
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("open-dashboard-search", handleOpenSearch); 

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("open-dashboard-search", handleOpenSearch);
    };
  }, []);

  // 2. Fetch all user projects once when the modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setSelectedIndex(0);
      
      supabase.from('projects').select('id, project_name')
        .then(({ data }) => setProjects(data || []))
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  // 3. The Search Engine
  useEffect(() => {
    // Define static actions that are always available
    const staticActions = [
      { id: 'home', title: "Go to Dashboard Home", type: "action", route: "/dashboard" },
      { id: 'new', title: "Create New Project", type: "action", route: "/dashboard/new" },
      { id: 'logout', title: "Log Out", type: "action", action: logout }
    ];

    // Map database projects into searchable items
    const projectActions = projects.map(p => ({
      id: p.id,
      title: `Go to ${p.project_name}`,
      type: "project",
      route: `/dashboard/${p.id}`
    }));

    const allItems = [...projectActions, ...staticActions];

    if (!query.trim()) {
      setResults(allItems); // Show all by default
      return;
    }

    const searchTerms = query.toLowerCase().split(' ').filter(Boolean);
    const filtered = allItems.filter(item => {
      return searchTerms.every(term => item.title.toLowerCase().includes(term));
    }).slice(0, 6); // Keep it clean

    setResults(filtered);
    setSelectedIndex(0);
  }, [query, projects]);

  // 4. Execute the command
  function executeSearch(item) {
    setIsOpen(false);
    if (item.action) {
      item.action();
    } else if (item.route) {
      navigate(item.route);
    }
  }

  function handleModalKeyDown(e) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSearch(results[selectedIndex]);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      paddingTop: "12vh", zIndex: 9999
    }} onClick={() => setIsOpen(false)}>
      
      <div 
        style={{
          width: "100%", maxWidth: "600px", backgroundColor: "#ffffff",
          borderRadius: "12px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column"
        }}
        onClick={e => e.stopPropagation()} 
      >
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "12px" }}>
             <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleModalKeyDown}
            style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", color: "#0f172a", backgroundColor: "transparent" }}
          />
          <button onClick={() => setIsOpen(false)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", color: "#64748b", cursor: "pointer", fontWeight: "600" }}>ESC</button>
        </div>

        {results.length > 0 && (
          <div style={{ padding: "12px", maxHeight: "350px", overflowY: "auto" }}>
            {results.map((item, i) => {
              const isActive = i === selectedIndex;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => executeSearch(item)}
                  style={{
                    padding: "12px 16px", cursor: "pointer", borderRadius: "8px",
                    backgroundColor: isActive ? "#f8fafc" : "transparent",
                    display: "flex", alignItems: "center", gap: "10px"
                  }}
                >
                  {/* Dynamic Icon based on type */}
                  {item.type === "project" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  )}
                  <span style={{ fontSize: "14px", color: "#0f172a", fontWeight: isActive ? "600" : "500" }}>{item.title}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}