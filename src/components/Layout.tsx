/* ═══════════════════════════════════════════════════════════════════════════
   Layout — persistent shell with EZD-branded top bar and tab navigation.
   Wraps every page via <Outlet />.
   Mobile: hamburger menu replaces horizontal tab bar.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { CSSProperties } from "react";
import { colors, fonts, oscalModels, shadows, brand, alpha } from "../theme/tokens";
import { useOscal } from "../context/OscalContext";
import { useTheme } from "../context/ThemeContext";
import { IconSun, IconMoon } from "./Icons";
import useIsMobile from "../hooks/useIsMobile";

export default function Layout() {
  const location = useLocation();
  const { isLoaded } = useOscal();
  const { resolvedMode, toggleMode } = useTheme();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close the menu when the route changes */
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  /* Close the menu when tapping outside */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [menuOpen]);

  return (
    <div style={styles.shell}>
      {/* ── Top Bar ── */}
      <header style={{ ...styles.header, padding: isMobile ? "0 12px" : "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isMobile && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              style={styles.hamburger}
            >
              {menuOpen ? "\u2715" : "\u2630"}
            </button>
          )}
          <NavLink to="/" style={styles.brand}>
            {brand.favicon && (
              <img src={brand.favicon} alt="" style={{ height: 22, marginRight: 10 }} />
            )}
            <span style={styles.brandText}>{brand.appName}</span>
          </NavLink>
        </div>

        {!isMobile && (
          brand.logoUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={toggleMode}
                aria-label={resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={styles.themeToggle}
              >
                {resolvedMode === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </button>
              <a href="https://oscal.io/" target="_blank" rel="noopener noreferrer">
                <img src={brand.logoUrl} alt={brand.tagline} style={{ height: 20 }} />
              </a>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={toggleMode}
                aria-label={resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={styles.themeToggle}
              >
                {resolvedMode === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
              </button>
              <span style={styles.tagline}>{brand.tagline}</span>
            </div>
          )
        )}
        {isMobile && (
          <button
            onClick={toggleMode}
            aria-label={resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={styles.themeToggle}
          >
            {resolvedMode === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
        )}
      </header>

      {/* ── Desktop Tab Navigation ── */}
      {!isMobile && (
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
                  <StatusDot color={colors.gray} loaded={false} />
                  {m.label}
                </span>
              );
            }
            return (
              <NavLink
                key={m.key}
                to={m.path}
                style={() => tabStyle(location.pathname.startsWith(m.path))}
              >
                <StatusDot color={loaded ? m.color : colors.gray} loaded={loaded} />
                {m.label}
              </NavLink>
            );
          })}

          <NavLink
            to="/examples"
            style={() => ({
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 16px",
              fontSize: 12,
              fontWeight: location.pathname === "/examples" ? 600 : 400,
              fontFamily: fonts.sans,
              color: location.pathname === "/examples" ? colors.navy : colors.gray,
              textDecoration: "none",
              borderBottom: location.pathname === "/examples"
                ? `3px solid ${colors.navy}`
                : "3px solid transparent",
              whiteSpace: "nowrap" as const,
              transition: "color .15s, border-color .15s",
            })}
          >
            JSON Examples
          </NavLink>
        </nav>
      )}

      {/* ── Mobile Menu Overlay ── */}
      {isMobile && menuOpen && (
        <>
          <div style={styles.menuBackdrop} />
          <div ref={menuRef} style={styles.mobileMenu}>
            <MobileMenuItem to="/" label="Home" isActive={location.pathname === "/"} onTap={() => setMenuOpen(false)} />
            {oscalModels.map((m) => {
              if (m.disabled) return null;
              const loaded = isLoaded(m.key);
              return (
                <MobileMenuItem
                  key={m.key}
                  to={m.path}
                  label={m.label}
                  isActive={location.pathname.startsWith(m.path)}
                  dot={{ color: loaded ? m.color : colors.gray, loaded }}
                  onTap={() => setMenuOpen(false)}
                />
              );
            })}
            <MobileMenuItem to="/examples" label="JSON Examples" isActive={location.pathname === "/examples"} onTap={() => setMenuOpen(false)} />
          </div>
        </>
      )}

      {/* ── Page Content ── */}
      <main style={{ ...styles.main, padding: isMobile ? 8 : 24 }}>
        <Outlet />
      </main>
    </div>
  );
}

/* ── Small presentational helpers ── */

function StatusDot({ color, loaded }: { color: string; loaded: boolean }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        display: "inline-block",
        marginRight: 6,
        flexShrink: 0,
        boxSizing: "content-box" as const,
        border: loaded ? `2px solid ${colors.loadedDot}` : "2px solid transparent",
        boxShadow: loaded ? `0 0 4px ${alpha(colors.loadedDot, 55)}` : "none",
      }}
    />
  );
}

function MobileMenuItem({ to, label, isActive, dot, onTap }: {
  to: string; label: string; isActive: boolean;
  dot?: { color: string; loaded: boolean };
  onTap: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onTap}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 20px",
        fontSize: 15,
        fontWeight: isActive ? 700 : 400,
        fontFamily: fonts.sans,
        color: isActive ? colors.orange : colors.black,
        textDecoration: "none",
        backgroundColor: isActive ? alpha(colors.orange, 7) : "transparent",
        borderBottom: `1px solid ${colors.paleGray}`,
        minHeight: 48,
      }}
    >
      {dot && <StatusDot color={dot.color} loaded={dot.loaded} />}
      {label}
    </NavLink>
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
    backgroundColor: colors.darkNavy,
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
    minHeight: 44,
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
    backgroundColor: colors.card,
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
  /* ── Mobile-specific ── */
  hamburger: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    fontSize: 22,
    color: colors.white,
    background: "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    minHeight: 44,
  },
  menuBackdrop: {
    position: "fixed" as const,
    inset: 0,
    top: 56,
    backgroundColor: colors.surfaceOverlay,
    zIndex: 98,
  },
  mobileMenu: {
    position: "fixed" as const,
    top: 56,
    left: 0,
    right: 0,
    maxHeight: "calc(100vh - 56px)",
    overflowY: "auto" as const,
    backgroundColor: colors.card,
    boxShadow: shadows.lg,
    zIndex: 99,
  },
  themeToggle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: alpha(colors.white, 12),
    border: "none",
    color: colors.white,
    cursor: "pointer",
    transition: "background .15s",
    flexShrink: 0,
  } as CSSProperties,
};
