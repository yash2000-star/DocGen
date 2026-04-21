import { useNavigate } from "react-router-dom";

/**
 * Mintlify-style Previous / Next page navigation buttons.
 * Appears at the bottom of each doc page.
 */

// Helper: format slug to readable title
function formatTitle(slug) {
  if (!slug) return "Index";
  const parts = slug.split("/");
  const lastPart = parts[parts.length - 1];
  return lastPart
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Flatten the navigation array into a flat list of page routes
function flattenNavigation(navigation) {
  const pages = [];
  for (const group of navigation) {
    for (const page of group.pages || []) {
      const route = typeof page === "string" ? page : page.route;
      const title = typeof page === "string" ? formatTitle(page) : page.title;
      if (route) pages.push({ route, title });
    }
  }
  return pages;
}

export default function PageNavigation({ navigation = [], currentRoute, tenant, version }) {
  const navigate = useNavigate();

  if (!navigation.length || !currentRoute) return null;

  const flatPages = flattenNavigation(navigation);
  const currentIndex = flatPages.findIndex(
    (p) => p.route === currentRoute || p.route === currentRoute.replace(/^\//, "")
  );

  if (currentIndex === -1) return null;

  const prevPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
  const nextPage = currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;

  if (!prevPage && !nextPage) return null;

  const handleNavigate = (route) => {
    navigate(`/docs/${tenant}/${version}/${route}`);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "16px",
        marginTop: "48px",
        paddingTop: "32px",
        borderTop: "1px solid var(--border-color, #e2e8f0)",
      }}
    >
      {/* Previous Button */}
      {prevPage ? (
        <button
          onClick={() => handleNavigate(prevPage.route)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "4px",
            padding: "16px 20px",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "12px",
            backgroundColor: "var(--bg-main, #ffffff)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            textAlign: "left",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "var(--primary-brand, #3b82f6)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "var(--border-color, #e2e8f0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "var(--text-heading, #0f172a)",
            }}
          >
            {prevPage.title}
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "var(--text-muted, #64748b)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Previous
          </span>
        </button>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {/* Next Button */}
      {nextPage ? (
        <button
          onClick={() => handleNavigate(nextPage.route)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "4px",
            padding: "16px 20px",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "12px",
            backgroundColor: "var(--bg-main, #ffffff)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            textAlign: "right",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "var(--primary-brand, #3b82f6)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "var(--border-color, #e2e8f0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span
            style={{
              fontSize: "15px",
              fontWeight: "600",
              color: "var(--text-heading, #0f172a)",
            }}
          >
            {nextPage.title}
          </span>
          <span
            style={{
              fontSize: "13px",
              color: "var(--text-muted, #64748b)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </button>
      ) : (
        <div style={{ flex: 1 }} />
      )}
    </div>
  );
}
