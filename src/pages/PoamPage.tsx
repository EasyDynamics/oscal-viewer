/* ═══════════════════════════════════════════════════════════════════════════
   POA&M Page — SPA-style viewer for OSCAL Plan of Action and Milestones
   Left sidebar treeview (POAM Items → Risks → Findings → Observations)
   Right content panel with overview, detail, and drill-down views
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
import { alpha, colors, fonts, shadows, radii, brand } from "../theme/tokens";
import { useOscal } from "../context/OscalContext";
import LinkChips from "../components/LinkChips";
import type { ResolvedLink } from "../components/LinkChips";

/* ═══════════════════════════════════════════════════════════════════════════
   OSCAL POA&M TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface OscalProp {
  name: string;
  value: string;
  ns?: string;
  class?: string;
}

interface OscalLink {
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
  "responsible-parties"?: { "role-id": string; "party-uuids": string[] }[];
  revisions?: {
    title?: string;
    version?: string;
    "last-modified"?: string;
    "oscal-version"?: string;
    links?: OscalLink[];
    remarks?: string;
  }[];
}

interface Observation {
  uuid: string;
  title: string;
  description: string;
  methods: string[];
  types?: string[];
  collected: string;
  expires?: string;
  remarks?: string;
  props?: OscalProp[];
  links?: OscalLink[];
  subjects?: { "subject-uuid": string; type: string }[];
  origins?: { actors: { type: string; "actor-uuid": string }[] }[];
  "relevant-evidence"?: { href: string; description?: string }[];
}

interface Facet {
  name: string;
  system: string;
  value: string;
}

interface Characterization {
  origin: { actors: { type: string; "actor-uuid": string }[] };
  facets: Facet[];
}

interface MitigatingFactor {
  uuid: string;
  description: string;
  links?: OscalLink[];
}

interface Task {
  uuid: string;
  type: string;
  title: string;
  description: string;
  timing?: {
    "within-date-range"?: { start: string; end: string };
    "on-date"?: { date: string };
  };
}

interface Remediation {
  uuid: string;
  lifecycle: string;
  title: string;
  description: string;
  props?: OscalProp[];
  tasks?: Task[];
}

interface Risk {
  uuid: string;
  title: string;
  description: string;
  statement: string;
  status: string;
  characterizations?: Characterization[];
  "mitigating-factors"?: MitigatingFactor[];
  deadline?: string;
  remediations?: Remediation[];
  "related-observations"?: { "observation-uuid": string }[];
  props?: OscalProp[];
  links?: OscalLink[];
}

interface FindingTarget {
  type: string;
  "target-id": string;
  status?: {
    state: string;
    reason?: string;
    remarks?: string;
  };
}

interface Finding {
  uuid: string;
  title: string;
  description: string;
  target?: FindingTarget;
  "related-observations"?: { "observation-uuid": string }[];
  "related-risks"?: { "risk-uuid": string }[];
  props?: OscalProp[];
  links?: OscalLink[];
}

interface PoamItem {
  uuid: string;
  title: string;
  description: string;
  props?: OscalProp[];
  "related-findings"?: { "finding-uuid": string }[];
  "related-observations"?: { "observation-uuid": string }[];
  "related-risks"?: { "risk-uuid": string }[];
  links?: OscalLink[];
}

interface Resource {
  uuid: string;
  title?: string;
  rlinks?: { href: string; "media-type"?: string }[];
  remarks?: string;
}

interface Poam {
  uuid: string;
  metadata: Metadata;
  "import-ssp"?: { href: string };
  "system-id"?: { "identifier-type"?: string; id: string };
  observations?: Observation[];
  risks?: Risk[];
  findings?: Finding[];
  "poam-items": PoamItem[];
  "back-matter"?: { resources?: Resource[] };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const RISK_STATUS_COLORS: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  open:                  { bg: "#ffebee", fg: "#c62828", border: "#ef5350", label: "Open" },
  "deviation-approved":  { bg: "#fff3e0", fg: "#e65100", border: "#ff9800", label: "Deviation Approved" },
  remediating:           { bg: "#e3f2fd", fg: "#1565c0", border: "#42a5f5", label: "Remediating" },
  closed:                { bg: "#e8f5e9", fg: "#2e7d32", border: "#4caf50", label: "Closed" },
};

const FINDING_STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  satisfied:             { bg: "#e8f5e9", fg: "#2e7d32", border: "#4caf50" },
  "not-satisfied":       { bg: "#ffebee", fg: "#c62828", border: "#ef5350" },
};

const FACET_COLORS: Record<string, { bg: string; fg: string }> = {
  low:      { bg: "#e8f5e9", fg: "#2e7d32" },
  moderate: { bg: "#fff3e0", fg: "#e65100" },
  high:     { bg: "#ffebee", fg: "#c62828" },
  critical: { bg: "#880e4f", fg: "#ffffff" },
};

function fmtDate(s?: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}

function fmtDateTime(s?: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "\u2026" : s;
}

function getProp(props: OscalProp[] | undefined, name: string): string {
  return props?.find((p) => p.name === name)?.value ?? "";
}

/** Check if a deadline is overdue */
function isOverdue(deadline?: string): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

/** Days until or since a date (negative = overdue) */
function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
function IcoAlert({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function IcoClipboard({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>;
}
function IcoSearch({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}
function IcoChev({ open, style }: { open: boolean; style?: CSSProperties }) {
  return (
    <svg style={{ ...style, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform .15s", flexShrink: 0 }}
      width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IcoExternalLink({ size = 14, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
}
function IcoTarget({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
}
function IcoEye({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function IcoCalendar({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
function IcoCheckCircle({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}
function IcoFlag({ size = 16, style }: IconProps) {
  return <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PoamPage() {
  const oscal = useOscal();
  const poam = (oscal.poam?.data as Poam) ?? null;
  const fileName = oscal.poam?.fileName ?? "";
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

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
        const data = json["plan-of-action-and-milestones"] ?? json;
        if (!data.metadata) throw new Error("Not an OSCAL POA&M — no metadata found.");
        if (!data["poam-items"] || !Array.isArray(data["poam-items"]))
          throw new Error("Not an OSCAL POA&M — no poam-items array found.");
        oscal.setPoam(data as Poam, file.name);
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
    oscal.clearPoam();
    setError("");
    setView("overview");
    setSearchTerm("");
  }, [oscal]);

  /* ── Lookup maps ── */
  const obsMap = useMemo(() => {
    const m: Record<string, Observation> = {};
    (poam?.observations ?? []).forEach((o) => { m[o.uuid] = o; });
    return m;
  }, [poam]);

  const riskMap = useMemo(() => {
    const m: Record<string, Risk> = {};
    (poam?.risks ?? []).forEach((r) => { m[r.uuid] = r; });
    return m;
  }, [poam]);

  const findingMap = useMemo(() => {
    const m: Record<string, Finding> = {};
    (poam?.findings ?? []).forEach((f) => { m[f.uuid] = f; });
    return m;
  }, [poam]);

  const resMap = useMemo(() => {
    const m: Record<string, Resource> = {};
    (poam?.["back-matter"]?.resources ?? []).forEach((r) => { m[r.uuid] = r; });
    return m;
  }, [poam]);

  /* ── Risk status counts ── */
  const riskStatusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    (poam?.risks ?? []).forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [poam]);

  /* ── Default collapsed state ── */
  const defaultCollapsed = useMemo(() => {
    const dc: Record<string, boolean> = {};
    dc["sec-poam-items"] = false;
    dc["sec-risks"] = false;
    dc["sec-findings"] = (poam?.findings ?? []).length === 0;
    dc["sec-observations"] = true;
    return dc;
  }, [poam]);

  const mergedCollapsed = useMemo(() => ({ ...defaultCollapsed, ...collapsed }), [defaultCollapsed, collapsed]);

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => {
      const current = prev[id] ?? defaultCollapsed[id] ?? false;
      return { ...prev, [id]: !current };
    });
  }, [defaultCollapsed]);

  /* ── Filter items by search ── */
  const lowerSearch = searchTerm.toLowerCase().trim();

  const filteredPoamItems = useMemo(() => {
    if (!poam) return [];
    if (!lowerSearch) return poam["poam-items"];
    return poam["poam-items"].filter((pi) =>
      pi.title.toLowerCase().includes(lowerSearch) ||
      pi.description.toLowerCase().includes(lowerSearch) ||
      getProp(pi.props, "poam-id").toLowerCase().includes(lowerSearch)
    );
  }, [poam, lowerSearch]);

  const filteredRisks = useMemo(() => {
    if (!poam) return [];
    if (!lowerSearch) return poam.risks ?? [];
    return (poam.risks ?? []).filter((r) =>
      r.title.toLowerCase().includes(lowerSearch) ||
      r.description.toLowerCase().includes(lowerSearch) ||
      r.status.toLowerCase().includes(lowerSearch)
    );
  }, [poam, lowerSearch]);

  const filteredFindings = useMemo(() => {
    if (!poam) return [];
    if (!lowerSearch) return poam.findings ?? [];
    return (poam.findings ?? []).filter((f) =>
      f.title.toLowerCase().includes(lowerSearch) ||
      f.description.toLowerCase().includes(lowerSearch)
    );
  }, [poam, lowerSearch]);

  const filteredObservations = useMemo(() => {
    if (!poam) return [];
    if (!lowerSearch) return poam.observations ?? [];
    return (poam.observations ?? []).filter((o) =>
      o.title.toLowerCase().includes(lowerSearch) ||
      o.description.toLowerCase().includes(lowerSearch)
    );
  }, [poam, lowerSearch]);

  /* ── If no file loaded, show drop zone ── */
  if (!poam) {
    return (
      <div style={S.emptyWrap}>
        <DropZone onFile={loadFile} error={error} />
      </div>
    );
  }

  return (
    <div style={S.shell}>
      {/* ── TOP BAR ── */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          <div style={S.topBarLogo}>{brand.logoText}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>
              OSCAL POA&amp;M Viewer
            </div>
            <div style={{ fontSize: 11, color: colors.paleGray }}>{brand.tagline}</div>
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
              placeholder="Search\u2026"
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

          {/* POAM Items section */}
          <SidebarSection
            id="sec-poam-items"
            label={`POA&M Items (${filteredPoamItems.length})`}
            icon={<IcoClipboard size={14} style={{ color: colors.red }} />}
            collapsed={!!mergedCollapsed["sec-poam-items"]}
            onToggle={() => toggleGroup("sec-poam-items")}
          >
            {filteredPoamItems.map((pi, i) => {
              const poamId = getProp(pi.props, "poam-id");
              const piViewId = `poam-${pi.uuid}`;
              return (
                <NavRow
                  key={pi.uuid}
                  id={piViewId}
                  label={poamId ? `${poamId}: ${trunc(pi.title, 28)}` : trunc(pi.title, 34)}
                  icon={<StatusDot color={colors.red} />}
                  active={view === piViewId}
                  onClick={() => navigate(piViewId)}
                  depth={1}
                />
              );
            })}
          </SidebarSection>

          {/* Risks section */}
          {(filteredRisks.length > 0 || !lowerSearch) && (
            <SidebarSection
              id="sec-risks"
              label={`Risks (${filteredRisks.length})`}
              icon={<IcoAlert size={14} style={{ color: "#e65100" }} />}
              collapsed={!!mergedCollapsed["sec-risks"]}
              onToggle={() => toggleGroup("sec-risks")}
            >
              {filteredRisks.map((risk) => {
                const rViewId = `risk-${risk.uuid}`;
                const sc = RISK_STATUS_COLORS[risk.status];
                return (
                  <NavRow
                    key={risk.uuid}
                    id={rViewId}
                    label={trunc(risk.title, 34)}
                    icon={<StatusDot color={sc?.border ?? colors.gray} />}
                    active={view === rViewId}
                    onClick={() => navigate(rViewId)}
                    depth={1}
                  />
                );
              })}
            </SidebarSection>
          )}

          {/* Findings section */}
          {(filteredFindings.length > 0 || !lowerSearch) && (poam.findings ?? []).length > 0 && (
            <SidebarSection
              id="sec-findings"
              label={`Findings (${filteredFindings.length})`}
              icon={<IcoTarget size={14} style={{ color: colors.cobalt }} />}
              collapsed={!!mergedCollapsed["sec-findings"]}
              onToggle={() => toggleGroup("sec-findings")}
            >
              {filteredFindings.map((finding) => {
                const fViewId = `finding-${finding.uuid}`;
                const state = finding.target?.status?.state;
                const fsc = FINDING_STATUS_COLORS[state ?? ""];
                return (
                  <NavRow
                    key={finding.uuid}
                    id={fViewId}
                    label={trunc(finding.title, 34)}
                    icon={<StatusDot color={fsc?.border ?? colors.cobalt} />}
                    active={view === fViewId}
                    onClick={() => navigate(fViewId)}
                    depth={1}
                  />
                );
              })}
            </SidebarSection>
          )}

          {/* Observations section */}
          {(filteredObservations.length > 0 || !lowerSearch) && (poam.observations ?? []).length > 0 && (
            <SidebarSection
              id="sec-observations"
              label={`Observations (${filteredObservations.length})`}
              icon={<IcoEye size={14} style={{ color: colors.brightBlue }} />}
              collapsed={!!mergedCollapsed["sec-observations"]}
              onToggle={() => toggleGroup("sec-observations")}
            >
              {filteredObservations.map((obs) => {
                const oViewId = `obs-${obs.uuid}`;
                return (
                  <NavRow
                    key={obs.uuid}
                    id={oViewId}
                    label={trunc(obs.title, 34)}
                    icon={<StatusDot color={colors.brightBlue} />}
                    active={view === oViewId}
                    onClick={() => navigate(oViewId)}
                    depth={1}
                  />
                );
              })}
            </SidebarSection>
          )}
        </nav>

        {/* ── CONTENT PANEL ── */}
        <div ref={contentRef} style={S.content}>
          <ViewRouter
            view={view}
            poam={poam}
            navigate={navigate}
            obsMap={obsMap}
            riskMap={riskMap}
            findingMap={findingMap}
            resMap={resMap}
            riskStatusCounts={riskStatusCounts}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAV ROW
   ═══════════════════════════════════════════════════════════════════════════ */

function NavRow({ id: _id, label, icon, active, onClick, depth, badge, statusColor }: {
  id: string; label: string; icon: ReactNode; active: boolean;
  onClick: () => void; depth: number; badge?: number;
  statusColor?: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        ...S.navItem,
        paddingLeft: 12 + depth * 16,
        backgroundColor: active ? alpha(colors.red, 7) : "transparent",
        borderLeft: active ? `3px solid ${colors.red}` : statusColor ? `3px solid ${statusColor}` : "3px solid transparent",
        fontWeight: active ? 600 : 400,
        color: active ? colors.red : colors.black,
      }}
    >
      {icon}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {badge != null && <span style={S.badge}>{badge}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR SECTION — collapsible group header
   ═══════════════════════════════════════════════════════════════════════════ */

function SidebarSection({ id: _id, label, icon, collapsed, onToggle, children }: {
  id: string; label: string; icon: ReactNode;
  collapsed: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          ...S.navItem,
          paddingLeft: 12,
          fontWeight: 600,
          fontSize: 12,
          color: colors.navy,
          backgroundColor: `${colors.bg}`,
          cursor: "pointer",
        }}
      >
        <IcoChev open={!collapsed} style={{ marginRight: 4, color: colors.gray }} />
        {icon}
        <span style={{ flex: 1 }}>{label}</span>
      </div>
      {!collapsed && children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS DOT
   ═══════════════════════════════════════════════════════════════════════════ */

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      backgroundColor: color, flexShrink: 0,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW ROUTER
   ═══════════════════════════════════════════════════════════════════════════ */

interface ViewRouterProps {
  view: string;
  poam: Poam;
  navigate: (id: string) => void;
  obsMap: Record<string, Observation>;
  riskMap: Record<string, Risk>;
  findingMap: Record<string, Finding>;
  resMap: Record<string, Resource>;
  riskStatusCounts: Record<string, number>;
}

function ViewRouter({ view, poam, navigate, obsMap, riskMap, findingMap, resMap, riskStatusCounts }: ViewRouterProps) {
  if (view === "overview")
    return <OverviewView poam={poam} navigate={navigate} riskStatusCounts={riskStatusCounts} obsMap={obsMap} riskMap={riskMap} findingMap={findingMap} />;
  if (view === "metadata")
    return <MetadataView poam={poam} navigate={navigate} resMap={resMap} />;

  // poam-<uuid>
  if (view.startsWith("poam-")) {
    const uuid = view.slice(5);
    const item = poam["poam-items"].find((pi) => pi.uuid === uuid);
    if (item) return <PoamItemView item={item} navigate={navigate} obsMap={obsMap} riskMap={riskMap} findingMap={findingMap} />;
  }

  // risk-<uuid>
  if (view.startsWith("risk-")) {
    const uuid = view.slice(5);
    const risk = (poam.risks ?? []).find((r) => r.uuid === uuid);
    if (risk) return <RiskView risk={risk} navigate={navigate} obsMap={obsMap} />;
  }

  // finding-<uuid>
  if (view.startsWith("finding-")) {
    const uuid = view.slice(8);
    const finding = (poam.findings ?? []).find((f) => f.uuid === uuid);
    if (finding) return <FindingView finding={finding} navigate={navigate} obsMap={obsMap} riskMap={riskMap} />;
  }

  // obs-<uuid>
  if (view.startsWith("obs-")) {
    const uuid = view.slice(4);
    const obs = (poam.observations ?? []).find((o) => o.uuid === uuid);
    if (obs) return <ObservationView obs={obs} navigate={navigate} />;
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

function RiskStatusBadge({ status }: { status: string }) {
  const sc = RISK_STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray, label: status };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: radii.pill,
      backgroundColor: sc.bg, color: sc.fg, border: `1px solid ${sc.border}`,
    }}>
      {sc.label}
    </span>
  );
}

function FindingStatusBadge({ state }: { state: string }) {
  const sc = FINDING_STATUS_COLORS[state] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: radii.pill,
      backgroundColor: sc.bg, color: sc.fg, border: `1px solid ${sc.border}`,
    }}>
      {state}
    </span>
  );
}

function FacetPill({ facet }: { facet: Facet }) {
  const fc = FACET_COLORS[facet.value] ?? { bg: colors.bg, fg: colors.gray };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: radii.pill,
      backgroundColor: fc.bg, color: fc.fg,
    }}>
      <span style={{ textTransform: "capitalize" }}>{facet.name}:</span>
      <span style={{ textTransform: "uppercase" }}>{facet.value}</span>
    </span>
  );
}

function DeadlineBadge({ deadline }: { deadline?: string }) {
  if (!deadline) return null;
  const overdue = isOverdue(deadline);
  const days = daysUntil(deadline);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: radii.pill,
      backgroundColor: overdue ? "#ffebee" : "#e3f2fd",
      color: overdue ? "#c62828" : "#1565c0",
    }}>
      <IcoCalendar size={11} />
      {fmtDate(deadline)}
      {overdue
        ? ` (${Math.abs(days)}d overdue)`
        : ` (${days}d remaining)`}
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
        <IcoAlert size={48} style={{ color: colors.red }} />
        <h2 style={{ fontSize: 22, color: colors.navy, marginTop: 12 }}>OSCAL POA&amp;M Viewer</h2>
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
          Drop an OSCAL <strong>Plan of Action &amp; Milestones</strong> JSON file here
        </p>
        <p style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>or click to browse</p>
        {error && <p style={{ marginTop: 12, fontSize: 13, color: colors.red, fontWeight: 500 }}>{error}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW VIEW — dashboard with stats, risk breakdown, timeline
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewView({ poam, navigate, riskStatusCounts, obsMap, riskMap, findingMap }: {
  poam: Poam; navigate: (id: string) => void;
  riskStatusCounts: Record<string, number>;
  obsMap: Record<string, Observation>;
  riskMap: Record<string, Risk>;
  findingMap: Record<string, Finding>;
}) {
  const items = poam["poam-items"];
  const risks = poam.risks ?? [];
  const findings = poam.findings ?? [];
  const observations = poam.observations ?? [];

  // Gather all milestones for timeline
  const milestones = useMemo(() => {
    const ms: { title: string; riskTitle: string; riskUuid: string; start?: string; end?: string; date?: string }[] = [];
    risks.forEach((r) => {
      (r.remediations ?? []).forEach((rem) => {
        (rem.tasks ?? []).forEach((t) => {
          ms.push({
            title: t.title,
            riskTitle: r.title,
            riskUuid: r.uuid,
            start: t.timing?.["within-date-range"]?.start,
            end: t.timing?.["within-date-range"]?.end ?? t.timing?.["on-date"]?.date,
            date: t.timing?.["on-date"]?.date,
          });
        });
      });
    });
    ms.sort((a, b) => {
      const aDate = a.end ?? a.date ?? "";
      const bDate = b.end ?? b.date ?? "";
      return aDate.localeCompare(bDate);
    });
    return ms;
  }, [risks]);

  const overdueRisks = risks.filter((r) => r.status !== "closed" && isOverdue(r.deadline));

  return (
    <div>
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoAlert size={22} style={{ color: colors.red }} />
        <h1 style={{ fontSize: 20, color: colors.navy, margin: 0 }}>{poam.metadata.title}</h1>
      </div>
      <div style={{ fontSize: 12, color: colors.gray, marginBottom: 20 }}>
        {poam.metadata.version && <span>Version {poam.metadata.version} &middot; </span>}
        OSCAL {poam.metadata["oscal-version"]} &middot; Last modified {fmtDate(poam.metadata["last-modified"])}
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="POA&M Items" value={items.length} color={colors.red} />
        <StatCard label="Risks" value={risks.length} color="#e65100" />
        <StatCard label="Findings" value={findings.length} color={colors.cobalt} />
        <StatCard label="Observations" value={observations.length} color={colors.brightBlue} />
        {overdueRisks.length > 0 && (
          <StatCard label="Overdue" value={overdueRisks.length} color="#c62828" />
        )}
      </div>

      {/* Risk Status Summary */}
      {risks.length > 0 && (
        <Card>
          <SectionLabel>Risk Status Summary</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {Object.entries(riskStatusCounts).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => {
              const sc = RISK_STATUS_COLORS[status] ?? { bg: colors.bg, fg: colors.gray, border: colors.gray, label: status };
              return (
                <div key={status} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                  borderRadius: radii.md, backgroundColor: sc.bg, border: `1px solid ${sc.border}`, minWidth: 130,
                }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: sc.fg }}>{count}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: sc.fg }}>{sc.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* POA&M Items Quick Nav */}
      <Card>
        <SectionLabel>POA&amp;M Items ({items.length})</SectionLabel>
        {items.map((pi) => {
          const poamId = getProp(pi.props, "poam-id");
          const relRisks = (pi["related-risks"] ?? []).map((rr) => riskMap[rr["risk-uuid"]]).filter(Boolean);
          const relFindings = (pi["related-findings"] ?? []).map((rf) => findingMap[rf["finding-uuid"]]).filter(Boolean);
          const relObs = (pi["related-observations"] ?? []).map((ro) => obsMap[ro["observation-uuid"]]).filter(Boolean);

          return (
            <div
              key={pi.uuid}
              onClick={() => navigate(`poam-${pi.uuid}`)}
              style={{
                padding: "12px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {poamId && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.red, color: colors.white }}>{poamId}</span>}
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{pi.title}</span>
              </div>
              <div style={{ fontSize: 12, color: colors.gray, marginBottom: 6 }}>{trunc(pi.description, 120)}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {relRisks.map((r) => (
                  <RiskStatusBadge key={r.uuid} status={r.status} />
                ))}
                {relFindings.map((f) => (
                  <span key={f.uuid} style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.pill, backgroundColor: alpha(colors.cobalt, 8), color: colors.cobalt, fontWeight: 600 }}>
                    {f.target?.["target-id"]?.toUpperCase() ?? "Finding"}
                  </span>
                ))}
                {relObs.length > 0 && (
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.pill, backgroundColor: alpha(colors.brightBlue, 8), color: colors.brightBlue, fontWeight: 600 }}>
                    {relObs.length} observation{relObs.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Milestone Timeline */}
      {milestones.length > 0 && (
        <Card>
          <SectionLabel>Remediation Milestones ({milestones.length})</SectionLabel>
          <div style={{ position: "relative", paddingLeft: 20 }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, backgroundColor: colors.paleGray }} />
            {milestones.map((ms, i) => {
              const endDate = ms.end ?? ms.date ?? "";
              const overdue = endDate ? isOverdue(endDate) : false;
              return (
                <div key={i} style={{ position: "relative", marginBottom: 16, paddingLeft: 16 }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: "absolute", left: -17, top: 4, width: 10, height: 10, borderRadius: "50%",
                    backgroundColor: overdue ? colors.red : colors.cobalt, border: `2px solid ${colors.white}`,
                  }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{ms.title}</span>
                    {endDate && <DeadlineBadge deadline={endDate} />}
                  </div>
                  <div
                    onClick={() => navigate(`risk-${ms.riskUuid}`)}
                    style={{ fontSize: 11, color: colors.brightBlue, cursor: "pointer", marginTop: 2 }}
                  >
                    {trunc(ms.riskTitle, 70)}
                  </div>
                  {ms.start && ms.end && (
                    <div style={{ fontSize: 10, color: colors.gray, marginTop: 2 }}>
                      {fmtDate(ms.start)} → {fmtDate(ms.end)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Card style={{ borderTop: `3px solid ${color}`, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   METADATA VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function MetadataView({ poam, navigate, resMap }: { poam: Poam; navigate: (id: string) => void; resMap: Record<string, Resource> }) {
  const meta = poam.metadata;
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
          <MField label="Document UUID" value={poam.uuid} mono />
        </div>
      </Card>

      {/* System ID */}
      {poam["system-id"] && (
        <Card>
          <SectionLabel>System Identification</SectionLabel>
          <MField label="System ID" value={poam["system-id"].id} mono />
          {poam["system-id"]["identifier-type"] && (
            <MField label="Identifier Type" value={poam["system-id"]["identifier-type"]} mono />
          )}
        </Card>
      )}

      {/* Import SSP */}
      {poam["import-ssp"] && (
        <Card>
          <SectionLabel>Imported SSP</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IcoExternalLink size={13} style={{ color: colors.brightBlue }} />
            <span style={{ fontSize: 13, fontFamily: fonts.mono, color: colors.brightBlue }}>{poam["import-ssp"].href}</span>
          </div>
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

      {/* Revisions */}
      {meta.revisions && meta.revisions.length > 0 && (
        <Card>
          <SectionLabel>Revisions ({meta.revisions.length})</SectionLabel>
          {meta.revisions.map((rev, i) => (
            <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{rev.title ?? `Revision ${rev.version ?? i + 1}`}</div>
              <div style={{ fontSize: 11, color: colors.gray }}>
                {rev.version && `v${rev.version} · `}
                {fmtDate(rev["last-modified"])}
                {rev["oscal-version"] && ` · OSCAL ${rev["oscal-version"]}`}
              </div>
              {rev.remarks && <div style={{ fontSize: 12, color: colors.black, marginTop: 4 }}>{rev.remarks}</div>}
            </div>
          ))}
        </Card>
      )}

      {/* Back matter resources */}
      {poam["back-matter"]?.resources && poam["back-matter"].resources.length > 0 && (
        <Card>
          <SectionLabel>Back Matter Resources ({poam["back-matter"].resources.length})</SectionLabel>
          {poam["back-matter"].resources.map((res) => (
            <div key={res.uuid} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{res.title ?? "Untitled"}</div>
              <div style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{res.uuid}</div>
              {res.remarks && <div style={{ fontSize: 12, color: colors.black, marginTop: 4 }}>{res.remarks}</div>}
              {res.rlinks && res.rlinks.map((rl, j) => (
                <a key={j} href={rl.href} target="_blank" rel="noopener noreferrer"
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
   POAM ITEM VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function PoamItemView({ item, navigate, obsMap, riskMap, findingMap }: {
  item: PoamItem; navigate: (id: string) => void;
  obsMap: Record<string, Observation>; riskMap: Record<string, Risk>; findingMap: Record<string, Finding>;
}) {
  const poamId = getProp(item.props, "poam-id");
  const relRisks = (item["related-risks"] ?? []).map((rr) => riskMap[rr["risk-uuid"]]).filter(Boolean);
  const relFindings = (item["related-findings"] ?? []).map((rf) => findingMap[rf["finding-uuid"]]).filter(Boolean);
  const relObs = (item["related-observations"] ?? []).map((ro) => obsMap[ro["observation-uuid"]]).filter(Boolean);

  return (
    <div>
      <Breadcrumbs items={[
        { id: "overview", label: "Overview" },
        { id: `poam-${item.uuid}`, label: poamId || trunc(item.title, 40) },
      ]} navigate={navigate} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <IcoClipboard size={22} style={{ color: colors.red }} />
        <h1 style={{ fontSize: 18, color: colors.navy, margin: 0, lineHeight: 1.4 }}>{item.title}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {poamId && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: radii.pill, backgroundColor: colors.red, color: colors.white }}>{poamId}</span>}
        <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{item.uuid}</span>
      </div>

      {/* Description */}
      <Card style={{ borderLeft: `4px solid ${colors.red}` }}>
        <SectionLabel>Description</SectionLabel>
        <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{item.description}</div>
      </Card>

      {/* Properties */}
      {item.props && item.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {item.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} />)}
          </div>
        </Card>
      )}

      {/* Related Risks */}
      {relRisks.length > 0 && (
        <Card>
          <SectionLabel>Related Risks ({relRisks.length})</SectionLabel>
          {relRisks.map((risk) => (
            <div
              key={risk.uuid}
              onClick={() => navigate(`risk-${risk.uuid}`)}
              style={{ padding: "10px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <RiskStatusBadge status={risk.status} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{risk.title}</span>
              </div>
              <div style={{ fontSize: 12, color: colors.gray }}>{trunc(risk.description, 120)}</div>
              {risk.deadline && (
                <div style={{ marginTop: 4 }}>
                  <DeadlineBadge deadline={risk.deadline} />
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Related Findings */}
      {relFindings.length > 0 && (
        <Card>
          <SectionLabel>Related Findings ({relFindings.length})</SectionLabel>
          {relFindings.map((finding) => (
            <div
              key={finding.uuid}
              onClick={() => navigate(`finding-${finding.uuid}`)}
              style={{ padding: "10px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {finding.target?.status?.state && <FindingStatusBadge state={finding.target.status.state} />}
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{finding.title}</span>
              </div>
              <div style={{ fontSize: 12, color: colors.gray }}>{trunc(finding.description, 120)}</div>
            </div>
          ))}
        </Card>
      )}

      {/* Related Observations */}
      {relObs.length > 0 && (
        <Card>
          <SectionLabel>Related Observations ({relObs.length})</SectionLabel>
          {relObs.map((obs) => (
            <div
              key={obs.uuid}
              onClick={() => navigate(`obs-${obs.uuid}`)}
              style={{ padding: "10px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IcoEye size={14} style={{ color: colors.brightBlue }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{obs.title}</span>
                <span style={{ fontSize: 11, color: colors.gray }}>{fmtDate(obs.collected)}</span>
              </div>
              <div style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>{trunc(obs.description, 120)}</div>
            </div>
          ))}
        </Card>
      )}

      {/* Links */}
      {item.links && item.links.length > 0 && <LinksCard links={item.links} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RISK VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function RiskView({ risk, navigate, obsMap }: {
  risk: Risk; navigate: (id: string) => void; obsMap: Record<string, Observation>;
}) {
  const relObs = (risk["related-observations"] ?? []).map((ro) => obsMap[ro["observation-uuid"]]).filter(Boolean);
  const facets = risk.characterizations?.flatMap((c) => c.facets) ?? [];

  return (
    <div>
      <Breadcrumbs items={[
        { id: "overview", label: "Overview" },
        { id: `risk-${risk.uuid}`, label: trunc(risk.title, 50) },
      ]} navigate={navigate} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <IcoAlert size={22} style={{ color: RISK_STATUS_COLORS[risk.status]?.border ?? colors.gray }} />
        <h1 style={{ fontSize: 18, color: colors.navy, margin: 0, lineHeight: 1.4 }}>{risk.title}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <RiskStatusBadge status={risk.status} />
        <DeadlineBadge deadline={risk.deadline} />
        <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{risk.uuid}</span>
      </div>

      {/* Description */}
      <Card style={{ borderLeft: `4px solid ${RISK_STATUS_COLORS[risk.status]?.border ?? colors.gray}` }}>
        <SectionLabel>Description</SectionLabel>
        <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{risk.description}</div>
      </Card>

      {/* Risk Statement */}
      <Card>
        <SectionLabel>Risk Statement</SectionLabel>
        <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{risk.statement}</div>
      </Card>

      {/* Risk Characterization (Facets) */}
      {facets.length > 0 && (
        <Card>
          <SectionLabel>Risk Characterization</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {facets.map((f, i) => <FacetPill key={i} facet={f} />)}
          </div>
        </Card>
      )}

      {/* Mitigating Factors */}
      {risk["mitigating-factors"] && risk["mitigating-factors"].length > 0 && (
        <Card>
          <SectionLabel>Mitigating Factors ({risk["mitigating-factors"].length})</SectionLabel>
          {risk["mitigating-factors"].map((mf) => (
            <div key={mf.uuid} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{mf.description}</div>
            </div>
          ))}
        </Card>
      )}

      {/* Remediations */}
      {risk.remediations && risk.remediations.length > 0 && (
        <Card>
          <SectionLabel>Remediations ({risk.remediations.length})</SectionLabel>
          {risk.remediations.map((rem) => {
            const remType = getProp(rem.props, "type");
            return (
              <div key={rem.uuid} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${colors.bg}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <IcoFlag size={14} style={{ color: colors.cobalt }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{rem.title}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: radii.pill,
                    backgroundColor: alpha(colors.cobalt, 8), color: colors.cobalt, textTransform: "capitalize",
                  }}>
                    {rem.lifecycle}
                  </span>
                  {remType && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: radii.pill,
                      backgroundColor: alpha(colors.orange, 8), color: colors.orange, textTransform: "capitalize",
                    }}>
                      {remType}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75, marginBottom: 10 }}>{rem.description}</div>

                {/* Milestones / Tasks */}
                {rem.tasks && rem.tasks.length > 0 && (
                  <div style={{ paddingLeft: 16, borderLeft: `3px solid ${alpha(colors.cobalt, 13)}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.cobalt, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Milestones ({rem.tasks.length})
                    </div>
                    {rem.tasks.map((task) => {
                      const endDate = task.timing?.["within-date-range"]?.end ?? task.timing?.["on-date"]?.date;
                      return (
                        <div key={task.uuid} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${colors.bg}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <IcoCheckCircle size={14} style={{ color: colors.cobalt }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{task.title}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: alpha(colors.brightBlue, 8), color: colors.brightBlue }}>
                              {task.type}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: colors.black, lineHeight: 1.6, marginBottom: 4 }}>{task.description}</div>
                          {task.timing && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {task.timing["within-date-range"] && (
                                <span style={{ fontSize: 11, color: colors.gray }}>
                                  {fmtDate(task.timing["within-date-range"].start)} → {fmtDate(task.timing["within-date-range"].end)}
                                </span>
                              )}
                              {task.timing["on-date"] && (
                                <span style={{ fontSize: 11, color: colors.gray }}>
                                  Due: {fmtDate(task.timing["on-date"].date)}
                                </span>
                              )}
                              {endDate && <DeadlineBadge deadline={endDate} />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Related Observations */}
      {relObs.length > 0 && (
        <Card>
          <SectionLabel>Related Observations ({relObs.length})</SectionLabel>
          {relObs.map((obs) => (
            <div
              key={obs.uuid}
              onClick={() => navigate(`obs-${obs.uuid}`)}
              style={{ padding: "10px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IcoEye size={14} style={{ color: colors.brightBlue }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{obs.title}</span>
                <span style={{ fontSize: 11, color: colors.gray }}>{fmtDate(obs.collected)}</span>
              </div>
              <div style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>{trunc(obs.description, 120)}</div>
            </div>
          ))}
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
      {risk.links && risk.links.length > 0 && <LinksCard links={risk.links} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FINDING VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function FindingView({ finding, navigate, obsMap, riskMap }: {
  finding: Finding; navigate: (id: string) => void;
  obsMap: Record<string, Observation>; riskMap: Record<string, Risk>;
}) {
  const relObs = (finding["related-observations"] ?? []).map((ro) => obsMap[ro["observation-uuid"]]).filter(Boolean);
  const relRisks = (finding["related-risks"] ?? []).map((rr) => riskMap[rr["risk-uuid"]]).filter(Boolean);

  return (
    <div>
      <Breadcrumbs items={[
        { id: "overview", label: "Overview" },
        { id: `finding-${finding.uuid}`, label: trunc(finding.title, 50) },
      ]} navigate={navigate} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <IcoTarget size={22} style={{ color: colors.cobalt }} />
        <h1 style={{ fontSize: 18, color: colors.navy, margin: 0, lineHeight: 1.4 }}>{finding.title}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {finding.target?.status?.state && <FindingStatusBadge state={finding.target.status.state} />}
        {finding.target?.["target-id"] && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: radii.pill, backgroundColor: alpha(colors.cobalt, 8), color: colors.cobalt }}>
            {finding.target["target-id"].toUpperCase()}
          </span>
        )}
        <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{finding.uuid}</span>
      </div>

      {/* Description */}
      <Card style={{ borderLeft: `4px solid ${colors.cobalt}` }}>
        <SectionLabel>Description</SectionLabel>
        <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{finding.description}</div>
      </Card>

      {/* Target */}
      {finding.target && (
        <Card>
          <SectionLabel>Target</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <MField label="Type" value={finding.target.type} />
            <MField label="Target ID" value={finding.target["target-id"]?.toUpperCase() ?? "—"} />
            {finding.target.status && (
              <>
                <MField label="State" value={finding.target.status.state} />
                {finding.target.status.reason && <MField label="Reason" value={finding.target.status.reason} />}
              </>
            )}
          </div>
          {finding.target.status?.remarks && (
            <div style={{ marginTop: 8 }}>
              <MField label="Remarks" value={finding.target.status.remarks} />
            </div>
          )}
        </Card>
      )}

      {/* Related Risks */}
      {relRisks.length > 0 && (
        <Card>
          <SectionLabel>Related Risks ({relRisks.length})</SectionLabel>
          {relRisks.map((risk) => (
            <div
              key={risk.uuid}
              onClick={() => navigate(`risk-${risk.uuid}`)}
              style={{ padding: "10px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RiskStatusBadge status={risk.status} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{risk.title}</span>
              </div>
              {risk.deadline && <div style={{ marginTop: 4 }}><DeadlineBadge deadline={risk.deadline} /></div>}
            </div>
          ))}
        </Card>
      )}

      {/* Related Observations */}
      {relObs.length > 0 && (
        <Card>
          <SectionLabel>Related Observations ({relObs.length})</SectionLabel>
          {relObs.map((obs) => (
            <div
              key={obs.uuid}
              onClick={() => navigate(`obs-${obs.uuid}`)}
              style={{ padding: "10px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IcoEye size={14} style={{ color: colors.brightBlue }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{obs.title}</span>
                <span style={{ fontSize: 11, color: colors.gray }}>{fmtDate(obs.collected)}</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Properties */}
      {finding.props && finding.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {finding.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} />)}
          </div>
        </Card>
      )}

      {/* Links */}
      {finding.links && finding.links.length > 0 && <LinksCard links={finding.links} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OBSERVATION VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function ObservationView({ obs, navigate }: {
  obs: Observation; navigate: (id: string) => void;
}) {
  return (
    <div>
      <Breadcrumbs items={[
        { id: "overview", label: "Overview" },
        { id: `obs-${obs.uuid}`, label: trunc(obs.title, 50) },
      ]} navigate={navigate} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <IcoEye size={22} style={{ color: colors.brightBlue }} />
        <h1 style={{ fontSize: 18, color: colors.navy, margin: 0, lineHeight: 1.4 }}>{obs.title}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {obs.methods.map((m) => (
          <span key={m} style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: radii.pill,
            backgroundColor: alpha(colors.brightBlue, 8), color: colors.brightBlue, textTransform: "uppercase",
          }}>
            {m}
          </span>
        ))}
        {obs.types?.map((t) => (
          <span key={t} style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: radii.pill,
            backgroundColor: alpha(colors.navy, 8), color: colors.navy,
          }}>
            {t}
          </span>
        ))}
        <span style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }}>{obs.uuid}</span>
      </div>

      {/* Description */}
      <Card style={{ borderLeft: `4px solid ${colors.brightBlue}` }}>
        <SectionLabel>Description</SectionLabel>
        <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75 }}>{obs.description}</div>
      </Card>

      {/* Details */}
      <Card>
        <SectionLabel>Details</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <MField label="Collected" value={fmtDateTime(obs.collected)} />
          {obs.expires && <MField label="Expires" value={fmtDateTime(obs.expires)} />}
          <MField label="Methods" value={obs.methods.join(", ")} />
          {obs.types && <MField label="Types" value={obs.types.join(", ")} />}
        </div>
      </Card>

      {/* Remarks */}
      {obs.remarks && (
        <Card>
          <SectionLabel>Remarks</SectionLabel>
          <div style={{ fontSize: 13, color: colors.black, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{obs.remarks}</div>
        </Card>
      )}

      {/* Relevant Evidence */}
      {obs["relevant-evidence"] && obs["relevant-evidence"].length > 0 && (
        <Card>
          <SectionLabel>Relevant Evidence ({obs["relevant-evidence"].length})</SectionLabel>
          {obs["relevant-evidence"].map((ev, i) => (
            <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${colors.bg}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <IcoExternalLink size={12} style={{ color: colors.brightBlue }} />
                <span style={{ fontSize: 12, fontFamily: fonts.mono, color: colors.brightBlue }}>{ev.href}</span>
              </div>
              {ev.description && <div style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>{ev.description}</div>}
            </div>
          ))}
        </Card>
      )}

      {/* Subjects */}
      {obs.subjects && obs.subjects.length > 0 && (
        <Card>
          <SectionLabel>Subjects ({obs.subjects.length})</SectionLabel>
          {obs.subjects.map((sub, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 6 }}>
              <MField label="Type" value={sub.type} />
              <MField label="Subject UUID" value={sub["subject-uuid"]} mono />
            </div>
          ))}
        </Card>
      )}

      {/* Properties */}
      {obs.props && obs.props.length > 0 && (
        <Card>
          <SectionLabel>Properties</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {obs.props.map((p, i) => <PropPill key={i} name={p.name} value={p.value} />)}
          </div>
        </Card>
      )}

      {/* Links */}
      {obs.links && obs.links.length > 0 && <LinksCard links={obs.links} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LINKS CARD — resolves resource-fragment and renders LinkChips
   ═══════════════════════════════════════════════════════════════════════════ */

function LinksCard({ links }: { links: OscalLink[] }) {
  const chips: ResolvedLink[] = links.map((lk) => {
    const frag = lk["resource-fragment"];
    const baseText = lk.text ?? lk.href;
    const text = frag ? `${baseText} \u2014 ${frag}` : baseText;
    const baseHref = lk.href.startsWith("#") ? undefined : lk.href;
    const href = baseHref && frag ? `${baseHref}#${frag}` : baseHref;
    return { text, href, rel: lk.rel };
  });
  if (chips.length === 0) return null;
  return (
    <Card>
      <LinkChips links={chips} />
    </Card>
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
    backgroundColor: colors.red,
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
    backgroundColor: colors.red,
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
