import { useState } from "react";
import { useParams } from "react-router-dom";

export default function ApiKeys() {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const disabledBtnStyle = {
    background: "transparent",
    border: "none",
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: "500",
    padding: 0,
    marginTop: "16px",
    cursor: "not-allowed",
    display: "flex",
    alignItems: "center",
    gap: "4px"
  };

  return (
    <div style={containerStyle}>
      
      {/* ROW 1: Project ID */}
      <div style={rowStyle}>
        <div style={leftColStyle}>
          <h4 style={h4Style}>Project ID</h4>
          <p style={subStyle}>Your unique application identifier</p>
        </div>
        <div style={rightColStyle}>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", maxWidth: "450px", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}>
            <div style={{ flex: 1, backgroundColor: "#f8fafc", padding: "10px 14px", fontSize: "13px", color: "#0f172a", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>
              {id}
            </div>
            <button 
              onClick={copyToClipboard} 
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 14px", backgroundColor: "#ffffff", border: "none", borderLeft: "1px solid #e2e8f0", fontSize: "13px", fontWeight: "500", color: copied ? "#10b981" : "#475569", cursor: "pointer", transition: "color 0.2s" }}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ROW 2: Admin API keys */}
      <div style={rowStyle}>
        <div style={leftColStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h4 style={{ ...h4Style, margin: 0 }}>Admin API keys</h4>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#fffbeb", color: "#d97706", border: "1px solid #fcd34d", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "600" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Available on Pro
            </div>
          </div>
          <p style={subStyle}>Learn more about how to use the API in our docs</p>
        </div>
        <div style={rightColStyle}>
          <h4 style={h4Style}>Active admin keys</h4>
          <p style={{ ...subStyle, maxWidth: "450px" }}>Please ensure to copy your API keys once generated as you may not be able to see them again.</p>
          <button style={disabledBtnStyle}>
            + Create Admin API Key
          </button>
        </div>
      </div>

      {/* ROW 3: Assistant API keys */}
      <div style={lastRowStyle}>
        <div style={leftColStyle}>
          <h4 style={h4Style}>Assistant API keys</h4>
          <p style={subStyle}>Create public API keys for the assistant API.</p>
        </div>
        <div style={rightColStyle}>
          <h4 style={h4Style}>Active assistant keys</h4>
          <p style={{ ...subStyle, maxWidth: "450px" }}>Please ensure to copy your API keys once generated as you may not be able to see them again.</p>
          <button style={disabledBtnStyle}>
            + Create Assistant API Key
          </button>
        </div>
      </div>

    </div>
  );
}
