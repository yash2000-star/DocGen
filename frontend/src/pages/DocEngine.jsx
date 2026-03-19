import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import SearchModal from "../components/SearchModal";
import Sidebar from "../components/Sidebar";
import DocPage from "./DocPage";
import Toc from "../components/Toc";
import AiChat from "../components/AiChat";

export default function DocEngine() { 
  const { tenant, version } = useParams();
  
  // Detect if we are inside the Dashboard's iframe preview
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    setIsPreview(window !== window.top);
  }, []);

  // Fetch the custom color theme if it exists
  useEffect(() => {
    if (!tenant || !version) return;
    
    fetch(`/${tenant}/${version}/mint.json`, { cache: "no-store" })
      .then(res => res.ok ? res.json() : null)
      .then(config => {
        if (config && config.colors && config.colors.primary) {
          document.documentElement.style.setProperty("--primary-brand", config.colors.primary);
        } else {
          document.documentElement.style.setProperty("--primary-brand", "#0fba81"); // Default Mintlify Green!
        }
      })
      .catch(() => document.documentElement.style.setProperty("--primary-brand", "#0fba81"));
  }, [tenant, version]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#ffffff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <SearchModal />
      
      {/* MINTLIFY-STYLE TOP NAVBAR (Hidden in preview mode) */}
      {!isPreview && (
        <div style={{ 
          height: "64px", 
          padding: "0 24px", 
          borderBottom: "1px solid #e2e8f0", 
          display: "flex", 
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          zIndex: 50
        }}>
          
          {/* Left: Logo Area */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "260px" }}>
            <div style={{ width: "24px", height: "24px", backgroundColor: "var(--primary-brand)", borderRadius: "6px" }}></div>
            <span style={{ fontSize: "16px", fontWeight: "600", color: "#0f172a" }}>
              {tenant ? tenant.charAt(0).toUpperCase() + tenant.slice(1) : "Mint"} Docs
            </span>
          </div>

          {/* Middle: Search Bar (Fake input that triggers your modal) */}
          <div style={{ flex: 1, maxWidth: "400px", display: "flex", justifyContent: "center" }}>
            <button 
            onClick={() => window.dispatchEvent(new CustomEvent("open-search"))}
              style={{ 
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", 
                borderRadius: "8px", color: "#64748b", fontSize: "14px", cursor: "text"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                Search...
              </div>
              <span style={{ fontSize: "12px", border: "1px solid #cbd5e1", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#ffffff" }}>Ctrl K</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px", width: "260px" }}>
            <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500", cursor: "pointer" }}>Support</span>
            <Link to="/dashboard" style={{ textDecoration: "none" }}>
              <button style={{ 
                backgroundColor: "var(--primary-brand)", color: "#ffffff", border: "none", 
                borderRadius: "6px", padding: "6px 12px", fontSize: "13px", fontWeight: "600", cursor: "pointer" 
              }}>
                Dashboard ›
              </button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      )}

      {/* MAIN 3-COLUMN LAYOUT */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* 1. Left Sidebar (Navigation) */}
        <div style={{ 
          width: isPreview ? "220px" : "260px", 
          borderRight: "1px solid #e2e8f0", 
          overflowY: "auto", 
          backgroundColor: "#ffffff",
          flexShrink: 0
        }}>
          <Sidebar />
        </div>
        
        {/* 2. Center Content (The actual Docs) */}
        <div style={{ flex: 1, overflowY: "auto", backgroundColor: "#ffffff" }}>
          <div style={{ 
            maxWidth: "800px", // This matches Mintlify's readable text width!
            margin: "0 auto", 
            padding: "48px 32px" 
          }}>
            <DocPage />
          </div>
        </div>
        
        {/* 3. Right Sidebar (Table of Contents) */}
        {!isPreview && (
          <div style={{ 
            width: "250px", 
            padding: "32px 24px", 
            overflowY: "auto", 
            backgroundColor: "#ffffff",
            flexShrink: 0
          }}>
            <div style={{ position: "sticky", top: 0 }}>
              <Toc />
              <div style={{ marginTop: "40px" }}>
                <AiChat />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}