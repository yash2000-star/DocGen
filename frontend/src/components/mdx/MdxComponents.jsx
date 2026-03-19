import React from "react";
import CodeBlock from "./CodeBlock";
import { Tabs, Tab } from "./Tabs";
import { Card, CardGroup } from "./Card"
import { Accordion, AccordionGroup } from "./Accordion";
import { Expandable } from "./Expandable";
import { CodeGroup } from "./CodeGroup";
import { ApiPlayground } from "./ApiPlayground";

export const Note = ({ children }) => {
    return (
        <div style={{
            backgroundColor: "#eef2ff",
            borderLeft: "4px solid #3b82f6",
            padding: "16px",
            borderRadius: "0 8px 8px 0",
            margin: "24px 0"
        }}>
            <strong style={{ color: "#1d4ed8", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
                ℹ️ Note
            </strong>
            <div style={{ marginTop: "8px", color: "#334155", lineHeight: "1.6" }}>
                {children}
            </div>
        </div>
    );
};

export const Warning = ({ children }) => {
  return (
    <div style={{ 
      backgroundColor: "#fffbeb", 
      borderLeft: "4px solid #f59e0b", 
      padding: "16px", 
      borderRadius: "0 8px 8px 0", 
      margin: "24px 0" 
    }}>
      <strong style={{ color: "#b45309", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
        ⚠️ Warning
      </strong>
      <div style={{ marginTop: "8px", color: "#78350f", lineHeight: "1.6" }}>
        {children}
      </div>
    </div>
  );
};

export const Tip = ({ children }) => {
  return (
    <div style={{ 
      backgroundColor: "#f0fdf4", 
      borderLeft: "4px solid #22c55e", 
      padding: "16px", 
      borderRadius: "0 8px 8px 0", 
      margin: "24px 0" 
    }}>
      <strong style={{ color: "#15803d", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
        💡 Tip
      </strong>
      <div style={{ marginTop: "8px", color: "#166534", lineHeight: "1.6" }}>
        {children}
      </div>
    </div>
  );
};

export const Info = ({ children }) => {
  return (
    <div style={{ 
      backgroundColor: "#f8fafc", 
      borderLeft: "4px solid #64748b", 
      padding: "16px", 
      borderRadius: "0 8px 8px 0", 
      margin: "24px 0" 
    }}>
      <strong style={{ color: "#475569", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
        📝 Info
      </strong>
      <div style={{ marginTop: "8px", color: "#334155", lineHeight: "1.6" }}>
        {children}
      </div>
    </div>
  );
};

export const Danger = ({ children }) => {
  return (
    <div style={{ 
      backgroundColor: "#fef2f2", 
      borderLeft: "4px solid #ef4444", 
      padding: "16px", 
      borderRadius: "0 8px 8px 0", 
      margin: "24px 0" 
    }}>
      <strong style={{ color: "#b91c1c", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
        🛑 Danger
      </strong>
      <div style={{ marginTop: "8px", color: "#991b1b", lineHeight: "1.6" }}>
        {children}
      </div>
    </div>
  );
};

// The Badge Component (Inline labels like NEW, DEPRECATED)
export const Badge = ({ children, type = "default" }) => {
  const styles = {
    default: { bg: "#f1f5f9", text: "#475569" }, // Slate
    success: { bg: "#dcfce7", text: "#166534" }, // Green
    warning: { bg: "#fef9c3", text: "#854d0e" }, // Yellow
    danger:  { bg: "#fee2e2", text: "#991b1b" }, // Red
    info:    { bg: "#e0f2fe", text: "#075985" }, // Blue
  };

  const style = styles[type] || styles.default;

  return (
    <span style={{
      backgroundColor: style.bg,
      color: style.text,
      padding: "2px 8px",
      borderRadius: "12px", 
      fontSize: "12px",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      display: "inline-flex",
      alignItems: "center",
      verticalAlign: "middle",
      marginLeft: "8px",
      transform: "translateY(-1px)" 
    }}>
      {children}
    </span>
  );
};

// 📢 The Callout Component (Generic, highly customizable box)
export const Callout = ({ title, icon = "💡", color = "#3b82f6", children }) => {
  return (
    <div style={{
      backgroundColor: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderLeft: `4px solid ${color}`, 
      borderRadius: "8px",
      padding: "16px",
      margin: "24px 0",
      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
    }}>
      {title && (
        <strong style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", color: "#0f172a", marginBottom: "8px" }}>
          <span>{icon}</span> {title}
        </strong>
      )}
      <div style={{ color: "#475569", lineHeight: "1.6" }}>
        {children}
      </div>
    </div>
  );
};

//  The Steps Wrapper
export const Steps = ({ children }) => {
  return (
    <div style={{ 
      margin: "32px 0", 
      paddingLeft: "20px", 
      borderLeft: "2px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
      {children}
    </div>
  );
};

//  The Individual Step Component
export const Step = ({ title, children }) => {
  return (
    <div style={{ position: "relative" }}>
      {/* The timeline dot on the left border */}
      <div style={{ 
        position: "absolute", 
        left: "-29px", 
        top: "4px", 
        width: "16px", 
        height: "16px", 
        borderRadius: "50%", 
        backgroundColor: "#e2e8f0", 
        border: "4px solid white" 
      }}></div>
      
      {/* Step Title */}
      <h4 style={{ margin: "0 0 8px 0", color: "#0f172a", fontSize: "18px" }}>
        {title}
      </h4>
      
      {/* Step Content */}
      <div style={{ color: "#475569", lineHeight: "1.6" }}>
        {children}
      </div>
    </div>
  );
};


// ⚙️ API Parameter Field
export const ParamField = ({ body, query, path, name, type, required, children }) => {
  let paramSource = "";
  if (body) paramSource = "body";
  if (query) paramSource = "query";
  if (path) paramSource = "path";

  return (
    <div style={{
      borderBottom: "1px solid #e2e8f0",
      padding: "16px 0",
      display: "flex",
      flexDirection: "column",
      gap: "6px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {/* Parameter Name */}
        <code style={{ 
          fontSize: "14px", 
          fontWeight: "700", 
          color: "#0f172a", 
          fontFamily: "monospace" 
        }}>
          {name}
        </code>
        
        {/* Parameter Type (string, int, boolean) */}
        <span style={{ fontSize: "13px", color: "#64748b", fontFamily: "monospace" }}>
          {type}
        </span>
        
        {/* Required Badge */}
        {required && (
          <span style={{ 
            fontSize: "10px", 
            color: "#ea580c", // Orange
            fontWeight: "700", 
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
            Required
          </span>
        )}

        {/* Source Badge (body/query/path) */}
        {paramSource && (
          <span style={{ 
            fontSize: "10px", 
            color: "#94a3b8",
            fontWeight: "600", 
            textTransform: "uppercase",
          }}>
            {paramSource}
          </span>
        )}
      </div>
      
      {/* Parameter Description */}
      <div style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", marginTop: "4px" }}>
        {children}
      </div>
    </div>
  );
};

export const ResponseField = ({ name, type, required, children }) => {
  return (
    <ParamField name={name} type={type} required={required}>
      {children}
    </ParamField>
  );
};

export const Frame = ({ caption, children }) => {
  return (
    <div style={{ margin: "32px 0" }}>
      <div style={{
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        backgroundColor: "#f8fafc",
        padding: "12px", 
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      }}>
        {children}
      </div>
      {caption && (
        <div style={{ 
          textAlign: "center", 
          color: "#64748b", 
          fontSize: "13px", 
          marginTop: "12px",
          fontStyle: "italic"
        }}>
          {caption}
        </div>
      )}
    </div>
  );
};

// 📊 Styled Table Components
export const Table = ({ children }) => (
  <div style={{ overflowX: "auto", margin: "32px 0", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
      {children}
    </table>
  </div>
);

export const Th = ({ children }) => (
  <th style={{ borderBottom: "2px solid #e2e8f0", padding: "12px 16px", color: "#0f172a", fontWeight: "600", backgroundColor: "#f8fafc" }}>
    {children}
  </th>
);

export const Td = ({ children }) => (
  <td style={{ borderBottom: "1px solid #e2e8f0", padding: "12px 16px", color: "#475569" }}>
    {children}
  </td>
);

// 🟢 The Check Component (For feature lists or success states)
export const Check = ({ children }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", margin: "12px 0", color: "#334155" }}>
    <span style={{ color: "#10b981", fontSize: "18px", fontWeight: "bold", lineHeight: "1.2" }}>✓</span>
    <span style={{ lineHeight: "1.5" }}>{children}</span>
  </div>
);

// 📅 The Update Component (For Changelogs and Release Notes)
export const Update = ({ label = "Update", date, children }) => (
  <div style={{ 
    margin: "32px 0", 
    borderLeft: "2px solid #e2e8f0", 
    paddingLeft: "24px", 
    position: "relative" 
  }}>
    {/* The timeline dot */}
    <div style={{ 
      position: "absolute", left: "-7px", top: "4px", width: "12px", height: "12px", 
      borderRadius: "50%", backgroundColor: "#3b82f6", border: "2px solid #ffffff" 
    }} />
    
    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
      <Badge type="info">{label}</Badge>
      {date && <span style={{ color: "#64748b", fontSize: "14px", fontWeight: "600" }}>{date}</span>}
    </div>
    
    <div style={{ color: "#475569", lineHeight: "1.6" }}>
      {children}
    </div>
  </div>
);

// 🔍 The Tooltip Component (Hover for definitions)
export const Tooltip = ({ text, children }) => (
  <span 
    title={text} // Uses standard HTML title for an instant, lightweight tooltip
    style={{ 
      borderBottom: "1px dashed #94a3b8", 
      cursor: "help",
      color: "#0f172a",
      fontWeight: "500"
    }}
  >
    {children}
  </span>
);

// 📡 Request Example Wrapper
export const RequestExample = ({ children }) => {
  return (
    <div className="api-example-block" style={{ margin: "32px 0" }}>
      <div style={{ 
        fontSize: "12px", 
        fontWeight: "700", 
        color: "#64748b", 
        textTransform: "uppercase", 
        marginBottom: "12px", 
        letterSpacing: "0.5px",
        display: "flex",
        alignItems: "center",
        gap: "6px"
      }}>
        <span style={{ color: "#3b82f6" }}>↗</span> Request Example
      </div>
      {children}
    </div>
  );
};

// 📥 Response Example Wrapper
export const ResponseExample = ({ children }) => {
  return (
    <div className="api-example-block" style={{ margin: "32px 0" }}>
      <div style={{ 
        fontSize: "12px", 
        fontWeight: "700", 
        color: "#64748b", 
        textTransform: "uppercase", 
        marginBottom: "12px", 
        letterSpacing: "0.5px",
        display: "flex",
        alignItems: "center",
        gap: "6px"
      }}>
        <span style={{ color: "#10b981" }}>↘</span> Response Example
      </div>
      {children}
    </div>
  );
};

export { CodeBlock, Tabs, Tab, Card, CardGroup, Accordion, AccordionGroup, Expandable, CodeGroup, ApiPlayground };