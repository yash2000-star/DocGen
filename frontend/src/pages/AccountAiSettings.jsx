import { Link } from "react-router-dom";
import Navbar from "../components/dashboard/Navbar";
import AiProviders from "./settings/AiProviders";

// AI provider settings outside any project, so new users can connect a key
// before importing their first repository.
export default function AccountAiSettings() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: "860px", margin: "40px auto", padding: "0 20px" }}>
        <Link to="/dashboard/new" style={{ display: "inline-block", fontSize: "13px", color: "#64748b", textDecoration: "none", marginBottom: "20px" }}>
          ← Back to importing a repository
        </Link>
        <AiProviders />
      </div>
    </div>
  );
}
