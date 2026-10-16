// The site manifest (dist/<tenant>/<project>/site.json): every published page with its
// title and description, and the sidebar navigation. The build writes it; the docs viewer
// uses it for the sidebar, tabs and previous/next links, and the backend for SEO pages,
// the sitemap and llms.txt.
//
// Navigation is docs.json's list of groups. A group may name a tab ({ group, tab, pages }):
// groups without one are in the "Documentation" tab.

const DEFAULT_TAB = "Documentation";

/**
 * Keeps only pages that exist, drops empty groups, and lists pages that aren't in any
 * group at the end (in a group named after their own frontmatter group).
 * @param {Array} navigation - docs.json navigation
 * @param {Object<string, { title: string, group?: string }>} pages - route → page
 * @returns {{ group: string, tab: string|null, pages: string[] }[]}
 */
function normalizeNavigation(navigation, pages) {
    const listed = new Set();
    const groups = [];
    for (const entry of Array.isArray(navigation) ? navigation : []) {
        if (!entry || typeof entry !== "object") continue;
        const routes = (entry.pages || [])
            .map((page) => (typeof page === "string" ? page : page?.page || page?.route))
            .filter((route) => typeof route === "string" && pages[route] && !listed.has(route));
        routes.forEach((route) => listed.add(route));
        if (routes.length) groups.push({ group: String(entry.group || DEFAULT_TAB), tab: entry.tab ? String(entry.tab) : null, pages: routes });
    }

    const unlisted = Object.keys(pages).filter((route) => !listed.has(route));
    for (const route of unlisted) {
        const name = pages[route].group || "Other pages";
        let group = groups.find((g) => g.group === name && !g.tab);
        if (!group) groups.push((group = { group: name, tab: null, pages: [] }));
        group.pages.push(route);
    }
    return groups;
}

/** Tabs in order: [{ tab, groups }]. Groups without a tab come first. */
function tabsOf(navigation) {
    const tabs = [];
    for (const group of navigation) {
        const name = group.tab || DEFAULT_TAB;
        let tab = tabs.find((t) => t.tab === name);
        if (!tab) tabs.push((tab = { tab: name, groups: [] }));
        tab.groups.push(group);
    }
    return tabs;
}

/** The tab a page is in, or the first tab. */
function tabForRoute(navigation, route) {
    const tabs = tabsOf(navigation);
    return tabs.find((t) => t.groups.some((g) => g.pages.includes(route))) || tabs[0] || null;
}

/** Pages in reading order (optionally within one tab). */
function readingOrder(navigation, tabName) {
    return navigation.filter((g) => !tabName || (g.tab || DEFAULT_TAB) === tabName).flatMap((g) => g.pages);
}

/** The previous and next pages around a route, within its tab. */
function neighbours(navigation, route) {
    const tab = tabForRoute(navigation, route);
    const order = readingOrder(navigation, tab?.tab);
    const index = order.indexOf(route);
    return { previous: index > 0 ? order[index - 1] : null, next: index >= 0 && index < order.length - 1 ? order[index + 1] : null };
}

module.exports = { DEFAULT_TAB, normalizeNavigation, tabsOf, tabForRoute, readingOrder, neighbours };
