/* ═══════════════════════════════════════════════════════════════════════════
   Apply Theme — injects CSS custom properties onto :root from the active
   theme definition.  Supports light/dark mode switching at runtime.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ThemeColors, ColorKey, ResolvedMode } from "./themeContract";
import { theme } from "./themeConfig";

/**
 * Convert camelCase token key to a CSS variable name.
 *   e.g.  "darkNavy"  →  "--color-dark-navy"
 *         "bg"        →  "--color-bg"
 */
function toVarName(key: string): string {
  return "--color-" + key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/** Set all `--color-*` custom properties on `<html>` for the given mode. */
export function applyTheme(mode: ResolvedMode = "light"): void {
  const root = document.documentElement;
  const colors =
    mode === "dark" && theme.darkColors ? theme.darkColors : theme.colors;

  for (const key of Object.keys(colors) as ColorKey[]) {
    root.style.setProperty(toVarName(key), colors[key]);
  }

  /* Tell the browser which color scheme is active (affects native elements) */
  root.style.setProperty("color-scheme", mode);
  root.setAttribute("data-theme", mode);

  /* Also set the favicon dynamically */
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);
  }
  link.href = theme.brand.favicon;

  /* Set the document title */
  document.title = theme.brand.pageTitle;
}

/**
 * Build a map of `{ tokenKey: "var(--color-token-key)" }` so existing
 * inline-style patterns continue to work unchanged.
 */
export function buildCssVarColors(): Record<keyof ThemeColors, string> {
  const result = {} as Record<keyof ThemeColors, string>;
  const keys = Object.keys(theme.colors) as ColorKey[];
  for (const key of keys) {
    result[key] = `var(${toVarName(key)})`;
  }
  return result;
}
