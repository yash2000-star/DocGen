import { isDarkMode } from '../lib/toggleTheme';

/**
 * Logo component that switches between light/dark logo variants.
 * Falls back to displaying config.name as text if no logo paths are set.
 * 
 * Props:
 *   config    - The docs.json config object
 *   className - Optional CSS className for sizing
 */
export default function Logo({ config, className }) {
  if (!config) return null;

  const lightLogo = config.logo?.light;
  const darkLogo = config.logo?.dark;
  const siteName = config.name || 'Docs';

  // Check if we have actual logo URLs (not just the template defaults)
  const hasLightLogo = lightLogo && lightLogo !== '/logo/light.svg' && lightLogo.length > 1;
  const hasDarkLogo = darkLogo && darkLogo !== '/logo/dark.svg' && darkLogo.length > 1;
  const hasAnyLogo = hasLightLogo || hasDarkLogo;

  if (!hasAnyLogo) {
    // Fallback: show site name as text
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ 
          width: '24px', height: '24px', 
          backgroundColor: 'var(--color-primary, var(--primary-brand))', 
          borderRadius: 'var(--theme-border-radius, 6px)' 
        }}></div>
        <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-heading, #0f172a)' }}>
          {siteName}
        </span>
      </div>
    );
  }

  // Pick the right logo variant based on current mode
  const dark = isDarkMode();
  const logoSrc = dark 
    ? (hasDarkLogo ? darkLogo : lightLogo) 
    : (hasLightLogo ? lightLogo : darkLogo);

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <img 
        src={logoSrc} 
        alt={siteName}
        style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
        onError={(e) => {
          // If the image fails to load, replace with text fallback
          e.target.style.display = 'none';
          e.target.parentElement.innerHTML = `
            <div style="width:24px;height:24px;background:var(--color-primary, var(--primary-brand));border-radius:6px"></div>
            <span style="font-size:16px;font-weight:600;color:var(--text-heading)">${siteName}</span>
          `;
        }}
      />
    </div>
  );
}
