/* ═══════════════════════════════════════════════════════════════════════════
   Easy Dynamics Brand Theme
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ThemeDefinition } from "../themeContract";

const easydynamics: ThemeDefinition = {
  id: "easydynamics",

  brand: {
    appName: "OSCAL Viewer",
    heading: "OSCAL Viewer",
    tagline: "Easy Dynamics",
    footerText: "Easy Dynamics — Client-Side Viewer",
    pageTitle: "OSCAL Viewer",
    favicon: "/favicon.svg",
    logoText: "ED",
  },

  colors: {
    /* ── Tier 1: Primary ── */
    navy: "#00215A",
    orange: "#E65300",
    yellow: "#F6A400",
    gray: "#505667",

    /* ── Tier 2: Secondary ── */
    darkNavy: "#06103D",
    brightBlue: "#004EA8",
    paleGray: "#B7C2D0",
    black: "#172026",

    /* ── Tier 3: Accent ── */
    cobalt: "#3158B8",
    mint: "#18A999",
    darkGreen: "#0F766E",
    brightCyan: "#009FD1",
    purple: "#4C1D95",
    blueGray: "#365D78",
    paleOrange: "#F97316",
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
    dropzoneBg: "#E5F0FF",
    errorBg: "#FFE8E8",
    warningBg: "#FFF0C2",
    successBg: "#DDF8E8",
    successFg: "#176B35",
    successBorder: "#9FE7BB",
    dangerBg: "#FFE1E1",
    dangerFg: "#A91D1D",

    /* ── Tint backgrounds ── */
    tintOrange: "#FFE3CC",
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
    shadow: "rgba(0,40,104,0.16)",

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
  },
};

export default easydynamics;
