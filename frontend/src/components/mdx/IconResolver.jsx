import React, { useMemo } from "react";
import * as LucideIcons from "lucide-react";

/**
 * Dynamically resolves an icon name (e.g., "activity", "check-circle") to a Lucide React component.
 * Provides a gentle fallback instead of breaking the app if an icon isn't found.
 */
export function IconResolver({ name, color = "var(--primary-brand, #3b82f6)", size = 20, className = "" }) {
  const IconComponent = useMemo(() => {
    if (!name) return null;

    // Convert snake_case or kebab-case string from Mintlify string format to PascalCase exact Lucide name
    // e.g., "check-circle" -> "CheckCircle", "flag" -> "Flag"
    const pascalName = name
      .split(/-|_/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("");

    const Comp = LucideIcons[pascalName];

    // Fallback if the requested icon isn't found
    return Comp ? Comp : LucideIcons.HelpCircle;
  }, [name]);

  if (!IconComponent) return null;

  return <IconComponent color={color} size={size} className={className} />;
}
