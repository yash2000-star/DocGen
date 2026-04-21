/**
 * applyTheme.js — Reads a docs.json config object and injects
 * CSS variables, favicon, document title, and OG meta tags.
 * 
 * Safe to call multiple times (idempotent).
 * 
 * Usage: import { applyTheme } from '../lib/applyTheme';
 *        applyTheme(config);
 */

const DEFAULTS = {
  primaryColor: '#0fba81',
  lightColor: '#ffffff',
  darkColor: '#000000',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  siteName: 'Documentation',
  searchPrompt: 'Search documentation...',
};

/**
 * Creates or updates a <meta> tag in <head>.
 */
function setMetaTag(property, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Sets the favicon by updating or creating <link rel="icon">.
 */
function setFavicon(href) {
  if (!href) return;
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Main entry: applies all theme properties from a docs.json config.
 */
export function applyTheme(config) {
  if (!config) return;

  const root = document.documentElement;

  // --- 1. Colors ---
  const primary = config.colors?.primary || config.theme?.primaryColor || DEFAULTS.primaryColor;
  const light = config.colors?.light || DEFAULTS.lightColor;
  const dark = config.colors?.dark || DEFAULTS.darkColor;

  root.style.setProperty('--primary-brand', primary);
  root.style.setProperty('--color-primary', primary);
  root.style.setProperty('--color-primary-light', light);
  root.style.setProperty('--color-primary-dark', dark);

  // --- 2. Background image ---
  if (config.backgroundImage) {
    root.style.setProperty('--background-image', `url(${config.backgroundImage})`);
  } else {
    root.style.setProperty('--background-image', 'none');
  }

  // --- 3. Font family ---
  const fontFamily = config.font || config.fontFamily || DEFAULTS.fontFamily;
  root.style.setProperty('--font-family', fontFamily);

  // --- 4. Document title ---
  const siteName = config.name || DEFAULTS.siteName;
  if (siteName) {
    document.title = siteName;
  }

  // --- 5. Favicon ---
  if (config.favicon) {
    setFavicon(config.favicon);
  }

  // --- 6. OpenGraph meta tags ---
  if (config.metadata) {
    setMetaTag('og:title', config.metadata['og:title'] || siteName);
    setMetaTag('og:description', config.metadata['og:description']);
    setMetaTag('og:image', config.metadata['og:image']);
  }

  // --- 7. Search prompt (stored as CSS custom property for components to read) ---
  const searchPrompt = config.search?.prompt || DEFAULTS.searchPrompt;
  root.style.setProperty('--search-prompt', `"${searchPrompt}"`);
  // Also store as a data attribute for easy JS access
  root.dataset.searchPrompt = searchPrompt;
}
