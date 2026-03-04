/* ═══════════════════════════════════════════════════════════════════════════
   Assessment Plan Page — SPA-style viewer
   Left sidebar nav · Right content panel · Activity & Task views
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
import { colors, fonts, radii, shadows } from "../theme/tokens";
import { useOscal } from "../context/OscalContext";
import LinkChips from "../components/LinkChips";

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
  criticality: string;
  links: OscalLink[];
}

interface ActivityParsed {
  uuid: string;
  title: string;
  description: string;
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
      style={{ fontSize: 13, color: colors.black, lineHeight: 1.75, ...style }}
      dangerouslySetInnerHTML={{ __html: renderMarkup(raw) }}
    />
  );
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
    steps: (a.steps || []).map((s: any) => {
      const props: OscalProp[] = s.props || [];
      const method = props.find((p: OscalProp) => p.name === "method")?.value ?? "EXAMINE";
      const criticality = props.find((p: OscalProp) => p.name === "criticality")?.value ?? "MAY";
      const controls: string[] = (s["reviewed-controls"]?.["control-selections"] || [])
        .flatMap((sel: any) =>
          (sel["control-id-selections"] || sel["with-ids"] || []).map((c: any) =>
            typeof c === "string" ? c : c["control-id"] ?? c,
          ),
        );
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
        criticality: criticality.toUpperCase(),
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
function IcoDown({ size = 14, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CRITICALITY & METHOD STYLING
   ═══════════════════════════════════════════════════════════════════════════ */

const CRIT: Record<string, { bg: string; text: string; border: string }> = {
  SHALL:  { bg: "#FFF0E6", text: "#CC5200", border: colors.orange },
  SHOULD: { bg: "#E8F0FE", text: colors.navy, border: colors.cobalt },
  MAY:    { bg: "#F0F0F0", text: "#555", border: colors.gray },
};
const METH: Record<string, { bg: string; text: string }> = {
  EXAMINE:   { bg: "#E6F3F0", text: colors.darkGreen },
  INTERVIEW: { bg: "#F0E8FE", text: colors.purple },
  TEST:      { bg: "#FFF8E6", text: "#8B6914" },
};

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
      background: active ? "#FFF0E6" : "#EEF2F8",
      color: active ? colors.orange : colors.navy,
      cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", lineHeight: "18px",
    }}>
      <IcoShield size={10} />{control}
    </button>
  );
}

function CritTag({ v }: { v: string }) {
  const c = CRIT[v] || CRIT.MAY;
  return (
    <span style={{
      display: "inline-block", padding: "1px 8px", borderRadius: 3,
      fontSize: 10, fontWeight: 700, fontFamily: fonts.sans, letterSpacing: "0.05em",
      background: c.bg, color: c.text, borderLeft: `3px solid ${c.border}`,
    }}>
      {v}
    </span>
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
        <IcoShield size={48} style={{ color: colors.purple }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>OSCAL Assessment Plan Viewer</h2>
        <p style={{ fontSize: 14, color: colors.gray, marginTop: 4 }}>Easy Dynamics — Client-Side Viewer</p>
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
          Drop an OSCAL <strong>Assessment Plan</strong> JSON file here
        </p>
        <p style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>or click to browse</p>
        {error && <p style={{ marginTop: 12, fontSize: 13, color: colors.red, fontWeight: 500 }}>{error}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function StepCard({ step, index, hCtrl, onCtrl }: {
  step: StepParsed; index: number; hCtrl: string; onCtrl: (c: string) => void;
}) {
  const hit = hCtrl && step.controls.includes(hCtrl);
  return (
    <div style={{
      background: hit ? "#FFFAF5" : "#fff",
      borderLeft: `3px solid ${hit ? colors.orange : colors.paleGray}`,
      padding: "10px 14px", transition: "all 0.15s",
      borderBottom: "1px solid #EEEEF2",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: colors.gray, fontWeight: 600, fontFamily: fonts.mono, minWidth: 22 }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono, color: colors.navy, whiteSpace: "nowrap" }}>
          {step.title}
        </span>
        <CritTag v={step.criticality} />
        <MethTag v={step.method} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "flex-end" }}>
          {step.controls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
        </div>
      </div>
      {step.description && (
        <MarkupBlock value={step.description} style={{ margin: "0 0 0 30px", fontSize: 12.5, lineHeight: 1.45 }} />
      )}
      {step.remarks && (
        <p style={{ fontSize: 11.5, color: colors.blueGray, lineHeight: 1.4, margin: "4px 0 0 30px", fontFamily: fonts.sans, fontStyle: "italic" }}>
          {step.remarks}
        </p>
      )}
      {step.links.length > 0 && (
        <LinkChips
          links={step.links.map((l) => ({
            text: l.text || (l.rel === "mitre" ? (l.href.split("/").pop() ?? l.href) : "Reference"),
            href: l.href,
            rel: l.rel || undefined,
          }))}
          label={null}
          style={{ marginTop: 5, marginLeft: 30 }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP LIST
   ═══════════════════════════════════════════════════════════════════════════ */

function StepList({ activity, hCtrl, onCtrl }: {
  activity: ActivityParsed; hCtrl: string; onCtrl: (c: string) => void;
}) {
  return (
    <div style={{ border: "1px solid #E2E4EA", borderRadius: "0 0 8px 8px", overflow: "hidden", borderTop: "none" }}>
      {activity.steps.map((step, i) => (
        <StepCard key={step.uuid} step={step} index={i} hCtrl={hCtrl} onCtrl={onCtrl} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVITY HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

function ActivityHeader({ activity, hCtrl, onCtrl }: {
  activity: ActivityParsed; hCtrl: string; onCtrl: (c: string) => void;
}) {
  const shallN = activity.steps.filter((s) => s.criticality === "SHALL").length;
  const shouldN = activity.steps.filter((s) => s.criticality === "SHOULD").length;
  const ctrls = [...new Set(activity.steps.flatMap((s) => s.controls))].sort();
  return (
    <>
      <div style={{
        background: colors.navy, color: "#fff", padding: "12px 18px",
        borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.sans, margin: 0 }}>{activity.title}</h2>
          {activity.description && (
            <p style={{ fontSize: 12, opacity: 0.7, margin: "2px 0 0", fontFamily: fonts.sans }}>{activity.description}</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 10.5, fontWeight: 600, fontFamily: fonts.mono, flexShrink: 0 }}>
          <span style={{ background: "rgba(255,255,255,0.12)", padding: "2px 8px", borderRadius: 3 }}>{activity.steps.length} steps</span>
          <span style={{ background: "rgba(255,102,0,0.25)", color: colors.orange, padding: "2px 8px", borderRadius: 3 }}>{shallN} SHALL</span>
          {shouldN > 0 && <span style={{ background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 3, opacity: 0.7 }}>{shouldN} SHOULD</span>}
        </div>
      </div>
      <div style={{
        background: "#EEF2F8", padding: "6px 18px", display: "flex", flexWrap: "wrap",
        gap: 4, alignItems: "center", borderBottom: `2px solid ${colors.orange}`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: colors.gray, marginRight: 6, fontFamily: fonts.sans }}>
          Controls:
        </span>
        {ctrls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVITY SUBHEADER (lightweight, for task page)
   ═══════════════════════════════════════════════════════════════════════════ */

function ActivitySubheader({ activity, hCtrl, onCtrl }: {
  activity: ActivityParsed; hCtrl: string; onCtrl: (c: string) => void;
}) {
  const shallN = activity.steps.filter((s) => s.criticality === "SHALL").length;
  const shouldN = activity.steps.filter((s) => s.criticality === "SHOULD").length;
  const ctrls = [...new Set(activity.steps.flatMap((s) => s.controls))].sort();
  return (
    <>
      <div style={{
        background: "#fff", padding: "10px 18px", borderRadius: "8px 8px 0 0",
        border: "1px solid #E2E4EA", borderBottom: "none",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <IcoAct size={14} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy, fontFamily: fonts.sans }}>{activity.title}</span>
        </div>
        <div style={{ display: "flex", gap: 6, fontSize: 10, fontWeight: 600, fontFamily: fonts.mono, flexShrink: 0 }}>
          <span style={{ background: "#EEF2F8", color: colors.navy, padding: "2px 7px", borderRadius: 3 }}>{activity.steps.length} steps</span>
          <span style={{ background: CRIT.SHALL.bg, color: CRIT.SHALL.text, padding: "2px 7px", borderRadius: 3 }}>{shallN} SHALL</span>
          {shouldN > 0 && <span style={{ background: CRIT.SHOULD.bg, color: CRIT.SHOULD.text, padding: "2px 7px", borderRadius: 3 }}>{shouldN} SHOULD</span>}
        </div>
      </div>
      <div style={{
        background: "#F8F9FB", padding: "6px 18px", display: "flex", flexWrap: "wrap",
        gap: 4, alignItems: "center",
        borderLeft: "1px solid #E2E4EA", borderRight: "1px solid #E2E4EA",
        borderBottom: `2px solid ${colors.orange}`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: colors.gray, marginRight: 6 }}>
          Controls:
        </span>
        {ctrls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
      </div>
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
      background: "#fff", borderRadius: 6, padding: "8px 16px", marginBottom: 16,
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

function CtrlPanel({ allControls, hCtrl, onCtrl }: {
  allControls: string[]; hCtrl: string; onCtrl: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid #EEEEF2" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px", border: "none", cursor: "pointer",
        background: open ? "#F4F5F7" : "transparent",
        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
        color: colors.navy, fontFamily: fonts.sans,
      }}>
        <span>Controls ({allControls.length})</span>
        {open ? <IcoDown size={12} /> : <IcoRight size={12} />}
      </button>
      {open && (
        <div style={{ padding: "4px 14px 10px", display: "flex", flexWrap: "wrap", gap: 3, maxHeight: 160, overflowY: "auto" }}>
          {allControls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW: OVERVIEW (landing page)
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewView({ plan, stats, allControls, hCtrl, onCtrl, onSelectActivity }: {
  plan: PlanParsed;
  stats: { totalActivities: number; totalSteps: number; shallCount: number; totalControls: number; totalTasks: number };
  allControls: string[];
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
            { v: stats.shallCount, l: "SHALL", c: colors.orange },
            { v: stats.totalControls, l: "Controls", c: colors.darkGreen },
            ...(stats.totalTasks > 0 ? [{ v: stats.totalTasks, l: "Tasks", c: colors.purple }] : []),
          ].map((s) => (
            <div key={s.l} style={{ textAlign: "center", background: "#F4F5F7", borderRadius: 6, padding: "8px 16px", minWidth: 72 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: colors.gray, marginBottom: 6 }}>
            Addressed Controls ({allControls.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {allControls.map((c) => <ControlBadge key={c} control={c} active={hCtrl === c} onClick={onCtrl} />)}
          </div>
        </div>
      </Card>

      {/* Activity cards */}
      {plan.activities.map((a) => {
        const shallN = a.steps.filter((s) => s.criticality === "SHALL").length;
        const shouldN = a.steps.filter((s) => s.criticality === "SHOULD").length;
        const ctrls = [...new Set(a.steps.flatMap((s) => s.controls))].sort();
        const matchCount = hCtrl ? a.steps.filter((s) => s.controls.includes(hCtrl)).length : 0;
        return (
          <div key={a.uuid} onClick={() => onSelectActivity(a.uuid)} style={{
            background: "#fff", borderRadius: 8,
            border: `1px solid ${matchCount > 0 ? colors.orange : colors.paleGray}`,
            padding: "14px 18px", marginBottom: 10, cursor: "pointer", transition: "all 0.15s",
            boxShadow: matchCount > 0 ? `0 0 0 1px ${colors.orange}22` : "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.navy, margin: 0, fontFamily: fonts.sans }}>{a.title}</h3>
                {a.description && (
                  <p style={{ fontSize: 12, color: colors.gray, margin: "2px 0 0", fontFamily: fonts.sans }}>{trunc(a.description, 120)}</p>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, fontSize: 10, fontWeight: 600, fontFamily: fonts.mono, flexShrink: 0 }}>
                <span style={{ background: "#EEF2F8", color: colors.navy, padding: "2px 7px", borderRadius: 3 }}>{a.steps.length} steps</span>
                <span style={{ background: CRIT.SHALL.bg, color: CRIT.SHALL.text, padding: "2px 7px", borderRadius: 3 }}>{shallN} SHALL</span>
                {shouldN > 0 && <span style={{ background: CRIT.SHOULD.bg, color: CRIT.SHOULD.text, padding: "2px 7px", borderRadius: 3 }}>{shouldN} SHOULD</span>}
                {matchCount > 0 && <span style={{ background: "#FFF0E6", color: colors.orange, padding: "2px 7px", borderRadius: 3, fontWeight: 700 }}>{matchCount} match{matchCount !== 1 ? "es" : ""}</span>}
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

function ActivityView({ activity, planTitle, hCtrl, onCtrl, onHome }: {
  activity: ActivityParsed; planTitle: string; hCtrl: string; onCtrl: (c: string) => void; onHome: () => void;
}) {
  return (
    <>
      <BreadcrumbHeader planTitle={planTitle} crumbs={[activity.title]} onHome={onHome} />
      <ActivityHeader activity={activity} hCtrl={hCtrl} onCtrl={onCtrl} />
      <StepList activity={activity} hCtrl={hCtrl} onCtrl={onCtrl} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW: TASK (timing + associated activities)
   ═══════════════════════════════════════════════════════════════════════════ */

function TaskView({ task, planTitle, hCtrl, onCtrl, onHome }: {
  task: TaskParsed; planTitle: string; hCtrl: string; onCtrl: (c: string) => void; onHome: () => void;
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
          <StepList activity={act} hCtrl={hCtrl} onCtrl={onCtrl} />
        </div>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR NAV ITEM
   ═══════════════════════════════════════════════════════════════════════════ */

function NavItem({ label, sublabel, isActive, stepCount, shallCount, onClick, icon }: {
  label: string; sublabel?: string; isActive: boolean; stepCount?: number; shallCount?: number;
  onClick: () => void; icon: ReactNode;
}) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", cursor: "pointer",
      background: isActive ? "rgba(0,40,104,0.08)" : "transparent",
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
          <span style={{ fontSize: 9.5, fontWeight: 600, background: "#EEF2F8", color: colors.navy, padding: "1px 5px", borderRadius: 2, fontFamily: fonts.mono }}>
            {stepCount} steps
          </span>
          {(shallCount ?? 0) > 0 && (
            <span style={{ fontSize: 9.5, fontWeight: 600, background: CRIT.SHALL.bg, color: CRIT.SHALL.text, padding: "1px 5px", borderRadius: 2, fontFamily: fonts.mono }}>
              {shallCount} SHALL
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

type PageState = null | { type: "activity"; uuid: string } | { type: "task"; uuid: string };

export default function AssessmentPlanPage() {
  const oscal = useOscal();
  const raw = oscal.assessmentPlan?.data ?? null;

  const [error, setError] = useState("");
  const [hCtrl, setHCtrl] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"activities" | "tasks">("activities");
  const [page, setPage] = useState<PageState>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  /* ── Derived data ── */
  const allControls = useMemo(() => {
    if (!plan) return [];
    return [...new Set(plan.activities.flatMap((a) => a.steps.flatMap((s) => s.controls)))].sort();
  }, [plan]);

  const stats = useMemo(() => {
    if (!plan) return { totalActivities: 0, totalSteps: 0, shallCount: 0, totalControls: 0, totalTasks: 0 };
    const totalSteps = plan.activities.reduce((n, a) => n + a.steps.length, 0);
    const shallCount = plan.activities.reduce((n, a) => n + a.steps.filter((s) => s.criticality === "SHALL").length, 0);
    return {
      totalActivities: plan.activities.length,
      totalSteps,
      shallCount,
      totalControls: allControls.length,
      totalTasks: plan.tasks.length,
    };
  }, [plan, allControls]);

  /* ── Navigation ── */
  const navigate = useCallback((p: PageState) => {
    setPage(p);
    contentRef.current?.scrollTo(0, 0);
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
      (a) => a.title.toLowerCase().includes(q) || a.steps.some((s) => s.title.toLowerCase().includes(q) || s.controls.some((c) => c.toLowerCase().includes(q))),
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

  /* ── No data — show drop zone ── */
  if (!plan) {
    return (
      <div style={S.emptyWrap}>
        <DropZone onFile={loadFile} error={error} />
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <div style={S.shell}>
      {/* Top bar */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          <div style={S.topBarLogo}>ED</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>OSCAL Assessment Plan Viewer</div>
            <div style={{ fontSize: 11, color: colors.paleGray }}>Easy Dynamics</div>
          </div>
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
            <div style={{ fontSize: 10, color: colors.gray, fontFamily: fonts.mono, marginBottom: 8 }}>
              {plan.version && `v${plan.version}`}{plan.oscalVersion ? `  OSCAL ${plan.oscalVersion}` : ""}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {[
                { v: stats.totalActivities, l: "ACT.", c: colors.navy },
                { v: stats.totalSteps, l: "STEPS", c: colors.brightBlue },
                { v: stats.shallCount, l: "SHALL", c: colors.orange },
                { v: stats.totalControls, l: "CTRL", c: colors.darkGreen },
                ...(stats.totalTasks > 0 ? [{ v: stats.totalTasks, l: "TASKS", c: colors.purple }] : []),
              ].map((s) => (
                <div key={s.l} style={{
                  textAlign: "center", background: "#F4F5F7", borderRadius: 4, padding: "4px 8px", minWidth: 40, flex: 1,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 8, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F4F5F7", borderRadius: 4, padding: "5px 8px" }}>
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
                    shallCount={a.steps.filter((s) => s.criticality === "SHALL").length}
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
                    shallCount={t.associatedActivities.reduce((n, a) => n + a.steps.filter((s) => s.criticality === "SHALL").length, 0)}
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
          <CtrlPanel allControls={allControls} hCtrl={hCtrl} onCtrl={onCtrl} />
        </nav>

        {/* CONTENT */}
        <div ref={contentRef} style={S.content}>
          {page === null && (
            <OverviewView
              plan={plan} stats={stats} allControls={allControls}
              hCtrl={hCtrl} onCtrl={onCtrl}
              onSelectActivity={(uuid) => navigate({ type: "activity", uuid })}
            />
          )}
          {page?.type === "activity" && curActivity && (
            <ActivityView
              activity={curActivity} planTitle={plan.title}
              hCtrl={hCtrl} onCtrl={onCtrl} onHome={() => navigate(null)}
            />
          )}
          {page?.type === "task" && curTask && (
            <TaskView
              task={curTask} planTitle={plan.title}
              hCtrl={hCtrl} onCtrl={onCtrl} onHome={() => navigate(null)}
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
    width: 280, minWidth: 280, backgroundColor: colors.white,
    borderRight: `1px solid ${colors.paleGray}`, overflowY: "auto" as const, flexShrink: 0,
    display: "flex", flexDirection: "column" as const,
  },
  content: { flex: 1, overflowY: "auto" as const, padding: 24 },
};
