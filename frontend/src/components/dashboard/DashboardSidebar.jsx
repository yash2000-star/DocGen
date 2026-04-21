import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { getUserProjects } from "../../lib/projects";

export default function DashboardSidebar() {
  const location = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    getUserProjects().then(({ data }) => {
      if (data) setProjects(data);
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProjectChange = (newProjectId) => {
    setIsDropdownOpen(false);
    navigate(`/dashboard/${newProjectId}`);
  };

  const isActive = (path) => location.pathname === path;

  // 1. Typography & Colors for links
  const linkStyle = (path) => ({
    display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px",
    borderRadius: "8px", textDecoration: "none", fontSize: "13px",
    fontWeight: "500",
    color: isActive(path) ? "#059669" : "#64748b",
    backgroundColor: "transparent",
    transition: "all 0.2s"
  });

  const iconColor = (path) => isActive(path) ? "#059669" : "#64748b";

  // Add dummy active logic for new paths so they work stylistically
  const dummyLinkStyle = {
    display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px",
    borderRadius: "8px", textDecoration: "none", fontSize: "13px",
    fontWeight: "500", color: "#64748b",
    backgroundColor: "transparent", transition: "all 0.2s", cursor: "pointer"
  };

  const currentProject = projects.find(p => p.id === id) || projects[0];

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", width: "250px", borderRight: "1px solid #e2e8f0", backgroundColor: "#ffffff", minHeight: "100vh", padding: "28px 20px", flexShrink: 0, display: "flex", flexDirection: "column" }}>

      {/* --- PRESERVED PROJECT SWITCHER --- */}
      <div style={{ marginBottom: "28px", position: "relative" }} ref={dropdownRef}>
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px", border: "none", backgroundColor: "transparent", color: "#0f172a",
            cursor: "pointer", transition: "all 0.2s"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#022c22", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2z"/></svg>
            </div>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "14px", fontWeight: "600" }}>
              {currentProject?.project_name}
            </span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "#94a3b8" }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {isDropdownOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 50,
            backgroundColor: "#ffffff", border: "1px solid #e2e8f0",
            borderRadius: "8px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            maxHeight: "250px", overflowY: "auto", padding: "6px"
          }}>
            {projects.map((proj) => (
              <button
                key={proj.id}
                onClick={() => handleProjectChange(proj.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 10px", borderRadius: "6px", border: "none",
                  backgroundColor: proj.id === id ? "#f1f5f9" : "transparent",
                  color: proj.id === id ? "#0f172a" : "#64748b",
                  fontSize: "13px", fontWeight: proj.id === id ? "600" : "500",
                  cursor: "pointer", textAlign: "left", transition: "background-color 0.1s"
                }}
                onMouseOver={(e) => { if (proj.id !== id) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                onMouseOut={(e) => { if (proj.id !== id) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div style={{ width: "16px", height: "16px", borderRadius: "4px", backgroundColor: proj.id === id ? "#0f172a" : "#e2e8f0", flexShrink: 0 }}></div>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {proj.project_name}
                </span>
              </button>
            ))}
            
            <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "6px 0" }}></div>
            
            <Link to="/dashboard/new" style={{
               width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "6px", textDecoration: "none", color: "#10b981", fontSize: "13px", fontWeight: "600", transition: "background-color 0.1s"
            }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#ecfdf5"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Create New Project
            </Link>
          </div>
        )}
      </div>

      {/* --- 2. TOP NAVIGATION GROUP --- */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <Link to={`/dashboard/${id}`} style={linkStyle(`/dashboard/${id}`)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          Home
        </Link>
        
        <Link to={`/dashboard/${id}/editor`} style={linkStyle(`/dashboard/${id}/editor`)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/editor`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Editor
        </Link>

        <Link to={`/dashboard/${id}/analytics`} style={linkStyle(`/dashboard/${id}/analytics`)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/analytics`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          Analytics
        </Link>

        <Link to={`/dashboard/${id}/settings`} style={linkStyle(`/dashboard/${id}/settings`)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/settings`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Settings
        </Link>
      </div>

      {/* --- 3. AGENTS GROUP --- */}
      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px 12px" }}>
          Agents
        </h3>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <Link to={`#`} style={dummyLinkStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                Agent
              </div>
              <span style={{ backgroundColor: "#a7f3d0", color: "#065f46", fontSize: "10px", fontWeight: "600", padding: "2px 6px", borderRadius: "99px" }}>
                New
              </span>
            </div>
          </Link>
          
          <Link to={`#`} style={dummyLinkStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            Assistant
          </Link>
          
          <Link to={`#`} style={dummyLinkStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            Workflows
          </Link>
          
          <Link to={`#`} style={dummyLinkStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 17 12 22 12"></polyline></svg>
            MCP
          </Link>
        </div>
      </div>

      {/* --- 4. FOOTER --- */}
      <div style={{ marginTop: "auto" }}>
        <button style={{ ...dummyLinkStyle, width: "100%", border: "none", cursor: "pointer", background: "none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          Collapse
        </button>
      </div>

    </div>
  );
}