import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Breadcrumbs from "../components/mdx/Breadcrumbs";
import PageActions from "../components/docs/PageActions";
import PageFeedback from "../components/docs/PageFeedback";
import SafeMdxRenderer from "../components/mdx/SafeMdxRenderer";
import { docsBase, isInternalDocHref } from "../lib/docLinks";
import { neighbours, titleFromRoute } from "../lib/siteNav";

// --- NEW: Accept the custom props from DocEngine! ---
export default function DocPage({ customTenant, customVersion, defaultRoute, linkBase: linkBaseProp, sitePrefix, site, navigation = [] }) {
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

  const linkBase = linkBaseProp ?? docsBase(tenant, version);

  // The browser tab shows the page's title, like the server-rendered page does.
  const pageTitle = site?.pages?.[currentRoute]?.title;
  useEffect(() => {
    if (pageTitle && site?.name) document.title = `${pageTitle} - ${site.name}`;
  }, [pageTitle, site?.name]);
  const { previous, next } = neighbours(navigation, currentRoute);
  const titleOf = (route) => site?.pages?.[route]?.title || titleFromRoute(route);

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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <Breadcrumbs path={currentRoute} />
        {page.status === "ready" && <PageActions tenant={tenant} version={version} route={currentRoute} />}
      </div>
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
        {page.status === "ready" && site?.pages?.[currentRoute]?.description && (
          <p data-testid="page-description" style={{ fontSize: "17px", color: "var(--text-muted, #64748b)", margin: "0 0 24px 0" }}>{site.pages[currentRoute].description}</p>
        )}
        {page.status === "ready" && <SafeMdxRenderer tree={page.tree} linkBase={linkBase} sitePrefix={sitePrefix} />}
        {page.status === "ready" && <PageFeedback key={currentRoute} tenant={tenant} version={version} route={currentRoute} />}
      </div>

      {page.status === "ready" && (previous || next) && (
        <nav data-testid="prev-next" style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginTop: "-48px", paddingBottom: "48px" }}>
          {previous ? (
            <a href={`${linkBase}/${previous}`} style={{ flex: 1, padding: "14px 16px", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: "10px", textDecoration: "none" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>Previous</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-heading, #0f172a)" }}>{titleOf(previous)}</div>
            </a>
          ) : <span style={{ flex: 1 }} />}
          {next ? (
            <a href={`${linkBase}/${next}`} style={{ flex: 1, padding: "14px 16px", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: "10px", textDecoration: "none", textAlign: "right" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>Next</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-heading, #0f172a)" }}>{titleOf(next)}</div>
            </a>
          ) : <span style={{ flex: 1 }} />}
        </nav>
      )}
    </div>
  );
}
