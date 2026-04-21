export default function Authentication() {
  return (
    <div style={{ maxWidth: "600px", margin: "100px auto 0", textAlign: "center" }}>
      
      {/* Icon Box */}
      <div style={{ 
        width: "64px", height: "64px", backgroundColor: "#f8fafc", 
        border: "1px solid #e2e8f0", borderRadius: "16px", 
        display: "flex", alignItems: "center", justifyContent: "center", 
        margin: "0 auto 24px auto" 
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      </div>

      {/* Heading & Subtext */}
      <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a", marginBottom: "12px", marginTop: 0 }}>
        Enable Authentication
      </h2>
      <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 32px 0" }}>
        Enable authentication to gate access to your content.
      </p>

      {/* Paywall Buttons */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <button style={{ 
          backgroundColor: "#0f172a", color: "#ffffff", padding: "10px 24px", 
          borderRadius: "8px", border: "none", fontSize: "14px", fontWeight: "500", 
          cursor: "pointer" 
        }}>
          Upgrade to Pro
        </button>
        <a href="#" style={{ color: "#64748b", fontSize: "13px", textDecoration: "none", fontWeight: "500" }}>
          Learn more &gt;
        </a>
      </div>

    </div>
  );
}
