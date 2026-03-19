import { useState, useEffect } from "react";
import { getUserProjects } from "../lib/projects";
import Navbar from "../components/dashboard/Navbar";
import ProjectCard from "../components/dashboard/ProjectCard";
import EmptyState from "../components/dashboard/EmptyState";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getUserProjects().then(({ data }) => {
      if (data && data.length > 0) {
        navigate(`/dashboard/${data[0].id}`, { replace: true });
      } else {
        setProjects([]); 
        setLoading(false); 
      }
    });
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)" }}>
        <Navbar />
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "100px", color: "var(--text-muted)" }}>
          Loading projects...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-heading)", margin: "0 0 8px 0" }}>Projects</h1>
          <p style={{ fontSize: "15px", color: "var(--text-muted)", margin: 0 }}>Manage your generated documentation sites.</p>
        </div>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}