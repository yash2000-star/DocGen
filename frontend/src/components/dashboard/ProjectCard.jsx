import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

// Status badge color logic exactly as defined in your spec
const statusColors = {
  live:     { bg: '#ecfdf5', color: '#059669', label: 'Live' },
  building: { bg: '#fffbeb', color: '#d97706', label: 'Building' },
  failed:   { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
  pending:  { bg: '#f1f5f9', color: '#64748b', label: 'Pending' },
};

export default function ProjectCard({ project }) {
  // Fallback to 'pending' if status is unknown
  const status = statusColors[project.status] || statusColors.pending;

  return (
    <div style={{ border: "1px solid var(--border-color)", borderRadius: "12px", padding: "20px", backgroundColor: "var(--bg-main)", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      
      {/* Header: Project Name & Status Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ overflow: "hidden" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {project.project_name}
          </h3>
          <a href={project.repo_url} target="_blank" rel="noreferrer" style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "none", display: "block", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {project.repo_url}
          </a>
        </div>
        <span style={{ backgroundColor: status.bg, color: status.color, padding: "4px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: "500", flexShrink: 0 }}>
          {status.label}
        </span>
      </div>

      {/* Stats: File Count & Last Updated Date */}
      <div style={{ display: "flex", gap: "24px", fontSize: "13px", color: "var(--text-muted)" }}>
        <div>
          <strong style={{ color: "var(--text-main)", fontWeight: "600" }}>{project.file_count}</strong> files
        </div>
        <div>
          Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
        <Link to={`/dashboard/${project.id}`} style={{ flex: 1, textAlign: "center", padding: "8px", backgroundColor: "var(--primary-brand)", color: "white", textDecoration: "none", borderRadius: "6px", fontSize: "14px", fontWeight: "500", transition: "opacity 0.2s" }} onMouseOver={e => e.target.style.opacity = 0.9} onMouseOut={e => e.target.style.opacity = 1}>
          Overview
        </Link>
        <Link to={`/dashboard/${project.id}/settings`} style={{ flex: 1, textAlign: "center", padding: "8px", backgroundColor: "var(--bg-sidebar)", color: "var(--text-main)", textDecoration: "none", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "14px", fontWeight: "500", transition: "background 0.2s" }} onMouseOver={e => e.target.style.backgroundColor = "var(--bg-main)"} onMouseOut={e => e.target.style.backgroundColor = "var(--bg-sidebar)"}>
          Settings
        </Link>
      </div>
      
    </div>
  );
}