import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { supabase } from "../lib/auth";
import { updateProjectStatus } from "../lib/projects";
import Navbar from "../components/dashboard/Navbar";

// Status badge styles
const statusColors = {
  live:     { bg: '#ecfdf5', color: '#059669', label: 'Live' },
  building: { bg: '#fffbeb', color: '#d97706', label: 'Building' },
  failed:   { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
  pending:  { bg: '#f1f5f9', color: '#64748b', label: 'Pending' },
};

// Log level styles [cite: 248]
const logColors = {
  info:     { bg: '#f3f4f6', color: '#4b5563' },
  success:  { bg: '#ecfdf5', color: '#059669' },
  error:    { bg: '#fef2f2', color: '#dc2626' }
};

export default function ProjectOverview() {
  const { id } = useParams(); // Get the ID from the URL [cite: 219]
  const [project, setProject] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch data on mount [cite: 222-228]
  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch project details
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      setProject(projectData);

      // 2. Fetch the last 20 build logs
      const { data: logsData } = await supabase
        .from('build_logs')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
        
      setLogs(logsData || []);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Handle forcing a new build [cite: 234-247]
  const handleRegenerate = async () => {
    await updateProjectStatus(project.id, 'building', 0);
    setProject(p => ({ ...p, status: 'building' }));
    
    // Call the backend without waiting for it to finish (it runs in the background)
    fetch('http://localhost:4000/api/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl: project.repo_url,
        projectName: project.project_name,
        tenantName: project.tenant_name
      })
    }).catch(err => console.error("Trigger failed", err));
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)" }}>
        <Navbar />
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading project details...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)" }}>
        <Navbar />
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-heading)" }}>Project not found.</div>
      </div>
    );
  }

  const status = statusColors[project.status] || statusColors.pending;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 32px" }}>
        
        {/* TOP SECTION: Header [cite: 213] */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px", backgroundColor: "var(--bg-main)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "var(--text-heading)" }}>{project.project_name}</h1>
              <span style={{ backgroundColor: status.bg, color: status.color, padding: "4px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: "600" }}>
                {status.label}
              </span>
            </div>
            <a href={project.repo_url} target="_blank" rel="noreferrer" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px", display: "inline-block", marginBottom: "8px" }}>
              {project.repo_url} ↗
            </a>
          </div>
          
          <div style={{ display: "flex", gap: "12px" }}>
            <Link to={`/dashboard/${project.id}/settings`} style={{ padding: "10px 16px", backgroundColor: "var(--bg-sidebar)", color: "var(--text-main)", border: "1px solid var(--border-color)", borderRadius: "8px", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}>
              Settings
            </Link>
            <button onClick={handleRegenerate} disabled={project.status === 'building'} style={{ padding: "10px 16px", backgroundColor: "var(--primary-brand)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: project.status === 'building' ? "not-allowed" : "pointer", opacity: project.status === 'building' ? 0.7 : 1 }}>
              {project.status === 'building' ? 'Generating...' : 'Regenerate Docs'}
            </button>
          </div>
        </div>

        {/* MIDDLE SECTION: Stat Cards [cite: 214, 230-232] */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "40px" }}>
          <div style={{ backgroundColor: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: "500" }}>Files Generated</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: "var(--text-heading)" }}>{project.file_count}</div>
          </div>
          
          <div style={{ backgroundColor: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: "500" }}>Build Status</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: status.color }}>{status.label}</div>
          </div>
          
          <div style={{ backgroundColor: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: "500" }}>Last Updated</div>
            <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", marginTop: "4px" }}>
              {formatDistanceToNow(new Date(project.updated_at))} ago
            </div>
          </div>

          <div style={{ backgroundColor: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: "500" }}>Deploy URL</div>
            {project.status === 'live' ? (
              <Link to="/docs" style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary-brand)", textDecoration: "none" }}>View Site ↗</Link>
            ) : (
              <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>Not available</div>
            )}
          </div>
        </div>

        {/* BOTTOM SECTION: Build Logs [cite: 215, 248-251] */}
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "16px" }}>Recent Build Logs</h2>
          <div style={{ backgroundColor: "var(--bg-main)", borderRadius: "12px", border: "1px solid var(--border-color)", overflow: "hidden" }}>
            {logs.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>No build logs yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--text-muted)", width: "180px" }}>Timestamp</th>
                    <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--text-muted)", width: "100px" }}>Level</th>
                    <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--text-muted)" }}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const levelStyle = logColors[log.level] || logColors.info;
                    return (
                      <tr key={log.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "13px" }}>
                          {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ backgroundColor: levelStyle.bg, color: levelStyle.color, padding: "2px 8px", borderRadius: "99px", fontSize: "12px", fontWeight: "500", textTransform: "uppercase" }}>
                            {log.level}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-main)" }}>{log.message}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}