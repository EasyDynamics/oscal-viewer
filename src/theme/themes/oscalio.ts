/* ═══════════════════════════════════════════════════════════════════════════
   OSCAL.io Brand Theme
   ═══════════════════════════════════════════════════════════════════════════ */

import type { ThemeDefinition } from "../themeContract";

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

  colors: {
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
    cobalt: "#0098B7",
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
  },
};

export default oscalio;
