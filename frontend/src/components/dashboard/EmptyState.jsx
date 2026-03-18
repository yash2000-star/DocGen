import { useNavigate } from "react-router-dom";

export default function EmptyState() {
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", textAlign: "center" }}>
      {/* DocGen Logo Mark */}
      <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{ marginBottom: "16px" }}>
        <rect width="32" height="32" rx="8" fill="#3b82f6"/>
        <path d="M10 12C10 10.8954 10.8954 10 12 10H20C21.1046 10 22 10.8954 22 12V20C22 21.1046 21.1046 22 20 22H12C10.8954 22 10 21.1046 10 20V12Z" fill="white" fillOpacity="0.8"/>
      </svg>
      
      <h2 style={{ fontSize: "20px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px", marginTop: "0" }}>
        No documentation yet
      </h2>
      <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "15px" }}>
        Import your first GitHub repository to get started
      </p>
      
      <button 
        onClick={() => navigate('/dashboard/new')} 
        style={{ backgroundColor: "var(--primary-brand)", color: "white", padding: "10px 20px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: "600", cursor: "pointer", transition: "opacity 0.2s" }}
        onMouseOver={e => e.target.style.opacity = 0.9} 
        onMouseOut={e => e.target.style.opacity = 1}
      >
        Import your first repo
      </button>
    </div>
  );
}