/* ═══════════════════════════════════════════════════════════════════════════
   LinkChips — Compact, unified link rendering for OSCAL link assemblies.
   Renders an inline-wrap row of small chips with a colored left-border
   that encodes the `rel` type (mitre, reference, related, required, etc.).
   ═══════════════════════════════════════════════════════════════════════════ */

import type { CSSProperties, ReactNode } from "react";
import { colors, fonts } from "../theme/tokens";

/* ── Category color map ── */

/** Create a near-transparent background from a CSS variable color */
function alphaBg(cssVar: string): string {
  return `color-mix(in srgb, ${cssVar} 5%, transparent)`;
}

const LINK_CATEGORIES: Record<
  string,
  { label: string; border: string; fg: string; bg: string; mono?: boolean }
> = {
  mitre: {
    label: "MITRE ATT&CK",
    border: colors.darkNavy,
    fg: colors.darkNavy,
    bg: alphaBg(colors.darkNavy),
    mono: true,
  },
  reference: {
    label: "Reference",
    border: colors.cobalt,
    fg: colors.cobalt,
    bg: alphaBg(colors.cobalt),
  },
  related: {
    label: "Related",
    border: colors.darkGreen,
    fg: colors.darkGreen,
    bg: alphaBg(colors.darkGreen),
  },
  required: {
    label: "Required",
    border: colors.orange,
    fg: colors.orange,
    bg: alphaBg(colors.orange),
  },
  _default: {
    label: "Link",
    border: colors.blueGray,
    fg: colors.blueGray,
    bg: alphaBg(colors.blueGray),
  },
};

function relCategory(rel?: string, href?: string): string {
  if (rel === "mitre" || (href && href.includes("attack.mitre.org"))) return "mitre";
  if (rel === "reference") return "reference";
  if (rel === "related") return "related";
  if (rel === "required") return "required";
  if (rel) return rel;          // unknown rel — falls through to _default lookup
  return "_default";
}

/* ── Public props ── */

export interface ResolvedLink {
  /** Display text for the chip */
  text: string;
  /** URL to open (if any) */
  href?: string;
  /** The OSCAL `rel` value (e.g. "reference", "mitre", "related") */
  rel?: string;
  /** onClick handler for internal nav (when no external href) */
  onClick?: () => void;
}

interface LinkChipsProps {
  links: ResolvedLink[];
  /** Optional section label — defaults to "Links (<count>)" */
  label?: ReactNode;
  /** Extra wrapper style */
  style?: CSSProperties;
}

/* ── SVG icon (inline so the component has zero deps beyond tokens) ── */

function IcoLinkSmall() {
  return (
    <svg
      width={10}
      height={10}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

/* ── Component ── */

export default function LinkChips({ links, label, style }: LinkChipsProps) {
  if (links.length === 0) return null;

  return (
    <div style={style}>
      {label !== undefined ? (
        typeof label === "string" ? (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: colors.gray,
              marginBottom: 6,
            }}
          >
            {label}
          </div>
        ) : (
          label
        )
      ) : (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: colors.gray,
            marginBottom: 6,
          }}
        >
          Links ({links.length})
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {links.map((lk, i) => {
          const cat = relCategory(lk.rel, lk.href);
          const s = LINK_CATEGORIES[cat] ?? LINK_CATEGORIES._default;

          const chipStyle: CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: s.mono ? fonts.mono : fonts.sans,
            padding: "2px 8px",
            borderRadius: 3,
            borderLeft: `3px solid ${s.border}`,
            backgroundColor: s.bg,
            color: s.fg,
            textDecoration: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "filter 0.1s",
          };

          if (lk.href) {
            return (
              <a
                key={i}
                href={lk.href}
                target="_blank"
                rel="noopener noreferrer"
                style={chipStyle}
                title={lk.rel ? `${lk.rel}: ${lk.text}` : lk.text}
              >
                <IcoLinkSmall />
                {lk.text}
              </a>
            );
          }
          return (
            <span
              key={i}
              onClick={lk.onClick}
              style={chipStyle}
              title={lk.rel ? `${lk.rel}: ${lk.text}` : lk.text}
            >
              <IcoLinkSmall />
              {lk.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
