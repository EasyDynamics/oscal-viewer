/* ═══════════════════════════════════════════════════════════════════════════
   Privacy Policy — Describes data handling practices and cookie opt-out.
   ═══════════════════════════════════════════════════════════════════════════ */

import { type CSSProperties } from "react";
import { colors, fonts, shadows, radii } from "../theme/tokens";
import { useCookieConsent } from "../hooks/useCookieConsent";
import useIsMobile from "../hooks/useIsMobile";

export default function PrivacyPolicyPage() {
  const isMobile = useIsMobile();
  const { consent, accept, decline } = useCookieConsent();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: isMobile ? "20px 14px" : "36px 24px" }}>
      <h1 style={s.heading}>Privacy Policy</h1>
      <p style={s.updated}>Last updated: March 10, 2026</p>

      <section style={s.section}>
        <h2 style={s.subheading}>Overview</h2>
        <p style={s.text}>
          OSCAL Viewer is a client-side tool that runs entirely in your browser.
          Your OSCAL documents are processed locally and <strong>never transmitted
          to any server</strong>. We do not operate a backend service, database,
          or cloud storage for user data.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.subheading}>Data We Do Not Collect</h2>
        <ul style={s.list}>
          <li style={s.listItem}>We do not collect personal information.</li>
          <li style={s.listItem}>We do not track your browsing behavior across sites.</li>
          <li style={s.listItem}>We do not store or transmit your OSCAL documents.</li>
          <li style={s.listItem}>We do not use third-party advertising services.</li>
        </ul>
      </section>

      <section style={s.section}>
        <h2 style={s.subheading}>Cookies &amp; Local Storage</h2>
        <p style={s.text}>
          By default, this application uses a single cookie
          (<code style={s.code}>cookie_consent</code>) to remember your cookie
          preference. If you accept cookies, we may also store non-essential
          preferences (such as your theme choice) in <code style={s.code}>localStorage</code>.
        </p>
        <p style={s.text}>
          If you decline cookies, only essential functionality will be used and
          no preference cookies will be set. Your theme and other preferences
          will still work for the current session but will not persist across
          visits.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.subheading}>JWT Tokens</h2>
        <p style={s.text}>
          If you load a JWT token for authenticated document fetches, it is held
          in <code style={s.code}>sessionStorage</code> and automatically
          cleared when the browser tab is closed. It is never written to a
          cookie or persisted to disk.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.subheading}>Third-Party Services</h2>
        <p style={s.text}>
          When you load a document from a remote URL, your browser makes a
          direct request to that URL. We do not proxy or log these requests.
          The privacy practices of the remote server are governed by their own
          policies.
        </p>
      </section>

      <section style={{ ...s.section, ...s.optOutBox }}>
        <h2 style={s.subheading}>Your Cookie Preference</h2>
        <p style={s.text}>
          Current status:{" "}
          <strong>
            {consent === "accepted"
              ? "Cookies accepted"
              : consent === "declined"
              ? "Cookies declined"
              : "No preference set"}
          </strong>
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <button
            onClick={accept}
            style={{
              ...s.btn,
              backgroundColor: consent === "accepted" ? colors.darkGreen : colors.navy,
              color: colors.white,
            }}
          >
            {consent === "accepted" ? "✓ Cookies Accepted" : "Accept Cookies"}
          </button>
          <button
            onClick={decline}
            style={{
              ...s.btn,
              backgroundColor: consent === "declined" ? colors.red : colors.gray,
              color: colors.white,
            }}
          >
            {consent === "declined" ? "✓ Cookies Declined" : "Decline Cookies"}
          </button>
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.subheading}>Changes to This Policy</h2>
        <p style={s.text}>
          We may update this privacy policy from time to time. Changes will be
          reflected on this page with an updated revision date.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.subheading}>Contact</h2>
        <p style={s.text}>
          If you have questions about this policy, please open an issue on our{" "}
          <a
            href="https://github.com/EasyDynamics/oscal-viewer"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: colors.brightBlue }}
          >
            GitHub repository
          </a>.
        </p>
      </section>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  heading: {
    fontSize: "1.6rem",
    fontWeight: 700,
    fontFamily: fonts.sans,
    color: colors.navy,
    margin: "0 0 4px",
  },
  updated: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: 28,
  },
  section: {
    marginBottom: 28,
  },
  subheading: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: fonts.sans,
    color: colors.navy,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 1.7,
    color: colors.black,
    margin: "0 0 8px",
  },
  list: {
    margin: 0,
    paddingLeft: 20,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 1.8,
    color: colors.black,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 13,
    backgroundColor: colors.surfaceSubtle,
    padding: "1px 5px",
    borderRadius: radii.sm,
  },
  optOutBox: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.md,
    padding: "20px 24px",
    boxShadow: shadows.sm,
  },
  btn: {
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: fonts.sans,
    border: "none",
    borderRadius: radii.sm,
    cursor: "pointer",
    transition: "background .15s",
  },
};
