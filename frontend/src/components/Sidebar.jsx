import { NavLink } from "react-router-dom"; 
import SearchModal from "./SearchModal";

// Helper function to format clean titles from URL slugs
function formatTitle(slug) {
  if (!slug) return "Index";
  const parts = slug.split('/');
  const lastPart = parts[parts.length - 1]; // e.g., 'quickstart' from 'getting-started/quickstart'
  return lastPart
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// --- NEW: Accept the custom props + the docs.json navigation array! ---
export default function Sidebar({ customTenant, customVersion, navigation = [] }) {
  
  function renderNavigation() {
    return navigation.map((navGroup, index) => {
      // navGroup format from docs.json: { group: "String", pages: [...] }
      const groupName = navGroup.group || "Documentation";
      const pages = navGroup.pages || [];

      return (
        <div key={index} style={{ marginTop: "24px" }}>
          <strong style={{ 
            color: "#0f172a", 
            fontSize: "13px", 
            fontWeight: "600",
            textTransform: "capitalize",
            paddingLeft: "12px",
            display: "block",
            marginBottom: "8px"
          }}>
            {groupName}
          </strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {pages.map((page, pIdx) => {
              // Page could be just a string slug or an object if they customize further
              const pageRoute = typeof page === 'string' ? page : page.route;
              const pageTitle = typeof page === 'string' ? formatTitle(page) : page.title;
              
              // Construct the absolute path for React Router
              const fullPath = `/docs/${customTenant}/${customVersion}/${pageRoute}`;

              return (
                <NavLink
                  key={pIdx}
                  to={fullPath}
                  end={pageRoute === "index" || pageRoute === ""}
                  style={({ isActive }) => ({ 
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
                    marginLeft: "-2px" 
                  })}
                  onMouseOver={(e) => {
                     // NavLink automatically applies the 'active' class, so we can check it
                     if(!e.currentTarget.classList.contains('active')) {
                       e.currentTarget.style.color = "#0f172a";
                     }
                  }}
                  onMouseOut={(e) => {
                     if(!e.currentTarget.classList.contains('active')) {
                       e.currentTarget.style.color = "#64748b";
                     }
                  }}
                >
                  {pageTitle}
                </NavLink>
              );
            })}
          </div>
        </div>
      );
    });
  }

  return (
    <div style={{ padding: "24px 12px 24px 24px" }}>
      {navigation.length > 0 ? renderNavigation() : (
        <div style={{ color: "#64748b", fontSize: "13px", paddingLeft: "12px" }}>
          No navigation available yet. Add items in docs.json.
        </div>
      )}
    </div>
  );
}