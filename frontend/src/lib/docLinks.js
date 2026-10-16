// Links inside generated pages point at other pages by slug ("/quickstart", "quickstart",
// "./quickstart.mdx"). Pages are served at /docs/<tenant>/<project>/<slug>, so these are
// resolved against that base before they reach the browser.

/**
 * The URL prefix for a docs site: /docs/<tenant>/<project>, or "" on the site's own
 * custom domain, where pages are served at the root.
 */
export function docsBase(tenant, version, onCustomDomain = false) {
  return onCustomDomain ? "" : `/docs/${tenant}/${version}`;
}

/**
 * @param {string} href - As written in the page
 * @param {string} base - docsBase(tenant, version, onCustomDomain)
 * @param {string} [sitePrefix] - /docs/<tenant>/<project>, rewritten to base on custom domains
 * @returns {string} A URL the browser can follow
 */
export function resolveDocHref(href, base, sitePrefix) {
  if (typeof href !== "string" || !href) return href;
  // On a custom domain, links written as /docs/<tenant>/<project>/... point at the root.
  if (sitePrefix && base !== sitePrefix && (href === sitePrefix || href.startsWith(`${sitePrefix}/`) || href.startsWith(`${sitePrefix}#`))) {
    href = href.slice(sitePrefix.length) || "/";
  }
  // External links, mail, anchors on the same page, and protocol-relative URLs stay as they are.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("//")) return href;
  // Already a full docs path (on the main app).
  if ((base && href.startsWith("/docs/")) || href.startsWith("/api/")) return href;

  const [path, hash = ""] = href.split("#");
  const slug = path.replace(/^\.?\/+/, "").replace(/\.mdx?$/i, "").replace(/\/+$/, "");
  const target = slug ? `${base}/${slug}` : base;
  return hash ? `${target}#${hash}` : target;
}

/** True if href is a page of this docs site (follow it without reloading the app). */
export function isInternalDocHref(href, base) {
  if (typeof href !== "string") return false;
  if (!base) return href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/api/");
  return href === base || href.startsWith(`${base}/`) || href.startsWith(`${base}#`);
}
