/* ═══════════════════════════════════════════════════════════════════════════
   OSCAL.io Brand Theme
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ThemeDefinition, ThemeColors } from "../themeContract";

const lightColors: ThemeColors = {
  /* ── Tier 1: Primary ── */
  navy: "#001131",
  orange: "#00BDE3",       /* cyan replaces orange as primary accent */
  yellow: "#FEB300",
  gray: "#9B9DAA",

  /* ── Tier 2: Secondary ── */
  darkNavy: "#000B20",
  brightBlue: "#00BDE3",
  paleGray: "#CFCED3",
  black: "#1C2327",

  /* ── Tier 3: Accent ── */
  cobalt: "#1565C0",
  mint: "#48CDB6",
  darkGreen: "#216570",
  brightCyan: "#00BDE3",
  purple: "#451298",
  blueGray: "#6D8CA4",
  paleOrange: "#33CFEF",
  neonYellow: "#FFF33E",

  /* ── Semantic / UI ── */
  white: "#FFFFFF",
  bg: "#F4F5F7",
  card: "#FFFFFF",
  red: "#D32F2F",

  /* ── Status (Assessment Results) ── */
  statusPassBg: "#e8f5e9",
  statusPassFg: "#2e7d32",
  statusPassBorder: "#4caf50",
  statusFailBg: "#ffebee",
  statusFailFg: "#c62828",
  statusFailBorder: "#ef5350",
  statusErrorBg: "#fff3e0",
  statusErrorFg: "#e65100",
  statusErrorBorder: "#ff9800",
  statusNaBg: "#f3e5f5",
  statusNaFg: "#6a1b9a",
  statusNaBorder: "#ab47bc",

  /* ── Surface variants ── */
  surfaceSubtle: "#EEF2F8",
  surfaceMuted: "#F8F9FB",
  surfaceOverlay: "rgba(0,0,0,0.35)",

  /* ── Feedback / semantic ── */
  dropzoneBg: "#f0f4ff",
  errorBg: "#fff5f5",
  warningBg: "#FFF8E1",
  successBg: "#e8f5e9",
  successFg: "#2e7d32",
  successBorder: "#c8e6c9",
  dangerBg: "#ffebee",
  dangerFg: "#c62828",

  /* ── Tint backgrounds ── */
  tintOrange: "#FFF0E6",
  tintGreen: "#E6F3F0",
  tintBlue: "#E8F0FE",
  tintPurple: "#F0E8FE",
  tintYellow: "#FFF8E6",

  /* ── Text ── */
  textPrimary: "#1C2327",
  textSecondary: "#555555",
  textMuted: "#9B9DAA",
  textOnAccent: "#FFFFFF",

  /* ── Borders ── */
  border: "#E2E4EA",
  borderSubtle: "#EEEEF2",

  /* ── Misc ── */
  loadedDot: "#22c55e",
  shadow: "rgba(0,0,0,0.12)",

  /* ── Severity / risk ── */
  riskLowBg: "#e8f5e9",
  riskLowFg: "#2e7d32",
  riskModerateBg: "#fff3e0",
  riskModerateFg: "#e65100",
  riskHighBg: "#ffebee",
  riskHighFg: "#c62828",
  riskCriticalBg: "#4a0010",
  riskCriticalFg: "#ff1744",
};

const darkColors: ThemeColors = {
  /* ── Tier 1: Primary ── */
  navy: "#8BB8FF",
  orange: "#4DD4EC",
  yellow: "#FFD54F",
  gray: "#8A8C98",

  /* ── Tier 2: Secondary ── */
  darkNavy: "#0D1018",
  brightBlue: "#4DD4EC",
  paleGray: "#383B48",
  black: "#E0E0E6",

  /* ── Tier 3: Accent ── */
  cobalt: "#64B5F6",
  mint: "#5EDBC7",
  darkGreen: "#4DB6AC",
  brightCyan: "#4DD4EC",
  purple: "#B388FF",
  blueGray: "#90A4AE",
  paleOrange: "#4DD4EC",
  neonYellow: "#FFF176",

  /* ── Semantic / UI ── */
  white: "#FFFFFF",
  bg: "#121218",
  card: "#1A1A24",
  red: "#EF5350",

  /* ── Status (Assessment Results) ── */
  statusPassBg: "#1B3A25",
  statusPassFg: "#66BB6A",
  statusPassBorder: "#388E3C",
  statusFailBg: "#3A1A1A",
  statusFailFg: "#EF9A9A",
  statusFailBorder: "#EF5350",
  statusErrorBg: "#3A2A10",
  statusErrorFg: "#FFB74D",
  statusErrorBorder: "#FF9800",
  statusNaBg: "#2A1A3A",
  statusNaFg: "#CE93D8",
  statusNaBorder: "#AB47BC",

  /* ── Surface variants ── */
  surfaceSubtle: "#1E2130",
  surfaceMuted: "#16161E",
  surfaceOverlay: "rgba(0,0,0,0.55)",

  /* ── Feedback / semantic ── */
  dropzoneBg: "#1A2040",
  errorBg: "#3A1A1A",
  warningBg: "#3A3018",
  successBg: "#1B3A25",
  successFg: "#66BB6A",
  successBorder: "#2E7D32",
  dangerBg: "#3A1A1A",
  dangerFg: "#EF9A9A",

  /* ── Tint backgrounds ── */
  tintOrange: "#2E2218",
  tintGreen: "#1E3A30",
  tintBlue: "#1A2238",
  tintPurple: "#261A38",
  tintYellow: "#2E2A18",

  /* ── Text ── */
  textPrimary: "#E0E0E6",
  textSecondary: "#A0A0AA",
  textMuted: "#8A8C98",
  textOnAccent: "#FFFFFF",

  /* ── Borders ── */
  border: "#2E3040",
  borderSubtle: "#252830",

  /* ── Misc ── */
  loadedDot: "#4ADE80",
  shadow: "rgba(0,0,0,0.40)",

  /* ── Severity / risk ── */
  riskLowBg: "#1B3A25",
  riskLowFg: "#66BB6A",
  riskModerateBg: "#3A2A10",
  riskModerateFg: "#FFB74D",
  riskHighBg: "#3A1A1A",
  riskHighFg: "#EF9A9A",
  riskCriticalBg: "#5A0018",
  riskCriticalFg: "#FF5252",
};

const oscalio: ThemeDefinition = {
  id: "oscalio",

  brand: {
    appName: "OSCAL Viewer",
    heading: "OSCAL Viewer",
    tagline: "OSCAL.io",
    footerText: "OSCAL.io — OSCAL Viewer",
    pageTitle: "OSCAL Viewer",
    favicon: "/favicon-oscalio.svg",
    logoText: "O",
    logoUrl: "/oscalio-logo.svg",
  },

  colors: lightColors,
  darkColors,
};

export default oscalio;
