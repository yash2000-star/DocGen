import { useOutletContext } from "react-router-dom";
import { Sparkles, Terminal, Copy, Check } from "lucide-react";
import { useState } from "react";

export default function AgentSkills() {
  const context = useOutletContext();
  const { project } = context || {};
  const [copied, setCopied] = useState(false);

  const customDomain = project?.custom_domain;
  
  // Use custom domain if available, else use the raw backend path via current origin
  const baseUrl = customDomain ? `https://${customDomain}` : window.location.origin;
  
  const skillUrl = `${baseUrl}/skill.md`;
  const llmsUrl = `${baseUrl}/llms.txt`;
  
  const command = `npx skills add ${skillUrl}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", marginTop: 0 }}>
        <Sparkles size={28} color="#0f172a" />
        <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#0f172a", margin: 0 }}>Agent Integration</h2>
      </div>
      <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "32px", marginTop: 0 }}>
        Make your documentation natively accessible to AI coding agents like Cursor, Windsurf, and Copilot.
      </p>

      <div style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", marginTop: 0 }}>Quick Connect</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>
          Run the following command in your local project directory to automatically install this documentation's capabilities into your AI agent's context.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#0f172a", padding: "16px", borderRadius: "8px", color: "#f8fafc", fontFamily: "monospace", fontSize: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", overflowX: "auto" }}>
            <Terminal size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap" }}>{command}</span>
          </div>
          <button 
            onClick={copyToClipboard}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: copied ? "#10b981" : "#94a3b8", cursor: "pointer", padding: "4px 8px", borderRadius: "4px", flexShrink: 0 }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", marginTop: 0 }}>Raw Endpoints</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
          You can also manually provide these endpoints to your custom GPTs or AI tools.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>Agent Skill File</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
              Machine-readable capabilities interface (RFC-8615).
            </div>
            <a href={skillUrl} target="_blank" rel="noreferrer" style={{ fontSize: "13px", color: "#3b82f6", textDecoration: "none", wordBreak: "break-all" }}>
              {skillUrl}
            </a>
          </div>

          <div style={{ height: "1px", backgroundColor: "#e2e8f0" }}></div>

          <div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", marginBottom: "8px" }}>LLM Directory Map</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>
              A clean text map of your documentation hierarchy specifically optimized for LLMs.
            </div>
            <a href={llmsUrl} target="_blank" rel="noreferrer" style={{ fontSize: "13px", color: "#3b82f6", textDecoration: "none", wordBreak: "break-all" }}>
              {llmsUrl}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
