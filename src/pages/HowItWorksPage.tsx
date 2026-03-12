/* ═══════════════════════════════════════════════════════════════════════════
   How It Works — Describes how the viewer resolves model references,
   and how downstream models pull control information from the Catalog
   (not the Profile).
   ═══════════════════════════════════════════════════════════════════════════ */

import { type CSSProperties } from "react";
import { colors, fonts, shadows, radii, alpha } from "../theme/tokens";
import useIsMobile from "../hooks/useIsMobile";

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE SVG ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconProps { size?: number; style?: CSSProperties }

function IcoBook({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>;
}
function IcoLayers({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>;
}
function IcoLink({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>;
}
function IcoArrowDown({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>;
}
function IcoShield({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function IcoInfo({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
}
function IcoDatabase({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>;
}
function IcoSliders({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HowItWorksPage() {
  const isMobile = useIsMobile();

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "20px 14px" : "36px 24px" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <IcoBook size={24} style={{ color: colors.navy }} />
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: colors.navy, margin: 0 }}>
            How the Viewer Works
          </h1>
        </div>
        <p style={{ fontSize: 14, color: colors.gray, lineHeight: 1.6, margin: 0 }}>
          This page explains how the OSCAL Viewer resolves references between models,
          and why the <strong>Catalog</strong> — not the Profile — is the source of
          truth for control details across every downstream model.
        </p>
      </div>

      {/* ── The Catalog is the Source of Truth ── */}
      <Card>
        <SectionHeader icon={<IcoDatabase size={18} style={{ color: colors.navy }} />} color={colors.navy}>
          The Catalog is the Source of Truth
        </SectionHeader>
        <p style={S.paragraph}>
          An OSCAL <strong>Catalog</strong> is the canonical collection of security and
          privacy controls. It contains every control's full text — statement, guidance,
          parameters, assessment methods, and more. When you load a catalog into the
          viewer, it becomes the shared knowledge base that all other models draw from.
        </p>
        <p style={S.paragraph}>
          Other OSCAL models — Profiles, Component Definitions, SSPs, Assessment Plans,
          Assessment Results, and POA&amp;Ms — reference controls <em>by ID</em>{" "}
          (e.g.&nbsp;<code style={S.code}>ac-2</code>, <code style={S.code}>sc-7.4</code>).
          They do <strong>not</strong> duplicate the full control text. Instead, the viewer
          looks up each control ID in the currently loaded Catalog to render its
          details.
        </p>
        <Callout color={colors.cobalt}>
          <strong>Key insight:</strong> If no Catalog is loaded, downstream models can
          still show the control IDs they reference, but full names, statements, and
          guidance won't be available.
        </Callout>
      </Card>

      {/* ── What a Profile Does ── */}
      <Card>
        <SectionHeader icon={<IcoSliders size={18} style={{ color: colors.brightBlue }} />} color={colors.brightBlue}>
          What a Profile Does (and Doesn't Do)
        </SectionHeader>
        <p style={S.paragraph}>
          A <strong>Profile</strong> (sometimes called a "baseline") selects a subset of
          controls from one or more Catalogs and optionally tailors them — adding
          constraints to parameters, inserting additional guidance, or removing parts
          that don't apply.
        </p>
        <p style={S.paragraph}>
          Critically, a Profile <strong>does not carry the full control text</strong>.
          It carries:
        </p>
        <ul style={S.list}>
          <li><strong>Imports</strong> — which Catalog(s) to pull from, and which control IDs to include or exclude.</li>
          <li><strong>Merge strategy</strong> — how to combine controls when importing from multiple catalogs.</li>
          <li><strong>Modify</strong> — parameter constraints (<code style={S.code}>set-parameter</code>) and structural changes (<code style={S.code}>alter</code>: add / remove parts).</li>
        </ul>
        <p style={S.paragraph}>
          When you load a Profile into the viewer, the viewer reads the Profile's
          import references and — if possible — fetches the referenced Catalog
          automatically. All control details you see on the Profile page come from
          that Catalog, overlaid with the Profile's tailoring.
        </p>
      </Card>

      {/* ── Reference Flow Diagram ── */}
      <Card>
        <SectionHeader icon={<IcoLink size={18} style={{ color: colors.cobalt }} />} color={colors.cobalt}>
          How References Flow
        </SectionHeader>
        <p style={S.paragraph}>
          OSCAL models form a directed reference graph. Each model points "upstream"
          to the model it depends on. The viewer follows these references to enrich
          the data it displays.
        </p>

        <div style={S.diagramWrap}>
          <DiagramNode color={colors.navy} label="Catalog" sublabel="Full control text, params, groups" icon={<IcoDatabase size={20} />} />
          <DiagramArrow label="imports from" />
          <DiagramNode color={colors.brightBlue} label="Profile" sublabel="Selects & tailors controls" icon={<IcoSliders size={20} />} />
          <DiagramArrow label="import-profile" />
          <DiagramNode color={colors.darkGreen} label="SSP" sublabel="System-level control implementations" icon={<IcoShield size={20} />} />

          {/* SSP branches to AP and POA&M */}
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
              <DiagramArrow label="import-ssp" />
              <DiagramNode color={colors.purple} label="Assessment Plan" sublabel="What to test" icon={<IcoInfo size={20} />} />
              <DiagramArrow label="import-ap" />
              <DiagramNode color={colors.purple} label="Assessment Results" sublabel="Test findings" icon={<IcoInfo size={20} />} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
              <DiagramArrow label="import-ssp" />
              <DiagramNode color={colors.red} label="POA&M" sublabel="Remediation tracking" icon={<IcoLayers size={20} />} />
            </div>
          </div>

          {/* Component Definition — references Catalog source */}
          <div style={{ marginTop: 16, borderTop: `1px dashed ${colors.gray}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: colors.gray, fontStyle: "italic", textAlign: "center", marginBottom: 8 }}>
              Also references the Catalog directly:
            </div>
            <DiagramNode color={colors.cobalt} label="Component Definition" sublabel="source → Catalog for control details" icon={<IcoLayers size={20} />} />
          </div>
        </div>

        <Callout color={colors.navy}>
          <strong>Key relationships:</strong> Profile imports from Catalog. SSP imports a Profile.
          Assessment Plan and POA&amp;M both import an SSP. Assessment Results imports an Assessment Plan.
          Component Definitions reference the Catalog directly via their control-implementation source.
        </Callout>
      </Card>

      {/* ── How the Viewer Resolves a Profile Import ── */}
      <Card>
        <SectionHeader icon={<IcoLink size={18} style={{ color: colors.orange }} />} color={colors.orange}>
          Resolving Profile Import References
        </SectionHeader>
        <p style={S.paragraph}>
          A Profile's <code style={S.code}>imports[].href</code> can appear in two forms:
        </p>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", marginBottom: 16 }}>
          <MiniCard title="Direct URL" color={colors.brightBlue}>
            <code style={S.codeSm}>
              "href": "https://…/catalog.json"
            </code>
            <p style={{ ...S.paragraph, marginTop: 8, marginBottom: 0 }}>
              The viewer fetches this URL directly to load the catalog.
            </p>
          </MiniCard>

          <MiniCard title="Back-matter reference" color={colors.orange}>
            <code style={S.codeSm}>
              "href": "#84cbf061-…-1f529232e907"
            </code>
            <p style={{ ...S.paragraph, marginTop: 8, marginBottom: 0 }}>
              The <code style={S.code}>#</code> prefix means "look up this UUID in
              the Profile's own <code style={S.code}>back-matter.resources</code>".
              The matching resource contains <code style={S.code}>rlinks</code> with
              the actual URL(s).
            </p>
          </MiniCard>
        </div>

        <p style={S.paragraph}>
          Once the viewer resolves the URL, it fetches the JSON, validates that it's
          a proper OSCAL Catalog (has <code style={S.code}>metadata</code> and{" "}
          <code style={S.code}>uuid</code>), and loads it into the shared context —
          replacing any previously loaded catalog. From that point on, every page
          in the viewer can look up full control details.
        </p>
      </Card>

      {/* ── Why Not the Profile? ── */}
      <Card>
        <SectionHeader icon={<IcoInfo size={18} style={{ color: colors.darkGreen }} />} color={colors.darkGreen}>
          Why Downstream Models Reference the Catalog, Not the Profile
        </SectionHeader>
        <p style={S.paragraph}>
          It's a common question: if a Profile selects and tailors controls, why don't
          SSPs and Component Definitions reference the Profile for control details?
        </p>
        <ul style={S.list}>
          <li>
            <strong>Profiles don't carry control text.</strong> They only carry
            selection criteria and modification instructions. The actual prose,
            parameters, and assessment methods live in the Catalog.
          </li>
          <li>
            <strong>Profile resolution is an OSCAL concept.</strong> In OSCAL
            tooling, "resolving" a Profile against its Catalog produces a
            resolved catalog — essentially a filtered and tailored copy. The
            viewer performs this resolution on the fly when both are loaded.
          </li>
          <li>
            <strong>Simplicity and accuracy.</strong> Rather than every model
            embedding its own copy of control text (which would drift out of date),
            OSCAL keeps one Catalog as the source of truth and lets models
            reference control IDs.
          </li>
        </ul>
      </Card>

      {/* ── What You See in the Viewer ── */}
      <Card>
        <SectionHeader icon={<IcoLayers size={18} style={{ color: colors.purple }} />} color={colors.purple}>
          What You See in the Viewer
        </SectionHeader>
        <p style={S.paragraph}>
          When both a Profile and a Catalog are loaded, the Profile page merges
          the two data sources to show you:
        </p>
        <ul style={S.list}>
          <li>
            <strong>Full control details</strong> — title, statement prose,
            guidance, and assessment methods — pulled from the Catalog.
          </li>
          <li>
            <strong>Parameter constraints</strong> — values, selections, and
            labels set by the Profile's <code style={S.code}>set-parameter</code>{" "}
            entries, rendered inline in the control statement.
          </li>
          <li>
            <strong>Structural tailoring</strong> — parts added or removed by
            the Profile's <code style={S.code}>alter</code> entries, shown with
            visual <span style={{ color: colors.successFg, fontWeight: 600 }}>A</span>{" "}
            (added) and <span style={{ color: colors.red, fontWeight: 600 }}>R</span>{" "}
            (removed) badges.
          </li>
        </ul>
        <p style={S.paragraph}>
          Without the Catalog, the Profile page still shows the list of selected
          control IDs, parameter constraints, and alter operations — but it cannot
          display the full control text or render inline parameter substitutions.
        </p>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ backgroundColor: colors.card, borderRadius: radii.md, padding: "24px 28px", boxShadow: shadows.sm, marginBottom: 20, ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ children, icon, color }: { children: React.ReactNode; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      {icon}
      <h2 style={{ fontSize: 18, fontWeight: 700, color, margin: 0 }}>{children}</h2>
    </div>
  );
}

function Callout({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      backgroundColor: alpha(color, 6),
      borderLeft: `4px solid ${color}`,
      borderRadius: radii.sm,
      padding: "12px 16px",
      fontSize: 13,
      lineHeight: 1.6,
      color: colors.black,
      marginTop: 12,
    }}>
      {children}
    </div>
  );
}

function MiniCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderTop: `3px solid ${color}`,
      backgroundColor: alpha(color, 4),
      borderRadius: radii.sm,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function DiagramNode({ color, label, sublabel, icon }: { color: string; label: string; sublabel: string; icon: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      backgroundColor: alpha(color, 7),
      border: `2px solid ${color}`,
      borderRadius: radii.md,
      padding: "12px 18px",
    }}>
      <div style={{ color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 11, color: colors.gray }}>{sublabel}</div>
      </div>
    </div>
  );
}

function DiagramArrow({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
      <IcoArrowDown size={18} style={{ color: colors.gray }} />
      <span style={{ fontSize: 10, color: colors.gray, fontStyle: "italic" }}>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const S: Record<string, CSSProperties> = {
  paragraph: {
    fontSize: 14,
    lineHeight: 1.7,
    color: colors.black,
    marginBottom: 12,
    marginTop: 0,
  },
  list: {
    fontSize: 14,
    lineHeight: 1.7,
    color: colors.black,
    paddingLeft: 24,
    marginBottom: 12,
    marginTop: 0,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 12,
    backgroundColor: alpha(colors.cobalt, 8),
    padding: "2px 6px",
    borderRadius: radii.sm,
    color: colors.navy,
  },
  codeSm: {
    fontFamily: fonts.mono,
    fontSize: 11,
    backgroundColor: alpha(colors.navy, 6),
    padding: "4px 8px",
    borderRadius: radii.sm,
    display: "block",
    overflowX: "auto" as const,
    color: colors.navy,
    whiteSpace: "pre" as const,
  },
  diagramWrap: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "stretch",
    maxWidth: 380,
    margin: "16px auto",
  },
};
