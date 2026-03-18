import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { logout } from "../../lib/auth";

export default function Navbar() {
  const { user } = useAuth();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "24px", height: "24px", backgroundColor: "var(--primary-brand)", borderRadius: "6px" }}></div>
        <span style={{ fontWeight: "700", fontSize: "18px", color: "var(--text-heading)" }}>DocGen</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>{user?.email}</span>
        <Link 
          to="/dashboard/new" 
          style={{ padding: "8px 16px", backgroundColor: "var(--text-heading)", color: "var(--bg-main)", borderRadius: "6px", textDecoration: "none", fontSize: "14px", fontWeight: "500" }}
        >
          New Project
        </Link>
        <button onClick={logout} style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-main)", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>
          Logout
        </button>
      </div>
    </div>
  );
}