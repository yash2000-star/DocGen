import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { logout } from "../lib/auth";
import ThemeToggle from "../components/ThemeToggle";
import SearchModal from "../components/SearchModal";
import Sidebar from "../components/Sidebar";
import DocPage from "./DocPage";
import Toc from "../components/Toc";
import Editor from "./Editor";
import AiChat from "../components/AiChat";
import GithubImporter from "../components/GithubImporter";

export default function DocEngine() { 
  const { user } = useAuth(); 

  const [currentView, setCurrentView] = useState("docs"); 
  const [currentTenant, setCurrentTenant] = useState("company-a");
  const [currentVersion, setCurrentVersion] = useState("v1");

  useEffect(() => {
    function handleTenantChange(event) { setCurrentTenant(event.detail); }
    function handleVersionChange(event) { setCurrentVersion(event.detail); }
    window.addEventListener("tenant-change", handleTenantChange);
    window.addEventListener("version-change", handleVersionChange);
    return () => {
      window.removeEventListener("tenant-change", handleTenantChange);
      window.removeEventListener("version-change", handleVersionChange);
    };
  }, []);

  useEffect(() => {
    fetch(`/${currentTenant}/${currentVersion}/mint.json`, { cache: "no-store" })
      .then(res => res.ok ? res.json() : null)
      .then(config => {
        if (config && config.colors && config.colors.primary) {
          document.documentElement.style.setProperty("--primary-brand", config.colors.primary);
        } else {
          document.documentElement.style.setProperty("--primary-brand", "#3b82f6");
        }
      })
      .catch(() => document.documentElement.style.setProperty("--primary-brand", "#3b82f6"));
  }, [currentTenant, currentVersion]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <SearchModal />
      <div style={{ padding: "10px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-sidebar)", display: "flex", alignItems: "center" }}>
        <button onClick={() => setCurrentView("docs")} style={{ marginRight: "10px", fontWeight: currentView === "docs" ? "bold" : "normal", background: "none", border: "none", color: "var(--text-main)", cursor: "pointer" }}>View Docs</button>
        <button onClick={() => setCurrentView("editor")} style={{ fontWeight: currentView === "editor" ? "bold" : "normal", background: "none", border: "none", color: "var(--text-main)", cursor: "pointer", marginRight: "10px" }}>Manual Editor</button>
        <button onClick={() => setCurrentView("import")} style={{ fontWeight: currentView === "import" ? "bold" : "normal", backgroundColor: "var(--primary-brand)", color: "#fff", border: "none", borderRadius: "4px", padding: "6px 12px", cursor: "pointer" }}>Auto Import (GitHub)</button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          
          <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>{user?.email}</span>
          
          <ThemeToggle />
          <button onClick={logout} style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-main)", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Logout</button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {currentView === "docs" ? (
          <>
            <div style={{ width: "250px", borderRight: "1px solid var(--border-color)", padding: "10px", overflowY: "auto", backgroundColor: "var(--bg-sidebar)" }}><Sidebar /></div>
            <div style={{ flex: 1, padding: "20px", overflowY: "auto", backgroundColor: "var(--bg-main)" }}><DocPage /></div>
            <div style={{ width: "250px", padding: "10px", borderLeft: "1px solid var(--border-color)", overflowY: "auto", backgroundColor: "var(--bg-sidebar)" }}><Toc /><AiChat /></div>
          </>
        ) : (
          <div style={{ flex: 1, overflowY: "auto" }}>{currentView === "editor" ? <Editor /> : <div style={{ display: "flex", justifyContent: "center", paddingTop: "50px", backgroundColor: "var(--bg-main)", height: "100%" }}><GithubImporter /></div>}</div>
        )}
      </div>
    </div>
  );
}