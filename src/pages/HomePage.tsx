/* ═══════════════════════════════════════════════════════════════════════════
   Home Page — Dashboard with cards linking to each OSCAL model viewer.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { colors, fonts, oscalModels, shadows, radii } from "../theme/tokens";
import { IconShield, IconGrid } from "../components/Icons";

export default function HomePage() {
  return (
    <div>
      {/* Welcome banner */}
      <div style={styles.banner}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <IconShield size={28} style={{ color: colors.orange }} />
          <h1 style={styles.heading}>Edge OSCAL Viewer</h1>
        </div>
        <p style={styles.subtitle}>
          A client-side tool for viewing and exploring OSCAL (Open Security
          Controls Assessment Language) documents. Select a model below to get
          started.
        </p>
      </div>

      {/* Model cards grid */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <IconGrid size={16} style={{ color: colors.gray }} />
        <h2 style={{ fontSize: 16, fontWeight: 600, color: colors.black }}>
          OSCAL Models
        </h2>
      </div>

      <div style={styles.grid}>
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
    backgroundColor: colors.white,
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
    maxWidth: 720,
    marginTop: 4,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    backgroundColor: colors.white,
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
