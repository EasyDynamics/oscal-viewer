/* ═══════════════════════════════════════════════════════════════════════════
   SSP Documentation — Details System Security Plan viewer behavior.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { CSSProperties } from "react";
import DocsNav from "../components/DocsNav";
import {
  IcoCloud,
  IcoDatabase,
  IcoEye,
  IcoLayers,
  IcoLink,
  IcoNetwork,
  IcoPaperclip,
  IcoShield,
  IcoUpload,
} from "../components/IconAliases";
import useIsMobile from "../hooks/useIsMobile";
import { alpha, colors, fonts, radii, shadows } from "../theme/tokens";

export default function DocsSspPage() {
  const isMobile = useIsMobile();

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: isMobile ? "20px 14px" : "36px 24px" }}>
      <DocsNav />

      <header style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <IcoShield size={26} style={{ color: colors.darkGreen }} />
          <h1 style={{ fontSize: isMobile ? 22 : 30, color: colors.navy, margin: 0 }}>SSP Viewer Guide</h1>
        </div>
        <p style={S.lede}>
          The System Security Plan page is the most connected viewer in the application. It renders
          system characteristics, diagrams, users, components, inventory, control implementation
          statements, and leveraged authorizations that can be linked to provider SSPs.
        </p>
      </header>

      <Card>
        <SectionHeader icon={<IcoDatabase size={18} style={{ color: colors.navy }} />} color={colors.navy}>
          What the SSP Page Reads
        </SectionHeader>
        <p style={S.paragraph}>
          The SSP viewer parses the loaded <code style={S.code}>system-security-plan</code> and organizes it
          around two main areas: <strong>system characteristics</strong> and <strong>system implementation</strong>.
          If a Profile and Catalog are available, the viewer enriches control IDs with catalog families,
          titles, statement prose, and parameter text.
        </p>
        <ul style={S.list}>
          <li><strong>Metadata</strong> — document title, parties, roles, versions, and responsible parties.</li>
          <li><strong>System characteristics</strong> — system IDs, security impact levels, status, authorization boundary, network architecture, data flow, and information types.</li>
          <li><strong>System implementation</strong> — users, components, inventory items, component relationships, and leveraged authorizations.</li>
          <li><strong>Control implementation</strong> — implemented requirements, by-component statements, inherited entries, satisfied entries, and set parameters.</li>
        </ul>
      </Card>

      <Card>
        <SectionHeader icon={<IcoNetwork size={18} style={{ color: colors.purple }} />} color={colors.purple}>
          Diagram Support
        </SectionHeader>
        <p style={S.paragraph}>
          The SSP page supports diagrams in the three OSCAL system-characteristics sections where teams
          usually document architecture context:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          <MiniCard icon={<IcoShield size={16} />} title="Authorization boundary" color={colors.darkGreen}>
            Shows what is inside and outside the authorization boundary.
          </MiniCard>
          <MiniCard icon={<IcoNetwork size={16} />} title="Network architecture" color={colors.purple}>
            Shows systems, networks, trust boundaries, and connection paths.
          </MiniCard>
          <MiniCard icon={<IcoLink size={16} />} title="Data flow" color={colors.cobalt}>
            Shows how information moves between components, users, and external services.
          </MiniCard>
        </div>
        <p style={S.paragraph}>
          Diagram entries can point at normal links, <code style={S.code}>rlinks</code>, back-matter resources,
          or embedded <code style={S.code}>base64</code> content. The viewer resolves those artifacts into an
          interactive gallery when possible.
        </p>
        <ul style={S.list}>
          <li><strong>Mermaid</strong> diagrams are rendered directly in the browser.</li>
          <li><strong>diagrams.net / draw.io</strong> diagrams can be opened with the diagrams.net viewer controls.</li>
          <li><strong>Images and PDFs</strong> can be opened through the artifact modal or browser preview behavior.</li>
          <li><strong>Back-matter references</strong> let the SSP keep diagram metadata separate from the actual artifact location.</li>
        </ul>
      </Card>

      <Card>
        <SectionHeader icon={<IcoCloud size={18} style={{ color: colors.purple }} />} color={colors.purple}>
          Leveraged Authorizations
        </SectionHeader>
        <p style={S.paragraph}>
          Leveraged authorizations describe external systems whose authorization package is reused by the
          current system. The SSP page turns these into navigable cards and a system map so readers can see
          which provider systems are connected to the current SSP.
        </p>
        <p style={S.paragraph}>
          A leveraged authorization can be linked to a provider SSP. Once a provider SSP is loaded, the viewer
          builds indexes of exported responsibilities and provided controls. That lets inherited and satisfied
          statements resolve back to the provider system that satisfies them.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <MiniCard icon={<IcoUpload size={16} />} title="Load provider SSP" color={colors.cobalt}>
            Open a leveraged authorization and attach the matching provider SSP directly to that authorization.
          </MiniCard>
          <MiniCard icon={<IcoEye size={16} />} title="Explore controls offered" color={colors.purple}>
            View provider controls grouped by family and by exporting provider component.
          </MiniCard>
          <MiniCard icon={<IcoLink size={16} />} title="Resolve inherited entries" color={colors.darkGreen}>
            Match inherited UUID references to provider exported responsibilities.
          </MiniCard>
          <MiniCard icon={<IcoLayers size={16} />} title="Roll up status" color={colors.orange}>
            Treat controls satisfied by loaded leveraged authorizations as satisfied in dashboard summaries.
          </MiniCard>
        </div>
      </Card>

      <Card>
        <SectionHeader icon={<IcoLayers size={18} style={{ color: colors.darkGreen }} />} color={colors.darkGreen}>
          Control Implementation Views
        </SectionHeader>
        <p style={S.paragraph}>
          The control implementation area is built around control IDs. It combines the current SSP's
          implemented requirements with the resolved profile and catalog, then adds provider information
          from loaded leveraged SSPs.
        </p>
        <ul style={S.list}>
          <li><strong>Family navigation</strong> groups controls by catalog family such as AC, AU, CM, IA, and SC.</li>
          <li><strong>Implementation statements</strong> show by-component details, set parameters, links, and remarks.</li>
          <li><strong>Inherited</strong> and <strong>satisfied</strong> tabs highlight responsibilities delegated to leveraged providers.</li>
          <li><strong>Missing-control indicators</strong> help identify selected profile controls that do not yet have SSP implementation content.</li>
        </ul>
      </Card>

      <Card>
        <SectionHeader icon={<IcoPaperclip size={18} style={{ color: colors.orange }} />} color={colors.orange}>
          Artifact and Back-Matter Handling
        </SectionHeader>
        <p style={S.paragraph}>
          SSP diagrams and implementation links often use back-matter resources for supporting artifacts.
          The viewer resolves <code style={S.code}>#uuid</code> references to back-matter resources, follows
          resource <code style={S.code}>rlinks</code>, and can display embedded <code style={S.code}>base64</code>
          artifacts when present.
        </p>
        <Callout color={colors.orange}>
          <strong>Producer tip:</strong> keep large evidence, diagrams, and generated files in back-matter
          resources. Link to them from diagrams or implementation statements instead of duplicating content
          inside prose fields.
        </Callout>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={S.card}>{children}</div>;
}

function SectionHeader({ children, icon, color }: { children: React.ReactNode; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      {icon}
      <h2 style={{ fontSize: 18, fontWeight: 800, color, margin: 0 }}>{children}</h2>
    </div>
  );
}

function MiniCard({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `3px solid ${color}`, borderRadius: radii.sm, backgroundColor: alpha(color, 5), padding: "13px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color }}>
        {icon}
        <strong style={{ fontSize: 13 }}>{title}</strong>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: colors.black }}>{children}</div>
    </div>
  );
}

function Callout({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ backgroundColor: alpha(color, 6), borderLeft: `4px solid ${color}`, borderRadius: radii.sm, padding: "12px 16px", fontSize: 13, lineHeight: 1.6, color: colors.black }}>
      {children}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  header: {
    backgroundColor: colors.card,
    borderLeft: `5px solid ${colors.darkGreen}`,
    borderRadius: radii.md,
    padding: "24px 28px",
    boxShadow: shadows.sm,
    marginBottom: 20,
  },
  lede: {
    fontSize: 14,
    lineHeight: 1.7,
    color: colors.gray,
    margin: 0,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: "24px 28px",
    boxShadow: shadows.sm,
    marginBottom: 20,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 1.7,
    color: colors.black,
    marginTop: 0,
    marginBottom: 12,
  },
  list: {
    fontSize: 14,
    lineHeight: 1.7,
    color: colors.black,
    paddingLeft: 24,
    marginTop: 0,
    marginBottom: 0,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 12,
    backgroundColor: alpha(colors.cobalt, 8),
    padding: "2px 6px",
    borderRadius: radii.sm,
    color: colors.navy,
  },
};
