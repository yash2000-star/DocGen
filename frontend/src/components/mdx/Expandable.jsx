import React, { useState } from "react";

export function Expandable({ title = "Show properties", children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ marginTop: "8px" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "none",
          color: "#3b82f6", 
          fontSize: "13px",
          fontWeight: "600",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: 0,
          transition: "color 0.2s"
        }}
        onMouseOver={(e) => e.currentTarget.style.color = "#2563eb"}
        onMouseOut={(e) => e.currentTarget.style.color = "#3b82f6"}
      >
        <span style={{ 
          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", 
          transition: "transform 0.2s ease",
          fontSize: "14px"
        }}>
          ▸
        </span>
        {isOpen ? "Hide properties" : title}
      </button>
      
      {isOpen && (
        <div style={{ 
          marginTop: "16px", 
          paddingLeft: "20px", 
          borderLeft: "2px solid #e2e8f0", 
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          {children}
        </div>
      )}
    </div>
  );
}