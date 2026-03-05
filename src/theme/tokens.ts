/* ═══════════════════════════════════════════════════════════════════════════
   Design Tokens
   Centralized color palette, typography, and spacing constants.
   Colors resolve to CSS custom properties injected by applyTheme().
   All pages/components import from here to stay on-brand.
   ═══════════════════════════════════════════════════════════════════════════ */

import { buildCssVarColors } from "./applyTheme";
import { brand } from "./themeConfig";

/* ── Colors (CSS variable references) ── */
export const colors = buildCssVarColors();

/**
 * Create a transparent variant of any CSS variable color.
 * Uses `color-mix()` so it works with `var(--color-*)` references.
 * @param cssVar  e.g. `colors.navy`  (which is `"var(--color-navy)"`)
 * @param pct     opacity percentage 0-100 (default 5)
 */
export function alpha(cssVar: string, pct: number = 5): string {
  return `color-mix(in srgb, ${cssVar} ${pct}%, transparent)`;
}

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

/* ── Re-export brand info for convenience ── */
export { brand };
