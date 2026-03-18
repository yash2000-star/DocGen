import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#000", color: "#fff" }}>
      <h1 style={{ fontSize: "48px", marginBottom: "20px" }}>Beautiful docs, written by <span style={{ color: "#3b82f6" }}>AI</span></h1>
      <p style={{ color: "#888", marginBottom: "40px" }}>The landing page UI is under construction...</p>
      
      <Link to="/login" style={{ padding: "12px 24px", backgroundColor: "#3b82f6", color: "white", textDecoration: "none", borderRadius: "8px", fontWeight: "bold" }}>
        Get Started Free
      </Link>
    </div>
  );
}