/* ═══════════════════════════════════════════════════════════════════════════
   Assessment Plan Page — SPA-style viewer
   Left sidebar nav · Right content panel · Activity & Task views
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
import type {
  Catalog as OscalCatalog,
  Control as CatalogControl,
  Group as CatalogGroup,
  Part as CatalogPart,
  Param as CatalogParam,
  OscalProp as CatalogOscalProp,
} from "../context/OscalContext";
import { useSearchParams } from "react-router-dom";
import { useUrlDocument, fileNameFromUrl } from "../hooks/useUrlDocument";
import { useAuth } from "../context/AuthContext";
import { useChainResolver, AP_CHAIN } from "../hooks/useChainResolver";
import type { BackMatterResource } from "../hooks/useImportResolver";
import ResolverModal from "../components/ResolverModal";
import LinkChips from "../components/LinkChips";
import useIsMobile from "../hooks/useIsMobile";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface OscalProp { name: string; value: string; class?: string; ns?: string }
interface OscalLink { href: string; rel?: string; text?: string; "media-type"?: string }

interface StepParsed {
  uuid: string;
  title: string;
  description: string;
  remarks: string;
  controls: string[];
  method: string;
  links: OscalLink[];
}

interface ActivityParsed {
  uuid: string;
  title: string;
  description: string;
  relatedControls: string[];
  steps: StepParsed[];
}

interface TaskParsed {
  uuid: string;
  title: string;
  type: string;
  description: string;
  timing: string;
  associatedActivities: ActivityParsed[];
}

interface PlanParsed {
  title: string;
  version: string;
  oscalVersion: string;
  lastModified: string;
  published: string;
  parties: string[];
  activities: ActivityParsed[];
  tasks: TaskParsed[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   PARSER
   ═══════════════════════════════════════════════════════════════════════════ */

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
    return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return s; }
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}

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
    <div
      className="oscal-markup"
      style={{ fontSize: 12.5, color: colors.black, lineHeight: 1.5, ...style }}
      dangerouslySetInnerHTML={{ __html: renderMarkup(raw) }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OSCAL control-selection extraction — handles both `with-ids` (string[])
   and `include-controls` (array of {control-id}) per the OSCAL schema.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractControlIds(sel: any): string[] {
  const ids: string[] = [];
  // with-ids: string[] (older / alternate form)
  for (const c of sel["with-ids"] ?? []) {
    ids.push(typeof c === "string" ? c : String(c));
  }
  // include-controls: [{control-id: "..."}] (standard OSCAL)
  for (const ic of sel["include-controls"] ?? []) {
    if (typeof ic === "string") ids.push(ic);
    else if (ic["control-id"]) ids.push(ic["control-id"]);
  }
  return ids;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG CONTROL LOOKUP — find a control in a loaded catalog
   ═══════════════════════════════════════════════════════════════════════════ */

function findCatalogControl(catalog: OscalCatalog, id: string): CatalogControl | undefined {
  function searchGroup(g: CatalogGroup): CatalogControl | undefined {
    for (const c of g.controls ?? []) {
      if (c.id === id) return c;
      for (const enh of c.controls ?? []) { if (enh.id === id) return enh; }
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
    for (const enh of c.controls ?? []) { if (enh.id === id) return enh; }
  }
  return undefined;
}

function findParentCatalogControl(catalog: OscalCatalog, enhId: string): CatalogControl | undefined {
  function searchGroup(g: CatalogGroup): CatalogControl | undefined {
    for (const c of g.controls ?? []) {
      for (const enh of c.controls ?? []) { if (enh.id === enhId) return c; }
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
    for (const enh of c.controls ?? []) { if (enh.id === enhId) return c; }
  }
  return undefined;
}

function getCatalogLabel(props?: CatalogOscalProp[]): string {
  if (!props) return "";
  const lbl = props.find((p) => p.name === "label" && p.class !== "zero-padded");
  return lbl?.value ?? props.find((p) => p.name === "label")?.value ?? "";
}

function resolveInlineParams(text: string, paramMap: Record<string, CatalogParam>): string {
  return text.replace(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/g, (_match, id: string) => {
    const param = paramMap[id.trim()];
    if (!param) return `[Assignment: ${id.trim()}]`;
    return renderParamText(param, paramMap);
  });
}

function renderParamText(param: CatalogParam, paramMap: Record<string, CatalogParam>): string {
  if (param.select) {
    const howMany = param.select["how-many"];
    const prefix = howMany === "one-or-more" ? "Selection (one or more)" : "Selection";
    const choices = (param.select.choice ?? []).map((c) => resolveInlineParams(c, paramMap));
    return `[${prefix}: ${choices.join("; ")}]`;
  }
  const label = param.label ? resolveInlineParams(param.label, paramMap) : param.id;
  return `[Assignment: ${label}]`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseAssessmentPlan(raw: any): PlanParsed {
  const ap = raw["assessment-plan"] ?? raw;
  if (!ap.metadata) throw new Error("Not a valid OSCAL Assessment Plan — missing metadata.");
  const md = ap.metadata || {};

  const activities: ActivityParsed[] = (ap["local-definitions"]?.activities || []).map((a: any) => ({
    uuid: a.uuid,
    title: a.title || "",
    description: txt(a.description),
    relatedControls: (a["related-controls"]?.["control-selections"] || [])
      .flatMap((sel: any) => extractControlIds(sel)),
    steps: (a.steps || []).map((s: any) => {
      const props: OscalProp[] = s.props || [];
      const method = props.find((p: OscalProp) => p.name === "method")?.value ?? "EXAMINE";
      const controls: string[] = (s["reviewed-controls"]?.["control-selections"] || [])
        .flatMap((sel: any) => extractControlIds(sel));
      const links: OscalLink[] = (s.links || []).map((l: any) => ({
        href: l.href || "",
        rel: l.rel || "",
        text: l.text || "",
      }));
      return {
        uuid: s.uuid,
        title: s.title || "",
        description: txt(s.description),
        remarks: txt(s.remarks),
        controls,
        method: method.toUpperCase(),
        links,
      } as StepParsed;
    }),
  }));

  const actMap: Record<string, ActivityParsed> = {};
  activities.forEach((a) => { actMap[a.uuid] = a; });

  const tasks: TaskParsed[] = (ap.tasks || []).map((t: any) => {
    const assocActs = (t["associated-activities"] || [])
      .map((aa: any) => actMap[aa["activity-uuid"]])
      .filter(Boolean);
    let timing = "";
    if (t.timing) {
      if (t.timing["within-date-range"]) {
        const r = t.timing["within-date-range"];
        timing = `${fmtDate(r.start)} — ${fmtDate(r.end)}`;
      } else if (t.timing["at-frequency"]) {
        const f = t.timing["at-frequency"];
        timing = `Every ${f.period} ${f.unit}`;
      } else if (t.timing["on-date"]) {
        timing = fmtDate(t.timing["on-date"].date);
      }
    }
    return {
      uuid: t.uuid,
      title: t.title || "",
      type: t.type || "action",
      description: txt(t.description),
      timing,
      associatedActivities: assocActs,
    } as TaskParsed;
  });

  return {
    title: md.title || "Untitled Assessment Plan",
    version: md.version || "",
    oscalVersion: md["oscal-version"] || "",
    lastModified: md["last-modified"] || "",
    published: md.published || "",
    parties: (md.parties || []).map((p: any) => p.name).filter(Boolean),
    activities,
    tasks,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface IconProps { size?: number; style?: CSSProperties }

function IcoUpload({ size = 20, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IcoShield({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
      <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 2.18l7 3.82v4c0 4.52-3.08 8.74-7 9.93-3.92-1.19-7-5.41-7-9.93V8l7-3.82z" />
    </svg>
  );
}
function IcoSearch({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IcoAct({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IcoTask({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}
function IcoHome({ size = 16, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IcoRight({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   METHOD STYLING
   ═══════════════════════════════════════════════════════════════════════════ */

const METH: Record<string, { bg: string; text: string }> = {
  EXAMINE:   { bg: colors.tintGreen, text: colors.darkGreen },
  INTERVIEW: { bg: colors.tintPurple, text: colors.purple },
  TEST:      { bg: colors.tintYellow, text: colors.yellow },
};

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Card({ children, style: s }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      backgroundColor: colors.card, borderRadius: radii.md,
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
void SectionLabel; // reserved for future use

function MField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.gray, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: colors.black, fontFamily: mono ? fonts.mono : fonts.sans, wordBreak: "break-all" }}>
        {value}
      </div>
    </div>
  );
}

function ControlBadge({ control, active, onClick }: { control: string; active: boolean; onClick: (c: string) => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(control); }} style={{
      display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: 3,
      fontSize: 10.5, fontWeight: 700, fontFamily: fonts.mono, letterSpacing: "0.03em",
      border: `1.5px solid ${active ? colors.orange : colors.navy}`,
      background: active ? colors.tintOrange : colors.surfaceSubtle,
      color: active ? colors.orange : colors.navy,
      cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", lineHeight: "18px",
    }}>
      <IcoShield size={10} />{control}
    </button>
  );
}

function MethTag({ v }: { v: string }) {
  const c = METH[v] || METH.EXAMINE;
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 3,
      fontSize: 10, fontWeight: 600, fontFamily: fonts.sans,
      background: c.bg, color: c.text,
    }}>
      {v}
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
        <IcoShield size={48} style={{ color: colors.purple }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>OSCAL Assessment Plan Viewer</h2>
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
          backgroundColor: dragging ? colors.dropzoneBg : colors.card,
          cursor: "pointer", transition: "border-color .2s, background-color .2s",
          maxWidth: 520, margin: "0 auto",
        }}>
        <IcoUpload size={40} style={{ color: colors.gray }} />
        <p style={{ marginTop: 12, fontSize: 15, color: colors.black }}>
          Drop an OSCAL <strong>Assessment Plan</strong> JSON file here
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
            placeholder="https://example.com/assessment-plan.json"
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
   CATALOG CONTROL DETAIL PANEL — expandable inline control info
   ═══════════════════════════════════════════════════════════════════════════ */

const PART_SECTIONS: { name: string; label: string; color: string }[] = [
  { name: "overview", label: "Overview", color: colors.cobalt },
  { name: "statement", label: "Statement", color: colors.navy },
  { name: "guidance", label: "Guidance", color: colors.brightBlue },
];

function CtrlPartTree({ part, depth, paramMap }: { part: CatalogPart; depth: number; paramMap: Record<string, CatalogParam> }) {
  const subParts = part.parts ?? [];
  const partLabel = getCatalogLabel(part.props);
  const depthColors = [colors.navy, colors.brightBlue, colors.cobalt, colors.gray, colors.blueGray];
  const borderColor = depthColors[depth % depthColors.length];
  return (
    <div style={{
      marginTop: depth === 0 ? 0 : 8,
      paddingLeft: depth > 0 ? 16 : 0,
      borderLeft: depth > 0 ? `3px solid ${borderColor}` : "none",
    }}>
      {partLabel && <span style={{ fontSize: 12, fontWeight: 700, color: borderColor, fontFamily: fonts.mono, marginRight: 6 }}>{partLabel}</span>}
      {part.prose && <MarkupBlock value={resolveInlineParams(part.prose, paramMap)} style={{ fontSize: 12.5 }} />}
      {subParts.length > 0 && subParts.map((sp, i) => <CtrlPartTree key={sp.id ?? i} part={sp} depth={depth + 1} paramMap={paramMap} />)}
    </div>
  );
}

function ControlDetailPanel({ controlId, catalog }: { controlId: string; catalog: OscalCatalog }) {
  const [expanded, setExpanded] = useState(false);
  const control = useMemo(() => findCatalogControl(catalog, controlId), [catalog, controlId]);

  if (!control) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
        background: colors.surfaceMuted, borderRadius: radii.sm, marginBottom: 4,
        border: `1px solid ${colors.borderSubtle}`,
      }}>
        <IcoShield size={12} style={{ color: colors.gray }} />
        <span style={{ fontSize: 12, fontFamily: fonts.mono, fontWeight: 600, color: colors.navy }}>{controlId}</span>
        <span style={{ fontSize: 11, color: colors.gray, fontStyle: "italic" }}>— not found in loaded catalog</span>
      </div>
    );
  }

  const lbl = getCatalogLabel(control.props);
  const allParts = control.parts ?? [];
  const params = control.params ?? [];
  const enhancements = control.controls ?? [];

  const paramMap = useMemo(() => {
    const map: Record<string, CatalogParam> = {};
    const parent = findParentCatalogControl(catalog, control.id);
    if (parent) (parent.params ?? []).forEach((p) => { map[p.id] = p; });
    params.forEach((p) => { map[p.id] = p; });
    enhancements.forEach((enh) => (enh.params ?? []).forEach((p) => { map[p.id] = p; }));
    return map;
  }, [catalog, control, params, enhancements]);

  const sectionParts: Record<string, CatalogPart[]> = {};
  PART_SECTIONS.forEach((s) => { sectionParts[s.name] = allParts.filter((p) => p.name === s.name); });

  return (
    <div style={{
      background: colors.card, borderRadius: radii.sm, marginBottom: 6,
      border: `1px solid ${colors.border}`, borderLeft: `4px solid ${colors.purple}`,
      overflow: "hidden",
    }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <IcoRight size={12} style={{ color: colors.purple, transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform .15s" }} />
        <IcoShield size={13} style={{ color: colors.purple }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy, fontFamily: fonts.mono }}>{lbl ? `${lbl} ` : ""}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: colors.black }}>{control.title}</span>
        <span style={{ fontSize: 10, color: colors.gray, fontFamily: fonts.mono, marginLeft: "auto" }}>{control.id}</span>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 12px" }}>
          {PART_SECTIONS.map((sec) => {
            const pts = sectionParts[sec.name];
            if (!pts || pts.length === 0) return null;
            return (
              <div key={sec.name} style={{
                padding: "8px 12px", marginTop: 8,
                backgroundColor: colors.surfaceMuted, borderRadius: radii.sm,
                borderLeft: `3px solid ${sec.color}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: sec.color, marginBottom: 6 }}>
                  {sec.label}
                </div>
                {pts.map((part, i) => <CtrlPartTree key={part.id ?? i} part={part} depth={0} paramMap={paramMap} />)}
              </div>
            );
          })}
          {params.length > 0 && (
            <div style={{ padding: "8px 12px", marginTop: 8, backgroundColor: colors.surfaceMuted, borderRadius: radii.sm }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: colors.orange, marginBottom: 6 }}>
                Parameters ({params.length})
              </div>
              {params.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 11.5, marginBottom: 2 }}>
                  <span style={{ fontFamily: fonts.mono, color: colors.gray, fontWeight: 600, minWidth: 90 }}>{p.id}</span>
                  <span style={{
                    fontFamily: fonts.mono, fontWeight: 600, fontSize: 11,
                    color: p.select ? colors.cobalt : colors.orange,
                    backgroundColor: p.select ? alpha(colors.cobalt, 7) : alpha(colors.orange, 7),
                    padding: "1px 6px", borderRadius: radii.sm,
                  }}>{renderParamText(p, paramMap)}</span>
                </div>
              ))}
            </div>
          )}
          {enhancements.length > 0 && (
            <div style={{ padding: "8px 12px", marginTop: 8, backgroundColor: colors.surfaceMuted, borderRadius: radii.sm }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: colors.cobalt, marginBottom: 6 }}>
                Enhancements ({enhancements.length})
              </div>
              {enhancements.map((enh) => {
                const eLbl = getCatalogLabel(enh.props);
                return (
                  <div key={enh.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", fontSize: 11.5 }}>
                    <span style={{ fontWeight: 600, color: colors.navy, fontFamily: fonts.mono, minWidth: 70 }}>{eLbl || enh.id}</span>
                    <span style={{ color: colors.black }}>{enh.title}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RELATED CONTROLS SECTION — shown in activity view when controls exist
   ═══════════════════════════════════════════════════════════════════════════ */

function RelatedControlsSection({ controlIds, catalog, hCtrl, onCtrl }: {
  controlIds: string[]; catalog: OscalCatalog | null; hCtrl: string; onCtrl: (c: string) => void;
}) {
  if (controlIds.length === 0) return null;
  return (
    <div style={{
      background: colors.card, borderRadius: radii.sm, padding: "12px 16px", marginBottom: 16,
      border: `1px solid ${colors.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <IcoShield size={14} style={{ color: colors.purple }} />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: colors.purple }}>
          Related Controls ({controlIds.length})
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: catalog ? 10 : 0 }}>
        {controlIds.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
      </div>
      {catalog && controlIds.map((cid) => (
        <ControlDetailPanel key={cid} controlId={cid} catalog={catalog} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP TABLE WITH DETAIL — compact summary rows + inline expand
   ═══════════════════════════════════════════════════════════════════════════ */

function StepTableWithDetail({ activity, hCtrl, onCtrl }: {
  activity: ActivityParsed; hCtrl: string; onCtrl: (c: string) => void;
}) {
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: "0 0 8px 8px", overflow: "hidden", borderTop: "none" }}>
      {/* Column header */}
      <div style={{
        display: "grid", gridTemplateColumns: "36px 1fr auto auto", alignItems: "center",
        padding: "6px 14px", gap: 8,
        background: colors.surfaceMuted, borderBottom: `1px solid ${colors.border}`,
        fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em",
        color: colors.gray, fontFamily: fonts.sans,
      }}>
        <span>#</span>
        <span>Step</span>
        <span>Method</span>
        <span style={{ textAlign: "right" }}>Controls</span>
      </div>

      {activity.steps.map((step, i) => {
        const hit = hCtrl && step.controls.includes(hCtrl);
        const isOpen = selectedUuid === step.uuid;
        return (
          <div key={step.uuid}>
            {/* Summary row */}
            <div
              onClick={() => setSelectedUuid(isOpen ? null : step.uuid)}
              style={{
                display: "grid", gridTemplateColumns: "36px 1fr auto auto", alignItems: "center",
                padding: "8px 14px", gap: 8, cursor: "pointer",
                background: isOpen ? alpha(colors.brightBlue, 6) : hit ? colors.tintOrange : colors.card,
                borderLeft: `3px solid ${isOpen ? colors.brightBlue : hit ? colors.orange : "transparent"}`,
                borderBottom: isOpen ? "none" : `1px solid ${colors.borderSubtle}`,
                transition: "background 0.12s",
              }}
            >
              <span style={{ fontSize: 10, color: colors.gray, fontWeight: 600, fontFamily: fonts.mono }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{
                fontSize: 12, fontWeight: isOpen ? 700 : 500, fontFamily: fonts.mono,
                color: isOpen ? colors.brightBlue : colors.navy,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {step.title}
              </span>
              <MethTag v={step.method} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "flex-end" }}>
                {step.controls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
              </div>
            </div>

            {/* Expanded detail panel */}
            {isOpen && (
              <div style={{
                padding: "12px 14px 14px 53px",
                background: alpha(colors.brightBlue, 4),
                borderLeft: `3px solid ${colors.brightBlue}`,
                borderBottom: `1px solid ${colors.borderSubtle}`,
              }}>
                {step.description && (
                  <MarkupBlock value={step.description} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 6 }} />
                )}
                {step.remarks && (
                  <p style={{ fontSize: 11.5, color: colors.blueGray, lineHeight: 1.4, margin: "0 0 6px", fontFamily: fonts.sans, fontStyle: "italic" }}>
                    {step.remarks}
                  </p>
                )}
                {step.links.length > 0 && (
                  <LinkChips
                    links={step.links.map((l) => {
                      const frag = (l as { "resource-fragment"?: string })["resource-fragment"];
                      const baseText = l.text || (l.rel === "mitre" ? (l.href.split("/").pop() ?? l.href) : "Reference");
                      const text = frag ? `${baseText} \u2014 ${frag}` : baseText;
                      return { text, href: l.href, rel: l.rel || undefined };
                    })}
                    label={null}
                    style={{ marginTop: 2 }}
                  />
                )}
                {!step.description && !step.remarks && step.links.length === 0 && (
                  <span style={{ fontSize: 12, color: colors.gray, fontStyle: "italic" }}>No additional details for this step.</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVITY HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

function ActivityHeader({ activity, hCtrl, onCtrl }: {
  activity: ActivityParsed; hCtrl: string; onCtrl: (c: string) => void;
}) {
  const ctrls = [...new Set(activity.steps.flatMap((s) => s.controls))].sort();
  return (
    <>
      <div style={{
        background: colors.card, color: colors.navy, padding: "12px 18px",
        borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        borderTop: `3px solid ${colors.orange}`,
        border: `1px solid ${colors.border}`, borderTopWidth: 3, borderTopColor: colors.orange,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.sans, margin: 0, color: colors.navy }}>{activity.title}</h2>
          {activity.description && (
            <MarkupBlock value={activity.description} style={{ fontSize: 12, margin: "2px 0 0", fontFamily: fonts.sans, color: colors.blueGray }} />
          )}
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 10.5, fontWeight: 600, fontFamily: fonts.mono, flexShrink: 0 }}>
          <span style={{ background: colors.surfaceMuted, color: colors.navy, padding: "2px 8px", borderRadius: 3 }}>{activity.steps.length} steps</span>
        </div>
      </div>
      {ctrls.length > 0 && (
        <div style={{
          background: colors.surfaceSubtle, padding: "6px 18px", display: "flex", flexWrap: "wrap",
          gap: 4, alignItems: "center", borderBottom: activity.relatedControls.length > 0 ? `1px solid ${colors.borderSubtle}` : `2px solid ${colors.orange}`,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: colors.gray, marginRight: 6, fontFamily: fonts.sans }}>
            Step Controls:
          </span>
          {ctrls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
        </div>
      )}
      {activity.relatedControls.length > 0 && (
        <div style={{
          background: colors.surfaceMuted, padding: "6px 18px", display: "flex", flexWrap: "wrap",
          gap: 4, alignItems: "center", borderBottom: `2px solid ${colors.orange}`,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: colors.purple, marginRight: 6, fontFamily: fonts.sans }}>
            Related Controls:
          </span>
          {activity.relatedControls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVITY SUBHEADER (lightweight, for task page)
   ═══════════════════════════════════════════════════════════════════════════ */

function ActivitySubheader({ activity, hCtrl, onCtrl }: {
  activity: ActivityParsed; hCtrl: string; onCtrl: (c: string) => void;
}) {
  const ctrls = [...new Set(activity.steps.flatMap((s) => s.controls))].sort();
  return (
    <>
      <div style={{
        background: colors.card, padding: "10px 18px", borderRadius: "8px 8px 0 0",
        border: `1px solid ${colors.border}`, borderBottom: "none",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <IcoAct size={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy, fontFamily: fonts.sans }}>{activity.title}</span>
          {activity.description && (
            <MarkupBlock value={activity.description} style={{ fontSize: 12, color: colors.blueGray, margin: "2px 0 0", fontFamily: fonts.sans }} />
          )}
        </div>
        <div style={{ display: "flex", gap: 6, fontSize: 10, fontWeight: 600, fontFamily: fonts.mono, flexShrink: 0 }}>
          <span style={{ background: colors.surfaceSubtle, color: colors.navy, padding: "2px 7px", borderRadius: 3 }}>{activity.steps.length} steps</span>
        </div>
      </div>
      <div style={{
        background: colors.surfaceMuted, padding: "6px 18px", display: "flex", flexWrap: "wrap",
        gap: 4, alignItems: "center",
        borderLeft: `1px solid ${colors.border}`, borderRight: `1px solid ${colors.border}`,
        borderBottom: activity.relatedControls.length > 0 ? `1px solid ${colors.borderSubtle}` : `2px solid ${colors.orange}`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: colors.gray, marginRight: 6 }}>
          Step Controls:
        </span>
        {ctrls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
      </div>
      {activity.relatedControls.length > 0 && (
        <div style={{
          background: colors.surfaceMuted, padding: "6px 18px", display: "flex", flexWrap: "wrap",
          gap: 4, alignItems: "center",
          borderLeft: `1px solid ${colors.border}`, borderRight: `1px solid ${colors.border}`,
          borderBottom: `2px solid ${colors.orange}`,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: colors.purple, marginRight: 6 }}>
            Related Controls:
          </span>
          {activity.relatedControls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BREADCRUMB HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

function BreadcrumbHeader({ planTitle, crumbs, onHome }: {
  planTitle: string; crumbs: string[]; onHome: () => void;
}) {
  return (
    <div style={{
      background: colors.card, borderRadius: 6, padding: "8px 16px", marginBottom: 16,
      border: `1px solid ${colors.paleGray}`, display: "flex", alignItems: "center", gap: 8,
      fontSize: 12, fontFamily: fonts.sans, color: colors.gray,
    }}>
      <button onClick={onHome} style={{
        background: "none", border: "none", cursor: "pointer", color: colors.cobalt,
        display: "flex", alignItems: "center", gap: 4, fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, padding: 0,
      }}>
        <IcoHome size={13} />{planTitle}
      </button>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: colors.paleGray }}>/</span>
          <span style={{ color: i === crumbs.length - 1 ? colors.navy : colors.gray, fontWeight: i === crumbs.length - 1 ? 600 : 400 }}>{c}</span>
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONTROLS PANEL (sidebar collapsible)
   ═══════════════════════════════════════════════════════════════════════════ */

function CtrlPanel({ allControls, onClick, isActive }: {
  allControls: string[]; onClick: () => void; isActive: boolean;
}) {
  return (
    <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
      <button onClick={onClick} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px", border: "none", cursor: "pointer",
        background: isActive ? alpha(colors.navy, 8) : "transparent",
        borderLeft: `3px solid ${isActive ? colors.orange : "transparent"}`,
        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
        color: colors.navy, fontFamily: fonts.sans,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IcoShield size={12} />Controls ({allControls.length})
        </span>
        <IcoRight size={12} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW: OVERVIEW (landing page)
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewView({ plan, stats, hCtrl, onCtrl, onSelectActivity }: {
  plan: PlanParsed;
  stats: { totalActivities: number; totalSteps: number; totalControls: number; totalTasks: number };
  hCtrl: string;
  onCtrl: (c: string) => void;
  onSelectActivity: (uuid: string) => void;
}) {
  return (
    <>
      {/* Metadata header */}
      <Card>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.navy, fontFamily: fonts.sans, marginBottom: 4 }}>
          {plan.title}
        </h1>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: colors.gray, fontFamily: fonts.sans, marginBottom: 14 }}>
          {plan.version && <span>Version: <strong style={{ color: colors.black }}>{plan.version}</strong></span>}
          {plan.oscalVersion && <span>OSCAL: <strong style={{ color: colors.black }}>{plan.oscalVersion}</strong></span>}
          {plan.lastModified && <span>Modified: <strong style={{ color: colors.black }}>{fmtDate(plan.lastModified)}</strong></span>}
          {plan.published && <span>Published: <strong style={{ color: colors.black }}>{fmtDate(plan.published)}</strong></span>}
          {plan.parties.length > 0 && <span>Author: <strong style={{ color: colors.black }}>{plan.parties.join(", ")}</strong></span>}
        </div>

        {/* Stats chips */}
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          {[
            { v: stats.totalActivities, l: "Activities", c: colors.navy },
            { v: stats.totalSteps, l: "Steps", c: colors.brightBlue },
            { v: stats.totalControls, l: "Controls", c: colors.darkGreen },
            ...(stats.totalTasks > 0 ? [{ v: stats.totalTasks, l: "Tasks", c: colors.purple }] : []),
          ].map((s) => (
            <div key={s.l} style={{ textAlign: "center", background: colors.surfaceMuted, borderRadius: 6, padding: "8px 16px", minWidth: 72 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity cards */}
      {plan.activities.map((a) => {
        const ctrls = [...new Set([...a.steps.flatMap((s) => s.controls), ...a.relatedControls])].sort();
        const matchCount = hCtrl ? a.steps.filter((s) => s.controls.includes(hCtrl)).length + (a.relatedControls.includes(hCtrl) ? 1 : 0) : 0;
        return (
          <div key={a.uuid} onClick={() => onSelectActivity(a.uuid)} style={{
            background: colors.card, borderRadius: 8,
            border: `1px solid ${matchCount > 0 ? colors.orange : colors.paleGray}`,
            padding: "14px 18px", marginBottom: 10, cursor: "pointer", transition: "all 0.15s",
            boxShadow: matchCount > 0 ? `0 0 0 1px ${alpha(colors.orange, 13)}` : shadows.sm,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.navy, margin: 0, fontFamily: fonts.sans }}>{a.title}</h3>
                {a.description && (
                  <MarkupBlock value={a.description} style={{ fontSize: 12, color: colors.blueGray, margin: "2px 0 0", fontFamily: fonts.sans, maxHeight: 40, overflow: "hidden" }} />
                )}
              </div>
              <div style={{ display: "flex", gap: 6, fontSize: 10, fontWeight: 600, fontFamily: fonts.mono, flexShrink: 0 }}>
                <span style={{ background: colors.surfaceSubtle, color: colors.navy, padding: "2px 7px", borderRadius: 3 }}>{a.steps.length} steps</span>
                {matchCount > 0 && <span style={{ background: colors.tintOrange, color: colors.orange, padding: "2px 7px", borderRadius: 3, fontWeight: 700 }}>{matchCount} match{matchCount !== 1 ? "es" : ""}</span>}
              </div>
              <IcoRight size={16} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {ctrls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW: ACTIVITY (full step list)
   ═══════════════════════════════════════════════════════════════════════════ */

function ActivityView({ activity, planTitle, hCtrl, onCtrl, onHome, catalog }: {
  activity: ActivityParsed; planTitle: string; hCtrl: string; onCtrl: (c: string) => void; onHome: () => void; catalog: OscalCatalog | null;
}) {
  return (
    <>
      <BreadcrumbHeader planTitle={planTitle} crumbs={[activity.title]} onHome={onHome} />
      <ActivityHeader activity={activity} hCtrl={hCtrl} onCtrl={onCtrl} />
      <StepTableWithDetail activity={activity} hCtrl={hCtrl} onCtrl={onCtrl} />
      {activity.relatedControls.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <RelatedControlsSection controlIds={activity.relatedControls} catalog={catalog} hCtrl={hCtrl} onCtrl={onCtrl} />
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW: TASK (timing + associated activities)
   ═══════════════════════════════════════════════════════════════════════════ */

function TaskView({ task, planTitle, hCtrl, onCtrl, onHome, catalog }: {
  task: TaskParsed; planTitle: string; hCtrl: string; onCtrl: (c: string) => void; onHome: () => void; catalog: OscalCatalog | null;
}) {
  return (
    <>
      <BreadcrumbHeader planTitle={planTitle} crumbs={["Tasks", task.title]} onHome={onHome} />

      {/* Task info card */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <IcoTask size={18} style={{ color: colors.purple }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.navy, margin: 0 }}>{task.title}</h2>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          <MField label="Type" value={task.type} />
          {task.timing && <MField label="Timing" value={task.timing} />}
          <MField label="Associated Activities" value={String(task.associatedActivities.length)} />
        </div>
        {task.description && <MarkupBlock value={task.description} />}
      </Card>

      {/* Associated activities with their full step lists */}
      {task.associatedActivities.map((act) => (
        <div key={act.uuid} style={{ marginBottom: 20 }}>
          <ActivitySubheader activity={act} hCtrl={hCtrl} onCtrl={onCtrl} />
          <StepTableWithDetail activity={act} hCtrl={hCtrl} onCtrl={onCtrl} />
          {act.relatedControls.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <RelatedControlsSection controlIds={act.relatedControls} catalog={catalog} hCtrl={hCtrl} onCtrl={onCtrl} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW: CONTROLS (control-centric view showing activities per control)
   ═══════════════════════════════════════════════════════════════════════════ */

function ControlsView({ plan, allControls, catalog, hCtrl, onCtrl, onHome, onSelectActivity }: {
  plan: PlanParsed; allControls: string[]; catalog: OscalCatalog | null;
  hCtrl: string; onCtrl: (c: string) => void; onHome: () => void;
  onSelectActivity: (uuid: string) => void;
}) {
  const [search, setSearch] = useState("");

  // Build control → activities mapping
  const controlActivityMap = useMemo(() => {
    const map: Record<string, { activity: ActivityParsed; via: "step" | "related" }[]> = {};
    for (const a of plan.activities) {
      const stepCtrls = new Set(a.steps.flatMap((s) => s.controls));
      const relCtrls = new Set(a.relatedControls);
      const allCtrls = new Set([...stepCtrls, ...relCtrls]);
      for (const cid of allCtrls) {
        if (!map[cid]) map[cid] = [];
        map[cid].push({ activity: a, via: relCtrls.has(cid) ? "related" : "step" });
      }
    }
    return map;
  }, [plan.activities]);

  const filteredControls = useMemo(() => {
    if (!search) return allControls;
    const q = search.toLowerCase();
    return allControls.filter((c) => {
      if (c.toLowerCase().includes(q)) return true;
      if (catalog) {
        const ctrl = findCatalogControl(catalog, c);
        if (ctrl && ctrl.title.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [allControls, search, catalog]);

  return (
    <>
      <BreadcrumbHeader planTitle={plan.title} crumbs={["Controls"]} onHome={onHome} />

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <IcoShield size={18} style={{ color: colors.purple }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.navy, margin: 0 }}>
            Addressed Controls ({allControls.length})
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: colors.surfaceMuted, borderRadius: 4, padding: "6px 10px", marginBottom: 10 }}>
          <IcoSearch size={14} style={{ color: colors.gray }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter controls by ID or title..."
            style={{ border: "none", background: "transparent", outline: "none", flex: 1, fontSize: 13, fontFamily: fonts.sans, color: colors.black }}
          />
        </div>
        {!catalog && (
          <div style={{
            padding: "8px 14px", background: colors.surfaceMuted, borderRadius: radii.sm,
            border: `1px solid ${colors.borderSubtle}`, fontSize: 12, color: colors.gray, fontStyle: "italic",
          }}>
            Load a catalog in the Catalog tab to see full control details (title, statement, guidance).
          </div>
        )}
      </Card>

      {filteredControls.map((cid) => {
        const activities = controlActivityMap[cid] ?? [];
        const catalogCtrl = catalog ? findCatalogControl(catalog, cid) : null;
        const lbl = catalogCtrl ? getCatalogLabel(catalogCtrl.props) : "";
        const isActive = hCtrl === cid;

        return (
          <ControlEntry
            key={cid}
            controlId={cid}
            label={lbl}
            title={catalogCtrl?.title}
            catalog={catalog}
            activities={activities}
            isActive={isActive}
            onCtrl={onCtrl}
            onSelectActivity={onSelectActivity}
          />
        );
      })}

      {filteredControls.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: colors.gray, fontSize: 13 }}>
          No controls match your search.
        </div>
      )}
    </>
  );
}

/* ── Single control entry in the controls view ── */
function ControlEntry({ controlId, label, title, catalog, activities, isActive, onCtrl, onSelectActivity }: {
  controlId: string; label: string; title?: string; catalog: OscalCatalog | null;
  activities: { activity: ActivityParsed; via: "step" | "related" }[];
  isActive: boolean; onCtrl: (c: string) => void; onSelectActivity: (uuid: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: colors.card, borderRadius: radii.md, marginBottom: 10,
      border: `1px solid ${isActive ? colors.orange : colors.border}`,
      boxShadow: isActive ? `0 0 0 1px ${alpha(colors.orange, 13)}` : shadows.sm,
      overflow: "hidden",
    }}>
      {/* Control header */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          cursor: "pointer", userSelect: "none",
        }}
      >
        <IcoRight size={12} style={{ color: colors.purple, transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform .15s", flexShrink: 0 }} />
        <ControlBadge control={controlId} active={isActive} onClick={onCtrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.black }}>{label ? `${label} ` : ""}{title}</span>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, fontFamily: fonts.mono, padding: "2px 8px",
          borderRadius: 3, background: colors.surfaceMuted, color: colors.navy, flexShrink: 0,
        }}>
          {activities.length} {activities.length === 1 ? "activity" : "activities"}
        </span>
      </div>

      {/* Expanded: catalog detail + assessments */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, padding: "12px 16px" }}>
          {/* Catalog detail */}
          {catalog && (
            <ControlDetailPanel controlId={controlId} catalog={catalog} />
          )}

          {/* Assessing activities */}
          <div style={{ marginTop: catalog ? 12 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: colors.gray, marginBottom: 8 }}>
              Assessed by
            </div>
            {activities.map(({ activity, via }) => (
              <div
                key={activity.uuid}
                onClick={(e) => { e.stopPropagation(); onSelectActivity(activity.uuid); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                  background: colors.surfaceMuted, borderRadius: radii.sm, marginBottom: 4,
                  cursor: "pointer", border: `1px solid ${colors.borderSubtle}`,
                  transition: "border-color 0.12s",
                }}
              >
                <IcoAct size={13} style={{ color: colors.navy, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: colors.navy }}>{activity.title}</div>
                  <div style={{ fontSize: 10, color: colors.gray, fontFamily: fonts.mono }}>
                    {activity.steps.length} steps
                    {via === "related" && (
                      <span style={{ marginLeft: 6, color: colors.purple, fontWeight: 600 }}>related-control</span>
                    )}
                    {via === "step" && (
                      <span style={{ marginLeft: 6, color: colors.cobalt, fontWeight: 600 }}>
                        {activity.steps.filter((s) => s.controls.includes(controlId)).length} step{activity.steps.filter((s) => s.controls.includes(controlId)).length !== 1 ? "s" : ""} assess this control
                      </span>
                    )}
                  </div>
                </div>
                <IcoRight size={12} style={{ color: colors.gray }} />
              </div>
            ))}
            {activities.length === 0 && (
              <div style={{ fontSize: 12, color: colors.gray, fontStyle: "italic" }}>
                No activities reference this control.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR NAV ITEM
   ═══════════════════════════════════════════════════════════════════════════ */

function NavItem({ label, sublabel, isActive, stepCount, onClick, icon }: {
  label: string; sublabel?: string; isActive: boolean; stepCount?: number;
  onClick: () => void; icon: ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", cursor: "pointer",
      background: isActive ? alpha(colors.navy, 8) : "transparent",
      borderLeft: `3px solid ${isActive ? colors.orange : "transparent"}`,
      transition: "all 0.1s", borderRadius: 0, fontFamily: fonts.sans,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: isActive ? colors.orange : colors.gray, flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? colors.navy : colors.black,
          lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {label}
        </span>
      </div>
      {sublabel && <div style={{ fontSize: 10, color: colors.gray, marginTop: 2, marginLeft: 22 }}>{sublabel}</div>}
      {stepCount != null && (
        <div style={{ display: "flex", gap: 5, marginTop: 3, marginLeft: 22 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, background: colors.surfaceSubtle, color: colors.navy, padding: "1px 5px", borderRadius: 2, fontFamily: fonts.mono }}>
            {stepCount} steps
          </span>
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

type PageState = null | { type: "activity"; uuid: string } | { type: "task"; uuid: string } | { type: "controls" };

export default function AssessmentPlanPage() {
  const oscal = useOscal();
  const { token: authToken } = useAuth();
  const raw = oscal.assessmentPlan?.data ?? null;
  const catalog: OscalCatalog | null = oscal.catalog?.data ?? null;

  const [error, setError] = useState("");
  const [hCtrl, setHCtrl] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"activities" | "tasks">("activities");
  const [page, setPage] = useState<PageState>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [mobileShowContent, setMobileShowContent] = useState(false);

  /* ── Auto-load from ?url= query param ── */
  const urlDoc = useUrlDocument();
  useEffect(() => {
    if (!urlDoc.json || oscal.assessmentPlan) return;
    try {
      const ap = (urlDoc.json as Record<string, unknown>)["assessment-plan"] ?? urlDoc.json;
      if (!(ap as Record<string, unknown>).metadata)
        throw new Error("Not a valid OSCAL Assessment Plan — missing metadata.");
      oscal.setAssessmentPlan(urlDoc.json, fileNameFromUrl(urlDoc.sourceUrl!));
      setPage(null);
      setHCtrl("");
      setSearch("");
      setMode("activities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse fetched document");
    }
  }, [urlDoc.json]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Parse data ── */
  const plan = useMemo<PlanParsed | null>(() => {
    if (!raw) return null;
    try { return parseAssessmentPlan(raw); }
    catch { return null; }
  }, [raw]);

  /* ── Load file ── */
  const loadFile = useCallback((file: File) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        // Validate it has assessment-plan or metadata
        const ap = json["assessment-plan"] ?? json;
        if (!ap.metadata) throw new Error("Not a valid OSCAL Assessment Plan — missing metadata.");
        oscal.setAssessmentPlan(json, file.name);
        setPage(null);
        setHCtrl("");
        setSearch("");
        setMode("activities");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse JSON");
      }
    };
    reader.readAsText(file);
  }, [oscal]);

  const handleNewFile = useCallback(() => {
    oscal.clearAssessmentPlan();
    setError("");
    setPage(null);
    setHCtrl("");
    setSearch("");
  }, [oscal]);

  /* ── Auto-resolve import-ssp reference ── */
  const rawApObj = useMemo(() => {
    if (!raw) return null;
    const r = raw as Record<string, unknown>;
    return (r["assessment-plan"] ?? r) as Record<string, unknown>;
  }, [raw]);
  const apBackMatter = useMemo<BackMatterResource[]>(() => {
    if (!rawApObj) return [];
    const bm = rawApObj["back-matter"] as Record<string, unknown> | undefined;
    return (bm?.resources as BackMatterResource[] | undefined) ?? [];
  }, [rawApObj]);
  const importSspHref = useMemo(() => {
    if (!rawApObj) return null;
    const imp = rawApObj["import-ssp"] as Record<string, unknown> | undefined;
    return (imp?.href as string) ?? null;
  }, [rawApObj]);
  const chain = useChainResolver(
    importSspHref,
    apBackMatter,
    urlDoc.sourceUrl,
    authToken,
    AP_CHAIN,
    !!oscal.ssp,
  );
  const chainStored = useRef(new Set<string>());
  useEffect(() => {
    if (chain.steps.every(s => s.status === "idle")) { chainStored.current.clear(); return; }
    for (const step of chain.steps) {
      if (step.status === "success" && step.json && !chainStored.current.has(step.modelKey)) {
        chainStored.current.add(step.modelKey);
        const raw = step.json as Record<string, unknown>;
        const data = raw[step.modelKey] ?? raw;
        if (step.modelKey === "system-security-plan") oscal.setSsp(data, step.resolvedLabel ?? "Resolved SSP");
        if (step.modelKey === "profile") oscal.setProfile(data, step.resolvedLabel ?? "Resolved Profile");
        if (step.modelKey === "catalog") oscal.setCatalog(data as import("../context/OscalContext").Catalog, step.resolvedLabel ?? "Resolved Catalog");
      }
    }
  }, [chain.steps]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived data ── */
  const allControls = useMemo(() => {
    if (!plan) return [];
    const stepCtrls = plan.activities.flatMap((a) => a.steps.flatMap((s) => s.controls));
    const actCtrls = plan.activities.flatMap((a) => a.relatedControls);
    return [...new Set([...stepCtrls, ...actCtrls])].sort();
  }, [plan]);

  const stats = useMemo(() => {
    if (!plan) return { totalActivities: 0, totalSteps: 0, totalControls: 0, totalTasks: 0 };
    const totalSteps = plan.activities.reduce((n, a) => n + a.steps.length, 0);
    return {
      totalActivities: plan.activities.length,
      totalSteps,
      totalControls: allControls.length,
      totalTasks: plan.tasks.length,
    };
  }, [plan, allControls]);

  /* ── Navigation ── */
  const navigate = useCallback((p: PageState) => {
    setPage(p);
    contentRef.current?.scrollTo(0, 0);
    if (isMobile) setMobileShowContent(true);
  }, [isMobile]);

  const mobileBackToNav = useCallback(() => {
    setMobileShowContent(false);
  }, []);

  const onCtrl = useCallback((c: string) => setHCtrl((prev) => (prev === c ? "" : c)), []);

  const curActivity = useMemo(() => {
    if (!plan || page?.type !== "activity") return null;
    return plan.activities.find((a) => a.uuid === page.uuid) ?? null;
  }, [plan, page]);

  const curTask = useMemo(() => {
    if (!plan || page?.type !== "task") return null;
    return plan.tasks.find((t) => t.uuid === page.uuid) ?? null;
  }, [plan, page]);

  /* ── Filtered sidebar ── */
  const filteredActivities = useMemo(() => {
    if (!plan) return [];
    const q = search.toLowerCase();
    if (!q) return plan.activities;
    return plan.activities.filter(
      (a) => a.title.toLowerCase().includes(q) || a.relatedControls.some((c) => c.toLowerCase().includes(q)) || a.steps.some((s) => s.title.toLowerCase().includes(q) || s.controls.some((c) => c.toLowerCase().includes(q))),
    );
  }, [plan, search]);

  const filteredTasks = useMemo(() => {
    if (!plan) return [];
    const q = search.toLowerCase();
    if (!q) return plan.tasks;
    return plan.tasks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.type.toLowerCase().includes(q),
    );
  }, [plan, search]);

  /* ── Modal for dependency resolution status ── */
  const resolverModalEl = (
    <ResolverModal items={chain.items} onSkip={chain.cancel} />
  );

  /* ── No data — show drop zone ── */
  if (!plan) {
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
  if (isMobile) {
    if (mobileShowContent) {
      return (
        <div style={{ ...S.shell, height: "calc(100vh - 120px)" }}>
          {resolverModalEl}
          <div style={S.topBar}>
            <div style={S.topBarLeft}>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.white }}>AP Viewer</div>
            </div>
            <button style={S.topBtn} onClick={handleNewFile}>New File</button>
          </div>
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${colors.bg}`, backgroundColor: colors.card }}>
            <button onClick={mobileBackToNav} style={{ background: "none", border: "none", color: colors.cobalt, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: fonts.sans }}>
              ← Back to navigation
            </button>
          </div>
          <div ref={contentRef} style={{ ...S.content, padding: 12 }}>
            {page === null && (
              <OverviewView plan={plan} stats={stats} hCtrl={hCtrl} onCtrl={onCtrl}
                onSelectActivity={(uuid) => navigate({ type: "activity", uuid })}
                />
            )}
            {page?.type === "activity" && curActivity && (
              <ActivityView activity={curActivity} planTitle={plan.title} hCtrl={hCtrl} onCtrl={onCtrl} onHome={() => navigate(null)} catalog={catalog} />
            )}
            {page?.type === "task" && curTask && (
              <TaskView task={curTask} planTitle={plan.title} hCtrl={hCtrl} onCtrl={onCtrl} onHome={() => navigate(null)} catalog={catalog} />
            )}
            {page?.type === "controls" && (
              <ControlsView plan={plan} allControls={allControls} catalog={catalog} hCtrl={hCtrl} onCtrl={onCtrl} onHome={() => navigate(null)} onSelectActivity={(uuid) => navigate({ type: "activity", uuid })} />
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...S.shell, height: "calc(100vh - 120px)" }}>
        {resolverModalEl}
        <div style={S.topBar}>
          <div style={S.topBarLeft}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.white }}>AP Viewer</div>
          </div>
          <button style={S.topBtn} onClick={handleNewFile}>New File</button>
        </div>

        {/* Plan title + stats */}
        <div style={{ padding: "10px 12px 6px", borderBottom: `1px solid ${colors.bg}`, backgroundColor: colors.card }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, fontFamily: fonts.sans, marginBottom: 2 }}>
            {trunc(plan.title, 40)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 10, color: colors.gray, fontFamily: fonts.sans, marginBottom: 6 }}>
            {plan.version && <span>Version: <strong style={{ color: colors.black }}>{plan.version}</strong></span>}
            {plan.oscalVersion && <span>OSCAL: <strong style={{ color: colors.black }}>{plan.oscalVersion}</strong></span>}
            {plan.lastModified && <span>Modified: <strong style={{ color: colors.black }}>{fmtDate(plan.lastModified)}</strong></span>}
            {plan.published && <span>Published: <strong style={{ color: colors.black }}>{fmtDate(plan.published)}</strong></span>}
            {plan.parties.length > 0 && <span>Author: <strong style={{ color: colors.black }}>{plan.parties.join(", ")}</strong></span>}
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: colors.surfaceMuted, borderRadius: 4, padding: "5px 8px" }}>
            <IcoSearch size={13} style={{ color: colors.gray }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
              style={{ border: "none", background: "transparent", outline: "none", flex: 1, fontSize: 12, fontFamily: fonts.sans, color: colors.black }} />
          </div>

          {hCtrl && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: colors.orange, fontWeight: 600, fontFamily: fonts.mono }}>
              <IcoShield size={10} style={{ color: colors.orange }} />
              Filtering: {hCtrl}
              <button onClick={() => setHCtrl("")} style={{ background: "none", border: "none", cursor: "pointer", color: colors.orange, fontSize: 12, padding: 0, marginLeft: 2 }}>✕</button>
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", borderBottom: `1px solid ${colors.bg}` }}>
          {(["activities", "tasks"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setPage(null); }} style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 12,
              fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
              color: mode === m ? colors.navy : colors.gray,
              borderBottom: mode === m ? `2px solid ${colors.orange}` : "2px solid transparent",
              background: "transparent", fontFamily: fonts.sans, minHeight: 44,
            }}>
              {m === "activities" ? <><IcoAct size={12} /> Activities</> : <><IcoTask size={12} /> Tasks</>}
            </button>
          ))}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {mode === "activities" && (
            <>
              <NavItem label="Overview" sublabel={`${stats.totalSteps} total steps`}
                isActive={false} onClick={() => navigate(null)} icon={<IcoHome size={14} />} />
              {filteredActivities.map((a) => (
                <NavItem key={a.uuid} label={a.title} isActive={false}
                  stepCount={a.steps.length}
                  onClick={() => navigate({ type: "activity", uuid: a.uuid })}
                  icon={<IcoAct size={14} />} />
              ))}
            </>
          )}
          {mode === "tasks" && (
            <>
              {filteredTasks.map((t) => (
                <NavItem key={t.uuid} label={t.title}
                  sublabel={[t.type, t.timing].filter(Boolean).join(" · ")}
                  isActive={false}
                  stepCount={t.associatedActivities.reduce((n, a) => n + a.steps.length, 0)}
                  onClick={() => navigate({ type: "task", uuid: t.uuid })}
                  icon={<IcoTask size={14} />} />
              ))}
              {filteredTasks.length === 0 && (
                <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: colors.gray }}>No tasks found</div>
              )}
            </>
          )}
        </div>

        {/* Controls nav */}
        <CtrlPanel allControls={allControls} onClick={() => navigate({ type: "controls" })} isActive={false} />
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <div style={S.shell}>
      {resolverModalEl}
      {/* Top bar */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>OSCAL Assessment Plan Viewer</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.topBtn} onClick={handleNewFile}>New File</button>
        </div>
      </div>

      <div style={S.body}>
        {/* SIDEBAR */}
        <nav style={S.sidebar}>
          {/* Plan title & compact stats */}
          <div style={{ padding: "12px 14px 8px", borderBottom: `1px solid ${colors.bg}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, fontFamily: fonts.sans, marginBottom: 2 }}>
              {trunc(plan.title, 40)}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 10, color: colors.gray, fontFamily: fonts.sans, marginBottom: 6 }}>
              {plan.version && <span>Version: <strong style={{ color: colors.black }}>{plan.version}</strong></span>}
              {plan.oscalVersion && <span>OSCAL: <strong style={{ color: colors.black }}>{plan.oscalVersion}</strong></span>}
              {plan.lastModified && <span>Modified: <strong style={{ color: colors.black }}>{fmtDate(plan.lastModified)}</strong></span>}
              {plan.published && <span>Published: <strong style={{ color: colors.black }}>{fmtDate(plan.published)}</strong></span>}
              {plan.parties.length > 0 && <span>Author: <strong style={{ color: colors.black }}>{plan.parties.join(", ")}</strong></span>}
            </div>

            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: colors.surfaceMuted, borderRadius: 4, padding: "5px 8px" }}>
              <IcoSearch size={13} style={{ color: colors.gray }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                style={{
                  border: "none", background: "transparent", outline: "none", flex: 1,
                  fontSize: 12, fontFamily: fonts.sans, color: colors.black,
                }}
              />
            </div>

            {/* Control filter indicator */}
            {hCtrl && (
              <div style={{
                marginTop: 6, display: "flex", alignItems: "center", gap: 4,
                fontSize: 10, color: colors.orange, fontWeight: 600, fontFamily: fonts.mono,
              }}>
                <IcoShield size={10} style={{ color: colors.orange }} />
                Filtering: {hCtrl}
                <button onClick={() => setHCtrl("")} style={{
                  background: "none", border: "none", cursor: "pointer", color: colors.orange, fontSize: 12, padding: 0, marginLeft: 2,
                }}>
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div style={{ display: "flex", borderBottom: `1px solid ${colors.bg}` }}>
            {(["activities", "tasks"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setPage(null); }} style={{
                flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontSize: 11,
                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                color: mode === m ? colors.navy : colors.gray,
                borderBottom: mode === m ? `2px solid ${colors.orange}` : "2px solid transparent",
                background: "transparent", fontFamily: fonts.sans,
              }}>
                {m === "activities" ? <><IcoAct size={12} /> Activities</> : <><IcoTask size={12} /> Tasks</>}
              </button>
            ))}
          </div>

          {/* Nav items */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {mode === "activities" && (
              <>
                <NavItem
                  label="Overview"
                  sublabel={`${stats.totalSteps} total steps`}
                  isActive={page === null}
                  onClick={() => navigate(null)}
                  icon={<IcoHome size={14} />}
                />
                {filteredActivities.map((a) => (
                  <NavItem
                    key={a.uuid}
                    label={a.title}
                    isActive={page?.type === "activity" && page.uuid === a.uuid}
                    stepCount={a.steps.length}
                    onClick={() => navigate({ type: "activity", uuid: a.uuid })}
                    icon={<IcoAct size={14} />}
                  />
                ))}
              </>
            )}
            {mode === "tasks" && (
              <>
                {filteredTasks.map((t) => (
                  <NavItem
                    key={t.uuid}
                    label={t.title}
                    sublabel={[t.type, t.timing].filter(Boolean).join(" · ")}
                    isActive={page?.type === "task" && page.uuid === t.uuid}
                    stepCount={t.associatedActivities.reduce((n, a) => n + a.steps.length, 0)}
                    onClick={() => navigate({ type: "task", uuid: t.uuid })}
                    icon={<IcoTask size={14} />}
                  />
                ))}
                {filteredTasks.length === 0 && (
                  <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: colors.gray }}>
                    No tasks found
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls panel */}
          <CtrlPanel allControls={allControls} onClick={() => navigate({ type: "controls" })} isActive={page?.type === "controls"} />
        </nav>

        {/* CONTENT */}
        <div ref={contentRef} style={S.content}>
          {page === null && (
            <OverviewView
              plan={plan} stats={stats}
              hCtrl={hCtrl} onCtrl={onCtrl}
              onSelectActivity={(uuid) => navigate({ type: "activity", uuid })}
            />
          )}
          {page?.type === "activity" && curActivity && (
            <ActivityView
              activity={curActivity} planTitle={plan.title}
              hCtrl={hCtrl} onCtrl={onCtrl} onHome={() => navigate(null)}
              catalog={catalog}
            />
          )}
          {page?.type === "task" && curTask && (
            <TaskView
              task={curTask} planTitle={plan.title}
              hCtrl={hCtrl} onCtrl={onCtrl} onHome={() => navigate(null)}
              catalog={catalog}
            />
          )}
          {page?.type === "controls" && (
            <ControlsView
              plan={plan} allControls={allControls} catalog={catalog}
              hCtrl={hCtrl} onCtrl={onCtrl} onHome={() => navigate(null)}
              onSelectActivity={(uuid) => navigate({ type: "activity", uuid })}
            />
          )}
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
    width: 280, minWidth: 280, backgroundColor: colors.card,
    borderRight: `1px solid ${colors.paleGray}`, overflowY: "auto" as const, flexShrink: 0,
    display: "flex", flexDirection: "column" as const,
  },
  content: { flex: 1, overflowY: "auto" as const, padding: 24 },
};
