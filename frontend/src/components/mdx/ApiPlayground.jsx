import { useState } from "react";
import { apiFetch } from "../../lib/api";

export function ApiPlayground({ method = "GET", endpoint = "/" }) {
  const [requestBody, setRequestBody] = useState("{\n  \n}");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  // SaaS-tier color coding for HTTP methods
  const getMethodColor = (m) => {
    switch (m.toUpperCase()) {
      case "GET": return { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" };
      case "POST": return { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
      case "PUT": return { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" };
      case "DELETE": return { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" };
      default: return { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    }
  };

  const colors = getMethodColor(method);
  const isBodyAllowed = method.toUpperCase() !== "GET" && method.toUpperCase() !== "DELETE";

  const handleSendRequest = async () => {
    setLoading(true);
    setResponse(null);
    
    try {
      let parsedBody = null;
      if (isBodyAllowed && requestBody.trim() !== "" && requestBody.trim() !== "{\n  \n}") {
        parsedBody = JSON.parse(requestBody);
      }
      const res = await apiFetch(`/api/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: endpoint,
          targetMethod: method.toUpperCase(),
          payload: parsedBody
        })
      });
      
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(JSON.stringify({ 
        error: "Request failed.", 
        hint: "Ensure your JSON body is strictly formatted with double quotes." 
      }, null, 2));
    }
    
    setLoading(false);
  };

  return (
    <div style={{
      border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", 
      margin: "24px 0", fontFamily: "sans-serif", backgroundColor: "#ffffff",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
    }}>
      {/* Top Bar: Method & Endpoint */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
          <span style={{
            backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
            padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", letterSpacing: "0.5px"
          }}>
            {method.toUpperCase()}
          </span>
          <code style={{ fontSize: "14px", color: "#0f172a", fontFamily: "monospace", wordBreak: "break-all" }}>
            {endpoint}
          </code>
        </div>
        
        <button 
          onClick={handleSendRequest}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#94a3b8" : "var(--primary-brand, #0f172a)",
            color: "#ffffff", border: "none", padding: "6px 16px", borderRadius: "6px",
            fontSize: "13px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s", whiteSpace: "nowrap"
          }}
        >
          {loading ? "Sending..." : "Test Request"}
        </button>
      </div>

      {/* Two Column Layout for Body & Response */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        
        {/* Input JSON Body (Only show if POST/PUT) */}
        {isBodyAllowed && (
          <div style={{ borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ padding: "8px 16px", fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", backgroundColor: "#fdfdfd" }}>
              Request Body (JSON)
            </div>
            <textarea
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              spellCheck="false"
              style={{
                width: "100%", height: "120px", padding: "12px 16px", border: "none",
                backgroundColor: "#ffffff", color: "#0f172a", fontFamily: "monospace",
                fontSize: "13px", resize: "vertical", outline: "none"
              }}
            />
          </div>
        )}

        {/* Output JSON Response */}
        {response && (
          <div style={{ backgroundColor: "#0f172a" }}>
             <div style={{ padding: "8px 16px", fontSize: "12px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #1e293b" }}>
              Response
            </div>
            <pre style={{
              margin: 0, padding: "16px", color: "#38bdf8", fontFamily: "monospace",
              fontSize: "13px", overflowX: "auto", maxHeight: "300px", overflowY: "auto"
            }}>
              <code>{response}</code>
            </pre>
          </div>
        )}

      </div>
    </div>
  );
}