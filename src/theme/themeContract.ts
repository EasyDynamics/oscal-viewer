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

  /* ── Surface variants ── */
  surfaceSubtle: string;       /* light chip/tag backgrounds (#EEF2F8) */
  surfaceMuted: string;        /* slightly off-white sections (#F8F9FB) */
  surfaceOverlay: string;      /* backdrop overlay */

  /* ── Feedback / semantic ── */
  dropzoneBg: string;          /* drag-over highlight */
  errorBg: string;             /* error container */
  warningBg: string;           /* warning container */
  successBg: string;           /* success/added container */
  successFg: string;           /* success/added text */
  successBorder: string;       /* success border */
  dangerBg: string;            /* danger/removed container */
  dangerFg: string;            /* danger/removed text */

  /* ── Tint backgrounds ── */
  tintOrange: string;          /* light orange tint */
  tintGreen: string;           /* light green tint */
  tintBlue: string;            /* light blue tint */
  tintPurple: string;          /* light purple tint */
  tintYellow: string;          /* light yellow tint */

  /* ── Text ── */
  textPrimary: string;         /* main body text */
  textSecondary: string;       /* diminished text */
  textMuted: string;           /* subtle/placeholder text */
  textOnAccent: string;        /* white-on-colored-bg */

  /* ── Borders ── */
  border: string;              /* standard border */
  borderSubtle: string;        /* lighter border */

  /* ── Misc ── */
  loadedDot: string;           /* loaded indicator ring */
  shadow: string;              /* base shadow color */

  /* ── Code / markup ── */
  codeBg: string;              /* code snippet background */
  codeFg: string;              /* code snippet text */
  codeBorder: string;          /* code snippet border */

  /* ── Severity / risk ── */
  riskLowBg: string;
  riskLowFg: string;
  riskModerateBg: string;
  riskModerateFg: string;
  riskHighBg: string;
  riskHighFg: string;
  riskCriticalBg: string;
  riskCriticalFg: string;
}

export type ColorMode = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";

export interface ThemeDefinition {
  id: string;
  brand: ThemeBrand;
  colors: ThemeColors;
  /** Dark-mode color overrides. If omitted, dark mode uses `colors`. */
  darkColors?: ThemeColors;
}

/** All color token keys — useful for iteration */
export type ColorKey = keyof ThemeColors;
