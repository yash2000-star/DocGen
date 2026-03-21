import React, { useState } from "react";

// Helper engine to parse strings like "2,4-6" into an array: [2, 4, 5, 6]
const parseHighlightLines = (linesStr) => {
  if (!linesStr) return [];
  return linesStr.split(',').reduce((acc, part) => {
    const [start, end] = part.split('-').map(Number);
    if (isNaN(start)) return acc;
    if (!end) return [...acc, start];
    
    // Create an array for ranges (e.g., 4 to 6 becomes [4, 5, 6])
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return [...acc, ...range];
  }, []);
};

export default function CodeBlock({ children, language = "javascript", title, highlight = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = typeof children === 'string' 
      ? children 
      : children?.props?.children || "";
    
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Extract the raw string from MDX children
  const rawCode = typeof children === 'string' ? children : children?.props?.children || "";
  
  // 2. Split the string into an array of lines (removing trailing empty newlines)
  const codeLines = rawCode.replace(/\n$/, "").split("\n"); 
  
  // 3. Figure out which lines need to glow
  const highlightedLineNumbers = parseHighlightLines(highlight);

  return (
    <div style={{ 
      margin: "32px 0", 
      borderRadius: "8px", 
      overflow: "hidden", 
      border: "1px solid #1e293b", 
      backgroundColor: "#0f172a",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
    }}>
      {/* --- HEADER BAR --- */}
      <div style={{ 
        display: "flex", justifyContent: "space-between", alignItems: "center", 
        padding: "10px 16px", backgroundColor: "#1e293b", borderBottom: "1px solid #334155" 
      }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {title && (
            <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: "500" }}>
              {title}
            </span>
          )}
          <span style={{ 
            color: "#64748b", fontSize: "12px", fontFamily: "monospace", textTransform: "uppercase",
            borderLeft: title ? "1px solid #334155" : "none", paddingLeft: title ? "12px" : "0"
          }}>
            {language}
          </span>
        </div>
        <button 
          onClick={handleCopy} 
          style={{ 
            background: "none", border: "none", color: copied ? "#10b981" : "#94a3b8",
            cursor: "pointer", fontSize: "12px", fontWeight: "600", transition: "color 0.2s ease",
            display: "flex", alignItems: "center", gap: "4px"
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      
      {/* --- CODE BODY WITH LINE HIGHLIGHTING --- */}
      <div style={{ padding: "16px 0", overflowX: "auto" }}>
        <pre style={{ margin: 0, padding: 0, background: "transparent" }}>
          {/* CRITICAL: Added className so PrismJS knows what language to parse! */}
          <code 
            className={`language-${language}`} 
            style={{ 
              color: "#f8fafc", 
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace", 
              fontSize: "14px", 
              lineHeight: "1.6",
              display: "block"
            }}
          >
            {codeLines.map((line, index) => {
              const lineNumber = index + 1;
              const isHighlighted = highlightedLineNumbers.includes(lineNumber);
              
              return (
                <div 
                  key={index} 
                  style={{ 
                    padding: "0 16px",
                    backgroundColor: isHighlighted ? "rgba(56, 189, 248, 0.15)" : "transparent",
                    borderLeft: isHighlighted ? "3px solid #38bdf8" : "3px solid transparent",
                    display: "flex",
                  }}
                >
                  {/* Line Number */}
                  <span style={{ 
                    color: "#475569", minWidth: "24px", userSelect: "none",
                    marginRight: "16px", textAlign: "right", fontSize: "12px"
                  }}>
                    {lineNumber}
                  </span>
                  
                  {/* Actual Code Text */}
                  <span style={{ whiteSpace: "pre-wrap" }}>
                    {line || " "} 
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}