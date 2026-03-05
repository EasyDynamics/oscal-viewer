/* ═══════════════════════════════════════════════════════════════════════════
   Theme Contract — shared type that every theme definition must satisfy.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ThemeBrand {
  appName: string;
  heading: string;
  tagline: string;
  footerText: string;
  pageTitle: string;
  favicon: string;
  logoText: string;
  /** Optional URL to an image logo (relative to public/) */
  logoUrl?: string;
}

export interface ThemeColors {
  /* Tier 1 */
  navy: string;
  orange: string;
  yellow: string;
  gray: string;

  /* Tier 2 */
  darkNavy: string;
  brightBlue: string;
  paleGray: string;
  black: string;

  /* Tier 3 */
  cobalt: string;
  mint: string;
  darkGreen: string;
  brightCyan: string;
  purple: string;
  blueGray: string;
  paleOrange: string;
  neonYellow: string;

  /* Semantic / UI */
  white: string;
  bg: string;
  card: string;
  red: string;

  /* Status */
  statusPassBg: string;
  statusPassFg: string;
  statusPassBorder: string;
  statusFailBg: string;
  statusFailFg: string;
  statusFailBorder: string;
  statusErrorBg: string;
  statusErrorFg: string;
  statusErrorBorder: string;
  statusNaBg: string;
  statusNaFg: string;
  statusNaBorder: string;
}

export interface ThemeDefinition {
  id: string;
  brand: ThemeBrand;
  colors: ThemeColors;
}

/** All color token keys — useful for iteration */
export type ColorKey = keyof ThemeColors;
