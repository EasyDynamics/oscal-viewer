/* ═══════════════════════════════════════════════════════════════════════════
   CookieBanner — A non-intrusive banner shown at the bottom of the
   viewport when the user has not yet made a cookie preference choice.
   ═══════════════════════════════════════════════════════════════════════════ */

import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { colors, fonts, radii, shadows } from "../theme/tokens";
import { useCookieConsent } from "../hooks/useCookieConsent";
import useIsMobile from "../hooks/useIsMobile";

export default function CookieBanner() {
  const { consent, accept, decline } = useCookieConsent();
  const isMobile = useIsMobile();

  if (consent !== null) return null;

  return (
    <div style={{ ...s.wrapper, ...(isMobile ? s.wrapperMobile : {}) }}>
      <p style={{ ...s.text, ...(isMobile ? { fontSize: 12 } : {}) }}>
        This site uses a cookie to remember your preference.{" "}
        <Link to="/privacy" style={s.link}>Learn more</Link>
      </p>
      <div style={s.buttons}>
        <button onClick={accept} style={{ ...s.btn, backgroundColor: colors.navy, color: colors.white }}>
          Accept
        </button>
        <button onClick={decline} style={{ ...s.btn, backgroundColor: colors.card, color: colors.black, border: `1px solid ${colors.paleGray}` }}>
          Decline
        </button>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  wrapper: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "14px 24px",
    backgroundColor: colors.card,
    borderTop: `1px solid ${colors.paleGray}`,
    boxShadow: shadows.lg,
    zIndex: 1000,
  },
  wrapperMobile: {
    flexDirection: "column" as const,
    alignItems: "stretch" as const,
    gap: 10,
    padding: "12px 16px",
  },
  text: {
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: fonts.sans,
    color: colors.black,
    margin: 0,
  },
  link: {
    color: colors.brightBlue,
    textDecoration: "underline",
  },
  buttons: {
    display: "flex",
    gap: 8,
    flexShrink: 0,
  },
  btn: {
    padding: "7px 18px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: fonts.sans,
    border: "none",
    borderRadius: radii.sm,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
};
