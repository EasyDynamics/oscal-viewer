/* ═══════════════════════════════════════════════════════════════════════════
   Theme Config — resolves the active theme from VITE_THEME env var.
   Import this file to get the current ThemeDefinition at build time.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ThemeDefinition } from "./themeContract";
import easydynamics from "./themes/easydynamics";
import oscalio from "./themes/oscalio";

const themes: Record<string, ThemeDefinition> = {
  easydynamics,
  oscalio,
};

const themeName = import.meta.env.VITE_THEME ?? "oscalio";

export const theme: ThemeDefinition = themes[themeName] ?? oscalio;

/** Convenience re-exports */
export const brand = theme.brand;
export const themeColors = theme.colors;
export const themeDarkColors = theme.darkColors;
