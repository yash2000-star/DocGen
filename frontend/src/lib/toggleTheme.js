/**
 * toggleTheme.js — Dark/light mode manager that respects
 * docs.json modeToggle config and persists user preference.
 * 
 * Usage:
 *   import { initThemeMode, toggleDarkMode, isDarkMode, shouldHideToggle } from '../lib/toggleTheme';
 *   initThemeMode(config);  // Call once on config load
 *   toggleDarkMode();       // Call on button click
 */

let _isHidden = false;

/**
 * Initialize theme mode from config.
 * Reads modeToggle.default and localStorage preference.
 * localStorage always wins if the user has manually toggled.
 */
export function initThemeMode(config) {
  const modeToggle = config?.modeToggle || {};
  const defaultMode = modeToggle.default || 'light';
  _isHidden = modeToggle.isHidden === true;

  // localStorage preference takes priority over config default
  const saved = localStorage.getItem('theme');
  const effectiveMode = saved || defaultMode;

  if (effectiveMode === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  // If no saved preference, store the config default
  if (!saved) {
    localStorage.setItem('theme', effectiveMode);
  }
}

/**
 * Toggle between dark and light mode.
 */
export function toggleDarkMode() {
  const isDark = document.body.classList.contains('dark');
  if (isDark) {
    document.body.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  } else {
    document.body.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }
}

/**
 * Returns true if dark mode is currently active.
 */
export function isDarkMode() {
  return document.body.classList.contains('dark');
}

/**
 * Returns true if the toggle button should be hidden
 * (based on config.modeToggle.isHidden).
 */
export function shouldHideToggle() {
  return _isHidden;
}
