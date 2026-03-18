import React, { useState } from "react";

export default function CodeBlock({ children, language = "code", title }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = typeof children === 'string' 
      ? children 
      : children?.props?.children || "";
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    
    // Revert the button text back after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ 
      margin: "32px 0", 
      borderRadius: "8px", 
      overflow: "hidden", 
      border: "1px solid #1e293b", 
      backgroundColor: "#0f172a",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "10px 16px", 
        backgroundColor: "#1e293b", 
        borderBottom: "1px solid #334155" 
      }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {title && (
            <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: "500" }}>
              {title}
            </span>
          )}
          <span style={{ 
            color: "#64748b", 
            fontSize: "12px", 
            fontFamily: "monospace", 
            textTransform: "uppercase",
            borderLeft: title ? "1px solid #334155" : "none",
            paddingLeft: title ? "12px" : "0"
          }}>
            {language}
          </span>
        </div>
        <button 
          onClick={handleCopy} 
          style={{ 
            background: "none", 
            border: "none", 
            color: copied ? "#10b981" : "#94a3b8", // Emerald green on success
            cursor: "pointer", 
            fontSize: "12px",
            fontWeight: "600",
            transition: "color 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: "4px"
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      
      {/* Code Body */}
      <div style={{ padding: "16px", overflowX: "auto" }}>
        <pre style={{ margin: 0, padding: 0, background: "transparent" }}>
          <code style={{ 
            color: "#f8fafc", 
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace", 
            fontSize: "14px", 
            lineHeight: "1.6" 
          }}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}