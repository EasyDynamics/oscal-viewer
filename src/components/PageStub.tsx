/* ═══════════════════════════════════════════════════════════════════════════
   PageStub — reusable placeholder for OSCAL model pages not yet implemented.
   Shows the model name, description, color accent, and a file-upload zone.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { CSSProperties, ReactNode } from "react";
import { colors, fonts, shadows, radii } from "../theme/tokens";
import { IconUpload } from "./Icons";

interface PageStubProps {
  title: string;
  description: string;
  accentColor: string;
  icon: ReactNode;
  children?: ReactNode;
}

export default function PageStub({
  title,
  description,
  accentColor,
  icon,
  children,
}: PageStubProps) {
  return (
    <div>
      {/* Hero banner */}
      <div
        style={{
          ...styles.hero,
          borderLeft: `5px solid ${accentColor}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: accentColor }}>{icon}</span>
          <h1 style={{ ...styles.title, color: accentColor }}>{title}</h1>
        </div>
        <p style={styles.desc}>{description}</p>
      </div>

      {/* Content area — either children or a default upload prompt */}
      {children ?? (
        <div style={styles.uploadZone}>
          <IconUpload size={40} style={{ color: colors.gray }} />
          <p style={{ marginTop: 12, fontSize: 15, color: colors.black }}>
            Drop an OSCAL <strong>{title}</strong> JSON file here, or click to
            browse
          </p>
          <p style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>
            Supports OSCAL JSON format
          </p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: "24px 28px",
    marginBottom: 24,
    boxShadow: shadows.sm,
  },
  title: {
    fontSize: "1.6rem",
    fontFamily: fonts.sans,
    fontWeight: 700,
    margin: 0,
  },
  desc: {
    marginTop: 8,
    fontSize: 14,
    color: colors.black,
    lineHeight: 1.6,
  },
  uploadZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: `2px dashed ${colors.paleGray}`,
    borderRadius: radii.lg,
    padding: "48px 24px",
    backgroundColor: colors.card,
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color .2s",
  },
};
