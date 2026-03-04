/* ═══════════════════════════════════════════════════════════════════════════
   Component Definition Page — SPA-style viewer
   Left sidebar nav · Right content panel · Views swap on click
   Modeled after the reference oscal-cdef-viewer.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import { Marked } from "marked";
import { colors, fonts, shadows, radii } from "../theme/tokens";
import { useOscal } from "../context/OscalContext";
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

interface OscalProp {
  name: string;
  value: string;
  ns?: string;
  class?: string;
}

interface Link {
  href: string;
  rel?: string;
  text?: string;
  "media-type"?: string;
}

interface Party {
  uuid: string;
  type: string;
  name: string;
  "short-name"?: string;
  links?: Link[];
}

interface ResponsibleParty {
  "role-id": string;
  "party-uuids": string[];
}

interface Role {
  id: string;
  title: string;
}

interface Metadata {
  title: string;
  version?: string;
  "last-modified"?: string;
  "oscal-version"?: string;
  parties?: Party[];
  roles?: Role[];
  "responsible-parties"?: ResponsibleParty[];
  props?: OscalProp[];
}

interface Statement {
  "statement-id": string;
  uuid: string;
  description?: string | { prose: string };
  props?: OscalProp[];
}

interface ImplementedRequirement {
  uuid: string;
  "control-id": string;
  description?: string | { prose: string };
  props?: OscalProp[];
  statements?: Statement[];
  links?: Link[];
  "responsible-roles"?: { "role-id": string; "party-uuids"?: string[] }[];
}

interface ControlImplementation {
  uuid: string;
  description?: string | { prose: string };
  source: string;
  "implemented-requirements": ImplementedRequirement[];
}

interface Component {
  uuid: string;
  type: string;
  title: string;
  description?: string | { prose: string };
  purpose?: string | { prose: string };
  props?: OscalProp[];
  "control-implementations"?: ControlImplementation[];
  "responsible-roles"?: { "role-id": string; "party-uuids"?: string[] }[];
}

interface Resource {
  uuid: string;
  title?: string;
  description?: string | { prose: string };
  props?: OscalProp[];
  rlinks?: { href: string; "media-type"?: string }[];
}

interface ComponentDefinition {
  uuid: string;
  metadata: Metadata;
  components?: Component[];
  "back-matter"?: { resources?: Resource[] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const FAMILIES: Record<string, string> = {
  AC: "Access Control", AT: "Awareness and Training", AU: "Audit and Accountability",
  CA: "Assessment, Authorization, and Monitoring", CM: "Configuration Management",
  CP: "Contingency Planning", IA: "Identification and Authentication",
  IR: "Incident Response", MA: "Maintenance", MP: "Media Protection",
  PE: "Physical and Environmental Protection", PL: "Planning", PM: "Program Management",
  PS: "Personnel Security", PT: "PII Processing and Transparency", RA: "Risk Assessment",
  SA: "System and Services Acquisition", SC: "System and Communications Protection",
  SI: "System and Information Integrity", SR: "Supply Chain Risk Management",
};

const RES_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  "azure-documentation": { label: "Azure Docs", color: colors.cobalt, icon: "cloud" },
  standards: { label: "Standards", color: colors.navy, icon: "book" },
  "iac-tooling": { label: "IaC Tooling", color: colors.mint, icon: "code" },
  "threat-intelligence": { label: "Threat Intel", color: colors.red, icon: "target" },
};

function familyOf(id: string) {
  const m = (id || "").match(/^([a-z]{2})-/i);
  return m ? m[1].toUpperCase() : "??";
}
function familyName(id: string) {
  return FAMILIES[familyOf(id)] ?? familyOf(id);
}
function txt(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "prose" in v)
    return String((v as { prose: unknown }).prose);
  return String(v);
}
function fmtDate(s?: string) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return s;
  }
}
function partyName(uuid: string, parties: Party[]) {
  const p = parties.find((x) => x.uuid === uuid);
  return p ? p.name : uuid ? uuid.slice(0, 8) : "Unknown";
}
function resType(res: Resource) {
  const tp = (res.props ?? []).find((p) => p.name === "type");
  return tp ? tp.value : "other";
}
function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}

/* ── Catalog lookup helpers ── */

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
  // If this is an enhancement, also include parent params
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

/** Convert OSCAL markup-multiline / markup-line to HTML via marked */
const markedInstance = new Marked({ async: false, gfm: true, breaks: false });
function renderMarkup(text: string): string {
  // marked.parse in sync mode returns string
  const html = markedInstance.parse(text) as string;
  // Strip wrapping <p>…</p> for single-line content to avoid extra spacing
  const trimmed = html.trim();
  if (trimmed.startsWith("<p>") && trimmed.endsWith("</p>") && trimmed.indexOf("<p>", 1) === -1) {
    return trimmed.slice(3, -4);
  }
  return trimmed;
}

/** Renders an OSCAL description / prose value as styled HTML (markdown) */
function MarkupBlock({ value, style }: { value: unknown; style?: CSSProperties }) {
  const raw = txt(value);
  if (!raw) return null;
  const html = renderMarkup(raw);
  return (
    <div
      className="oscal-markup"
      style={{
        fontSize: 13,
        color: colors.black,
        lineHeight: 1.75,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE SVG ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconProps {
  size?: number;
  style?: CSSProperties;
}

function IcoUpload({ size = 20, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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
    <svg
      style={{
        ...style,
        transform: open ? "rotate(90deg)" : "rotate(0)",
        transition: "transform .15s",
        flexShrink: 0,
      }}
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IcoBook({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}
function IcoCube({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
function IcoLayers({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function IcoHome({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IcoInfo({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function IcoLink({ size = 14, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
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
function IcoTarget({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function IcoCode({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function IcoCloud({ size = 16, style }: IconProps) {
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  );
}

function resIcon(type: string, size = 13, style?: CSSProperties) {
  if (type === "cloud") return <IcoCloud size={size} style={style} />;
  if (type === "code") return <IcoCode size={size} style={style} />;
  if (type === "target") return <IcoTarget size={size} style={style} />;
  return <IcoBook size={size} style={style} />;
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
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ComponentDefinitionPage() {
  const oscal = useOscal();
  const cdef = (oscal.componentDefinition?.data as ComponentDefinition) ?? null;
  const fileName = oscal.componentDefinition?.fileName ?? "";
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const contentRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback(
    (id: string) => {
      setView(id);
      contentRef.current?.scrollTo(0, 0);
    },
    [],
  );

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const loadFile = useCallback((file: File) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const data = json["component-definition"] ?? json;
        if (!data.metadata)
          throw new Error("Not an OSCAL component-definition — no metadata found.");
        oscal.setComponentDefinition(data as ComponentDefinition, file.name);
        setView("overview");
        setCollapsed({});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse JSON");
      }
    };
    reader.readAsText(file);
  }, [oscal]);

  const handleNewFile = useCallback(() => {
    oscal.clearComponentDefinition();
    setError("");
    setView("overview");
  }, [oscal]);

  /* ── Resources map for link resolution ── */
  const bmRes = useMemo(() => cdef?.["back-matter"]?.resources ?? [], [cdef]);
  const resMap = useMemo(() => {
    const m: Record<string, Resource> = {};
    bmRes.forEach((r) => {
      m[r.uuid] = r;
    });
    return m;
  }, [bmRes]);

  /* ── Build navigation tree ── */
  const navTree = useMemo<NavItem[]>(() => {
    if (!cdef) return [];
    const items: NavItem[] = [];

    items.push({ id: "overview", label: "Overview", icon: "home", color: colors.navy, depth: 0 });
    items.push({ id: "metadata", label: "Metadata", icon: "info", color: colors.navy, depth: 0 });

    const comps = cdef.components ?? [];
    comps.forEach((comp, ci) => {
      const compId = `comp-${ci}`;
      items.push({ id: compId, label: comp.title, icon: "cube", color: colors.cobalt, depth: 0 });

      const impls = comp["control-implementations"] ?? [];
      impls.forEach((impl, ii) => {
        const implId = `comp-${ci}-ci-${ii}`;
        const reqCount = impl["implemented-requirements"].length;
        items.push({
          id: implId,
          label: `Control Impl. ${ii + 1}`,
          icon: "layers",
          color: colors.brightBlue,
          depth: 1,
          parent: compId,
          childCount: reqCount,
        });

        impl["implemented-requirements"].forEach((req) => {
          items.push({
            id: `req-${req.uuid}`,
            label: req["control-id"].toUpperCase(),
            icon: "shield",
            color: colors.orange,
            depth: 2,
            parent: implId,
          });
        });
      });
    });

    // References grouped by type
    if (bmRes.length > 0) {
      const grouped: Record<string, Resource[]> = {};
      bmRes.forEach((r) => {
        const t = resType(r);
        (grouped[t] ??= []).push(r);
      });

      items.push({
        id: "references",
        label: `References (${bmRes.length})`,
        icon: "book",
        color: colors.navy,
        depth: 0,
      });

      Object.entries(grouped).forEach(([type, resources]) => {
        const meta = RES_TYPE_META[type] ?? { label: type, color: colors.gray, icon: "book" };
        const groupId = `res-group-${type}`;
        items.push({
          id: groupId,
          label: `${meta.label} (${resources.length})`,
          icon: meta.icon,
          color: meta.color,
          depth: 1,
          parent: "references",
          childCount: resources.length,
        });

        resources.forEach((r) => {
          items.push({
            id: `res-${r.uuid}`,
            label: trunc(r.title ?? "Untitled", 28),
            icon: meta.icon,
            color: meta.color,
            depth: 2,
            parent: groupId,
          });
        });
      });
    }

    return items;
  }, [cdef, bmRes]);

  /* ── Child counts for groups ── */
  const childCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    navTree.forEach((item) => {
      if (item.parent) {
        counts[item.parent] = (counts[item.parent] ?? 0) + 1;
      }
    });
    return counts;
  }, [navTree]);

  /* ── Visible nav items (collapse logic) ── */
  const visibleNav = useMemo(() => {
    return navTree.filter((item) => {
      if (!item.parent) return true;
      let pid: string | undefined = item.parent;
      while (pid) {
        if (collapsed[pid]) return false;
        const parentItem = navTree.find((n) => n.id === pid);
        pid = parentItem?.parent;
      }
      return true;
    });
  }, [navTree, collapsed]);

  /* ── If no file loaded, show drop zone ── */
  if (!cdef) {
    return (
      <div style={S.emptyWrap}>
        <DropZone onFile={loadFile} error={error} />
      </div>
    );
  }

  /* ── Nav icon resolver ── */
  function navIcon(icon: string, color: string, size = 14): ReactNode {
    const st: CSSProperties = { color, flexShrink: 0 };
    switch (icon) {
      case "home":
        return <IcoHome size={size} style={st} />;
      case "info":
        return <IcoInfo size={size} style={st} />;
      case "cube":
        return <IcoCube size={size} style={st} />;
      case "layers":
        return <IcoLayers size={size} style={st} />;
      case "shield":
        return <IcoShield size={size} style={st} />;
      case "book":
        return <IcoBook size={size} style={st} />;
      case "cloud":
        return <IcoCloud size={size} style={st} />;
      case "code":
        return <IcoCode size={size} style={st} />;
      case "target":
        return <IcoTarget size={size} style={st} />;
      default:
        return <IcoBook size={size} style={st} />;
    }
  }

  const parties = cdef.metadata.parties ?? [];

  return (
    <div style={S.shell}>
      {/* ── TOP BAR ── */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          <div style={S.topBarLogo}>ED</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>
              OSCAL Component Definition Viewer
            </div>
            <div style={{ fontSize: 11, color: colors.paleGray }}>Easy Dynamics</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.topBtn} onClick={handleNewFile}>
            New File
          </button>
        </div>
      </div>

      <div style={S.body}>
        {/* ── LEFT SIDEBAR ── */}
        <nav style={S.sidebar}>
          <div style={S.sidebarFilename}>{trunc(fileName, 36)}</div>
          {visibleNav.map((item) => {
            const hasChildren = !!childCounts[item.id];
            const isActive = view === item.id;
            const isCollapsed = !!collapsed[item.id];

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
                  backgroundColor: isActive ? `${colors.orange}11` : "transparent",
                  borderLeft: isActive
                    ? `3px solid ${colors.orange}`
                    : "3px solid transparent",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? colors.orange : colors.black,
                }}
              >
                {hasChildren && <IcoChev open={!isCollapsed} style={{ marginRight: 4 }} />}
                {navIcon(item.icon, isActive ? colors.orange : item.color)}
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
                {item.childCount != null && <span style={S.badge}>{item.childCount}</span>}
              </div>
            );
          })}
        </nav>

        {/* ── CONTENT PANEL ── */}
        <div ref={contentRef} style={S.content}>
          <ViewRouter
            view={view}
            cdef={cdef}
            navigate={navigate}
            resMap={resMap}
            bmRes={bmRes}
            parties={parties}
            catalog={oscal.catalog?.data ?? null}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW ROUTER — renders only the selected view
   ═══════════════════════════════════════════════════════════════════════════ */

interface ViewRouterProps {
  view: string;
  cdef: ComponentDefinition;
  navigate: (id: string) => void;
  resMap: Record<string, Resource>;
  bmRes: Resource[];
  parties: Party[];
  catalog: OscalCatalog | null;
}

function ViewRouter({ view, cdef, navigate, resMap, bmRes, parties, catalog }: ViewRouterProps) {
  const comps = cdef.components ?? [];

  if (view === "overview")
    return <OverviewView cdef={cdef} navigate={navigate} />;
  if (view === "metadata")
    return <MetadataView cdef={cdef} navigate={navigate} />;
  if (view === "references")
    return <BackMatterView resources={bmRes} navigate={navigate} />;

  // comp-N
  const compMatch = view.match(/^comp-(\d+)$/);
  if (compMatch) {
    const ci = parseInt(compMatch[1]);
    const comp = comps[ci];
    if (comp)
      return (
        <ComponentView
          comp={comp}
          compIdx={ci}
          parties={parties}
          navigate={navigate}
        />
      );
  }

  // comp-N-ci-M
  const ciMatch = view.match(/^comp-(\d+)-ci-(\d+)$/);
  if (ciMatch) {
    const ci = parseInt(ciMatch[1]);
    const ii = parseInt(ciMatch[2]);
    const comp = comps[ci];
    const impl = comp?.["control-implementations"]?.[ii];
    if (comp && impl)
      return (
        <ControlImplView
          impl={impl}
          comp={comp}
          compIdx={ci}
          implIdx={ii}
          parties={parties}
          navigate={navigate}
          resMap={resMap}
        />
      );
  }

  // req-<uuid>
  if (view.startsWith("req-")) {
    const uuid = view.slice(4);
    for (let ci = 0; ci < comps.length; ci++) {
      const comp = comps[ci];
      const impls = comp["control-implementations"] ?? [];
      for (let ii = 0; ii < impls.length; ii++) {
        const req = impls[ii]["implemented-requirements"].find(
          (r) => r.uuid === uuid,
        );
        if (req)
          return (
            <RequirementView
              req={req}
              comp={comp}
              compIdx={ci}
              implIdx={ii}
              parties={parties}
              navigate={navigate}
              resMap={resMap}
              catalog={catalog}
            />
          );
      }
    }
  }

  // res-group-*
  if (view.startsWith("res-group-")) {
    const type = view.replace("res-group-", "");
    const filtered = bmRes.filter((r) => resType(r) === type);
    const meta = RES_TYPE_META[type];
    return (
      <BackMatterView
        resources={filtered}
        navigate={navigate}
        title={meta?.label ?? type}
        filtered
      />
    );
  }

  // res-<uuid>
  if (view.startsWith("res-")) {
    const uuid = view.slice(4);
    const res = resMap[uuid];
    if (res) return <ResourceView res={res} navigate={navigate} />;
  }

  return <NotFoundView navigate={navigate} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Breadcrumbs({
  items,
  navigate,
}: {
  items: { id: string; label: string }[];
  navigate: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        fontSize: 12,
        color: colors.gray,
        marginBottom: 8,
        flexWrap: "wrap",
      }}
    >
      {items.map((item, i) => (
        <span key={item.id}>
          <span
            onClick={() => navigate(item.id)}
            style={{
              cursor: "pointer",
              color: i < items.length - 1 ? colors.brightBlue : colors.black,
              fontWeight: i === items.length - 1 ? 600 : 400,
            }}
          >
            {item.label}
          </span>
          {i < items.length - 1 && (
            <span style={{ margin: "0 4px", color: colors.paleGray }}>/</span>
          )}
        </span>
      ))}
    </div>
  );
}

function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: colors.white,
        borderRadius: radii.md,
        padding: "20px 24px",
        boxShadow: shadows.sm,
        marginBottom: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: colors.gray,
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: colors.gray,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: colors.black,
          marginTop: 2,
          fontFamily: mono ? fonts.mono : fonts.sans,
          wordBreak: "break-all",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function PropPill({ name, value }: { name: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: radii.pill,
        backgroundColor: colors.bg,
        color: colors.black,
        fontFamily: fonts.mono,
        border: `1px solid ${colors.paleGray}`,
        marginRight: 6,
        marginBottom: 4,
      }}
    >
      {name}: {value}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    implemented: { bg: colors.mint, fg: colors.white },
    partial: { bg: colors.yellow, fg: colors.black },
    planned: { bg: colors.cobalt, fg: colors.white },
    alternative: { bg: colors.brightCyan, fg: colors.white },
    "not-applicable": { bg: colors.paleGray, fg: colors.black },
  };
  const s = map[status] ?? { bg: colors.paleGray, fg: colors.black };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        padding: "2px 10px",
        borderRadius: radii.pill,
        backgroundColor: s.bg,
        color: s.fg,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DROP ZONE  (shown when no file is loaded)
   ═══════════════════════════════════════════════════════════════════════════ */

function DropZone({ onFile, error }: { onFile: (f: File) => void; error: string }) {
  const [dragging, setDragging] = useState(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };
  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) onFile(f);
    };
    input.click();
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: 24 }}>
        <IcoShield size={48} style={{ color: colors.navy }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>
          OSCAL Component Definition Viewer
        </h2>
        <p style={{ fontSize: 14, color: colors.gray, marginTop: 4 }}>
          Easy Dynamics — Client-Side Viewer
        </p>
      </div>
      <div
        onClick={handleClick}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: `2px dashed ${dragging ? colors.cobalt : colors.paleGray}`,
          borderRadius: radii.lg,
          padding: "48px 24px",
          backgroundColor: dragging ? "#f0f4ff" : colors.white,
          cursor: "pointer",
          transition: "border-color .2s, background-color .2s",
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        <IcoUpload size={40} style={{ color: colors.gray }} />
        <p style={{ marginTop: 12, fontSize: 15, color: colors.black }}>
          Drop an OSCAL <strong>Component Definition</strong> JSON file here
        </p>
        <p style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>
          or click to browse
        </p>
        {error && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: colors.red,
              fontWeight: 500,
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewView({
  cdef,
  navigate,
}: {
  cdef: ComponentDefinition;
  navigate: (id: string) => void;
}) {
  const comps = cdef.components ?? [];
  const allReqs = comps.flatMap((c) =>
    (c["control-implementations"] ?? []).flatMap(
      (ci) => ci["implemented-requirements"],
    ),
  );
  const familySet = new Set(allReqs.map((r) => familyOf(r["control-id"])));
  const resources = cdef["back-matter"]?.resources ?? [];

  const statusCounts: Record<string, number> = {};
  allReqs.forEach((r) => {
    const st =
      (r.props ?? []).find((p) => p.name === "implementation-status")?.value ??
      "unknown";
    statusCounts[st] = (statusCounts[st] ?? 0) + 1;
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, color: colors.navy, marginBottom: 4 }}>
        {cdef.metadata.title}
      </h1>
      <p style={{ fontSize: 13, color: colors.gray, marginBottom: 20 }}>
        Version {cdef.metadata.version ?? "—"} · OSCAL{" "}
        {cdef.metadata["oscal-version"] ?? "—"} · Last modified{" "}
        {fmtDate(cdef.metadata["last-modified"])}
      </p>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Components", value: comps.length, color: colors.cobalt },
          {
            label: "Control Implementations",
            value: allReqs.length,
            color: colors.navy,
          },
          {
            label: "Control Families",
            value: familySet.size,
            color: colors.brightBlue,
          },
          {
            label: "References",
            value: resources.length,
            color: colors.gray,
          },
        ].map((s) => (
          <Card
            key={s.label}
            style={{ textAlign: "center", borderTop: `3px solid ${s.color}` }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: colors.black, marginTop: 2 }}>
              {s.label}
            </div>
          </Card>
        ))}
      </div>

      {/* Status summary */}
      {Object.keys(statusCounts).length > 0 && (
        <Card>
          <SectionLabel>Implementation Status Summary</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(statusCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([st, count]) => (
                <div
                  key={st}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <StatusBadge status={st} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Family pills */}
      <Card>
        <SectionLabel>Control Families Covered</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Array.from(familySet)
            .sort()
            .map((fam) => (
              <span
                key={fam}
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: radii.pill,
                  backgroundColor: colors.navy,
                  color: colors.white,
                  fontWeight: 600,
                }}
              >
                {fam} — {FAMILIES[fam] ?? fam}
              </span>
            ))}
        </div>
      </Card>

      {/* Components quick nav */}
      <Card>
        <SectionLabel>Components</SectionLabel>
        {comps.map((comp, i) => (
          <div
            key={comp.uuid}
            onClick={() => navigate(`comp-${i}`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 0",
              borderBottom:
                i < comps.length - 1 ? `1px solid ${colors.paleGray}` : "none",
              cursor: "pointer",
            }}
          >
            <IcoCube size={16} style={{ color: colors.cobalt }} />
            <div>
              <div
                style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}
              >
                {comp.title}
              </div>
              <div style={{ fontSize: 12, color: colors.gray }}>
                Type: {comp.type} ·{" "}
                {(comp["control-implementations"] ?? []).reduce(
                  (s, ci) => s + ci["implemented-requirements"].length,
                  0,
                )}{" "}
                requirements
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   METADATA VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function MetadataView({
  cdef,
  navigate,
}: {
  cdef: ComponentDefinition;
  navigate: (id: string) => void;
}) {
  const meta = cdef.metadata;
  const parties = meta.parties ?? [];
  const roles = meta.roles ?? [];
  const rps = meta["responsible-parties"] ?? [];

  return (
    <div>
      <Breadcrumbs
        items={[
          { id: "overview", label: "Overview" },
          { id: "metadata", label: "Metadata" },
        ]}
        navigate={navigate}
      />
      <h1 style={{ fontSize: 20, color: colors.navy, marginBottom: 16 }}>
        Document Metadata
      </h1>

      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))",
            gap: 16,
          }}
        >
          <MField label="Title" value={meta.title} />
          <MField label="Version" value={meta.version ?? "—"} />
          <MField label="Last Modified" value={fmtDate(meta["last-modified"])} />
          <MField label="OSCAL Version" value={meta["oscal-version"] ?? "—"} />
          <MField label="Document UUID" value={cdef.uuid} mono />
        </div>
      </Card>

      {parties.length > 0 && (
        <Card>
          <SectionLabel>Parties</SectionLabel>
          {parties.map((p) => (
            <div
              key={p.uuid}
              style={{
                padding: "8px 0",
                borderBottom: `1px solid ${colors.bg}`,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>
                {p.name}
              </div>
              <div style={{ fontSize: 12, color: colors.gray }}>
                {p.type}
                {p["short-name"] ? ` · ${p["short-name"]}` : ""}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: colors.gray,
                  fontFamily: fonts.mono,
                }}
              >
                {p.uuid}
              </div>
            </div>
          ))}
        </Card>
      )}

      {roles.length > 0 && (
        <Card>
          <SectionLabel>Roles</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {roles.map((r) => (
              <span
                key={r.id}
                style={{
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: radii.pill,
                  backgroundColor: colors.navy,
                  color: colors.white,
                  fontWeight: 500,
                }}
              >
                {r.title} ({r.id})
              </span>
            ))}
          </div>
        </Card>
      )}

      {rps.length > 0 && (
        <Card>
          <SectionLabel>Responsible Parties</SectionLabel>
          {rps.map((rp, i) => (
            <div key={i} style={{ padding: "6px 0" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.brightBlue,
                }}
              >
                {rp["role-id"]}
              </span>
              <span style={{ fontSize: 12, color: colors.gray }}> → </span>
              {rp["party-uuids"].map((pu) => (
                <span key={pu} style={{ fontSize: 12, color: colors.black }}>
                  {partyName(pu, parties)}
                </span>
              ))}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function ComponentView({
  comp,
  compIdx,
  parties: _parties,
  navigate,
}: {
  comp: Component;
  compIdx: number;
  parties: Party[];
  navigate: (id: string) => void;
}) {
  const impls = comp["control-implementations"] ?? [];
  const allReqs = impls.flatMap((ci) => ci["implemented-requirements"]);
  const familySet = new Set(allReqs.map((r) => familyOf(r["control-id"])));

  return (
    <div>
      <Breadcrumbs
        items={[
          { id: "overview", label: "Overview" },
          { id: `comp-${compIdx}`, label: comp.title },
        ]}
        navigate={navigate}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <IcoCube size={22} style={{ color: colors.cobalt }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {comp.title}
        </h1>
      </div>

      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))",
            gap: 16,
          }}
        >
          <MField label="Type" value={comp.type} />
          <MField label="UUID" value={comp.uuid} mono />
          <MField
            label="Control Implementations"
            value={String(impls.length)}
          />
          <MField label="Total Requirements" value={String(allReqs.length)} />
        </div>
      </Card>

      {comp.description && (
        <Card>
          <SectionLabel>Description</SectionLabel>
          <MarkupBlock value={comp.description} />
        </Card>
      )}

      {comp.purpose && (
        <Card>
          <SectionLabel>Purpose</SectionLabel>
          <p style={{ fontSize: 13, lineHeight: 1.75, color: colors.black }}>
            {txt(comp.purpose)}
          </p>
        </Card>
      )}

      {comp.props && comp.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {comp.props.map((p, i) => (
              <PropPill key={i} name={p.name} value={p.value} />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionLabel>Control Families ({familySet.size})</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Array.from(familySet)
            .sort()
            .map((fam) => (
              <span
                key={fam}
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: radii.pill,
                  backgroundColor: colors.navy,
                  color: colors.white,
                  fontWeight: 600,
                }}
              >
                {fam}
              </span>
            ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>Control Implementations</SectionLabel>
        {impls.map((impl, ii) => (
          <div
            key={impl.uuid}
            onClick={() => navigate(`comp-${compIdx}-ci-${ii}`)}
            style={{
              padding: "10px 0",
              borderBottom:
                ii < impls.length - 1 ? `1px solid ${colors.bg}` : "none",
              cursor: "pointer",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <IcoLayers size={14} style={{ color: colors.brightBlue }} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: colors.brightBlue,
                }}
              >
                Control Implementation #{ii + 1}
              </span>
              <span style={{ fontSize: 12, color: colors.gray }}>
                — {impl["implemented-requirements"].length} requirements
              </span>
            </div>
            {impl.description && (
              <p
                style={{
                  fontSize: 12,
                  color: colors.gray,
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                {trunc(txt(impl.description), 120)}
              </p>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTROL IMPLEMENTATION VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function ControlImplView({
  impl,
  comp,
  compIdx,
  implIdx,
  parties: _parties,
  navigate,
  resMap: _resMap,
}: {
  impl: ControlImplementation;
  comp: Component;
  compIdx: number;
  implIdx: number;
  parties: Party[];
  navigate: (id: string) => void;
  resMap: Record<string, Resource>;
}) {
  const reqs = impl["implemented-requirements"];
  const familySet = new Set(reqs.map((r) => familyOf(r["control-id"])));

  return (
    <div>
      <Breadcrumbs
        items={[
          { id: "overview", label: "Overview" },
          { id: `comp-${compIdx}`, label: comp.title },
          {
            id: `comp-${compIdx}-ci-${implIdx}`,
            label: `Control Impl. #${implIdx + 1}`,
          },
        ]}
        navigate={navigate}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <IcoLayers size={22} style={{ color: colors.brightBlue }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          Control Implementation #{implIdx + 1}
        </h1>
      </div>

      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))",
            gap: 16,
          }}
        >
          <MField label="Source" value={impl.source} mono />
          <MField label="Requirements" value={String(reqs.length)} />
          <MField label="UUID" value={impl.uuid} mono />
        </div>
      </Card>

      {impl.description && (
        <Card>
          <SectionLabel>Description</SectionLabel>
          <MarkupBlock value={impl.description} />
        </Card>
      )}

      <Card>
        <SectionLabel>Control Families ({familySet.size})</SectionLabel>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 16,
          }}
        >
          {Array.from(familySet)
            .sort()
            .map((fam) => (
              <span
                key={fam}
                style={{
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: radii.pill,
                  backgroundColor: colors.navy,
                  color: colors.white,
                  fontWeight: 600,
                }}
              >
                {fam} — {FAMILIES[fam] ?? fam}
              </span>
            ))}
        </div>
      </Card>

      <Card>
        <SectionLabel>Implemented Requirements ({reqs.length})</SectionLabel>
        {reqs.map((req) => {
          const status =
            (req.props ?? []).find(
              (p) => p.name === "implementation-status",
            )?.value ?? "unknown";
          return (
            <div
              key={req.uuid}
              onClick={() => navigate(`req-${req.uuid}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderBottom: `1px solid ${colors.bg}`,
                cursor: "pointer",
              }}
            >
              <IcoShield size={14} style={{ color: colors.navy }} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.navy,
                  minWidth: 60,
                }}
              >
                {req["control-id"].toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: colors.black,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {familyName(req["control-id"])}
              </span>
              <StatusBadge status={status} />
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG PROSE WITH PARAMS — renders prose with styled inline parameter
   pills + markdown markup rendering
   ═══════════════════════════════════════════════════════════════════════════ */

function CatalogProseWithParams({
  text,
  paramMap,
}: {
  text: string;
  paramMap: Record<string, CatalogParam>;
}) {
  // Split on {{ insert: param, <id> }} keeping the token as a capture group
  const segments = text.split(/(\{\{\s*insert:\s*param\s*,\s*[^}]+?\s*\}\})/g);

  return (
    <span style={{ fontSize: 13, lineHeight: 1.75, color: colors.black }}>
      {segments.map((segment, i) => {
        const match = segment.match(
          /\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/,
        );
        if (match) {
          const paramId = match[1].trim();
          const param = paramMap[paramId];
          const rendered = param
            ? renderCatalogParamText(param, paramMap)
            : `[Assignment: ${paramId}]`;
          const isSelection = param?.select != null;
          return (
            <span
              key={i}
              title={`Parameter: ${paramId}`}
              style={{
                display: "inline",
                fontSize: 12,
                fontFamily: fonts.mono,
                fontWeight: 600,
                color: isSelection ? colors.cobalt : colors.orange,
                backgroundColor: isSelection
                  ? `${colors.cobalt}12`
                  : `${colors.orange}12`,
                padding: "1px 6px",
                borderRadius: radii.sm,
                border: `1px solid ${
                  isSelection ? `${colors.cobalt}33` : `${colors.orange}33`
                }`,
                whiteSpace: "nowrap" as const,
              }}
            >
              {rendered}
            </span>
          );
        }
        // Render non-param segments as markdown
        const html = renderMarkup(segment);
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
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

  // Break parts into the 5 standard OSCAL classes
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
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase" as const,
              color: colors.cobalt,
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Control Statement
          </div>
          {stmtParts.map((p) => renderPartTree(p))}
        </div>
      )}
      {guidanceParts.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${colors.paleGray}`,
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          <button
            onClick={() => setGuidanceOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase" as const,
              color: colors.cobalt,
              letterSpacing: 0.5,
              fontFamily: fonts.sans,
            }}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 0.2s",
                transform: guidanceOpen ? "rotate(90deg)" : "rotate(0deg)",
                fontSize: 10,
              }}
            >
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
   REQUIREMENT VIEW — main detail page per the reference screenshot
   ═══════════════════════════════════════════════════════════════════════════ */

function RequirementView({
  req,
  comp,
  compIdx,
  implIdx,
  parties,
  navigate,
  resMap,
  catalog,
}: {
  req: ImplementedRequirement;
  comp: Component;
  compIdx: number;
  implIdx: number;
  parties: Party[];
  navigate: (id: string) => void;
  resMap: Record<string, Resource>;
  catalog: OscalCatalog | null;
}) {
  const status =
    (req.props ?? []).find((p) => p.name === "implementation-status")?.value ??
    "unknown";
  const statements = req.statements ?? [];
  const links = req.links ?? [];

  // Catalog enrichment
  const catalogControl = useMemo(
    () => findCatalogControl(catalog, req["control-id"]),
    [catalog, req],
  );
  const catalogParamMap = useMemo(
    () => catalogControl ? buildCatalogParamMap(catalog, catalogControl) : {},
    [catalog, catalogControl],
  );

  // Resolve links to back-matter resources (href="#uuid" pattern)
  const resolvedLinks = links.map((lk) => {
    const uuidMatch = lk.href.match(/^#(.+)/);
    if (uuidMatch) {
      const res = resMap[uuidMatch[1]];
      if (res) return { ...lk, resolved: res };
    }
    return { ...lk, resolved: undefined as Resource | undefined };
  });

  return (
    <div>
      <Breadcrumbs
        items={[
          { id: "overview", label: "Overview" },
          { id: `comp-${compIdx}`, label: comp.title },
          {
            id: `comp-${compIdx}-ci-${implIdx}`,
            label: `Control Impl. #${implIdx + 1}`,
          },
          {
            id: `req-${req.uuid}`,
            label: req["control-id"].toUpperCase(),
          },
        ]}
        navigate={navigate}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <IcoTag size={20} style={{ color: colors.orange }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {req["control-id"].toUpperCase()} {familyName(req["control-id"])}
        </h1>
      </div>

      {/* UUID + status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: colors.gray,
            fontFamily: fonts.mono,
          }}
        >
          {req.uuid}
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Catalog control details */}
      {catalogControl ? (
        <CatalogControlCard control={catalogControl} paramMap={catalogParamMap} />
      ) : (
        <Card
          style={{
            backgroundColor: "#FFF8F0",
            borderLeft: `4px solid ${colors.yellow}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📙</span>
            <span style={{ fontSize: 13, color: colors.black }}>
              <strong>Catalog not loaded.</strong> Load an OSCAL catalog to see
              control prose for {req["control-id"].toUpperCase()}.
            </span>
          </div>
        </Card>
      )}

      {/* Implementation description */}
      {req.description && (
        <Card>
          <SectionLabel>Implementation Description</SectionLabel>
          <MarkupBlock value={req.description} />
        </Card>
      )}

      {/* Statements */}
      {statements.length > 0 && (
        <Card>
          <SectionLabel>Statements ({statements.length})</SectionLabel>
          {statements.map((stmt) => {
            // Resolve the statement-id to catalog prose
            const catalogPart = catalogControl
              ? findPartById(catalogControl.parts ?? [], stmt["statement-id"])
              : undefined;
            return (
              <div
                key={stmt.uuid}
                style={{
                  backgroundColor: colors.bg,
                  borderRadius: radii.sm,
                  padding: "12px 16px",
                  marginBottom: 8,
                }}
              >
                {/* Show raw statement-id only when no catalog prose was found */}
                {!catalogPart?.prose && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: colors.brightBlue,
                    fontFamily: fonts.mono,
                    marginBottom: 4,
                  }}
                >
                  {stmt["statement-id"]}
                </div>
                )}
                {/* Catalog prose for this statement */}
                {catalogPart?.prose && (
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.cobalt,
                      lineHeight: 1.7,
                      padding: "6px 10px",
                      backgroundColor: `${colors.cobalt}08`,
                      border: `1px solid ${colors.cobalt}22`,
                      borderRadius: radii.sm,
                      marginBottom: 8,
                      fontStyle: "italic",
                    }}
                  >
                    <CatalogProseWithParams text={catalogPart.prose} paramMap={catalogParamMap} />
                  </div>
                )}
                {/* Implementation description for this statement */}
                {stmt.description && (
                  <MarkupBlock value={stmt.description} />
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Responsible roles */}
      {req["responsible-roles"] &&
        req["responsible-roles"].length > 0 && (
          <Card>
            <SectionLabel>Responsible Roles</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {req["responsible-roles"].map((rr, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 12,
                    padding: "4px 12px",
                    borderRadius: radii.pill,
                    backgroundColor: colors.navy,
                    color: colors.white,
                    fontWeight: 500,
                  }}
                >
                  {rr["role-id"]}
                  {(rr["party-uuids"] ?? [])
                    .map((pu) => {
                      const name = partyName(pu, parties);
                      return name !== pu.slice(0, 8) ? ` (${name})` : "";
                    })
                    .join("")}
                </span>
              ))}
            </div>
          </Card>
        )}

      {/* Links / references — colored pill buttons */}
      {resolvedLinks.length > 0 && (() => {
        // Categorize links by rel type
        const linkCategories: Record<string, { label: string; bg: string; fg: string; border: string }> = {
          mitre:     { label: "MITRE ATT&CK",  bg: colors.darkNavy,   fg: colors.white,     border: colors.darkNavy },
          reference: { label: "Reference",      bg: `${colors.cobalt}14`, fg: colors.cobalt,    border: `${colors.cobalt}44` },
          related:   { label: "Related",        bg: `${colors.darkGreen}14`, fg: colors.darkGreen, border: `${colors.darkGreen}44` },
          required:  { label: "Required",       bg: `${colors.orange}14`, fg: colors.orange,   border: `${colors.orange}44` },
          _default:  { label: "Link",           bg: `${colors.blueGray}14`, fg: colors.blueGray, border: `${colors.blueGray}44` },
        };

        function relCategory(lk: { rel?: string; href: string }) {
          if (lk.rel === "mitre" || lk.href.includes("attack.mitre.org")) return "mitre";
          if (lk.rel === "reference") return "reference";
          if (lk.rel === "related") return "related";
          if (lk.rel === "required") return "required";
          if (lk.rel) return lk.rel;
          return "_default";
        }

        // Collect the unique categories actually present
        const usedCategories = new Set<string>();
        resolvedLinks.forEach((lk) => usedCategories.add(relCategory(lk)));

        return (
          <Card>
            <SectionLabel>Links ({resolvedLinks.length})</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {resolvedLinks.map((lk, i) => {
                const cat = relCategory(lk);
                const style = linkCategories[cat] ?? linkCategories._default;
                // Determine display text and href
                let displayText: string;
                let targetHref: string | undefined;
                let onClick: (() => void) | undefined;
                if (lk.resolved) {
                  const r = lk.resolved;
                  displayText = r.title ?? "Untitled";
                  targetHref = r.rlinks?.[0]?.href;
                  if (!targetHref) onClick = () => navigate(`res-${r.uuid}`);
                } else if (!lk.href.startsWith("#")) {
                  displayText = lk.text ?? lk.href;
                  targetHref = lk.href;
                } else {
                  return null;
                }
                const common: CSSProperties = {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 14px",
                  borderRadius: radii.pill,
                  backgroundColor: style.bg,
                  color: style.fg,
                  border: `1px solid ${style.border}`,
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "filter 0.15s",
                  whiteSpace: "nowrap",
                };
                return targetHref ? (
                  <a
                    key={i}
                    href={targetHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={common}
                  >
                    {displayText}
                  </a>
                ) : (
                  <span key={i} onClick={onClick} style={common}>
                    {displayText}
                  </span>
                );
              })}
            </div>

            {/* Legend */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                paddingTop: 8,
                borderTop: `1px solid ${colors.bg}`,
              }}
            >
              {[...usedCategories].map((cat) => {
                const s = linkCategories[cat] ?? linkCategories._default;
                return (
                  <div
                    key={cat}
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: s.bg === colors.darkNavy ? s.bg : s.fg,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, color: colors.gray }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Properties */}
      {req.props && req.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {req.props.map((p, i) => (
              <PropPill key={i} name={p.name} value={p.value} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BACK MATTER VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function BackMatterView({
  resources,
  navigate,
  title,
  filtered,
}: {
  resources: Resource[];
  navigate: (id: string) => void;
  title?: string;
  filtered?: boolean;
}) {
  const grouped = useMemo(() => {
    if (filtered) return { [title ?? "Resources"]: resources };
    const m: Record<string, Resource[]> = {};
    resources.forEach((r) => {
      const t = resType(r);
      const meta = RES_TYPE_META[t];
      const key = meta?.label ?? t;
      (m[key] ??= []).push(r);
    });
    return m;
  }, [resources, filtered, title]);

  return (
    <div>
      <Breadcrumbs
        items={[
          { id: "overview", label: "Overview" },
          { id: "references", label: "References" },
        ]}
        navigate={navigate}
      />
      <h1 style={{ fontSize: 20, color: colors.navy, marginBottom: 16 }}>
        {title ?? `References (${resources.length})`}
      </h1>

      {Object.entries(grouped).map(([groupLabel, items]) => (
        <Card key={groupLabel}>
          <SectionLabel>
            {groupLabel} ({items.length})
          </SectionLabel>
          {items.map((r) => {
            const type = resType(r);
            const meta = RES_TYPE_META[type];
            return (
              <div
                key={r.uuid}
                onClick={() => navigate(`res-${r.uuid}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: `1px solid ${colors.bg}`,
                  cursor: "pointer",
                }}
              >
                {resIcon(meta?.icon ?? "book", 14, {
                  color: meta?.color ?? colors.gray,
                })}
                <span
                  style={{
                    fontSize: 13,
                    color: colors.brightBlue,
                    fontWeight: 500,
                  }}
                >
                  {r.title ?? "Untitled"}
                </span>
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESOURCE VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function ResourceView({
  res,
  navigate,
}: {
  res: Resource;
  navigate: (id: string) => void;
}) {
  const type = resType(res);
  const meta = RES_TYPE_META[type];

  return (
    <div>
      <Breadcrumbs
        items={[
          { id: "overview", label: "Overview" },
          { id: "references", label: "References" },
          { id: `res-${res.uuid}`, label: res.title ?? "Resource" },
        ]}
        navigate={navigate}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {resIcon(meta?.icon ?? "book", 22, {
          color: meta?.color ?? colors.navy,
        })}
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {res.title ?? "Untitled Resource"}
        </h1>
      </div>

      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))",
            gap: 16,
          }}
        >
          <MField label="UUID" value={res.uuid} mono />
          <MField label="Type" value={meta?.label ?? type} />
        </div>
      </Card>

      {res.description && (
        <Card>
          <SectionLabel>Description</SectionLabel>
          <MarkupBlock value={res.description} />
        </Card>
      )}

      {res.props && res.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {res.props.map((p, i) => (
              <PropPill key={i} name={p.name} value={p.value} />
            ))}
          </div>
        </Card>
      )}

      {res.rlinks && res.rlinks.length > 0 && (
        <Card>
          <SectionLabel>Links</SectionLabel>
          {res.rlinks.map((rl, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
              }}
            >
              <IcoLink size={13} style={{ color: colors.brightBlue }} />
              <a
                href={rl.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: colors.brightBlue }}
              >
                {rl.href}
              </a>
              {rl["media-type"] && (
                <span style={{ fontSize: 11, color: colors.gray }}>
                  ({rl["media-type"]})
                </span>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NOT FOUND
   ═══════════════════════════════════════════════════════════════════════════ */

function NotFoundView({ navigate }: { navigate: (id: string) => void }) {
  return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <h2 style={{ color: colors.gray }}>View not found</h2>
      <button
        onClick={() => navigate("overview")}
        style={{
          marginTop: 12,
          padding: "8px 20px",
          backgroundColor: colors.navy,
          color: colors.white,
          borderRadius: radii.sm,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Go to Overview
      </button>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const S: Record<string, CSSProperties> = {
  emptyWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
  },
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 160px)",
    overflow: "hidden",
    borderRadius: radii.md,
    border: `1px solid ${colors.paleGray}`,
    backgroundColor: colors.bg,
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    height: 48,
    backgroundColor: colors.darkNavy,
    color: colors.white,
    flexShrink: 0,
    borderRadius: `${radii.md}px ${radii.md}px 0 0`,
  },
  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  topBarLogo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.orange,
    color: colors.white,
    fontSize: 12,
    fontWeight: 800,
    fontFamily: fonts.sans,
  },
  topBtn: {
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: radii.sm,
    border: "none",
    cursor: "pointer",
    backgroundColor: colors.orange,
    color: colors.white,
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    backgroundColor: colors.white,
    borderRight: `1px solid ${colors.paleGray}`,
    overflowY: "auto",
    flexShrink: 0,
  },
  sidebarFilename: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.gray,
    padding: "10px 12px 6px",
    borderBottom: `1px solid ${colors.bg}`,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    fontSize: 13,
    cursor: "pointer",
    transition: "background-color .1s",
    borderBottom: `1px solid ${colors.bg}`,
    userSelect: "none",
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: "1px 6px",
    borderRadius: radii.pill,
    backgroundColor: colors.bg,
    color: colors.gray,
    marginLeft: "auto",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: 24,
  },
};
