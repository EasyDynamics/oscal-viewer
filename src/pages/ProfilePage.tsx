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
import { useAuth, authFetch } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { useUrlDocument, fileNameFromUrl } from "../hooks/useUrlDocument";
import useIsMobile from "../hooks/useIsMobile";
import ResolverModal from "../components/ResolverModal";
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

/** Get display label for a control ID ("ac-2" → "AC-2", "ac-2.3" → "AC-2(3)") */
function controlLabel(id: string): string {
  const upper = id.toUpperCase();
  const dotMatch = upper.match(/^(.+)\.(\d+)$/);
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
  controls: string[];      // non-enhancement control ids
  enhancements: string[];  // enhancement ids
  allIds: string[];        // all ids in order
}

/** Build grouped family structure from a list of control IDs */
function buildFamilyGroups(controlIds: string[]): FamilyGroup[] {
  const familyMap = new Map<string, { controls: string[]; enhancements: string[]; allIds: string[] }>();

  for (const id of controlIds) {
    const fp = familyPrefix(id);
    if (!familyMap.has(fp)) {
      familyMap.set(fp, { controls: [], enhancements: [], allIds: [] });
    }
    const entry = familyMap.get(fp)!;
    entry.allIds.push(id);
    if (isEnhancement(id)) {
      entry.enhancements.push(id);
    } else {
      entry.controls.push(id);
    }
  }

  return Array.from(familyMap.entries()).map(([prefix, data]) => ({
    prefix,
    name: FAMILY_NAMES[prefix] || prefix.toUpperCase(),
    controls: data.controls,
    enhancements: data.enhancements,
    allIds: data.allIds,
  }));
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

/** Find the group a control belongs to */
// @ts-ignore: reserved for future catalog enrichment
function findControlGroupInCatalog(catalog: Catalog, controlId: string): Group | undefined {
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

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE SVG ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconProps { size?: number; style?: CSSProperties }

function IcoUpload({ size = 20, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
}
function IcoLayers({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>;
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
function IcoTag({ size = 14, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;
}
function IcoSearch({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
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
function IcoSliders({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>;
}
function IcoDownload({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
}
function IcoList({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
}
function IcoBook({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>;
}
function IcoBulb({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" /></svg>;
}
function IcoCheck({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function IcoLink({ size = 14, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>;
}
function IcoAlert({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
// @ts-ignore: reserved for future use
function IcoPlus({ size = 14, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
// @ts-ignore: reserved for future use
function IcoMinus({ size = 14, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>;
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
  const fileName = oscal.profile?.fileName ?? "";
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [mobilePath, setMobilePath] = useState<string[]>([]);
  const [mobileShowContent, setMobileShowContent] = useState(false);

  /* ── Auto-load from ?url= query param ── */
  const urlDoc = useUrlDocument();
  useEffect(() => {
    if (!urlDoc.json || oscal.profile) return;
    try {
      const data = (urlDoc.json as Record<string, unknown>)["profile"] ?? urlDoc.json;
      if (!(data as Record<string, unknown>).metadata)
        throw new Error("Not an OSCAL Profile — no metadata found.");
      oscal.setProfile(data as Profile, fileNameFromUrl(urlDoc.sourceUrl!));
      setView("overview");
      setCollapsed({});
      setSearchTerm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse fetched document");
    }
  }, [urlDoc.json]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Auto-fetch catalog from profile import hrefs ── */
  const [catalogFetchStatus, setCatalogFetchStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [catalogFetchError, setCatalogFetchError] = useState<string | null>(null);
  const [catalogFetchUrl, setCatalogFetchUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setCatalogFetchStatus("idle");
      setCatalogFetchError(null);
      setCatalogFetchUrl(null);
      return;
    }

    // Find the first import that we can resolve to a URL
    let catalogUrl: string | null = null;
    let resourceTitle: string | null = null;

    for (const imp of profile.imports) {
      const href = imp.href;
      if (href.startsWith("#")) {
        // Resolve from back-matter
        const uuid = href.slice(1);
        const resources = profile["back-matter"]?.resources ?? [];
        const resource = resources.find((r) => r.uuid === uuid);
        if (resource) {
          resourceTitle = resource.title ?? null;
          // Prefer JSON rlink
          const jsonRlink = resource.rlinks?.find(
            (rl) => rl["media-type"]?.includes("json"),
          );
          const anyRlink = resource.rlinks?.[0];
          const rlink = jsonRlink ?? anyRlink;
          if (rlink) {
            catalogUrl = rlink.href;
          }
        }
      } else {
        // Direct URL
        catalogUrl = href;
      }
      if (catalogUrl) break; // use the first resolvable import
    }

    if (!catalogUrl) return;

    // If relative URL and we have a source URL for the profile, resolve it
    if (catalogUrl && !catalogUrl.startsWith("http://") && !catalogUrl.startsWith("https://")) {
      if (urlDoc.sourceUrl) {
        try {
          catalogUrl = new URL(catalogUrl, urlDoc.sourceUrl).href;
        } catch {
          // Can't resolve relative URL without a base
          setCatalogFetchError(
            `Cannot resolve relative catalog URL: ${catalogUrl}`,
          );
          setCatalogFetchStatus("error");
          return;
        }
      } else {
        // No base URL to resolve against — cannot fetch relative path
        setCatalogFetchError(
          `Cannot resolve relative catalog URL "${catalogUrl}" — profile was loaded from a local file. Load the catalog manually or use a profile with absolute URLs.`,
        );
        setCatalogFetchStatus("error");
        return;
      }
    }

    // Fetch the catalog
    let cancelled = false;
    const controller = new AbortController();
    setCatalogFetchStatus("loading");
    setCatalogFetchError(null);
    setCatalogFetchUrl(catalogUrl);

    authFetch(catalogUrl, authToken, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        // Unwrap: could be { catalog: { ... } } or just { ... }
        const catalogData =
          (json as Record<string, unknown>)["catalog"] ?? json;
        if (
          !(catalogData as Record<string, unknown>).metadata ||
          !(catalogData as Record<string, unknown>).uuid
        ) {
          throw new Error(
            "Fetched document is not a valid OSCAL Catalog (no metadata/uuid).",
          );
        }
        const fetchedFileName =
          resourceTitle ??
          fileNameFromUrl(catalogUrl!);
        oscal.setCatalog(
          catalogData as import("../context/OscalContext").Catalog,
          fetchedFileName,
        );
        setCatalogFetchStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as DOMException).name === "AbortError") return;
        setCatalogFetchError(
          err instanceof Error ? err.message : "Failed to fetch catalog",
        );
        setCatalogFetchStatus("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const controlIds = useMemo(() => {
    if (!profile) return [];

    const hasIncludeAll = profile.imports.some((imp) => imp["include-all"]);

    if (hasIncludeAll) {
      // include-all: pull every control ID from the catalog if loaded,
      // otherwise fall back to control IDs referenced in modify.alters
      if (catalog) {
        const ids: string[] = [];
        function collectFromGroup(g: Group) {
          for (const c of g.controls ?? []) {
            ids.push(c.id);
            for (const enh of c.controls ?? []) ids.push(enh.id);
          }
          for (const sg of g.groups ?? []) collectFromGroup(sg);
        }
        for (const g of catalog.groups ?? []) collectFromGroup(g);
        for (const c of catalog.controls ?? []) {
          ids.push(c.id);
          for (const enh of c.controls ?? []) ids.push(enh.id);
        }
        return ids;
      }
      // No catalog — derive from alters
      return (profile.modify?.alters ?? [])
        .map((a) => a["control-id"])
        .filter(Boolean);
    }

    // Explicit include-controls
    const ids: string[] = [];
    for (const imp of profile.imports) {
      if (imp["include-controls"]) {
        for (const ic of imp["include-controls"]) {
          if (ic["with-ids"]) ids.push(...ic["with-ids"]);
        }
      }
    }
    return ids;
  }, [profile, catalog]);

  const familyGroups = useMemo(() => buildFamilyGroups(controlIds), [controlIds]);

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
        const enhs = fg.enhancements.filter((e) => parentControlId(e) === cid);
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

  /* ── Resolver modal ── */
  const resolverModal = (
    <ResolverModal items={[{ label: "Catalog", status: catalogFetchStatus, error: catalogFetchError, resolvedLabel: oscal.catalog?.fileName ?? null, resolvedUrl: catalogFetchUrl }]} />
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
          {resolverModal}
          <div style={S.topBar}>
            <button onClick={() => setMobileShowContent(false)} style={S.mobileBackBtn}>← Back</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.white, flex: 1, textAlign: "center" }}>Profile</div>
            <button style={S.topBtn} onClick={handleNewFile}>New</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <ViewRouter view={view} profile={profile} familyGroups={familyGroups}
              alterMap={alterMap} setParamMap={setParamMap} controlIds={controlIds} navigate={mobileNavigate}
              catalogFetchStatus={catalogFetchStatus} catalogFetchError={catalogFetchError} />
          </div>
        </div>
      );
    }
    return (
      <div style={S.shell}>
        {resolverModal}
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
      {resolverModal}
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

        {/* ── CONTENT PANEL ── */}
        <div ref={contentRef} style={S.content}>
          <ViewRouter
            view={view}
            profile={profile}
            familyGroups={familyGroups}
            alterMap={alterMap}
            setParamMap={setParamMap}
            controlIds={controlIds}
            navigate={navigate}
            catalogFetchStatus={catalogFetchStatus}
            catalogFetchError={catalogFetchError}
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
    if (fg.name.toLowerCase().includes(lowerSearch)) return true;
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
              label={`${fg.prefix.toUpperCase()} ${fg.name}`}
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
              const enhs = fg.enhancements.filter((e) => parentControlId(e) === cid);
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
                    {enhs.length > 0 && <IcoChev open={!isCtrlCollapsed} style={{ marginRight: 4 }} />}
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
        label: `${fg.prefix.toUpperCase()} ${fg.name}`,
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
      label: `${fg.prefix.toUpperCase()} ${fg.name} — Overview`,
      icon: <IcoInfo size={16} style={{ color: colors.cobalt }} />,
      isBranch: false,
    });
    for (const cid of fg.controls) {
      const enhs = fg.enhancements.filter((e) => parentControlId(e) === cid);
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
    const prefix = familyPrefix(cid);
    const fg = familyGroups.find((f) => f.prefix === prefix);
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
    const enhs = fg.enhancements.filter((e) => parentControlId(e) === cid);
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
            icon: isEnhancement(cid)
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
        crumbs.push({ label: fg ? `${fg.prefix.toUpperCase()} ${fg.name}` : prefix });
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

function ViewRouter({ view, profile, familyGroups, alterMap, setParamMap, controlIds, navigate, catalogFetchStatus, catalogFetchError }: {
  view: string;
  profile: Profile;
  familyGroups: FamilyGroup[];
  alterMap: Map<string, Alter>;
  setParamMap: Map<string, SetParameter[]>;
  controlIds: string[];
  navigate: (id: string) => void;
  catalogFetchStatus: "idle" | "loading" | "success" | "error";
  catalogFetchError: string | null;
}) {
  if (view === "overview") return <OverviewView profile={profile} familyGroups={familyGroups} controlIds={controlIds} navigate={navigate} catalogFetchStatus={catalogFetchStatus} catalogFetchError={catalogFetchError} />;
  if (view === "metadata") return <MetadataView profile={profile} navigate={navigate} />;
  if (view === "imports") return <ImportsView profile={profile} controlIds={controlIds} navigate={navigate} />;

  if (view.startsWith("family-")) {
    const prefix = view.replace("family-", "");
    const fg = familyGroups.find((f) => f.prefix === prefix);
    if (fg) return <FamilyView familyGroup={fg} alterMap={alterMap} setParamMap={setParamMap} navigate={navigate} />;
  }

  if (view.startsWith("ctrl-")) {
    const cid = view.replace("ctrl-", "");
    return <ControlModView controlId={cid} alterMap={alterMap} setParamMap={setParamMap} profile={profile} navigate={navigate} />;
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

function MField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, color: colors.black, marginTop: 2, fontFamily: mono ? fonts.mono : fonts.sans, wordBreak: "break-all" }}>{value || "—"}</div>
    </div>
  );
}

function PropPill({ name, value, ns }: { name: string; value: string; ns?: string }) {
  const isFedRamp = ns?.includes("fedramp");
  return (
    <span style={{
      display: "inline-block", fontSize: 11, padding: "2px 8px", borderRadius: radii.pill,
      backgroundColor: isFedRamp ? alpha(colors.brightBlue, 7) : colors.bg,
      color: isFedRamp ? colors.brightBlue : colors.black,
      fontFamily: fonts.mono,
      border: `1px solid ${isFedRamp ? alpha(colors.brightBlue, 20) : colors.paleGray}`,
      marginRight: 6, marginBottom: 4,
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
    <div style={{ textAlign: "center" }}>
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

function OverviewView({ profile, familyGroups, controlIds, navigate, catalogFetchStatus, catalogFetchError }: {
  profile: Profile; familyGroups: FamilyGroup[]; controlIds: string[]; navigate: (id: string) => void;
  catalogFetchStatus: "idle" | "loading" | "success" | "error";
  catalogFetchError: string | null;
}) {
  const oscal = useOscal();
  const totalControls = controlIds.length;
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
      <h1 style={{ fontSize: 22, color: colors.navy, marginBottom: 4 }}>{profile.metadata.title}</h1>
      <p style={{ fontSize: 13, color: colors.gray, marginBottom: 20 }}>
        Version {profile.metadata.version ?? "—"} · OSCAL {profile.metadata["oscal-version"] ?? "—"} · Last modified {fmtDate(profile.metadata["last-modified"])}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Selected Controls", value: totalControls, color: colors.cobalt },
          { label: "Control Families", value: familyGroups.length, color: colors.navy },
          { label: "Parameter Constraints", value: setParamCount, color: colors.brightBlue },
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
          const selCount = imp["include-controls"]
            ? imp["include-controls"].reduce((s, ic) => s + (ic["with-ids"]?.length ?? 0), 0)
            : imp["include-all"] ? "ALL" : 0;
          return (
            <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>
                {resolved.title ?? resolved.url ?? imp.href}
              </div>
              {resolved.url && (
                <div style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono, marginTop: 2 }}>
                  {trunc(resolved.url, 80)}
                </div>
              )}
              <div style={{ fontSize: 12, color: colors.cobalt, marginTop: 4 }}>
                {typeof selCount === "number" ? `${selCount} controls selected` : selCount}
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
                {fg.prefix.toUpperCase()} {fg.name}
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

  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: "metadata", label: "Metadata" }]} navigate={navigate} />
      <h1 style={{ fontSize: 20, color: colors.navy, marginBottom: 16 }}>Document Metadata</h1>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 16 }}>
          <MField label="Title" value={meta.title} />
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
   IMPORTS VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function ImportsView({ profile, controlIds, navigate }: { profile: Profile; controlIds: string[]; navigate: (id: string) => void }) {
  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: "imports", label: "Imports" }]} navigate={navigate} />
      <h1 style={{ fontSize: 20, color: colors.navy, marginBottom: 16 }}>Imports</h1>

      {profile.imports.map((imp, i) => {
        const resolved = resolveImportHref(profile, imp);
        return (
          <Card key={i}>
            <SectionLabel>Source Catalog {profile.imports.length > 1 ? `#${i + 1}` : ""}</SectionLabel>
            <MField label="Title" value={resolved.title ?? "—"} />
            {resolved.url && <MField label="URL" value={resolved.url} mono />}
            {resolved.resourceUuid && <MField label="Resource UUID" value={resolved.resourceUuid} mono />}
            <MField label="Selection Method" value={
              imp["include-all"] ? "Include All" :
              imp["include-controls"] ? "Include by ID" : "—"
            } />
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
    { id: `family-${fg.prefix}`, label: `${fg.prefix.toUpperCase()} ${fg.name}` },
  ];

  return (
    <div>
      <Breadcrumbs items={crumbs} navigate={navigate} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <IcoFolder size={22} style={{ color: colors.cobalt }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {fg.prefix.toUpperCase()} {fg.name}
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
          const enhs = fg.enhancements.filter((e) => parentControlId(e) === cid);
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

function ControlModView({ controlId, alterMap, setParamMap, navigate }: {
  controlId: string;
  alterMap: Map<string, Alter>;
  setParamMap: Map<string, SetParameter[]>;
  profile: Profile;
  navigate: (id: string) => void;
}) {
  const oscal = useOscal();
  const catalog = oscal.catalog?.data as Catalog | null;
  const alter = alterMap.get(controlId);
  const setParams = setParamMap.get(controlId) ?? [];
  const fp = familyPrefix(controlId);
  const famName = FAMILY_NAMES[fp] || fp.toUpperCase();

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
  if (isEnhancement(controlId)) {
    const pid = parentControlId(controlId);
    crumbs.push({ id: `ctrl-${pid}`, label: controlLabel(pid) });
  }
  crumbs.push({ id: `ctrl-${controlId}`, label: controlLabel(controlId) });

  // Control title from catalog
  const controlTitle = catalogControl?.title ?? "";
  const controlLbl = catalogControl ? getLabel(catalogControl.props) : "";
  const displayLabel = controlLbl ? `${controlLbl} ` : "";

  // Enhancements from catalog
  const enhancements = catalogControl?.controls ?? [];

  // Links from catalog
  const links = catalogControl?.links ?? [];

  // Resolve back-matter links from catalog
  const resources = catalog?.["back-matter"]?.resources ?? [];
  const resMap: Record<string, Resource> = {};
  resources.forEach((r) => { resMap[r.uuid] = r; });

  // Check for CORE prop in profile adds
  const adds = alter?.adds ?? [];
  const coreAdd = adds.find((a) => a.props?.some((p) => p.name === "CORE"));

  return (
    <div>
      <Breadcrumbs items={crumbs} navigate={navigate} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoShield size={22} style={{ color: colors.navy }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {displayLabel}{controlTitle || controlLabel(controlId)}
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
      <div style={{ fontSize: 12, fontFamily: fonts.mono, color: colors.gray, marginBottom: 16 }}>
        {controlId}
      </div>

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

      {/* Set-Parameters */}
      {setParams.length > 0 && (
        <Card style={{ borderLeft: `4px solid ${colors.brightBlue}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <IcoSliders size={18} style={{ color: colors.brightBlue }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: colors.brightBlue }}>Parameter Constraints</span>
            <span style={{ fontSize: 11, color: colors.gray, marginLeft: "auto" }}>{setParams.length} parameter(s)</span>
          </div>
          {setParams.map((sp) => (
            <div key={sp["param-id"]} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 12, fontFamily: fonts.mono, fontWeight: 600,
                  color: colors.orange, backgroundColor: alpha(colors.orange, 7),
                  padding: "1px 6px", borderRadius: radii.sm,
                  border: `1px solid ${alpha(colors.orange, 20)}`,
                }}>
                  {sp["param-id"]}
                </span>
                {sp.label && <span style={{ fontSize: 12, color: colors.gray }}>({sp.label})</span>}
              </div>
              {sp.constraints && sp.constraints.map((c, ci) => (
                <div key={ci} style={{ fontSize: 13, color: colors.black, marginTop: 4, paddingLeft: 8, borderLeft: `2px solid ${alpha(colors.brightBlue, 20)}` }}>
                  {c.description ?? "No description"}
                </div>
              ))}
              {sp.values && sp.values.length > 0 && (
                <div style={{ marginTop: 4, paddingLeft: 8 }}>
                  <span style={{ fontSize: 11, color: colors.gray }}>Values: </span>
                  {sp.values.map((v, vi) => (
                    <span key={vi} style={{ fontSize: 12, fontFamily: fonts.mono, marginRight: 6 }}>{v}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
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
              <ResolvedPartTree key={part.id ?? i} part={part} depth={0} paramMap={paramMap} />
            ))}
          </Card>
        );
      })}

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
                    <PropPill key={pi} name={p.name} value={p.value} ns={p.ns} />
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
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {catalogControl.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} ns={p.ns} />)}
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
                  ? (x.resource.title ?? x.resource.citation?.text ?? "Untitled")
                  : (x.lk.text ?? x.lk.href);
                const href = x.resource?.rlinks?.[0]?.href ?? (x.lk.href.startsWith("#") ? undefined : x.lk.href);
                return (
                  <span key={i} style={{
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
            const eWithdrawn = (enh.props ?? []).some((p) => p.name === "status" && p.value === "withdrawn");
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
                  {enh.title}
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

function ResolvedPartTree({ part, depth, paramMap }: {
  part: ResolvedPart; depth: number; paramMap: Record<string, Param>;
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

  return (
    <div style={{
      marginTop: depth === 0 ? 0 : 8,
      paddingLeft: depth > 0 ? 16 : 0,
      borderLeft: depth > 0 ? `3px solid ${borderColor}` : "none",
      backgroundColor: isAdded ? alpha(colors.successFg, 6) : isRemoved ? alpha(colors.dangerFg, 10) : "transparent",
      borderRadius: isAdded || isRemoved ? radii.sm : 0,
      padding: isAdded || isRemoved ? (depth > 0 ? "4px 4px 4px 16px" : "4px") : undefined,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        {/* Badge for add/remove */}
        {isAdded && <AddBadge size={18} />}
        {isRemoved && <RemoveBadge size={18} />}

        <div style={{ flex: 1 }}>
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
              <span style={{
                fontSize: 13, lineHeight: 1.75,
                color: colors.dangerFg, textDecoration: "line-through", opacity: 0.75,
              }}>
                {part.prose}
              </span>
            ) : (
              <ProseWithParamsProfile text={part.prose} paramMap={paramMap} isAdded={isAdded} />
            )
          )}

          {/* Links within a part */}
          {part.links && part.links.length > 0 && !isRemoved && (
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
        </div>
      </div>

      {/* Recursive children */}
      {subParts.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {subParts.map((sp, i) => (
            <ResolvedPartTree key={sp.id ?? i} part={sp} depth={depth + 1} paramMap={paramMap} />
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
              {part.title && <span>{part.title}</span>}
            </div>
          )}
          {part.prose && (
            <span style={{ fontSize: 13, lineHeight: 1.75, color: colors.black }}>{part.prose}</span>
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

function ProseWithParamsProfile({ text, paramMap, isAdded }: {
  text: string; paramMap: Record<string, Param>; isAdded?: boolean;
}) {
  const parts = text.split(/(\{\{\s*insert:\s*param\s*,\s*[^}]+?\s*\}\})/g);

  return (
    <span style={{
      fontSize: 13, lineHeight: 1.75,
      color: isAdded ? colors.successFg : colors.black,
      fontFamily: fonts.sans,
    }}>
      {parts.map((segment, i) => {
        const match = segment.match(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/);
        if (match) {
          const paramId = match[1].trim();
          const param = paramMap[paramId];
          const rendered = param ? renderParamTextProfile(param, paramMap) : `[Assignment: ${paramId}]`;
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
