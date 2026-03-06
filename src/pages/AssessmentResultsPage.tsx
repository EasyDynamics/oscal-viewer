/* ═══════════════════════════════════════════════════════════════════════════
   Assessment Results Page — SPA-style viewer for OSCAL Assessment Results
   Left sidebar treeview (results → control families → observations)
   Right content panel with overview, metadata, and observation detail views
   Integrates with loaded Catalog for control context & param rendering
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
  Catalog as OscalCatalog,
  Control as CatalogControl,
  Group as CatalogGroup,
  Part as CatalogPart,
  Param as CatalogParam,
} from "../context/OscalContext";

/* ═══════════════════════════════════════════════════════════════════════════
   OSCAL ASSESSMENT RESULTS TYPES
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
  "resource-fragment"?: string;
}

interface Metadata {
  title: string;
  version?: string;
  "last-modified"?: string;
  "oscal-version"?: string;
  parties?: { uuid: string; type: string; name: string; "short-name"?: string }[];
  roles?: { id: string; title: string }[];
  props?: OscalProp[];
}

interface Observation {
  uuid: string;
  title: string;
  description: string;
  collected?: string;
  methods: string[];
  types?: string[];
  subjects?: { "subject-uuid"?: string; type?: string }[];
  props?: OscalProp[];
  links?: Link[];
  remarks?: string;
  "relevant-evidence"?: { href: string; description?: string }[];
}

interface FindingTarget {
  type: string;
  "target-id": string;
  status: { state: string; reason?: string };
  "implementation-status"?: { state: string };
  props?: OscalProp[];
}

interface Finding {
  uuid: string;
  title?: string;
  description?: string;
  target: FindingTarget;
  "implementation-statement-uuid"?: string;
  "related-observations"?: { "observation-uuid": string }[];
  "associated-risks"?: { "risk-uuid": string }[];
  remarks?: string;
  props?: OscalProp[];
  links?: Link[];
}

interface RiskFacet {
  name: string;
  system: string;
  value: string;
  props?: OscalProp[];
}

interface RiskCharacterization {
  origin?: { type?: string; actors?: { type: string; "actor-uuid": string }[] };
  facets: RiskFacet[];
}

interface Remediation {
  uuid: string;
  lifecycle: string;
  title: string;
  description: string;
  props?: OscalProp[];
  tasks?: {
    uuid: string;
    type: string;
    title: string;
    description: string;
    timing?: { "within-date-range"?: { start: string; end: string } };
  }[];
}

interface Risk {
  uuid: string;
  title: string;
  description: string;
  statement?: string;
  status: string;
  characterizations?: RiskCharacterization[];
  "mitigating-factors"?: { uuid: string; description: string; "implementation-uuid"?: string }[];
  remediations?: Remediation[];
  deadline?: string;
  props?: OscalProp[];
  links?: Link[];
}

interface ReviewedControls {
  "control-selections"?: {
    description?: string;
    "include-controls"?: { "control-id": string }[];
    "include-all"?: Record<string, unknown>;
  }[];
}

interface Result {
  uuid: string;
  title: string;
  description: string;
  start: string;
  end?: string;
  observations?: Observation[];
  findings?: Finding[];
  risks?: Risk[];
  "reviewed-controls"?: ReviewedControls;
  props?: OscalProp[];
}

interface ImportAp {
  href: string;
  remarks?: string;
}

interface Resource {
  uuid: string;
  title?: string;
  rlinks?: { href: string }[];
  remarks?: string;
}

interface AssessmentResults {
  uuid: string;
  metadata: Metadata;
  "import-ap"?: ImportAp;
  results: Result[];
  "back-matter"?: { resources?: Resource[] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Status color mapping for observation results */
const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  Pass:                  { bg: colors.statusPassBg, fg: colors.statusPassFg, border: colors.statusPassBorder },
  Fail:                  { bg: colors.statusFailBg, fg: colors.statusFailFg, border: colors.statusFailBorder },
  Error:                 { bg: colors.statusErrorBg, fg: colors.statusErrorFg, border: colors.statusErrorBorder },
  "N/A":                 { bg: colors.statusNaBg, fg: colors.statusNaFg, border: colors.statusNaBorder },
  "Error - Test results missing": { bg: colors.statusErrorBg, fg: colors.statusErrorFg, border: colors.statusErrorBorder },
};

const CRITICALITY_COLORS: Record<string, { bg: string; fg: string }> = {
  Shall:                                { bg: alpha(colors.red, 8), fg: colors.red },
  "Shall/Not-Implemented":              { bg: alpha(colors.red, 8), fg: colors.red },
  Should:                               { bg: alpha(colors.orange, 8), fg: colors.orange },
  "Should/Not-Implemented":             { bg: alpha(colors.orange, 8), fg: colors.orange },
  May:                                  { bg: alpha(colors.cobalt, 8), fg: colors.cobalt },
  "-":                                  { bg: colors.bg, fg: colors.gray },
};

/** Finding target state colors */
const FINDING_STATE_COLORS: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  satisfied:      { bg: colors.statusPassBg, fg: colors.statusPassFg, border: colors.statusPassBorder, label: "Satisfied" },
  "not-satisfied": { bg: colors.statusFailBg, fg: colors.statusFailFg, border: colors.statusFailBorder, label: "Not Satisfied" },
};

/** Risk level severity colors (for facets such as likelihood, impact, risk) */
const RISK_LEVEL_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  low:      { bg: colors.statusPassBg, fg: colors.statusPassFg, border: colors.statusPassBorder },
  moderate: { bg: colors.statusErrorBg, fg: colors.statusErrorFg, border: colors.statusErrorBorder },
  high:     { bg: colors.statusFailBg, fg: colors.statusFailFg, border: colors.statusFailBorder },
  critical: { bg: "#4a0010", fg: "#ff1744", border: "#d50000" },
};

/** Risk status colors */
const RISK_STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  open:                    { bg: colors.statusFailBg, fg: colors.statusFailFg, border: colors.statusFailBorder },
  investigating:           { bg: colors.statusErrorBg, fg: colors.statusErrorFg, border: colors.statusErrorBorder },
  remediating:             { bg: colors.statusErrorBg, fg: colors.statusErrorFg, border: colors.statusErrorBorder },
  "deviation-requested":   { bg: colors.statusNaBg, fg: colors.statusNaFg, border: colors.statusNaBorder },
  "deviation-approved":    { bg: alpha(colors.cobalt, 8), fg: colors.cobalt, border: colors.cobalt },
  closed:                  { bg: colors.statusPassBg, fg: colors.statusPassFg, border: colors.statusPassBorder },
};

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

function fmtDateTime(s?: string) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}

/** Extract a prop value by name from an observation */
function getProp(props: OscalProp[] | undefined, name: string): string {
  return props?.find((p) => p.name === name)?.value ?? "";
}

/** Parse the "control group" from an observation (e.g., "Legacy Authentication") */
function getControlGroup(obs: Observation): string {
  return getProp(obs.props, "control-group") || "Uncategorized";
}

/** Parse the status from an observation */
function getStatus(obs: Observation): string {
  return getProp(obs.props, "result") || "Unknown";
}

/** Parse the criticality from an observation */
function getCriticality(obs: Observation): string {
  return getProp(obs.props, "criticality") || "—";
}

/** Parse the baseline reference link */
function getBaselineRef(obs: Observation): string {
  return getProp(obs.props, "baseline-reference") || "";
}

/** Extract NIST SP 800-53 control IDs from free text (e.g. remarks). Matches patterns like AC-2, AC-2(12), CM-6(a), SC-7(10)(a) */
const NIST_CONTROL_RE = /\b([A-Z]{2}-\d+(?:\(\d+\))?(?:\([a-z]\))?)\b/g;
function extractNistControls(text: string | undefined): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  for (const m of text.matchAll(NIST_CONTROL_RE)) ids.add(m[1]);
  return [...ids].sort();
}

/** Try to extract the test ID number from the title for a sort key */
function getSortKey(title: string): string {
  const m = title.match(/MS\.(\w+)\.(\d+)\.(\d+)/);
  if (m) {
    return `${m[1]}.${m[2].padStart(3, "0")}.${m[3].padStart(3, "0")}`;
  }
  return title;
}

/** Get the primary risk level from a Risk's characterizations (looks for "risk" or "likelihood" facet) */
function getRiskLevel(risk: Risk): string {
  for (const ch of risk.characterizations ?? []) {
    for (const f of ch.facets) {
      if (f.name === "risk" || f.name === "risk-level") return f.value.toLowerCase();
    }
  }
  // Fallback to likelihood
  for (const ch of risk.characterizations ?? []) {
    for (const f of ch.facets) {
      if (f.name === "likelihood") return f.value.toLowerCase();
    }
  }
  return "unknown";
}

/** Get all facets from a Risk's characterizations */
function getRiskFacets(risk: Risk): RiskFacet[] {
  const facets: RiskFacet[] = [];
  for (const ch of risk.characterizations ?? []) {
    facets.push(...ch.facets);
  }
  return facets;
}

/** Sort key for risk severity: critical > high > moderate > low */
function riskSeveritySortKey(risk: Risk): number {
  const level = getRiskLevel(risk);
  switch (level) {
    case "critical": return 0;
    case "high":     return 1;
    case "moderate": return 2;
    case "low":      return 3;
    default:         return 4;
  }
}

/* ── Catalog lookup helpers ── */

// @ts-ignore: reserved for future catalog enrichment
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

// @ts-ignore: reserved for future catalog enrichment
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

function resolveCatalogInlineParams(text: string, paramMap: Record<string, CatalogParam>): string {
  return text.replace(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/g, (_match, id: string) => {
    const param = paramMap[id.trim()];
    if (!param) return `[Assignment: ${id.trim()}]`;
    return renderCatalogParamText(param, paramMap);
  });
}

function getCatalogLabel(props?: { name: string; value: string; class?: string }[]): string {
  if (!props) return "";
  const lbl = props.find(p => p.name === "label" && p.class !== "zero-padded");
  return lbl?.value ?? props.find(p => p.name === "label")?.value ?? "";
}

/* ═══════════════════════════════════════════════════════════════════════════
   INLINE SVG ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconProps { size?: number; style?: CSSProperties }

function IcoUpload({ size = 20, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
}
function IcoHome({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
}
function IcoInfo({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
}
function IcoShield({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}
function IcoCheck({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function IcoFolder({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>;
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
function IcoAlert({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function IcoClipboard({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>;
}
function IcoExternalLink({ size = 14, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}
function IcoBook({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>;
}
function IcoTarget({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
}
function IcoAlertTriangle({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function IcoTool({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>;
}
function IcoCheckCircle({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function IcoXCircle({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>;
}
function IcoEye({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AssessmentResultsPage() {
  const oscal = useOscal();
  const ar = (oscal.assessmentResults?.data as AssessmentResults) ?? null;
  const fileName = oscal.assessmentResults?.fileName ?? "";
  const catalog = oscal.catalog?.data ?? null;
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const contentRef = useRef<HTMLDivElement>(null);

  /* ── Auto-load from ?url= query param ── */
  const urlDoc = useUrlDocument();
  useEffect(() => {
    if (!urlDoc.json || oscal.assessmentResults) return;
    try {
      const data = (urlDoc.json as Record<string, unknown>)["assessment-results"] ?? urlDoc.json;
      if (!(data as Record<string, unknown>).metadata)
        throw new Error("Not an OSCAL Assessment Results — no metadata found.");
      if (!(data as Record<string, unknown>).results || !Array.isArray((data as Record<string, unknown>).results))
        throw new Error("Not an OSCAL Assessment Results — no results array found.");
      oscal.setAssessmentResults(data as AssessmentResults, fileNameFromUrl(urlDoc.sourceUrl!));
      setView("overview");
      setCollapsed({});
      setSearchTerm("");
      setStatusFilter("all");
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
        const data = json["assessment-results"] ?? json;
        if (!data.metadata)
          throw new Error("Not an OSCAL Assessment Results — no metadata found.");
        if (!data.results || !Array.isArray(data.results))
          throw new Error("Not an OSCAL Assessment Results — no results array found.");
        oscal.setAssessmentResults(data as AssessmentResults, file.name);
        setView("overview");
        setCollapsed({});
        setSearchTerm("");
        setStatusFilter("all");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse JSON");
      }
    };
    reader.readAsText(file);
  }, [oscal]);

  const handleNewFile = useCallback(() => {
    oscal.clearAssessmentResults();
    setError("");
    setView("overview");
    setSearchTerm("");
    setStatusFilter("all");
  }, [oscal]);

  /* ── Aggregate all observations from all results ── */
  const allObservations = useMemo(() => {
    if (!ar) return [];
    return ar.results.flatMap((r) => r.observations ?? []);
  }, [ar]);

  /* ── Group observations by control-group prop ── */
  const groupedObservations = useMemo(() => {
    const groups: Record<string, Observation[]> = {};
    allObservations.forEach((obs) => {
      const group = getControlGroup(obs);
      (groups[group] ??= []).push(obs);
    });
    Object.values(groups).forEach((obs) => obs.sort((a, b) => getSortKey(a.title).localeCompare(getSortKey(b.title))));
    return groups;
  }, [allObservations]);

  /** Sorted group names */
  const groupNames = useMemo(() => {
    return Object.keys(groupedObservations).sort();
  }, [groupedObservations]);

  /* ── Status counts ── */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allObservations.forEach((obs) => {
      const s = getStatus(obs);
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [allObservations]);

  /* ── Aggregate all findings from all results ── */
  const allFindings = useMemo(() => {
    if (!ar) return [];
    return ar.results.flatMap((r) => (r.findings ?? []).filter((f) => f.uuid && f.target));
  }, [ar]);

  /* ── Aggregate all risks from all results ── */
  const allRisks = useMemo(() => {
    if (!ar) return [];
    return ar.results.flatMap((r) => (r.risks ?? []).filter((rk) => rk.uuid));
  }, [ar]);

  /** Finding state counts */
  const findingStateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allFindings.forEach((f) => {
      const state = f.target.status.state;
      counts[state] = (counts[state] ?? 0) + 1;
    });
    return counts;
  }, [allFindings]);

  /** Risk level counts */
  const riskLevelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allRisks.forEach((r) => {
      const level = getRiskLevel(r);
      counts[level] = (counts[level] ?? 0) + 1;
    });
    return counts;
  }, [allRisks]);

  /** Risk status counts */
  const riskStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allRisks.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return counts;
  }, [allRisks]);

  /** Observation lookup map by uuid */
  const obsMap = useMemo(() => {
    const m: Record<string, Observation> = {};
    allObservations.forEach((o) => { m[o.uuid] = o; });
    return m;
  }, [allObservations]);

  /** Risk lookup map by uuid */
  const riskMap = useMemo(() => {
    const m: Record<string, Risk> = {};
    allRisks.forEach((r) => { m[r.uuid] = r; });
    return m;
  }, [allRisks]);

  /** NIST control IDs extracted from observation remarks */
  const obsNistMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    allObservations.forEach((o) => {
      const ids = extractNistControls(o.remarks);
      if (ids.length) m[o.uuid] = ids;
    });
    return m;
  }, [allObservations]);

  /** NIST control IDs for each finding (aggregated from its related observations) */
  const findingNistMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    allFindings.forEach((f) => {
      const ids = new Set<string>();
      (f["related-observations"] ?? []).forEach((ro) => {
        (obsNistMap[ro["observation-uuid"]] ?? []).forEach((id) => ids.add(id));
      });
      if (ids.size) m[f.uuid] = [...ids].sort();
    });
    return m;
  }, [allFindings, obsNistMap]);

  /** NIST control IDs for each risk (aggregated from findings that reference it) */
  const riskNistMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    allFindings.forEach((f) => {
      const fNist = findingNistMap[f.uuid] ?? [];
      if (!fNist.length) return;
      (f["associated-risks"] ?? []).forEach((ar) => {
        const prev = m[ar["risk-uuid"]] ?? [];
        const merged = new Set([...prev, ...fNist]);
        m[ar["risk-uuid"]] = [...merged].sort();
      });
    });
    return m;
  }, [allFindings, findingNistMap]);

  /* ── Default collapsed state ── */
  const defaultCollapsed = useMemo(() => {
    const dc: Record<string, boolean> = {};
    groupNames.forEach((g) => { dc[`group-${g}`] = true; });
    dc["findings-section"] = true;
    dc["risks-section"] = true;
    ar?.results.forEach((_r, i) => {
      if (ar.results.length > 1) dc[`result-${i}`] = true;
    });
    return dc;
  }, [groupNames, ar]);

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
  if (!ar) {
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
            OSCAL Assessment Results Viewer
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
              placeholder="Search observations"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={S.searchInput}
            />
          </div>

          {/* Status filter */}
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${colors.bg}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
            <FilterPill label="All" count={allObservations.length} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            {Object.entries(statusCounts).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => (
              <FilterPill key={status} label={status} count={count} active={statusFilter === status} onClick={() => setStatusFilter(status)} />
            ))}
          </div>

          {/* Fixed nav items */}
          <NavRow id="overview" label="Overview" icon={<IcoHome size={14} style={{ color: colors.navy }} />}
            active={view === "overview"} onClick={() => navigate("overview")} depth={0} />
          <NavRow id="metadata" label="Metadata" icon={<IcoInfo size={14} style={{ color: colors.navy }} />}
            active={view === "metadata"} onClick={() => navigate("metadata")} depth={0} />

          {/* Results tree */}
          {ar.results.length === 1 ? (
            <SidebarGroupTree
              groupedObservations={groupedObservations}
              groupNames={groupNames}
              view={view}
              collapsed={mergedCollapsed}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              navigate={navigate}
              toggleGroup={toggleGroup}
            />
          ) : (
            ar.results.map((result, ri) => {
              const resultId = `result-${ri}`;
              const isCollapsed = !!mergedCollapsed[resultId];
              return (
                <div key={ri}>
                  <NavRow
                    id={resultId}
                    label={trunc(result.title, 30)}
                    icon={<IcoClipboard size={14} style={{ color: colors.cobalt }} />}
                    active={view === resultId}
                    onClick={() => navigate(resultId)}
                    depth={0}
                    badge={result.observations?.length}
                    hasChildren
                    expanded={!isCollapsed}
                    onToggle={() => toggleGroup(resultId)}
                  />
                  {!isCollapsed && (
                    <SidebarGroupTree
                      groupedObservations={groupedObservations}
                      groupNames={groupNames}
                      view={view}
                      collapsed={mergedCollapsed}
                      searchTerm={searchTerm}
                      statusFilter={statusFilter}
                      navigate={navigate}
                      toggleGroup={toggleGroup}
                      depthOffset={1}
                    />
                  )}
                </div>
              );
            })
          )}

          {/* Findings section */}
          {allFindings.length > 0 && (() => {
            const isCollapsed = !!mergedCollapsed["findings-section"];
            return (
              <>
                <NavRow
                  id="findings-section"
                  label={`Findings (${allFindings.length})`}
                  icon={<IcoTarget size={14} style={{ color: colors.darkGreen }} />}
                  active={view === "findings"}
                  onClick={() => navigate("findings")}
                  depth={0}
                  badge={allFindings.length}
                  hasChildren
                  expanded={!isCollapsed}
                  onToggle={() => toggleGroup("findings-section")}
                />
                {!isCollapsed && allFindings.map((f) => {
                  const state = f.target.status.state;
                  const sc = FINDING_STATE_COLORS[state];
                  return (
                    <NavRow
                      key={f.uuid}
                      id={`finding-${f.uuid}`}
                      label={f.target["target-id"].toUpperCase()}
                      icon={state === "satisfied"
                        ? <IcoCheckCircle size={12} style={{ color: colors.statusPassFg }} />
                        : <IcoXCircle size={12} style={{ color: colors.statusFailFg }} />}
                      active={view === `finding-${f.uuid}`}
                      onClick={() => navigate(`finding-${f.uuid}`)}
                      depth={1}
                      statusColor={sc?.border}
                    />
                  );
                })}
              </>
            );
          })()}

          {/* Risks section */}
          {allRisks.length > 0 && (() => {
            const isCollapsed = !!mergedCollapsed["risks-section"];
            const sorted = [...allRisks].sort((a, b) => riskSeveritySortKey(a) - riskSeveritySortKey(b));
            return (
              <>
                <NavRow
                  id="risks-section"
                  label={`Risks (${allRisks.length})`}
                  icon={<IcoAlertTriangle size={14} style={{ color: colors.red }} />}
                  active={view === "risks"}
                  onClick={() => navigate("risks")}
                  depth={0}
                  badge={allRisks.length}
                  hasChildren
                  expanded={!isCollapsed}
                  onToggle={() => toggleGroup("risks-section")}
                />
                {!isCollapsed && sorted.map((r) => {
                  const level = getRiskLevel(r);
                  const rc = RISK_LEVEL_COLORS[level];
                  return (
                    <NavRow
                      key={r.uuid}
                      id={`risk-${r.uuid}`}
                      label={trunc(r.title, 32)}
                      icon={<IcoAlertTriangle size={12} style={{ color: rc?.fg ?? colors.gray }} />}
                      active={view === `risk-${r.uuid}`}
                      onClick={() => navigate(`risk-${r.uuid}`)}
                      depth={1}
                      statusColor={rc?.border}
                    />
                  );
                })}
              </>
            );
          })()}
        </nav>

        {/* ── CONTENT PANEL ── */}
        <div ref={contentRef} style={S.content}>
          <ViewRouter
            view={view}
            ar={ar}
            navigate={navigate}
            allObservations={allObservations}
            allFindings={allFindings}
            allRisks={allRisks}
            obsMap={obsMap}
            riskMap={riskMap}
            obsNistMap={obsNistMap}
            findingNistMap={findingNistMap}
            riskNistMap={riskNistMap}
            groupedObservations={groupedObservations}
            groupNames={groupNames}
            statusCounts={statusCounts}
            findingStateCounts={findingStateCounts}
            riskLevelCounts={riskLevelCounts}
            riskStatusCounts={riskStatusCounts}
            statusFilter={statusFilter}
            catalog={catalog}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FILTER PILL
   ═══════════════════════════════════════════════════════════════════════════ */

function FilterPill({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  const sc = STATUS_COLORS[label];
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: radii.pill,
        cursor: "pointer",
        backgroundColor: active ? (sc?.border ?? colors.navy) : colors.bg,
        color: active ? colors.white : (sc?.fg ?? colors.gray),
        border: `1px solid ${active ? "transparent" : (sc?.border ?? colors.paleGray)}`,
        transition: "all .15s",
      }}
    >
      {label} ({count})
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAV ROW
   ═══════════════════════════════════════════════════════════════════════════ */

function NavRow({ id: _id, label, icon, active, onClick, depth, badge, hasChildren, expanded, onToggle, statusColor }: {
  id: string; label: string; icon: ReactNode; active: boolean;
  onClick: () => void; depth: number; badge?: number;
  hasChildren?: boolean; expanded?: boolean; onToggle?: () => void;
  statusColor?: string;
}) {
  return (
    <div
      onClick={() => { if (hasChildren && onToggle) onToggle(); onClick(); }}
      style={{
        ...S.navItem,
        paddingLeft: 12 + depth * 16,
        backgroundColor: active ? alpha(colors.orange, 7) : "transparent",
        borderLeft: active ? `3px solid ${colors.orange}` : statusColor ? `3px solid ${statusColor}` : "3px solid transparent",
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
   SIDEBAR GROUP TREE — groups → observations
   ═══════════════════════════════════════════════════════════════════════════ */

function SidebarGroupTree({ groupedObservations, groupNames, view, collapsed, searchTerm, statusFilter, navigate, toggleGroup, depthOffset = 0 }: {
  groupedObservations: Record<string, Observation[]>;
  groupNames: string[];
  view: string;
  collapsed: Record<string, boolean>;
  searchTerm: string;
  statusFilter: string;
  navigate: (id: string) => void;
  toggleGroup: (id: string) => void;
  depthOffset?: number;
}) {
  const lowerSearch = searchTerm.toLowerCase().trim();

  return (
    <>
      {groupNames.map((groupName) => {
        const observations = groupedObservations[groupName] ?? [];
        const visible = observations.filter((obs) => {
          if (statusFilter !== "all" && getStatus(obs) !== statusFilter) return false;
          if (lowerSearch) {
            if (obs.title.toLowerCase().includes(lowerSearch)) return true;
            if (obs.description.toLowerCase().includes(lowerSearch)) return true;
            if (groupName.toLowerCase().includes(lowerSearch)) return true;
            return false;
          }
          return true;
        });
        if (visible.length === 0 && (lowerSearch || statusFilter !== "all")) return null;

        const gId = `group-${groupName}`;
        const isCollapsed = !!collapsed[gId];

        return (
          <div key={groupName}>
            <NavRow
              id={gId}
              label={groupName}
              icon={<IcoFolder size={14} style={{ color: colors.cobalt }} />}
              active={view === gId}
              onClick={() => navigate(gId)}
              depth={0 + depthOffset}
              badge={visible.length}
              hasChildren
              expanded={!isCollapsed}
              onToggle={() => toggleGroup(gId)}
            />
            {!isCollapsed && visible.map((obs) => {
              const status = getStatus(obs);
              const sc = STATUS_COLORS[status];
              const obsId = `obs-${obs.uuid}`;
              return (
                <NavRow
                  key={obs.uuid}
                  id={obsId}
                  label={trunc(obs.title, 38)}
                  icon={<StatusDot status={status} />}
                  active={view === obsId}
                  onClick={() => navigate(obsId)}
                  depth={1 + depthOffset}
                  statusColor={sc?.border}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS DOT — small colored dot for observation status
   ═══════════════════════════════════════════════════════════════════════════ */

function StatusDot({ status }: { status: string }) {
  const sc = STATUS_COLORS[status] ?? { border: colors.gray };
  return (
    <span style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      backgroundColor: sc.border,
      flexShrink: 0,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS BADGE — larger badge for detail views
   ═══════════════════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
  const sc = STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: "3px 12px",
      borderRadius: radii.pill,
      backgroundColor: sc.bg,
      color: sc.fg,
      border: `1px solid ${sc.border}`,
    }}>
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CRITICALITY BADGE
   ═══════════════════════════════════════════════════════════════════════════ */

function CriticalityBadge({ criticality }: { criticality: string }) {
  const cc = CRITICALITY_COLORS[criticality] ?? { bg: colors.bg, fg: colors.gray };
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 10px",
      borderRadius: radii.pill,
      backgroundColor: cc.bg,
      color: cc.fg,
    }}>
      {criticality}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW ROUTER — renders only the selected view
   ═══════════════════════════════════════════════════════════════════════════ */

interface ViewRouterProps {
  view: string;
  ar: AssessmentResults;
  navigate: (id: string) => void;
  allObservations: Observation[];
  allFindings: Finding[];
  allRisks: Risk[];
  obsMap: Record<string, Observation>;
  riskMap: Record<string, Risk>;
  obsNistMap: Record<string, string[]>;
  findingNistMap: Record<string, string[]>;
  riskNistMap: Record<string, string[]>;
  groupedObservations: Record<string, Observation[]>;
  groupNames: string[];
  statusCounts: Record<string, number>;
  findingStateCounts: Record<string, number>;
  riskLevelCounts: Record<string, number>;
  riskStatusCounts: Record<string, number>;
  statusFilter: string;
  catalog: OscalCatalog | null;
}

function ViewRouter({ view, ar, navigate, allObservations, allFindings, allRisks, obsMap, riskMap, obsNistMap, findingNistMap, riskNistMap, groupedObservations, groupNames, statusCounts, findingStateCounts, riskLevelCounts, riskStatusCounts, statusFilter, catalog }: ViewRouterProps) {
  if (view === "overview")
    return <OverviewView ar={ar} navigate={navigate} allObservations={allObservations} allFindings={allFindings} allRisks={allRisks} groupedObservations={groupedObservations} groupNames={groupNames} statusCounts={statusCounts} findingStateCounts={findingStateCounts} riskLevelCounts={riskLevelCounts} riskStatusCounts={riskStatusCounts} />;
  if (view === "metadata")
    return <MetadataView ar={ar} navigate={navigate} />;

  // findings list
  if (view === "findings")
    return <FindingsListView findings={allFindings} navigate={navigate} obsMap={obsMap} riskMap={riskMap} findingNistMap={findingNistMap} />;

  // risks list
  if (view === "risks")
    return <RisksListView risks={allRisks} navigate={navigate} riskLevelCounts={riskLevelCounts} riskStatusCounts={riskStatusCounts} riskNistMap={riskNistMap} />;

  // finding-<uuid>
  if (view.startsWith("finding-")) {
    const uuid = view.slice(8);
    const finding = allFindings.find((f) => f.uuid === uuid);
    if (finding) return <FindingDetailView finding={finding} navigate={navigate} obsMap={obsMap} riskMap={riskMap} findingNistMap={findingNistMap} obsNistMap={obsNistMap} />;
  }

  // risk-<uuid>
  if (view.startsWith("risk-")) {
    const uuid = view.slice(5);
    const risk = allRisks.find((r) => r.uuid === uuid);
    if (risk) return <RiskDetailView risk={risk} navigate={navigate} allFindings={allFindings} riskNistMap={riskNistMap} />;
  }

  // result-N
  const resultMatch = view.match(/^result-(\d+)$/);
  if (resultMatch) {
    const ri = parseInt(resultMatch[1]);
    const result = ar.results[ri];
    if (result) return <ResultView result={result} resultIdx={ri} navigate={navigate} catalog={catalog} />;
  }

  // group-*
  if (view.startsWith("group-")) {
    const groupName = view.replace("group-", "");
    const observations = groupedObservations[groupName];
    if (observations) return <GroupView groupName={groupName} observations={observations} navigate={navigate} statusFilter={statusFilter} catalog={catalog} obsNistMap={obsNistMap} />;
  }

  // obs-<uuid>
  if (view.startsWith("obs-")) {
    const uuid = view.slice(4);
    const obs = allObservations.find((o) => o.uuid === uuid);
    if (obs) return <ObservationView obs={obs} navigate={navigate} catalog={catalog} nistControls={obsNistMap[uuid] ?? []} />;
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

/** Render NIST SP 800-53 control ID chips — prominent navy pills */
function NistChips({ controls }: { controls: string[] }) {
  if (!controls.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {controls.map((id) => (
        <span key={id} style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 10, fontWeight: 700, fontFamily: fonts.mono,
          padding: "2px 7px", borderRadius: radii.pill,
          backgroundColor: alpha(colors.navy, 10), color: colors.navy,
          border: `1px solid ${alpha(colors.navy, 25)}`,
          letterSpacing: 0.3, whiteSpace: "nowrap",
        }}>
          {id}
        </span>
      ))}
    </div>
  );
}

/** Inline row of NIST chips with a tiny label, for use in list/table rows */
function NistChipsInline({ controls }: { controls: string[] }) {
  if (!controls.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
      {controls.map((id) => (
        <span key={id} style={{
          fontSize: 9, fontWeight: 700, fontFamily: fonts.mono,
          padding: "1px 5px", borderRadius: radii.pill,
          backgroundColor: alpha(colors.navy, 8), color: colors.navy,
          border: `1px solid ${alpha(colors.navy, 18)}`,
          whiteSpace: "nowrap",
        }}>
          {id}
        </span>
      ))}
    </div>
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
        <IcoCheck size={48} style={{ color: colors.orange }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>OSCAL Assessment Results Viewer</h2>
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
          Drop an OSCAL <strong>Assessment Results</strong> JSON file here
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
   OVERVIEW VIEW — dashboard with stats and quick navigation
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewView({ ar, navigate, allObservations, allFindings, allRisks, groupedObservations, groupNames, statusCounts, findingStateCounts, riskLevelCounts, riskStatusCounts }: {
  ar: AssessmentResults;
  navigate: (id: string) => void;
  allObservations: Observation[];
  allFindings: Finding[];
  allRisks: Risk[];
  groupedObservations: Record<string, Observation[]>;
  groupNames: string[];
  statusCounts: Record<string, number>;
  findingStateCounts: Record<string, number>;
  riskLevelCounts: Record<string, number>;
  riskStatusCounts: Record<string, number>;
}) {
  const result = ar.results[0];

  return (
    <div>
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoCheck size={22} style={{ color: colors.orange }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>{ar.metadata.title}</h1>
      </div>
      <div style={{ fontSize: 12, color: colors.gray, marginBottom: 20 }}>
        {ar.metadata.version && <span>Version {ar.metadata.version} &middot; </span>}
        OSCAL {ar.metadata["oscal-version"]} &middot; Last modified {fmtDate(ar.metadata["last-modified"])}
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Observations" value={allObservations.length} color={colors.cobalt} />
        <StatCard label="Findings" value={allFindings.length} color={colors.darkGreen} onClick={() => allFindings.length > 0 && navigate("findings")} />
        <StatCard label="Risks" value={allRisks.length} color={colors.red} onClick={() => allRisks.length > 0 && navigate("risks")} />
        {result && <StatCard label="Assessment Period" value={`${fmtDate(result.start)} — ${fmtDate(result.end)}`} color={colors.navy} small />}
      </div>

      {/* Findings Summary */}
      {allFindings.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionLabel>Findings Summary</SectionLabel>
            <span onClick={() => navigate("findings")} style={{ fontSize: 11, color: colors.brightBlue, cursor: "pointer", fontWeight: 600 }}>View All →</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {Object.entries(findingStateCounts).map(([state, count]) => {
              const fc = FINDING_STATE_COLORS[state] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray, label: state };
              return (
                <div
                  key={state}
                  onClick={() => navigate("findings")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                    borderRadius: radii.md, backgroundColor: fc.bg, border: `1px solid ${fc.border}`,
                    minWidth: 140, cursor: "pointer",
                  }}
                >
                  {state === "satisfied"
                    ? <IcoCheckCircle size={18} style={{ color: fc.fg }} />
                    : <IcoXCircle size={18} style={{ color: fc.fg }} />}
                  <span style={{ fontSize: 22, fontWeight: 800, color: fc.fg }}>{count}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: fc.fg }}>{fc.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Risks Summary */}
      {allRisks.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionLabel>Risks by Severity</SectionLabel>
            <span onClick={() => navigate("risks")} style={{ fontSize: 11, color: colors.brightBlue, cursor: "pointer", fontWeight: 600 }}>View All →</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            {["critical", "high", "moderate", "low"].filter((l) => riskLevelCounts[l]).map((level) => {
              const rc = RISK_LEVEL_COLORS[level] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
              return (
                <div
                  key={level}
                  onClick={() => navigate("risks")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                    borderRadius: radii.md, backgroundColor: rc.bg, border: `1px solid ${rc.border}`,
                    minWidth: 120, cursor: "pointer",
                  }}
                >
                  <IcoAlertTriangle size={16} style={{ color: rc.fg }} />
                  <span style={{ fontSize: 22, fontWeight: 800, color: rc.fg }}>{riskLevelCounts[level]}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: rc.fg, textTransform: "capitalize" }}>{level}</span>
                </div>
              );
            })}
          </div>
          {Object.keys(riskStatusCounts).length > 0 && (
            <>
              <SectionLabel>Risks by Status</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(riskStatusCounts).map(([status, count]) => {
                  const sc = RISK_STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
                  return (
                    <span key={status} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: radii.pill, backgroundColor: sc.bg, color: sc.fg, border: `1px solid ${sc.border}` }}>
                      {count} {status}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Observation Status Summary */}
      {allObservations.length > 0 && (
        <Card>
          <SectionLabel>Observation Status Summary</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {Object.entries(statusCounts).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => {
              const sc = STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
              return (
                <div
                  key={status}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                    borderRadius: radii.md, backgroundColor: sc.bg, border: `1px solid ${sc.border}`,
                    minWidth: 120,
                  }}
                >
                  <span style={{ fontSize: 22, fontWeight: 800, color: sc.fg }}>{count}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: sc.fg }}>{status}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Control Groups Quick Nav */}
      {groupNames.length > 0 && (
        <Card>
          <SectionLabel>Control Groups ({groupNames.length})</SectionLabel>
          {groupNames.map((groupName) => {
            const obs = groupedObservations[groupName];
            const statuses: Record<string, number> = {};
            obs.forEach((o) => { const s = getStatus(o); statuses[s] = (statuses[s] ?? 0) + 1; });

            return (
              <div
                key={groupName}
                onClick={() => navigate(`group-${groupName}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                  borderBottom: `1px solid ${colors.bg}`, cursor: "pointer",
                }}
              >
                <IcoFolder size={14} style={{ color: colors.cobalt }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy, flex: 1 }}>{groupName}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {Object.entries(statuses).map(([s, c]) => {
                    const sc = STATUS_COLORS[s] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
                    return (
                      <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: sc.bg, color: sc.fg }}>
                        {c} {s}
                      </span>
                    );
                  })}
                </div>
                <span style={S.badge}>{obs.length}</span>
              </div>
            );
          })}
        </Card>
      )}

      {/* Results list (if multiple) */}
      {ar.results.length > 1 && (
        <Card>
          <SectionLabel>Results ({ar.results.length})</SectionLabel>
          {ar.results.map((result, i) => (
            <div
              key={result.uuid}
              onClick={() => navigate(`result-${i}`)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                borderBottom: `1px solid ${colors.bg}`, cursor: "pointer",
              }}
            >
              <IcoClipboard size={14} style={{ color: colors.cobalt }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{result.title}</div>
                <div style={{ fontSize: 11, color: colors.gray }}>{result.observations?.length ?? 0} observations</div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function StatCard({ label, value, color, small, onClick }: { label: string; value: string | number; color: string; small?: boolean; onClick?: () => void }) {
  return (
    <Card style={{ borderTop: `3px solid ${color}`, padding: "14px 16px", cursor: onClick ? "pointer" : "default" }}>
      <div onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: small ? 13 : 22, fontWeight: 700, color }}>{value}</div>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   METADATA VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function MetadataView({ ar, navigate }: { ar: AssessmentResults; navigate: (id: string) => void }) {
  const meta = ar.metadata;
  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: "metadata", label: "Metadata" }]} navigate={navigate} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <IcoInfo size={22} style={{ color: colors.navy }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>Document Metadata</h1>
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <MField label="Title" value={meta.title} />
          <MField label="Version" value={meta.version ?? "—"} />
          <MField label="Last Modified" value={fmtDate(meta["last-modified"])} />
          <MField label="OSCAL Version" value={meta["oscal-version"] ?? "—"} />
          <MField label="Document UUID" value={ar.uuid} mono />
        </div>
      </Card>

      {/* Import AP */}
      {ar["import-ap"] && (
        <Card>
          <SectionLabel>Assessment Plan Reference</SectionLabel>
          <MField label="Reference" value={ar["import-ap"].href} mono />
          {ar["import-ap"].remarks && <MField label="Remarks" value={ar["import-ap"].remarks} />}
        </Card>
      )}

      {/* Parties */}
      {meta.parties && meta.parties.length > 0 && (
        <Card>
          <SectionLabel>Parties ({meta.parties.length})</SectionLabel>
          {meta.parties.map((p) => (
            <div key={p.uuid} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{p.name}</div>
              <div style={{ fontSize: 11, color: colors.gray }}>
                {p.type}{p["short-name"] ? ` · ${p["short-name"]}` : ""}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Roles */}
      {meta.roles && meta.roles.length > 0 && (
        <Card>
          <SectionLabel>Roles ({meta.roles.length})</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {meta.roles.map((r) => (
              <span key={r.id} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: radii.pill,
                backgroundColor: colors.bg, color: colors.navy, fontWeight: 500,
                border: `1px solid ${colors.paleGray}`,
              }}>
                {r.title} <span style={{ color: colors.gray }}>({r.id})</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Back matter resources */}
      {ar["back-matter"]?.resources && ar["back-matter"].resources.length > 0 && (
        <Card>
          <SectionLabel>Back Matter Resources ({ar["back-matter"].resources.length})</SectionLabel>
          {ar["back-matter"].resources.map((res) => (
            <div key={res.uuid} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{res.title ?? "Untitled"}</div>
              <div style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{res.uuid}</div>
              {res.remarks && <div style={{ fontSize: 12, color: colors.black, marginTop: 4 }}>{res.remarks}</div>}
              {res.rlinks && res.rlinks.map((rl, i) => (
                <a key={i} href={rl.href} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: colors.brightBlue, display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <IcoExternalLink size={10} /> {rl.href}
                </a>
              ))}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESULT VIEW — for when there are multiple results
   ═══════════════════════════════════════════════════════════════════════════ */

function ResultView({ result, resultIdx, navigate, catalog }: {
  result: Result; resultIdx: number; navigate: (id: string) => void; catalog: OscalCatalog | null;
}) {
  const observations = result.observations ?? [];
  const statusCounts: Record<string, number> = {};
  observations.forEach((o) => { const s = getStatus(o); statusCounts[s] = (statusCounts[s] ?? 0) + 1; });

  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: `result-${resultIdx}`, label: result.title }]} navigate={navigate} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoClipboard size={22} style={{ color: colors.cobalt }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>{result.title}</h1>
      </div>
      <div style={{ fontSize: 12, color: colors.gray, marginBottom: 16, fontFamily: fonts.mono }}>
        {result.uuid}
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <MField label="Description" value={result.description} />
          <MField label="Start" value={fmtDateTime(result.start)} />
          {result.end && <MField label="End" value={fmtDateTime(result.end)} />}
          <MField label="Observations" value={String(observations.length)} />
        </div>
      </Card>

      {/* Status Summary */}
      <Card>
        <SectionLabel>Status Summary</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <StatusBadge status={status} />
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.black }}>{count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Observations list */}
      <Card>
        <SectionLabel>Observations ({observations.length})</SectionLabel>
        <ObservationTable observations={observations} navigate={navigate} catalog={catalog} />
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUP VIEW — control group with observations
   ═══════════════════════════════════════════════════════════════════════════ */

function GroupView({ groupName, observations, navigate, statusFilter, catalog, obsNistMap }: {
  groupName: string; observations: Observation[]; navigate: (id: string) => void; statusFilter: string; catalog: OscalCatalog | null; obsNistMap: Record<string, string[]>;
}) {
  const visible = statusFilter === "all" ? observations : observations.filter((o) => getStatus(o) === statusFilter);
  const statusCounts: Record<string, number> = {};
  observations.forEach((o) => { const s = getStatus(o); statusCounts[s] = (statusCounts[s] ?? 0) + 1; });

  // Aggregate NIST controls across all observations in this group
  const groupNist = useMemo(() => {
    const ids = new Set<string>();
    observations.forEach((o) => (obsNistMap[o.uuid] ?? []).forEach((id) => ids.add(id)));
    return [...ids].sort();
  }, [observations, obsNistMap]);

  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: `group-${groupName}`, label: groupName }]} navigate={navigate} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoFolder size={22} style={{ color: colors.cobalt }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>{groupName}</h1>
      </div>
      <div style={{ fontSize: 12, color: colors.gray, marginBottom: 16 }}>
        {observations.length} observation{observations.length !== 1 ? "s" : ""} in this control group
      </div>

      {/* NIST Controls for this group */}
      {groupNist.length > 0 && (
        <Card>
          <SectionLabel>NIST SP 800-53 Controls ({groupNist.length})</SectionLabel>
          <NistChips controls={groupNist} />
        </Card>
      )}

      {/* Status Summary */}
      <Card>
        <SectionLabel>Status Breakdown</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <StatusBadge status={status} />
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.black }}>{count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Observations table */}
      <Card>
        <SectionLabel>Observations ({visible.length}{statusFilter !== "all" ? ` — filtered by ${statusFilter}` : ""})</SectionLabel>
        <ObservationTable observations={visible} navigate={navigate} catalog={catalog} obsNistMap={obsNistMap} />
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OBSERVATION TABLE — list of observations with status, criticality, nav
   ═══════════════════════════════════════════════════════════════════════════ */

function ObservationTable({ observations, navigate, obsNistMap }: {
  observations: Observation[]; navigate: (id: string) => void; catalog: OscalCatalog | null; obsNistMap?: Record<string, string[]>;
}) {
  if (observations.length === 0) {
    return <div style={{ fontSize: 13, color: colors.gray, fontStyle: "italic" }}>No observations found.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 2fr) 90px 120px minmax(120px, 1fr)",
        gap: 8,
        padding: "8px 0",
        borderBottom: `2px solid ${colors.paleGray}`,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        color: colors.gray,
      }}>
        <span>Observation</span>
        <span>Status</span>
        <span>Criticality</span>
        <span>NIST Controls</span>
      </div>

      {/* Rows */}
      {observations.map((obs) => {
        const status = getStatus(obs);
        const criticality = getCriticality(obs);
        const sc = STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
        const nist = obsNistMap?.[obs.uuid] ?? extractNistControls(obs.remarks);

        return (
          <div
            key={obs.uuid}
            onClick={() => navigate(`obs-${obs.uuid}`)}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px, 2fr) 90px 120px minmax(120px, 1fr)",
              gap: 8,
              padding: "10px 0",
              borderBottom: `1px solid ${colors.bg}`,
              cursor: "pointer",
              alignItems: "center",
              transition: "background-color .1s",
              borderLeft: `3px solid ${sc.border}`,
              paddingLeft: 8,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy, marginBottom: 2 }}>
                {obs.title}
              </div>
              <div style={{ fontSize: 11, color: colors.gray }}>{getControlGroup(obs)}</div>
            </div>
            <StatusBadge status={status} />
            <CriticalityBadge criticality={criticality} />
            <NistChipsInline controls={nist} />
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OBSERVATION VIEW — full detail view for a single observation
   ═══════════════════════════════════════════════════════════════════════════ */

function ObservationView({ obs, navigate, catalog, nistControls }: {
  obs: Observation; navigate: (id: string) => void; catalog: OscalCatalog | null; nistControls: string[];
}) {
  const status = getStatus(obs);
  const criticality = getCriticality(obs);
  const controlGroup = getControlGroup(obs);
  const baselineRef = getBaselineRef(obs);
  const sc = STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };

  return (
    <div>
      <Breadcrumbs items={[
        { id: "overview", label: "Overview" },
        { id: `group-${controlGroup}`, label: controlGroup },
        { id: `obs-${obs.uuid}`, label: trunc(obs.title, 50) },
      ]} navigate={navigate} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <IcoShield size={22} style={{ color: sc.border }} />
        <h1 style={{ fontSize: 18, color: colors.navy, margin: 0, lineHeight: 1.4 }}>{obs.title}</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <StatusBadge status={status} />
        <CriticalityBadge criticality={criticality} />
        <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{obs.uuid}</span>
      </div>

      {/* NIST Controls */}
      {nistControls.length > 0 && (
        <Card style={{ borderLeft: `4px solid ${colors.navy}` }}>
          <SectionLabel>NIST SP 800-53 Controls</SectionLabel>
          <NistChips controls={nistControls} />
        </Card>
      )}

      {/* Description */}
      <Card style={{ borderLeft: `4px solid ${sc.border}` }}>
        <SectionLabel>Description</SectionLabel>
        <div
          style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}
          dangerouslySetInnerHTML={{ __html: obs.description }}
        />
      </Card>

      {/* Details */}
      <Card>
        <SectionLabel>Details</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <MField label="Control Group" value={controlGroup} />
          <MField label="Collected" value={fmtDateTime(obs.collected)} />
          <MField label="Methods" value={obs.methods.join(", ")} />
          {obs.types && <MField label="Types" value={obs.types.join(", ")} />}
        </div>
      </Card>

      {/* Properties */}
      {obs.props && obs.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {obs.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} />)}
          </div>
        </Card>
      )}

      {/* Baseline Reference */}
      {baselineRef && (
        <Card>
          <SectionLabel>Baseline Reference</SectionLabel>
          <a
            href={baselineRef}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: colors.brightBlue, textDecoration: "none" }}
          >
            <IcoExternalLink size={13} />
            {baselineRef}
          </a>
        </Card>
      )}

      {/* Catalog Control Context */}
      <CatalogContextCard catalog={catalog} />

      {/* Links */}
      {obs.links && obs.links.length > 0 && (() => {
        const chips: ResolvedLink[] = obs.links.map((lk) => {
          const frag = lk["resource-fragment"];
          const baseText = lk.text ?? lk.href;
          const text = frag ? `${baseText} \u2014 ${frag}` : baseText;
          const baseHref = lk.href.startsWith("#") ? undefined : lk.href;
          const href = baseHref && frag ? `${baseHref}#${frag}` : baseHref;
          return { text, href, rel: lk.rel };
        });
        return (
          <Card>
            <LinkChips links={chips} />
          </Card>
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG CONTEXT CARD — shows control info from loaded catalog
   Links the observation to the corresponding catalog control
   Renders parameters appropriately (selections, assignments)
   ═══════════════════════════════════════════════════════════════════════════ */

function CatalogContextCard({ catalog }: { catalog: OscalCatalog | null }) {
  if (!catalog) {
    return (
      <Card style={{ borderLeft: `4px solid ${colors.paleGray}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IcoAlert size={16} style={{ color: colors.gray }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.gray }}>Catalog Not Loaded</div>
            <div style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>
              Upload an OSCAL Catalog to see related control context, statements, guidance, and parameter details.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ borderLeft: `4px solid ${alpha(colors.cobalt, 13)}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IcoBook size={16} style={{ color: colors.cobalt }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.cobalt }}>Catalog Loaded</div>
          <div style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>
            The loaded catalog ({catalog.metadata.title}) is available for cross-referencing.
            ScubaGear policy IDs (e.g., MS.AAD.x.y) use a vendor-specific naming convention that does not directly map to NIST SP 800-53 control IDs.
            When assessed controls reference standard control IDs, they will be linked automatically.
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG PART TREE — recursive hierarchical rendering
   ═══════════════════════════════════════════════════════════════════════════ */

// @ts-ignore: reserved for future catalog enrichment
function CatalogPartTree({ part, depth, paramMap }: { part: CatalogPart; depth: number; paramMap: Record<string, CatalogParam> }) {
  const subParts = part.parts ?? [];
  const partLabel = getCatalogLabel(part.props as { name: string; value: string; class?: string }[] | undefined);
  const depthColors = [colors.navy, colors.brightBlue, colors.cobalt, colors.gray, colors.blueGray];
  const borderColor = depthColors[depth % depthColors.length];

  return (
    <div style={{
      marginTop: depth === 0 ? 0 : 8,
      paddingLeft: depth > 0 ? 16 : 0,
      borderLeft: depth > 0 ? `3px solid ${borderColor}` : "none",
    }}>
      {partLabel && (
        <span style={{ fontSize: 12, fontWeight: 700, color: borderColor, fontFamily: fonts.mono, marginRight: 6 }}>
          {partLabel}
        </span>
      )}
      {part.prose && (
        <CatalogProseWithParams text={part.prose} paramMap={paramMap} />
      )}
      {subParts.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {subParts.map((sp, i) => (
            <CatalogPartTree key={sp.id ?? i} part={sp} depth={depth + 1} paramMap={paramMap} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG PROSE WITH PARAMS — renders prose with inline param pills
   ═══════════════════════════════════════════════════════════════════════════ */

function CatalogProseWithParams({ text, paramMap }: { text: string; paramMap: Record<string, CatalogParam> }) {
  const parts = text.split(/(\{\{\s*insert:\s*param\s*,\s*[^}]+?\s*\}\})/g);

  return (
    <span style={{ fontSize: 13, lineHeight: 1.75, color: colors.black }}>
      {parts.map((segment, i) => {
        const match = segment.match(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/);
        if (match) {
          const paramId = match[1].trim();
          const param = paramMap[paramId];
          const rendered = param ? renderCatalogParamText(param, paramMap) : `[Assignment: ${paramId}]`;
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
   COLLAPSIBLE SECTION
   ═══════════════════════════════════════════════════════════════════════════ */

// @ts-ignore: reserved for future use
function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, color: colors.brightBlue }}
      >
        <IcoChev open={open} style={{ color: colors.brightBlue }} />
        {title}
      </div>
      {open && <div style={{ marginTop: 6, paddingLeft: 8 }}>{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER — get all controls flat from a catalog
   ═══════════════════════════════════════════════════════════════════════════ */

// @ts-ignore: reserved for future catalog enrichment
function getAllCatalogControls(catalog: OscalCatalog): CatalogControl[] {
  const result: CatalogControl[] = [];
  function walkGroup(g: CatalogGroup) {
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

/* ═══════════════════════════════════════════════════════════════════════════
   FINDINGS LIST VIEW — tabular list of all findings with state
   ═══════════════════════════════════════════════════════════════════════════ */

function FindingsListView({ findings, navigate, findingNistMap }: {
  findings: Finding[];
  navigate: (id: string) => void;
  obsMap: Record<string, Observation>;
  riskMap: Record<string, Risk>;
  findingNistMap: Record<string, string[]>;
}) {
  const sorted = useMemo(() => {
    return [...findings].sort((a, b) => {
      // Not-satisfied first, then by target-id
      if (a.target.status.state !== b.target.status.state) {
        return a.target.status.state === "not-satisfied" ? -1 : 1;
      }
      return a.target["target-id"].localeCompare(b.target["target-id"]);
    });
  }, [findings]);

  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: "findings", label: "Findings" }]} navigate={navigate} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoTarget size={22} style={{ color: colors.darkGreen }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>Findings ({findings.length})</h1>
      </div>
      <div style={{ fontSize: 12, color: colors.gray, marginBottom: 16 }}>
        Findings represent the judgement — whether each assessed control target is satisfied or not.
      </div>

      {/* Summary */}
      <Card>
        <SectionLabel>State Summary</SectionLabel>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(FINDING_STATE_COLORS).map(([state, fc]) => {
            const count = sorted.filter((f) => f.target.status.state === state).length;
            if (!count) return null;
            return (
              <div key={state} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: radii.md, backgroundColor: fc.bg, border: `1px solid ${fc.border}` }}>
                {state === "satisfied" ? <IcoCheckCircle size={16} style={{ color: fc.fg }} /> : <IcoXCircle size={16} style={{ color: fc.fg }} />}
                <span style={{ fontSize: 20, fontWeight: 800, color: fc.fg }}>{count}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: fc.fg }}>{fc.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Findings table */}
      <Card>
        <div style={{ overflowX: "auto" }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(140px, 1fr) 120px minmax(180px, 2fr) minmax(100px, 1fr) 90px 80px",
            gap: 8,
            padding: "8px 0",
            borderBottom: `2px solid ${colors.paleGray}`,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            color: colors.gray,
          }}>
            <span>Control Target</span>
            <span>State</span>
            <span>Title / Description</span>
            <span>NIST Controls</span>
            <span>Observations</span>
            <span>Risks</span>
          </div>

          {/* Rows */}
          {sorted.map((f) => {
            const state = f.target.status.state;
            const fc = FINDING_STATE_COLORS[state] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray, label: state };
            const relObs = f["related-observations"] ?? [];
            const assocRisks = f["associated-risks"] ?? [];

            return (
              <div
                key={f.uuid}
                onClick={() => navigate(`finding-${f.uuid}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(140px, 1fr) 120px minmax(180px, 2fr) minmax(100px, 1fr) 90px 80px",
                  gap: 8,
                  padding: "10px 0",
                  borderBottom: `1px solid ${colors.bg}`,
                  cursor: "pointer",
                  alignItems: "center",
                  borderLeft: `3px solid ${fc.border}`,
                  paddingLeft: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono, color: colors.navy }}>
                  {f.target["target-id"].toUpperCase()}
                </span>
                <FindingStateBadge state={state} />
                <div>
                  {f.title && <div style={{ fontSize: 12, fontWeight: 600, color: colors.black }}>{f.title}</div>}
                  {f.description && <div style={{ fontSize: 11, color: colors.gray }}>{trunc(f.description, 80)}</div>}
                  {!f.title && !f.description && f.remarks && <div style={{ fontSize: 11, color: colors.gray }}>{trunc(f.remarks, 80)}</div>}
                </div>
                <NistChipsInline controls={findingNistMap?.[f.uuid] ?? []} />
                <span style={{ fontSize: 12, color: colors.cobalt, fontWeight: 600 }}>
                  {relObs.length > 0 ? relObs.length : "—"}
                </span>
                <span style={{ fontSize: 12, color: assocRisks.length > 0 ? colors.red : colors.gray, fontWeight: 600 }}>
                  {assocRisks.length > 0 ? assocRisks.length : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FINDING STATE BADGE
   ═══════════════════════════════════════════════════════════════════════════ */

function FindingStateBadge({ state }: { state: string }) {
  const fc = FINDING_STATE_COLORS[state] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray, label: state };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: radii.pill,
      backgroundColor: fc.bg, color: fc.fg, border: `1px solid ${fc.border}`,
    }}>
      {state === "satisfied"
        ? <IcoCheckCircle size={11} style={{ color: fc.fg }} />
        : <IcoXCircle size={11} style={{ color: fc.fg }} />}
      {fc.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RISK LEVEL BADGE
   ═══════════════════════════════════════════════════════════════════════════ */

function RiskLevelBadge({ level }: { level: string }) {
  const rc = RISK_LEVEL_COLORS[level] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: radii.pill,
      backgroundColor: rc.bg, color: rc.fg, border: `1px solid ${rc.border}`,
      textTransform: "capitalize",
    }}>
      <IcoAlertTriangle size={11} style={{ color: rc.fg }} />
      {level}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RISK STATUS BADGE
   ═══════════════════════════════════════════════════════════════════════════ */

function RiskStatusBadge({ status }: { status: string }) {
  const sc = RISK_STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: radii.pill,
      backgroundColor: sc.bg, color: sc.fg, border: `1px solid ${sc.border}`,
      textTransform: "capitalize",
    }}>
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FINDING DETAIL VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function FindingDetailView({ finding, navigate, obsMap, riskMap, findingNistMap, obsNistMap }: {
  finding: Finding;
  navigate: (id: string) => void;
  obsMap: Record<string, Observation>;
  riskMap: Record<string, Risk>;
  findingNistMap: Record<string, string[]>;
  obsNistMap: Record<string, string[]>;
}) {
  const state = finding.target.status.state;
  const fc = FINDING_STATE_COLORS[state] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray, label: state };
  const relObs = (finding["related-observations"] ?? []).map((ro) => obsMap[ro["observation-uuid"]]).filter(Boolean);
  const assocRisks = (finding["associated-risks"] ?? []).map((ar) => riskMap[ar["risk-uuid"]]).filter(Boolean);

  return (
    <div>
      <Breadcrumbs items={[
        { id: "overview", label: "Overview" },
        { id: "findings", label: "Findings" },
        { id: `finding-${finding.uuid}`, label: finding.target["target-id"].toUpperCase() },
      ]} navigate={navigate} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <IcoTarget size={22} style={{ color: fc.fg }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>
          {finding.target["target-id"].toUpperCase()}
        </h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <FindingStateBadge state={state} />
        {finding.target["implementation-status"] && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: radii.pill, backgroundColor: colors.bg, color: colors.gray }}>
            impl: {finding.target["implementation-status"].state}
          </span>
        )}
        <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{finding.uuid}</span>
      </div>

      {/* NIST Controls */}
      {(findingNistMap?.[finding.uuid] ?? []).length > 0 && (
        <Card style={{ borderLeft: `4px solid ${colors.navy}` }}>
          <SectionLabel>NIST SP 800-53 Controls</SectionLabel>
          <NistChips controls={findingNistMap[finding.uuid]} />
        </Card>
      )}

      {/* Title + Description */}
      {(finding.title || finding.description) && (
        <Card style={{ borderLeft: `4px solid ${fc.border}` }}>
          {finding.title && <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy, marginBottom: 6 }}>{finding.title}</div>}
          {finding.description && <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{finding.description}</div>}
        </Card>
      )}

      {/* Reason */}
      {finding.target.status.reason && (
        <Card>
          <SectionLabel>Reason</SectionLabel>
          <div style={{ fontSize: 13, color: colors.black }}>{finding.target.status.reason}</div>
        </Card>
      )}

      {/* Remarks */}
      {finding.remarks && (
        <Card>
          <SectionLabel>Remarks</SectionLabel>
          <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{finding.remarks}</div>
        </Card>
      )}

      {/* Target Properties */}
      {finding.target.props && finding.target.props.length > 0 && (
        <Card>
          <SectionLabel>Target Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {finding.target.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} />)}
          </div>
        </Card>
      )}

      {/* Related Observations */}
      {relObs.length > 0 && (
        <Card>
          <SectionLabel>Related Observations ({relObs.length})</SectionLabel>
          <div style={{ fontSize: 12, color: colors.gray, marginBottom: 10 }}>
            These observations provide the evidence for this finding.
          </div>
          {relObs.map((obs) => {
            const obsStatus = getStatus(obs);
            const sc = STATUS_COLORS[obsStatus] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
            return (
              <div
                key={obs.uuid}
                onClick={() => navigate(`obs-${obs.uuid}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  marginBottom: 6, borderRadius: radii.sm, backgroundColor: colors.bg,
                  cursor: "pointer", borderLeft: `3px solid ${sc.border}`,
                }}
              >
                <IcoEye size={14} style={{ color: colors.cobalt }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{obs.title}</div>
                  {obs.remarks && <div style={{ fontSize: 11, color: colors.gray, marginTop: 2 }}>{trunc(obs.remarks, 120)}</div>}
                </div>
                <NistChipsInline controls={obsNistMap?.[obs.uuid] ?? []} />
                <StatusBadge status={obsStatus} />
              </div>
            );
          })}
        </Card>
      )}

      {/* Associated Risks */}
      {assocRisks.length > 0 && (
        <Card style={{ borderLeft: `4px solid ${colors.red}` }}>
          <SectionLabel>Associated Risks ({assocRisks.length})</SectionLabel>
          <div style={{ fontSize: 12, color: colors.gray, marginBottom: 10 }}>
            These risks express concerns resulting from this finding.
          </div>
          {assocRisks.map((risk) => {
            const level = getRiskLevel(risk);
            const rc = RISK_LEVEL_COLORS[level] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
            return (
              <div
                key={risk.uuid}
                onClick={() => navigate(`risk-${risk.uuid}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  marginBottom: 6, borderRadius: radii.sm, backgroundColor: rc.bg,
                  cursor: "pointer", border: `1px solid ${rc.border}`,
                }}
              >
                <IcoAlertTriangle size={14} style={{ color: rc.fg }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{risk.title}</div>
                  <div style={{ fontSize: 11, color: colors.gray, marginTop: 2 }}>{trunc(risk.description, 120)}</div>
                </div>
                <RiskLevelBadge level={level} />
                <RiskStatusBadge status={risk.status} />
              </div>
            );
          })}
        </Card>
      )}

      {/* Links */}
      {finding.links && finding.links.length > 0 && (() => {
        const chips: ResolvedLink[] = finding.links.map((lk) => ({
          text: lk.text ?? lk.href, href: lk.href.startsWith("#") ? undefined : lk.href, rel: lk.rel,
        }));
        return <Card><LinkChips links={chips} /></Card>;
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RISKS LIST VIEW — tabular list of all risks sorted by severity
   ═══════════════════════════════════════════════════════════════════════════ */

function RisksListView({ risks, navigate, riskLevelCounts, riskStatusCounts, riskNistMap }: {
  risks: Risk[];
  navigate: (id: string) => void;
  riskLevelCounts: Record<string, number>;
  riskStatusCounts: Record<string, number>;
  riskNistMap: Record<string, string[]>;
}) {
  const sorted = useMemo(() => {
    return [...risks].sort((a, b) => riskSeveritySortKey(a) - riskSeveritySortKey(b));
  }, [risks]);

  return (
    <div>
      <Breadcrumbs items={[{ id: "overview", label: "Overview" }, { id: "risks", label: "Risks" }]} navigate={navigate} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoAlertTriangle size={22} style={{ color: colors.red }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>Risks ({risks.length})</h1>
      </div>
      <div style={{ fontSize: 12, color: colors.gray, marginBottom: 16 }}>
        Risks express concerns about failed findings. They include severity characterizations and recommended remediations.
      </div>

      {/* Severity Summary */}
      <Card>
        <SectionLabel>Severity Summary</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          {["critical", "high", "moderate", "low"].filter((l) => riskLevelCounts[l]).map((level) => {
            const rc = RISK_LEVEL_COLORS[level];
            return (
              <div key={level} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                borderRadius: radii.md, backgroundColor: rc.bg, border: `1px solid ${rc.border}`,
              }}>
                <IcoAlertTriangle size={14} style={{ color: rc.fg }} />
                <span style={{ fontSize: 20, fontWeight: 800, color: rc.fg }}>{riskLevelCounts[level]}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: rc.fg, textTransform: "capitalize" }}>{level}</span>
              </div>
            );
          })}
        </div>
        <SectionLabel>Status Summary</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(riskStatusCounts).map(([status, count]) => {
            const sc = RISK_STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
            return (
              <span key={status} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: radii.pill, backgroundColor: sc.bg, color: sc.fg, border: `1px solid ${sc.border}` }}>
                {count} {status}
              </span>
            );
          })}
        </div>
      </Card>

      {/* Risks table */}
      <Card>
        {sorted.map((risk) => {
          const level = getRiskLevel(risk);
          const rc = RISK_LEVEL_COLORS[level] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
          const remCount = risk.remediations?.length ?? 0;

          return (
            <div
              key={risk.uuid}
              onClick={() => navigate(`risk-${risk.uuid}`)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 12px",
                marginBottom: 8, borderRadius: radii.md, backgroundColor: colors.white,
                cursor: "pointer", borderLeft: `4px solid ${rc.border}`,
                boxShadow: shadows.sm, transition: "box-shadow .15s",
              }}
            >
              <IcoAlertTriangle size={18} style={{ color: rc.fg, flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy, marginBottom: 4 }}>{risk.title}</div>
                <div style={{ fontSize: 12, color: colors.gray, lineHeight: 1.6, marginBottom: 8 }}>{trunc(risk.description, 180)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <RiskLevelBadge level={level} />
                  <RiskStatusBadge status={risk.status} />
                  {risk.deadline && (
                    <span style={{ fontSize: 11, color: colors.gray }}>
                      Deadline: {fmtDate(risk.deadline)}
                    </span>
                  )}
                  {remCount > 0 && (
                    <span style={{ fontSize: 11, color: colors.darkGreen, fontWeight: 600 }}>
                      {remCount} remediation{remCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {(riskNistMap?.[risk.uuid] ?? []).length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <NistChipsInline controls={riskNistMap[risk.uuid]} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RISK DETAIL VIEW — full detail for a single risk
   ═══════════════════════════════════════════════════════════════════════════ */

function RiskDetailView({ risk, navigate, allFindings, riskNistMap }: {
  risk: Risk;
  navigate: (id: string) => void;
  allFindings: Finding[];
  riskNistMap: Record<string, string[]>;
}) {
  const level = getRiskLevel(risk);
  const rc = RISK_LEVEL_COLORS[level] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
  const facets = getRiskFacets(risk);
  const mitigating = risk["mitigating-factors"] ?? [];
  const remediations = risk.remediations ?? [];

  // Find findings that reference this risk
  const relatedFindings = allFindings.filter((f) =>
    (f["associated-risks"] ?? []).some((ar) => ar["risk-uuid"] === risk.uuid)
  );

  return (
    <div>
      <Breadcrumbs items={[
        { id: "overview", label: "Overview" },
        { id: "risks", label: "Risks" },
        { id: `risk-${risk.uuid}`, label: trunc(risk.title, 40) },
      ]} navigate={navigate} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <IcoAlertTriangle size={22} style={{ color: rc.fg }} />
        <h1 style={{ fontSize: 18, color: colors.navy, margin: 0, lineHeight: 1.4 }}>{risk.title}</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <RiskLevelBadge level={level} />
        <RiskStatusBadge status={risk.status} />
        {risk.deadline && (
          <span style={{ fontSize: 11, fontWeight: 600, color: colors.gray }}>
            Deadline: {fmtDate(risk.deadline)}
          </span>
        )}
        <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{risk.uuid}</span>
      </div>

      {/* NIST Controls */}
      {(riskNistMap?.[risk.uuid] ?? []).length > 0 && (
        <Card style={{ borderLeft: `4px solid ${colors.navy}` }}>
          <SectionLabel>NIST SP 800-53 Controls</SectionLabel>
          <NistChips controls={riskNistMap[risk.uuid]} />
        </Card>
      )}

      {/* Description */}
      <Card style={{ borderLeft: `4px solid ${rc.border}` }}>
        <SectionLabel>Risk Description</SectionLabel>
        <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{risk.description}</div>
      </Card>

      {/* Statement */}
      {risk.statement && (
        <Card>
          <SectionLabel>Risk Statement</SectionLabel>
          <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{risk.statement}</div>
        </Card>
      )}

      {/* Characterization Facets */}
      {facets.length > 0 && (
        <Card>
          <SectionLabel>Characterization</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {facets.map((f, i) => {
              const fLevel = f.value.toLowerCase();
              const frc = RISK_LEVEL_COLORS[fLevel];
              // Show only the meaningful tail of the system URI (e.g. "assessment/risk-system")
              const systemShort = f.system
                ? f.system.replace(/^https?:\/\/[^/]+\/(?:ns\/oscal\/)?/, "")
                : "";
              return (
                <div key={i} style={{
                  padding: "10px 14px", borderRadius: radii.sm,
                  backgroundColor: frc ? alpha(frc.fg, 6) : colors.bg,
                  borderLeft: `4px solid ${frc?.fg ?? colors.paleGray}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: colors.gray, marginBottom: 4 }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: frc?.fg ?? colors.black, textTransform: "capitalize" }}>
                    {f.value}
                  </div>
                  {systemShort && (
                    <div style={{ fontSize: 9, color: alpha(colors.gray, 60), fontFamily: fonts.mono, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={f.system}
                    >
                      {systemShort}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Related Findings */}
      {relatedFindings.length > 0 && (
        <Card>
          <SectionLabel>Related Findings ({relatedFindings.length})</SectionLabel>
          <div style={{ fontSize: 12, color: colors.gray, marginBottom: 10 }}>
            These findings resulted in this risk being logged.
          </div>
          {relatedFindings.map((f) => {
            const fState = f.target.status.state;
            const ffc = FINDING_STATE_COLORS[fState] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
            return (
              <div
                key={f.uuid}
                onClick={() => navigate(`finding-${f.uuid}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  marginBottom: 6, borderRadius: radii.sm, backgroundColor: colors.bg,
                  cursor: "pointer", borderLeft: `3px solid ${ffc.border}`,
                }}
              >
                <IcoTarget size={14} style={{ color: ffc.fg }} />
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono, color: colors.navy }}>
                  {f.target["target-id"].toUpperCase()}
                </span>
                <FindingStateBadge state={fState} />
                {f.title && <span style={{ fontSize: 12, color: colors.gray }}>{f.title}</span>}
              </div>
            );
          })}
        </Card>
      )}

      {/* Mitigating Factors */}
      {mitigating.length > 0 && (
        <Card>
          <SectionLabel>Mitigating Factors ({mitigating.length})</SectionLabel>
          {mitigating.map((mf, i) => (
            <div key={mf.uuid ?? i} style={{
              padding: "10px 14px", marginBottom: 6, borderRadius: radii.sm,
              backgroundColor: alpha(colors.darkGreen, 5), borderLeft: `3px solid ${colors.darkGreen}`,
            }}>
              <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.6 }}>{mf.description}</div>
              {mf["implementation-uuid"] && (
                <div style={{ fontSize: 10, color: colors.gray, fontFamily: fonts.mono, marginTop: 4 }}>
                  Implementation: {mf["implementation-uuid"]}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Remediations */}
      {remediations.length > 0 && (
        <Card>
          <SectionLabel>Remediations ({remediations.length})</SectionLabel>
          {remediations.map((rem) => {
            const lcColors: Record<string, string> = {
              recommendation: colors.cobalt,
              planned: colors.orange,
              completed: colors.statusPassFg,
            };
            const lcColor = lcColors[rem.lifecycle] ?? colors.gray;

            return (
              <div key={rem.uuid} style={{
                padding: "14px 16px", marginBottom: 8, borderRadius: radii.md,
                backgroundColor: colors.white, boxShadow: shadows.sm,
                borderLeft: `4px solid ${lcColor}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <IcoTool size={14} style={{ color: lcColor }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: colors.navy }}>{rem.title}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: radii.pill,
                    backgroundColor: alpha(lcColor, 10), color: lcColor, textTransform: "capitalize",
                  }}>
                    {rem.lifecycle}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.7, marginBottom: 8 }}>{rem.description}</div>

                {/* Tasks */}
                {rem.tasks && rem.tasks.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: colors.gray, marginBottom: 6 }}>
                      Tasks ({rem.tasks.length})
                    </div>
                    {rem.tasks.map((task) => (
                      <div key={task.uuid} style={{
                        padding: "8px 12px", marginBottom: 4, borderRadius: radii.sm,
                        backgroundColor: colors.bg, borderLeft: `2px solid ${colors.paleGray}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: colors.navy }}>{task.title}</div>
                        <div style={{ fontSize: 11, color: colors.gray, marginTop: 2 }}>{task.description}</div>
                        {task.timing?.["within-date-range"] && (
                          <div style={{ fontSize: 10, color: colors.gray, marginTop: 4 }}>
                            {fmtDate(task.timing["within-date-range"].start)} — {fmtDate(task.timing["within-date-range"].end)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Props */}
                {rem.props && rem.props.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", marginTop: 8 }}>
                    {rem.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} />)}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Properties */}
      {risk.props && risk.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {risk.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} />)}
          </div>
        </Card>
      )}

      {/* Links */}
      {risk.links && risk.links.length > 0 && (() => {
        const chips: ResolvedLink[] = risk.links.map((lk) => ({
          text: lk.text ?? lk.href, href: lk.href.startsWith("#") ? undefined : lk.href, rel: lk.rel,
        }));
        return <Card><LinkChips links={chips} /></Card>;
      })()}
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
      <button onClick={() => navigate("overview")}
        style={{ marginTop: 12, padding: "8px 20px", backgroundColor: colors.navy, color: colors.white, borderRadius: radii.sm, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
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
