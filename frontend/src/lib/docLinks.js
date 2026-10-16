// Links inside generated pages point at other pages by slug ("/quickstart", "quickstart",
// "./quickstart.mdx"). Pages are served at /docs/<tenant>/<project>/<slug>, so these are
// resolved against that base before they reach the browser.

/** The URL prefix for a docs site. */
export function docsBase(tenant, version) {
  return `/docs/${tenant}/${version}`;
}

/**
 * @param {string} href - As written in the page
 * @param {string} base - docsBase(tenant, version)
 * @returns {string} A URL the browser can follow
 */
export function resolveDocHref(href, base) {
  if (typeof href !== "string" || !href) return href;
  // External links, mail, anchors on the same page, and protocol-relative URLs stay as they are.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("//")) return href;
  // Already a full docs path.
  if (href.startsWith("/docs/") || href.startsWith("/api/")) return href;

  const [path, hash = ""] = href.split("#");
  const slug = path.replace(/^\.?\/+/, "").replace(/\.mdx?$/i, "").replace(/\/+$/, "");
  const target = slug ? `${base}/${slug}` : base;
  return hash ? `${target}#${hash}` : target;
}

/** True if href is a page of this docs site (follow it without reloading the app). */
export function isInternalDocHref(href, base) {
  return typeof href === "string" && (href === base || href.startsWith(`${base}/`) || href.startsWith(`${base}#`));
}
