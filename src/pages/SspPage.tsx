/* ═══════════════════════════════════════════════════════════════════════════
   SSP Page — System Security Plan SPA-style viewer
   Left sidebar nav · Right content · Sys-Char / Sys-Impl / Ctrl-Impl views
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import { Marked } from "marked";
import { alpha, colors, fonts, radii, shadows, brand } from "../theme/tokens";
import { useOscal } from "../context/OscalContext";
import { useUrlDocument, fileNameFromUrl } from "../hooks/useUrlDocument";
import LinkChips from "../components/LinkChips";
import type {
  Catalog as OscalCatalog,
  Control as CatalogControl,
  Group as CatalogGroup,
  Part as CatalogPart,
  Param as CatalogParam,
} from "../context/OscalContext";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OscalProp { name: string; value: string; ns?: string; class?: string }

interface SspMetadata {
  title: string;
  version: string;
  oscalVersion: string;
  lastModified: string;
  published: string;
  parties: { uuid: string; name: string; type?: string }[];
  roles: { id: string; title: string }[];
  responsibleParties: { roleId: string; partyUuids: string[] }[];
}

interface SspUser {
  uuid: string;
  title: string;
  description: string;
  roleIds: string[];
  authorizedPrivileges: { title: string; functionsPerformed: string[] }[];
}

interface SspComponent {
  uuid: string;
  type: string;
  title: string;
  description: string;
  status: string;
  props: OscalProp[];
}

interface InventoryItem {
  uuid: string;
  description: string;
  props: OscalProp[];
  implementedComponents: { componentUuid: string }[];
}

interface LeveragedAuth {
  uuid: string;
  title: string;
  partyUuid: string;
  dateAuthorized: string;
}

interface SspStatement {
  statementId: string;
  uuid: string;
  description: string;
  byComponents: { componentUuid: string; uuid: string; description: string }[];
}

interface ImplementedRequirement {
  uuid: string;
  controlId: string;
  description: string;
  props: OscalProp[];
  statements: SspStatement[];
  byComponents: { componentUuid: string; uuid: string; description: string }[];
  responsibleRoles: { roleId: string; partyUuids: string[] }[];
  links: { href: string; rel?: string; text?: string }[];
}

interface SystemCharacteristics {
  systemName: string;
  systemNameShort: string;
  description: string;
  securitySensitivityLevel: string;
  systemIds: { id: string; identifierType?: string }[];
  securityImpactLevel: { objectiveConfidentiality: string; objectiveIntegrity: string; objectiveAvailability: string };
  status: { state: string; remarks?: string };
  authorizationBoundary: { description: string };
  props: OscalProp[];
}

interface SystemImplementation {
  users: SspUser[];
  components: SspComponent[];
  inventoryItems: InventoryItem[];
  leveragedAuthorizations: LeveragedAuth[];
}

interface ControlImplementation {
  description: string;
  implementedRequirements: ImplementedRequirement[];
}

interface SspResource {
  uuid: string;
  title: string;
  description?: string;
  props?: OscalProp[];
  rlinks?: { href: string; "media-type"?: string }[];
}

interface SspParsed {
  metadata: SspMetadata;
  systemCharacteristics: SystemCharacteristics;
  systemImplementation: SystemImplementation;
  controlImplementation: ControlImplementation;
  backMatter: SspResource[];
  importProfileHref: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PARSER
   ═══════════════════════════════════════════════════════════════════════════ */

function txt(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "prose" in v)
    return String((v as any).prose);
  return String(v);
}

function fmtDate(s?: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}

function parseSsp(raw: any): SspParsed {
  const ssp = raw["system-security-plan"] ?? raw;
  if (!ssp.metadata) throw new Error("Not a valid OSCAL SSP — missing metadata.");
  const md = ssp.metadata;

  /* Metadata */
  const metadata: SspMetadata = {
    title: md.title || "Untitled SSP",
    version: md.version || "",
    oscalVersion: md["oscal-version"] || "",
    lastModified: md["last-modified"] || "",
    published: md.published || "",
    parties: (md.parties || []).map((p: any) => ({
      uuid: p.uuid, name: p.name || "", type: p.type || "",
    })),
    roles: (md.roles || []).map((r: any) => ({ id: r.id, title: r.title || r.id })),
    responsibleParties: (md["responsible-parties"] || []).map((rp: any) => ({
      roleId: rp["role-id"], partyUuids: rp["party-uuids"] || [],
    })),
  };

  /* System Characteristics */
  const sc = ssp["system-characteristics"] || {};
  const sil = sc["security-impact-level"] || {};
  const systemCharacteristics: SystemCharacteristics = {
    systemName: sc["system-name"] || "",
    systemNameShort: sc["system-name-short"] || "",
    description: txt(sc.description),
    securitySensitivityLevel: sc["security-sensitivity-level"] || "",
    systemIds: (sc["system-ids"] || []).map((s: any) => ({
      id: typeof s === "string" ? s : s.id || "",
      identifierType: s["identifier-type"],
    })),
    securityImpactLevel: {
      objectiveConfidentiality: sil["security-objective-confidentiality"] || "",
      objectiveIntegrity: sil["security-objective-integrity"] || "",
      objectiveAvailability: sil["security-objective-availability"] || "",
    },
    status: { state: sc.status?.state || "", remarks: txt(sc.status?.remarks) },
    authorizationBoundary: { description: txt(sc["authorization-boundary"]?.description) },
    props: sc.props || [],
  };

  /* System Implementation */
  const si = ssp["system-implementation"] || {};
  const users: SspUser[] = (si.users || []).map((u: any) => ({
    uuid: u.uuid,
    title: u.title || "",
    description: txt(u.description),
    roleIds: u["role-ids"] || [],
    authorizedPrivileges: (u["authorized-privileges"] || []).map((ap: any) => ({
      title: ap.title || "",
      functionsPerformed: ap["functions-performed"] || [],
    })),
  }));
  const components: SspComponent[] = (si.components || []).map((c: any) => ({
    uuid: c.uuid,
    type: c.type || "",
    title: c.title || "",
    description: txt(c.description),
    status: c.status?.state || "",
    props: c.props || [],
  }));
  const inventoryItems: InventoryItem[] = (si["inventory-items"] || []).map((ii: any) => ({
    uuid: ii.uuid,
    description: txt(ii.description),
    props: ii.props || [],
    implementedComponents: (ii["implemented-components"] || []).map((ic: any) => ({
      componentUuid: ic["component-uuid"],
    })),
  }));
  const leveragedAuthorizations: LeveragedAuth[] = (si["leveraged-authorizations"] || []).map((la: any) => ({
    uuid: la.uuid,
    title: la.title || "",
    partyUuid: la["party-uuid"] || "",
    dateAuthorized: la["date-authorized"] || "",
  }));

  const systemImplementation: SystemImplementation = {
    users, components, inventoryItems, leveragedAuthorizations,
  };

  /* Control Implementation */
  const ci = ssp["control-implementation"] || {};
  const implementedRequirements: ImplementedRequirement[] = (ci["implemented-requirements"] || []).map((ir: any) => ({
    uuid: ir.uuid,
    controlId: ir["control-id"] || "",
    description: txt(ir.description),
    props: ir.props || [],
    statements: (ir.statements || []).map((st: any) => ({
      statementId: st["statement-id"] || "",
      uuid: st.uuid,
      description: txt(st.description),
      byComponents: (st["by-components"] || []).map((bc: any) => ({
        componentUuid: bc["component-uuid"], uuid: bc.uuid, description: txt(bc.description),
      })),
    })),
    byComponents: (ir["by-components"] || []).map((bc: any) => ({
      componentUuid: bc["component-uuid"], uuid: bc.uuid, description: txt(bc.description),
    })),
    responsibleRoles: (ir["responsible-roles"] || []).map((rr: any) => ({
      roleId: rr["role-id"] || "", partyUuids: rr["party-uuids"] || [],
    })),
    links: (ir.links || []).map((l: any) => ({
      href: l.href || "", rel: l.rel || undefined, text: l.text || undefined,
    })),
  }));

  const controlImplementation: ControlImplementation = {
    description: txt(ci.description),
    implementedRequirements,
  };

  /* Back-matter */
  const bm = ssp["back-matter"] || {};
  const backMatter: SspResource[] = (bm.resources || []).map((r: any) => ({
    uuid: r.uuid,
    title: r.title || "",
    description: txt(r.description),
    props: r.props || [],
    rlinks: r.rlinks || [],
  }));

  /* Import profile */
  const importProfileHref = ssp["import-profile"]?.href || "";

  return { metadata, systemCharacteristics, systemImplementation, controlImplementation, backMatter, importProfileHref };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   MARKUP RENDERER
   ═══════════════════════════════════════════════════════════════════════════ */

const markedInstance = new Marked({ async: false, gfm: true, breaks: false });
function renderMarkup(text: string): string {
  const html = markedInstance.parse(text) as string;
  const trimmed = html.trim();
  if (trimmed.startsWith("<p>") && trimmed.endsWith("</p>") && trimmed.indexOf("<p>", 1) === -1)
    return trimmed.slice(3, -4);
  return trimmed;
}

function MarkupBlock({ value, style }: { value: unknown; style?: CSSProperties }) {
  const raw = txt(value);
  if (!raw) return null;
  return (
    <div className="oscal-markup"
      style={{ fontSize: 13, color: colors.black, lineHeight: 1.75, ...style }}
      dangerouslySetInnerHTML={{ __html: renderMarkup(raw) }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconProps { size?: number; style?: CSSProperties }

function IcoUpload({ size = 20, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IcoShield({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IcoChev({ open, style }: { open: boolean; style?: CSSProperties }) {
  return (
    <svg style={{ ...style, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform .15s", flexShrink: 0 }} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IcoHome({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IcoInfo({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function IcoServer({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}
function IcoCube({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function IcoLayers({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function IcoUsers({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IcoClipboard({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}
function IcoBook({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}
function IcoLink({ size = 14, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}
function IcoBox({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    </svg>
  );
}

function IcoFolder({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function IcoTag({ size = 14, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTROL FAMILY HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const FAMILY_NAMES: Record<string, string> = {
  ac: "Access Control",
  at: "Awareness and Training",
  au: "Audit and Accountability",
  ca: "Assessment, Authorization, and Monitoring",
  cm: "Configuration Management",
  cp: "Contingency Planning",
  ia: "Identification and Authentication",
  ir: "Incident Response",
  ma: "Maintenance",
  mp: "Media Protection",
  pe: "Physical and Environmental Protection",
  pl: "Planning",
  pm: "Program Management",
  ps: "Personnel Security",
  pt: "PII Processing and Transparency",
  ra: "Risk Assessment",
  sa: "System and Services Acquisition",
  sc: "System and Communications Protection",
  si: "System and Information Integrity",
  sr: "Supply Chain Risk Management",
};

/** Extract the family prefix from a control-id, e.g. "ac-1" → "ac", "ac-2.1" → "ac" */
function getFamily(controlId: string): string {
  const m = controlId.match(/^([a-z]+)/i);
  return m ? m[1].toLowerCase() : controlId;
}

/** For enhancements like "ac-2.1" return the parent "ac-2"; for base controls return null */
function getParentControlId(controlId: string): string | null {
  const dotIdx = controlId.lastIndexOf(".");
  if (dotIdx === -1) return null;
  return controlId.slice(0, dotIdx);
}

/* nav icon resolver */
function navIcon(icon: string, color: string, size = 14): ReactNode {
  const st: CSSProperties = { color, flexShrink: 0 };
  switch (icon) {
    case "home": return <IcoHome size={size} style={st} />;
    case "info": return <IcoInfo size={size} style={st} />;
    case "server": return <IcoServer size={size} style={st} />;
    case "cube": return <IcoCube size={size} style={st} />;
    case "layers": return <IcoLayers size={size} style={st} />;
    case "shield": return <IcoShield size={size} style={st} />;
    case "users": return <IcoUsers size={size} style={st} />;
    case "clipboard": return <IcoClipboard size={size} style={st} />;
    case "book": return <IcoBook size={size} style={st} />;
    case "link": return <IcoLink size={size} style={st} />;
    case "box": return <IcoBox size={size} style={st} />;
    case "folder": return <IcoFolder size={size} style={st} />;
    case "tag": return <IcoTag size={size} style={st} />;
    default: return <IcoBook size={size} style={st} />;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Card({ children, style: s }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      backgroundColor: colors.white, borderRadius: radii.md,
      padding: "20px 24px", boxShadow: shadows.sm, marginBottom: 16, ...s,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, style: s }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: 1, color: colors.gray, marginBottom: 8, ...s,
    }}>
      {children}
    </div>
  );
}

function MField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.gray, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: colors.black, fontFamily: mono ? fonts.mono : fonts.sans, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: "center", background: "#F4F5F7", borderRadius: 6, padding: "8px 16px", minWidth: 72 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const isImplemented = lower === "implemented";
  const isPartial = lower.includes("partial");
  const bg = isImplemented ? "#E6F3F0" : isPartial ? "#FFF8F0" : "#F4F5F7";
  const fg = isImplemented ? colors.darkGreen : isPartial ? colors.orange : colors.gray;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: radii.pill, backgroundColor: bg, color: fg }}>
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG ENRICHMENT HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Find a control by ID anywhere in the catalog (groups, sub-groups, and enhancements) */
function findCatalogControl(catalog: OscalCatalog | null, controlId: string): CatalogControl | undefined {
  if (!catalog) return undefined;
  function searchGroup(g: CatalogGroup): CatalogControl | undefined {
    for (const c of g.controls ?? []) {
      if (c.id === controlId) return c;
      for (const enh of c.controls ?? []) {
        if (enh.id === controlId) return enh;
      }
    }
    for (const sg of g.groups ?? []) {
      const found = searchGroup(sg);
      if (found) return found;
    }
    return undefined;
  }
  for (const g of catalog.groups ?? []) {
    const found = searchGroup(g);
    if (found) return found;
  }
  for (const c of catalog.controls ?? []) {
    if (c.id === controlId) return c;
    for (const enh of c.controls ?? []) {
      if (enh.id === controlId) return enh;
    }
  }
  return undefined;
}

/** Find a specific part by id anywhere in a control's part tree */
function findPartById(parts: CatalogPart[], partId: string): CatalogPart | undefined {
  for (const p of parts) {
    if (p.id === partId) return p;
    if (p.parts) {
      const found = findPartById(p.parts, partId);
      if (found) return found;
    }
  }
  return undefined;
}

/** Build a param map from a catalog control (including parent for enhancements) */
function buildCatalogParamMap(catalog: OscalCatalog | null, control: CatalogControl): Record<string, CatalogParam> {
  const map: Record<string, CatalogParam> = {};
  if (catalog) {
    function searchParent(g: CatalogGroup): CatalogControl | undefined {
      for (const c of g.controls ?? []) {
        for (const enh of c.controls ?? []) {
          if (enh.id === control.id) return c;
        }
      }
      for (const sg of g.groups ?? []) {
        const f = searchParent(sg);
        if (f) return f;
      }
      return undefined;
    }
    for (const g of catalog.groups ?? []) {
      const parent = searchParent(g);
      if (parent) { (parent.params ?? []).forEach(p => { map[p.id] = p; }); break; }
    }
  }
  (control.params ?? []).forEach(p => { map[p.id] = p; });
  (control.controls ?? []).forEach(enh => (enh.params ?? []).forEach(p => { map[p.id] = p; }));
  return map;
}

/** Render a single catalog param to text per OSCAL rules */
function renderCatalogParamText(param: CatalogParam, paramMap: Record<string, CatalogParam>): string {
  if (param.select) {
    const howMany = param.select["how-many"];
    const prefix = howMany === "one-or-more" ? "Selection (one or more)" : "Selection";
    const choices = (param.select.choice ?? []).map(c => resolveCatalogInlineParams(c, paramMap));
    return `[${prefix}: ${choices.join("; ")}]`;
  }
  const label = param.label ? resolveCatalogInlineParams(param.label, paramMap) : param.id;
  return `[Assignment: ${label}]`;
}

/** Replace {{ insert: param, <id> }} tokens in prose */
function resolveCatalogInlineParams(text: string, paramMap: Record<string, CatalogParam>): string {
  return text.replace(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/g, (_match, id: string) => {
    const param = paramMap[id.trim()];
    if (!param) return `[Assignment: ${id.trim()}]`;
    return renderCatalogParamText(param, paramMap);
  });
}

/** Get the label prop from a catalog control/part */
function getCatalogLabel(props?: { name: string; value: string }[]): string {
  if (!props) return "";
  const lbl = props.find(p => p.name === "label" && (p as { class?: string }).class !== "zero-padded");
  return lbl?.value ?? props.find(p => p.name === "label")?.value ?? "";
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG PROSE WITH PARAMS — inline param pills + markdown
   ═══════════════════════════════════════════════════════════════════════════ */

function CatalogProseWithParams({
  text,
  paramMap,
}: {
  text: string;
  paramMap: Record<string, CatalogParam>;
}) {
  const segments = text.split(/(\{\{\s*insert:\s*param\s*,\s*[^}]+?\s*\}\})/g);
  return (
    <span style={{ fontSize: 13, lineHeight: 1.75, color: colors.black }}>
      {segments.map((segment, i) => {
        const match = segment.match(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/);
        if (match) {
          const paramId = match[1].trim();
          const param = paramMap[paramId];
          const rendered = param ? renderCatalogParamText(param, paramMap) : `[Assignment: ${paramId}]`;
          const isSelection = param?.select != null;
          return (
            <span key={i} title={`Parameter: ${paramId}`} style={{
              display: "inline", fontSize: 12, fontFamily: fonts.mono, fontWeight: 600,
              color: isSelection ? colors.cobalt : colors.orange,
              backgroundColor: isSelection ? alpha(colors.cobalt, 7) : alpha(colors.orange, 7),
              padding: "1px 6px", borderRadius: radii.sm,
              border: `1px solid ${isSelection ? alpha(colors.cobalt, 20) : alpha(colors.orange, 20)}`,
              whiteSpace: "nowrap" as const,
            }}>
              {rendered}
            </span>
          );
        }
        const html = renderMarkup(segment);
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG CONTROL CARD — shows catalog prose when a catalog is loaded
   ═══════════════════════════════════════════════════════════════════════════ */

function CatalogControlCard({
  control,
  paramMap,
}: {
  control: CatalogControl;
  paramMap: Record<string, CatalogParam>;
}) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const label = getCatalogLabel(control.props as { name: string; value: string }[] | undefined);
  const title = control.title ?? "";
  const stmtParts = (control.parts ?? []).filter((p) => p.name === "statement");
  const guidanceParts = (control.parts ?? []).filter((p) => p.name === "guidance");

  function renderPartTree(part: CatalogPart, depth = 0): ReactNode {
    const partLabel = getCatalogLabel(part.props as { name: string; value: string }[] | undefined);
    return (
      <div key={part.id ?? Math.random()} style={{ marginLeft: depth * 16, marginBottom: 4 }}>
        {part.prose && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "2px 0" }}>
            {partLabel && (
              <span style={{ fontWeight: 600, color: colors.cobalt, marginRight: 2, fontSize: 13, fontFamily: fonts.mono }}>
                {partLabel}
              </span>
            )}
            <CatalogProseWithParams text={part.prose} paramMap={paramMap} />
          </div>
        )}
        {(part.parts ?? []).map((child) => renderPartTree(child, depth + 1))}
      </div>
    );
  }

  return (
    <Card>
      <SectionLabel style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14 }}>📖</span>
        <span>
          Catalog Control{" "}
          <span style={{ fontFamily: fonts.mono, color: colors.brightBlue }}>
            {label ? `${label} — ` : ""}{title}
          </span>
        </span>
      </SectionLabel>
      {stmtParts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: colors.cobalt, letterSpacing: 0.5, marginBottom: 6 }}>
            Control Statement
          </div>
          {stmtParts.map((p) => renderPartTree(p))}
        </div>
      )}
      {guidanceParts.length > 0 && (
        <div style={{ borderTop: `1px solid ${colors.paleGray}`, paddingTop: 8, marginTop: 4 }}>
          <button onClick={() => setGuidanceOpen((v) => !v)} style={{
            display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
            cursor: "pointer", padding: "4px 0", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase" as const, color: colors.cobalt, letterSpacing: 0.5, fontFamily: fonts.sans,
          }}>
            <span style={{ display: "inline-block", transition: "transform 0.2s", transform: guidanceOpen ? "rotate(90deg)" : "rotate(0deg)", fontSize: 10 }}>
              ▶
            </span>
            Supplemental Guidance
          </button>
          {guidanceOpen && (
            <div style={{ marginTop: 6, paddingLeft: 4 }}>
              {guidanceParts.map((p) => renderPartTree(p))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DROP ZONE
   ═══════════════════════════════════════════════════════════════════════════ */

function DropZone({ onFile, error }: { onFile: (f: File) => void; error: string }) {
  const [dragging, setDragging] = useState(false);
  const handleDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); };
  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = () => { const f = input.files?.[0]; if (f) onFile(f); };
    input.click();
  };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: 24 }}>
        <IcoShield size={48} style={{ color: colors.darkGreen }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>OSCAL System Security Plan Viewer</h2>
        <p style={{ fontSize: 14, color: colors.gray, marginTop: 4 }}>{brand.footerText}</p>
      </div>
      <div onClick={handleClick}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          border: `2px dashed ${dragging ? colors.cobalt : colors.paleGray}`,
          borderRadius: radii.lg, padding: "48px 24px",
          backgroundColor: dragging ? "#f0f4ff" : colors.white,
          cursor: "pointer", transition: "border-color .2s, background-color .2s",
          maxWidth: 520, margin: "0 auto",
        }}>
        <IcoUpload size={40} style={{ color: colors.gray }} />
        <p style={{ marginTop: 12, fontSize: 15, color: colors.black }}>
          Drop an OSCAL <strong>System Security Plan</strong> JSON file here
        </p>
        <p style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>or click to browse</p>
        {error && <p style={{ marginTop: 12, fontSize: 13, color: colors.red, fontWeight: 500 }}>{error}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAV TREE TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface NavItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  depth: number;
  parent?: string;
  childCount?: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PLACEHOLDER VIEWS
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewView({ ssp }: { ssp: SspParsed }) {
  const { metadata: md, systemCharacteristics: sc, systemImplementation: si, controlImplementation: ci, backMatter: bm } = ssp;
  return (
    <>
      <Card>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.navy, fontFamily: fonts.sans, margin: "0 0 4px" }}>
          {md.title}
        </h1>
        {sc.systemName && (
          <p style={{ fontSize: 14, color: colors.darkGreen, fontWeight: 600, margin: "0 0 8px" }}>
            System: {sc.systemName}{sc.systemNameShort ? ` (${sc.systemNameShort})` : ""}
          </p>
        )}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: colors.gray, marginBottom: 14 }}>
          {md.version && <span>Version: <strong style={{ color: colors.black }}>{md.version}</strong></span>}
          {md.oscalVersion && <span>OSCAL: <strong style={{ color: colors.black }}>{md.oscalVersion}</strong></span>}
          {md.lastModified && <span>Modified: <strong style={{ color: colors.black }}>{fmtDate(md.lastModified)}</strong></span>}
          {md.published && <span>Published: <strong style={{ color: colors.black }}>{fmtDate(md.published)}</strong></span>}
          {sc.status.state && <span>Status: <strong style={{ color: colors.black }}>{sc.status.state}</strong></span>}
          {sc.securitySensitivityLevel && <span>Sensitivity: <strong style={{ color: colors.black }}>{sc.securitySensitivityLevel}</strong></span>}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatChip value={si.components.length} label="Components" color={colors.cobalt} />
          <StatChip value={si.users.length} label="Users" color={colors.brightBlue} />
          <StatChip value={si.inventoryItems.length} label="Inventory" color={colors.darkGreen} />
          <StatChip value={ci.implementedRequirements.length} label="Controls" color={colors.orange} />
          <StatChip value={bm.length} label="Resources" color={colors.gray} />
          {si.leveragedAuthorizations.length > 0 && (
            <StatChip value={si.leveragedAuthorizations.length} label="Leveraged" color={colors.purple} />
          )}
        </div>
      </Card>

      {/* Impact levels */}
      {(sc.securityImpactLevel.objectiveConfidentiality || sc.securityImpactLevel.objectiveIntegrity || sc.securityImpactLevel.objectiveAvailability) && (
        <Card>
          <SectionLabel>Security Impact Levels</SectionLabel>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <MField label="Confidentiality" value={sc.securityImpactLevel.objectiveConfidentiality} />
            <MField label="Integrity" value={sc.securityImpactLevel.objectiveIntegrity} />
            <MField label="Availability" value={sc.securityImpactLevel.objectiveAvailability} />
          </div>
        </Card>
      )}

      {ssp.importProfileHref && (
        <Card>
          <SectionLabel>Import Profile</SectionLabel>
          <a href={ssp.importProfileHref} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: colors.cobalt, wordBreak: "break-all", fontFamily: fonts.mono }}>
            {ssp.importProfileHref}
          </a>
        </Card>
      )}
    </>
  );
}

function MetadataView({ ssp }: { ssp: SspParsed }) {
  const md = ssp.metadata;
  return (
    <>
      <Card>
        <SectionLabel>Metadata</SectionLabel>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <MField label="Title" value={md.title} />
          <MField label="Version" value={md.version} />
          <MField label="OSCAL Version" value={md.oscalVersion} mono />
          <MField label="Last Modified" value={fmtDate(md.lastModified)} />
          <MField label="Published" value={fmtDate(md.published)} />
        </div>
      </Card>

      {md.roles.length > 0 && (
        <Card>
          <SectionLabel>Roles ({md.roles.length})</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {md.roles.map((r) => (
              <span key={r.id} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: radii.sm,
                background: "#EEF2F8", color: colors.navy, fontFamily: fonts.mono, fontWeight: 500,
              }}>
                {r.title}
              </span>
            ))}
          </div>
        </Card>
      )}

      {md.parties.length > 0 && (
        <Card>
          <SectionLabel>Parties ({md.parties.length})</SectionLabel>
          {md.parties.map((p) => (
            <div key={p.uuid} style={{ fontSize: 13, marginBottom: 4 }}>
              <strong style={{ color: colors.navy }}>{p.name}</strong>
              {p.type && <span style={{ fontSize: 11, color: colors.gray, marginLeft: 8 }}>{p.type}</span>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function SystemCharacteristicsView({ ssp }: { ssp: SspParsed }) {
  const sc = ssp.systemCharacteristics;
  return (
    <>
      <Card>
        <SectionLabel>System Characteristics</SectionLabel>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.navy, margin: "0 0 8px" }}>
          {sc.systemName}{sc.systemNameShort ? ` (${sc.systemNameShort})` : ""}
        </h2>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <MField label="Status" value={sc.status.state} />
          <MField label="Sensitivity Level" value={sc.securitySensitivityLevel} />
          {sc.systemIds.map((sid, i) => (
            <MField key={i} label={`System ID${sid.identifierType ? ` (${sid.identifierType})` : ""}`} value={sid.id} mono />
          ))}
        </div>
      </Card>

      {(sc.securityImpactLevel.objectiveConfidentiality || sc.securityImpactLevel.objectiveIntegrity || sc.securityImpactLevel.objectiveAvailability) && (
        <Card>
          <SectionLabel>Security Impact Level</SectionLabel>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { l: "Confidentiality", v: sc.securityImpactLevel.objectiveConfidentiality, c: colors.cobalt },
              { l: "Integrity", v: sc.securityImpactLevel.objectiveIntegrity, c: colors.darkGreen },
              { l: "Availability", v: sc.securityImpactLevel.objectiveAvailability, c: colors.orange },
            ].filter((x) => x.v).map((x) => (
              <div key={x.l} style={{ textAlign: "center", background: "#F4F5F7", borderRadius: 6, padding: "10px 20px", minWidth: 100 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: x.c, textTransform: "uppercase" }}>{x.v}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: "0.08em" }}>{x.l}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {sc.description && (
        <Card>
          <SectionLabel>System Description</SectionLabel>
          <MarkupBlock value={sc.description} />
        </Card>
      )}

      {sc.authorizationBoundary.description && (
        <Card>
          <SectionLabel>Authorization Boundary</SectionLabel>
          <MarkupBlock value={sc.authorizationBoundary.description} />
        </Card>
      )}

      {sc.props.length > 0 && (
        <Card>
          <SectionLabel>Properties ({sc.props.length})</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sc.props.map((p, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: radii.sm,
                background: "#EEF2F8", color: colors.navy, fontFamily: fonts.mono,
              }}>
                {p.name}: {p.value}
              </span>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function SystemImplementationView({ ssp, navigate }: { ssp: SspParsed; navigate: (id: string) => void }) {
  const si = ssp.systemImplementation;
  return (
    <>
      <Card>
        <SectionLabel>System Implementation</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: "0 0 14px" }}>
          Components, users, inventory items, and leveraged authorizations for this system.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatChip value={si.components.length} label="Components" color={colors.cobalt} />
          <StatChip value={si.users.length} label="Users" color={colors.brightBlue} />
          <StatChip value={si.inventoryItems.length} label="Inventory" color={colors.darkGreen} />
          {si.leveragedAuthorizations.length > 0 && (
            <StatChip value={si.leveragedAuthorizations.length} label="Leveraged" color={colors.purple} />
          )}
        </div>
      </Card>

      {/* Component quick list */}
      <Card>
        <SectionLabel>Components ({si.components.length})</SectionLabel>
        {si.components.slice(0, 10).map((c) => (
          <div key={c.uuid} onClick={() => navigate(`sys-impl-components`)} style={{
            padding: "6px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <IcoCube size={13} style={{ color: colors.cobalt, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{c.title || c.uuid.slice(0, 8)}</span>
            <span style={{ fontSize: 11, color: colors.gray, marginLeft: "auto" }}>{c.type}</span>
          </div>
        ))}
        {si.components.length > 10 && (
          <p style={{ fontSize: 11, color: colors.gray, marginTop: 6 }}>
            + {si.components.length - 10} more — click "Components" in sidebar
          </p>
        )}
      </Card>
    </>
  );
}

function ComponentsView({ ssp }: { ssp: SspParsed }) {
  const comps = ssp.systemImplementation.components;
  return (
    <>
      <Card>
        <SectionLabel>Components ({comps.length})</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          All components defined in the system implementation.
        </p>
      </Card>
      {comps.map((c) => (
        <Card key={c.uuid}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <IcoCube size={15} style={{ color: colors.cobalt }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.navy, margin: 0 }}>{c.title}</h3>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: "#EEF2F8", color: colors.navy, fontFamily: fonts.mono, marginLeft: "auto" }}>{c.type}</span>
            {c.status && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: c.status === "operational" ? "#E6F3F0" : "#FFF0E6", color: c.status === "operational" ? colors.darkGreen : colors.orange, fontWeight: 600 }}>
                {c.status}
              </span>
            )}
          </div>
          {c.description && <MarkupBlock value={c.description} style={{ fontSize: 12.5 }} />}
          {c.props.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {c.props.map((p, i) => (
                <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 2, background: colors.bg, color: colors.gray, fontFamily: fonts.mono }}>
                  {p.name}: {p.value}
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

function UsersView({ ssp }: { ssp: SspParsed }) {
  const users = ssp.systemImplementation.users;
  return (
    <>
      <Card>
        <SectionLabel>Users ({users.length})</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          System users and their authorized privileges.
        </p>
      </Card>
      {users.map((u) => (
        <Card key={u.uuid}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: colors.navy, margin: "0 0 4px" }}>
            {u.title || u.uuid.slice(0, 12)}
          </h4>
          {u.description && <MarkupBlock value={u.description} style={{ fontSize: 12.5, marginBottom: 6 }} />}
          {u.roleIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
              {u.roleIds.map((r) => (
                <span key={r} style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: "#EEF2F8", color: colors.navy, fontFamily: fonts.mono }}>{r}</span>
              ))}
            </div>
          )}
          {u.authorizedPrivileges.map((ap, i) => (
            <div key={i} style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.darkGreen }}>{ap.title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                {ap.functionsPerformed.map((f, j) => (
                  <span key={j} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: "#E6F3F0", color: colors.darkGreen, fontFamily: fonts.mono }}>{f}</span>
                ))}
              </div>
            </div>
          ))}
        </Card>
      ))}
    </>
  );
}

function InventoryView({ ssp }: { ssp: SspParsed }) {
  const items = ssp.systemImplementation.inventoryItems;
  const compMap = useMemo(() => {
    const m: Record<string, string> = {};
    ssp.systemImplementation.components.forEach((c) => { m[c.uuid] = c.title || c.uuid.slice(0, 8); });
    return m;
  }, [ssp]);
  return (
    <>
      <Card>
        <SectionLabel>Inventory Items ({items.length})</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          Hardware, software, and services in the system inventory.
        </p>
      </Card>
      {items.map((ii) => {
        const assetType = ii.props.find((p) => p.name === "asset-type")?.value;
        return (
          <Card key={ii.uuid}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <IcoBox size={13} style={{ color: colors.darkGreen }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>
                {ii.props.find((p) => p.name === "asset-id")?.value || ii.uuid.slice(0, 12)}
              </span>
              {assetType && (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: "#EEF2F8", color: colors.navy, fontFamily: fonts.mono, marginLeft: "auto" }}>{assetType}</span>
              )}
            </div>
            {ii.description && <MarkupBlock value={ii.description} style={{ fontSize: 12, marginBottom: 4 }} />}
            {ii.implementedComponents.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {ii.implementedComponents.map((ic) => (
                  <span key={ic.componentUuid} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 2, background: "#F0F4FF", color: colors.cobalt, fontFamily: fonts.mono }}>
                    {compMap[ic.componentUuid] || ic.componentUuid.slice(0, 8)}
                  </span>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}

function LeveragedView({ ssp }: { ssp: SspParsed }) {
  const items = ssp.systemImplementation.leveragedAuthorizations;
  const partyMap = useMemo(() => {
    const m: Record<string, string> = {};
    ssp.metadata.parties.forEach((p) => { m[p.uuid] = p.name; });
    return m;
  }, [ssp]);
  return (
    <>
      <Card>
        <SectionLabel>Leveraged Authorizations ({items.length})</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          External systems whose authorizations are leveraged.
        </p>
      </Card>
      {items.map((la) => (
        <Card key={la.uuid}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: colors.navy, margin: "0 0 4px" }}>{la.title}</h4>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <MField label="Provider" value={partyMap[la.partyUuid] || la.partyUuid.slice(0, 12)} />
            {la.dateAuthorized && <MField label="Authorized" value={fmtDate(la.dateAuthorized)} />}
          </div>
        </Card>
      ))}
    </>
  );
}

function ControlImplementationView({ ssp, navigate }: { ssp: SspParsed; navigate: (id: string) => void }) {
  const ci = ssp.controlImplementation;
  /* Group by family */
  const families = useMemo(() => {
    const map: Record<string, ImplementedRequirement[]> = {};
    ci.implementedRequirements.forEach((ir) => {
      const fam = getFamily(ir.controlId);
      (map[fam] ??= []).push(ir);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [ci]);
  return (
    <>
      <Card>
        <SectionLabel>Control Implementation</SectionLabel>
        {ci.description && <MarkupBlock value={ci.description} style={{ marginBottom: 12 }} />}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <StatChip value={families.length} label="Families" color={colors.cobalt} />
          <StatChip value={ci.implementedRequirements.length} label="Controls" color={colors.orange} />
          <StatChip value={ci.implementedRequirements.reduce((n, r) => n + r.statements.length, 0)} label="Statements" color={colors.darkGreen} />
        </div>
      </Card>
      {families.map(([fam, reqs]) => (
        <Card key={fam}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}
            onClick={() => navigate(`ctrl-family-${fam}`)}>
            <IcoFolder size={14} style={{ color: colors.cobalt }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{fam.toUpperCase()}</span>
            <span style={{ fontSize: 12, color: colors.gray }}>{FAMILY_NAMES[fam] || fam}</span>
            <span style={S.badge}>{reqs.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {reqs.map((ir) => (
              <button key={ir.uuid}
                onClick={() => navigate(`ctrl-${ir.controlId}`)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: radii.sm, fontSize: 11, fontWeight: 600,
                  fontFamily: fonts.mono, border: `1px solid ${colors.orange}`, background: "#FFF8F0",
                  color: colors.orange, cursor: "pointer", transition: "all .12s",
                }}>
                <IcoShield size={10} />{ir.controlId.toUpperCase()}
              </button>
            ))}
          </div>
        </Card>
      ))}
    </>
  );
}

function ControlFamilyView({ familyId, ssp, navigate }: { familyId: string; ssp: SspParsed; navigate: (id: string) => void }) {
  const familyControls = useMemo(() => {
    return ssp.controlImplementation.implementedRequirements.filter(
      (ir) => getFamily(ir.controlId) === familyId,
    );
  }, [ssp, familyId]);
  const familyLabel = FAMILY_NAMES[familyId] || familyId.toUpperCase();

  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <IcoFolder size={18} style={{ color: colors.cobalt }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.navy, margin: 0 }}>
            {familyId.toUpperCase()} — {familyLabel}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatChip value={familyControls.length} label="Controls" color={colors.orange} />
          <StatChip value={familyControls.reduce((n, r) => n + r.statements.length, 0)} label="Statements" color={colors.cobalt} />
        </div>
      </Card>
      {familyControls.map((ir) => (
        <Card key={ir.uuid}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            onClick={() => navigate(`ctrl-${ir.controlId}`)}>
            <IcoShield size={14} style={{ color: colors.orange }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.navy, fontFamily: fonts.mono }}>{ir.controlId.toUpperCase()}</span>
            {ir.statements.length > 0 && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.sm, background: colors.bg, color: colors.gray }}>
                {ir.statements.length} stmt{ir.statements.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {ir.description && <MarkupBlock value={ir.description} style={{ fontSize: 12.5, marginTop: 4 }} />}
          {ir.props.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {ir.props.map((p, i) => (
                <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 2, background: colors.bg, color: colors.gray, fontFamily: fonts.mono }}>
                  {p.name}: {p.value}
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

function ControlDetailView({ ir, ssp, catalog }: { ir: ImplementedRequirement; ssp: SspParsed; catalog: OscalCatalog | null }) {
  const compMap = useMemo(() => {
    const m: Record<string, string> = {};
    ssp.systemImplementation.components.forEach((c) => { m[c.uuid] = c.title || c.uuid.slice(0, 8); });
    return m;
  }, [ssp]);

  /* Catalog enrichment */
  const catalogControl = useMemo(
    () => findCatalogControl(catalog, ir.controlId),
    [catalog, ir],
  );
  const catalogParamMap = useMemo(
    () => catalogControl ? buildCatalogParamMap(catalog, catalogControl) : {},
    [catalog, catalogControl],
  );

  /* Gather all unique components across by-components + statement by-components */
  const allComponents = useMemo(() => {
    const seen = new Set<string>();
    const list: { uuid: string; title: string }[] = [];
    const addComp = (compUuid: string) => {
      if (!seen.has(compUuid)) {
        seen.add(compUuid);
        list.push({ uuid: compUuid, title: compMap[compUuid] || compUuid.slice(0, 12) });
      }
    };
    ir.byComponents.forEach((bc) => addComp(bc.componentUuid));
    ir.statements.forEach((st) => st.byComponents.forEach((bc) => addComp(bc.componentUuid)));
    return list;
  }, [ir, compMap]);

  const [activeCompUuid, setActiveCompUuid] = useState<string>(allComponents[0]?.uuid ?? "");

  /* Status from props */
  const status = ir.props.find((p) => p.name === "implementation-status")?.value ?? "unknown";
  const familyLabel = FAMILY_NAMES[getFamily(ir.controlId)] || "";

  return (
    <>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <IcoTag size={20} style={{ color: colors.orange }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.navy, margin: 0 }}>
            {ir.controlId.toUpperCase()}{familyLabel ? ` ${familyLabel}` : ""}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{ir.uuid}</span>
          <StatusBadge status={status} />
        </div>
      </Card>

      {/* Catalog Control Card or notice */}
      {catalogControl ? (
        <CatalogControlCard control={catalogControl} paramMap={catalogParamMap} />
      ) : (
        <Card style={{ backgroundColor: "#FFF8F0", borderLeft: `4px solid ${colors.orange}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📙</span>
            <span style={{ fontSize: 13, color: colors.black }}>
              <strong>Catalog not loaded.</strong> Load an OSCAL catalog to see control prose for {ir.controlId.toUpperCase()}.
            </span>
          </div>
        </Card>
      )}

      {/* Implementation Description */}
      {ir.description && (
        <Card>
          <SectionLabel>Implementation Description</SectionLabel>
          <MarkupBlock value={ir.description} />
        </Card>
      )}

      {/* Component-level implementations */}
      {allComponents.length > 0 && (
        <Card>
          <SectionLabel>Control Level Implementations ({allComponents.length} component{allComponents.length !== 1 ? "s" : ""})</SectionLabel>

          {/* Component tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${colors.paleGray}`, marginBottom: 16 }}>
            {allComponents.map((comp) => {
              const isActive = comp.uuid === activeCompUuid;
              return (
                <button key={comp.uuid} onClick={() => setActiveCompUuid(comp.uuid)} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "8px 16px", fontSize: 12, fontWeight: isActive ? 700 : 500,
                  color: isActive ? colors.cobalt : colors.gray,
                  background: isActive ? alpha(colors.cobalt, 4) : "transparent",
                  border: "none", borderBottom: isActive ? `2px solid ${colors.cobalt}` : "2px solid transparent",
                  cursor: "pointer", transition: "all .12s", marginBottom: -2, fontFamily: fonts.sans,
                }}>
                  <IcoCube size={12} style={{ color: isActive ? colors.cobalt : colors.gray }} />
                  {comp.title}
                </button>
              );
            })}
          </div>

          {/* Active component content */}
          {(() => {
            const compUuid = activeCompUuid;

            /* Requirement-level by-component for this component */
            const reqBc = ir.byComponents.find((bc) => bc.componentUuid === compUuid);

            /* Statement-level by-components for this component */
            const stmtEntries = ir.statements
              .map((st) => {
                const bc = st.byComponents.find((b) => b.componentUuid === compUuid);
                return bc ? { statement: st, bc } : null;
              })
              .filter(Boolean) as { statement: SspStatement; bc: { componentUuid: string; uuid: string; description: string } }[];

            return (
              <div>
                {/* Requirement-level description for this component */}
                {reqBc?.description && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: colors.cobalt, letterSpacing: 0.5, marginBottom: 6 }}>
                      Component Implementation
                    </div>
                    <MarkupBlock value={reqBc.description} style={{ fontSize: 13 }} />
                  </div>
                )}

                {/* Statements for this component */}
                {stmtEntries.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: colors.cobalt, letterSpacing: 0.5, marginBottom: 6 }}>
                      Statements ({stmtEntries.length})
                    </div>
                    {stmtEntries.map(({ statement: st, bc }) => {
                      const catalogPart = catalogControl
                        ? findPartById(catalogControl.parts ?? [], st.statementId)
                        : undefined;
                      return (
                        <div key={st.uuid} style={{ backgroundColor: colors.bg, borderRadius: radii.sm, padding: "12px 16px", marginBottom: 8 }}>
                          {/* Show catalog prose for this statement part if available */}
                          {catalogPart?.prose ? (
                            <div style={{
                              fontSize: 12, color: colors.cobalt, lineHeight: 1.7,
                              padding: "6px 10px", backgroundColor: alpha(colors.cobalt, 3),
                              border: `1px solid ${alpha(colors.cobalt, 13)}`, borderRadius: radii.sm,
                              marginBottom: 8, fontStyle: "italic",
                            }}>
                              <CatalogProseWithParams text={catalogPart.prose} paramMap={catalogParamMap} />
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, fontWeight: 600, color: colors.brightBlue, fontFamily: fonts.mono, marginBottom: 4 }}>
                              {st.statementId}
                            </div>
                          )}
                          {/* Component's implementation for this statement */}
                          {bc.description && <MarkupBlock value={bc.description} />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!reqBc?.description && stmtEntries.length === 0 && (
                  <p style={{ fontSize: 13, color: colors.gray, fontStyle: "italic" }}>No implementation details for this component.</p>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Links */}
      {ir.links.length > 0 && (
        <Card>
          <LinkChips
            links={ir.links.map((l) => {
              const frag = (l as { "resource-fragment"?: string })["resource-fragment"];
              const baseText = l.text || (l.rel === "mitre" ? (l.href.split("/").pop() ?? l.href) : l.href);
              const text = frag ? `${baseText} \u2014 ${frag}` : baseText;
              return { text, href: l.href, rel: l.rel };
            })}
          />
        </Card>
      )}

      {/* Responsible Roles */}
      {ir.responsibleRoles.length > 0 && (
        <Card>
          <SectionLabel>Responsible Roles</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ir.responsibleRoles.map((rr, i) => (
              <span key={i} style={{
                fontSize: 12, padding: "4px 12px", borderRadius: radii.pill,
                backgroundColor: colors.navy, color: colors.white, fontWeight: 500,
              }}>
                {rr.roleId}
                {rr.partyUuids.length > 0 && (() => {
                  const partyMap: Record<string, string> = {};
                  ssp.metadata.parties.forEach((p) => { partyMap[p.uuid] = p.name; });
                  return rr.partyUuids.map((pu) => {
                    const name = partyMap[pu];
                    return name ? ` (${name})` : "";
                  }).join("");
                })()}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Props */}
      {ir.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {ir.props.map((p, i) => (
              <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 2, background: colors.bg, color: colors.gray, fontFamily: fonts.mono }}>
                {p.name}: {p.value}
              </span>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function BackMatterView({ ssp }: { ssp: SspParsed }) {
  const resources = ssp.backMatter;
  return (
    <>
      <Card>
        <SectionLabel>Back Matter — Resources ({resources.length})</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          Attached documents, policies, diagrams, and reference materials.
        </p>
      </Card>
      {resources.map((r) => (
        <Card key={r.uuid}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <IcoBook size={13} style={{ color: colors.gray }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{r.title || r.uuid.slice(0, 12)}</span>
          </div>
          {r.description && <MarkupBlock value={r.description} style={{ fontSize: 12 }} />}
          {r.rlinks && r.rlinks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {r.rlinks.map((rl, i) => (
                <a key={i} href={rl.href} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10.5, color: colors.cobalt, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <IcoLink size={10} />{trunc(rl.href, 60)}
                </a>
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

function NotFoundView({ view }: { view: string }) {
  return (
    <Card>
      <p style={{ fontSize: 14, color: colors.gray }}>View not found: <strong>{view}</strong></p>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW ROUTER
   ═══════════════════════════════════════════════════════════════════════════ */

interface ViewRouterProps {
  view: string;
  ssp: SspParsed;
  navigate: (id: string) => void;
  catalog: OscalCatalog | null;
}

function ViewRouter({ view, ssp, navigate, catalog }: ViewRouterProps) {
  if (view === "overview") return <OverviewView ssp={ssp} />;
  if (view === "metadata") return <MetadataView ssp={ssp} />;
  if (view === "sys-char") return <SystemCharacteristicsView ssp={ssp} />;
  if (view === "sys-impl") return <SystemImplementationView ssp={ssp} navigate={navigate} />;
  if (view === "sys-impl-components") return <ComponentsView ssp={ssp} />;
  if (view === "sys-impl-users") return <UsersView ssp={ssp} />;
  if (view === "sys-impl-inventory") return <InventoryView ssp={ssp} />;
  if (view === "sys-impl-leveraged") return <LeveragedView ssp={ssp} />;
  if (view === "ctrl-impl") return <ControlImplementationView ssp={ssp} navigate={navigate} />;
  if (view === "back-matter") return <BackMatterView ssp={ssp} />;

  /* ctrl-family-<prefix> — family group view */
  const famMatch = view.match(/^ctrl-family-(.+)$/);
  if (famMatch) {
    return <ControlFamilyView familyId={famMatch[1]} ssp={ssp} navigate={navigate} />;
  }

  /* ctrl-<control-id> */
  const ctrlMatch = view.match(/^ctrl-(.+)$/);
  if (ctrlMatch) {
    const controlId = ctrlMatch[1];
    const ir = ssp.controlImplementation.implementedRequirements.find(
      (r) => r.controlId === controlId,
    );
    if (ir) return <ControlDetailView ir={ir} ssp={ssp} catalog={catalog} />;
  }

  return <NotFoundView view={view} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SspPage() {
  const oscal = useOscal();
  const raw = oscal.ssp?.data ?? null;
  const fileName = oscal.ssp?.fileName ?? "";

  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const contentRef = useRef<HTMLDivElement>(null);

  /* ── Auto-load from ?url= query param ── */
  const urlDoc = useUrlDocument();
  useEffect(() => {
    if (!urlDoc.json || oscal.ssp) return;
    try {
      const inner = (urlDoc.json as Record<string, unknown>)["system-security-plan"] ?? urlDoc.json;
      if (!(inner as Record<string, unknown>).metadata)
        throw new Error("Not a valid OSCAL SSP — missing metadata.");
      oscal.setSsp(urlDoc.json, fileNameFromUrl(urlDoc.sourceUrl!));
      setView("overview");
      setCollapsed({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse fetched document");
    }
  }, [urlDoc.json]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Parse ── */
  const ssp = useMemo<SspParsed | null>(() => {
    if (!raw) return null;
    try { return parseSsp(raw); }
    catch { return null; }
  }, [raw]);

  /* ── Load file ── */
  const loadFile = useCallback((file: File) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const inner = json["system-security-plan"] ?? json;
        if (!inner.metadata) throw new Error("Not a valid OSCAL SSP — missing metadata.");
        oscal.setSsp(json, file.name);
        setView("overview");
        setCollapsed({});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse JSON");
      }
    };
    reader.readAsText(file);
  }, [oscal]);

  const handleNewFile = useCallback(() => {
    oscal.clearSsp();
    setError("");
    setView("overview");
  }, [oscal]);

  /* ── Navigate ── */
  const navigate = useCallback((id: string) => {
    setView(id);
    contentRef.current?.scrollTo(0, 0);
  }, []);

  /* ── Nav tree ── */
  const navTree = useMemo<NavItem[]>(() => {
    if (!ssp) return [];
    const items: NavItem[] = [];
    const si = ssp.systemImplementation;
    const ci = ssp.controlImplementation;

    items.push({ id: "overview", label: "Overview", icon: "home", color: colors.darkGreen, depth: 0 });
    items.push({ id: "metadata", label: "Metadata", icon: "info", color: colors.navy, depth: 0 });

    /* System Characteristics */
    items.push({ id: "sys-char", label: "System Characteristics", icon: "server", color: colors.darkGreen, depth: 0 });

    /* System Implementation */
    items.push({ id: "sys-impl", label: "System Implementation", icon: "cube", color: colors.cobalt, depth: 0 });
    items.push({ id: "sys-impl-components", label: "Components", icon: "cube", color: colors.cobalt, depth: 1, parent: "sys-impl", childCount: si.components.length });
    items.push({ id: "sys-impl-users", label: "Users", icon: "users", color: colors.brightBlue, depth: 1, parent: "sys-impl", childCount: si.users.length });
    items.push({ id: "sys-impl-inventory", label: "Inventory Items", icon: "box", color: colors.darkGreen, depth: 1, parent: "sys-impl", childCount: si.inventoryItems.length });
    if (si.leveragedAuthorizations.length > 0) {
      items.push({ id: "sys-impl-leveraged", label: "Leveraged Auth.", icon: "link", color: colors.purple, depth: 1, parent: "sys-impl", childCount: si.leveragedAuthorizations.length });
    }

    /* Control Implementation — group by family */
    items.push({ id: "ctrl-impl", label: "Control Implementation", icon: "shield", color: colors.orange, depth: 0 });

    const familyMap: Record<string, ImplementedRequirement[]> = {};
    ci.implementedRequirements.forEach((ir) => {
      const fam = getFamily(ir.controlId);
      (familyMap[fam] ??= []).push(ir);
    });
    const sortedFamilies = Object.entries(familyMap).sort(([a], [b]) => a.localeCompare(b));

    sortedFamilies.forEach(([fam, reqs]) => {
      const famId = `ctrl-family-${fam}`;

      /* Separate base controls from enhancements */
      const baseControls: ImplementedRequirement[] = [];
      const enhancementMap: Record<string, ImplementedRequirement[]> = {};
      const controlIdSet = new Set(reqs.map((r) => r.controlId));

      reqs.forEach((ir) => {
        const parentId = getParentControlId(ir.controlId);
        if (parentId && controlIdSet.has(parentId)) {
          (enhancementMap[parentId] ??= []).push(ir);
        } else {
          baseControls.push(ir);
        }
      });

      items.push({
        id: famId,
        label: `${fam.toUpperCase()} — ${FAMILY_NAMES[fam] || fam}`,
        icon: "folder",
        color: colors.cobalt,
        depth: 1,
        parent: "ctrl-impl",
        childCount: baseControls.length,
      });

      baseControls.forEach((ir) => {
        const ctrlId = `ctrl-${ir.controlId}`;
        const enhancements = enhancementMap[ir.controlId] ?? [];
        items.push({
          id: ctrlId,
          label: ir.controlId.toUpperCase(),
          icon: "shield",
          color: colors.orange,
          depth: 2,
          parent: famId,
          childCount: enhancements.length || undefined,
        });
        enhancements.forEach((enh) => {
          items.push({
            id: `ctrl-${enh.controlId}`,
            label: enh.controlId.toUpperCase(),
            icon: "tag",
            color: colors.orange,
            depth: 3,
            parent: ctrlId,
          });
        });
      });
    });

    /* Back matter */
    items.push({ id: "back-matter", label: "Back Matter", icon: "book", color: colors.gray, depth: 0, childCount: ssp.backMatter.length || undefined });

    return items;
  }, [ssp]);

  /* ── Child counts ── */
  const childCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    navTree.forEach((item) => {
      if (item.parent) counts[item.parent] = (counts[item.parent] ?? 0) + 1;
    });
    return counts;
  }, [navTree]);

  /* ── Default all groups to collapsed when navTree first populates ── */
  const defaultCollapsed = useMemo(() => {
    const dc: Record<string, boolean> = {};
    const parentSet = new Set(navTree.filter((n) => n.parent).map((n) => n.parent!));
    parentSet.forEach((id) => { dc[id] = true; });
    return dc;
  }, [navTree]);

  const mergedCollapsed = useMemo(() => {
    return { ...defaultCollapsed, ...collapsed };
  }, [defaultCollapsed, collapsed]);

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => {
      const current = prev[id] ?? defaultCollapsed[id] ?? false;
      return { ...prev, [id]: !current };
    });
  }, [defaultCollapsed]);

  /* ── Visible items (collapse) ── */
  const visibleNav = useMemo(() => {
    return navTree.filter((item) => {
      if (!item.parent) return true;
      let pid: string | undefined = item.parent;
      while (pid) {
        if (mergedCollapsed[pid]) return false;
        const parentItem = navTree.find((n) => n.id === pid);
        pid = parentItem?.parent;
      }
      return true;
    });
  }, [navTree, mergedCollapsed]);

  /* ── No data — drop zone ── */
  if (!ssp) {
    return (
      <div style={S.emptyWrap}>
        {urlDoc.isLoading
          ? <div style={{ textAlign: "center", padding: 48 }}>
              <p style={{ fontSize: 15, color: colors.gray }}>Loading document from URL…</p>
            </div>
          : <DropZone onFile={loadFile} error={urlDoc.error || error} />}
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <div style={S.shell}>
      {/* Top Bar */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.appName} style={{ height: 22 }} />
            : <div style={S.topBarLogo}>{brand.logoText}</div>}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>OSCAL System Security Plan Viewer</div>
            <div style={{ fontSize: 11, color: colors.paleGray }}>{brand.tagline}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.topBtn} onClick={handleNewFile}>New File</button>
        </div>
      </div>

      <div style={S.body}>
        {/* SIDEBAR */}
        <nav style={S.sidebar}>
          <div style={S.sidebarFilename}>{trunc(fileName, 40)}</div>
          {visibleNav.map((item) => {
            const hasChildren = !!childCounts[item.id];
            const isActive = view === item.id;
            const isCollapsed = !!mergedCollapsed[item.id];

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (hasChildren) toggleGroup(item.id);
                  navigate(item.id);
                }}
                style={{
                  ...S.navItem,
                  paddingLeft: 12 + item.depth * 16,
                  backgroundColor: isActive ? alpha(colors.orange, 7) : "transparent",
                  borderLeft: isActive ? `3px solid ${colors.orange}` : "3px solid transparent",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? colors.orange : colors.black,
                }}
              >
                {hasChildren && <IcoChev open={!isCollapsed} style={{ marginRight: 4 }} />}
                {navIcon(item.icon, isActive ? colors.orange : item.color)}
                <span style={{
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.label}
                </span>
                {item.childCount != null && <span style={S.badge}>{item.childCount}</span>}
              </div>
            );
          })}
        </nav>

        {/* CONTENT */}
        <div ref={contentRef} style={S.content}>
          <ViewRouter view={view} ssp={ssp} navigate={navigate} catalog={(oscal.catalog?.data as OscalCatalog) ?? null} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const S: Record<string, CSSProperties> = {
  emptyWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" },
  shell: {
    display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", overflow: "hidden",
    borderRadius: radii.md, border: `1px solid ${colors.paleGray}`, backgroundColor: colors.bg,
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
    height: 48, backgroundColor: colors.darkNavy, color: colors.white, flexShrink: 0,
    borderRadius: `${radii.md}px ${radii.md}px 0 0`,
  },
  topBarLeft: { display: "flex", alignItems: "center", gap: 10 },
  topBarLogo: {
    display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
    borderRadius: radii.sm, backgroundColor: colors.orange, color: colors.white,
    fontSize: 12, fontWeight: 800, fontFamily: fonts.sans,
  },
  topBtn: {
    fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: radii.sm,
    border: "none", cursor: "pointer", backgroundColor: colors.orange, color: colors.white,
  },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: {
    width: 280, minWidth: 280, backgroundColor: colors.white,
    borderRight: `1px solid ${colors.paleGray}`, overflowY: "auto" as const, flexShrink: 0,
  },
  sidebarFilename: {
    fontSize: 10, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.5,
    color: colors.gray, padding: "10px 12px 6px", borderBottom: `1px solid ${colors.bg}`,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
  },
  navItem: {
    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 13,
    cursor: "pointer", transition: "background-color .1s",
    borderBottom: `1px solid ${colors.bg}`, userSelect: "none" as const,
  },
  badge: {
    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: radii.pill,
    backgroundColor: colors.bg, color: colors.gray, marginLeft: "auto",
  },
  content: { flex: 1, overflowY: "auto" as const, padding: 24 },
};
