import { Link, useLocation, useParams } from "react-router-dom";

export default function DashboardSidebar() {
  const location = useLocation();
  const { id } = useParams(); // Get current project ID

  // Helper to check if route is active
  const isActive = (path) => location.pathname === path;

  // Active vs Inactive styles [cite: 330-337]
  const linkStyle = (path) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    borderRadius: "8px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: isActive(path) ? "600" : "500",
    color: isActive(path) ? "#16a34a" : "#64748b",
    backgroundColor: isActive(path) ? "#f0fdf4" : "transparent",
    transition: "all 0.2s"
  });

  const iconColor = (path) => isActive(path) ? "#16a34a" : "#94a3b8";

  return (
    <div style={{ width: "240px", borderRight: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)", minHeight: "calc(100vh - 65px)", padding: "24px 16px", flexShrink: 0 }}>
      
      {/* MAIN NAVIGATION [cite: 318-322] */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "32px" }}>
        <Link to={`/dashboard/${id}`} style={linkStyle(`/dashboard/${id}`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          Home
        </Link>
        
        <Link to={`/dashboard/${id}/editor`} style={linkStyle(`/dashboard/${id}/editor`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/editor`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          Editor
        </Link>

        <Link to={`/dashboard/${id}/navigation`} style={linkStyle(`/dashboard/${id}/navigation`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/navigation`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          Navigation
        </Link>
        
        <Link to={`/dashboard/${id}/analytics`} style={linkStyle(`/dashboard/${id}/analytics`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/analytics`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          Analytics
        </Link>
        
        <Link to={`/dashboard/${id}/settings`} style={linkStyle(`/dashboard/${id}/settings`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/settings`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Settings
        </Link>
      </div>

      {/* AGENTS SECTION [cite: 323-326] */}
      <div>
        <h4 style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 12px 12px" }}>Agents</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          
          <Link to={`/dashboard/${id}/agent`} style={linkStyle(`/dashboard/${id}/agent`)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/agent`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            Agent
          </Link>
          
          <Link to={`/dashboard/${id}/assistant`} style={linkStyle(`/dashboard/${id}/assistant`)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/assistant`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            Assistant
          </Link>
          
          <Link to={`/dashboard/${id}/workflows`} style={linkStyle(`/dashboard/${id}/workflows`)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor(`/dashboard/${id}/workflows`)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Workflows
            <span style={{ marginLeft: "auto", fontSize: "10px", backgroundColor: "#bbf7d0", color: "#166534", padding: "2px 6px", borderRadius: "99px", fontWeight: "600" }}>NEW</span>
          </Link>
        </div>
      </div>
      
    </div>
  );
}