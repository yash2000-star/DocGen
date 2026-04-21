import { useState } from "react";

export default function Billing() {
  const [yearly, setYearly] = useState(false);

  const containerStyle = {
    maxWidth: "1000px",
    fontFamily: "Inter, system-ui, sans-serif",
    paddingBottom: "100px"
  };

  const headerRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "32px",
    marginBottom: "32px",
  };

  const h4Style = {
    fontSize: "16px",
    fontWeight: "600",
    color: "#0f172a",
    margin: "0 0 4px 0"
  };

  const pStyle = {
    fontSize: "14px",
    color: "#64748b",
    margin: 0
  };

  const toggleStyle = {
    width: "36px", 
    height: "20px", 
    backgroundColor: yearly ? "#10b981" : "#e2e8f0", 
    borderRadius: "20px", 
    position: "relative", 
    cursor: "pointer", 
    transition: "background-color 0.2s"
  };

  const thumbStyle = {
    width: "16px", 
    height: "16px", 
    backgroundColor: "#ffffff", 
    borderRadius: "50%", 
    position: "absolute", 
    top: "2px", 
    left: yearly ? "18px" : "2px", 
    transition: "left 0.2s", 
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
  };

  const checkSvg = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );

  return (
    <div style={containerStyle}>
      
      {/* Header Row */}
      <div style={headerRowStyle}>
        <div>
          <h4 style={h4Style}>Billing plan</h4>
          <p style={pStyle}>View and manage your billing plan</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "4px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", fontSize: "12px", fontWeight: "500", color: "#475569" }}>
            Current plan: Hobby
          </div>
          <button style={{ backgroundColor: "#0f172a", color: "#ffffff", padding: "8px 16px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            Upgrade <span style={{ fontSize: "14px" }}>↗</span>
          </button>
        </div>
      </div>

      {/* Plans Container Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h4 style={{ ...h4Style, fontSize: "14px" }}>Plans</h4>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#475569", fontWeight: "500" }}>Save with yearly billing</span>
          <div onClick={() => setYearly(!yearly)} style={toggleStyle}>
            <div style={thumbStyle}></div>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
        
        {/* Card 1: Hobby */}
        <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "32px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#0f172a", margin: 0 }}>Hobby</h3>
            <span style={{ fontSize: "10px", fontWeight: "700", color: "#059669", backgroundColor: "#ecfdf5", padding: "2px 8px", borderRadius: "12px", letterSpacing: "0.5px" }}>CURRENT PLAN</span>
          </div>
          <div style={{ marginBottom: "24px", height: "38px", display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: "32px", fontWeight: "700", color: "#0f172a", lineHeight: "1" }}>$0</span>
            <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "4px", marginBottom: "2px" }}>/month</span>
          </div>
          <button style={{ width: "100%", padding: "10px", backgroundColor: "#e2e8f0", color: "#64748b", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "not-allowed", marginBottom: "32px" }}>
            Current plan
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
            {[
              "Full platform",
              "Custom domain",
              "Web editor",
              "API playground"
            ].map(feature => (
              <div key={feature} style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "14px", color: "#334155" }}>
                {checkSvg}
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Pro */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "32px 24px", display: "flex", flexDirection: "column", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#0f172a", margin: 0 }}>Pro</h3>
          </div>
          <div style={{ marginBottom: "24px", height: "38px", display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: "32px", fontWeight: "700", color: "#0f172a", lineHeight: "1" }}>${yearly ? "200" : "250"}</span>
            <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "4px", marginBottom: "2px" }}>/month</span>
          </div>
          <button style={{ width: "100%", padding: "10px", backgroundColor: "#ffffff", color: "#0f172a", border: "1px solid #0f172a", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginBottom: "32px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            Upgrade
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
            {[
              "Everything in Hobby",
              "Invite team members",
              "AI Assistant",
              "Analytics",
              "Webhooks",
              "API keys"
            ].map((feature, i) => (
              <div key={feature} style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "14px", color: i === 0 ? "#0f172a" : "#334155", fontWeight: i === 0 ? "600" : "400" }}>
                {checkSvg}
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Enterprise */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "32px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#0f172a", margin: 0 }}>Enterprise</h3>
          </div>
          <div style={{ marginBottom: "32px", display: "flex", alignItems: "flex-end", height: "38px" }}>
            <span style={{ fontSize: "20px", fontWeight: "600", color: "#0f172a", lineHeight: "1" }}>Contact us</span>
          </div>
          <button style={{ width: "100%", padding: "10px", backgroundColor: "#ffffff", color: "#0f172a", border: "1px solid #0f172a", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginBottom: "32px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            Contact us
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
            {[
              "Everything in Pro",
              "Custom authentication",
              "SSO login",
              "Remove 'Powered by' badge"
            ].map((feature, i) => (
              <div key={feature} style={{ display: "flex", alignItems: "flex-start", gap: "12px", fontSize: "14px", color: i === 0 ? "#0f172a" : "#334155", fontWeight: i === 0 ? "600" : "400" }}>
                {checkSvg}
                {feature}
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
