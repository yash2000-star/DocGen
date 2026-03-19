import { useEffect, useState } from "react";
import { useParams } from "react-router-dom"; // <-- ADDED: Pull variables from URL
import SearchModal from "./SearchModal";

export default function Sidebar() {
  const { tenant, version } = useParams(); // <-- Dynamic!
  const [sidebar, setSidebar] = useState([]);
  const [activeRoute, setActiveRoute] = useState("index");

  useEffect(() => {
    if (!tenant || !version) return;

    fetch(`http://localhost:4000/api/static/${tenant}/${version}/sidebar.json`)
      .then((res) => {
          if (!res.ok) throw new Error("Sidebar not found");
          return res.json();
      })
      .then((data) => setSidebar(data))
      .catch((err) => {
          console.log("No sidebar for this version/tenant");
          setSidebar([]);
      });
  }, [tenant, version]);

  useEffect(() => {
    function handleDocChange(event) {
      if (event.detail) setActiveRoute(event.detail);
    }
    window.addEventListener("doc-change", handleDocChange);
    return () => window.removeEventListener("doc-change", handleDocChange);
  }, []);

  function renderItems(items) {
    return items.map((item, index) => {
      // IF IT IS A FOLDER
      if (item.children) {
        return (
          <div key={index} style={{ marginTop: "24px" }}>
            <strong style={{ 
              color: "#0f172a", // Darker Mintlify Header Color
              fontSize: "13px", 
              fontWeight: "600",
              textTransform: "capitalize",
              paddingLeft: "12px",
              display: "block",
              marginBottom: "8px"
            }}>
              {item.title}
            </strong>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {renderItems(item.children)}
            </div>
          </div>
        );
      }

      // IF IT IS A FILE
      const isActive = activeRoute === item.route;

      return (
        <div key={index}>
          <a
            href="#"
            style={{ 
              textDecoration: "none", 
              display: "block",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              color: isActive ? "var(--primary-brand)" : "#64748b",
              fontWeight: isActive ? "600" : "500",
              backgroundColor: isActive ? "rgba(15, 186, 129, 0.1)" : "transparent",
              transition: "all 0.1s ease",
              borderLeft: isActive ? "2px solid var(--primary-brand)" : "2px solid transparent",
              marginLeft: "-2px" // Pulls the border flush with the edge
            }}
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(
                new CustomEvent("doc-change", {
                  detail: item.route,
                }),
              );
            }}
            onMouseOver={(e) => {
               if(!isActive) e.currentTarget.style.color = "#0f172a";
            }}
            onMouseOut={(e) => {
               if(!isActive) e.currentTarget.style.color = "#64748b";
            }}
          >
            {item.title}
          </a>
        </div>
      );
    });
  }

  return (
    <div style={{ padding: "24px 12px 24px 24px" }}>
      {/* We removed the bulky selectors here to match Mintlify's clean look */}
      {renderItems(sidebar)}
    </div>
  );
}