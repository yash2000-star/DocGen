import { useState } from "react";

export default function Profile() {
  const [firstName, setFirstName] = useState("Yash");
  const [lastName, setLastName] = useState("Nirwan");
  const [emailNotifs, setEmailNotifs] = useState(true);

  const containerStyle = {
    maxWidth: "900px",
    fontFamily: "Inter, system-ui, sans-serif"
  };

  const rowStyle = {
    display: "flex",
    gap: "60px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "32px",
    marginBottom: "32px",
  };

  const lastRowStyle = {
    display: "flex",
    gap: "60px",
  };

  const leftColStyle = {
    width: "280px",
    flexShrink: 0
  };

  const rightColStyle = {
    flex: 1
  };

  const h4Style = {
    fontSize: "14px",
    fontWeight: "600",
    color: "#0f172a",
    margin: "0 0 4px 0"
  };

  const subStyle = {
    fontSize: "13px",
    color: "#64748b",
    margin: 0,
    lineHeight: "1.5"
  };

  const cardStyle = {
    backgroundColor: "#f9fafb",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    alignItems: "flex-start",
    gap: "16px"
  };

  return (
    <div style={containerStyle}>
      
      {/* ROW 1: Name */}
      <div style={rowStyle}>
        <div style={leftColStyle}>
          <h4 style={h4Style}>Name</h4>
          <p style={subStyle}>Update your name</p>
        </div>
        <div style={rightColStyle}>
          <div style={{ display: "flex", gap: "16px", marginBottom: "16px", maxWidth: "500px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>First name</label>
              <input 
                type="text" 
                value={firstName} 
                onChange={e => setFirstName(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", outline: "none", fontSize: "14px", color: "#0f172a" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>Last name</label>
              <input 
                type="text" 
                value={lastName} 
                onChange={e => setLastName(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", outline: "none", fontSize: "14px", color: "#0f172a" }}
              />
            </div>
          </div>
          <button style={{ backgroundColor: "#f8fafc", color: "#cbd5e1", border: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "500", cursor: "not-allowed" }}>
            Save changes
          </button>
        </div>
      </div>

      {/* ROW 2: Email notifications */}
      <div style={rowStyle}>
        <div style={leftColStyle}>
          <h4 style={h4Style}>Email notifications</h4>
          <p style={subStyle}>Manage your email notification preferences</p>
        </div>
        <div style={rightColStyle}>
          <div style={cardStyle}>
            <div style={{ width: "40px", height: "40px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ ...h4Style, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                Comment reply emails
                <div 
                  onClick={() => setEmailNotifs(!emailNotifs)}
                  style={{ width: "36px", height: "20px", backgroundColor: emailNotifs ? "#10b981" : "#e2e8f0", borderRadius: "20px", position: "relative", cursor: "pointer", transition: "background-color 0.2s" }}
                >
                  <div style={{ width: "16px", height: "16px", backgroundColor: "#ffffff", borderRadius: "50%", position: "absolute", top: "2px", left: emailNotifs ? "18px" : "2px", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}></div>
                </div>
              </h4>
              <p style={{ ...subStyle, maxWidth: "400px" }}>Receive email notifications when someone replies to your comment threads</p>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: Integrations */}
      <div style={lastRowStyle}>
        <div style={leftColStyle}>
          <h4 style={h4Style}>Integrations</h4>
          <p style={subStyle}>Connect and authorize apps in your workspace</p>
        </div>
        <div style={rightColStyle}>
          <div style={cardStyle}>
            <div style={{ width: "40px", height: "40px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h4 style={{ ...h4Style, display: "flex", alignItems: "center", gap: "8px" }}>
                  GitHub authorization
                  <span style={{ fontSize: "11px", fontWeight: "500", color: "#64748b" }}>Inactive</span>
                </h4>
                <p style={subStyle}>Allow mintlify to connect to your Github</p>
              </div>
              <button style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#0f172a", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                Authorize
              </button>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
