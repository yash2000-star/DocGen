import { useEffect } from "react";
import { getUserProjects } from "../lib/projects";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    getUserProjects().then(({ data }) => {
      if (data && data.length > 0) {
        // EXACT MINTLIFY UX: Silently route straight into their first project's HOME page
        navigate(`/dashboard/${data[0].id}`, { replace: true });
      } else {
        // If they have no projects, force them to the New Project screen
        navigate(`/dashboard/new`, { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div style={{ height: "100vh", backgroundColor: "var(--bg-sidebar)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px", fontWeight: "500" }}>
      Loading your workspace...
    </div>
  );
}