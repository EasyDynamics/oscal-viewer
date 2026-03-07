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
    navy: "#002868",
    orange: "#FF6600",
    yellow: "#FEB300",
    gray: "#9B9DAA",

    /* ── Tier 2: Secondary ── */
    darkNavy: "#0A1352",
    brightBlue: "#02317F",
    paleGray: "#CFCED3",
    black: "#1C2327",

    /* ── Tier 3: Accent ── */
    cobalt: "#4166C5",
    mint: "#48CDB6",
    darkGreen: "#216570",
    brightCyan: "#00B0F0",
    purple: "#3A00A1",
    blueGray: "#6D8CA4",
    paleOrange: "#FF8E0F",
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
  },
};

export default easydynamics;
