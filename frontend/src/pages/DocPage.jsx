import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Breadcrumbs from "../components/mdx/Breadcrumbs";
import SafeMdxRenderer from "../components/mdx/SafeMdxRenderer";
import { docsBase, isInternalDocHref } from "../lib/docLinks";

// --- NEW: Accept the custom props from DocEngine! ---
export default function DocPage({ customTenant, customVersion, defaultRoute }) {
  const params = useParams();
  const navigate = useNavigate();

  // THE MAGIC TRICK: Use the custom domain props, otherwise use the URL!
  const tenant = customTenant || params.tenant;
  const version = customVersion || params.version;

  // Read the wildcard/splat parameter to determine which file to fetch.
  // If no path is provided (e.g., they just visited /docs/tenant/v1), open the first
  // page from docs.json navigation. defaultRoute is null while docs.json is loading.
  const currentRoute = params["*"] || defaultRoute;

  // { status: "loading" | "ready" | "not-found" | "syntax-error", tree?, error? }
  const [page, setPage] = useState({ status: "loading" });

  // Fetch the page, compiled by the server into a plain-data tree. The browser never
  // runs code from a page: it only draws the components and elements in the tree.
  useEffect(() => {
    if (!tenant || !version || !currentRoute) return;

    let cancelled = false;
    const API_URL = import.meta.env.VITE_API_URL;
    fetch(`${API_URL}/api/page/${tenant}/${version}/${currentRoute}`)
      .then((res) => {
        if (!res.ok) throw new Error("Document not found");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPage(data.error ? { status: "syntax-error", error: data.error } : { status: "ready", tree: data.tree });
      })
      .catch((error) => {
        console.error("Fetch Error:", error);
        if (!cancelled) setPage({ status: "not-found" });
      });

    return () => { cancelled = true; };
  }, [tenant, version, currentRoute]);

  const linkBase = docsBase(tenant, version);

  // Follow links between pages of this site without reloading the app.
  const handleClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.("a[href]");
    if (!anchor || anchor.target === "_blank") return;
    const href = anchor.getAttribute("href");
    if (!isInternalDocHref(href, linkBase)) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <div className="mdx-content" onClick={handleClick}>
      <Breadcrumbs path={currentRoute} />
      <div className="pb-24">
        {page.status === "loading" && <h2>Loading document...</h2>}
        {page.status === "not-found" && (
          <div style={{ padding: "20px", color: "var(--text-muted)" }}>Document not found: {currentRoute}</div>
        )}
        {page.status === "syntax-error" && (
          <div role="alert" style={{ padding: "16px", border: "1px solid #fecaca", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px", fontSize: "14px" }}>
            This page has a syntax error{page.error.line ? ` on line ${page.error.line}` : ""} and can't be shown: {page.error.message}
          </div>
        )}
        {page.status === "ready" && <SafeMdxRenderer tree={page.tree} linkBase={linkBase} />}
      </div>
    </div>
  );
}
