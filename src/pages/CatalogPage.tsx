/* ═══════════════════════════════════════════════════════════════════════════
   Catalog Page — SPA-style viewer for OSCAL Catalogs
   Left sidebar treeview (groups → sub-groups → controls)
   Right content panel with 5 part sections rendered hierarchically
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
import { alpha, colors, fonts, shadows, radii, brand } from "../theme/tokens";
import { useOscal } from "../context/OscalContext";
import { useUrlDocument, fileNameFromUrl } from "../hooks/useUrlDocument";
import LinkChips from "../components/LinkChips";
import type { ResolvedLink } from "../components/LinkChips";
import type {
  Catalog,
  Control,
  Group,
  Part,
  Param,
  Resource,
  OscalProp,
} from "../context/OscalContext";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** The 5 part sections we display on a control detail page */
const PART_SECTIONS: { name: string; label: string; icon: string; color: string }[] = [
  { name: "overview", label: "Overview", icon: "info", color: colors.cobalt },
  { name: "statement", label: "Statement", icon: "list", color: colors.navy },
  { name: "guidance", label: "Guidance", icon: "book", color: colors.brightBlue },
  { name: "example", label: "Examples", icon: "bulb", color: colors.orange },
  { name: "assessment-method", label: "Assessment Method", icon: "check", color: colors.mint },
];

/**
 * Render a single param according to OSCAL rendering rules.
 * Selection  → [Selection: choice1; choice2]  or  [Selection (one or more): ...]
 * Assignment → [Assignment: <label>]  or  [Assignment: <id>]
 */
function renderParamText(param: Param, paramMap: Record<string, Param>): string {
  if (param.select) {
    const howMany = param.select["how-many"];
    const prefix = howMany === "one-or-more" ? "Selection (one or more)" : "Selection";
    const choices = (param.select.choice ?? []).map((c) => resolveInlineParams(c, paramMap));
    return `[${prefix}: ${choices.join("; ")}]`;
  }
  const label = param.label ? resolveInlineParams(param.label, paramMap) : param.id;
  return `[Assignment: ${label}]`;
}

/**
 * Replace all {{ insert: param, <id> }} tokens in a string with
 * the rendered form of the referenced parameter.
 */
function resolveInlineParams(text: string, paramMap: Record<string, Param>): string {
  // Pattern: {{ insert: param, <param-id> }}
  return text.replace(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/g, (_match, id: string) => {
    const param = paramMap[id.trim()];
    if (!param) return `[Assignment: ${id.trim()}]`;
    return renderParamText(param, paramMap);
  });
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

/** Get the label prop from a control/group */
function getLabel(props?: OscalProp[]): string {
  if (!props) return "";
  // prefer the non-zero-padded label
  const lbl = props.find((p) => p.name === "label" && p.class !== "zero-padded");
  return lbl?.value ?? props.find((p) => p.name === "label")?.value ?? "";
}

/** Count all controls (including enhancements) under a group recursively */
function countControls(group: Group): number {
  let count = 0;
  (group.controls ?? []).forEach((c) => {
    count += 1;
    count += (c.controls ?? []).length; // enhancements
  });
  (group.groups ?? []).forEach((g) => {
    count += countControls(g);
  });
  return count;
}

/** Flatten all controls in the catalog for searching / counting */
function allControlsFlat(catalog: Catalog): Control[] {
  const result: Control[] = [];
  function walkGroup(g: Group) {
    (g.controls ?? []).forEach((c) => {
      result.push(c);
      (c.controls ?? []).forEach((enh) => result.push(enh));
    });
    (g.groups ?? []).forEach(walkGroup);
  }
  (catalog.groups ?? []).forEach(walkGroup);
  (catalog.controls ?? []).forEach((c) => {
    result.push(c);
    (c.controls ?? []).forEach((enh) => result.push(enh));
  });
  return result;
}

/** Find a control by id anywhere in the catalog */
function findControl(catalog: Catalog, id: string): Control | undefined {
  function searchGroup(g: Group): Control | undefined {
    for (const c of g.controls ?? []) {
      if (c.id === id) return c;
      for (const enh of c.controls ?? []) {
        if (enh.id === id) return enh;
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
    if (c.id === id) return c;
    for (const enh of c.controls ?? []) {
      if (enh.id === id) return enh;
    }
  }
  return undefined;
}

/** Find the group a control belongs to */
function findControlGroup(catalog: Catalog, controlId: string): Group | undefined {
  function searchGroup(g: Group): Group | undefined {
    for (const c of g.controls ?? []) {
      if (c.id === controlId) return g;
      for (const enh of c.controls ?? []) {
        if (enh.id === controlId) return g;
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
  return undefined;
}

/** Find the parent control of an enhancement */
function findParentControl(catalog: Catalog, enhId: string): Control | undefined {
  function searchGroup(g: Group): Control | undefined {
    for (const c of g.controls ?? []) {
      for (const enh of c.controls ?? []) {
        if (enh.id === enhId) return c;
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
  return undefined;
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE SVG ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconProps { size?: number; style?: CSSProperties }

function IcoUpload({ size = 20, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
}
function IcoBook({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>;
}
function IcoFolder({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>;
}
function IcoShield({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function IcoHome({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
}
function IcoInfo({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
}
function IcoList({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
}
function IcoBulb({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" /></svg>;
}
function IcoCheck({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function IcoChev({ open, style }: { open: boolean; style?: CSSProperties }) {
  return (
    <svg
      style={{ ...style, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform .15s", flexShrink: 0 }}
      width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IcoLink({ size = 14, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>;
}
function IcoTag({ size = 14, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;
}
function IcoSearch({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}

function sectionIcon(icon: string, size = 16, style?: CSSProperties): ReactNode {
  switch (icon) {
    case "info": return <IcoInfo size={size} style={style} />;
    case "list": return <IcoList size={size} style={style} />;
    case "book": return <IcoBook size={size} style={style} />;
    case "bulb": return <IcoBulb size={size} style={style} />;
    case "check": return <IcoCheck size={size} style={style} />;
    default: return <IcoInfo size={size} style={style} />;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CatalogPage() {
  const oscal = useOscal();
  const catalog = oscal.catalog?.data ?? null;
  const fileName = oscal.catalog?.fileName ?? "";
  const [error, setError] = useState("");
  const [view, setView] = useState("overview"); // "overview" | "metadata" | "ctrl-{id}" | "group-{id}"
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  /* ── Auto-load from ?url= query param ── */
  const urlDoc = useUrlDocument();
  useEffect(() => {
    if (!urlDoc.json || oscal.catalog) return;
    try {
      const data = (urlDoc.json as Record<string, unknown>)["catalog"] ?? urlDoc.json;
      if (!(data as Record<string, unknown>).metadata)
        throw new Error("Not an OSCAL Catalog — no metadata found.");
      oscal.setCatalog(data as Catalog, fileNameFromUrl(urlDoc.sourceUrl!));
      setView("overview");
      setCollapsed({});
      setSearchTerm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse fetched document");
    }
  }, [urlDoc.json]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = useCallback((id: string) => {
    setView(id);
    contentRef.current?.scrollTo(0, 0);
  }, []);

  const loadFile = useCallback((file: File) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const data = json["catalog"] ?? json;
        if (!data.metadata)
          throw new Error("Not an OSCAL Catalog — no metadata found.");
        oscal.setCatalog(data as Catalog, file.name);
        setView("overview");
        setCollapsed({});
        setSearchTerm("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse JSON");
      }
    };
    reader.readAsText(file);
  }, [oscal]);

  const handleNewFile = useCallback(() => {
    oscal.clearCatalog();
    setError("");
    setView("overview");
    setSearchTerm("");
  }, [oscal]);

  /* ── Default all groups/controls-with-enhancements to collapsed ── */
  const defaultCollapsed = useMemo(() => {
    if (!catalog) return {} as Record<string, boolean>;
    const dc: Record<string, boolean> = {};
    function walkGroups(groups: Group[]) {
      groups.forEach((g) => {
        dc[`group-${g.id}`] = true;
        walkGroups(g.groups ?? []);
        (g.controls ?? []).forEach((c) => {
          if ((c.controls ?? []).length > 0) dc[`ctrl-${c.id}`] = true;
        });
      });
    }
    walkGroups(catalog.groups ?? []);
    (catalog.controls ?? []).forEach((c) => {
      if ((c.controls ?? []).length > 0) dc[`ctrl-${c.id}`] = true;
    });
    return dc;
  }, [catalog]);

  const mergedCollapsed = useMemo(() => {
    return { ...defaultCollapsed, ...collapsed };
  }, [defaultCollapsed, collapsed]);

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => {
      const current = prev[id] ?? defaultCollapsed[id] ?? false;
      return { ...prev, [id]: !current };
    });
  }, [defaultCollapsed]);

  /* ── If no file loaded, show drop zone ── */
  if (!catalog) {
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

  return (
    <div style={S.shell}>
      {/* ── TOP BAR ── */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>
            OSCAL Catalog Viewer
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.topBtn} onClick={handleNewFile}>New File</button>
        </div>
      </div>

      <div style={S.body}>
        {/* ── LEFT SIDEBAR ── */}
        <nav style={S.sidebar}>
          <div style={S.sidebarFilename}>{trunc(fileName, 36)}</div>

          {/* Search */}
          <div style={S.searchWrap}>
            <IcoSearch size={13} style={{ color: colors.gray, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search controls"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={S.searchInput}
            />
          </div>

          {/* Fixed nav items */}
          <NavRow id="overview" label="Overview" icon={<IcoHome size={14} style={{ color: colors.navy }} />}
            active={view === "overview"} onClick={() => navigate("overview")} depth={0} />
          <NavRow id="metadata" label="Metadata" icon={<IcoInfo size={14} style={{ color: colors.navy }} />}
            active={view === "metadata"} onClick={() => navigate("metadata")} depth={0} />

          {/* Tree view */}
          <SidebarTree
            catalog={catalog}
            view={view}
            collapsed={mergedCollapsed}
            searchTerm={searchTerm}
            navigate={navigate}
            toggleGroup={toggleGroup}
          />
        </nav>

        {/* ── CONTENT PANEL ── */}
        <div ref={contentRef} style={S.content}>
          <ViewRouter view={view} catalog={catalog} navigate={navigate} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAV ROW
   ═══════════════════════════════════════════════════════════════════════════ */

function NavRow({ id: _id, label, icon, active, onClick, depth, badge, hasChildren, expanded, onToggle }: {
  id: string; label: string; icon: ReactNode; active: boolean;
  onClick: () => void; depth: number; badge?: number;
  hasChildren?: boolean; expanded?: boolean; onToggle?: () => void;
}) {
  return (
    <div
      onClick={() => { if (hasChildren && onToggle) onToggle(); onClick(); }}
      style={{
        ...S.navItem,
        paddingLeft: 12 + depth * 16,
        backgroundColor: active ? alpha(colors.orange, 7) : "transparent",
        borderLeft: active ? `3px solid ${colors.orange}` : "3px solid transparent",
        fontWeight: active ? 600 : 400,
        color: active ? colors.orange : colors.black,
      }}
    >
      {hasChildren && <IcoChev open={!!expanded} style={{ marginRight: 4 }} />}
      {icon}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {badge != null && <span style={S.badge}>{badge}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR TREE — recursive groups → controls
   ═══════════════════════════════════════════════════════════════════════════ */

function SidebarTree({ catalog, view, collapsed, searchTerm, navigate, toggleGroup }: {
  catalog: Catalog; view: string; collapsed: Record<string, boolean>;
  searchTerm: string; navigate: (id: string) => void; toggleGroup: (id: string) => void;
}) {
  const lowerSearch = searchTerm.toLowerCase().trim();

  /** Check if a control matches the search */
  function controlMatches(c: Control): boolean {
    if (!lowerSearch) return true;
    if (c.id.toLowerCase().includes(lowerSearch)) return true;
    if (c.title.toLowerCase().includes(lowerSearch)) return true;
    const lbl = getLabel(c.props);
    if (lbl.toLowerCase().includes(lowerSearch)) return true;
    return false;
  }

  /** Check if any control in a group (recursively) matches */
  function groupHasMatch(g: Group): boolean {
    if (!lowerSearch) return true;
    if (g.title.toLowerCase().includes(lowerSearch)) return true;
    if ((g.controls ?? []).some((c) => controlMatches(c) || (c.controls ?? []).some(controlMatches))) return true;
    return (g.groups ?? []).some(groupHasMatch);
  }

  function renderGroup(g: Group, depth: number): ReactNode {
    if (lowerSearch && !groupHasMatch(g)) return null;
    const gId = `group-${g.id}`;
    const isCollapsed = !!collapsed[gId];
    const cCount = countControls(g);
    const hasKids = cCount > 0 || (g.groups ?? []).length > 0;

    return (
      <div key={g.id}>
        <NavRow
          id={gId}
          label={`${getLabel(g.props) ? getLabel(g.props) + " " : ""}${g.title}`}
          icon={<IcoFolder size={14} style={{ color: colors.cobalt }} />}
          active={view === gId}
          onClick={() => navigate(gId)}
          depth={depth}
          badge={cCount}
          hasChildren={hasKids}
          expanded={!isCollapsed}
          onToggle={() => toggleGroup(gId)}
        />
        {!isCollapsed && (
          <>
            {(g.groups ?? []).map((sg) => renderGroup(sg, depth + 1))}
            {(g.controls ?? []).map((c) => renderControl(c, depth + 1))}
          </>
        )}
      </div>
    );
  }

  function renderControl(c: Control, depth: number): ReactNode {
    if (lowerSearch && !controlMatches(c) && !(c.controls ?? []).some(controlMatches)) return null;
    const cId = `ctrl-${c.id}`;
    const enhancements = c.controls ?? [];
    const hasEnhancements = enhancements.length > 0;
    const isCollapsed = !!collapsed[cId];
    const lbl = getLabel(c.props);

    return (
      <div key={c.id}>
        <NavRow
          id={cId}
          label={`${lbl ? lbl + " " : ""}${c.title}`}
          icon={<IcoShield size={13} style={{ color: colors.brightBlue }} />}
          active={view === cId}
          onClick={() => navigate(cId)}
          depth={depth}
          badge={hasEnhancements ? enhancements.length : undefined}
          hasChildren={hasEnhancements}
          expanded={!isCollapsed}
          onToggle={() => toggleGroup(cId)}
        />
        {hasEnhancements && !isCollapsed && enhancements.map((enh) => {
          if (lowerSearch && !controlMatches(enh)) return null;
          const enhLabel = getLabel(enh.props);
          return (
            <NavRow
              key={enh.id}
              id={`ctrl-${enh.id}`}
              label={`${enhLabel ? enhLabel + " " : ""}${enh.title}`}
              icon={<IcoTag size={12} style={{ color: colors.orange }} />}
              active={view === `ctrl-${enh.id}`}
              onClick={() => navigate(`ctrl-${enh.id}`)}
              depth={depth + 1}
            />
          );
        })}
      </div>
    );
  }

  return (
    <>
      {(catalog.groups ?? []).map((g) => renderGroup(g, 0))}
      {(catalog.controls ?? []).map((c) => renderControl(c, 0))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW ROUTER
   ═══════════════════════════════════════════════════════════════════════════ */

function ViewRouter({ view, catalog, navigate }: {
  view: string; catalog: Catalog; navigate: (id: string) => void;
}) {
  if (view === "overview") return <OverviewView catalog={catalog} navigate={navigate} />;
  if (view === "metadata") return <MetadataView catalog={catalog} navigate={navigate} />;

  if (view.startsWith("group-")) {
    const gId = view.replace("group-", "");
    const group = findGroupById(catalog, gId);
    if (group) return <GroupView group={group} catalog={catalog} navigate={navigate} />;
  }

  if (view.startsWith("ctrl-")) {
    const cId = view.replace("ctrl-", "");
    const control = findControl(catalog, cId);
    if (control) return <ControlView control={control} catalog={catalog} navigate={navigate} />;
  }

  return <NotFoundView navigate={navigate} />;
}

function findGroupById(catalog: Catalog, id: string): Group | undefined {
  function search(groups: Group[]): Group | undefined {
    for (const g of groups) {
      if (g.id === id) return g;
      const found = search(g.groups ?? []);
      if (found) return found;
    }
    return undefined;
  }
  return search(catalog.groups ?? []);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Breadcrumbs({ items, navigate }: { items: { id: string; label: string }[]; navigate: (id: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, fontSize: 12, color: colors.gray, marginBottom: 8, flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <span key={item.id}>
          <span
            onClick={() => navigate(item.id)}
            style={{ cursor: "pointer", color: i < items.length - 1 ? colors.brightBlue : colors.black, fontWeight: i === items.length - 1 ? 600 : 400 }}
          >
            {item.label}
          </span>
          {i < items.length - 1 && <span style={{ margin: "0 4px", color: colors.paleGray }}>/</span>}
        </span>
      ))}
    </div>
  );
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ backgroundColor: colors.white, borderRadius: radii.md, padding: "20px 24px", boxShadow: shadows.sm, marginBottom: 16, ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: colors.gray, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function MField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: colors.black, marginTop: 2, fontFamily: mono ? fonts.mono : fonts.sans, wordBreak: "break-all" }}>{value || "—"}</div>
    </div>
  );
}

function PropPill({ name, value }: { name: string; value: string }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11, padding: "2px 8px", borderRadius: radii.pill,
      backgroundColor: colors.bg, color: colors.black, fontFamily: fonts.mono,
      border: `1px solid ${colors.paleGray}`, marginRight: 6, marginBottom: 4,
    }}>
      {name}: {value}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DROP ZONE
   ═══════════════════════════════════════════════════════════════════════════ */

function DropZone({ onFile, error, sourceUrl }: { onFile: (f: File) => void; error: string; sourceUrl?: string | null }) {
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
        <IcoBook size={48} style={{ color: colors.navy }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>OSCAL Catalog Viewer</h2>
        <p style={{ fontSize: 14, color: colors.gray, marginTop: 4 }}>{brand.footerText}</p>
      </div>
      <div
        onClick={handleClick}
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
        }}
      >
        <IcoUpload size={40} style={{ color: colors.gray }} />
        <p style={{ marginTop: 12, fontSize: 15, color: colors.black }}>
          Drop an OSCAL <strong>Catalog</strong> JSON file here
        </p>
        <p style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>or click to browse</p>
        {error && (
          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 16, padding: "12px 16px", backgroundColor: "#fff5f5", border: `1px solid ${colors.red}`, borderRadius: radii.md, textAlign: "left", maxWidth: 480, width: "100%" }}>
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewView({ catalog, navigate }: { catalog: Catalog; navigate: (id: string) => void }) {
  const groups = catalog.groups ?? [];
  const allCtrls = useMemo(() => allControlsFlat(catalog), [catalog]);
  const familyCount = groups.length;

  // Count withdrawn vs active
  const withdrawn = allCtrls.filter((c) => (c.props ?? []).some((p) => p.name === "status" && p.value === "withdrawn")).length;
  const active = allCtrls.length - withdrawn;

  return (
    <div>
      <h1 style={{ fontSize: 22, color: colors.navy, marginBottom: 4 }}>{catalog.metadata.title}</h1>
      <p style={{ fontSize: 13, color: colors.gray, marginBottom: 20 }}>
        Version {catalog.metadata.version ?? "—"} · OSCAL {catalog.metadata["oscal-version"] ?? "—"} · Last modified {fmtDate(catalog.metadata["last-modified"])}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Control Families", value: familyCount, color: colors.cobalt },
          { label: "Total Controls", value: allCtrls.length, color: colors.navy },
          { label: "Active Controls", value: active, color: colors.mint },
          { label: "Withdrawn", value: withdrawn, color: colors.red },
        ].map((s) => (
          <Card key={s.label} style={{ textAlign: "center", borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: colors.black, marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionLabel>Control Families</SectionLabel>
        {groups.map((g) => {
          const ct = countControls(g);
          const lbl = getLabel(g.props);
          return (
            <div
              key={g.id}
              onClick={() => navigate(`group-${g.id}`)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}
            >
              <IcoFolder size={16} style={{ color: colors.cobalt }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>
                  {lbl ? `${lbl} ` : ""}{g.title}
                </div>
              </div>
              <span style={{ fontSize: 12, color: colors.gray }}>{ct} controls</span>
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

function MetadataView({ catalog: cat, navigate }: { catalog: Catalog; navigate: (id: string) => void }) {
  const meta = cat.metadata;
  const catalog = cat;
  const parties = meta.parties ?? [];
  const roles = meta.roles ?? [];

  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: "metadata", label: "Metadata" }]} navigate={navigate} />
      <h1 style={{ fontSize: 20, color: colors.navy, marginBottom: 16 }}>Document Metadata</h1>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 16 }}>
          <MField label="Title" value={meta.title} />
          <MField label="Version" value={meta.version ?? "—"} />
          <MField label="Last Modified" value={fmtDate(meta["last-modified"])} />
          <MField label="OSCAL Version" value={meta["oscal-version"] ?? "—"} />
          <MField label="Document UUID" value={catalog.uuid} mono />
        </div>
      </Card>

      {parties.length > 0 && (
        <Card>
          <SectionLabel>Parties</SectionLabel>
          {parties.map((p) => (
            <div key={p.uuid} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{p.name}</div>
              <div style={{ fontSize: 12, color: colors.gray }}>{p.type}{p["short-name"] ? ` · ${p["short-name"]}` : ""}</div>
              <div style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{p.uuid}</div>
            </div>
          ))}
        </Card>
      )}

      {roles.length > 0 && (
        <Card>
          <SectionLabel>Roles</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {roles.map((r) => (
              <span key={r.id} style={{ fontSize: 12, padding: "4px 12px", borderRadius: radii.pill, backgroundColor: colors.navy, color: colors.white, fontWeight: 500 }}>
                {r.title}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUP VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function GroupView({ group, catalog: _catalog, navigate }: { group: Group; catalog: Catalog; navigate: (id: string) => void }) {
  void _catalog;
  const lbl = getLabel(group.props);
  const controls = group.controls ?? [];
  const subGroups = group.groups ?? [];

  // Build breadcrumbs — walk up group hierarchy
  const crumbs: { id: string; label: string }[] = [{ id: "overview", label: "Overview" }];
  // simple: just show the group
  crumbs.push({ id: `group-${group.id}`, label: `${lbl ? lbl + " " : ""}${group.title}` });

  return (
    <div>
      <Breadcrumbs items={crumbs} navigate={navigate} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <IcoFolder size={22} style={{ color: colors.cobalt }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>{lbl ? `${lbl} ` : ""}{group.title}</h1>
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 16 }}>
          <MField label="Family ID" value={group.id.toUpperCase()} mono />
          <MField label="Controls" value={String(controls.length)} />
          <MField label="Sub-Groups" value={String(subGroups.length)} />
          <MField label="Total (incl. enhancements)" value={String(countControls(group))} />
        </div>
      </Card>

      {/* Group parts (overview text) */}
      {group.parts && group.parts.length > 0 && (
        <Card>
          {group.parts.map((p, i) => (
            <div key={i}>
              {p.prose && <p style={{ fontSize: 13, lineHeight: 1.75, color: colors.black }}>{p.prose}</p>}
            </div>
          ))}
        </Card>
      )}

      {subGroups.length > 0 && (
        <Card>
          <SectionLabel>Sub-Groups</SectionLabel>
          {subGroups.map((sg) => {
            const sgLbl = getLabel(sg.props);
            return (
              <div key={sg.id} onClick={() => navigate(`group-${sg.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}>
                <IcoFolder size={14} style={{ color: colors.cobalt }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{sgLbl ? `${sgLbl} ` : ""}{sg.title}</span>
                <span style={{ fontSize: 12, color: colors.gray, marginLeft: "auto" }}>{countControls(sg)} controls</span>
              </div>
            );
          })}
        </Card>
      )}

      <Card>
        <SectionLabel>Controls ({controls.length})</SectionLabel>
        {controls.map((c) => {
          const cLbl = getLabel(c.props);
          const enhCount = (c.controls ?? []).length;
          const isWithdrawn = (c.props ?? []).some((p) => p.name === "status" && p.value === "withdrawn");
          return (
            <div
              key={c.id}
              onClick={() => navigate(`ctrl-${c.id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                borderBottom: `1px solid ${colors.bg}`, cursor: "pointer",
                opacity: isWithdrawn ? 0.5 : 1,
              }}
            >
              <IcoShield size={14} style={{ color: isWithdrawn ? colors.gray : colors.brightBlue }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy, minWidth: 56 }}>
                {cLbl || c.id.toUpperCase()}
              </span>
              <span style={{ fontSize: 13, color: colors.black, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title}
              </span>
              {isWithdrawn && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.paleGray, color: colors.gray, fontWeight: 600 }}>
                  Withdrawn
                </span>
              )}
              {enhCount > 0 && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.bg, color: colors.gray, fontWeight: 600 }}>
                  +{enhCount}
                </span>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTROL VIEW — the main detail page
   Shows 5 sections from parts: overview, statement, guidance, example, assessment-method
   Each part is hierarchical — rendered recursively
   ═══════════════════════════════════════════════════════════════════════════ */

function ControlView({ control, catalog, navigate }: {
  control: Control; catalog: Catalog; navigate: (id: string) => void;
}) {
  const lbl = getLabel(control.props);
  const isWithdrawn = (control.props ?? []).some((p) => p.name === "status" && p.value === "withdrawn");
  const enhancements = control.controls ?? [];
  const params = control.params ?? [];
  const links = control.links ?? [];

  // Build param map from this control + parent enhancements (for nested refs)
  const paramMap = useMemo(() => {
    const map: Record<string, Param> = {};
    // If this is an enhancement, include parent control params
    const parent = findParentControl(catalog, control.id);
    if (parent) (parent.params ?? []).forEach((p) => { map[p.id] = p; });
    // This control's own params (override parent if same id)
    params.forEach((p) => { map[p.id] = p; });
    // Also include enhancement params
    enhancements.forEach((enh) => (enh.params ?? []).forEach((p) => { map[p.id] = p; }));
    return map;
  }, [control, catalog, params, enhancements]);

  // Build breadcrumbs
  const crumbs: { id: string; label: string }[] = [{ id: "overview", label: "Overview" }];
  const parentGroup = findControlGroup(catalog, control.id);
  if (parentGroup) {
    const gLbl = getLabel(parentGroup.props);
    crumbs.push({ id: `group-${parentGroup.id}`, label: `${gLbl ? gLbl + " " : ""}${parentGroup.title}` });
  }
  // Check if this is an enhancement
  const parentCtrl = findParentControl(catalog, control.id);
  if (parentCtrl) {
    const pLbl = getLabel(parentCtrl.props);
    crumbs.push({ id: `ctrl-${parentCtrl.id}`, label: `${pLbl ? pLbl + " " : ""}${parentCtrl.title}` });
  }
  crumbs.push({ id: `ctrl-${control.id}`, label: `${lbl ? lbl + " " : ""}${control.title}` });

  // Partition parts into the 5 sections
  const allParts = control.parts ?? [];
  const sectionParts: Record<string, Part[]> = {};
  PART_SECTIONS.forEach((s) => {
    sectionParts[s.name] = allParts.filter((p) => p.name === s.name);
  });

  // Resolve back-matter links
  const resources = catalog["back-matter"]?.resources ?? [];
  const resMap: Record<string, Resource> = {};
  resources.forEach((r) => { resMap[r.uuid] = r; });

  const resolvedLinks = links
    .filter((lk) => !lk.rel || lk.rel === "related" || lk.rel === "reference" || lk.rel === "required")
    .map((lk) => {
      const m = lk.href.match(/^#(.+)/);
      if (m) {
        const res = resMap[m[1]];
        if (res) return { ...lk, resource: res };
      }
      return { ...lk, resource: undefined as Resource | undefined };
    });

  return (
    <div>
      <Breadcrumbs items={crumbs} navigate={navigate} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoShield size={22} style={{ color: colors.navy }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {lbl ? `${lbl} ` : ""}{control.title}
        </h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: colors.gray, fontFamily: fonts.mono }}>{control.id}</span>
        {isWithdrawn && (
          <span style={{
            fontSize: 11, padding: "2px 10px", borderRadius: radii.pill,
            backgroundColor: colors.red, color: colors.white, fontWeight: 600,
          }}>
            Withdrawn
          </span>
        )}
        {control.class && (
          <span style={{
            fontSize: 11, padding: "2px 10px", borderRadius: radii.pill,
            backgroundColor: colors.bg, color: colors.gray, fontWeight: 600,
            border: `1px solid ${colors.paleGray}`,
          }}>
            {control.class}
          </span>
        )}
      </div>

      {/* Withdrawn notice */}
      {isWithdrawn && (
        <Card style={{ backgroundColor: "#FFF0F0", borderLeft: `4px solid ${colors.red}` }}>
          <div style={{ fontSize: 13, color: colors.black }}>
            <strong>This control has been withdrawn.</strong>
            {(() => {
              const wLink = links.find((l) => l.rel === "moved-to");
              if (wLink) {
                const targetId = wLink.href.replace("#", "");
                return (
                  <span>
                    {" "}Incorporated into{" "}
                    <span onClick={() => navigate(`ctrl-${targetId}`)}
                      style={{ color: colors.brightBlue, cursor: "pointer", fontWeight: 600 }}>
                      {targetId.toUpperCase()}
                    </span>.
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </Card>
      )}

      {/* 5 Part Sections */}
      {PART_SECTIONS.map((sec) => {
        const parts = sectionParts[sec.name];
        if (!parts || parts.length === 0) return null;
        return (
          <Card key={sec.name} style={{ borderLeft: `4px solid ${sec.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {sectionIcon(sec.icon, 18, { color: sec.color })}
              <span style={{ fontSize: 15, fontWeight: 700, color: sec.color }}>{sec.label}</span>
            </div>
            {parts.map((part, i) => (
              <PartTree key={part.id ?? i} part={part} depth={0} paramMap={paramMap} />
            ))}
          </Card>
        );
      })}

      {/* Properties */}
      {control.props && control.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {control.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} />)}
          </div>
        </Card>
      )}

      {/* Links / references */}
      {resolvedLinks.length > 0 && (() => {
        const chips: ResolvedLink[] = resolvedLinks.map((lk) => {
          if (lk.resource) {
            const r = lk.resource;
            const frag = lk["resource-fragment"];
            const baseTitle = r.title ?? r.citation?.text ?? "Untitled";
            const text = frag ? `${baseTitle} — ${frag}` : baseTitle;
            const baseHref = r.rlinks?.[0]?.href;
            const href = baseHref && frag ? `${baseHref}#${frag}` : baseHref;
            return { text, href, rel: lk.rel };
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

      {/* Enhancements */}
      {enhancements.length > 0 && (
        <Card>
          <SectionLabel>Control Enhancements ({enhancements.length})</SectionLabel>
          {enhancements.map((enh) => {
            const eLbl = getLabel(enh.props);
            const eWithdrawn = (enh.props ?? []).some((p) => p.name === "status" && p.value === "withdrawn");
            return (
              <div key={enh.id} onClick={() => navigate(`ctrl-${enh.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                  borderBottom: `1px solid ${colors.bg}`, cursor: "pointer",
                  opacity: eWithdrawn ? 0.5 : 1,
                }}>
                <IcoTag size={13} style={{ color: colors.orange }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy, minWidth: 70 }}>
                  {eLbl || enh.id.toUpperCase()}
                </span>
                <span style={{ fontSize: 13, color: colors.black, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {enh.title}
                </span>
                {eWithdrawn && (
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.paleGray, color: colors.gray, fontWeight: 600 }}>
                    Withdrawn
                  </span>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PART TREE — recursive hierarchical rendering of a Part
   ═══════════════════════════════════════════════════════════════════════════ */

function PartTree({ part, depth, paramMap }: { part: Part; depth: number; paramMap: Record<string, Param> }) {
  const subParts = part.parts ?? [];
  const partLabel = getLabel(part.props);

  // Indentation colours for hierarchy depth
  const depthColors = [colors.navy, colors.brightBlue, colors.cobalt, colors.gray, colors.blueGray];
  const borderColor = depthColors[depth % depthColors.length];

  return (
    <div style={{
      marginTop: depth === 0 ? 0 : 8,
      paddingLeft: depth > 0 ? 16 : 0,
      borderLeft: depth > 0 ? `3px solid ${borderColor}` : "none",
    }}>
      {/* Part label (e.g. "a.", "b.", "(1)") */}
      {partLabel && (
        <span style={{
          fontSize: 12, fontWeight: 700, color: borderColor, fontFamily: fonts.mono, marginRight: 6,
        }}>
          {partLabel}
        </span>
      )}

      {/* Prose content — resolve inline {{ insert: param, ... }} references */}
      {part.prose && (
        <ProseWithParams text={part.prose} paramMap={paramMap} />
      )}

      {/* Links within a part */}
      {part.links && part.links.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {part.links.map((lk, i) => {
            const frag = lk["resource-fragment"];
            const display = frag ? `${lk.text ?? lk.href} — ${frag}` : (lk.text ?? lk.href);
            return (
              <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 12 }}>
                <IcoLink size={11} style={{ color: colors.brightBlue }} />
                <a href={lk.href.startsWith("#") ? undefined : lk.href} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: colors.brightBlue }}>
                  {display}
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Recursive children */}
      {subParts.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {subParts.map((sp, i) => (
            <PartTree key={sp.id ?? i} part={sp} depth={depth + 1} paramMap={paramMap} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROSE WITH PARAMS — renders prose text, replacing {{ insert: param, <id> }}
   tokens with styled inline parameter pills
   ═══════════════════════════════════════════════════════════════════════════ */

function ProseWithParams({ text, paramMap }: { text: string; paramMap: Record<string, Param> }) {
  // Split on {{ insert: param, <id> }} keeping the param id as a capture group
  const parts = text.split(/(\{\{\s*insert:\s*param\s*,\s*[^}]+?\s*\}\})/g);

  return (
    <span style={{ fontSize: 13, lineHeight: 1.75, color: colors.black }}>
      {parts.map((segment, i) => {
        const match = segment.match(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/);
        if (match) {
          const paramId = match[1].trim();
          const param = paramMap[paramId];
          const rendered = param ? renderParamText(param, paramMap) : `[Assignment: ${paramId}]`;
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
                backgroundColor: isSelection ? alpha(colors.cobalt, 7) : alpha(colors.orange, 7),
                padding: "1px 6px",
                borderRadius: radii.sm,
                border: `1px solid ${isSelection ? alpha(colors.cobalt, 20) : alpha(colors.orange, 20)}`,
                whiteSpace: "nowrap",
              }}
            >
              {rendered}
            </span>
          );
        }
        return <span key={i}>{segment}</span>;
      })}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NOT FOUND
   ═══════════════════════════════════════════════════════════════════════════ */

function NotFoundView({ navigate }: { navigate: (id: string) => void }) {
  return (
    <Card style={{ textAlign: "center", padding: 40 }}>
      <h2 style={{ color: colors.gray }}>View not found</h2>
      <button onClick={() => navigate("overview")}
        style={{ marginTop: 12, padding: "8px 20px", backgroundColor: colors.navy, color: colors.white, borderRadius: radii.sm, fontSize: 13, fontWeight: 600 }}>
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
    width: 300,
    minWidth: 300,
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
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderBottom: `1px solid ${colors.bg}`,
  },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 12,
    color: colors.black,
    backgroundColor: "transparent",
    fontFamily: fonts.sans,
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
