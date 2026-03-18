import React from "react";

export function CardGroup({ children, cols = 2 }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: "16px",
      margin: "32px 0"
    }}>
      {children}
    </div>
  );
}

export function Card({ title, icon, href, children }) {
  return (
    <a 
      href={href || "#"} 
      style={{
        display: "block",
        padding: "24px",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        textDecoration: "none",
        backgroundColor: "#ffffff",
        transition: "all 0.2s ease-in-out",
        cursor: "pointer",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = "#cbd5e1";
        e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = "#e2e8f0";
        e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onClick={(e) => {
        if (href) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("doc-change", { detail: href }));
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        {icon && <span style={{ fontSize: "20px" }}>{icon}</span>}
        <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a", fontWeight: "600" }}>
          {title}
        </h3>
      </div>
      <div style={{ margin: 0, color: "#64748b", fontSize: "14px", lineHeight: "1.6" }}>
  {children}
</div>
    </a>
  );
}