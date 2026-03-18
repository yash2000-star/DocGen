import React, { useState } from "react";

export function AccordionGroup({ children }) {
  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      gap: "8px", 
      margin: "32px 0" 
    }}>
      {children}
    </div>
  );
}

export function Accordion({ title, icon, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ 
      border: "1px solid #e2e8f0", 
      borderRadius: "8px", 
      overflow: "hidden",
      backgroundColor: "#ffffff",
      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          backgroundColor: isOpen ? "#f8fafc" : "#ffffff", 
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background-color 0.2s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {icon && <span style={{ fontSize: "18px" }}>{icon}</span>}
          <strong style={{ color: "#0f172a", fontSize: "15px", fontWeight: "600" }}>
            {title}
          </strong>
        </div>
        
        {/* The rotating chevron arrow */}
        <span style={{ 
          color: "#64748b", 
          fontSize: "12px",
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", 
          transition: "transform 0.2s ease" 
        }}>
          ▼
        </span>
      </button>
      
      {/* The content that shows/hides */}
      {isOpen && (
        <div style={{ 
          padding: "16px", 
          borderTop: "1px solid #e2e8f0", 
          color: "#475569", 
          lineHeight: "1.6",
          fontSize: "15px"
        }}>
          {children}
        </div>
      )}
    </div>
  );
}