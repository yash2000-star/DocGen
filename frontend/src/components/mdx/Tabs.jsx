import React, { useState } from "react";

export function Tabs({ children }) {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = React.Children.toArray(children);

  return (
    <div style={{ 
      margin: "32px 0", 
      border: "1px solid #e2e8f0", 
      borderRadius: "8px", 
      overflow: "hidden",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
    }}>
      {/* The Tab Headers (Buttons) */}
      <div style={{ 
        display: "flex", 
        backgroundColor: "#f8fafc", 
        borderBottom: "1px solid #e2e8f0",
        overflowX: "auto"
      }}>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            style={{
              padding: "12px 20px",
              cursor: "pointer",
              backgroundColor: activeTab === index ? "#ffffff" : "transparent",
              border: "none",
              borderRight: "1px solid #e2e8f0",
              borderBottom: activeTab === index ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === index ? "#0f172a" : "#64748b",
              fontWeight: activeTab === index ? "600" : "500",
              fontSize: "14px",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap"
            }}
          >
            {/* Grab the "title" prop from the <Tab> component */}
            {tab.props.title}
          </button>
        ))}
      </div>
      
      {/* The Active Content */}
      <div style={{ padding: "20px", backgroundColor: "#ffffff" }}>
        {tabs[activeTab]}
      </div>
    </div>
  );
}

export function Tab({ children }) {
  return <div>{children}</div>;
}