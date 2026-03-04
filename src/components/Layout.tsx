/* ═══════════════════════════════════════════════════════════════════════════
   Layout — persistent shell with EZD-branded top bar and tab navigation.
   Wraps every page via <Outlet />.
   ═══════════════════════════════════════════════════════════════════════════ */

import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { CSSProperties } from "react";
import { colors, fonts, oscalModels, shadows } from "../theme/tokens";
import { IconShield } from "./Icons";
import { useOscal } from "../context/OscalContext";

export default function Layout() {
  const location = useLocation();
  const { isLoaded } = useOscal();

  return (
    <div style={styles.shell}>
      {/* ── Top Bar ── */}
      <header style={styles.header}>
        <NavLink to="/" style={styles.brand}>
          <IconShield size={22} style={{ color: colors.orange, marginRight: 8 }} />
          <span style={styles.brandText}>Edge OSCAL</span>
        </NavLink>

        <span style={styles.tagline}>Easy Dynamics</span>
      </header>

      {/* ── Tab Navigation ── */}
      <nav style={styles.tabBar}>
        <NavLink to="/" end style={() => tabStyle(location.pathname === "/")}>
          Home
        </NavLink>
        {oscalModels.map((m) => {
          const loaded = isLoaded(m.key);
          if (m.disabled) {
            return (
              <span
                key={m.key}
                style={{
                  ...tabStyle(false),
                  opacity: 0.4,
                  cursor: "default",
                  pointerEvents: "none",
                }}
                title="Coming soon"
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: m.color,
                    display: "inline-block",
                    marginRight: 6,
                    flexShrink: 0,
                    filter: "grayscale(60%)",
                  }}
                />
                {m.label}
              </span>
            );
          }
          return (
            <NavLink
              key={m.key}
              to={m.path}
              style={() =>
                tabStyle(location.pathname.startsWith(m.path))
              }
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: m.color,
                  display: "inline-block",
                  marginRight: 6,
                  flexShrink: 0,
                }}
              />
              {m.label}
              {loaded && (
                <span
                  title={`${m.label} file loaded`}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    display: "inline-block",
                    marginLeft: 6,
                    flexShrink: 0,
                    boxShadow: "0 0 4px #22c55e88",
                  }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Page Content ── */}
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

/* ── Style helpers ── */

function tabStyle(isActive: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: isActive ? 600 : 400,
    fontFamily: fonts.sans,
    color: isActive ? colors.navy : colors.black,
    textDecoration: "none",
    borderBottom: isActive
      ? `3px solid ${colors.orange}`
      : "3px solid transparent",
    transition: "color .15s, border-color .15s",
    whiteSpace: "nowrap",
  };
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    backgroundColor: colors.bg,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    height: 56,
    backgroundColor: colors.navy,
    color: colors.white,
    boxShadow: shadows.md,
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
    color: colors.white,
  },
  brandText: {
    fontSize: 18,
    fontWeight: 700,
    fontFamily: fonts.sans,
    letterSpacing: 0.5,
    color: colors.white,
  },
  tagline: {
    fontSize: 12,
    fontWeight: 300,
    color: colors.paleGray,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  tabBar: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    backgroundColor: colors.white,
    borderBottom: `1px solid ${colors.paleGray}`,
    paddingLeft: 24,
    overflowX: "auto",
    boxShadow: shadows.sm,
    position: "sticky",
    top: 56,
    zIndex: 99,
  },
  main: {
    flex: 1,
    padding: 24,
    maxWidth: 1400,
    width: "100%",
    margin: "0 auto",
  },
};
