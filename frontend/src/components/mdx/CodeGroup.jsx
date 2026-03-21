import React, { useState } from "react";

export function CodeGroup({ children }) {
  const [activeTab, setActiveTab] = useState(0);
  
  // Convert children to an array to map over them
  const tabs = React.Children.toArray(children);

  return (
    <div style={{ 
      margin: "32px 0", 
      borderRadius: "8px", 
      overflow: "hidden", 
      border: "1px solid #1e293b", 
      backgroundColor: "#0f172a", // Dark terminal background
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
    }}>
      {/* --- INJECTED CSS FIX --- */}
      <style>{`
        .code-group-wrapper > div { margin: 0 !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; }
        .code-group-wrapper > div > div:first-child { display: none !important; }
      `}</style>

      {/* Dark Mode Tab Headers */}
      <div style={{ 
        display: "flex", 
        backgroundColor: "#1e293b", 
        borderBottom: "1px solid #334155",
        overflowX: "auto"
      }}>
        {tabs.map((tab, index) => {
          // Grab the title or language from the nested <CodeBlock>
          const title = tab.props?.title || tab.props?.language || `Tab ${index + 1}`;
          
          return (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                backgroundColor: activeTab === index ? "#0f172a" : "transparent",
                border: "none",
                borderTop: activeTab === index ? "2px solid #38bdf8" : "2px solid transparent",
                color: activeTab === index ? "#e2e8f0" : "#64748b",
                fontWeight: "600",
                fontSize: "12px",
                fontFamily: "monospace",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap"
              }}
            >
              {title}
            </button>
          );
        })}
      </div>
      
      {/* The Active CodeBlock */}
      <div className="code-group-wrapper">
        {tabs[activeTab]}
      </div>
    </div>
  );
}