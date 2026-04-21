import { useEffect, useState, useCallback } from "react";

/**
 * Client-side Table of Contents.
 * Scans the rendered .mdx-content container for h2/h3 headings,
 * builds a TOC list, and highlights the currently visible heading.
 */
export default function Toc() {
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState("");

  // Scan the DOM for headings after content renders
  const scanHeadings = useCallback(() => {
    const container = document.querySelector(".mdx-content");
    if (!container) return;

    const elements = container.querySelectorAll("h2[id], h3[id]");
    const items = Array.from(elements).map((el) => ({
      id: el.id,
      text: el.textContent,
      level: el.tagName === "H2" ? 2 : 3,
    }));

    setHeadings(items);
    if (items.length > 0 && !activeId) {
      setActiveId(items[0].id);
    }
  }, [activeId]);

  // Re-scan when the page content changes (MutationObserver)
  useEffect(() => {
    // Initial scan with a delay to let MDX render
    const timer = setTimeout(scanHeadings, 300);

    // Watch for content changes (new MDX page loads)
    const container = document.querySelector(".mdx-content");
    if (!container) return () => clearTimeout(timer);

    const observer = new MutationObserver(() => {
      setTimeout(scanHeadings, 200);
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [scanHeadings]);

  // Intersection Observer: track which heading is currently visible
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first heading that's intersecting (visible in viewport)
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0.1,
      }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div style={{ borderLeft: "2px solid var(--border-color, #e2e8f0)", paddingLeft: "16px" }}>
      <h4 style={{
        fontSize: "12px",
        fontWeight: "600",
        color: "var(--text-muted, #64748b)",
        textTransform: "uppercase",
        letterSpacing: "0.8px",
        marginBottom: "14px",
        marginTop: 0,
        display: "flex",
        alignItems: "center",
        gap: "6px"
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="14" y2="12" />
          <line x1="4" y1="18" x2="18" y2="18" />
        </svg>
        On this page
      </h4>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {headings.map((item) => {
          const isActive = activeId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              style={{
                paddingLeft: item.level === 3 ? "12px" : "0px",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: isActive ? "600" : "400",
                color: isActive ? "var(--primary-brand, #3b82f6)" : "var(--text-muted, #64748b)",
                borderLeft: isActive ? "2px solid var(--primary-brand, #3b82f6)" : "2px solid transparent",
                marginLeft: "-18px",
                paddingLeft: item.level === 3 ? "28px" : "16px",
                paddingTop: "4px",
                paddingBottom: "4px",
                transition: "all 0.15s ease",
                lineHeight: "1.4",
                display: "block",
              }}
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById(item.id);
                if (element) {
                  element.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActiveId(item.id);
                }
              }}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--text-heading, #0f172a)";
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--text-muted, #64748b)";
              }}
            >
              {item.text}
            </a>
          );
        })}
      </div>
    </div>
  );
}