import { NavLink } from "react-router-dom";
import type { CSSProperties } from "react";
import { colors, fonts, radii, alpha } from "../theme/tokens";
import { IcoBook, IcoInfo, IcoShield } from "./IconAliases";

const docsItems = [
  { to: "/docs", label: "Overview", description: "How references, resolution, and viewer hints work", icon: <IcoInfo size={16} />, end: true },
  { to: "/docs/ssp", label: "SSP Viewer", description: "Diagrams, leveraged authorizations, and implementation views", icon: <IcoShield size={16} /> },
];

export default function DocsNav() {
  return (
    <nav style={styles.wrap} aria-label="Documentation pages">
      <div style={styles.header}>
        <IcoBook size={16} style={{ color: colors.navy }} />
        <span>Documentation</span>
      </div>
      <div style={styles.grid}>
        {docsItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              ...styles.item,
              borderColor: isActive ? alpha(colors.cobalt, 55) : colors.paleGray,
              backgroundColor: isActive ? alpha(colors.cobalt, 8) : colors.card,
              color: isActive ? colors.cobalt : colors.black,
            })}
          >
            <span style={styles.icon}>{item.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={styles.label}>{item.label}</span>
              <span style={styles.desc}>{item.description}</span>
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 20,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    color: colors.navy,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    marginBottom: 10,
    fontFamily: fonts.sans,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.sm,
    padding: "10px 12px",
    textDecoration: "none",
    transition: "border-color .15s, background-color .15s, color .15s",
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: colors.cobalt,
    backgroundColor: alpha(colors.cobalt, 10),
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 800,
    fontFamily: fonts.sans,
  },
  desc: {
    display: "block",
    fontSize: 11,
    lineHeight: 1.35,
    color: colors.gray,
    marginTop: 2,
    fontFamily: fonts.sans,
  },
};
