/* ═══════════════════════════════════════════════════════════════════════════
   Home Page — Dashboard with cards linking to each OSCAL model viewer.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Link } from "react-router-dom";
import { useState, type CSSProperties } from "react";
import { colors, fonts, oscalModels, shadows, radii, brand } from "../theme/tokens";
import { IconShield, IconGrid, IconAlertTriangle, IconGitHub } from "../components/Icons";
import useIsMobile from "../hooks/useIsMobile";

export default function HomePage() {
  const isMobile = useIsMobile();
  const [notesOpen, setNotesOpen] = useState(false);

  return (
    <div>
      {/* Welcome banner */}
      <div style={{ ...styles.banner, ...(isMobile ? { padding: "12px 14px", marginBottom: 16 } : {}) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 2 : 4 }}>
          {brand.favicon ? (
            <img src={brand.favicon} alt="" style={{ height: isMobile ? 22 : 28 }} />
          ) : (
            <IconShield size={isMobile ? 22 : 28} style={{ color: colors.orange }} />
          )}
          <h1 style={{ ...styles.heading, ...(isMobile ? { fontSize: "1.1rem" } : {}) }}>{brand.heading}</h1>
          <a
            href="https://github.com/EasyDynamics/oscal-viewer"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            style={{ display: "inline-flex", marginLeft: 8, color: colors.navy }}
          >
            <IconGitHub size={isMobile ? 20 : 24} />
          </a>
        </div>
        <p style={{ ...styles.subtitle, ...(isMobile ? { fontSize: 13, lineHeight: 1.4, marginBottom: 0 } : {}) }}>
          {isMobile
            ? "View and explore OSCAL documents. Select a model below."
            : "A client-side tool for viewing and exploring OSCAL (Open Security Controls Assessment Language) documents. Select a model below to get started."}
        </p>

        {/* Notes — full on desktop, collapsible on mobile */}
        {isMobile ? (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setNotesOpen((v) => !v)}
              style={styles.notesToggle}
            >
              <IconShield size={12} style={{ color: colors.navy, flexShrink: 0 }} />
              <span>Privacy &amp; Heads&nbsp;up</span>
              <span style={{ marginLeft: "auto", fontSize: 10 }}>{notesOpen ? "▲" : "▼"}</span>
            </button>
            {notesOpen && (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <div style={{ ...styles.noteCard, padding: "8px 10px" }}>
                  <div style={styles.noteHeader}>
                    <IconShield size={14} style={{ color: colors.navy, flexShrink: 0 }} />
                    <span style={styles.noteLabel}>Privacy</span>
                  </div>
                  <p style={{ ...styles.noteText, fontSize: 12 }}>
                    Everything runs in your browser. No server, no database, no cookies. 🍪
                  </p>
                </div>
                <div style={{ ...styles.noteCard, padding: "8px 10px" }}>
                  <div style={styles.noteHeader}>
                    <IconAlertTriangle size={14} style={{ color: colors.yellow, flexShrink: 0 }} />
                    <span style={styles.noteLabel}>Heads up</span>
                  </div>
                  <p style={{ ...styles.noteText, fontSize: 12 }}>
                    Downstream models reference <em>catalogs</em> for control info, not profiles.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.notesRow}>
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
        )}
      </div>

      {/* Model cards grid */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 8 : 16 }}>
        <IconGrid size={16} style={{ color: colors.gray }} />
        <h2 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, color: colors.black, margin: 0 }}>
          OSCAL Models
        </h2>
      </div>

      <div style={{ ...styles.grid, ...(isMobile ? { gridTemplateColumns: "1fr 1fr", gap: 8 } : {}) }}>
        {oscalModels.map((m) => {
          const inner = (
            <div
              style={{
                ...(isMobile ? styles.cardMobile : styles.card),
                borderTop: `${isMobile ? 3 : 4}px solid ${m.disabled ? colors.gray : m.color}`,
                ...(m.disabled ? { opacity: 0.45, cursor: "default", filter: "grayscale(50%)" } : {}),
              }}
            >
              {!isMobile && (
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
              )}
              <h3 style={{
                ...(isMobile ? styles.cardTitleMobile : styles.cardTitle),
                color: m.disabled ? colors.gray : m.color,
              }}>{m.label}</h3>
              {!isMobile && <p style={styles.cardDesc}>{m.description}</p>}
              {m.disabled
                ? <span style={{ fontSize: isMobile ? 10 : 12, fontWeight: 500, color: colors.gray, fontStyle: "italic" }}>Coming soon</span>
                : <span style={{ ...(isMobile ? styles.cardLinkMobile : styles.cardLink) }}>Open →</span>}
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

  /* Mobile-specific */
  notesToggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: fonts.sans,
    color: colors.navy,
    backgroundColor: colors.bg,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  } as CSSProperties,
  cardMobile: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: "10px 10px",
    boxShadow: shadows.sm,
    cursor: "pointer",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "flex-start",
  } as CSSProperties,
  cardTitleMobile: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: fonts.sans,
    margin: "0 0 4px",
    lineHeight: 1.2,
  } as CSSProperties,
  cardLinkMobile: {
    fontSize: 11,
    fontWeight: 500,
    color: colors.orange,
  } as CSSProperties,
};
