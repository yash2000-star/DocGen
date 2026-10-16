// Navigation helpers for the docs viewer. Mirrors lib/siteManifest.js (used by the build
// and the backend), which defines site.json: groups may name a tab; groups without one are
// in the "Documentation" tab.

export const DEFAULT_TAB = "Documentation";

export function tabsOf(navigation = []) {
  const tabs = [];
  for (const group of navigation) {
    const name = group.tab || DEFAULT_TAB;
    let tab = tabs.find((t) => t.tab === name);
    if (!tab) tabs.push((tab = { tab: name, groups: [] }));
    tab.groups.push(group);
  }
  return tabs;
}

const routesOf = (group) => (group.pages || []).map((page) => (typeof page === "string" ? page : page?.page || page?.route)).filter(Boolean);

export function tabForRoute(navigation, route) {
  const tabs = tabsOf(navigation);
  return tabs.find((t) => t.groups.some((g) => routesOf(g).includes(route))) || tabs[0] || null;
}

export function firstRoute(group) {
  return routesOf(group)[0] || null;
}

export function neighbours(navigation, route) {
  const tab = tabForRoute(navigation, route);
  const order = (tab?.groups || []).flatMap(routesOf);
  const index = order.indexOf(route);
  return {
    previous: index > 0 ? order[index - 1] : null,
    next: index >= 0 && index < order.length - 1 ? order[index + 1] : null,
  };
}

// "getting-started/quickstart" → "Quickstart" (when a page has no title yet).
export function titleFromRoute(route) {
  const last = String(route || "").split("/").pop() || "Index";
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
