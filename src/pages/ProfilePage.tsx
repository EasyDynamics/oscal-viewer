/* ═══════════════════════════════════════════════════════════════════════════
   Profile Page — SPA-style viewer for OSCAL Profiles
   Left sidebar treeview (families → controls → enhancements)
   Right content panel showing profile imports, modifications, and parameter
   constraints with visual add (A) / remove (R) badges.
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
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { useUrlDocument, fileNameFromUrl } from "../hooks/useUrlDocument";
import { useAnalyticsView } from "../hooks/useAnalyticsView";
import useIsMobile from "../hooks/useIsMobile";
import { useResizableSidebar } from "../hooks/useResizableSidebar";
import { useOscalGraphResolver, type ResolvedOscalDocument } from "../hooks/useOscalGraphResolver";
import { resolveHref, type BackMatterResource } from "../hooks/useImportResolver";
import ResolverModal from "../components/ResolverModal";
import { IcoAlert, IcoBook, IcoBulb, IcoCheck, IcoChev, IcoDownload, IcoFolder, IcoHome, IcoInfo, IcoLayers, IcoLink, IcoList, IcoSearch, IcoShield, IcoSliders, IcoTag, IcoUpload } from "../components/IconAliases";
import { PartyCardGrid, ResponsiblePartiesList } from "../components/PartyDisplay";
import PartTitle from "../components/PartTitle";
import PropLabel from "../components/PropLabel";
import MarkupBlock, { MarkupLine, MarkupLinks } from "../components/MarkupBlock";
import { isWithdrawnStatusProp } from "../utils/oscalVisuals";
import { catalogLinkDisplay, linkLabel, resourceLinkLabel, resourceLinkTooltip } from "../utils/linkDisplay";
import { markupLineText } from "../utils/markup";
import { indexCatalog, selectProfileControls, type CatalogIndex, type ControlSelector, type ProfileSelection } from "../utils/profileSelection";
import type { OscalProp, OscalLink, Resource, CatalogMetadata, Catalog, Control, Part, Param, Group } from "../context/OscalContext";

/* ═══════════════════════════════════════════════════════════════════════════
   PROFILE-SPECIFIC TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProfilePart {
  id?: string;
  name?: string;
  title?: string;
  prose?: string;
  parts?: ProfilePart[];
  props?: OscalProp[];
  links?: OscalLink[];
}

interface IncludeControl {
  "with-ids"?: string[];
  matching?: { pattern: string }[];
  "with-child-controls"?: "yes" | "no";
}

interface ProfileImport {
  href: string;
  "include-all"?: Record<string, never>;
  "include-controls"?: IncludeControl[];
  "exclude-controls"?: IncludeControl[];
}

interface ProfileMerge {
  combine?: { method: "use-first" | "merge" | "keep" };
  "as-is"?: boolean;
  flat?: Record<string, never>;
  custom?: unknown;
}

interface SetParameter {
  "param-id": string;
  class?: string;
  label?: string;
  usage?: string;
  values?: string[];
  select?: { "how-many"?: string; choice?: string[] };
  constraints?: { description?: string; tests?: unknown[] }[];
  guidelines?: { prose: string }[];
  props?: OscalProp[];
  links?: OscalLink[];
}

interface AlterAdd {
  position?: "before" | "after" | "starting" | "ending";
  "by-id"?: string;
  title?: string;
  params?: unknown[];
  props?: OscalProp[];
  links?: OscalLink[];
  parts?: ProfilePart[];
}

interface AlterRemove {
  "by-id"?: string;
  "by-name"?: string;
  "by-class"?: string;
  "by-ns"?: string;
  "by-item-name"?: string;
}

interface Alter {
  "control-id": string;
  adds?: AlterAdd[];
  removes?: AlterRemove[];
}

interface ProfileModify {
  "set-parameters"?: SetParameter[];
  alters?: Alter[];
}

interface Profile {
  uuid: string;
  metadata: CatalogMetadata;
  imports: ProfileImport[];
  merge?: ProfileMerge;
  modify?: ProfileModify;
  "back-matter"?: { resources?: Resource[] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** NIST 800-53 control family names */
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

/** Extract family prefix from a control ID (e.g. "ac-2.3" → "ac") */
function familyPrefix(controlId: string): string {
  const m = controlId.match(/^([a-z]+)-/i);
  return m ? m[1].toLowerCase() : controlId;
}

/** Check if a control ID is an enhancement (has a dot, e.g. "ac-2.3") */
function isEnhancement(controlId: string): boolean {
  return /\.\d+$/.test(controlId);
}

/** Get parent control ID from an enhancement ID ("ac-2.3" → "ac-2") */
function parentControlId(enhId: string): string {
  return enhId.replace(/\.\d+$/, "");
}

/** Get display label for a control ID ("ac-2" → "AC-2", "ac-2.3" → "AC-2(3)", "s1.1.1" → "S1.1.1") */
function controlLabel(id: string): string {
  const upper = id.toUpperCase();
  const dotMatch = upper.match(/^([A-Z]+-\d+)\.(\d+)$/);
  if (dotMatch) return `${dotMatch[1]}(${dotMatch[2]})`;
  return upper;
}

/**
 * Map a param-id to a control-id.
 * "ac-01_odp.05" → "ac-1", "ac-02.03_odp.01" → "ac-2.3"
 */
function paramToControlId(paramId: string): string {
  const prefix = paramId.split("_")[0]; // "ac-01" from "ac-01_odp.05"
  // Remove leading zeros from digit segments
  return prefix.replace(/(?<=-)0+(\d)/g, "$1").replace(/(?<=\.)0+(\d)/g, "$1");
}

function fmtDate(s?: string) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return s; }
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}

/** Get the label prop from an object's props array */
function getLabel(props?: OscalProp[]): string {
  if (!props) return "";
  const lbl = props.find((p) => p.name === "label" && p.class !== "zero-padded");
  return lbl?.value ?? props.find((p) => p.name === "label")?.value ?? "";
}

/** Resolve import href — if starts with #, look up in back-matter */
function resolveImportHref(profile: Profile, importEntry: ProfileImport): {
  url: string | null; title: string | null; resourceUuid: string | null;
} {
  const href = importEntry.href;
  if (href.startsWith("#")) {
    const uuid = href.slice(1);
    const resources = profile["back-matter"]?.resources ?? [];
    const resource = resources.find((r) => r.uuid === uuid);
    if (resource) {
      const url = resource.rlinks?.[0]?.href ?? null;
      return { url, title: resource.title ?? null, resourceUuid: uuid };
    }
    return { url: null, title: null, resourceUuid: uuid };
  }
  return { url: href, title: null, resourceUuid: null };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Structured data from profile
   ═══════════════════════════════════════════════════════════════════════════ */

interface FamilyGroup {
  prefix: string;
  name: string;
  controls: string[];      // ids listed at the family level
  enhancements: string[];  // ids listed under a selected parent control
  children: Map<string, string[]>; // family-level id → its enhancements
  allIds: string[];        // all ids in order
}

/** The enhancements listed under a family-level control. */
function enhancementsOf(fg: FamilyGroup, cid: string): string[] {
  return fg.children.get(cid) ?? [];
}

/** The family a selected control is listed in. */
function familyOf(familyGroups: FamilyGroup[], cid: string): FamilyGroup | undefined {
  return familyGroups.find((fg) => fg.allIds.includes(cid));
}

/**
 * Group the selected controls into families. With a catalog, a family is the
 * catalog's top-level group, and an enhancement goes under its outermost
 * selected ancestor. Without one, the ids decide: "ac-2.3" is in family "ac",
 * under "ac-2". A control whose parent isn't selected is listed at the family
 * level, so it can still be reached.
 */
function buildFamilyGroups(controlIds: string[], catalog: CatalogIndex | null): FamilyGroup[] {
  const selected = new Set(controlIds);
  const families = new Map<string, FamilyGroup>();

  for (const id of controlIds) {
    const entry = catalog?.byId.get(id);
    const group = entry?.topGroup;
    const prefix = group?.id || familyPrefix(id);
    let fg = families.get(prefix);
    if (!fg) {
      const name = group?.title || FAMILY_NAMES[prefix] || prefix.toUpperCase();
      fg = { prefix, name, controls: [], enhancements: [], children: new Map(), allIds: [] };
      families.set(prefix, fg);
    }
    fg.allIds.push(id);
    const ancestors = entry ? entry.ancestors : isEnhancement(id) ? [parentControlId(id)] : [];
    const parent = ancestors.find((a) => selected.has(a));
    if (parent) {
      fg.enhancements.push(id);
      fg.children.set(parent, [...enhancementsOf(fg, parent), id]);
    } else {
      fg.controls.push(id);
    }
  }

  return [...families.values()];
}

/** Build a map from control-id to its alter entry */
function buildAlterMap(alters: Alter[]): Map<string, Alter> {
  const map = new Map<string, Alter>();
  for (const alter of alters) {
    map.set(alter["control-id"], alter);
  }
  return map;
}

/** Build a map from control-id to set-parameters affecting it */
function buildSetParamMap(setParams: SetParameter[]): Map<string, SetParameter[]> {
  const map = new Map<string, SetParameter[]>();
  for (const sp of setParams) {
    const cid = paramToControlId(sp["param-id"]);
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid)!.push(sp);
  }
  return map;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG HELPERS — find controls / groups in a loaded catalog
   ═══════════════════════════════════════════════════════════════════════════ */

/** The 5 part sections we display on a control detail page */
const PART_SECTIONS: { name: string; label: string; icon: string; color: string }[] = [
  { name: "overview", label: "Overview", icon: "info", color: colors.cobalt },
  { name: "statement", label: "Statement", icon: "list", color: colors.navy },
  { name: "guidance", label: "Guidance", icon: "book", color: colors.brightBlue },
  { name: "example", label: "Examples", icon: "bulb", color: colors.orange },
  { name: "assessment-method", label: "Assessment Method", icon: "check", color: colors.mint },
];

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

/** Find a control by id anywhere in the catalog */
function findControlInCatalog(catalog: Catalog, id: string): Control | undefined {
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

/** Find the parent control of an enhancement */
function findParentControlInCatalog(catalog: Catalog, enhId: string): Control | undefined {
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
   RESOLVED PARTS — merge catalog parts with profile add/remove operations
   ═══════════════════════════════════════════════════════════════════════════ */

interface ResolvedPart {
  id?: string;
  name: string;
  title?: string;
  prose?: string;
  props?: OscalProp[];
  links?: OscalLink[];
  parts?: ResolvedPart[];
  _tailoring?: "added" | "removed";
}

interface PartLocation {
  part: ResolvedPart;
  parentArray: ResolvedPart[];
  index: number;
}

function findPartById(parts: ResolvedPart[], targetId: string): PartLocation | null {
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].id === targetId) {
      return { part: parts[i], parentArray: parts, index: i };
    }
    if (parts[i].parts) {
      const found = findPartById(parts[i].parts!, targetId);
      if (found) return found;
    }
  }
  return null;
}

function markSubtree(part: ResolvedPart, tailoring: "added" | "removed") {
  part._tailoring = tailoring;
  if (part.parts) {
    part.parts.forEach((child) => markSubtree(child, tailoring));
  }
}

/**
 * Render a single param according to OSCAL rendering rules.
 */
function renderParamTextProfile(param: Param, paramMap: Record<string, Param>): string {
  if (param.select) {
    const howMany = param.select["how-many"];
    const prefix = howMany === "one-or-more" ? "Selection (one or more)" : "Selection";
    const choices = (param.select.choice ?? []).map((c) => resolveInlineParamsProfile(c, paramMap));
    return `[${prefix}: ${choices.join("; ")}]`;
  }
  const label = param.label ? resolveInlineParamsProfile(param.label, paramMap) : param.id;
  return `[Assignment: ${label}]`;
}

function resolveInlineParamsProfile(text: string, paramMap: Record<string, Param>): string {
  return text.replace(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/g, (_match, id: string) => {
    const param = paramMap[id.trim()];
    if (!param) return `[Assignment: ${id.trim()}]`;
    return renderParamTextProfile(param, paramMap);
  });
}

function resolveControlParts(
  catalogParts: Part[],
  alter?: { removes?: AlterRemove[]; adds?: AlterAdd[] },
): ResolvedPart[] {
  // 1. Deep clone
  const tree: ResolvedPart[] = structuredClone(catalogParts);

  if (!alter) return tree;

  // 2. Process removes first
  if (alter.removes) {
    for (const remove of alter.removes) {
      if (remove["by-id"]) {
        const loc = findPartById(tree, remove["by-id"]);
        if (loc) markSubtree(loc.part, "removed");
      }
    }
  }

  // 3. Process adds
  if (alter.adds) {
    for (const add of alter.adds) {
      const newParts: ResolvedPart[] = (add.parts ?? []).map((p) => {
        const rp = structuredClone(p) as ResolvedPart;
        markSubtree(rp, "added");
        return rp;
      });

      if (newParts.length === 0) continue;

      const position = add.position ?? "ending";
      const byId = add["by-id"];

      if (byId) {
        const loc = findPartById(tree, byId);
        if (loc) {
          if (position === "after") {
            loc.parentArray.splice(loc.index + 1, 0, ...newParts);
          } else if (position === "before") {
            loc.parentArray.splice(loc.index, 0, ...newParts);
          } else if (position === "starting") {
            if (!loc.part.parts) loc.part.parts = [];
            loc.part.parts.unshift(...newParts);
          } else {
            // ending
            if (!loc.part.parts) loc.part.parts = [];
            loc.part.parts.push(...newParts);
          }
        }
      } else {
        // No by-id: attach to root
        if (position === "starting") {
          tree.unshift(...newParts);
        } else {
          tree.push(...newParts);
        }
      }
    }
  }

  return tree;
}

/** Add badge — green circle with "A" */
function AddBadge({ size = 20 }: { size?: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%",
      backgroundColor: colors.successFg, color: colors.textOnAccent,
      fontSize: size * 0.55, fontWeight: 800, lineHeight: 1, flexShrink: 0,
    }}>
      A
    </span>
  );
}

/** Remove badge — red circle with "R" */
function RemoveBadge({ size = 20 }: { size?: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%",
      backgroundColor: colors.dangerFg, color: colors.textOnAccent,
      fontSize: size * 0.55, fontWeight: 800, lineHeight: 1, flexShrink: 0,
    }}>
      R
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ProfilePage() {
  const oscal = useOscal();
  const { token: authToken } = useAuth();
  const profile = oscal.profile?.data as Profile | null;
  const profileSourceUrl = oscal.profile?.sourceUrl ?? null;
  const fileName = oscal.profile?.fileName ?? "";
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const sidebar = useResizableSidebar({ storageKey: "oscal-viewer.sidebar.profile.width" });
  const [mobilePath, setMobilePath] = useState<string[]>([]);
  const [mobileShowContent, setMobileShowContent] = useState(false);
  useAnalyticsView("Profile", view);

  /* ── Auto-load from ?url= query param ── */
  const urlDoc = useUrlDocument();
  useEffect(() => {
    if (!urlDoc.json || oscal.profile) return;
    try {
      const data = (urlDoc.json as Record<string, unknown>)["profile"] ?? urlDoc.json;
      if (!(data as Record<string, unknown>).metadata)
        throw new Error("Not an OSCAL Profile — no metadata found.");
      oscal.setProfile(data as Profile, fileNameFromUrl(urlDoc.sourceUrl!), urlDoc.sourceUrl);
      setView("overview");
      setCollapsed({});
      setSearchTerm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse fetched document");
    }
  }, [urlDoc.json]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Auto-resolve all catalog imports from profile ── */
  const storedResolved = useRef(new Set<string>());
  useEffect(() => {
    storedResolved.current.clear();
  }, [profile?.uuid]);
  const handleResolved = useCallback((doc: ResolvedOscalDocument) => {
    const key = `${doc.modelKey}:${doc.url}`;
    if (storedResolved.current.has(key)) return;
    storedResolved.current.add(key);
    if (doc.modelKey === "catalog" && !oscal.catalog && !storedResolved.current.has("slot:catalog")) {
      storedResolved.current.add("slot:catalog");
      oscal.setCatalog(doc.data as unknown as import("../context/OscalContext").Catalog, doc.label, doc.url);
    }
  }, [oscal]);
  const resolverBaseUrl = profileSourceUrl ?? urlDoc.sourceUrl;
  const catalogImportsAlreadyLoaded = useMemo(() => {
    const imports = profile?.imports ?? [];
    if (!profile || !oscal.catalog || imports.length === 0) return false;

    // The app currently has one shared catalog slot. If a profile has a single
    // catalog import and that slot is already populated (for example by the SSP
    // dependency resolver), don't re-open the resolver when the Profile tab is
    // visited just to fetch the same catalog again.
    if (imports.length === 1) return true;

    const catalogSourceUrl = oscal.catalog.sourceUrl ?? null;
    const backMatter = (profile["back-matter"]?.resources ?? []) as BackMatterResource[];

    return imports.every((importEntry) => {
      const { url: rawUrl, formatError } = resolveHref(importEntry.href, backMatter);
      if (formatError || !rawUrl) return false;

      // If the catalog was manually loaded from a local file, there may be no
      // source URL to compare. Treat the loaded catalog as satisfying the
      // profile import so navigating to this tab doesn't re-open the resolver.
      if (!catalogSourceUrl) return true;

      try {
        const resolvedImportUrl = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
          ? rawUrl
          : resolverBaseUrl
            ? new URL(rawUrl, resolverBaseUrl).href
            : null;
        return resolvedImportUrl === catalogSourceUrl;
      } catch {
        return false;
      }
    });
  }, [profile, oscal.catalog, resolverBaseUrl]);
  const graphResolver = useOscalGraphResolver({
    root: profile,
    rootModelKey: "profile",
    rootBaseUrl: resolverBaseUrl,
    token: authToken,
    skip: catalogImportsAlreadyLoaded,
    onResolved: handleResolved,
  });

  const navigate = useCallback((id: string) => {
    setView(id);
    contentRef.current?.scrollTo(0, 0);
  }, []);

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
        const data = json["profile"] ?? json;
        if (!data.metadata)
          throw new Error("Not an OSCAL Profile — no metadata found.");
        if (!data.imports)
          throw new Error("Not an OSCAL Profile — no imports found.");
        oscal.setProfile(data as Profile, file.name);
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
    oscal.clearProfile();
    setError("");
    setView("overview");
    setSearchTerm("");
  }, [oscal]);

  /* ── Derived data ── */
  const catalog = oscal.catalog?.data as Catalog | null;

  const catalogIndex = useMemo(() => (catalog ? indexCatalog(catalog) : null), [catalog]);

  // The controls the imports select from the loaded catalog. Without one,
  // include-all falls back to the controls modify.alters names.
  const selection = useMemo(
    () => selectProfileControls(
      profile?.imports,
      catalogIndex,
      (profile?.modify?.alters ?? []).map((a) => a["control-id"]).filter(Boolean),
    ),
    [profile, catalogIndex],
  );
  const controlIds = selection.ids;

  const familyGroups = useMemo(() => buildFamilyGroups(controlIds, catalogIndex), [controlIds, catalogIndex]);

  const alterMap = useMemo(
    () => buildAlterMap(profile?.modify?.alters ?? []),
    [profile],
  );

  const setParamMap = useMemo(
    () => buildSetParamMap(profile?.modify?.["set-parameters"] ?? []),
    [profile],
  );

  /* ── Default all families / controls-with-enhancements to collapsed ── */
  const defaultCollapsed = useMemo(() => {
    const dc: Record<string, boolean> = {};
    for (const fg of familyGroups) {
      dc[`family-${fg.prefix}`] = true;
      for (const cid of fg.controls) {
        // Collapse controls that have enhancements
        const enhs = enhancementsOf(fg, cid);
        if (enhs.length > 0) dc[`ctrl-${cid}`] = true;
      }
    }
    return dc;
  }, [familyGroups]);

  const mergedCollapsed = useMemo(
    () => ({ ...defaultCollapsed, ...collapsed }),
    [defaultCollapsed, collapsed],
  );

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => {
      const current = prev[id] ?? defaultCollapsed[id] ?? false;
      return { ...prev, [id]: !current };
    });
  }, [defaultCollapsed]);

  /* ── Modal for dependency resolution status ── */
  const resolverModalEl = (
    <ResolverModal items={graphResolver.items} onSkip={graphResolver.cancel} />
  );

  /* ── If no file loaded, show drop zone ── */
  if (!profile) {
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

  /* ── Mobile layout ── */
  if (isMobile && profile) {
    if (mobileShowContent) {
      return (
        <div style={S.shell}>
          {resolverModalEl}
          <div style={S.topBar}>
            <button onClick={() => setMobileShowContent(false)} style={S.mobileBackBtn}>← Back</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.white, flex: 1, textAlign: "center" }}>Profile</div>
            <button style={S.topBtn} onClick={handleNewFile}>New</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <ViewRouter view={view} profile={profile} familyGroups={familyGroups}
              alterMap={alterMap} setParamMap={setParamMap} selection={selection} navigate={mobileNavigate} />
          </div>
        </div>
      );
    }
    return (
      <div style={S.shell}>
        {resolverModalEl}
        <div style={S.topBar}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.white }}>Profile</div>
          <button style={S.topBtn} onClick={handleNewFile}>New</button>
        </div>
        <ProfileMobileDrillDown
          familyGroups={familyGroups}
          alterMap={alterMap}
          mobilePath={mobilePath}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onDrillIn={mobileDrillIn}
          onDrillBack={mobileDrillBack}
          onBreadcrumbJump={mobileBreadcrumbJump}
          onSelect={mobileNavigate}
        />
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
            OSCAL Profile Viewer
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.topBtn} onClick={handleNewFile}>New File</button>
        </div>
      </div>

      <div style={S.body}>
        {/* ── LEFT SIDEBAR ── */}
        <nav className={`oscal-model-sidebar oscal-sidebar-label-${sidebar.labelMode}`} style={{ ...S.sidebar, ...sidebar.sidebarStyle }}>
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
          <NavRow id="imports" label="Imports" icon={<IcoDownload size={14} style={{ color: colors.navy }} />}
            active={view === "imports"} onClick={() => navigate("imports")} depth={0} />

          {/* Tree view: families → controls → enhancements */}
          <SidebarTree
            familyGroups={familyGroups}
            alterMap={alterMap}
            view={view}
            collapsed={mergedCollapsed}
            searchTerm={searchTerm}
            navigate={navigate}
            toggleGroup={toggleGroup}
          />
        </nav>
        <div {...sidebar.resizeHandleProps} style={sidebar.resizeHandleStyle} />

        {/* ── CONTENT PANEL ── */}
        <div ref={contentRef} style={S.content}>
          <ViewRouter
            view={view}
            profile={profile}
            familyGroups={familyGroups}
            alterMap={alterMap}
            setParamMap={setParamMap}
            selection={selection}
            navigate={navigate}
          />
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
   SIDEBAR TREE — families → controls → enhancements
   ═══════════════════════════════════════════════════════════════════════════ */

function SidebarTree({ familyGroups, alterMap, view, collapsed, searchTerm, navigate, toggleGroup }: {
  familyGroups: FamilyGroup[];
  alterMap: Map<string, Alter>;
  view: string;
  collapsed: Record<string, boolean>;
  searchTerm: string;
  navigate: (id: string) => void;
  toggleGroup: (id: string) => void;
}) {
  const lowerSearch = searchTerm.toLowerCase().trim();

  function controlMatches(id: string): boolean {
    if (!lowerSearch) return true;
    if (id.toLowerCase().includes(lowerSearch)) return true;
    return controlLabel(id).toLowerCase().includes(lowerSearch);
  }

  function familyHasMatch(fg: FamilyGroup): boolean {
    if (!lowerSearch) return true;
    if (markupLineText(fg.name).toLowerCase().includes(lowerSearch)) return true;
    if (fg.prefix.toLowerCase().includes(lowerSearch)) return true;
    return fg.allIds.some(controlMatches);
  }

  return (
    <>
      {familyGroups.map((fg) => {
        if (lowerSearch && !familyHasMatch(fg)) return null;
        const fId = `family-${fg.prefix}`;
        const isCollapsed = !!collapsed[fId];
        const totalCount = fg.allIds.length;

        return (
          <div key={fg.prefix}>
            <NavRow
              id={fId}
              label={`${fg.prefix.toUpperCase()} ${markupLineText(fg.name)}`}
              icon={<IcoFolder size={14} style={{ color: colors.cobalt }} />}
              active={view === fId}
              onClick={() => navigate(fId)}
              depth={0}
              badge={totalCount}
              hasChildren={totalCount > 0}
              expanded={!isCollapsed}
              onToggle={() => toggleGroup(fId)}
            />
            {!isCollapsed && fg.controls.map((cid) => {
              if (lowerSearch && !controlMatches(cid)) return null;
              const enhs = enhancementsOf(fg, cid);
              const cKey = `ctrl-${cid}`;
              const isCtrlCollapsed = !!collapsed[cKey];
              const hasAlter = alterMap.has(cid);

              return (
                <div key={cid}>
                  <div
                    onClick={() => { if (enhs.length > 0) toggleGroup(cKey); navigate(`ctrl-${cid}`); }}
                    style={{
                      ...S.navItem,
                      paddingLeft: 12 + 16,
                      backgroundColor: view === `ctrl-${cid}` ? alpha(colors.orange, 7) : "transparent",
                      borderLeft: view === `ctrl-${cid}` ? `3px solid ${colors.orange}` : "3px solid transparent",
                      fontWeight: view === `ctrl-${cid}` ? 600 : 400,
                      color: view === `ctrl-${cid}` ? colors.orange : colors.black,
                    }}
                  >
                    {enhs.length > 0
                      ? <IcoChev open={!isCtrlCollapsed} style={{ marginRight: 4, flexShrink: 0 }} />
                      : <span style={{ width: 16, flexShrink: 0 }} />}
                    <IcoShield size={13} style={{ color: colors.brightBlue }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {controlLabel(cid)}
                    </span>
                    {hasAlter && (
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: radii.pill, backgroundColor: colors.successBg, color: colors.successFg, fontWeight: 700, marginRight: 2 }}>
                        M
                      </span>
                    )}
                    {enhs.length > 0 && (
                      <span style={S.badge}>{enhs.length}</span>
                    )}
                  </div>
                  {!isCtrlCollapsed && enhs.map((enhId) => {
                    if (lowerSearch && !controlMatches(enhId)) return null;
                    const enhHasAlter = alterMap.has(enhId);
                    return (
                      <div
                        key={enhId}
                        onClick={() => navigate(`ctrl-${enhId}`)}
                        style={{
                          ...S.navItem,
                          paddingLeft: 12 + 32,
                          backgroundColor: view === `ctrl-${enhId}` ? alpha(colors.orange, 7) : "transparent",
                          borderLeft: view === `ctrl-${enhId}` ? `3px solid ${colors.orange}` : "3px solid transparent",
                          fontWeight: view === `ctrl-${enhId}` ? 600 : 400,
                          color: view === `ctrl-${enhId}` ? colors.orange : colors.black,
                        }}
                      >
                        <span style={{ width: 16, flexShrink: 0 }} />
                        <IcoTag size={12} style={{ color: colors.orange }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {controlLabel(enhId)}
                        </span>
                        {enhHasAlter && (
                          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: radii.pill, backgroundColor: colors.successBg, color: colors.successFg, fontWeight: 700 }}>
                            M
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOBILE DRILL-DOWN FOR PROFILE (Family → Control → Enhancement)
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProfileDrillNode {
  id: string;
  label: string;
  icon: ReactNode;
  isBranch: boolean;
  badge?: number;
  modBadge?: boolean;
}

function ProfileMobileDrillDown({ familyGroups, alterMap, mobilePath, searchTerm, setSearchTerm, onDrillIn, onDrillBack, onBreadcrumbJump, onSelect }: {
  familyGroups: FamilyGroup[];
  alterMap: Map<string, Alter>;
  mobilePath: string[];
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  onDrillIn: (nodeId: string) => void;
  onDrillBack: () => void;
  onBreadcrumbJump: (idx: number) => void;
  onSelect: (viewId: string) => void;
}) {
  const lowerSearch = searchTerm.toLowerCase().trim();

  function getChildren(): ProfileDrillNode[] {
    if (lowerSearch) return getSearchResults();
    if (mobilePath.length === 0) return getRootNodes();
    const last = mobilePath[mobilePath.length - 1];
    if (last.startsWith("family-")) return getFamilyChildren(last.replace("family-", ""));
    if (last.startsWith("ctrl-")) return getControlChildren(last.replace("ctrl-", ""));
    return [];
  }

  function getRootNodes(): ProfileDrillNode[] {
    const nodes: ProfileDrillNode[] = [
      { id: "__overview", label: "Overview", icon: <IcoHome size={16} style={{ color: colors.navy }} />, isBranch: false },
      { id: "__metadata", label: "Metadata", icon: <IcoInfo size={16} style={{ color: colors.navy }} />, isBranch: false },
      { id: "__imports", label: "Imports", icon: <IcoDownload size={16} style={{ color: colors.navy }} />, isBranch: false },
    ];
    for (const fg of familyGroups) {
      nodes.push({
        id: `family-${fg.prefix}`,
        label: `${fg.prefix.toUpperCase()} ${markupLineText(fg.name)}`,
        icon: <IcoFolder size={16} style={{ color: colors.cobalt }} />,
        isBranch: true,
        badge: fg.allIds.length,
      });
    }
    return nodes;
  }

  function getFamilyChildren(prefix: string): ProfileDrillNode[] {
    const fg = familyGroups.find((f) => f.prefix === prefix);
    if (!fg) return [];
    const nodes: ProfileDrillNode[] = [];
    // Family overview
    nodes.push({
      id: `__family-${prefix}`,
      label: `${fg.prefix.toUpperCase()} ${markupLineText(fg.name)} — Overview`,
      icon: <IcoInfo size={16} style={{ color: colors.cobalt }} />,
      isBranch: false,
    });
    for (const cid of fg.controls) {
      const enhs = enhancementsOf(fg, cid);
      nodes.push({
        id: enhs.length > 0 ? `ctrl-${cid}` : `__ctrl-${cid}`,
        label: controlLabel(cid),
        icon: <IcoShield size={16} style={{ color: colors.brightBlue }} />,
        isBranch: enhs.length > 0,
        badge: enhs.length > 0 ? enhs.length : undefined,
        modBadge: alterMap.has(cid),
      });
    }
    return nodes;
  }

  function getControlChildren(cid: string): ProfileDrillNode[] {
    const fg = familyOf(familyGroups, cid);
    if (!fg) return [];
    const nodes: ProfileDrillNode[] = [];
    // Control detail
    nodes.push({
      id: `__ctrl-${cid}`,
      label: `${controlLabel(cid)} — Detail`,
      icon: <IcoShield size={16} style={{ color: colors.brightBlue }} />,
      isBranch: false,
      modBadge: alterMap.has(cid),
    });
    const enhs = enhancementsOf(fg, cid);
    for (const enhId of enhs) {
      nodes.push({
        id: `__ctrl-${enhId}`,
        label: controlLabel(enhId),
        icon: <IcoTag size={14} style={{ color: colors.orange }} />,
        isBranch: false,
        modBadge: alterMap.has(enhId),
      });
    }
    return nodes;
  }

  function getSearchResults(): ProfileDrillNode[] {
    const results: ProfileDrillNode[] = [];
    for (const fg of familyGroups) {
      for (const cid of fg.allIds) {
        if (cid.toLowerCase().includes(lowerSearch) || controlLabel(cid).toLowerCase().includes(lowerSearch)) {
          results.push({
            id: `__ctrl-${cid}`,
            label: controlLabel(cid),
            icon: fg.enhancements.includes(cid)
              ? <IcoTag size={14} style={{ color: colors.orange }} />
              : <IcoShield size={16} style={{ color: colors.brightBlue }} />,
            isBranch: false,
            modBadge: alterMap.has(cid),
          });
        }
      }
    }
    return results;
  }

  function getBreadcrumbs(): { label: string }[] {
    const crumbs: { label: string }[] = [{ label: "Profile" }];
    for (const nodeId of mobilePath) {
      if (nodeId.startsWith("family-")) {
        const prefix = nodeId.replace("family-", "");
        const fg = familyGroups.find((f) => f.prefix === prefix);
        crumbs.push({ label: fg ? `${fg.prefix.toUpperCase()} ${markupLineText(fg.name)}` : prefix });
      } else if (nodeId.startsWith("ctrl-")) {
        crumbs.push({ label: controlLabel(nodeId.replace("ctrl-", "")) });
      }
    }
    return crumbs;
  }

  function handleTap(node: ProfileDrillNode) {
    if (node.isBranch) {
      onDrillIn(node.id);
    } else {
      const viewId = node.id.startsWith("__") ? node.id.replace("__", "") : node.id;
      onSelect(viewId);
    }
  }

  const children = getChildren();
  const breadcrumbs = getBreadcrumbs();

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: colors.card }}>
      {/* Search */}
      <div style={{ ...S.searchWrap, padding: "10px 12px" }}>
        <IcoSearch size={14} style={{ color: colors.gray, flexShrink: 0 }} />
        <input type="text" placeholder="Search controls…" value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...S.searchInput, fontSize: 14, minHeight: 32 }} />
      </div>

      {/* Breadcrumbs */}
      {mobilePath.length > 0 && !lowerSearch && (
        <div style={S.mobileBreadcrumbs}>
          {breadcrumbs.map((bc, i) => (
            <span key={i}>
              <span onClick={() => onBreadcrumbJump(i)}
                style={{ cursor: "pointer", color: i < breadcrumbs.length - 1 ? colors.brightBlue : colors.black, fontWeight: i === breadcrumbs.length - 1 ? 600 : 400 }}>
                {bc.label}
              </span>
              {i < breadcrumbs.length - 1 && <span style={{ margin: "0 6px", color: colors.paleGray }}>/</span>}
            </span>
          ))}
        </div>
      )}

      {/* Back */}
      {mobilePath.length > 0 && !lowerSearch && (
        <div onClick={onDrillBack}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", fontSize: 14, color: colors.brightBlue, cursor: "pointer", borderBottom: `1px solid ${colors.bg}`, fontWeight: 500, minHeight: 44 }}>
          ← Back
        </div>
      )}

      {/* Items */}
      {children.map((node) => (
        <div key={node.id} onClick={() => handleTap(node)}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", fontSize: 14, cursor: "pointer", minHeight: 48, borderBottom: `1px solid ${colors.bg}` }}>
          {node.icon}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.label}</span>
          {node.modBadge && (
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: radii.pill, backgroundColor: colors.successBg, color: colors.successFg, fontWeight: 700 }}>M</span>
          )}
          {node.badge != null && <span style={S.badge}>{node.badge}</span>}
          {node.isBranch && <IcoChev open={false} style={{ color: colors.gray }} />}
        </div>
      ))}

      {children.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: colors.gray, fontSize: 14 }}>
          {lowerSearch ? "No matching controls found" : "No items at this level"}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW ROUTER
   ═══════════════════════════════════════════════════════════════════════════ */

function ViewRouter(props: ViewRouterProps) {
  const { selection, navigate } = props;
  // A `#fragment` link in prose ([AU-02](#au-2)) opens that control when the profile includes it.
  const resolveLink = (id: string) => {
    if (!selection.ids.includes(id)) return false;
    navigate(`ctrl-${id}`);
    return true;
  };
  return (
    <MarkupLinks resolve={resolveLink}>
      <ProfileView {...props} />
    </MarkupLinks>
  );
}

interface ViewRouterProps {
  view: string;
  profile: Profile;
  familyGroups: FamilyGroup[];
  alterMap: Map<string, Alter>;
  setParamMap: Map<string, SetParameter[]>;
  selection: ProfileSelection;
  navigate: (id: string) => void;
}

function ProfileView({ view, profile, familyGroups, alterMap, setParamMap, selection, navigate }: ViewRouterProps) {
  if (view === "overview") return <OverviewView profile={profile} familyGroups={familyGroups} selection={selection} navigate={navigate} />;
  if (view === "metadata") return <MetadataView profile={profile} navigate={navigate} />;
  if (view === "imports") return <ImportsView profile={profile} selection={selection} navigate={navigate} />;

  if (view.startsWith("family-")) {
    const prefix = view.replace("family-", "");
    const fg = familyGroups.find((f) => f.prefix === prefix);
    if (fg) return <FamilyView familyGroup={fg} alterMap={alterMap} setParamMap={setParamMap} navigate={navigate} />;
  }

  if (view.startsWith("ctrl-")) {
    const cid = view.replace("ctrl-", "");
    return <ControlModView controlId={cid} family={familyOf(familyGroups, cid)} selectedIds={selection.ids}
      alterMap={alterMap} setParamMap={setParamMap} profile={profile} navigate={navigate} />;
  }

  return <NotFoundView navigate={navigate} />;
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
    <div style={{ backgroundColor: colors.card, borderRadius: radii.md, padding: "20px 24px", boxShadow: shadows.sm, marginBottom: 16, ...style }}>
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

function MField({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: colors.black, marginTop: 2, fontFamily: mono ? fonts.mono : fonts.sans, wordBreak: "break-all" }}>{value || "—"}</div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   DROP ZONE
   ═══════════════════════════════════════════════════════════════════════════ */

function DropZone({ onFile, error, sourceUrl }: { onFile: (f: File) => void; error: string; sourceUrl?: string | null }) {
  const [dragging, setDragging] = useState(false);
  const [, setSearchParams] = useSearchParams();
  const [urlInput, setUrlInput] = useState("");
  const handleDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); };
  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = () => { const f = input.files?.[0]; if (f) onFile(f); };
    input.click();
  };

  return (
    <div style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <IcoLayers size={48} style={{ color: colors.brightBlue }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>OSCAL Profile Viewer</h2>
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
          backgroundColor: dragging ? colors.dropzoneBg : colors.card,
          cursor: "pointer", transition: "border-color .2s, background-color .2s",
          maxWidth: 520, margin: "0 auto",
        }}
      >
        <IcoUpload size={40} style={{ color: colors.gray }} />
        <p style={{ marginTop: 12, fontSize: 15, color: colors.black }}>
          Drop an OSCAL <strong>Profile</strong> JSON file here
        </p>
        <p style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>or click to browse</p>
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
            placeholder="https://example.com/profile.json"
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

function OverviewView({ profile, familyGroups, selection, navigate }: {
  profile: Profile; familyGroups: FamilyGroup[]; selection: ProfileSelection; navigate: (id: string) => void;
}) {
  const totalControls = selection.ids.length;
  const setParamCount = profile.modify?.["set-parameters"]?.length ?? 0;
  const alterCount = profile.modify?.alters?.length ?? 0;

  // Count add/remove operations
  const addCount = (profile.modify?.alters ?? []).reduce((sum, a) => sum + (a.adds?.length ?? 0), 0);
  const removeCount = (profile.modify?.alters ?? []).reduce((sum, a) => sum + (a.removes?.length ?? 0), 0);

  const mergeStrategy = profile.merge?.["as-is"] ? "As-Is (preserve structure)" :
    profile.merge?.flat ? "Flat (discard groups)" :
    profile.merge?.custom ? "Custom" : "Default (flat)";

  return (
    <div>
      <h1 style={{ fontSize: 22, color: colors.navy, marginBottom: 4 }}><MarkupLine text={profile.metadata.title} /></h1>
      <p style={{ fontSize: 13, color: colors.gray, marginBottom: 20 }}>
        Version {profile.metadata.version ?? "—"} · OSCAL {profile.metadata["oscal-version"] ?? "—"} · Last modified {fmtDate(profile.metadata["last-modified"])}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Selected Controls", value: totalControls, color: colors.cobalt },
          { label: "Control Families", value: familyGroups.length, color: colors.navy },
          { label: "Parameters", value: setParamCount, color: colors.brightBlue },
          { label: "Altered Controls", value: alterCount, color: colors.orange },
          { label: "Add Operations", value: addCount, color: colors.successFg },
          { label: "Remove Operations", value: removeCount, color: colors.red },
        ].map((s) => (
          <Card key={s.label} style={{ textAlign: "center", borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: colors.black, marginTop: 2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionLabel>Import Sources</SectionLabel>
        {profile.imports.map((imp, i) => {
          const resolved = resolveImportHref(profile, imp);
          return (
            <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>
                {resolved.title !== null ? <MarkupLine text={resolved.title} /> : (resolved.url ?? imp.href)}
              </div>
              {resolved.url && (
                <div style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono, marginTop: 2 }}>
                  {trunc(resolved.url, 80)}
                </div>
              )}
              <div style={{ fontSize: 12, color: colors.cobalt, marginTop: 4 }}>
                {importSelectionSummary(imp, selection.byImport[i] ?? [], selection.resolved)}
              </div>
            </div>
          );
        })}
      </Card>

      <Card>
        <SectionLabel>Merge Strategy</SectionLabel>
        <div style={{ fontSize: 13, color: colors.black, fontWeight: 500 }}>{mergeStrategy}</div>
      </Card>

      <Card>
        <SectionLabel>Control Families</SectionLabel>
        {familyGroups.map((fg) => (
          <div
            key={fg.prefix}
            onClick={() => navigate(`family-${fg.prefix}`)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
              borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}
          >
            <IcoFolder size={16} style={{ color: colors.cobalt }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>
                {fg.prefix.toUpperCase()} <MarkupLine text={fg.name} />
              </div>
            </div>
            <span style={{ fontSize: 12, color: colors.gray }}>{fg.allIds.length} controls</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   METADATA VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function MetadataView({ profile, navigate }: { profile: Profile; navigate: (id: string) => void }) {
  const meta = profile.metadata;
  const parties = meta.parties ?? [];
  const roles = meta.roles ?? [];
  const responsibleParties = ((meta as unknown as { "responsible-parties"?: { "role-id": string; "party-uuids"?: string[] }[] })["responsible-parties"] ?? []);

  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: "metadata", label: "Metadata" }]} navigate={navigate} />
      <h1 style={{ fontSize: 20, color: colors.navy, marginBottom: 16 }}>Document Metadata</h1>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 16 }}>
          <MField label="Title" value={<MarkupLine text={meta.title || "—"} />} />
          <MField label="Version" value={meta.version ?? "—"} />
          <MField label="Published" value={fmtDate((meta as unknown as Record<string, unknown>)["published"] as string)} />
          <MField label="Last Modified" value={fmtDate(meta["last-modified"])} />
          <MField label="OSCAL Version" value={meta["oscal-version"] ?? "—"} />
          <MField label="Document UUID" value={profile.uuid} mono />
        </div>
      </Card>

      {parties.length > 0 && (
        <Card>
          <SectionLabel>Parties</SectionLabel>
          <PartyCardGrid parties={parties} resources={profile["back-matter"]?.resources} />
        </Card>
      )}

      {roles.length > 0 && (
        <Card>
          <SectionLabel>Roles</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {roles.map((r) => (
              <span key={r.id} style={{ fontSize: 12, padding: "4px 12px", borderRadius: radii.pill, backgroundColor: colors.navy, color: colors.white, fontWeight: 500 }}>
                <MarkupLine text={r.title} />
              </span>
            ))}
          </div>
        </Card>
      )}

      {responsibleParties.length > 0 && (
        <Card>
          <SectionLabel>Responsible Parties</SectionLabel>
          <ResponsiblePartiesList responsibleParties={responsibleParties} parties={parties} roles={roles} />
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORTS VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

/** An import's include-controls or exclude-controls, in words: "Matching: s1.1.*; IDs: s2.1.1". */
function describeSelectors(selectors: ControlSelector[] = []): string {
  return selectors.map((sel) => {
    const ids = sel["with-ids"] ?? [];
    const patterns = (sel.matching ?? []).map((m) => m.pattern).filter(Boolean);
    const parts: string[] = [];
    if (ids.length > 0) parts.push(ids.length > 6 ? `${ids.length} IDs` : `IDs: ${ids.join(", ")}`);
    if (patterns.length > 0) parts.push(`Matching: ${patterns.join(", ")}`);
    if (sel["with-child-controls"] === "yes") parts.push("with child controls");
    return parts.join(", ");
  }).filter(Boolean).join("; ");
}

/** How many controls an import selects, and whether that waits on the catalog. */
function importSelectionSummary(imp: ProfileImport, ids: string[], resolved: boolean): string {
  if (!resolved && imp["include-all"]) return "All controls";
  const count = `${ids.length} control${ids.length === 1 ? "" : "s"} selected`;
  const needsCatalog = (imp["include-controls"] ?? []).some((sel) => (sel.matching?.length ?? 0) > 0)
    || [...(imp["include-controls"] ?? []), ...(imp["exclude-controls"] ?? [])].some((sel) => sel["with-child-controls"] === "yes");
  return !resolved && needsCatalog ? `${count} by ID; patterns and child controls need the catalog` : count;
}

function ImportsView({ profile, selection, navigate }: { profile: Profile; selection: ProfileSelection; navigate: (id: string) => void }) {
  const controlIds = selection.ids;
  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: "imports", label: "Imports" }]} navigate={navigate} />
      <h1 style={{ fontSize: 20, color: colors.navy, marginBottom: 16 }}>Imports</h1>

      {profile.imports.map((imp, i) => {
        const resolved = resolveImportHref(profile, imp);
        return (
          <Card key={i}>
            <SectionLabel>Source Catalog {profile.imports.length > 1 ? `#${i + 1}` : ""}</SectionLabel>
            <MField label="Title" value={<MarkupLine text={resolved.title || "—"} />} />
            {resolved.url && <MField label="URL" value={resolved.url} mono />}
            {resolved.resourceUuid && <MField label="Resource UUID" value={resolved.resourceUuid} mono />}
            <MField label="Include" value={imp["include-all"] ? "All controls" : describeSelectors(imp["include-controls"]) || "—"} />
            {imp["exclude-controls"] && <MField label="Exclude" value={describeSelectors(imp["exclude-controls"]) || "—"} />}
            <MField label="Selected" value={importSelectionSummary(imp, selection.byImport[i] ?? [], selection.resolved)} />
          </Card>
        );
      })}

      <Card>
        <SectionLabel>Selected Control IDs ({controlIds.length})</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 400, overflowY: "auto" }}>
          {controlIds.map((id) => (
            <span
              key={id}
              onClick={() => navigate(`ctrl-${id}`)}
              style={{
                fontSize: 12, fontFamily: fonts.mono, padding: "3px 10px",
                borderRadius: radii.pill, backgroundColor: alpha(colors.brightBlue, 7),
                color: colors.brightBlue, cursor: "pointer", fontWeight: 500,
                border: `1px solid ${alpha(colors.brightBlue, 15)}`,
                transition: "background-color .15s",
              }}
            >
              {controlLabel(id)}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function FamilyView({ familyGroup: fg, alterMap, setParamMap, navigate }: {
  familyGroup: FamilyGroup;
  alterMap: Map<string, Alter>;
  setParamMap: Map<string, SetParameter[]>;
  navigate: (id: string) => void;
}) {
  const crumbs = [
    { id: "overview", label: "Overview" },
    { id: `family-${fg.prefix}`, label: `${fg.prefix.toUpperCase()} ${markupLineText(fg.name)}` },
  ];

  return (
    <div>
      <Breadcrumbs items={crumbs} navigate={navigate} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <IcoFolder size={22} style={{ color: colors.cobalt }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {fg.prefix.toUpperCase()} <MarkupLine text={fg.name} />
        </h1>
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 16 }}>
          <MField label="Family" value={fg.prefix.toUpperCase()} mono />
          <MField label="Base Controls" value={String(fg.controls.length)} />
          <MField label="Enhancements" value={String(fg.enhancements.length)} />
          <MField label="Total" value={String(fg.allIds.length)} />
        </div>
      </Card>

      <Card>
        <SectionLabel>Controls ({fg.controls.length})</SectionLabel>
        {fg.controls.map((cid) => {
          const hasAlter = alterMap.has(cid);
          const hasParams = setParamMap.has(cid);
          const enhs = enhancementsOf(fg, cid);
          return (
            <div
              key={cid}
              onClick={() => navigate(`ctrl-${cid}`)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                borderBottom: `1px solid ${colors.bg}`, cursor: "pointer",
              }}
            >
              <IcoShield size={14} style={{ color: colors.brightBlue }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy, minWidth: 60 }}>
                {controlLabel(cid)}
              </span>
              <span style={{ flex: 1 }} />
              {hasParams && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: alpha(colors.brightBlue, 7), color: colors.brightBlue, fontWeight: 600 }}>
                  params
                </span>
              )}
              {hasAlter && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.successBg, color: colors.successFg, fontWeight: 600 }}>
                  modified
                </span>
              )}
              {enhs.length > 0 && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.bg, color: colors.gray, fontWeight: 600 }}>
                  +{enhs.length}
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
   CONTROL MODIFICATION VIEW — catalog-aware detail page
   Renders 5 part sections from catalog with inline add/remove annotations.
   If no catalog is loaded, shows modifications-only fallback.
   ═══════════════════════════════════════════════════════════════════════════ */

function ControlModView({ controlId, family, selectedIds, alterMap, setParamMap, profile, navigate }: {
  controlId: string;
  /** The family the sidebar lists this control in. */
  family?: FamilyGroup;
  selectedIds: string[];
  alterMap: Map<string, Alter>;
  setParamMap: Map<string, SetParameter[]>;
  profile: Profile;
  navigate: (id: string) => void;
}) {
  const oscal = useOscal();
  const catalog = oscal.catalog?.data as Catalog | null;
  const alter = alterMap.get(controlId);
  const setParams = setParamMap.get(controlId) ?? [];
  const fp = family?.prefix ?? familyPrefix(controlId);
  const famName = family ? markupLineText(family.name) : FAMILY_NAMES[fp] || fp.toUpperCase();
  // The control the sidebar lists this one under, if any.
  const parentId = family
    ? [...family.children].find(([, ids]) => ids.includes(controlId))?.[0]
    : isEnhancement(controlId) ? parentControlId(controlId) : undefined;

  // Look up catalog control
  const catalogControl = catalog ? findControlInCatalog(catalog, controlId) : null;

  // Build param map (catalog params + profile overrides)
  const paramMap = useMemo(() => {
    const map: Record<string, Param> = {};
    if (catalog && catalogControl) {
      // If enhancement, include parent control params
      const parent = findParentControlInCatalog(catalog, controlId);
      if (parent) (parent.params ?? []).forEach((p) => { map[p.id] = p; });
      (catalogControl.params ?? []).forEach((p) => { map[p.id] = p; });
      (catalogControl.controls ?? []).forEach((enh) =>
        (enh.params ?? []).forEach((p) => { map[p.id] = p; })
      );
    }
    // Profile set-parameters override values
    for (const sp of setParams) {
      if (map[sp["param-id"]]) {
        // Overlay profile values on the catalog param
        const existing = map[sp["param-id"]];
        map[sp["param-id"]] = { ...existing };
        if (sp.values && sp.values.length > 0) {
          // Replace the label display to show profile-set value
          map[sp["param-id"]].label = sp.values.join(", ");
        }
        if (sp.select) {
          map[sp["param-id"]].select = sp.select;
        }
      }
    }
    return map;
  }, [catalog, catalogControl, controlId, setParams]);

  const catalogParams = useMemo(() => {
    const map: Record<string, Param> = {};
    if (catalog && catalogControl) {
      const parent = findParentControlInCatalog(catalog, controlId);
      if (parent) (parent.params ?? []).forEach((p) => { map[p.id] = p; });
      (catalogControl.params ?? []).forEach((p) => { map[p.id] = p; });
      (catalogControl.controls ?? []).forEach((enh) =>
        (enh.params ?? []).forEach((p) => { map[p.id] = p; }));
    }
    return map;
  }, [catalog, catalogControl, controlId]);

  // Resolve parts with profile alterations
  const resolvedParts = useMemo(() => {
    if (!catalogControl) return [];
    return resolveControlParts(catalogControl.parts ?? [], alter);
  }, [catalogControl, alter]);

  // Partition resolved parts into 5 sections
  const sectionParts = useMemo(() => {
    const result: Record<string, ResolvedPart[]> = {};
    PART_SECTIONS.forEach((s) => {
      result[s.name] = resolvedParts.filter((p) => p.name === s.name);
    });
    return result;
  }, [resolvedParts]);

  // Breadcrumbs
  const crumbs: { id: string; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: `family-${fp}`, label: `${fp.toUpperCase()} ${famName}` },
  ];
  if (parentId) crumbs.push({ id: `ctrl-${parentId}`, label: controlLabel(parentId) });
  crumbs.push({ id: `ctrl-${controlId}`, label: controlLabel(controlId) });

  // Control title from catalog
  const controlTitle = catalogControl?.title ?? "";
  const controlLbl = catalogControl ? getLabel(catalogControl.props) : "";
  const displayLabel = controlLbl ? `${controlLbl} ` : "";

  // The catalog's enhancements that the profile selects
  const enhancements = (catalogControl?.controls ?? []).filter((enh) => selectedIds.includes(enh.id));

  // Links from catalog
  const links = catalogControl?.links ?? [];

  // Resolve back-matter links: catalog parts point at the catalog's back matter,
  // parts added by the profile's alter at the profile's own.
  const resources = [
    ...(catalog?.["back-matter"]?.resources ?? []),
    ...(profile["back-matter"]?.resources ?? []),
  ];
  const resMap: Record<string, Resource> = {};
  resources.forEach((r) => { resMap[r.uuid] = r; });

  // Check for CORE prop in profile adds
  const adds = alter?.adds ?? [];
  const coreAdd = adds.find((a) => a.props?.some((p) => p.name === "CORE"));
  // An add's title is a "Title Change" for the control (or its by-id target).
  const titleChanges = adds.filter((a) => typeof a.title === "string" && a.title.trim() !== "");

  return (
    <div>
      <Breadcrumbs items={crumbs} navigate={navigate} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoShield size={22} style={{ color: colors.navy }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {displayLabel}<MarkupLine text={controlTitle || controlLabel(controlId)} />
        </h1>
        {coreAdd && (
          <span style={{
            fontSize: 11, padding: "2px 10px", borderRadius: radii.pill,
            backgroundColor: colors.successBg, color: colors.successFg, fontWeight: 700,
            border: `1px solid ${colors.successBorder}`,
          }}>
            CORE
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, fontFamily: fonts.mono, color: colors.gray, marginBottom: titleChanges.length > 0 ? 8 : 16 }}>
        {controlId}
      </div>
      {titleChanges.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
          {titleChanges.map((add, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: colors.successFg }}>
              <AddBadge size={16} />
              <span style={{ fontWeight: 700 }}>{add["by-id"] ? `Title change for ${add["by-id"]}:` : "Title change:"}</span>
              <span><MarkupLine text={add.title} /></span>
            </div>
          ))}
        </div>
      )}

      {/* No catalog loaded banner */}
      {!catalog && (
        <Card style={{ backgroundColor: colors.warningBg, borderLeft: `4px solid ${colors.orange}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IcoAlert size={18} style={{ color: colors.orange }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.orange }}>
                No Catalog Loaded
              </div>
              <div style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>
                Load the referenced catalog in the Catalog tab to see the full control content with inline tailoring annotations.
                Currently showing profile modifications only.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Catalog-based 5 part sections with inline tailoring */}
      {catalogControl && PART_SECTIONS.map((sec) => {
        const parts = sectionParts[sec.name];
        if (!parts || parts.length === 0) return null;
        return (
          <Card key={sec.name} style={{ borderLeft: `4px solid ${sec.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {sectionIcon(sec.icon, 18, { color: sec.color })}
              <span style={{ fontSize: 15, fontWeight: 700, color: sec.color }}>{sec.label}</span>
            </div>
            {parts.map((part, i) => (
              <ResolvedPartTree key={part.id ?? i} part={part} depth={0} paramMap={paramMap} resMap={resMap} />
            ))}
          </Card>
        );
      })}

      {setParams.length > 0 && (
        <Card style={{ borderLeft: `4px solid ${colors.brightBlue}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <IcoSliders size={18} style={{ color: colors.brightBlue }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: colors.brightBlue }}>Parameters</span>
            <span style={{ fontSize: 11, color: colors.gray, marginLeft: "auto" }}>{setParams.length} parameter(s)</span>
          </div>
          {setParams.map((sp) => {
            const cp = catalogParams[sp["param-id"]];
            const catalogLabel = cp?.label;
            const values = sp.values && sp.values.length > 0 ? sp.values : null;
            const constraintDescs = (sp.constraints ?? []).map((c) => c.description).filter((d): d is string => !!d);
            const select = sp.select ?? cp?.select;
            const selectText = select?.choice && select.choice.length > 0 ? `Selection: ${select.choice.join("; ")}` : null;
            // value assignment > constraint > label
            let kind: "Value" | "Constraint" | "Label";
            let shown: string[];
            if (values) { kind = "Value"; shown = values; }
            else if (constraintDescs.length > 0) { kind = "Constraint"; shown = constraintDescs; }
            else if (selectText) { kind = "Constraint"; shown = [selectText]; }
            else { kind = "Label"; shown = [catalogLabel ?? sp.label ?? sp["param-id"]]; }
            const kindColor = kind === "Value" ? colors.successFg : kind === "Constraint" ? colors.brightBlue : colors.gray;
            return (
              <div key={sp["param-id"]} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.bg}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 12, fontFamily: fonts.mono, fontWeight: 600,
                    color: colors.orange, backgroundColor: alpha(colors.orange, 7),
                    padding: "1px 6px", borderRadius: radii.sm,
                    border: `1px solid ${alpha(colors.orange, 20)}`,
                  }}>
                    {sp["param-id"]}
                  </span>
                  {catalogLabel && kind !== "Label" && <span style={{ fontSize: 12, color: colors.gray }}>{catalogLabel}</span>}
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4,
                    color: kindColor, backgroundColor: alpha(kindColor, 10),
                    padding: "1px 6px", borderRadius: radii.sm, marginLeft: "auto",
                  }}>
                    {kind}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 8 }}>
                  {shown.map((d, di) => (
                    <span key={di} style={kind === "Value"
                      ? { fontSize: 12, fontFamily: fonts.mono, padding: "2px 8px", borderRadius: radii.sm, backgroundColor: alpha(colors.successFg, 8), color: colors.successFg, border: `1px solid ${alpha(colors.successFg, 20)}` }
                      : { fontSize: 13, color: colors.black }}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Fallback: profile-only adds/removes when no catalog is loaded */}
      {!catalogControl && alter && (
        <>
          {adds.length > 0 && adds.map((add, ai) => (
            <Card key={ai} style={{ borderLeft: `4px solid ${colors.successFg}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <AddBadge size={18} />
                <span style={{ fontSize: 15, fontWeight: 700, color: colors.successFg }}>Addition</span>
                {add["by-id"] && (
                  <span style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.gray }}>
                    target: {add["by-id"]} ({add.position ?? "ending"})
                  </span>
                )}
              </div>
              {add.parts && add.parts.map((part, pi) => (
                <FallbackAddedPartTree key={(part as ProfilePart).id ?? pi} part={part as ProfilePart} depth={0} />
              ))}
              {add.props && add.props.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {add.props.map((p, pi) => (
                    <PropLabel key={pi} prop={p} />
                  ))}
                </div>
              )}
            </Card>
          ))}
          {(alter.removes ?? []).length > 0 && (
            <Card style={{ borderLeft: `4px solid ${colors.red}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <RemoveBadge size={18} />
                <span style={{ fontSize: 15, fontWeight: 700, color: colors.red }}>Removals</span>
              </div>
              {(alter.removes ?? []).map((rem, ri) => (
                <div key={ri} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${colors.bg}` }}>
                  <RemoveBadge size={16} />
                  <span style={{ fontSize: 13, fontFamily: fonts.mono, textDecoration: "line-through", color: colors.gray }}>
                    {rem["by-id"] ?? rem["by-name"] ?? rem["by-class"] ?? "unknown"}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* No modifications and no catalog content */}
      {!catalogControl && !alter && setParams.length === 0 && (
        <Card style={{ backgroundColor: colors.bg, textAlign: "center", padding: 40 }}>
          <IcoSliders size={32} style={{ color: colors.gray }} />
          <p style={{ fontSize: 14, color: colors.gray, marginTop: 8 }}>
            No modifications defined for this control in the profile.
          </p>
          <p style={{ fontSize: 12, color: colors.gray }}>
            Load the referenced catalog to see the full control content.
          </p>
        </Card>
      )}

      {/* Properties from catalog */}
      {catalogControl?.props && catalogControl.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px" }}>
            {catalogControl.props.map((p, i) => <PropLabel key={i} prop={p} />)}
          </div>
        </Card>
      )}

      {/* Links from catalog */}
      {links.length > 0 && (() => {
        const resolvedLinks = links
          .filter((lk) => !lk.rel || lk.rel === "related" || lk.rel === "reference" || lk.rel === "required")
          .map((lk) => {
            const m = lk.href.match(/^#(.+)/);
            if (m) {
              const res = resMap[m[1]];
              if (res) return { lk, resource: res };
            }
            return { lk, resource: undefined as Resource | undefined };
          })
          .filter((x) => x.resource || !x.lk.href.startsWith("#"));
        if (resolvedLinks.length === 0) return null;
        return (
          <Card>
            <SectionLabel>References</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {resolvedLinks.map((x, i) => {
                const text = x.resource
                  ? resourceLinkLabel(x.lk, x.resource, "Untitled")
                  : linkLabel(x.lk, undefined, x.lk.href);
                const href = x.resource?.rlinks?.[0]?.href ?? (x.lk.href.startsWith("#") ? undefined : x.lk.href);
                return (
                  <span key={i} title={x.resource ? resourceLinkTooltip(x.lk, x.resource) : undefined} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 11, padding: "3px 10px", borderRadius: radii.pill,
                    backgroundColor: alpha(colors.brightBlue, 7), color: colors.brightBlue,
                    border: `1px solid ${alpha(colors.brightBlue, 15)}`,
                  }}>
                    <IcoLink size={11} />
                    {href
                      ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: colors.brightBlue, textDecoration: "none" }}>{text}</a>
                      : text
                    }
                  </span>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Enhancements from catalog */}
      {enhancements.length > 0 && (
        <Card>
          <SectionLabel>Control Enhancements ({enhancements.length})</SectionLabel>
          {enhancements.map((enh) => {
            const eLbl = getLabel(enh.props);
            const eWithdrawn = (enh.props ?? []).some(isWithdrawnStatusProp);
            const enhHasAlter = alterMap.has(enh.id);
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
                  <MarkupLine text={enh.title} />
                </span>
                {enhHasAlter && (
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.successBg, color: colors.successFg, fontWeight: 600 }}>
                    modified
                  </span>
                )}
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
   RESOLVED PART TREE — recursive rendering with tailoring annotations
   Shows removed parts with strikethrough + red badge,
   added parts with green background + green badge,
   and normal parts rendered like the catalog PartTree.
   ═══════════════════════════════════════════════════════════════════════════ */

function ResolvedPartTree({ part, depth, paramMap, resMap }: {
  part: ResolvedPart; depth: number; paramMap: Record<string, Param>; resMap: Record<string, Resource>;
}) {
  const subParts = part.parts ?? [];
  const partLabel = getLabel(part.props);
  const isRemoved = part._tailoring === "removed";
  const isAdded = part._tailoring === "added";

  // Indentation colours for hierarchy depth
  const normalColors = [colors.navy, colors.brightBlue, colors.cobalt, colors.gray, colors.blueGray];
  const addedColors = [colors.successFg, colors.successBorder, colors.successBorder, colors.successBorder, colors.successBorder];
  const removedColors = [colors.dangerFg, colors.dangerFg, colors.dangerFg, colors.dangerFg, colors.dangerFg];
  const borderColor = isAdded
    ? addedColors[depth % addedColors.length]
    : isRemoved
      ? removedColors[depth % removedColors.length]
      : normalColors[depth % normalColors.length];

  // Build container style — keep paddingLeft + borderLeft for indentation hierarchy,
  // and layer on add/remove visuals without using the `padding` shorthand
  // (which would override paddingLeft and collapse the hierarchical indent).
  const containerStyle: CSSProperties = {
    marginTop: depth === 0 ? 0 : 8,
    paddingLeft: depth > 0 ? 16 : 0,
    borderLeft: depth > 0 ? `3px solid ${borderColor}` : "none",
  };
  if (isAdded || isRemoved) {
    containerStyle.backgroundColor = isAdded ? alpha(colors.successFg, 6) : alpha(colors.dangerFg, 10);
    containerStyle.borderRadius = radii.sm;
    containerStyle.paddingTop = 4;
    containerStyle.paddingBottom = 4;
    containerStyle.paddingRight = 4;
    // Preserve hierarchical indent: only add inset padding when at depth 0
    if (depth === 0) containerStyle.paddingLeft = 4;
  }

  return (
    <div style={containerStyle}>
      <PartTitle
        title={part.title}
        style={isRemoved
          ? { color: colors.dangerFg, textDecoration: "line-through", opacity: 0.75 }
          : isAdded ? { color: colors.successFg } : undefined}
      />

      {/* Badge for add/remove (inline so it doesn't break depth indentation) */}
      {isAdded && (
        <span style={{ display: "inline-block", marginRight: 4, verticalAlign: "middle" }}>
          <AddBadge size={14} />
        </span>
      )}
      {isRemoved && (
        <span style={{ display: "inline-block", marginRight: 4, verticalAlign: "middle" }}>
          <RemoveBadge size={14} />
        </span>
      )}

      {/* Part label (e.g. "a.", "1.") */}
      {partLabel && (
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: isRemoved ? colors.dangerFg : isAdded ? colors.successFg : borderColor,
          fontFamily: fonts.mono, marginRight: 6,
          textDecoration: isRemoved ? "line-through" : "none",
        }}>
          {partLabel}
        </span>
      )}

      {/* Prose content */}
      {part.prose && (
        isRemoved ? (
          <ProseWithParamsProfile text={part.prose} paramMap={paramMap}
            style={{ color: colors.dangerFg, textDecoration: "line-through", opacity: 0.75 }} />
        ) : (
          <ProseWithParamsProfile text={part.prose} paramMap={paramMap} isAdded={isAdded} />
        )
      )}

      {/* Links within a part */}
      {part.links && part.links.length > 0 && !isRemoved && (
        <div style={{ marginTop: 4 }}>
          {part.links.map((lk, i) => {
            const frag = lk["resource-fragment"];
            const { label, tooltip } = catalogLinkDisplay(lk, resMap);
            const display = frag ? `${label} — ${frag}` : label;
            return (
              <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 12 }}>
                <IcoLink size={11} style={{ color: colors.brightBlue }} />
                <a href={lk.href.startsWith("#") ? undefined : lk.href} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: colors.brightBlue }} title={tooltip}>
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
            <ResolvedPartTree key={sp.id ?? i} part={sp} depth={depth + 1} paramMap={paramMap} resMap={resMap} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FALLBACK ADDED PART TREE — for when no catalog is loaded,
   renders profile-only added parts with green badges
   ═══════════════════════════════════════════════════════════════════════════ */

function FallbackAddedPartTree({ part, depth }: { part: ProfilePart; depth: number }) {
  const subParts = part.parts ?? [];
  const partLabel = getLabel(part.props);

  const depthColors = [colors.successFg, colors.successBorder, colors.successBorder, colors.successBorder, colors.successBorder];
  const borderColor = depthColors[depth % depthColors.length];

  return (
    <div style={{
      marginTop: depth === 0 ? 4 : 6,
      paddingLeft: depth > 0 ? 16 : 0,
      borderLeft: depth > 0 ? `3px solid ${borderColor}` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <AddBadge size={18} />
        <div style={{ flex: 1 }}>
          {(part.title || partLabel) && (
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.successFg, marginBottom: 2 }}>
              {partLabel && <span style={{ fontFamily: fonts.mono, marginRight: 6 }}>{partLabel}</span>}
              {part.title && <span><MarkupLine text={part.title} /></span>}
            </div>
          )}
          {part.prose && (
            <MarkupBlock value={part.prose} inline />
          )}
        </div>
      </div>
      {subParts.length > 0 && (
        <div style={{ marginTop: 4, marginLeft: 24 }}>
          {subParts.map((sp, i) => (
            <FallbackAddedPartTree key={sp.id ?? i} part={sp} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROSE WITH PARAMS (PROFILE) — renders prose text, replacing
   {{ insert: param, <id> }} tokens with styled inline parameter pills.
   Supports set-parameter overrides from profile.
   ═══════════════════════════════════════════════════════════════════════════ */

function ProseWithParamsProfile({ text, paramMap, isAdded, style }: {
  text: string; paramMap: Record<string, Param>; isAdded?: boolean; style?: CSSProperties;
}) {
  const params = (id: string) => {
    const param = paramMap[id];
    return param ? { text: renderParamTextProfile(param, paramMap), selection: param.select != null } : null;
  };
  return <MarkupBlock value={text} params={params} inline style={{ color: isAdded ? colors.successFg : colors.black, fontFamily: fonts.sans, ...style }} />;
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
    width: 320,
    minWidth: 320,
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
    userSelect: "none" as const,
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
