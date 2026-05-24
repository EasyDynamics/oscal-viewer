/* ═══════════════════════════════════════════════════════════════════════════
   Component Definition Page — SPA-style viewer
   Left sidebar nav · Right content panel · Views swap on click
   Modeled after the reference oscal-cdef-viewer.
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
import { alpha, colors, fonts, shadows, radii, brand } from "../theme/tokens";
import { useOscal } from "../context/OscalContext";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { useUrlDocument, fileNameFromUrl } from "../hooks/useUrlDocument";
import { useAnalyticsView } from "../hooks/useAnalyticsView";
import { useOscalGraphResolver, type ResolvedOscalDocument } from "../hooks/useOscalGraphResolver";
import ResolverModal from "../components/ResolverModal";
import useIsMobile from "../hooks/useIsMobile";
import { useCatalogSortIndex } from "../hooks/useCatalogSortIndex";
import LinkChips from "../components/LinkChips";
import type { ResolvedLink } from "../components/LinkChips";
import { PartyCardGrid, PartyChip, ResponsiblePartiesList } from "../components/PartyDisplay";
import {
  IcoBook,
  IcoBox,
  IcoBulb,
  IcoChev,
  IcoCloud,
  IcoCode,
  IcoCube,
  IcoDatabase,
  IcoFileCode,
  IcoGuidance,
  IcoHardware,
  IcoHome,
  IcoInfo,
  IcoInterconnection,
  IcoLayers,
  IcoLink,
  IcoNetwork,
  IcoPaperclip,
  IcoPhysical,
  IcoPlan,
  IcoPolicy,
  IcoProcessProcedure,
  IcoServer,
  IcoService,
  IcoShield,
  IcoShieldLayers,
  IcoSoftware,
  IcoStandard,
  IcoTag,
  IcoTarget,
  IcoUpload,
  IcoValidation,
} from "../components/IconAliases";
import {
  backMatterBase64Link,
  backMatterResourceType,
  backMatterResourceVisual,
  componentTypeVisual,
  llmGeneratedLabel,
  propDisplayName,
  propVisual,
  raisedOscalProps,
  resolveComponentVisual,
} from "../utils/oscalVisuals";
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
  "resource-fragment"?: string;
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
  remarks?: string | { prose: string };
  props?: OscalProp[];
}

interface ImplementedRequirement {
  uuid: string;
  "control-id": string;
  description?: string | { prose: string };
  remarks?: string | { prose: string };
  props?: OscalProp[];
  statements?: Statement[];
  links?: Link[];
  "responsible-roles"?: { "role-id": string; "party-uuids"?: string[] }[];
}

interface ControlImplementation {
  uuid: string;
  description?: string | { prose: string };
  remarks?: string | { prose: string };
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
  base64?: unknown;
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
function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}

/** Derive a human-readable label for a control implementation from its source URI. */
function implLabel(impl: ControlImplementation, index: number, resolvedTitle?: string | null): string {
  if (resolvedTitle) return resolvedTitle;
  try {
    const url = new URL(impl.source);
    // Use the filename without extension, cleaned up
    const filename = url.pathname.split("/").pop() ?? "";
    const name = filename.replace(/\.(json|xml|yaml|yml)$/i, "").replace(/[_-]/g, " ").trim();
    if (name) return name;
  } catch {
    // source may not be a full URL — try using it directly
    const cleaned = impl.source.replace(/\.(json|xml|yaml|yml)$/i, "").replace(/[_-]/g, " ").trim();
    if (cleaned) return cleaned;
  }
  return `Control Implementation ${index + 1}`;
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

/** Remarks toggle — collapsed by default, click to reveal */
function CollapsibleRemarks({ value, compact }: { value: unknown; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const raw = txt(value);
  if (!raw) return null;
  return compact ? (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          fontSize: 11, color: colors.cobalt, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>&#9654;</span>
        Remarks
      </button>
      {open && (
        <div style={{ marginTop: 4, paddingLeft: 10, borderLeft: `3px solid ${colors.cobalt}`, fontStyle: "italic" }}>
          <MarkupBlock value={value} style={{ fontSize: 12, color: colors.gray }} />
        </div>
      )}
    </div>
  ) : (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          fontSize: 13, color: colors.cobalt, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>&#9654;</span>
        Remarks
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <MarkupBlock value={value} />
        </div>
      )}
    </div>
  );
}

function resIcon(type: string, size = 13, style?: CSSProperties) {
  if (type === "cloud") return <IcoCloud size={size} style={style} />;
  if (type === "code") return <IcoCode size={size} style={style} />;
  if (type === "target") return <IcoTarget size={size} style={style} />;
  if (type === "standard") return <IcoStandard size={size} style={style} />;
  if (type === "paperclip") return <IcoPaperclip size={size} style={style} />;
  return <IcoBook size={size} style={style} />;
}

/** Render the correct icon for a component type (standalone, usable outside the main component) */
function cdefComponentTypeIcon(type: string, size = 16, color?: string): ReactNode {
  const st: CSSProperties = { color: color ?? colors.cobalt, flexShrink: 0 };
  switch (type) {
    case "this-system": return <IcoHome size={size} style={st} />;
    case "system": return <IcoServer size={size} style={st} />;
    case "interconnection": return <IcoInterconnection size={size} style={st} />;
    case "software": return <IcoSoftware size={size} style={st} />;
    case "hardware": return <IcoHardware size={size} style={st} />;
    case "service": return <IcoService size={size} style={st} />;
    case "policy": return <IcoPolicy size={size} style={st} />;
    case "physical": return <IcoPhysical size={size} style={st} />;
    case "process-procedure": return <IcoProcessProcedure size={size} style={st} />;
    case "plan": return <IcoPlan size={size} style={st} />;
    case "guidance": return <IcoGuidance size={size} style={st} />;
    case "standard": return <IcoStandard size={size} style={st} />;
    case "validation": return <IcoValidation size={size} style={st} />;
    case "network": return <IcoCloud size={size} style={st} />;
    case "box": return <IcoBox size={size} style={st} />;
    default: return <IcoCube size={size} style={st} />;
  }
}

function cdefVisualIcon(iconKey: string, size = 16, color?: string): ReactNode {
  const st: CSSProperties = { color: color ?? colors.cobalt, flexShrink: 0 };
  switch (iconKey) {
    case "home": return <IcoHome size={size} style={st} />;
    case "info": return <IcoInfo size={size} style={st} />;
    case "cube": return <IcoCube size={size} style={st} />;
    case "server": return <IcoServer size={size} style={st} />;
    case "ext-system": return <IcoServer size={size} style={st} />;
    case "box": return <IcoBox size={size} style={st} />;
    case "layers": return <IcoLayers size={size} style={st} />;
    case "shield-layers": return <IcoShieldLayers size={size} style={st} />;
    case "shield": return <IcoShield size={size} style={st} />;
    case "book": return <IcoBook size={size} style={st} />;
    case "link": return <IcoLink size={size} style={st} />;
    case "tag": return <IcoTag size={size} style={st} />;
    case "cloud": return <IcoCloud size={size} style={st} />;
    case "code": return <IcoCode size={size} style={st} />;
    case "database": return <IcoDatabase size={size} style={st} />;
    case "file-code": return <IcoFileCode size={size} style={st} />;
    case "target": return <IcoTarget size={size} style={st} />;
    case "network": return <IcoNetwork size={size} style={st} />;
    default: return cdefComponentTypeIcon(iconKey, size, color);
  }
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
  const { token: authToken } = useAuth();
  const cdef = (oscal.componentDefinition?.data as ComponentDefinition) ?? null;
  const fileName = oscal.componentDefinition?.fileName ?? "";
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [mobilePath, setMobilePath] = useState<string[]>([]);
  const [mobileShowContent, setMobileShowContent] = useState(false);
  const catalogSort = useCatalogSortIndex();
  useAnalyticsView("Component Definition", view);

  /* ── Auto-load from ?url= query param ── */
  const urlDoc = useUrlDocument();
  useEffect(() => {
    if (!urlDoc.json || oscal.componentDefinition) return;
    try {
      const data = (urlDoc.json as Record<string, unknown>)["component-definition"] ?? urlDoc.json;
      if (!(data as Record<string, unknown>).metadata)
        throw new Error("Not an OSCAL component-definition — no metadata found.");
      oscal.setComponentDefinition(data as ComponentDefinition, fileNameFromUrl(urlDoc.sourceUrl!));
      setView("overview");
      setCollapsed({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse fetched document");
    }
  }, [urlDoc.json]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = useCallback(
    (id: string) => {
      setView(id);
      contentRef.current?.scrollTo(0, 0);
    },
    [],
  );

  const mobileNavigate = useCallback((id: string) => {
    setView(id);
    setMobileShowContent(true);
  }, []);

  const mobileDrillIn = useCallback((nodeId: string) => {
    setMobilePath((prev) => [...prev, nodeId]);
  }, []);

  const mobileDrillBack = useCallback(() => {
    setMobilePath((prev) => prev.slice(0, -1));
  }, []);

  const mobileBreadcrumbJump = useCallback((idx: number) => {
    setMobilePath((prev) => prev.slice(0, idx));
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

  /* ── Auto-resolve imported component definitions and catalog sources ── */
  const storedResolved = useRef(new Set<string>());
  const handleResolved = useCallback((doc: ResolvedOscalDocument) => {
    const key = `${doc.modelKey}:${doc.url}`;
    if (storedResolved.current.has(key)) return;
    storedResolved.current.add(key);
    if (doc.modelKey === "catalog" && !oscal.catalog && !storedResolved.current.has("slot:catalog")) {
      storedResolved.current.add("slot:catalog");
      oscal.setCatalog(doc.data as unknown as import("../context/OscalContext").Catalog, doc.label, doc.url);
    }
  }, [oscal]);
  const graphResolver = useOscalGraphResolver({
    root: cdef,
    rootModelKey: "component-definition",
    rootBaseUrl: urlDoc.sourceUrl,
    token: authToken,
    onResolved: handleResolved,
  });

  /** Title from the resolved catalog, used to replace GUID/filename in nav labels */
  const resolvedCatalogTitle = useMemo(() => {
    const cat = oscal.catalog?.data;
    return cat?.metadata?.title ?? null;
  }, [oscal.catalog]);

  /** Look up a resolved title for a control-implementation source */
  const resolvedTitleForSource = useCallback(
    (source: string) => {
      const match = graphResolver.nodes.find((node) => node.status === "success" && node.modelKey === "catalog" && (node.resolvedUrl === source || node.resolvedUrl?.endsWith(source)));
      return match?.resolvedLabel ?? resolvedCatalogTitle;
    },
    [graphResolver.nodes, resolvedCatalogTitle],
  );

  /* ── Build navigation tree ── */
  const navTree = useMemo<NavItem[]>(() => {
    if (!cdef) return [];
    const items: NavItem[] = [];

    items.push({ id: "overview", label: "Overview", icon: "home", color: colors.navy, depth: 0 });
    items.push({ id: "metadata", label: "Metadata", icon: "info", color: colors.navy, depth: 0 });

    const comps = cdef.components ?? [];
    comps.forEach((comp, ci) => {
      const compId = `comp-${ci}`;
      const visual = resolveComponentVisual(comp);
      items.push({ id: compId, label: comp.title, icon: visual.iconKey, color: visual.color, depth: 0 });

      const impls = comp["control-implementations"] ?? [];
      impls.forEach((impl, ii) => {
        const implId = `comp-${ci}-ci-${ii}`;
        const reqCount = impl["implemented-requirements"].length;
        items.push({
          id: implId,
          label: implLabel(impl, ii, resolvedTitleForSource(impl.source)),
          icon: "layers",
          color: colors.brightBlue,
          depth: 1,
          parent: compId,
          childCount: reqCount,
        });

        const sortedReqs = [...impl["implemented-requirements"]].sort((a, b) => catalogSort.compare(a["control-id"], b["control-id"]));
        sortedReqs.forEach((req) => {
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
        const t = backMatterResourceType(r);
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
        const meta = backMatterResourceVisual(type);
        const groupId = `res-group-${type}`;
        items.push({
          id: groupId,
          label: `${meta.label} (${resources.length})`,
          icon: meta.iconKey,
          color: meta.color,
          depth: 1,
          parent: "references",
          childCount: resources.length,
        });

        resources.forEach((r) => {
          items.push({
            id: `res-${r.uuid}`,
            label: trunc(r.title ?? "Untitled", 28),
            icon: meta.iconKey,
            color: meta.color,
            depth: 2,
            parent: groupId,
          });
        });
      });
    }

    return items;
  }, [cdef, bmRes, resolvedTitleForSource, catalogSort]);

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

  /* ── Visible nav items (collapse logic) ── */
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

  /* ── Modal for dependency resolution status ── */
  const resolverModalEl = (
    <ResolverModal items={graphResolver.items} onSkip={graphResolver.cancel} />
  );

  /* ── If no file loaded, show drop zone ── */
  if (!cdef) {
    return (
      <div style={S.emptyWrap}>
        {urlDoc.isLoading
          ? <div style={{ textAlign: "center", padding: 48 }}>
              <p style={{ fontSize: 15, color: colors.gray }}>Loading document from URL…</p>
            </div>
          : <DropZone onFile={loadFile} error={urlDoc.error || error} sourceUrl={urlDoc.sourceUrl} />}
      </div>
    );
  }

  /* ── Nav icon resolver ── */
  function navIcon(icon: string, color: string, size = 14): ReactNode {
    return cdefVisualIcon(icon, size, color);
  }

  const parties = cdef.metadata.parties ?? [];

  /* ── Mobile layout ── */
  if (isMobile) {
    if (mobileShowContent) {
      return (
        <div style={S.shell}>
          {resolverModalEl}
          <div style={S.topBar}>
            <button onClick={() => setMobileShowContent(false)} style={S.mobileBackBtn}>← Back</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.white, flex: 1, textAlign: "center" }}>Component Def</div>
            <button style={S.topBtn} onClick={handleNewFile}>New</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <ViewRouter view={view} cdef={cdef} navigate={mobileNavigate} resMap={resMap} bmRes={bmRes} parties={parties} catalog={oscal.catalog?.data ?? null} resolvedTitleForSource={resolvedTitleForSource} />
          </div>
        </div>
      );
    }

    const currentParent = mobilePath.length > 0 ? mobilePath[mobilePath.length - 1] : null;
    const drillChildren = navTree.filter((item) => {
      if (currentParent === null) return !item.parent;
      return item.parent === currentParent;
    });

    const breadcrumbs: { label: string }[] = [{ label: "Components" }];
    for (const pid of mobilePath) {
      const n = navTree.find((i) => i.id === pid);
      breadcrumbs.push({ label: n?.label ?? pid });
    }

    return (
      <div style={S.shell}>
        {resolverModalEl}
        <div style={S.topBar}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.white }}>Component Def</div>
          <button style={S.topBtn} onClick={handleNewFile}>New</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", backgroundColor: colors.card }}>
          {mobilePath.length > 0 && (
            <div style={S.mobileBreadcrumbs}>
              {breadcrumbs.map((bc, i) => (
                <span key={i}>
                  <span onClick={() => mobileBreadcrumbJump(i)}
                    style={{ cursor: "pointer", color: i < breadcrumbs.length - 1 ? colors.brightBlue : colors.black, fontWeight: i === breadcrumbs.length - 1 ? 600 : 400 }}>
                    {bc.label}
                  </span>
                  {i < breadcrumbs.length - 1 && <span style={{ margin: "0 6px", color: colors.paleGray }}>/</span>}
                </span>
              ))}
            </div>
          )}
          {mobilePath.length > 0 && (
            <div onClick={mobileDrillBack}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", fontSize: 14, color: colors.brightBlue, cursor: "pointer", borderBottom: `1px solid ${colors.bg}`, fontWeight: 500, minHeight: 44 }}>
              ← Back
            </div>
          )}
          {drillChildren.map((item) => {
            const hasKids = !!childCounts[item.id];
            return (
              <div key={item.id}
                onClick={() => { if (hasKids) mobileDrillIn(item.id); else mobileNavigate(item.id); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", fontSize: 14, cursor: "pointer", minHeight: 48, borderBottom: `1px solid ${colors.bg}` }}>
                {navIcon(item.icon, item.color)}
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                {item.childCount != null && <span style={S.badge}>{item.childCount}</span>}
                {hasKids && <IcoChev open={false} style={{ color: colors.gray }} />}
              </div>
            );
          })}
          {drillChildren.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: colors.gray, fontSize: 14 }}>No items at this level</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.shell}>
      {resolverModalEl}
      {/* ── TOP BAR ── */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>
            OSCAL Component Definition Viewer
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
            resolvedTitleForSource={resolvedTitleForSource}
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
  resolvedTitleForSource: (source: string) => string | null;
}

function ViewRouter({ view, cdef, navigate, resMap, bmRes, parties, catalog, resolvedTitleForSource }: ViewRouterProps) {
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
          resolvedTitleForSource={resolvedTitleForSource}
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
          resolvedTitleForSource={resolvedTitleForSource}
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
              resolvedTitleForSource={resolvedTitleForSource}
            />
          );
      }
    }
  }

  // res-group-*
  if (view.startsWith("res-group-")) {
    const type = view.replace("res-group-", "");
    const filtered = bmRes.filter((r) => backMatterResourceType(r) === type);
    const meta = backMatterResourceVisual(type);
    return (
      <BackMatterView
        resources={filtered}
        navigate={navigate}
        title={meta.label}
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
        backgroundColor: colors.card,
        borderRadius: radii.md,
        padding: "20px 24px",
        boxShadow: shadows.sm,
        marginBottom: 16,
        overflow: "hidden" as const,
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

function VisualSummaryField({
  label,
  value,
  icon,
  color,
  mono,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 78,
        padding: "12px 14px",
        borderRadius: radii.md,
        backgroundColor: alpha(color, 7),
        border: `1px solid ${alpha(color, 22)}`,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: radii.md,
          backgroundColor: alpha(color, 14),
          color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {cdefVisualIcon(icon, 22, color)}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: colors.black, marginTop: 4, fontFamily: mono ? fonts.mono : fonts.sans, overflow: "hidden", textOverflow: "ellipsis", overflowWrap: "anywhere" }}>
          {value || "—"}
        </span>
      </span>
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

function LlmGeneratedBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: radii.pill,
        backgroundColor: alpha(colors.purple, 12),
        color: colors.purple,
        fontWeight: 700,
      }}
    >
      <IcoBulb size={12} />
      LLM Generated
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DROP ZONE  (shown when no file is loaded)
   ═══════════════════════════════════════════════════════════════════════════ */

function DropZone({ onFile, error, sourceUrl }: { onFile: (f: File) => void; error: string; sourceUrl?: string | null }) {
  const [dragging, setDragging] = useState(false);
  const [, setSearchParams] = useSearchParams();
  const [urlInput, setUrlInput] = useState("");
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
    <div style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <IcoShield size={48} style={{ color: colors.navy }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>
          OSCAL Component Definition Viewer
        </h2>
        <p style={{ fontSize: 14, color: colors.gray, marginTop: 4 }}>
          {brand.footerText}
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
          backgroundColor: dragging ? colors.dropzoneBg : colors.card,
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
          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 16, padding: "12px 16px", backgroundColor: colors.errorBg, border: `1px solid ${colors.red}`, borderRadius: radii.md, textAlign: "left", maxWidth: 480, width: "100%" }}>
            <p style={{ fontSize: 13, color: colors.red, fontWeight: 600, margin: 0 }}>{error}</p>
            {sourceUrl && (
              <>
                <p style={{ fontSize: 12, color: colors.gray, marginTop: 8, marginBottom: 0, wordBreak: "break-all", fontFamily: fonts.mono }}>{sourceUrl}</p>
                <p style={{ fontSize: 12, color: colors.gray, marginTop: 8, marginBottom: 0 }}>
                  The remote file may have moved or been deleted.{" "}
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: colors.brightBlue, fontWeight: 500 }}>Open URL directly</a>{" "}
                  to verify it exists.
                </p>
              </>
            )}
          </div>
        )}
      </div>
      {/* ── Or fetch from URL ── */}
      <div style={{ maxWidth: 520, margin: "20px auto 0", textAlign: "left" }}>
        <p style={{ fontSize: 13, color: colors.gray, marginBottom: 8, textAlign: "center" }}>or load from a URL</p>
        <form
          onSubmit={(e) => { e.preventDefault(); const t = urlInput.trim(); if (t) setSearchParams({ url: t }); }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/component-definition.json"
            style={{
              flex: 1, padding: "8px 12px", fontSize: 13, fontFamily: fonts.mono,
              border: `1px solid ${colors.paleGray}`, borderRadius: radii.sm,
              backgroundColor: colors.bg, color: colors.black,
            }}
          />
          <button
            type="submit"
            disabled={!urlInput.trim()}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 600, fontFamily: fonts.sans,
              border: "none", borderRadius: radii.sm,
              backgroundColor: urlInput.trim() ? colors.navy : colors.paleGray,
              color: colors.white, cursor: urlInput.trim() ? "pointer" : "default",
            }}
          >
            Fetch
          </button>
        </form>
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
  const catalogSort = useCatalogSortIndex();
  const comps = cdef.components ?? [];
  const allReqs = comps.flatMap((c) =>
    (c["control-implementations"] ?? []).flatMap(
      (ci) => ci["implemented-requirements"],
    ),
  );
  const familySet = new Set(allReqs.map((r) => familyOf(r["control-id"])));
  const resources = cdef["back-matter"]?.resources ?? [];

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

      {/* Family pills */}
      <Card>
        <SectionLabel>Control Families Covered</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Array.from(familySet)
            .sort((a, b) => catalogSort.compare(a, b))
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
        {comps.map((comp, i) => {
          const visual = resolveComponentVisual(comp);
          return (
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
            {cdefVisualIcon(visual.iconKey, 16, visual.color)}
            <div>
              <div
                style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}
              >
                {comp.title}
              </div>
              <div style={{ fontSize: 12, color: colors.gray }}>
                Type: {comp.type} ·{" "}
                {visual.assetType ? `Asset: ${visual.assetType} · ` : ""}
                {(comp["control-implementations"] ?? []).reduce(
                  (s, ci) => s + ci["implemented-requirements"].length,
                  0,
                )}{" "}
                requirements
              </div>
            </div>
          </div>
          );
        })}
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
          <PartyCardGrid parties={parties} />
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
          <ResponsiblePartiesList responsibleParties={rps} parties={parties} roles={roles} />
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
  resolvedTitleForSource,
}: {
  comp: Component;
  compIdx: number;
  parties: Party[];
  navigate: (id: string) => void;
  resolvedTitleForSource: (source: string) => string | null;
}) {
  void _parties;
  const catalogSort = useCatalogSortIndex();
  const impls = comp["control-implementations"] ?? [];
  const allReqs = impls.flatMap((ci) => ci["implemented-requirements"]);
  const familySet = new Set(allReqs.map((r) => familyOf(r["control-id"])));
  const visual = resolveComponentVisual(comp);
  const raisedProps = raisedOscalProps(comp.props ?? []);
  const raisedPropKeys = new Set(raisedProps.map((p) => `${p.name}\u0000${p.value}\u0000${p.ns ?? ""}\u0000${p.class ?? ""}`));
  const otherProps = (comp.props ?? []).filter((p) => !raisedPropKeys.has(`${p.name}\u0000${p.value}\u0000${p.ns ?? ""}\u0000${p.class ?? ""}`));
  const firstClassProps = raisedProps.filter((p) => p.name !== "label" && p.name !== "asset-type");
  const typeVisual = componentTypeVisual(comp.type);

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
        {cdefVisualIcon(visual.iconKey, 22, visual.color)}
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {comp.title}
        </h1>
      </div>

      <Card>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 10,
          }}
        >
          <VisualSummaryField label="Type" value={comp.type} icon={typeVisual.iconKey} color={typeVisual.color} />
          {(visual.assetType || visual.localAssetType) && (
            <VisualSummaryField label="Asset Type" value={visual.assetType ?? visual.localAssetType ?? ""} icon={visual.iconKey} color={visual.color} />
          )}
          {firstClassProps.map((p, i) => {
            const propMeta = propVisual(p);
            return (
              <VisualSummaryField key={`${p.name}-${i}`} label={propMeta.label} value={p.value} icon={propMeta.iconKey} color={propMeta.color} mono={p.name === "model"} />
            );
          })}
          <VisualSummaryField
            label="Control Implementations"
            value={String(impls.length)}
            icon="layers"
            color={colors.brightBlue}
          />
          <VisualSummaryField label="Total Requirements" value={String(allReqs.length)} icon="shield" color={colors.orange} />
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
          <MarkupBlock value={comp.purpose} />
        </Card>
      )}

      {otherProps.length > 0 && (
        <Card>
          <SectionLabel>{raisedProps.length > 0 ? "Other Properties" : "Properties"}</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {otherProps.map((p, i) => (
              <PropPill key={i} name={propDisplayName(p)} value={p.value} />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionLabel>Control Families ({familySet.size})</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Array.from(familySet)
            .sort((a, b) => catalogSort.compare(a, b))
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
                {implLabel(impl, ii, resolvedTitleForSource(impl.source))}
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
  resolvedTitleForSource,
}: {
  impl: ControlImplementation;
  comp: Component;
  compIdx: number;
  implIdx: number;
  parties: Party[];
  navigate: (id: string) => void;
  resMap: Record<string, Resource>;
  resolvedTitleForSource: (source: string) => string | null;
}) {
  void _parties;
  void _resMap;
  const catalogSort = useCatalogSortIndex();
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
            label: implLabel(impl, implIdx, resolvedTitleForSource(impl.source)),
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
          {implLabel(impl, implIdx, resolvedTitleForSource(impl.source))}
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

      {impl.remarks && (
        <Card style={{ borderLeft: `4px solid ${colors.cobalt}` }}>
          <CollapsibleRemarks value={impl.remarks} />
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
            .sort((a, b) => catalogSort.compare(a, b))
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
          const isLlmGenerated = !!llmGeneratedLabel(req.props);
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
              {isLlmGenerated && <LlmGeneratedBadge />}
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
    <span style={{ fontSize: 13, lineHeight: 1.75, color: colors.black, fontFamily: fonts.sans, overflowWrap: "break-word" as const, wordBreak: "break-word" as const }}>
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
                fontSize: 13,
                fontFamily: fonts.mono,
                fontWeight: 600,
                color: isSelection ? colors.cobalt : colors.orange,
                backgroundColor: isSelection
                  ? alpha(colors.cobalt, 7)
                  : alpha(colors.orange, 7),
                padding: "1px 6px",
                borderRadius: radii.sm,
                border: `1px solid ${
                  isSelection ? alpha(colors.cobalt, 20) : alpha(colors.orange, 20)
                }`,
                whiteSpace: "normal" as const,
                overflowWrap: "break-word" as const,
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
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "2px 0", minWidth: 0 }}>
            {partLabel && (
              <span style={{ fontWeight: 600, color: colors.cobalt, marginRight: 2, fontSize: 13, fontFamily: fonts.mono }}>
                {partLabel}
              </span>
            )}
            <span style={{ minWidth: 0, flex: 1 }}><CatalogProseWithParams text={part.prose} paramMap={paramMap} /></span>
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
  resolvedTitleForSource,
}: {
  req: ImplementedRequirement;
  comp: Component;
  compIdx: number;
  implIdx: number;
  parties: Party[];
  navigate: (id: string) => void;
  resMap: Record<string, Resource>;
  catalog: OscalCatalog | null;
  resolvedTitleForSource: (source: string) => string | null;
}) {
  const impl = comp["control-implementations"]?.[implIdx];
  const statements = req.statements ?? [];
  const links = req.links ?? [];
  const partyByUuid = useMemo(() => new Map(parties.map((party) => [party.uuid, party])), [parties]);

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
            label: impl ? implLabel(impl, implIdx, resolvedTitleForSource(impl.source)) : `Control Implementation ${implIdx + 1}`,
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

      {/* UUID */}
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
        {llmGeneratedLabel(req.props) && <LlmGeneratedBadge />}
      </div>

      {/* Catalog control details */}
      {catalogControl ? (
        <CatalogControlCard control={catalogControl} paramMap={catalogParamMap} />
      ) : (
        <Card
          style={{
            backgroundColor: colors.warningBg,
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

      {/* Remarks */}
      {req.remarks && (
        <Card
          style={{
            borderLeft: `4px solid ${colors.cobalt}`,
          }}
        >
          <CollapsibleRemarks value={req.remarks} />
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
                      backgroundColor: alpha(colors.cobalt, 3),
                      border: `1px solid ${alpha(colors.cobalt, 13)}`,
                      borderRadius: radii.sm,
                      marginBottom: 8,
                      fontStyle: "italic",
                      overflowWrap: "break-word" as const,
                      wordBreak: "break-word" as const,
                    }}
                  >
                    {getCatalogLabel(catalogPart.props) && (
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, marginRight: 6, fontStyle: "normal" }}>
                        {getCatalogLabel(catalogPart.props)}
                      </span>
                    )}
                    <CatalogProseWithParams text={catalogPart.prose} paramMap={catalogParamMap} />
                  </div>
                )}
                {/* Implementation description for this statement */}
                {stmt.description && (
                  <MarkupBlock value={stmt.description} />
                )}
                {stmt.remarks && (
                  <CollapsibleRemarks value={stmt.remarks} compact />
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
            <div style={{ display: "grid", gap: 8 }}>
              {req["responsible-roles"].map((rr, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    padding: "8px 10px",
                    borderRadius: radii.md,
                    backgroundColor: colors.surfaceSubtle,
                    border: `1px solid ${colors.paleGray}`,
                  }}
                >
                  <span style={{ fontSize: 12, color: colors.navy, fontWeight: 800, fontFamily: fonts.mono }}>
                    {rr["role-id"]}
                  </span>
                  {(rr["party-uuids"] ?? [])
                    .map((pu) => <PartyChip key={pu} party={partyByUuid.get(pu)} fallbackUuid={pu} />)}
                </div>
              ))}
            </div>
          </Card>
        )}

      {/* Links / references */}
      {resolvedLinks.length > 0 && (() => {
        const chips: ResolvedLink[] = resolvedLinks.map((lk) => {
          if (lk.resolved) {
            const r = lk.resolved;
            const frag = lk["resource-fragment"];
            const baseTitle = r.title ?? "Untitled";
            const text = frag ? `${baseTitle} — ${frag}` : baseTitle;
            const baseHref = r.rlinks?.[0]?.href;
            const href = baseHref && frag ? `${baseHref}#${frag}` : baseHref;
            return {
              text,
              href,
              rel: lk.rel,
              onClick: !href ? () => navigate(`res-${r.uuid}`) : undefined,
            };
          }
          if (!lk.href.startsWith("#")) {
            return { text: lk.text ?? lk.href, href: lk.href, rel: lk.rel };
          }
          return null;
        }).filter(Boolean) as ResolvedLink[];
        return chips.length > 0 ? (
          <Card>
            <LinkChips links={chips} />
          </Card>
        ) : null;
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
      const t = backMatterResourceType(r);
      const meta = backMatterResourceVisual(t);
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
            const meta = backMatterResourceVisual(r);
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
                {resIcon(meta.iconKey, 14, {
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
  const type = backMatterResourceType(res);
  const meta = backMatterResourceVisual(type);
  const base64Link = backMatterBase64Link(res);

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
        {resIcon(meta.iconKey, 22, {
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

      {base64Link && (
        <Card>
          <SectionLabel>Embedded Attachment</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <IcoPaperclip size={13} style={{ color: colors.orange }} />
            <a href={base64Link.href} download={base64Link.filename} style={{ fontSize: 13, color: colors.brightBlue }}>
              {base64Link.filename}
            </a>
            {base64Link.mediaType && (
              <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{base64Link.mediaType}</span>
            )}
          </div>
        </Card>
      )}

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
    backgroundColor: colors.card,
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
  mobileBackBtn: {
    fontSize: 14, fontWeight: 600, padding: "6px 12px", borderRadius: radii.sm,
    border: "none", cursor: "pointer", backgroundColor: "transparent", color: colors.white, minHeight: 44,
  },
  mobileBreadcrumbs: {
    display: "flex", flexWrap: "wrap" as const, gap: 2, padding: "10px 16px",
    fontSize: 12, color: colors.gray, borderBottom: `1px solid ${colors.bg}`, backgroundColor: colors.bg,
  },

};
