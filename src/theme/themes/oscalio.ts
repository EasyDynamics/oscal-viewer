/* ═══════════════════════════════════════════════════════════════════════════
   OSCAL.io Brand Theme
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ThemeDefinition, ThemeColors } from "../themeContract";

const lightColors: ThemeColors = {
  /* ── Tier 1: Primary ── */
  navy: "#001B44",
  orange: "#008FB8",       /* cyan replaces orange as primary accent */
  yellow: "#F6A400",
  gray: "#505667",

  /* ── Tier 2: Secondary ── */
  darkNavy: "#000A1F",
  brightBlue: "#009FD1",
  paleGray: "#B7C2D0",
  black: "#172026",

  /* ── Tier 3: Accent ── */
  cobalt: "#0F5BB5",
  mint: "#18A999",
  darkGreen: "#0F766E",
  brightCyan: "#00A7CF",
  purple: "#5B21B6",
  blueGray: "#365D78",
  paleOrange: "#00B9D8",
  neonYellow: "#FACC15",

  /* ── Semantic / UI ── */
  white: "#FFFFFF",
  bg: "#EEF3F8",
  card: "#FFFFFF",
  red: "#C81E1E",

  /* ── Status (Assessment Results) ── */
  statusPassBg: "#DDF8E8",
  statusPassFg: "#176B35",
  statusPassBorder: "#22A55A",
  statusFailBg: "#FFE1E1",
  statusFailFg: "#A91D1D",
  statusFailBorder: "#E03131",
  statusErrorBg: "#FFE8C2",
  statusErrorFg: "#A94700",
  statusErrorBorder: "#F97316",
  statusNaBg: "#EEE2FF",
  statusNaFg: "#5B21B6",
  statusNaBorder: "#8B5CF6",

  /* ── Surface variants ── */
  surfaceSubtle: "#E3EAF3",
  surfaceMuted: "#F6F8FC",
  surfaceOverlay: "rgba(0,0,0,0.35)",

  /* ── Feedback / semantic ── */
  dropzoneBg: "#E5F6FF",
  errorBg: "#FFE8E8",
  warningBg: "#FFF0C2",
  successBg: "#DDF8E8",
  successFg: "#176B35",
  successBorder: "#9FE7BB",
  dangerBg: "#FFE1E1",
  dangerFg: "#A91D1D",

  /* ── Tint backgrounds ── */
  tintOrange: "#DDF6FF",
  tintGreen: "#DDF8E8",
  tintBlue: "#DCEBFF",
  tintPurple: "#EEE2FF",
  tintYellow: "#FFF0C2",

  /* ── Text ── */
  textPrimary: "#172026",
  textSecondary: "#2F3A45",
  textMuted: "#505667",
  textOnAccent: "#FFFFFF",

  /* ── Borders ── */
  border: "#CCD6E3",
  borderSubtle: "#DDE5EF",

  /* ── Misc ── */
  loadedDot: "#22c55e",
  shadow: "rgba(0,17,49,0.16)",

  /* ── Code / markup ── */
  codeBg: "#DFE8F3",
  codeFg: "#102033",
  codeBorder: "#A5B4C7",

  /* ── Severity / risk ── */
  riskLowBg: "#DDF8E8",
  riskLowFg: "#176B35",
  riskModerateBg: "#FFE8C2",
  riskModerateFg: "#A94700",
  riskHighBg: "#FFE1E1",
  riskHighFg: "#A91D1D",
  riskCriticalBg: "#4a0010",
  riskCriticalFg: "#ff1744",
};

const darkColors: ThemeColors = {
  /* ── Tier 1: Primary ── */
  navy: "#A9C7FF",
  orange: "#22D3EE",
  yellow: "#FCD34D",
  gray: "#AEB6C6",

  /* ── Tier 2: Secondary ── */
  darkNavy: "#0D1018",
  brightBlue: "#38BDF8",
  paleGray: "#4B5568",
  black: "#EEF2F8",

  /* ── Tier 3: Accent ── */
  cobalt: "#60A5FA",
  mint: "#34D399",
  darkGreen: "#2DD4BF",
  brightCyan: "#22D3EE",
  purple: "#C084FC",
  blueGray: "#CBD5E1",
  paleOrange: "#67E8F9",
  neonYellow: "#FDE047",

  /* ── Semantic / UI ── */
  white: "#FFFFFF",
  bg: "#0D111A",
  card: "#171B26",
  red: "#F87171",

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
  surfaceSubtle: "#242A38",
  surfaceMuted: "#111622",
  surfaceOverlay: "rgba(0,0,0,0.55)",

  /* ── Feedback / semantic ── */
  dropzoneBg: "#1A2040",
  errorBg: "#3A1A1A",
  warningBg: "#42320D",
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
  textPrimary: "#EEF2F8",
  textSecondary: "#CBD5E1",
  textMuted: "#AEB6C6",
  textOnAccent: "#FFFFFF",

  /* ── Borders ── */
  border: "#394253",
  borderSubtle: "#2A3140",

  /* ── Misc ── */
  loadedDot: "#4ADE80",
  shadow: "rgba(0,0,0,0.52)",

  /* ── Code / markup ── */
  codeBg: "#1E2030",
  codeFg: "#D4D8E8",
  codeBorder: "#3A3F55",

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
