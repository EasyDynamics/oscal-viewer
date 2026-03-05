/* ═══════════════════════════════════════════════════════════════════════════
   Easy Dynamics Brand Theme
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ThemeDefinition } from "../themeContract";

const easydynamics: ThemeDefinition = {
  id: "easydynamics",

  brand: {
    appName: "Edge OSCAL",
    heading: "Edge OSCAL Viewer",
    tagline: "Easy Dynamics",
    footerText: "Easy Dynamics — Client-Side Viewer",
    pageTitle: "Edge OSCAL",
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
  },
};

export default easydynamics;
