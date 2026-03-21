import { Fragment } from "react";

export default function Breadcrumbs({ path = "" }) {
  // If we are on the index page, we don't need breadcrumbs
  if (!path || path === "index") return null;

  // Split a path like "guides/setup/installation" into an array
  const segments = path.split('/').filter(Boolean);

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      flexWrap: "wrap",
      gap: "8px", 
      marginBottom: "24px",
      fontSize: "13px",
      fontWeight: "500",
      color: "#64748b"
    }}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        // Capitalize the first letter and replace dashes with spaces
        const formattedName = segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        return (
          <Fragment key={index}>
            {index > 0 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
            <span style={{ color: isLast ? "var(--primary-brand)" : "inherit" }}>
              {formattedName}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}