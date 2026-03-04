/* ═══════════════════════════════════════════════════════════════════════════
   Easy Dynamics Brand — Design Tokens
   Centralized color palette, typography, and spacing constants.
   All pages/components import from here to stay on-brand.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Tier 1: Primary Colors ── */
export const colors = {
  navy: "#002868",
  orange: "#FF6600",
  yellow: "#FEB300",
  gray: "#9B9DAA",

  /* ── Tier 2: Secondary Colors ── */
  darkNavy: "#0A1352",
  brightBlue: "#02317F",
  paleGray: "#CFCED3",
  black: "#1C2327",

  /* ── Tier 3: Accent Colors ── */
  cobalt: "#4166C5",
  mint: "#48CDB6",
  darkGreen: "#216570",
  brightCyan: "#00B0F0",
  purple: "#3A00A1",
  blueGray: "#6D8CA4",
  paleOrange: "#FF8E0F",
  neonYellow: "#FFF33E",

  /* ── Semantic / UI Colors ── */
  white: "#FFFFFF",
  bg: "#F4F5F7",
  card: "#FFFFFF",
  red: "#D32F2F",
} as const;

/* ── Typography ── */
export const fonts = {
  sans: "'Roboto', 'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "'Roboto Mono', 'Consolas', 'Courier New', monospace",
} as const;

/* ── Spacing scale (px) ── */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/* ── Border radii ── */
export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 9999,
} as const;

/* ── Shadows ── */
export const shadows = {
  sm: "0 1px 3px rgba(0,0,0,.08)",
  md: "0 2px 8px rgba(0,0,0,.10)",
  lg: "0 4px 16px rgba(0,0,0,.12)",
} as const;

/* ── OSCAL model metadata ── */
export interface OscalModel {
  key: string;
  label: string;
  path: string;
  description: string;
  color: string;
  disabled?: boolean;
}

export const oscalModels: OscalModel[] = [
  {
    key: "catalog",
    label: "Catalog",
    path: "/catalog",
    description: "A collection of security and privacy controls.",
    color: colors.navy,
  },
  {
    key: "profile",
    label: "Profile",
    path: "/profile",
    description: "A selection and tailoring of controls from one or more catalogs.",
    color: colors.brightBlue,
    disabled: true,
  },
  {
    key: "component-definition",
    label: "Component Definition",
    path: "/component-definition",
    description: "Defines capabilities and control implementations for components.",
    color: colors.cobalt,
  },
  {
    key: "ssp",
    label: "SSP",
    path: "/ssp",
    description: "System Security Plan — documents the security controls for a system.",
    color: colors.darkGreen,
  },
  {
    key: "assessment-plan",
    label: "Assessment Plan",
    path: "/assessment-plan",
    description: "Describes the plan for assessing a system's security controls.",
    color: colors.purple,
  },
  {
    key: "assessment-results",
    label: "Assessment Results",
    path: "/assessment-results",
    description: "Captures the results of a security control assessment.",
    color: colors.orange,
  },
  {
    key: "poam",
    label: "POA&M",
    path: "/poam",
    description: "Plan of Action and Milestones — tracks remediation of findings.",
    color: colors.red,
  },
];
