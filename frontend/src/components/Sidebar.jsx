import { useEffect, useState } from "react";
import Search from "./Search";
import VersionSelector from "./VersionSelector";
import TenantSelector from "./TenantSelector";

export default function Sidebar() {
  const [sidebar, setSidebar] = useState([]);
  const [currentVersion, setCurrentVersion] = useState("dev-tinder-backend");
  const [currentTenant, setCurrentTenant] = useState("yash");
  const [activeRoute, setActiveRoute] = useState("");

  useEffect(() => {
    fetch(`http://localhost:4000/api/static/${currentTenant}/${currentVersion}/sidebar.json`)
      .then((res) => {
          if (!res.ok) throw new Error("Sidebar not found");
          return res.json();
      })
      .then((data) => setSidebar(data))
      .catch((err) => {
          console.log("No sidebar for this version/tenant");
          setSidebar([]);
      });
  }, [currentVersion, currentTenant]);

  useEffect(() => {
    function handleVersionChange(event) {
      setCurrentVersion(event.detail);
      setActiveRoute("");
    }
    window.addEventListener("version-change", handleVersionChange);
    return () => window.removeEventListener("version-change", handleVersionChange)
  }, [])

  useEffect(() => {
    function handleTenantChange(event) {
      setCurrentTenant(event.detail);
      window.dispatchEvent(new CustomEvent("version-change", { detail: "dev-tinder-backend" }));
    }
    window.addEventListener("tenant-change", handleTenantChange);
    return () => window.removeEventListener("tenant-change", handleTenantChange);
  }, []);

  useEffect(() => {
    function handleDocChange(event) {
      setActiveRoute(event.detail);
    }
    window.addEventListener("doc-change", handleDocChange);
    return () => window.removeEventListener("doc-change", handleDocChange);
  }, []);

  function renderItems(items) {
    return items.map((item, index) => {
      // IF IT IS A FOLDER
      if (item.children) {
        return (
          <div key={index} style={{ marginTop: "12px" }}>
            <strong style={{ color: "#475569", fontSize: "14px", textTransform: "uppercase" }}>
              📁 {item.title}
            </strong>
            <div style={{ paddingLeft: "15px", marginTop: "5px", borderLeft: "1px solid #e2e8f0" }}>
              {renderItems(item.children)}
            </div>
          </div>
        );
      }

      // 3. ADDED: Check if this specific item is the active one
      const isActive = activeRoute === item.route;

      // IF IT IS A FILE
      return (
        <div key={index} style={{ margin: "2px 0" }}>
          <a
            href="#"
            style={{ 
              textDecoration: "none", 
              display: "block",
              padding: "6px 10px",
              borderRadius: "6px",
              fontSize: "14px",
              color: isActive ? "#2563eb" : "#64748b",
              fontWeight: isActive ? "600" : "400",
              backgroundColor: isActive ? "#eff6ff" : "transparent",
              transition: "all 0.2s ease-in-out"
            }}
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(
                new CustomEvent("doc-change", {
                  detail: item.route,
                }),
              );
            }}
          >
            📄 {item.title}
          </a>
        </div>
      );
    });
  }

  return (
    <div style={{ paddingRight: "10px" }}>
      <TenantSelector />
      <VersionSelector />
      <Search />
      <h3 style={{ marginTop: "20px" }}>Docs</h3>
      {renderItems(sidebar)}
    </div>
  );
}