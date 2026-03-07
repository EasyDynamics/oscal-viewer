/* ═══════════════════════════════════════════════════════════════════════════
   Home Page — Dashboard with cards linking to each OSCAL model viewer.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { colors, fonts, oscalModels, shadows, radii, brand } from "../theme/tokens";
import { IconShield, IconGrid, IconAlertTriangle, IconGitHub } from "../components/Icons";
import useIsMobile from "../hooks/useIsMobile";

export default function HomePage() {
  const isMobile = useIsMobile();
  return (
    <div>
      {/* Welcome banner */}
      <div style={{ ...styles.banner, ...(isMobile ? { padding: "16px 14px" } : {}) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {brand.favicon ? (
            <img src={brand.favicon} alt="" style={{ height: 28 }} />
          ) : (
            <IconShield size={28} style={{ color: colors.orange }} />
          )}
          <h1 style={{ ...styles.heading, ...(isMobile ? { fontSize: "1.3rem" } : {}) }}>{brand.heading}</h1>
          <a
            href="https://github.com/EasyDynamics/oscal-viewer"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            style={{ display: "inline-flex", marginLeft: 8, color: colors.navy }}
          >
            <IconGitHub size={24} />
          </a>
        </div>
        <p style={styles.subtitle}>A client-side tool for viewing and exploring OSCAL (Open Security Controls Assessment Language) documents. Select a model below to get started.</p>

        {/* Inline notes row */}
        <div style={{ ...styles.notesRow, ...(isMobile ? { gridTemplateColumns: "1fr", gap: 10 } : {}) }}>
          <div style={styles.noteCard}>
            <div style={styles.noteHeader}>
              <IconShield size={16} style={{ color: colors.navy, flexShrink: 0 }} />
              <span style={styles.noteLabel}>Privacy</span>
            </div>
            <p style={styles.noteText}>
              This tool is self-contained in your browser. Your OSCAL data never leaves your machine.
              There is no server. There is no database. There is no cloud.
              There is only your browser tab, doing all the work, asking for nothing in return.
              Not even a cookie. 🍪
            </p>
          </div>
          <div style={styles.noteCard}>
            <div style={styles.noteHeader}>
              <IconAlertTriangle size={16} style={{ color: colors.yellow, flexShrink: 0 }} />
              <span style={styles.noteLabel}>Heads up</span>
            </div>
            <p style={styles.noteText}>
              Profile support is available for viewing profile documents, but all
              downstream models (SSP, Component Definition, etc.) reference <em>catalogs</em> for
              control information — not profiles.
            </p>
          </div>
        </div>
      </div>

      {/* Model cards grid */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <IconGrid size={16} style={{ color: colors.gray }} />
        <h2 style={{ fontSize: 16, fontWeight: 600, color: colors.black }}>
          OSCAL Models
        </h2>
      </div>

      <div style={{ ...styles.grid, ...(isMobile ? { gridTemplateColumns: "1fr", gap: 12 } : {}) }}>
        {oscalModels.map((m) => {
          const inner = (
            <div
              style={{
                ...styles.card,
                borderTop: `4px solid ${m.disabled ? colors.gray : m.color}`,
                ...(m.disabled ? { opacity: 0.45, cursor: "default", filter: "grayscale(50%)" } : {}),
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: m.disabled ? colors.gray : m.color,
                  marginBottom: 8,
                }}
              />
              <h3 style={{ ...styles.cardTitle, color: m.disabled ? colors.gray : m.color }}>{m.label}</h3>
              <p style={styles.cardDesc}>{m.description}</p>
              {m.disabled
                ? <span style={{ fontSize: 12, fontWeight: 500, color: colors.gray, fontStyle: "italic" }}>Coming soon</span>
                : <span style={styles.cardLink}>Open viewer →</span>}
            </div>
          );
          return m.disabled ? (
            <div key={m.key} style={{ textDecoration: "none" }}>{inner}</div>
          ) : (
            <Link key={m.key} to={m.path} style={{ textDecoration: "none" }}>{inner}</Link>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  banner: {
    backgroundColor: colors.card,
    borderLeft: `5px solid ${colors.orange}`,
    borderRadius: radii.md,
    padding: "28px 32px",
    marginBottom: 32,
    boxShadow: shadows.sm,
  },
  heading: {
    fontSize: "1.8rem",
    fontFamily: fonts.sans,
    fontWeight: 700,
    color: colors.navy,
    margin: 0,
  },
  subtitle: {
    fontSize: 15,
    color: colors.black,
    lineHeight: 1.7,
    marginTop: 4,
    marginBottom: 0,
  },
  notesRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginTop: 20,
  },
  noteCard: {
    backgroundColor: colors.bg,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.sm,
    padding: "12px 14px",
  },
  noteHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: colors.navy,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 1.6,
    color: colors.black,
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: "20px 24px",
    boxShadow: shadows.sm,
    transition: "box-shadow .2s, transform .15s",
    cursor: "pointer",
    height: "100%",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: fonts.sans,
    margin: 0,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.black,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  cardLink: {
    fontSize: 13,
    fontWeight: 500,
    color: colors.orange,
  },
};
