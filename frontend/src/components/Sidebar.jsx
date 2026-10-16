import { NavLink } from "react-router-dom"; 
import { titleFromRoute } from "../lib/siteNav";

/**
 * @param {object} props
 * @param {Array} props.navigation - Groups to show (the active tab's)
 * @param {Object<string, { title: string }>} [props.pages] - From site.json, for page titles
 * @param {string} props.linkBase - /docs/<tenant>/<project>, or "" on a custom domain
 */
export default function Sidebar({ navigation = [], pages = {}, linkBase = "" }) {
  
  function renderNavigation() {
    return navigation.map((navGroup, index) => {
      // navGroup format from docs.json: { group: "String", pages: [...] }
      const groupName = navGroup.group || "Documentation";
      const groupPages = navGroup.pages || [];

      return (
        <div key={index} style={{ marginTop: "24px" }}>
          <strong style={{ 
            color: "#0f172a", 
            fontSize: "13px", 
            fontWeight: "600",
            textTransform: "none",
            paddingLeft: "12px",
            display: "block",
            marginBottom: "8px"
          }}>
            {groupName}
          </strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {groupPages.map((page, pIdx) => {
              // Page could be just a string slug or an object if they customize further
              const pageRoute = typeof page === 'string' ? page : page.route || page.page;
              const pageTitle = pages[pageRoute]?.title || (typeof page === 'object' && page.title) || titleFromRoute(pageRoute);
              const fullPath = `${linkBase}/${pageRoute}`;

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