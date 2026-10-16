import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import SearchModal from "../components/SearchModal";
import Sidebar from "../components/Sidebar";
import DocPage from "./DocPage";
import Toc from "../components/Toc";
import AiChat from "../components/AiChat";
import Logo from "../components/Logo";
import { applyTheme } from "../lib/applyTheme";
import { docsBase, resolveDocHref } from "../lib/docLinks";
import { tabsOf, tabForRoute, firstRoute } from "../lib/siteNav";
import { initThemeMode, shouldHideToggle } from "../lib/toggleTheme";
import { applyPreset } from "../lib/themes";

// The first page listed in docs.json navigation, used when the URL names no page.
function firstPageRoute(navigation) {
  for (const group of navigation || []) {
    for (const page of group?.pages || []) {
      const route = typeof page === "string" ? page : page?.route;
      if (route) return route;
    }
  }
  return null;
}

// --- NEW: Accept the custom props from App.jsx! ---
export default function DocEngine({ customTenant, customVersion }) { 
  const params = useParams();
  
  // THE MAGIC TRICK: Use the prop if it exists (Custom Domain), otherwise use the URL (Dashboard Preview)
  const tenant = customTenant || params.tenant;
  const version = customVersion || params.version;
  
  // Detect if we are inside the Dashboard's iframe preview
  const [isPreview, setIsPreview] = useState(false);
  const [siteConfig, setSiteConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [hideToggle, setHideToggle] = useState(false);
  // site.json from the build: page titles/descriptions and navigation (with tabs).
  const [site, setSite] = useState(null);

  // On the site's own custom domain pages live at the root; otherwise under /docs/<tenant>/<project>.
  const onCustomDomain = Boolean(customTenant);
  const sitePrefix = `/docs/${tenant}/${version}`;
  const linkBase = docsBase(tenant, version, onCustomDomain);

  useEffect(() => {
    if (!tenant || !version) return;
    let cancelled = false;
    fetch(`${import.meta.env.VITE_API_URL}/api/static/${tenant}/${version}/site.json`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setSite(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tenant, version]);

  useEffect(() => {
    setIsPreview(window !== window.top);
  }, []);

  // Search results ask for a page with a "doc-change" event ({ detail: route }).
  const navigate = useNavigate();
  useEffect(() => {
    if (!tenant || !version) return;
    const onDocChange = (event) => navigate(resolveDocHref(String(event.detail || ""), linkBase, sitePrefix));
    window.addEventListener("doc-change", onDocChange);
    return () => window.removeEventListener("doc-change", onDocChange);
  }, [tenant, version, navigate, linkBase, sitePrefix]);

 // Fetch the custom color theme if it exists
  useEffect(() => {
    if (!tenant || !version) return;
    
    const API_URL = import.meta.env.VITE_API_URL; 
    
    // Fetch docs.json (falls back to mint.json for backwards compat)
    fetch(`${API_URL}/api/static/${tenant}/${version}/docs.json`, { cache: "no-store" })
      .then(res => {
        if (res.ok) return res.json();
        return fetch(`${API_URL}/api/static/${tenant}/${version}/mint.json`, { cache: "no-store" })
          .then(r => r.ok ? r.json() : null);
      })
      .then(config => {
        if (!config) return;

        // Store config for child components
        setSiteConfig(config);

        // Step 3: Apply the full theme system
        applyTheme(config);

        // Step 4: Initialize dark/light mode from config
        initThemeMode(config);
        setHideToggle(shouldHideToggle());

        // Step 9: Apply the theme preset
        const themeName = config.theme || 'default';
        applyPreset(themeName);
      })
      .catch((err) => {
        console.error("Failed to load theme config:", err);
        document.documentElement.style.setProperty("--primary-brand", "#0fba81");
      })
      .finally(() => setConfigLoaded(true));
  }, [tenant, version]);

  // Until docs.json has loaded we don't know which page to open by default.
  const navigation = site?.navigation || siteConfig?.navigation || [];
  const defaultRoute = configLoaded ? (firstPageRoute(navigation) || "index") : null;
  const currentRoute = params["*"] || defaultRoute;
  const tabs = tabsOf(navigation);
  const activeTab = tabForRoute(navigation, currentRoute);

  // Derive topbar links and CTA from config
  const topbarLinks = siteConfig?.topbarLinks || [];
  const ctaButton = siteConfig?.topbarCtaButton || {};
  const footerSocials = siteConfig?.footerSocials || {};
  const searchPrompt = siteConfig?.search?.prompt || 'Search...';
  const hasBackground = siteConfig?.backgroundImage && siteConfig.backgroundImage.length > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "var(--bg-main, #ffffff)", fontFamily: "var(--theme-font-family, var(--font-family, system-ui, -apple-system, sans-serif))", position: "relative" }}>
      
      {/* Step 8: Background Image Overlay */}
      {hasBackground && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url(${siteConfig.backgroundImage})`,
          backgroundSize: "cover", backgroundPosition: "center",
          opacity: 0.05, pointerEvents: "none", zIndex: 0
        }}></div>
      )}

      <SearchModal />
      
      {/* MINTLIFY-STYLE TOP NAVBAR (Hidden in preview mode) */}
      {!isPreview && (
        <div style={{ 
          height: "64px", 
          padding: "0 24px", 
          borderBottom: "1px solid var(--border-color, #e2e8f0)", 
          display: "flex", 
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          zIndex: 50
        }}>
          
          {/* Left: Logo Area (Step 5 & 6) */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "260px" }}>
            <Logo config={siteConfig} />
            {!siteConfig && (
              <>
                <div style={{ width: "24px", height: "24px", backgroundColor: "var(--primary-brand)", borderRadius: "6px" }}></div>
                <span style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-heading, #0f172a)" }}>
                  {tenant ? tenant.charAt(0).toUpperCase() + tenant.slice(1) : "Mint"} Docs
                </span>
              </>
            )}
          </div>

          {/* Middle: Search Bar (Step 10: dynamic placeholder) */}
          <div style={{ flex: 1, maxWidth: "400px", display: "flex", justifyContent: "center" }}>
            <button 
            onClick={() => window.dispatchEvent(new CustomEvent("open-search"))}
              style={{ 
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", backgroundColor: "var(--bg-sidebar, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)", 
                borderRadius: "var(--theme-border-radius, 8px)", color: "var(--text-muted, #64748b)", fontSize: "14px", cursor: "text"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                {searchPrompt}
              </div>
              <span style={{ fontSize: "12px", border: "1px solid var(--border-color, #cbd5e1)", padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--bg-main, #ffffff)" }}>Ctrl K</span>
            </button>
          </div>

          {/* Right: Topbar Links + CTA + Theme Toggle (Step 6) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px", width: "260px" }}>
            {/* Dynamic topbar links from docs.json */}
            {topbarLinks.map((link, i) => (
              <a 
                key={i} 
                href={link.url || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500", cursor: "pointer", textDecoration: "none" }}
              >
                {link.name || link}
              </a>
            ))}
            
            {/* Static fallback link if no topbar links configured */}
            {topbarLinks.length === 0 && (
              <span style={{ fontSize: "14px", color: "var(--text-muted, #64748b)", fontWeight: "500", cursor: "pointer" }}>Support</span>
            )}
            
            {/* CTA Button from docs.json */}
            {ctaButton.name && ctaButton.url ? (
              <a href={ctaButton.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <button style={{ 
                  backgroundColor: "var(--color-primary, var(--primary-brand))", color: "#ffffff", border: "none", 
                  borderRadius: "var(--theme-border-radius, 6px)", padding: "6px 12px", fontSize: "13px", fontWeight: "600", cursor: "pointer" 
                }}>
                  {ctaButton.name}
                </button>
              </a>
            ) : (
              <Link to="/dashboard" style={{ textDecoration: "none" }}>
                <button style={{ 
                  backgroundColor: "var(--color-primary, var(--primary-brand))", color: "#ffffff", border: "none", 
                  borderRadius: "var(--theme-border-radius, 6px)", padding: "6px 12px", fontSize: "13px", fontWeight: "600", cursor: "pointer" 
                }}>
                  Dashboard ›
                </button>
              </Link>
            )}
            
            {/* Theme Toggle (Step 4: hidden if modeToggle.isHidden) */}
            {!hideToggle && <ThemeToggle />}
          </div>
        </div>
      )}

      {/* Tabs (e.g. Documentation / API reference), when the site has more than one */}
      {!isPreview && tabs.length > 1 && (
        <nav data-testid="docs-tabs" style={{ display: "flex", gap: "24px", padding: "0 24px", borderBottom: "1px solid var(--border-color, #e2e8f0)", backgroundColor: "var(--bg-main, #ffffff)", position: "relative", zIndex: 2 }}>
          {tabs.map((tab) => {
            const active = tab.tab === activeTab?.tab;
            const target = firstRoute(tab.groups[0]);
            return (
              <Link key={tab.tab} to={`${linkBase}/${target}`} style={{ padding: "12px 0", fontSize: "14px", fontWeight: active ? 600 : 500, textDecoration: "none", color: active ? "var(--primary-brand)" : "var(--text-muted, #64748b)", borderBottom: active ? "2px solid var(--primary-brand)" : "2px solid transparent", marginBottom: "-1px" }}>
                {tab.tab}
              </Link>
            );
          })}
        </nav>
      )}

      {/* MAIN 3-COLUMN LAYOUT */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", zIndex: 1 }}>
        
        {/* 1. Left Sidebar (Navigation) */}
        <div style={{ 
          width: isPreview ? "220px" : "260px", 
          borderRight: "1px solid var(--border-color, #e2e8f0)", 
          overflowY: "auto", 
          backgroundColor: "var(--bg-main, #ffffff)",
          flexShrink: 0
        }}>
          {/* Passed the props down! */}
          <Sidebar navigation={activeTab?.groups || navigation} pages={site?.pages} linkBase={linkBase} />
        </div>
        
        {/* 2. Center Content (The actual Docs) */}
        <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--bg-main, #ffffff)" }}>
          <div style={{ 
            maxWidth: "800px", 
            margin: "0 auto", 
            padding: "48px 32px" 
          }}>
            {/* Passed the props down! */}
            <DocPage customTenant={tenant} customVersion={version} defaultRoute={defaultRoute} linkBase={linkBase} sitePrefix={sitePrefix} site={site} navigation={navigation} />
          </div>

          {/* Step 7: Footer with Social Links */}
          <footer style={{
            maxWidth: "800px", margin: "0 auto", padding: "32px 32px 48px",
            borderTop: "1px solid var(--border-color, #e2e8f0)", 
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: "13px", color: "var(--text-muted, #64748b)"
          }}>
            <span>Powered by DocGen</span>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              {/* GitHub */}
              {footerSocials.github && (
                <a href={footerSocials.github} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted, #64748b)", transition: "color 0.2s" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
              )}
              {/* Twitter/X */}
              {footerSocials.twitter && (
                <a href={footerSocials.twitter} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted, #64748b)", transition: "color 0.2s" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
              )}
              {/* LinkedIn */}
              {footerSocials.linkedin && (
                <a href={footerSocials.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted, #64748b)", transition: "color 0.2s" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              )}
            </div>
          </footer>
        </div>
        
        {/* 3. Right Sidebar (Table of Contents) */}
        {!isPreview && (
          <div style={{ 
            width: "250px", 
            padding: "32px 24px", 
            overflowY: "auto", 
            backgroundColor: "var(--bg-main, #ffffff)",
            flexShrink: 0
          }}>
            <div style={{ position: "sticky", top: 0 }}>
              <Toc />
              <div style={{ marginTop: "40px" }}>
                <AiChat customTenant={tenant} customVersion={version} />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}