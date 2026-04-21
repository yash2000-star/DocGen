/**
 * themes.js — Built-in theme presets for the DocGen platform.
 * Each preset defines visual tokens that get injected as CSS variables.
 * 
 * Usage:
 *   import { applyPreset } from '../lib/themes';
 *   applyPreset('mint'); // or 'prism', 'default', 'dark'
 */

const presets = {
  mint: {
    borderRadius: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    sidebarStyle: 'rounded',
    forceDark: false,
  },
  prism: {
    borderRadius: '4px',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    sidebarStyle: 'sharp',
    forceDark: false,
  },
  default: {
    borderRadius: '6px',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    sidebarStyle: 'flat',
    forceDark: false,
  },
  dark: {
    borderRadius: '6px',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    sidebarStyle: 'flat',
    forceDark: true,
  },
};

/**
 * Applies a theme preset by name. Injects CSS variables.
 * Falls back to 'default' if the preset name is not recognized.
 */
export function applyPreset(themeName) {
  const preset = presets[themeName] || presets.default;
  const root = document.documentElement;

  root.style.setProperty('--theme-border-radius', preset.borderRadius);
  root.style.setProperty('--theme-font-family', preset.fontFamily);
  root.style.setProperty('--theme-sidebar-style', preset.sidebarStyle);

  // If the preset forces dark mode, apply it
  if (preset.forceDark) {
    document.body.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }
}

export { presets };
