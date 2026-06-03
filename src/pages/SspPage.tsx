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
  type MouseEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { Marked } from "marked";
import { alpha, colors, fonts, radii, shadows, brand } from "../theme/tokens";
import { useOscal } from "../context/OscalContext";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { useUrlDocument, fileNameFromUrl } from "../hooks/useUrlDocument";
import { useAnalyticsView } from "../hooks/useAnalyticsView";
import { useOscalGraphResolver, type GraphResolverCachedTarget, type ResolvedOscalDocument } from "../hooks/useOscalGraphResolver";
import ResolverModal from "../components/ResolverModal";
import useIsMobile from "../hooks/useIsMobile";
import { useResizableSidebar } from "../hooks/useResizableSidebar";
import LinkChips from "../components/LinkChips";
import ArtifactModal, { type ArtifactItem } from "../components/ArtifactModal";
import { useLeveragedIndex, type LeveragedIndex } from "../hooks/useLeveragedIndex";
import { useCatalogSortIndex } from "../hooks/useCatalogSortIndex";
import { PartyCardGrid, PartyChip, ResponsiblePartiesList } from "../components/PartyDisplay";
import {
  IcoAlertTriangle,
  IcoBook,
  IcoBox,
  IcoChev,
  IcoClipboard,
  IcoCode,
  IcoCube,
  IcoDatabase,
  IcoExternalSystem,
  IcoFileCode,
  IcoFlame,
  IcoFolder,
  IcoFolderLayers,
  IcoFolderShieldLayers,
  IcoGuidance,
  IcoHardDrive,
  IcoHardware,
  IcoHome,
  IcoInfo,
  IcoInterconnection,
  IcoLayers,
  IcoLink,
  IcoMail,
  IcoNetwork,
  IcoPaperclip,
  IcoPhone,
  IcoPhysical,
  IcoPlan,
  IcoPolicy,
  IcoProcessProcedure,
  IcoRouter,
  IcoServer,
  IcoServerCog,
  IcoService,
  IcoShield,
  IcoShieldLayers,
  IcoSoftware,
  IcoStandard,
  IcoTag,
  IcoThisSystem,
  IcoUpload,
  IcoUserCog,
  IcoUsers,
  IcoValidation,
} from "../components/IconAliases";
import {
  assetTypeVisual,
  componentTypeVisual,
  findOscalProp,
  isCanonicalAssetType,
  oscalNamespaceProps as sharedOscalNamespaceProps,
  propDisplayName as sharedPropDisplayName,
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

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OscalProp { name: string; value: string; ns?: string; class?: string }

interface SspMetadata {
  title: string;
  version: string;
  oscalVersion: string;
  lastModified: string;
  published: string;
  parties: { uuid: string; name: string; type?: string; "short-name"?: string; links?: SspLink[] }[];
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

interface SspLink {
  href: string;
  rel?: string;
  text?: string;
  mediaType?: string;
  resourceFragment?: string;
}

interface SspComponent {
  uuid: string;
  type: string;
  title: string;
  description: string;
  status: string;
  props: OscalProp[];
  links: SspLink[];
  responsibleRoles: { roleId: string; partyUuids: string[] }[];
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
  remarks: string;
  href?: string;
  links: SspLink[];
}

interface ProvidedEntry {
  uuid: string;
  description: string;
  remarks: string;
  responsibleRoles: { roleId: string; partyUuids: string[] }[];
  props: OscalProp[];
  links: SspLink[];
}

interface ResponsibilityEntry {
  uuid: string;
  description: string;
  remarks: string;
  responsibleRoles: { roleId: string; partyUuids: string[] }[];
  props: OscalProp[];
  links: SspLink[];
  providedUuid?: string;
}

interface InheritedEntry {
  uuid: string;
  description: string;
  providedUuid?: string;
  responsibleRoles: { roleId: string; partyUuids: string[] }[];
}

interface SatisfiedEntry {
  uuid: string;
  description: string;
  responsibilityUuid?: string;
  responsibleRoles: { roleId: string; partyUuids: string[] }[];
  remarks: string;
}

interface ExportBlock {
  description: string;
  remarks: string;
  provided: ProvidedEntry[];
  responsibilities: ResponsibilityEntry[];
}

interface SetParameter {
  paramId: string;
  values: string[];
  remarks: string;
}

interface InformationType {
  uuid?: string;
  title: string;
  description: string;
  categorizations: { system: string; informationTypeIds: string[] }[];
  confidentialityImpact: { base: string; selected?: string };
  integrityImpact: { base: string; selected?: string };
  availabilityImpact: { base: string; selected?: string };
}

interface ByComponent {
  componentUuid: string;
  uuid: string;
  description: string;
  remarks: string;
  implementationStatus: string;
  export?: ExportBlock;
  inherited: InheritedEntry[];
  satisfied: SatisfiedEntry[];
  setParameters: SetParameter[];
  props: OscalProp[];
  links: SspLink[];
  responsibleRoles: { roleId: string; partyUuids: string[] }[];
}

interface SspStatement {
  statementId: string;
  uuid: string;
  description: string;
  remarks: string;
  byComponents: ByComponent[];
}

interface ImplementedRequirement {
  uuid: string;
  controlId: string;
  description: string;
  remarks: string;
  props: OscalProp[];
  setParameters: SetParameter[];
  statements: SspStatement[];
  byComponents: ByComponent[];
  responsibleRoles: { roleId: string; partyUuids: string[] }[];
  links: SspLink[];
}

interface SspDiagram {
  uuid?: string;
  title: string;
  description: string;
  props: OscalProp[];
  links: SspLink[];
}

interface SspBase64Content {
  filename?: string;
  mediaType?: string;
  value: string;
}

interface CharacteristicSection {
  description: string;
  diagrams: SspDiagram[];
}

interface SystemCharacteristics {
  systemName: string;
  systemNameShort: string;
  description: string;
  securitySensitivityLevel: string;
  systemIds: { id: string; identifierType?: string }[];
  securityImpactLevel: { objectiveConfidentiality: string; objectiveIntegrity: string; objectiveAvailability: string };
  status: { state: string; remarks?: string };
  authorizationBoundary: CharacteristicSection;
  networkArchitecture: CharacteristicSection;
  dataFlow: CharacteristicSection;
  informationTypes: InformationType[];
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
  base64?: SspBase64Content;
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

function parseRoles(arr: any[]): { roleId: string; partyUuids: string[] }[] {
  return (arr || []).map((rr: any) => ({
    roleId: rr["role-id"] || "", partyUuids: rr["party-uuids"] || [],
  }));
}

function parseLinks(arr: any[]): SspLink[] {
  return (arr || []).map((l: any) => ({
    href: l.href || "",
    rel: l.rel || undefined,
    text: l.text || undefined,
    mediaType: l["media-type"] || l.mediaType || undefined,
    resourceFragment: l["resource-fragment"] || l.resourceFragment || undefined,
  }));
}

function mediaTypeFromFilename(filename?: string): string | undefined {
  const lower = filename?.toLowerCase().split(/[?#]/)[0] ?? "";
  if (!lower) return undefined;
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return undefined;
}

function parseBase64Content(value: any): SspBase64Content | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return { value };
  const content = value.value || value.data || value.content || "";
  if (!content) return undefined;
  const filename = value.filename || value.name || value.title;
  const mediaType = value["media-type"] || value.mediaType || mediaTypeFromFilename(filename);
  return {
    filename,
    mediaType,
    value: content,
  };
}

function dataUrlFromBase64(base64: SspBase64Content, mediaTypeOverride?: string): string {
  const mediaType = base64.mediaType || mediaTypeOverride || "application/octet-stream";
  const value = base64.value.replace(/\s+/g, "");
  if (value.startsWith("data:")) return value;
  return `data:${mediaType};base64,${value}`;
}

function linkFromBase64(base64: SspBase64Content, text?: string, mediaTypeOverride?: string): SspLink {
  return {
    href: dataUrlFromBase64(base64, mediaTypeOverride),
    mediaType: base64.mediaType || mediaTypeOverride,
    text: text || base64.filename,
  };
}

function parseDiagrams(arr: any[]): SspDiagram[] {
  return (arr || []).map((d: any) => {
    const base64 = parseBase64Content(d.base64);
    return {
      uuid: d.uuid,
      title: d.title || d.caption || base64?.filename || "",
      description: txt(d.description),
      props: d.props || [],
      links: [...parseLinks([...(d.links || []), ...(d.rlinks || [])]), ...(base64 ? [linkFromBase64(base64, d.title || d.caption)] : [])],
    };
  });
}

function pickLeveragedHref(la: any): string | undefined {
  if (typeof la?.href === "string") return la.href;
  if (typeof la?.url === "string") return la.url;
  if (typeof la?.source === "string") return la.source;
  if (typeof la?.link?.href === "string") return la.link.href;

  const links = [...(la?.links || []), ...(la?.rlinks || [])];
  const semanticLink = links.find((l: any) => {
    const searchable = [l?.rel, l?.text, l?.title, l?.["media-type"], l?.mediaType]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return l?.href && (
      searchable.includes("ssp") ||
      searchable.includes("source") ||
      searchable.includes("provider") ||
      searchable.includes("authorization") ||
      searchable.includes("leveraged") ||
      searchable.includes("system-security-plan")
    );
  });
  if (semanticLink?.href) return semanticLink.href;

  const jsonLink = links.find((l: any) => String(l?.["media-type"] ?? l?.mediaType ?? "").toLowerCase().includes("json") && l?.href);
  if (jsonLink?.href) return jsonLink.href;

  if (links.length === 1 && typeof links[0]?.href === "string") return links[0].href;

  const prop = (la?.props || []).find((p: any) => {
    const name = String(p?.name ?? "").toLowerCase();
    return ["href", "url", "ssp-url", "source-url", "provider-ssp", "provider-ssp-url", "oscal-url"].includes(name) && typeof p?.value === "string";
  });
  if (prop?.value) return prop.value;

  const remarksUrl = txt(la?.remarks).match(/https?:\/\/\S+?\.json(?:[?#][^\s)]+)?/i);
  return remarksUrl?.[0];
}

function parseSetParams(arr: any[]): SetParameter[] {
  return (arr || []).map((sp: any) => ({
    paramId: sp["param-id"] || "",
    values: sp.values || [],
    remarks: txt(sp.remarks),
  }));
}

function parseByComp(bc: any): ByComponent {
  const exp = bc.export;
  return {
    componentUuid: bc["component-uuid"], uuid: bc.uuid,
    description: txt(bc.description),
    remarks: txt(bc.remarks),
    implementationStatus: bc["implementation-status"]?.state || "",
    export: exp ? {
      description: txt(exp.description),
      remarks: txt(exp.remarks),
      provided: (exp.provided || []).map((p: any) => ({
        uuid: p.uuid, description: txt(p.description), remarks: txt(p.remarks),
        responsibleRoles: parseRoles(p["responsible-roles"]),
        props: p.props || [], links: parseLinks(p.links),
      })),
      responsibilities: (exp.responsibilities || []).map((r: any) => ({
        uuid: r.uuid, description: txt(r.description), remarks: txt(r.remarks),
        responsibleRoles: parseRoles(r["responsible-roles"]),
        props: r.props || [], links: parseLinks(r.links),
        providedUuid: r["provided-uuid"],
      })),
    } : undefined,
    inherited: (bc.inherited || []).map((ih: any) => ({
      uuid: ih.uuid, description: txt(ih.description),
      providedUuid: ih["provided-uuid"],
      responsibleRoles: parseRoles(ih["responsible-roles"]),
    })),
    satisfied: (bc.satisfied || []).map((sat: any) => ({
      uuid: sat.uuid, description: txt(sat.description),
      responsibilityUuid: sat["responsibility-uuid"],
      responsibleRoles: parseRoles(sat["responsible-roles"]),
      remarks: txt(sat.remarks),
    })),
    setParameters: parseSetParams(bc["set-parameters"]),
    props: bc.props || [],
    links: parseLinks(bc.links),
    responsibleRoles: parseRoles(bc["responsible-roles"]),
  };
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
      uuid: p.uuid, name: p.name || "", type: p.type || "", "short-name": p["short-name"], links: p.links,
    })),
    roles: (md.roles || []).map((r: any) => ({ id: r.id, title: r.title || r.id })),
    responsibleParties: (md["responsible-parties"] || []).map((rp: any) => ({
      roleId: rp["role-id"], partyUuids: rp["party-uuids"] || [],
    })),
  };

  /* System Characteristics */
  const sc = ssp["system-characteristics"] || {};
  const sil = sc["security-impact-level"] || {};
  const authorizationBoundary = sc["authorization-boundary"] || {};
  const networkArchitecture = sc["network-architecture"] || {};
  const dataFlow = sc["data-flow"] || {};
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
    authorizationBoundary: { description: txt(authorizationBoundary.description), diagrams: parseDiagrams(authorizationBoundary.diagrams) },
    networkArchitecture: { description: txt(networkArchitecture.description), diagrams: parseDiagrams(networkArchitecture.diagrams) },
    dataFlow: { description: txt(dataFlow.description), diagrams: parseDiagrams(dataFlow.diagrams) },
    informationTypes: ((sc["system-information"]?.["information-types"]) || []).map((it: any) => ({
      uuid: it.uuid,
      title: it.title || "",
      description: txt(it.description),
      categorizations: (it.categorizations || []).map((cat: any) => ({
        system: cat.system || "", informationTypeIds: cat["information-type-ids"] || [],
      })),
      confidentialityImpact: { base: it["confidentiality-impact"]?.base || "", selected: it["confidentiality-impact"]?.selected },
      integrityImpact: { base: it["integrity-impact"]?.base || "", selected: it["integrity-impact"]?.selected },
      availabilityImpact: { base: it["availability-impact"]?.base || "", selected: it["availability-impact"]?.selected },
    })),
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
    links: parseLinks(c.links),
    responsibleRoles: parseRoles(c["responsible-roles"]),
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
    remarks: txt(la.remarks),
    href: pickLeveragedHref(la),
    links: parseLinks(la.links || la.rlinks),
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
    remarks: txt(ir.remarks),
    props: ir.props || [],
    statements: (ir.statements || []).map((st: any) => ({
      statementId: st["statement-id"] || "",
      uuid: st.uuid,
      description: txt(st.description),
      remarks: txt(st.remarks),
      byComponents: (st["by-components"] || []).map(parseByComp),
    })),
    setParameters: parseSetParams(ir["set-parameters"]),
    byComponents: (ir["by-components"] || []).map(parseByComp),
    responsibleRoles: parseRoles(ir["responsible-roles"]),
    links: parseLinks(ir.links),
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
    base64: parseBase64Content(r.base64),
  }));

  /* Import profile */
  const importProfileHref = ssp["import-profile"]?.href || "";

  return { metadata, systemCharacteristics, systemImplementation, controlImplementation, backMatter, importProfileHref };
}

function loadProviderSspFile(
  file: File,
  addLeveragedSsp: (data: unknown, fileName: string, sourceUrl?: string | null, boundLaUuid?: string) => void,
  onError?: (message: string) => void,
  boundLaUuid?: string,
) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target?.result as string);
      const inner = json["system-security-plan"] ?? json;
      if (!inner.metadata) throw new Error("Not a valid OSCAL SSP — missing metadata.");
      addLeveragedSsp(json, file.name, null, boundLaUuid);
      onError?.("");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to parse provider SSP JSON");
    }
  };
  reader.readAsText(file);
}

function chooseProviderSspFile(onFile: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onFile(file);
  };
  input.click();
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

/** Map a component type string to its nav icon key */
function componentTypeNavKey(type: string): string {
  return componentTypeVisual(type).iconKey;
}

/** Component-type color mapping */
function componentTypeColor(type: string): string {
  return componentTypeVisual(type).color;
}

function componentStatusIconKey(status: string): string {
  const lower = status.toLowerCase();
  if (lower === "operational") return "validation";
  if (lower === "under-development") return "plan";
  if (lower === "disposition") return "missing-control";
  return "info";
}

function componentStatusColor(status: string): string {
  const lower = status.toLowerCase();
  if (lower === "operational") return colors.darkGreen;
  if (lower === "under-development") return colors.orange;
  if (lower === "disposition") return colors.red;
  return colors.gray;
}

const OSCAL_NAMESPACE = "http://csrc.nist.gov/ns/oscal";

function oscalNamespaceProps(props: OscalProp[]): OscalProp[] {
  return sharedOscalNamespaceProps(props);
}

function findProp(props: OscalProp[], name: string): OscalProp | undefined {
  return findOscalProp(props, name);
}

function propDisplayName(prop: OscalProp): string {
  return sharedPropDisplayName(prop);
}

function riskColor(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("high")) return colors.red;
  if (lower.includes("moderate") || lower.includes("medium")) return colors.orange;
  if (lower.includes("low")) return colors.darkGreen;
  return colors.cobalt;
}

/** Resolve the best icon key and color for a component, checking OSCAL asset-type first. */
function componentIcon(comp: Pick<SspComponent, "type"> & { props?: OscalProp[] }): { iconKey: string; color: string; assetType?: string; localAssetType?: string } {
  return resolveComponentVisual(comp);
}

/** Resolve the best icon key and color for an inventory item, checking asset-type then component type */
function inventoryItemIcon(
  ii: InventoryItem,
  components: SspComponent[],
): { iconKey: string; color: string } {
  const assetType = findProp(ii.props, "asset-type")?.value;
  if (isCanonicalAssetType(assetType)) {
    const visual = assetTypeVisual(assetType);
    return { iconKey: visual.iconKey, color: visual.color };
  }
  // Fall back to the first implemented-component's type
  for (const ic of ii.implementedComponents) {
    const comp = components.find((c) => c.uuid === ic.componentUuid);
    if (comp) {
      const { iconKey, color } = componentIcon(comp);
      return { iconKey, color };
    }
  }
  return { iconKey: "box", color: colors.darkGreen };
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
    case "shield-layers": return <IcoShieldLayers size={size} style={st} />;
    case "shield": return <IcoShield size={size} style={st} />;
    case "users": return <IcoUsers size={size} style={st} />;
    case "clipboard": return <IcoClipboard size={size} style={st} />;
    case "book": return <IcoBook size={size} style={st} />;
    case "link": return <IcoLink size={size} style={st} />;
    case "box": return <IcoBox size={size} style={st} />;
    case "database": return <IcoDatabase size={size} style={st} />;
    case "file-code": return <IcoFileCode size={size} style={st} />;
    case "folder": return <IcoFolder size={size} style={st} />;
    case "folder-layers": return <IcoFolderLayers size={size} style={st} />;
    case "folder-shield-layers": return <IcoFolderShieldLayers size={size} style={st} />;
    case "tag": return <IcoTag size={size} style={st} />;
    case "this-system": return <IcoThisSystem size={size} style={st} />;
    case "ext-system": return <IcoExternalSystem size={size} style={st} />;
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
    case "missing-control": return <IcoAlertTriangle size={size} style={st} />;
    case "network": return <IcoNetwork size={size} style={st} />;
    case "operating-system": return <IcoServerCog size={size} style={st} />;
    case "web-server": return <IcoServer size={size} style={st} />;
    case "dns-server": return <IcoNetwork size={size} style={st} />;
    case "email-server": return <IcoMail size={size} style={st} />;
    case "directory-server": return <IcoUserCog size={size} style={st} />;
    case "pbx": return <IcoPhone size={size} style={st} />;
    case "firewall": return <IcoFlame size={size} style={st} />;
    case "router": return <IcoRouter size={size} style={st} />;
    case "switch": return <IcoNetwork size={size} style={st} />;
    case "storage-array": return <IcoHardDrive size={size} style={st} />;
    case "appliance": return <IcoHardware size={size} style={st} />;
    default: return <IcoBook size={size} style={st} />;
  }
}

/** Wraps a nav icon and overlays a small badge in the bottom-right (e.g., a
 *  green check to indicate a leveraged authorization has a loaded provider SSP). */
function NavIconWithBadge({ icon, color, badge, size = 14 }: { icon: string; color: string; badge?: "loaded"; size?: number }) {
  const inner = navIcon(icon, color, size);
  if (!badge) return <>{inner}</>;
  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0, lineHeight: 0 }}>
      {inner}
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: -3,
          bottom: -3,
          width: 9,
          height: 9,
          borderRadius: "50%",
          backgroundColor: colors.darkGreen,
          border: `1.5px solid ${colors.white}`,
          boxSizing: "content-box",
        }}
      />
    </span>
  );
}

function controlSourceIconKey(hasCurrent: boolean, hasProvider: boolean): string {
  if (hasCurrent && hasProvider) return "shield-layers";
  if (hasProvider) return "layers";
  if (hasCurrent) return "shield";
  return "missing-control";
}

function controlSourceColor(hasCurrent: boolean, hasProvider: boolean): string {
  if (hasCurrent) return colors.orange;
  if (hasProvider) return colors.purple;
  return colors.red;
}

function controlSourceTitle(hasCurrent: boolean, hasProvider: boolean): string {
  if (hasCurrent && hasProvider) return "Implemented by the current SSP and offered by a loaded provider SSP";
  if (hasProvider) return "Offered by a loaded provider SSP";
  if (hasCurrent) return "Implemented by the current SSP";
  return "Missing implementation statements in the current SSP";
}

function ControlSourceIcon({ hasCurrent, hasProvider, size = 14 }: { hasCurrent: boolean; hasProvider: boolean; size?: number }) {
  return <>{navIcon(controlSourceIconKey(hasCurrent, hasProvider), controlSourceColor(hasCurrent, hasProvider), size)}</>;
}

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

function MField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.gray, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: colors.black, fontFamily: mono ? fonts.mono : fonts.sans, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function VisualField({
  label, value, icon, color, mono, iconSize = 19, iconBoxSize = 34, minHeight = 70, valueSize = 14,
}: {
  label: string; value: string | number; icon: string; color: string; mono?: boolean; iconSize?: number; iconBoxSize?: number; minHeight?: number; valueSize?: number;
}) {
  if (value === "" || value == null) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
      borderRadius: radii.md, backgroundColor: alpha(color, 7), border: `1px solid ${alpha(color, 22)}`,
      minHeight,
    }}>
      <div style={{
        width: iconBoxSize, height: iconBoxSize, borderRadius: radii.sm, display: "inline-flex", alignItems: "center", justifyContent: "center",
        backgroundColor: alpha(color, 12), color,
      }}>
        {navIcon(icon, color, iconSize)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: colors.gray, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: valueSize, color: colors.navy, fontWeight: 800, fontFamily: mono ? fonts.mono : fonts.sans, wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: "center", background: colors.surfaceSubtle, borderRadius: 6, padding: "8px 16px", minWidth: 72 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const isImplemented = lower === "implemented";
  const isPartial = lower.includes("partial");
  const bg = isImplemented ? colors.successBg : isPartial ? colors.dangerBg : colors.surfaceSubtle;
  const fg = isImplemented ? colors.darkGreen : isPartial ? colors.dangerFg : colors.gray;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: radii.pill, backgroundColor: bg, color: fg }}>
      {status}
    </span>
  );
}

/** Component state badge (under-development, operational, disposition, other) */
function ComponentStateBadge({ state }: { state: string }) {
  const lower = state.toLowerCase();
  let bg: string, fg: string;
  if (lower === "operational") { bg = colors.successBg; fg = colors.darkGreen; }
  else if (lower === "under-development") { bg = colors.warningBg; fg = colors.orange; }
  else if (lower === "disposition") { bg = alpha(colors.red, 10); fg = colors.red; }
  else { bg = colors.surfaceSubtle; fg = colors.gray; }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: radii.pill, backgroundColor: bg, color: fg }}>
      Status: {state}
    </span>
  );
}

/** Implementation-status badge (implemented, partial, planned, alternative, not-applicable) */
function ImplStatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let bg: string, fg: string;
  if (lower === "implemented") { bg = colors.successBg; fg = colors.darkGreen; }
  else if (lower === "partial") { bg = colors.dangerBg; fg = colors.dangerFg; }
  else if (lower === "planned") { bg = alpha(colors.brightBlue, 10); fg = colors.brightBlue; }
  else if (lower === "alternative") { bg = alpha(colors.cobalt, 10); fg = colors.cobalt; }
  else if (lower === "not-applicable") { bg = colors.surfaceSubtle; fg = colors.blueGray; }
  else { bg = colors.surfaceSubtle; fg = colors.gray; }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: radii.pill, backgroundColor: bg, color: fg }}>
      Impl: {status}
    </span>
  );
}

const CONTROL_STATUS_ORDER = ["implemented", "satisfied-by-provider", "partial", "planned", "alternative", "not-applicable", "unspecified", "missing"] as const;
type KnownControlStatus = typeof CONTROL_STATUS_ORDER[number];
const SATISFIED_CONTROL_STATUSES = new Set(["implemented", "satisfied-by-provider"]);

interface StatusBucket {
  status: string;
  label: string;
  count: number;
  color: string;
  background: string;
  description: string;
}

interface FamilyStatusSummary {
  family: string;
  label: string;
  total: number;
  buckets: StatusBucket[];
}

interface ControlStatusDashboardSummary {
  totalControls: number;
  totalSspControls: number;
  totalComponents: number;
  totalStatements: number;
  totalByComponentEntries: number;
  isProfileScoped: boolean;
  controlBuckets: StatusBucket[];
  componentBuckets: StatusBucket[];
  familySummaries: FamilyStatusSummary[];
}

function statusLabel(status: string): string {
  if (!status) return "Unspecified";
  return status.split(/[-_\s]+/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function controlStatusMeta(status: string): { color: string; background: string; description: string } {
  const lower = status.toLowerCase();
  if (lower === "implemented") return { color: colors.darkGreen, background: colors.successBg, description: "The control is fully implemented." };
  if (lower === "satisfied-by-provider") return { color: colors.purple, background: alpha(colors.purple, 10), description: "The control is satisfied by a loaded leveraged authorization." };
  if (lower === "partial") return { color: colors.dangerFg, background: colors.dangerBg, description: "The control is partially implemented." };
  if (lower === "planned") return { color: colors.brightBlue, background: alpha(colors.brightBlue, 10), description: "A plan exists for implementing the control." };
  if (lower === "alternative") return { color: colors.cobalt, background: alpha(colors.cobalt, 10), description: "An alternative implementation is described." };
  if (lower === "not-applicable") return { color: colors.blueGray, background: colors.surfaceSubtle, description: "The control is justified as not applicable." };
  if (lower === "missing") return { color: colors.red, background: alpha(colors.red, 10), description: "The profile requires this control, but the SSP has no implementation statements." };
  if (lower === "unspecified") return { color: colors.gray, background: colors.surfaceSubtle, description: "No implementation status was found." };
  return { color: colors.purple, background: alpha(colors.purple, 10), description: "Locally defined implementation status." };
}

function statusSortValue(status: string): number {
  const idx = CONTROL_STATUS_ORDER.indexOf(status.toLowerCase() as KnownControlStatus);
  if (idx >= 0) return idx;
  if (status.toLowerCase() === "unspecified") return 999;
  return 100;
}

function isSatisfiedControlStatus(status: string): boolean {
  return SATISFIED_CONTROL_STATUSES.has(status.trim().toLowerCase());
}

function buildStatusBuckets(counts: Record<string, number>): StatusBucket[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([a, ac], [b, bc]) => statusSortValue(a) - statusSortValue(b) || bc - ac || a.localeCompare(b))
    .map(([status, count]) => {
      const meta = controlStatusMeta(status);
      return { status, label: statusLabel(status), count, ...meta };
    });
}

function collectImplementationStatuses(ir: ImplementedRequirement): string[] {
  return [
    ...ir.byComponents.map((bc) => bc.implementationStatus),
    ...ir.statements.flatMap((st) => st.byComponents.map((bc) => bc.implementationStatus)),
  ].map((status) => status.trim().toLowerCase()).filter(Boolean);
}

function rollupControlStatus(ir: ImplementedRequirement): string {
  const propStatus = ir.props.find((p) => p.name === "implementation-status")?.value?.trim().toLowerCase();
  if (propStatus) return propStatus;

  const statuses = collectImplementationStatuses(ir);
  if (statuses.length === 0) return "unspecified";
  const unique = [...new Set(statuses)];
  if (unique.length === 1) return unique[0];
  if (statuses.includes("partial")) return "partial";
  if (statuses.includes("implemented") && statuses.some((status) => status !== "implemented")) return "partial";
  if (statuses.includes("planned")) return "planned";
  if (statuses.includes("alternative")) return "alternative";
  if (statuses.includes("not-applicable")) return "not-applicable";
  return unique[0] ?? "unspecified";
}

function incrementCount(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function dashboardStatusForEntry(entry: ControlNavEntry, ir?: ImplementedRequirement): string {
  if (entry.hasCurrent && ir) return rollupControlStatus(ir);
  if (entry.hasProvider) return "satisfied-by-provider";
  return "missing";
}

function buildControlStatusDashboard(
  ssp: SspParsed,
  catalogSort: ReturnType<typeof useCatalogSortIndex>,
  leveragedIndex: LeveragedIndex,
  expectedControlIds: string[],
  isProfileLoaded: boolean,
): ControlStatusDashboardSummary {
  const controlCounts: Record<string, number> = {};
  const componentCounts: Record<string, number> = {};
  const familyCounts: Record<string, Record<string, number>> = {};
  let totalStatements = 0;
  let totalByComponentEntries = 0;
  const irById = new Map(ssp.controlImplementation.implementedRequirements.map((ir) => [ir.controlId, ir]));

  buildControlEntries(ssp, leveragedIndex, expectedControlIds).forEach((entry) => {
    const ir = irById.get(entry.controlId);
    const controlStatus = dashboardStatusForEntry(entry, ir);
    incrementCount(controlCounts, controlStatus);
    const family = getFamily(entry.controlId);
    familyCounts[family] ??= {};
    incrementCount(familyCounts[family], controlStatus);
  });

  ssp.controlImplementation.implementedRequirements.forEach((ir) => {
    totalStatements += ir.statements.length;
    const statuses = collectImplementationStatuses(ir);
    totalByComponentEntries += ir.byComponents.length + ir.statements.reduce((sum, st) => sum + st.byComponents.length, 0);
    if (statuses.length === 0) incrementCount(componentCounts, "unspecified");
    else statuses.forEach((status) => incrementCount(componentCounts, status));
  });

  const familySummaries = Object.entries(familyCounts)
    .map(([family, counts]) => ({
      family,
      label: FAMILY_NAMES[family] || family.toUpperCase(),
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      buckets: buildStatusBuckets(counts),
    }))
    .sort((a, b) => catalogSort.compare(a.family, b.family));

  return {
    totalControls: Object.values(controlCounts).reduce((sum, count) => sum + count, 0),
    totalSspControls: ssp.controlImplementation.implementedRequirements.length,
    totalComponents: ssp.systemImplementation.components.length,
    totalStatements,
    totalByComponentEntries,
    isProfileScoped: isProfileLoaded,
    controlBuckets: buildStatusBuckets(controlCounts),
    componentBuckets: buildStatusBuckets(componentCounts),
    familySummaries,
  };
}

function StatusDistributionBar({ buckets, total, height = 12 }: { buckets: StatusBucket[]; total: number; height?: number }) {
  if (total <= 0) return <div style={{ height, borderRadius: radii.pill, backgroundColor: colors.surfaceSubtle }} />;
  return (
    <div style={{ display: "flex", height, borderRadius: radii.pill, overflow: "hidden", backgroundColor: colors.surfaceSubtle }}>
      {buckets.map((bucket) => (
        <div
          key={bucket.status}
          title={`${bucket.label}: ${bucket.count}`}
          style={{ width: `${(bucket.count / total) * 100}%`, backgroundColor: bucket.color, minWidth: bucket.count > 0 ? 3 : 0 }}
        />
      ))}
    </div>
  );
}

function StatusDonut({ buckets, total, label = "Controls" }: { buckets: StatusBucket[]; total: number; label?: string }) {
  let cursor = 0;
  const segments = total > 0
    ? buckets.map((bucket) => {
        const start = cursor;
        cursor += (bucket.count / total) * 100;
        return `${bucket.color} ${start}% ${cursor}%`;
      }).join(", ")
    : colors.surfaceSubtle;

  return (
    <div style={{ position: "relative", width: 170, height: 170, flexShrink: 0 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: total > 0 ? `conic-gradient(${segments})` : colors.surfaceSubtle, boxShadow: shadows.sm }} />
      <div style={{ position: "absolute", inset: 26, borderRadius: "50%", backgroundColor: colors.card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: `inset 0 0 0 1px ${colors.paleGray}` }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: colors.navy, lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center" }}>{label}</div>
      </div>
    </div>
  );
}

function ControlStatusDashboard({ summary, navigate }: { summary: ControlStatusDashboardSummary; navigate: (id: string) => void }) {
  const satisfied = summary.controlBuckets.reduce((sum, bucket) => sum + (isSatisfiedControlStatus(bucket.status) ? bucket.count : 0), 0);
  const notSatisfied = summary.totalControls - satisfied;
  const implementationRate = summary.totalControls > 0 ? Math.round((satisfied / summary.totalControls) * 100) : 0;
  const progressColor = notSatisfied > 0 ? colors.orange : colors.darkGreen;
  const controlScopeLabel = summary.isProfileScoped ? "Profile Controls" : "SSP Controls";

  return (
    <Card>
      <SectionLabel>SSP Dashboard</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 22, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <StatusDonut buckets={summary.controlBuckets} total={summary.totalControls} label={controlScopeLabel} />
          <div style={{ minWidth: 180, flex: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: progressColor, lineHeight: 1 }}>{implementationRate}%</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.navy, marginTop: 3 }}>{controlScopeLabel.toLowerCase()} satisfied</div>
            <p style={{ fontSize: 12, color: colors.gray, lineHeight: 1.6, margin: "8px 0 0" }}>
              {summary.isProfileScoped
                ? `The ${summary.totalControls} total is the resolved profile requirement set. The current SSP contains ${summary.totalSspControls} implemented-requirement record${summary.totalSspControls === 1 ? "" : "s"}.`
                : "Rollup status is based on the current SSP implemented-requirement controls."} Only fully implemented controls and controls satisfied by a loaded leveraged authorization count as satisfied.
            </p>
          </div>
        </div>

        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
            <div style={{ padding: "10px 12px", borderRadius: radii.md, backgroundColor: alpha(colors.darkGreen, 7), border: `1px solid ${alpha(colors.darkGreen, 18)}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.darkGreen }}>{summary.totalComponents}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.6 }}>Components</div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: radii.md, backgroundColor: alpha(colors.orange, 7), border: `1px solid ${alpha(colors.orange, 18)}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.orange }}>{summary.totalSspControls}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.6 }}>SSP Controls</div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: radii.md, backgroundColor: alpha(colors.cobalt, 7), border: `1px solid ${alpha(colors.cobalt, 18)}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.cobalt }}>{summary.familySummaries.length}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.6 }}>Families</div>
            </div>
            <div style={{ padding: "10px 12px", borderRadius: radii.md, backgroundColor: alpha(colors.purple, 7), border: `1px solid ${alpha(colors.purple, 18)}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.purple }}>{summary.totalByComponentEntries}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: colors.gray, textTransform: "uppercase", letterSpacing: 0.6 }}>Impl Entries</div>
            </div>
          </div>

          <StatusDistributionBar buckets={summary.controlBuckets} total={summary.totalControls} height={14} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 12 }}>
            {summary.controlBuckets.map((bucket) => (
              <div key={bucket.status} style={{ padding: "8px 10px", borderRadius: radii.sm, backgroundColor: bucket.background, border: `1px solid ${alpha(bucket.color, 22)}` }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: bucket.color }}>{bucket.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: bucket.color }}>{bucket.count}</span>
                </div>
                <div style={{ fontSize: 10.5, color: colors.gray, lineHeight: 1.35 }}>{bucket.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {summary.familySummaries.length > 0 && (
        <div style={{ marginTop: 20, borderTop: `1px solid ${colors.paleGray}`, paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: colors.navy, textTransform: "uppercase", letterSpacing: 0.6 }}>Status by control family</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {summary.controlBuckets.map((bucket) => (
                <span key={bucket.status} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: colors.gray }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: bucket.color }} />{bucket.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {summary.familySummaries.map((family) => (
              <div key={family.family} onClick={() => navigate(`ctrl-family-${family.family}`)} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 210px) 1fr auto", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: radii.sm, backgroundColor: colors.bg, cursor: "pointer" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colors.navy }}>{family.family.toUpperCase()}</div>
                  <div style={{ fontSize: 10.5, color: colors.gray, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={family.label}>{family.label}</div>
                </div>
                <StatusDistributionBar buckets={family.buckets} total={family.total} height={10} />
                <span style={{ ...S.badge, marginLeft: 0 }}>{family.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.componentBuckets.length > 0 && (
        <div style={{ marginTop: 18, borderTop: `1px solid ${colors.paleGray}`, paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colors.navy, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Component implementation entries</div>
          <StatusDistributionBar buckets={summary.componentBuckets} total={summary.componentBuckets.reduce((sum, bucket) => sum + bucket.count, 0)} height={10} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {summary.componentBuckets.map((bucket) => (
              <span key={bucket.status} style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: radii.pill, backgroundColor: bucket.background, color: bucket.color }}>
                {bucket.label}: {bucket.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
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

interface SspProfileIncludeControl {
  "with-ids"?: string[];
  matching?: { pattern: string }[];
  "with-child-controls"?: "yes" | "no";
}

interface SspProfileImport {
  href?: string;
  "include-all"?: Record<string, never>;
  "include-controls"?: SspProfileIncludeControl[];
  "exclude-controls"?: SspProfileIncludeControl[];
}

interface SspProfileShape {
  imports?: SspProfileImport[];
  modify?: { alters?: { "control-id"?: string }[] };
}

function collectCatalogControlIds(catalog: OscalCatalog | null): string[] {
  if (!catalog) return [];
  const ids: string[] = [];
  const visitControl = (control: CatalogControl) => {
    ids.push(control.id);
    control.controls?.forEach(visitControl);
  };
  const visitGroup = (group: CatalogGroup) => {
    group.controls?.forEach(visitControl);
    group.groups?.forEach(visitGroup);
  };
  catalog.groups?.forEach(visitGroup);
  catalog.controls?.forEach(visitControl);
  return ids;
}

function childControlIds(catalog: OscalCatalog | null, controlId: string): string[] {
  const control = findCatalogControl(catalog, controlId);
  if (!control?.controls?.length) return [];
  const ids: string[] = [];
  const visit = (c: CatalogControl) => {
    ids.push(c.id);
    c.controls?.forEach(visit);
  };
  control.controls.forEach(visit);
  return ids;
}

function addProfileControlSelection(target: Set<string>, selection: SspProfileIncludeControl, catalog: OscalCatalog | null) {
  // Per OSCAL spec, the default for `with-child-controls` is "no" — child
  // controls (enhancements) are NOT included unless the profile explicitly opts in.
  const includeChildren = selection["with-child-controls"] === "yes";
  selection["with-ids"]?.forEach((id) => {
    target.add(id);
    if (includeChildren) childControlIds(catalog, id).forEach((childId) => target.add(childId));
  });
  selection.matching?.forEach(({ pattern }) => {
    try {
      const re = new RegExp(pattern, "i");
      collectCatalogControlIds(catalog).forEach((id) => {
        if (re.test(id)) target.add(id);
      });
    } catch {
      /* Ignore invalid profile regex patterns rather than breaking the viewer. */
    }
  });
}

function extractProfileControlIds(rawProfile: unknown, catalog: OscalCatalog | null): string[] {
  if (!rawProfile) return [];
  const wrapped = rawProfile as Record<string, unknown>;
  const profile = (wrapped.profile ?? wrapped) as SspProfileShape;
  if (!profile.imports?.length) return [];

  const ids = new Set<string>();
  if (profile.imports.some((imp) => imp["include-all"])) {
    collectCatalogControlIds(catalog).forEach((id) => ids.add(id));
  }

  profile.imports.forEach((imp) => {
    imp["include-controls"]?.forEach((selection) => addProfileControlSelection(ids, selection, catalog));
  });

  profile.imports.forEach((imp) => {
    imp["exclude-controls"]?.forEach((selection) => {
      const excluded = new Set<string>();
      addProfileControlSelection(excluded, selection, catalog);
      excluded.forEach((id) => ids.delete(id));
    });
  });

  if (ids.size === 0) {
    profile.modify?.alters?.forEach((alter) => {
      if (alter["control-id"]) ids.add(alter["control-id"]);
    });
  }

  return [...ids];
}

/** Returns the set of controls expected to be implemented by the SSP.
 *  - If a profile is loaded, the resolved profile control set is used (so controls
 *    excluded by the profile are not flagged as "missing").
 *  - Otherwise, fall back to all controls in the loaded catalog so that missing
 *    implementations are still surfaced.
 *  - When neither is loaded, returns an empty list. */
function getExpectedControlIds(rawProfile: unknown, catalog: OscalCatalog | null): string[] {
  if (rawProfile) return extractProfileControlIds(rawProfile, catalog);
  return collectCatalogControlIds(catalog);
}

function controlHasImplementation(ir?: ImplementedRequirement): boolean {
  if (!ir) return false;
  if (ir.byComponents.length > 0) return true;
  return ir.statements.some((st) => st.byComponents.length > 0);
}

function buildControlEntries(ssp: SspParsed, leveragedIndex: LeveragedIndex, profileControlIds: string[]): ControlNavEntry[] {
  const byId = new Map<string, ControlNavEntry>();
  const irById = new Map(ssp.controlImplementation.implementedRequirements.map((ir) => [ir.controlId, ir]));
  const addControl = (controlId: string, isExpected: boolean) => {
    const ir = irById.get(controlId);
    const existing = byId.get(controlId);
    const entry: ControlNavEntry = existing ?? {
      controlId,
      hasCurrent: false,
      hasProvider: false,
      attachmentCount: 0,
      isExpected: false,
      hasImplementationRecord: false,
    };
    entry.isExpected = entry.isExpected || isExpected;
    const alreadyHadImplementationRecord = entry.hasImplementationRecord;
    entry.hasImplementationRecord = entry.hasImplementationRecord || !!ir;
    entry.hasCurrent = entry.hasCurrent || controlHasImplementation(ir);
    entry.hasProvider = entry.hasProvider || leveragedIndex.byControl.has(controlId);
    if (ir && !alreadyHadImplementationRecord) entry.attachmentCount += countImplementationAttachments(ir, ssp.backMatter);
    byId.set(controlId, entry);
  };

  profileControlIds.forEach((id) => addControl(id, true));
  ssp.controlImplementation.implementedRequirements.forEach((ir) => addControl(ir.controlId, profileControlIds.includes(ir.controlId)));
  for (const controlId of leveragedIndex.byControl.keys()) addControl(controlId, profileControlIds.includes(controlId));
  return [...byId.values()];
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
    <span style={{ fontSize: 13, lineHeight: 1.75, color: colors.black, fontFamily: fonts.sans }}>
      {segments.map((segment, i) => {
        const match = segment.match(/\{\{\s*insert:\s*param\s*,\s*([^}]+?)\s*\}\}/);
        if (match) {
          const paramId = match[1].trim();
          const param = paramMap[paramId];
          const rendered = param ? renderCatalogParamText(param, paramMap) : `[Assignment: ${paramId}]`;
          const isSelection = param?.select != null;
          return (
            <span key={i} title={`Parameter: ${paramId}`} style={{
              display: "inline", fontSize: 13, fontFamily: fonts.mono, fontWeight: 600,
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
          backgroundColor: dragging ? colors.dropzoneBg : colors.card,
          cursor: "pointer", transition: "border-color .2s, background-color .2s",
          maxWidth: 520, margin: "0 auto",
        }}>
        <IcoUpload size={40} style={{ color: colors.gray }} />
        <p style={{ marginTop: 12, fontSize: 15, color: colors.black }}>
          Drop an OSCAL <strong>System Security Plan</strong> JSON file here
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
            placeholder="https://example.com/ssp.json"
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
  attachmentCount?: number;
  title?: string;
  /** Small overlay badge rendered on top of the main icon (e.g., "loaded"). */
  iconBadge?: "loaded";
}

interface ControlNavEntry {
  controlId: string;
  hasCurrent: boolean;
  hasProvider: boolean;
  attachmentCount: number;
  isExpected: boolean;
  hasImplementationRecord: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT HIERARCHY
   Components may reference other components via `provided-by`, `used-by`, or
   `depends-on` links. Those referenced components are displayed as children
   beneath the component in the tree. If a single component is referenced by
   multiple relationship types, `provided-by` wins, then `used-by`, then
   `depends-on`.
   ═══════════════════════════════════════════════════════════════════════════ */

const REL_PROVIDED_BY = "provided-by";
const REL_USED_BY = "used-by";
const REL_DEPENDS_ON = "depends-on";

/** Extract the UUID portion from a link href like "#uuid", "uuid", or "url#uuid". */
function hrefToUuid(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "";
  const hashIndex = trimmed.lastIndexOf("#");
  return hashIndex >= 0 ? trimmed.slice(hashIndex + 1) : trimmed;
}

function linkRel(link: SspLink): string {
  return (link.rel ?? "").trim().toLowerCase();
}

interface ComponentHierarchy {
  /** Top-level component indices, in original array order. */
  rootIndices: number[];
  /** Per-component children: child indices in original array order. */
  childrenByIndex: Map<number, number[]>;
}

function buildComponentHierarchy(components: SspComponent[]): ComponentHierarchy {
  const indexByUuid = new Map<string, number>();
  components.forEach((c, i) => indexByUuid.set(c.uuid, i));

  /* Pass 1 — claim by `provided-by` on service components. */
  const providedByOwner = new Map<number, number>(); // child idx -> parent idx
  components.forEach((c, parentIdx) => {
    if (c.type !== "service") return;
    c.links.forEach((l) => {
      if (linkRel(l) !== REL_PROVIDED_BY) return;
      const childIdx = indexByUuid.get(hrefToUuid(l.href));
      if (childIdx === undefined || childIdx === parentIdx) return;
      if (!providedByOwner.has(childIdx)) providedByOwner.set(childIdx, parentIdx);
    });
  });

  /* Pass 2 — claim by `used-by`, skipping any child already provided-by claimed. */
  const usedByOwner = new Map<number, number>();
  components.forEach((c, parentIdx) => {
    if (c.type !== "service") return;
    c.links.forEach((l) => {
      if (linkRel(l) !== REL_USED_BY) return;
      const childIdx = indexByUuid.get(hrefToUuid(l.href));
      if (childIdx === undefined || childIdx === parentIdx) return;
      if (providedByOwner.has(childIdx)) return; // conflict — provided-by wins
      if (!usedByOwner.has(childIdx)) usedByOwner.set(childIdx, parentIdx);
    });
  });

  /* Pass 3 — claim by `depends-on`, skipping children already claimed above. */
  const dependsOnOwner = new Map<number, number>();
  components.forEach((c, parentIdx) => {
    c.links.forEach((l) => {
      if (linkRel(l) !== REL_DEPENDS_ON) return;
      const childIdx = indexByUuid.get(hrefToUuid(l.href));
      if (childIdx === undefined || childIdx === parentIdx) return;
      if (providedByOwner.has(childIdx) || usedByOwner.has(childIdx)) return;
      if (!dependsOnOwner.has(childIdx)) dependsOnOwner.set(childIdx, parentIdx);
    });
  });

  const childrenByIndex = new Map<number, number[]>();
  const childOf = new Map<number, number>();
  providedByOwner.forEach((p, c) => childOf.set(c, p));
  usedByOwner.forEach((p, c) => { if (!childOf.has(c)) childOf.set(c, p); });
  dependsOnOwner.forEach((p, c) => { if (!childOf.has(c)) childOf.set(c, p); });

  childOf.forEach((parentIdx, childIdx) => {
    const arr = childrenByIndex.get(parentIdx) ?? [];
    arr.push(childIdx);
    childrenByIndex.set(parentIdx, arr);
  });
  // Sort children by original order
  childrenByIndex.forEach((arr) => arr.sort((a, b) => a - b));

  const rootIndices: number[] = [];
  components.forEach((_, i) => { if (!childOf.has(i)) rootIndices.push(i); });

  return { rootIndices, childrenByIndex };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PLACEHOLDER VIEWS
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewView({ ssp, leveragedIndex, navigate }: {
  ssp: SspParsed;
  leveragedIndex: LeveragedIndex;
  navigate: (id: string) => void;
}) {
  const oscal = useOscal();
  const { metadata: md, systemCharacteristics: sc, systemImplementation: si, controlImplementation: ci, backMatter: bm } = ssp;
  const catalogSort = useCatalogSortIndex();
  const isProfileLoaded = !!oscal.profile?.data;
  const expectedControlIds = useMemo(
    () => getExpectedControlIds(oscal.profile?.data, (oscal.catalog?.data as OscalCatalog) ?? null),
    [oscal.profile, oscal.catalog],
  );
  const dashboardSummary = useMemo(
    () => buildControlStatusDashboard(ssp, catalogSort, leveragedIndex, expectedControlIds, isProfileLoaded),
    [ssp, catalogSort, leveragedIndex, expectedControlIds, isProfileLoaded],
  );
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
          <StatChip value={ci.implementedRequirements.length} label="SSP Controls" color={colors.orange} />
          <StatChip value={bm.length} label="Resources" color={colors.gray} />
          {si.leveragedAuthorizations.length > 0 && (
            <StatChip value={si.leveragedAuthorizations.length} label="Leveraged" color={colors.purple} />
          )}
          {sc.informationTypes.length > 0 && (
            <StatChip value={sc.informationTypes.length} label="Info Types" color={colors.brightBlue} />
          )}
          {(() => {
            let exports = 0, responsibilities = 0, inherited = 0, satisfied = 0;
            let inheritedResolved = 0, satisfiedResolved = 0;
            ci.implementedRequirements.forEach((ir) => {
              ir.byComponents.forEach((bc) => {
                if (bc.export) { exports += bc.export.provided.length; responsibilities += bc.export.responsibilities.length; }
                inherited += bc.inherited.length;
                satisfied += bc.satisfied.length;
                bc.inherited.forEach((ih) => { if (ih.providedUuid && leveragedIndex.provided.has(ih.providedUuid)) inheritedResolved++; });
                bc.satisfied.forEach((sat) => { if (sat.responsibilityUuid && leveragedIndex.responsibilities.has(sat.responsibilityUuid)) satisfiedResolved++; });
              });
              ir.statements.forEach((st) => st.byComponents.forEach((bc) => {
                if (bc.export) { exports += bc.export.provided.length; responsibilities += bc.export.responsibilities.length; }
                inherited += bc.inherited.length;
                satisfied += bc.satisfied.length;
                bc.inherited.forEach((ih) => { if (ih.providedUuid && leveragedIndex.provided.has(ih.providedUuid)) inheritedResolved++; });
                bc.satisfied.forEach((sat) => { if (sat.responsibilityUuid && leveragedIndex.responsibilities.has(sat.responsibilityUuid)) satisfiedResolved++; });
              }));
            });
            const hasResolutions = inheritedResolved > 0 || satisfiedResolved > 0;
            return (
              <>
                {exports > 0 && <StatChip value={exports} label="Provided" color={colors.cobalt} />}
                {responsibilities > 0 && <StatChip value={responsibilities} label="Cust. Resp." color={colors.red} />}
                {inherited > 0 && <StatChip value={inherited} label={hasResolutions ? `Inherited (${inheritedResolved} resolved)` : "Inherited"} color={colors.darkGreen} />}
                {satisfied > 0 && <StatChip value={satisfied} label={hasResolutions ? `Satisfied (${satisfiedResolved} resolved)` : "Satisfied"} color={colors.purple} />}
              </>
            );
          })()}
        </div>
      </Card>

      <ControlStatusDashboard summary={dashboardSummary} navigate={navigate} />

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
  const responsibleParties = md.responsibleParties.map((rp) => ({ "role-id": rp.roleId, "party-uuids": rp.partyUuids }));
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
                background: colors.surfaceSubtle, color: colors.navy, fontFamily: fonts.mono, fontWeight: 500,
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
          <PartyCardGrid parties={md.parties} />
        </Card>
      )}

      {responsibleParties.length > 0 && (
        <Card>
          <SectionLabel>Responsible Parties</SectionLabel>
          <ResponsiblePartiesList responsibleParties={responsibleParties} parties={md.parties} roles={md.roles} />
        </Card>
      )}
    </>
  );
}

type DiagramKind = "mermaid" | "drawio" | "image" | "other";

interface DiagramAsset {
  id: string;
  title: string;
  description: string;
  href: string;
  resolvedUrl?: string;
  mediaType: string;
  kind: DiagramKind;
}

function linkMediaType(link: SspLink): string {
  return String(link.mediaType ?? "").toLowerCase();
}

function inferDiagramKind(href: string, mediaType: string): DiagramKind {
  const lowerHref = href.toLowerCase().split(/[?#]/)[0];
  if (mediaType.includes("mermaid") || lowerHref.endsWith(".mmd") || lowerHref.endsWith(".mermaid")) return "mermaid";
  if (
    mediaType.includes("drawio") || mediaType.includes("jgraph") ||
    lowerHref.endsWith(".drawio") || lowerHref.endsWith(".dio") || lowerHref.endsWith(".mxfile")
  ) return "drawio";
  if (mediaType.startsWith("image/") || /\.(svg|png|jpg|jpeg|gif|webp)$/.test(lowerHref)) return "image";
  return "other";
}

function resolveDiagramUrl(href: string, sourceUrl?: string | null): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("data:") || href.startsWith("blob:")) return href;
  if (!sourceUrl) return undefined;
  try { return new URL(href, sourceUrl).href; }
  catch { return undefined; }
}

function diagramLinks(diagram: SspDiagram, backMatter: SspResource[]): { link: SspLink; title?: string; description?: string }[] {
  const result: { link: SspLink; title?: string; description?: string }[] = [];
  diagram.links.forEach((link) => {
    if (link.href?.startsWith("#")) {
      const resource = backMatter.find((r) => r.uuid === link.href.slice(1));
      if (resource?.base64) {
        result.push({
          link: linkFromBase64(resource.base64, link.text || resource.title, link.mediaType),
          title: resource.title,
          description: resource.description,
        });
      }
      if (resource?.rlinks?.length) {
        resource.rlinks.forEach((rl) => {
          result.push({
            link: { href: rl.href, mediaType: rl["media-type"], rel: link.rel, text: link.text },
            title: resource.title,
            description: resource.description,
          });
        });
      }
      return;
    }
    result.push({ link });
  });
  return result;
}

function resolveArtifactUrl(href: string, sourceUrl?: string | null): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("data:") || href.startsWith("blob:")) return href;
  if (!sourceUrl) return undefined;
  try { return new URL(href, sourceUrl).href; }
  catch { return undefined; }
}

function artifactFromRlink(rlink: { href: string; "media-type"?: string }, title: string, description?: string, sourceUrl?: string | null): ArtifactItem | null {
  const href = resolveArtifactUrl(rlink.href, sourceUrl);
  if (!href) return null;
  return {
    title,
    href,
    mediaType: rlink["media-type"] || mediaTypeFromFilename(rlink.href),
    fileName: rlink.href.split(/[/?#]/).filter(Boolean).pop(),
    description,
  };
}

function artifactFromLink(link: SspLink, backMatter: SspResource[], sourceUrl?: string | null): ArtifactItem | null {
  if (!link.href) return null;
  if (link.href.startsWith("#")) {
    const resource = backMatter.find((r) => r.uuid === link.href.slice(1));
    if (!resource) return null;
    const title = link.text || resource.title || resource.uuid.slice(0, 12);
    if (resource.base64) {
      return {
        title,
        href: dataUrlFromBase64(resource.base64, link.mediaType),
        mediaType: resource.base64.mediaType || link.mediaType || mediaTypeFromFilename(resource.base64.filename),
        fileName: resource.base64.filename,
        description: resource.description,
      };
    }
    const rlink = resource.rlinks?.[0];
    return rlink ? artifactFromRlink(rlink, title, resource.description, sourceUrl) : null;
  }

  const href = resolveArtifactUrl(link.href, sourceUrl);
  if (!href) return null;
  return {
    title: link.text || link.href.split(/[/?#]/).filter(Boolean).pop() || link.href,
    href,
    mediaType: link.mediaType || mediaTypeFromFilename(link.href),
    fileName: link.href.split(/[/?#]/).filter(Boolean).pop(),
  };
}

function backMatterAttachmentCount(links: SspLink[], backMatter: SspResource[]): number {
  return links.reduce((count, link) => {
    if (!link.href?.startsWith("#")) return count;
    const resource = backMatter.find((r) => r.uuid === link.href.slice(1));
    return resource?.base64 || resource?.rlinks?.length ? count + 1 : count;
  }, 0);
}

function countImplementationAttachments(ir: ImplementedRequirement, backMatter: SspResource[]): number {
  let count = backMatterAttachmentCount(ir.links, backMatter);
  ir.byComponents.forEach((bc) => { count += backMatterAttachmentCount(bc.links, backMatter); });
  ir.statements.forEach((st) => {
    st.byComponents.forEach((bc) => { count += backMatterAttachmentCount(bc.links, backMatter); });
  });
  return count;
}

function attachmentTitle(count: number): string {
  return count === 1 ? "1 attachment" : `${count} attachments`;
}

function linkDisplayText(link: SspLink, backMatter: SspResource[]): string {
  const resource = link.href?.startsWith("#") ? backMatter.find((r) => r.uuid === link.href.slice(1)) : undefined;
  const baseText = link.text || resource?.title || (link.rel === "mitre" ? (link.href.split("/").pop() ?? link.href) : link.href);
  return link.resourceFragment ? `${baseText} — ${link.resourceFragment}` : baseText;
}

function buildDiagramAssets(diagrams: SspDiagram[], backMatter: SspResource[], sourceUrl?: string | null): DiagramAsset[] {
  return diagrams.flatMap((diagram, diagramIndex) => {
    const links = diagramLinks(diagram, backMatter);
    return links.map(({ link, title, description }, linkIndex) => {
      const mediaType = linkMediaType(link);
      const fallbackTitle = title || diagram.title || link.text || link.href.split("/").pop() || `Diagram ${diagramIndex + 1}`;
      return {
        id: `${diagram.uuid ?? diagramIndex}-${linkIndex}-${link.href}`,
        title: fallbackTitle,
        description: diagram.description || description || "",
        href: link.href,
        resolvedUrl: resolveDiagramUrl(link.href, sourceUrl),
        mediaType,
        kind: inferDiagramKind(link.href, mediaType),
      };
    });
  });
}

function drawIoViewerUrl(url: string): string {
  return `https://viewer.diagrams.net/?lightbox=1&highlight=0000ff&edit=_blank&layers=1&nav=1&url=${encodeURIComponent(url)}`;
}

function textFromDataUrl(url: string): string {
  const comma = url.indexOf(",");
  if (!url.startsWith("data:") || comma === -1) return "";
  const meta = url.slice(0, comma).toLowerCase();
  const data = url.slice(comma + 1);
  if (meta.includes(";base64")) return atob(data.replace(/\s+/g, ""));
  return decodeURIComponent(data);
}

const mermaidDiagramKeywords = [
  "architecture-beta", "block-beta", "classDiagram", "C4Component", "C4Container", "C4Context", "C4Deployment",
  "C4Dynamic", "erDiagram", "flowchart", "gantt", "gitGraph", "graph", "journey", "mindmap", "packet-beta",
  "pie", "quadrantChart", "requirementDiagram", "sankey-beta", "sequenceDiagram", "stateDiagram", "timeline", "xychart-beta",
];

const mermaidDiagramKeywordPattern = mermaidDiagramKeywords.join("|");
const mermaidRendererVersion = 3;

function normalizeMermaidSource(source: string): string {
  let normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();

  // Some embedded OSCAL resources compact Mermaid frontmatter to `---title: ...` or
  // `---title: ...---flowchart`. Mermaid requires the YAML delimiters on their own lines.
  normalized = normalized.replace(/^---\s*(?=[A-Za-z0-9_-]+\s*:)/, "---\n");
  normalized = normalized.replace(
    new RegExp(`\\n([^\\n]*?)---\\s*(${mermaidDiagramKeywordPattern})\\b`, "i"),
    "\n$1\n---\n$2",
  );
  normalized = normalized.replace(
    new RegExp(`^---\\n([\\s\\S]*?)\\n?---\\s*(${mermaidDiagramKeywordPattern})\\b`, "i"),
    "---\n$1\n---\n$2",
  );

  return normalized;
}

function stripMermaidFrontmatter(source: string): string {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const diagramStart = normalized.match(new RegExp(`\\b(${mermaidDiagramKeywordPattern})\\b`, "i"));
  if (diagramStart?.index !== undefined && (normalized.startsWith("---") || normalized.slice(0, diagramStart.index).includes("---"))) {
    return normalized.slice(diagramStart.index).trim();
  }
  return normalized;
}

function mermaidSourceCandidates(source: string): string[] {
  const normalized = normalizeMermaidSource(source);
  const stripped = stripMermaidFrontmatter(normalized);
  return Array.from(new Set([stripped, normalized].filter(Boolean)));
}

async function fetchDiagramText(url: string): Promise<string> {
  if (url.startsWith("data:")) return textFromDataUrl(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.text();
}

function MermaidDiagram({ url, compact }: { url: string; compact?: boolean }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const renderId = useMemo(() => `mermaid-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError("");
    (async () => {
      try {
        const sources = mermaidSourceCandidates(await fetchDiagramText(url));
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
        let rendered: Awaited<ReturnType<typeof mermaid.render>> | undefined;
        let renderError: unknown;
        for (const [index, source] of sources.entries()) {
          try {
            rendered = await mermaid.render(`${renderId}-${index}`, source);
            break;
          } catch (err) {
            renderError = err;
          }
        }
        if (!rendered) throw renderError ?? new Error("Unable to render Mermaid diagram");
        if (!cancelled) setSvg(rendered.svg);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to render Mermaid diagram");
      }
    })();
    return () => { cancelled = true; };
  }, [renderId, url, mermaidRendererVersion]);

  if (error) return <DiagramPlaceholder message={error} />;
  if (!svg) return <DiagramPlaceholder message="Rendering Mermaid diagram…" />;
  return (
    <div
      style={{ width: "100%", height: compact ? 170 : "auto", overflow: compact ? "hidden" : "auto", display: "flex", justifyContent: "center" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function DiagramPlaceholder({ message }: { message: string }) {
  return (
    <div style={{
      height: "100%", minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: 16, color: colors.gray, fontSize: 12, backgroundColor: colors.surfaceSubtle,
    }}>
      {message}
    </div>
  );
}

function DiagramPreview({ asset, compact = false }: { asset: DiagramAsset; compact?: boolean }) {
  if (!asset.resolvedUrl) {
    return <DiagramPlaceholder message="Diagram link is relative to a local SSP. Load the SSP from a URL to preview it here." />;
  }
  if (asset.kind === "mermaid") return <MermaidDiagram url={asset.resolvedUrl} compact={compact} />;
  if (asset.kind === "drawio") {
    if (asset.resolvedUrl.startsWith("data:")) return <DrawIoDiagram url={asset.resolvedUrl} compact={compact} />;
    if (!asset.resolvedUrl.startsWith("http://") && !asset.resolvedUrl.startsWith("https://")) {
      return <DiagramPlaceholder message="Draw.io previews require an HTTP(S) diagram URL." />;
    }
    return (
      <iframe
        title={asset.title}
        src={drawIoViewerUrl(asset.resolvedUrl)}
        style={{ width: "100%", height: compact ? 180 : "70vh", border: 0, backgroundColor: colors.white, pointerEvents: compact ? "none" : "auto" }}
      />
    );
  }
  if (asset.kind === "image") {
    return <img src={asset.resolvedUrl} alt={asset.title} style={{ width: "100%", maxHeight: compact ? 180 : "70vh", objectFit: "contain", display: "block" }} />;
  }
  return <DiagramPlaceholder message="Unsupported diagram media type. Open the source link to view it." />;
}

function DrawIoDiagram({ url, compact }: { url: string; compact?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [xml, setXml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    try {
      const text = textFromDataUrl(url);
      if (!text.trim()) throw new Error("Embedded draw.io data is empty.");
      setXml(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to decode embedded draw.io diagram");
    }
  }, [url]);

  useEffect(() => {
    if (!xml) return;
    const frame = iframeRef.current;
    const sendLoad = () => {
      frame?.contentWindow?.postMessage(JSON.stringify({ action: "load", xml, autosave: 0, modified: 0 }), "*");
    };
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "init") sendLoad();
      } catch { /* ignore non-json postMessages */ }
    };
    window.addEventListener("message", onMessage);
    const timeoutId = window.setTimeout(sendLoad, 800);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
    };
  }, [xml]);

  if (error) return <DiagramPlaceholder message={error} />;
  if (!xml) return <DiagramPlaceholder message="Decoding embedded draw.io diagram…" />;
  return (
    <iframe
      ref={iframeRef}
      title="draw.io diagram"
      src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&ui=min&libraries=1"
      style={{ width: "100%", height: compact ? 180 : "70vh", border: 0, backgroundColor: colors.white, pointerEvents: compact ? "none" : "auto" }}
    />
  );
}

function DiagramPanZoomViewer({ asset }: { asset: DiagramAsset }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const zoomBy = useCallback((factor: number) => {
    setScale((prev) => Math.min(6, Math.max(0.25, prev * factor)));
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const onWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 0.88);
  }, [zoomBy]);

  const onMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (asset.kind === "drawio") return;
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }, [asset.kind, offset.x, offset.y]);

  const onMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({ x: drag.ox + e.clientX - drag.x, y: drag.oy + e.clientY - drag.y });
  }, []);

  const stopDrag = useCallback(() => { dragRef.current = null; }, []);
  const isDrawIo = asset.kind === "drawio";

  return (
    <div style={{ height: "calc(96vh - 76px)", display: "flex", flexDirection: "column", backgroundColor: colors.surfaceSubtle }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${colors.paleGray}`, backgroundColor: colors.card }}>
        <span style={{ fontSize: 11, color: colors.gray, flex: 1 }}>
          {isDrawIo ? "Use the diagrams.net canvas controls to pan and zoom." : "Drag to pan. Scroll to zoom."}
        </span>
        {!isDrawIo && (
          <>
            <button onClick={() => zoomBy(0.8)} style={diagramToolButtonStyle}>−</button>
            <span style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.gray, minWidth: 44, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
            <button onClick={() => zoomBy(1.25)} style={diagramToolButtonStyle}>+</button>
            <button onClick={reset} style={diagramToolButtonStyle}>Reset</button>
          </>
        )}
      </div>
      <div
        onWheel={isDrawIo ? undefined : onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        style={{
          flex: 1, overflow: "hidden", position: "relative", cursor: isDrawIo ? "default" : dragRef.current ? "grabbing" : "grab",
          backgroundImage: `linear-gradient(${alpha(colors.gray, 6)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(colors.gray, 6)} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      >
        {isDrawIo ? (
          <DiagramPreview asset={asset} />
        ) : (
          <div style={{
            minWidth: "100%", minHeight: "100%", padding: 40, display: "flex", alignItems: "center", justifyContent: "center",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "center center",
          }}>
            <div style={{ backgroundColor: colors.card, borderRadius: radii.md, boxShadow: shadows.md, padding: 18, maxWidth: "none" }}>
              <DiagramPreview asset={asset} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const diagramToolButtonStyle: CSSProperties = {
  border: `1px solid ${colors.paleGray}`,
  backgroundColor: colors.card,
  color: colors.cobalt,
  borderRadius: radii.sm,
  padding: "4px 9px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

function DiagramGallery({ title, diagrams, backMatter, sourceUrl }: { title: string; diagrams: SspDiagram[]; backMatter: SspResource[]; sourceUrl?: string | null }) {
  const [active, setActive] = useState<DiagramAsset | null>(null);
  const assets = useMemo(() => buildDiagramAssets(diagrams, backMatter, sourceUrl), [diagrams, backMatter, sourceUrl]);
  if (assets.length === 0) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: colors.cobalt, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        {title} ({assets.length})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {assets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => setActive(asset)}
            style={{
              textAlign: "left", padding: 0, border: `1px solid ${colors.paleGray}`, borderRadius: radii.md, backgroundColor: colors.card,
              overflow: "hidden", cursor: "zoom-in", boxShadow: shadows.sm,
            }}
          >
            <div style={{ height: 190, backgroundColor: colors.surfaceSubtle, overflow: "hidden" }}>
              <DiagramPreview asset={asset} compact />
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                {asset.kind === "mermaid" ? <IcoCode size={12} style={{ color: colors.darkGreen }} /> : asset.kind === "drawio" ? <IcoLayers size={12} style={{ color: colors.purple }} /> : <IcoBook size={12} style={{ color: colors.cobalt }} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.title}</span>
              </div>
              {asset.description && <div style={{ fontSize: 11, color: colors.gray, lineHeight: 1.4 }}>{trunc(asset.description, 140)}</div>}
              <div style={{ marginTop: 6, fontSize: 10, color: colors.gray, fontFamily: fonts.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {asset.mediaType || asset.href}
              </div>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
          style={{ position: "fixed", inset: 0, zIndex: 2000, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "98vw", height: "96vh", backgroundColor: colors.card, borderRadius: radii.lg, boxShadow: shadows.lg, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${colors.paleGray}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: colors.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active.title}</div>
                <div style={{ fontSize: 10, color: colors.gray, fontFamily: fonts.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active.href}</div>
              </div>
              {active.resolvedUrl && (
                <a href={active.kind === "drawio" && active.resolvedUrl.startsWith("http") ? drawIoViewerUrl(active.resolvedUrl) : active.resolvedUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: colors.cobalt, fontWeight: 700, textDecoration: "none" }}>
                  Open source
                </a>
              )}
              <button onClick={() => setActive(null)} style={{ border: "none", background: "none", fontSize: 22, lineHeight: 1, cursor: "pointer", color: colors.gray }}>×</button>
            </div>
            <DiagramPanZoomViewer asset={active} />
          </div>
        </div>
      )}
    </div>
  );
}

function CharacteristicNarrativeCard({ title, section, backMatter, sourceUrl }: { title: string; section: CharacteristicSection; backMatter: SspResource[]; sourceUrl?: string | null }) {
  if (!section.description && section.diagrams.length === 0) return null;
  return (
    <Card>
      <SectionLabel>{title}</SectionLabel>
      {section.description && <MarkupBlock value={section.description} />}
      <DiagramGallery title={`${title} Diagrams`} diagrams={section.diagrams} backMatter={backMatter} sourceUrl={sourceUrl} />
    </Card>
  );
}

function DiagramSectionView({ title, section, backMatter, sourceUrl }: { title: string; section: CharacteristicSection; backMatter: SspResource[]; sourceUrl?: string | null }) {
  const assets = useMemo(() => buildDiagramAssets(section.diagrams, backMatter, sourceUrl), [section.diagrams, backMatter, sourceUrl]);
  return (
    <>
      <Card>
        <SectionLabel>{title}</SectionLabel>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.navy, margin: "0 0 8px" }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          {assets.length > 0
            ? `Select a diagram preview to open a larger pan and zoom view. ${assets.length} diagram${assets.length !== 1 ? "s" : ""} available.`
            : "No diagrams are available for this section."}
        </p>
      </Card>
      {section.description && (
        <Card>
          <SectionLabel>Section Description</SectionLabel>
          <MarkupBlock value={section.description} />
        </Card>
      )}
      <Card>
        <DiagramGallery title="Diagrams" diagrams={section.diagrams} backMatter={backMatter} sourceUrl={sourceUrl} />
        {assets.length === 0 && (
          <div style={{ padding: "16px 0", textAlign: "center", color: colors.gray, fontSize: 12, fontStyle: "italic" }}>
            No diagram links or embedded diagram resources were found.
          </div>
        )}
      </Card>
    </>
  );
}

function SystemCharacteristicsView({ ssp, sourceUrl }: { ssp: SspParsed; sourceUrl?: string | null }) {
  const sc = ssp.systemCharacteristics;
  const sensitivityColor = riskColor(sc.securitySensitivityLevel);
  const statusColor = componentStatusColor(sc.status.state);
  const statusIcon = componentStatusIconKey(sc.status.state);
  return (
    <>
      <Card style={{ padding: "18px 24px 16px" }}>
        <SectionLabel>System Characteristics</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) repeat(auto-fit, minmax(190px, 220px))", gap: 14, alignItems: "stretch" }}>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: colors.navy, margin: "0 0 12px" }}>
              {sc.systemName}{sc.systemNameShort ? ` (${sc.systemNameShort})` : ""}
            </h2>
            {sc.systemIds.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {sc.systemIds.map((sid, i) => (
                  <span key={i} title={sid.id} style={{
                    maxWidth: 360, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: radii.pill,
                    backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.paleGray}`, color: colors.gray, fontSize: 10, fontWeight: 600,
                  }}>
                    {navIcon("tag", colors.gray, 11)}
                    <span style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{sid.identifierType || "System ID"}</span>
                    <span style={{ fontFamily: fonts.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{sid.id}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {sc.status.state && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: radii.md,
              backgroundColor: alpha(statusColor, 10), border: `1px solid ${alpha(statusColor, 28)}`,
              boxShadow: `0 8px 18px ${alpha(statusColor, 8)}`,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: radii.sm, display: "inline-flex", alignItems: "center", justifyContent: "center",
                backgroundColor: alpha(statusColor, 14), color: statusColor, flexShrink: 0,
              }}>
                {navIcon(statusIcon, statusColor, 24)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: statusColor, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
                  System Status
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: statusColor, textTransform: "uppercase", lineHeight: 1.1 }}>
                  {sc.status.state}
                </div>
              </div>
            </div>
          )}
          {sc.securitySensitivityLevel && (
            <div style={{
              padding: "12px 14px", borderRadius: radii.md,
              backgroundColor: alpha(sensitivityColor, 12), border: `1px solid ${alpha(sensitivityColor, 35)}`,
              textAlign: "center", boxShadow: `0 8px 18px ${alpha(sensitivityColor, 10)}`, display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: sensitivityColor, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>
                System Sensitivity
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: sensitivityColor, textTransform: "uppercase", lineHeight: 1.1 }}>
                {sc.securitySensitivityLevel}
              </div>
            </div>
          )}
        </div>
      </Card>

      {(sc.securityImpactLevel.objectiveConfidentiality || sc.securityImpactLevel.objectiveIntegrity || sc.securityImpactLevel.objectiveAvailability) && (
        <Card style={{ padding: "16px 24px" }}>
          <SectionLabel>Security Impact Level</SectionLabel>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { l: "Confidentiality", v: sc.securityImpactLevel.objectiveConfidentiality, c: colors.cobalt },
              { l: "Integrity", v: sc.securityImpactLevel.objectiveIntegrity, c: colors.darkGreen },
              { l: "Availability", v: sc.securityImpactLevel.objectiveAvailability, c: colors.orange },
            ].filter((x) => x.v).map((x) => (
              <div key={x.l} style={{ textAlign: "center", background: colors.surfaceSubtle, borderRadius: 6, padding: "8px 18px", minWidth: 100 }}>
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

      <CharacteristicNarrativeCard title="Authorization Boundary" section={sc.authorizationBoundary} backMatter={ssp.backMatter} sourceUrl={sourceUrl} />
      <CharacteristicNarrativeCard title="Network Architecture" section={sc.networkArchitecture} backMatter={ssp.backMatter} sourceUrl={sourceUrl} />
      <CharacteristicNarrativeCard title="Data Flow" section={sc.dataFlow} backMatter={ssp.backMatter} sourceUrl={sourceUrl} />

      {sc.informationTypes.length > 0 && (
        <Card>
          <SectionLabel>Information Types ({sc.informationTypes.length})</SectionLabel>
          {sc.informationTypes.map((it, i) => (
            <div key={i} style={{ padding: "10px 14px", marginBottom: 8, backgroundColor: colors.bg, borderRadius: radii.sm }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 4 }}>{it.title}</div>
              {it.description && <MarkupBlock value={it.description} style={{ fontSize: 12, marginBottom: 8 }} />}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Confidentiality", impact: it.confidentialityImpact },
                  { label: "Integrity", impact: it.integrityImpact },
                  { label: "Availability", impact: it.availabilityImpact },
                ].filter((x) => x.impact.base || x.impact.selected).map((x) => {
                  const level = (x.impact.selected || x.impact.base).toLowerCase();
                  const bg = level.includes("high") ? alpha(colors.red, 10) : level.includes("moderate") ? alpha(colors.orange, 10) : alpha(colors.darkGreen, 10);
                  const fg = level.includes("high") ? colors.red : level.includes("moderate") ? colors.orange : colors.darkGreen;
                  return (
                    <div key={x.label} style={{ textAlign: "center", padding: "6px 14px", borderRadius: radii.sm, backgroundColor: bg }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: fg, textTransform: "uppercase" }}>{x.impact.selected || x.impact.base}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: colors.gray, textTransform: "uppercase", letterSpacing: "0.06em" }}>{x.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Card>
      )}

      {sc.props.length > 0 && (
        <Card>
          <SectionLabel>Properties ({sc.props.length})</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sc.props.map((p, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: radii.sm,
                background: colors.surfaceSubtle, color: colors.navy, fontFamily: fonts.mono,
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
        {si.components.slice(0, 10).map((c, i) => {
          const { iconKey, color: iconColor, assetType } = componentIcon(c);
          return (
            <div key={c.uuid} onClick={() => navigate(`ssp-comp-${i}`)} style={{
              padding: "6px 0", borderBottom: `1px solid ${colors.bg}`, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {navIcon(iconKey, iconColor, 13)}
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>{c.title || c.uuid.slice(0, 8)}</span>
              {assetType && <span style={{ fontSize: 10, color: iconColor, fontFamily: fonts.mono, marginLeft: "auto" }}>{assetType}</span>}
              <span style={{ fontSize: 11, color: colors.gray, marginLeft: assetType ? 0 : "auto" }}>{c.type}</span>
            </div>
          );
        })}
        {si.components.length > 10 && (
          <p style={{ fontSize: 11, color: colors.gray, marginTop: 6 }}>
            + {si.components.length - 10} more — click "Components" in sidebar
          </p>
        )}
      </Card>
    </>
  );
}

function ComponentsView({ ssp, navigate }: { ssp: SspParsed; navigate: (id: string) => void }) {
  const comps = ssp.systemImplementation.components;
  return (
    <>
      <Card>
        <SectionLabel>Components ({comps.length})</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          All components defined in the system implementation.
        </p>
      </Card>
      {comps.map((c, i) => {
        const { iconKey, color: iconColor, assetType } = componentIcon(c);
        const oscalProps = oscalNamespaceProps(c.props);
        return (
          <Card key={c.uuid} style={{ cursor: "pointer" }}>
            <div onClick={() => navigate(`ssp-comp-${i}`)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {navIcon(iconKey, iconColor, 15)}
              <h3 style={{ fontSize: 14, fontWeight: 700, color: colors.navy, margin: 0 }}>{c.title}</h3>
              {assetType && (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: alpha(iconColor, 10), color: iconColor, fontFamily: fonts.mono, fontWeight: 700, marginLeft: "auto" }}>{assetType}</span>
              )}
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: colors.surfaceSubtle, color: colors.navy, fontFamily: fonts.mono, marginLeft: assetType ? 0 : "auto" }}>{c.type}</span>
              {c.status && (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: c.status === "operational" ? colors.successBg : colors.warningBg, color: c.status === "operational" ? colors.darkGreen : colors.orange, fontWeight: 600 }}>
                  {c.status}
                </span>
              )}
            </div>
            {oscalProps.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {oscalProps.map((p, pi) => (
                  <span key={pi} title={p.ns} style={{ fontSize: 10, padding: "2px 7px", borderRadius: radii.sm, background: alpha(colors.cobalt, 8), color: colors.cobalt, fontFamily: fonts.mono, fontWeight: 600 }}>
                    {propDisplayName(p)}: {p.value}
                  </span>
                ))}
              </div>
            )}
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
        );
      })}
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
                <span key={r} style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: colors.surfaceSubtle, color: colors.navy, fontFamily: fonts.mono }}>{r}</span>
              ))}
            </div>
          )}
          {u.authorizedPrivileges.map((ap, i) => (
            <div key={i} style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.darkGreen }}>{ap.title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                {ap.functionsPerformed.map((f, j) => (
                  <span key={j} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 2, background: colors.tintGreen, color: colors.darkGreen, fontFamily: fonts.mono }}>{f}</span>
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
  const components = ssp.systemImplementation.components;
  const compMap = useMemo(() => {
    const m: Record<string, string> = {};
    components.forEach((c) => { m[c.uuid] = c.title || c.uuid.slice(0, 8); });
    return m;
  }, [components]);
  return (
    <>
      <Card>
        <SectionLabel>Inventory Items ({items.length})</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          Hardware, software, and services in the system inventory.
        </p>
      </Card>
      {items.map((ii) => {
        const assetType = findProp(ii.props, "asset-type")?.value;
        const { iconKey, color: iconColor } = inventoryItemIcon(ii, components);
        return (
          <Card key={ii.uuid}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {navIcon(iconKey, iconColor, 14)}
              <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>
                {ii.props.find((p) => p.name === "asset-id")?.value || ii.uuid.slice(0, 12)}
              </span>
              {assetType && (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.sm, background: colors.surfaceSubtle, color: colors.navy, fontFamily: fonts.mono, marginLeft: "auto" }}>{assetType}</span>
              )}
            </div>
            {ii.description && <MarkupBlock value={ii.description} style={{ fontSize: 12, marginBottom: 4 }} />}
            {ii.implementedComponents.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {ii.implementedComponents.map((ic) => (
                  <span key={ic.componentUuid} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 2, background: colors.tintBlue, color: colors.cobalt, fontFamily: fonts.mono }}>
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

interface LeveragedSystemSummary {
  id: string;
  title: string;
  fileName: string;
  sourceUrl?: string | null;
  systemName: string;
  systemNameShort: string;
  description: string;
  sensitivity: string;
  status: string;
  impact: SystemCharacteristics["securityImpactLevel"];
  leveragedAuthorizations: LeveragedAuth[];
  implementedControls: number;
  exportedProvided: number;
  exportedResponsibilities: number;
  offeredFamilies: Record<string, number>;
  /** UUIDs of `provided` and `responsibility` entries exported by this SSP */
  exportedUuids: Set<string>;
  /** UUIDs of `inherited.provided-uuid` / `satisfied.responsibility-uuid` referenced by this SSP */
  consumedUuids: Set<string>;
  /** UUIDs of all parties declared in this SSP's metadata */
  partyUuids: Set<string>;
  /** Explicit user binding to a leveraged-authorization UUID, if any */
  boundLaUuid?: string;
}

interface LeveragedConnection {
  fromId: string;
  fromTitle: string;
  toId?: string;
  toTitle: string;
  href?: string;
}

function summarizeSsp(parsed: SspParsed, id: string, fileName: string, sourceUrl?: string | null, boundLaUuid?: string): LeveragedSystemSummary {
  const offeredFamilies: Record<string, number> = {};
  let exportedProvided = 0;
  let exportedResponsibilities = 0;
  const exportedUuids = new Set<string>();
  const consumedUuids = new Set<string>();
  parsed.controlImplementation.implementedRequirements.forEach((ir) => {
    const allByComps = [...ir.byComponents, ...ir.statements.flatMap((st) => st.byComponents)];
    const providedForControl = allByComps.reduce((sum, bc) => sum + (bc.export?.provided.length ?? 0), 0);
    const responsibilitiesForControl = allByComps.reduce((sum, bc) => sum + (bc.export?.responsibilities.length ?? 0), 0);
    exportedProvided += providedForControl;
    exportedResponsibilities += responsibilitiesForControl;
    if (providedForControl > 0 || responsibilitiesForControl > 0) {
      const fam = getFamily(ir.controlId);
      offeredFamilies[fam] = (offeredFamilies[fam] ?? 0) + 1;
    }
    allByComps.forEach((bc) => {
      bc.export?.provided.forEach((p) => { if (p.uuid) exportedUuids.add(p.uuid); });
      bc.export?.responsibilities.forEach((r) => { if (r.uuid) exportedUuids.add(r.uuid); });
      bc.inherited.forEach((ih) => { if (ih.providedUuid) consumedUuids.add(ih.providedUuid); });
      bc.satisfied.forEach((sat) => { if (sat.responsibilityUuid) consumedUuids.add(sat.responsibilityUuid); });
    });
  });
  const partyUuids = new Set<string>(parsed.metadata.parties.map((p) => p.uuid).filter(Boolean));

  return {
    id,
    title: parsed.metadata.title,
    fileName,
    sourceUrl,
    systemName: parsed.systemCharacteristics.systemName,
    systemNameShort: parsed.systemCharacteristics.systemNameShort,
    description: parsed.systemCharacteristics.description,
    sensitivity: parsed.systemCharacteristics.securitySensitivityLevel,
    status: parsed.systemCharacteristics.status.state,
    impact: parsed.systemCharacteristics.securityImpactLevel,
    leveragedAuthorizations: parsed.systemImplementation.leveragedAuthorizations,
    implementedControls: parsed.controlImplementation.implementedRequirements.length,
    exportedProvided,
    exportedResponsibilities,
    offeredFamilies,
    exportedUuids,
    consumedUuids,
    partyUuids,
    boundLaUuid,
  };
}

function resolvePotentialHref(href: string | undefined, sourceUrl: string | null | undefined): string | undefined {
  if (!href) return undefined;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (!sourceUrl) return href;
  try { return new URL(href, sourceUrl).href; }
  catch { return href; }
}

function isAutoResolvableHref(href: string | undefined, sourceUrl: string | null | undefined): boolean {
  if (!href) return false;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) return true;
  return Boolean(sourceUrl);
}

function loadedEntryMatchesUrl(entry: { fileName: string; sourceUrl?: string | null }, url: string): boolean {
  return entry.sourceUrl === url || entry.fileName === fileNameFromUrl(url);
}

function matchLeveragedSummary(la: LeveragedAuth, from: LeveragedSystemSummary, summaries: LeveragedSystemSummary[]): LeveragedSystemSummary | undefined {
  // 0. Explicit user binding wins over heuristics.
  const explicit = summaries.find((s) => s.id !== from.id && s.boundLaUuid === la.uuid);
  if (explicit) return explicit;
  const candidates = summaries.filter((s) => s.id !== from.id && !s.boundLaUuid);
  const href = resolvePotentialHref(la.href, from.sourceUrl);
  if (href) {
    const byUrl = candidates.find((s) => s.sourceUrl === href || s.fileName === fileNameFromUrl(href));
    if (byUrl) return byUrl;
  }
  // Party-uuid match: the LA's party-uuid is a party in the candidate provider SSP.
  if (la.partyUuid) {
    const byParty = candidates.find((s) => s.partyUuids.has(la.partyUuid));
    if (byParty) return byParty;
  }
  // UUID-overlap match: the candidate provider SSP exports at least one
  // provided/responsibility UUID that the consumer SSP references via
  // `inherited.provided-uuid` or `satisfied.responsibility-uuid`.
  for (const s of candidates) {
    for (const u of s.exportedUuids) {
      if (from.consumedUuids.has(u)) return s;
    }
  }
  return undefined;
}

function ImpactPills({ impact }: { impact: SystemCharacteristics["securityImpactLevel"] }) {
  const vals = [
    ["C", impact.objectiveConfidentiality],
    ["I", impact.objectiveIntegrity],
    ["A", impact.objectiveAvailability],
  ].filter(([, value]) => value);
  if (vals.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {vals.map(([label, value]) => (
        <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: radii.pill, backgroundColor: alpha(colors.navy, 7), color: colors.navy }}>
          {label}: {String(value).replace("fips-199-", "")}
        </span>
      ))}
    </div>
  );
}

function OfferedFamilyChips({ families }: { families: Record<string, number> }) {
  const entries = Object.entries(families).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <span style={{ fontSize: 11, color: colors.gray }}>No exported controls detected</span>;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {entries.slice(0, 12).map(([family, count]) => (
        <span key={family} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: radii.pill, backgroundColor: alpha(colors.purple, 10), color: colors.purple }}>
          {family.toUpperCase()} {count}
        </span>
      ))}
      {entries.length > 12 && <span style={{ fontSize: 10, color: colors.gray }}>+{entries.length - 12} more</span>}
    </div>
  );
}

function LeveragedSystemsMap({ summaries, connections }: { summaries: LeveragedSystemSummary[]; connections: LeveragedConnection[] }) {
  return (
    <Card>
      <SectionLabel>Leveraged System Map</SectionLabel>
      <p style={{ fontSize: 12, color: colors.gray, margin: "0 0 14px" }}>
        Loaded SSPs and the authorizations they leverage. Unloaded or not-yet-resolvable references are shown as pending targets.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
        {summaries.map((system, i) => (
          <div key={system.id} style={{ border: `1px solid ${i === 0 ? alpha(colors.darkGreen, 35) : alpha(colors.purple, 24)}`, borderRadius: radii.md, padding: 12, backgroundColor: i === 0 ? alpha(colors.darkGreen, 4) : colors.card }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: radii.sm, backgroundColor: i === 0 ? colors.darkGreen : colors.purple, color: colors.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IcoLayers size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={system.title}>{system.systemName || system.title}</div>
                {system.systemNameShort && <div style={{ fontSize: 10, color: colors.gray }}>{system.systemNameShort}</div>}
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <ImpactPills impact={system.impact} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: colors.gray }}>
                {system.sensitivity && <span>Sensitivity: <strong style={{ color: colors.black }}>{system.sensitivity.replace("fips-199-", "")}</strong></span>}
                {system.status && <span>Status: <strong style={{ color: colors.black }}>{system.status}</strong></span>}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatChip value={system.implementedControls} label="Controls" color={colors.orange} />
                <StatChip value={system.exportedProvided} label="Provided" color={colors.darkGreen} />
                <StatChip value={system.exportedResponsibilities} label="Resp." color={colors.purple} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: colors.cobalt, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Offered families</div>
                <OfferedFamilyChips families={system.offeredFamilies} />
              </div>
              {system.description && <p style={{ fontSize: 11, color: colors.gray, margin: 0, lineHeight: 1.5 }}>{trunc(system.description, 220)}</p>}
              {system.sourceUrl && <div style={{ fontSize: 10, color: colors.gray, fontFamily: fonts.mono, wordBreak: "break-all" }}>{system.sourceUrl}</div>}
            </div>
          </div>
        ))}
      </div>

      {connections.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: colors.cobalt, textTransform: "uppercase", letterSpacing: 0.5 }}>Authorization edges</div>
          {connections.map((c, i) => (
            <div key={`${c.fromId}-${i}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: radii.sm, backgroundColor: c.toId ? alpha(colors.darkGreen, 5) : alpha(colors.orange, 6), border: `1px solid ${c.toId ? alpha(colors.darkGreen, 16) : alpha(colors.orange, 20)}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.fromTitle}</span>
              <span style={{ fontSize: 16, color: c.toId ? colors.darkGreen : colors.orange }}>→</span>
              <span style={{ fontSize: 12, color: c.toId ? colors.darkGreen : colors.orange, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.href}>
                {c.toTitle}{!c.toId ? " (not loaded)" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LeveragedAuthCard({
  la, index, matched, partyByUuid, navigate,
}: {
  la: LeveragedAuth;
  index: number;
  matched: LeveragedSystemSummary | undefined;
  partyByUuid: Map<string, SspMetadata["parties"][number]>;
  navigate: (id: string) => void;
}) {
  const providerParty = partyByUuid.get(la.partyUuid);
  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: radii.md,
        padding: "20px 24px",
        boxShadow: shadows.sm,
        marginBottom: 16,
        cursor: "default",
        border: `2px solid transparent`,
        transition: "border-color 0.15s, background-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div onClick={() => navigate(`leveraged-auth-${index}`)} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, cursor: "pointer" }}>
          <IcoLayers size={15} style={{ color: colors.purple }} />
          <h4 style={{ fontSize: 14, fontWeight: 700, color: colors.navy, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{la.title}</h4>
        </div>
        {matched ? (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: radii.pill, backgroundColor: alpha(colors.darkGreen, 10), color: colors.darkGreen }}>
            SSP loaded
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`leveraged-auth-${index}`); }}
            style={{ background: alpha(colors.cobalt, 10), border: `1px solid ${alpha(colors.cobalt, 25)}`, borderRadius: radii.sm, color: colors.cobalt, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 10px" }}
          >
            Link SSP
          </button>
        )}
        <button
          onClick={() => navigate(`leveraged-auth-${index}`)}
          style={{ background: "none", border: "none", color: colors.cobalt, cursor: "pointer", fontSize: 11, fontWeight: 600, padding: 0 }}
        >
          View &rarr;
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.gray, marginBottom: 4 }}>Provider</div>
          <PartyChip party={providerParty} fallbackUuid={la.partyUuid} />
        </div>
        {la.dateAuthorized && <MField label="Authorized" value={fmtDate(la.dateAuthorized)} />}
        {la.href && <MField label="SSP URL" value={la.href} mono />}
        {matched && <MField label="Loaded As" value={matched.systemName || matched.title} />}
      </div>
      {!matched && (
        <div style={{ marginTop: 8, fontSize: 11, color: colors.gray, fontStyle: "italic" }}>
          Open this authorization to link a provider SSP directly to this leveraged authorization instance.
        </div>
      )}
    </div>
  );
}

function LeveragedView({ ssp, navigate, sourceUrl }: { ssp: SspParsed; navigate: (id: string) => void; sourceUrl?: string | null }) {
  const items = ssp.systemImplementation.leveragedAuthorizations;
  const oscal = useOscal();
  const leveragedIndex = useLeveragedIndex(oscal.leveragedSsps);
  const summaries = useMemo(() => {
    const list: LeveragedSystemSummary[] = [summarizeSsp(ssp, "current", "Current SSP", sourceUrl)];
    oscal.leveragedSsps.forEach((entry, i) => {
      try {
        list.push(summarizeSsp(parseSsp(entry.data), `provider-${i}`, entry.fileName, entry.sourceUrl, entry.boundLaUuid));
      } catch { /* Ignore invalid provider SSPs in graph */ }
    });
    return list;
  }, [ssp, oscal.leveragedSsps, sourceUrl]);
  const connections = useMemo(() => {
    const result: LeveragedConnection[] = [];
    summaries.forEach((summary) => {
      summary.leveragedAuthorizations.forEach((la) => {
        const match = matchLeveragedSummary(la, summary, summaries);
        result.push({
          fromId: summary.id,
          fromTitle: summary.systemName || summary.title,
          toId: match?.id,
          toTitle: match?.systemName || match?.title || la.title || la.uuid.slice(0, 12),
          href: resolvePotentialHref(la.href, summary.sourceUrl),
        });
      });
    });
    return result;
  }, [summaries]);
  const partyByUuid = useMemo(() => new Map(ssp.metadata.parties.map((party) => [party.uuid, party])), [ssp]);
  const boundProviderByLaUuid = useMemo(() => {
    const map = new Map<string, LeveragedSystemSummary>();
    oscal.leveragedSsps.forEach((entry, i) => {
      if (!entry.boundLaUuid) return;
      try {
        map.set(entry.boundLaUuid, summarizeSsp(parseSsp(entry.data), `provider-${i}`, entry.fileName, entry.sourceUrl, entry.boundLaUuid));
      } catch { /* Ignore invalid provider SSPs */ }
    });
    return map;
  }, [oscal.leveragedSsps]);

  return (
    <>
      <Card>
        <SectionLabel>Leveraged Authorizations ({items.length})</SectionLabel>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          External systems whose authorizations are leveraged. Click an authorization to explore the controls it offers.
        </p>
      </Card>
      <LeveragedSystemsMap summaries={summaries} connections={connections} />
      {items.map((la, i) => {
        const matched = boundProviderByLaUuid.get(la.uuid);
        return (
          <LeveragedAuthCard
            key={la.uuid}
            la={la}
            index={i}
            matched={matched}
            partyByUuid={partyByUuid}
            navigate={navigate}
          />
        );
      })}

      {/* Provider SSP upload section */}
      <Card>
        <SectionLabel>Provider SSP Linking</SectionLabel>
        <p style={{ fontSize: 12, color: colors.gray, margin: 0 }}>
          Provider SSPs must be linked from an individual leveraged authorization. Select a leveraged authorization in the tree, then load or replace that authorization&apos;s provider SSP there.
        </p>

        {/* Loaded provider SSPs */}
        {oscal.leveragedSsps.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: colors.cobalt, marginBottom: 6 }}>
              Loaded Provider SSPs ({oscal.leveragedSsps.length})
            </div>
            {oscal.leveragedSsps.map((entry) => (
              <div key={entry.fileName} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 4,
                backgroundColor: alpha(colors.darkGreen, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.darkGreen}`,
              }}>
                <span style={{ fontSize: 12, color: colors.darkGreen, fontWeight: 600 }}>✓</span>
                <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={entry.sourceUrl ?? entry.fileName}>{entry.fileName}</span>
                <button
                  onClick={() => oscal.removeLeveragedSsp(entry.fileName)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: colors.gray, padding: "0 4px" }}
                  title="Remove"
                >×</button>
              </div>
            ))}
            {leveragedIndex.provided.size > 0 && (
              <div style={{ fontSize: 11, color: colors.gray, marginTop: 6 }}>
                Resolved: <strong style={{ color: colors.darkGreen }}>{leveragedIndex.provided.size}</strong> provided
                {leveragedIndex.responsibilities.size > 0 && (
                  <>, <strong style={{ color: colors.purple }}>{leveragedIndex.responsibilities.size}</strong> responsibilities</>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

function LeveragedAuthDetailView({ ssp, authIndex, navigate, leveragedIndex }: { ssp: SspParsed; authIndex: number; navigate: (id: string) => void; leveragedIndex: LeveragedIndex }) {
  const oscal = useOscal();
  const catalogSort = useCatalogSortIndex();
  const la = ssp.systemImplementation.leveragedAuthorizations[authIndex];
  const [providerDragOver, setProviderDragOver] = useState(false);
  const [providerLoadError, setProviderLoadError] = useState("");
  const [offeredView, setOfferedView] = useState<"control" | "component">("control");
  const partyByUuid = useMemo(() => new Map(ssp.metadata.parties.map((party) => [party.uuid, party])), [ssp]);

  const loadedProvider = useMemo(() => {
    type Candidate = { entry: typeof oscal.leveragedSsps[number]; summary: LeveragedSystemSummary };
    const candidates: Candidate[] = [];
    for (const entry of oscal.leveragedSsps) {
      if (entry.boundLaUuid !== la.uuid) continue;
      try {
        const parsed = parseSsp(entry.data);
        const summary = summarizeSsp(parsed, entry.fileName, entry.fileName, entry.sourceUrl, entry.boundLaUuid);
        candidates.push({ entry, summary });
      } catch { /* Ignore invalid provider SSPs */ }
    }
    return candidates[0] ?? null;
  }, [la.uuid, oscal.leveragedSsps]);

  const loadLeveragedFile = useCallback((file: File) => {
    loadProviderSspFile(file, oscal.addLeveragedSsp, setProviderLoadError, la.uuid);
  }, [oscal, la.uuid]);

  const replaceLeveragedFile = useCallback((file: File) => {
    if (loadedProvider) oscal.removeLeveragedSsp(loadedProvider.entry.fileName);
    loadProviderSspFile(file, oscal.addLeveragedSsp, setProviderLoadError, la.uuid);
  }, [loadedProvider, oscal, la.uuid]);

  /* Match this leveraged authorization to provider exports via the bound loadedProvider. */
  const offeredControls = useMemo(() => {
    const result: { controlId: string; entries: import("../hooks/useLeveragedIndex").ControlExportEntry[] }[] = [];
    if (!loadedProvider) return result;
    for (const [controlId, entries] of leveragedIndex.byControl.entries()) {
      const matching = entries.filter((e) => e.providerSspTitle === loadedProvider.summary.title);
      if (matching.length > 0) result.push({ controlId, entries: matching });
    }
    result.sort((a, b) => catalogSort.compare(a.controlId, b.controlId));
    return result;
  }, [loadedProvider, leveragedIndex, catalogSort]);

  /* Group offered controls by family */
  const familyGroups = useMemo(() => {
    const map: Record<string, { controlId: string; entries: import("../hooks/useLeveragedIndex").ControlExportEntry[] }[]> = {};
    offeredControls.forEach((ctrl) => {
      const fam = getFamily(ctrl.controlId);
      (map[fam] ??= []).push(ctrl);
    });
    return Object.entries(map).sort(([a], [b]) => catalogSort.compare(a, b));
  }, [offeredControls, catalogSort]);

  /* Group offered controls by exporting provider component */
  const componentGroups = useMemo(() => {
    const map = new Map<string, {
      componentTitle: string;
      controls: { controlId: string; entry: import("../hooks/useLeveragedIndex").ControlExportEntry }[];
      providedCount: number;
      responsibilityCount: number;
    }>();
    offeredControls.forEach(({ controlId, entries }) => {
      entries.forEach((entry) => {
        const componentTitle = entry.providerComponentTitle || "Provider component";
        const group = map.get(componentTitle) ?? { componentTitle, controls: [], providedCount: 0, responsibilityCount: 0 };
        group.controls.push({ controlId, entry });
        group.providedCount += entry.provided.length;
        group.responsibilityCount += entry.responsibilities.length;
        map.set(componentTitle, group);
      });
    });
    return [...map.values()]
      .map((group) => ({
        ...group,
        controls: group.controls.sort((a, b) => catalogSort.compare(a.controlId, b.controlId)),
      }))
      .sort((a, b) => a.componentTitle.localeCompare(b.componentTitle));
  }, [offeredControls, catalogSort]);

  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const [expandedControls, setExpandedControls] = useState<Record<string, boolean>>({});
  const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});

  const toggleFamily = (fam: string) => setExpandedFamilies((prev) => ({ ...prev, [fam]: !prev[fam] }));
  const toggleControl = (id: string) => setExpandedControls((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleComponent = (id: string) => setExpandedComponents((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderProviderEntryDetail = (entry: import("../hooks/useLeveragedIndex").ControlExportEntry): ReactNode => (
    <>
      {entry.description && (
        <div style={{ fontSize: 12, color: colors.black, marginBottom: 6 }}>{entry.description}</div>
      )}
      {entry.provided.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.darkGreen, marginBottom: 2 }}>Provided</div>
          {entry.provided.map((p) => (
            <div key={p.uuid} style={{ fontSize: 11, color: colors.gray, paddingLeft: 8, borderLeft: `2px solid ${colors.darkGreen}`, marginBottom: 3 }}>
              {p.description}
            </div>
          ))}
        </div>
      )}
      {entry.responsibilities.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.orange, marginBottom: 2 }}>Responsibilities</div>
          {entry.responsibilities.map((r) => (
            <div key={r.uuid} style={{ fontSize: 11, color: colors.gray, paddingLeft: 8, borderLeft: `2px solid ${colors.orange}`, marginBottom: 3 }}>
              {r.description}
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      <Card>
        <SectionLabel>Leveraged Authorization</SectionLabel>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.navy, margin: "0 0 12px" }}>{la.title}</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.gray, marginBottom: 4 }}>Provider</div>
            <PartyChip party={partyByUuid.get(la.partyUuid)} fallbackUuid={la.partyUuid} />
          </div>
          {la.dateAuthorized && <MField label="Date Authorized" value={fmtDate(la.dateAuthorized)} />}
          {la.href && <MField label="SSP URL" value={la.href} mono />}
          <MField label="UUID" value={la.uuid} mono />
        </div>
      </Card>

      <Card>
        <SectionLabel>{loadedProvider ? "Loaded Provider SSP" : "Load Provider SSP"}</SectionLabel>
        {loadedProvider ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 2 }}>
                {loadedProvider.summary.systemName || loadedProvider.summary.title}
              </div>
              <div style={{ fontSize: 11, color: colors.gray, fontFamily: fonts.mono }} title={loadedProvider.entry.sourceUrl ?? loadedProvider.entry.fileName}>
                {loadedProvider.entry.fileName}
              </div>
            </div>
            <button
              onClick={() => chooseProviderSspFile(replaceLeveragedFile)}
              style={{ background: alpha(colors.purple, 10), border: `1px solid ${alpha(colors.purple, 28)}`, borderRadius: radii.sm, color: colors.purple, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 12px" }}
            >
              Replace SSP
            </button>
            <button
              onClick={() => oscal.removeLeveragedSsp(loadedProvider.entry.fileName)}
              style={{ background: alpha(colors.red, 8), border: `1px solid ${alpha(colors.red, 28)}`, borderRadius: radii.sm, color: colors.red, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 12px" }}
              title="Remove loaded provider SSP"
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: colors.gray, margin: "0 0 10px" }}>
              If you have this provider&apos;s SSP locally, load it here to resolve the controls and customer responsibilities offered by this authorization.
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => { e.preventDefault(); setProviderDragOver(true); }}
              onDragLeave={() => setProviderDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setProviderDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) loadLeveragedFile(file);
              }}
              onClick={() => chooseProviderSspFile(loadLeveragedFile)}
              style={{
                border: `2px dashed ${providerDragOver ? colors.cobalt : colors.paleGray}`,
                borderRadius: radii.md,
                padding: "16px 20px",
                textAlign: "center",
                cursor: "pointer",
                backgroundColor: providerDragOver ? alpha(colors.cobalt, 10) : alpha(colors.cobalt, 3),
                transition: "border-color 0.15s, background-color 0.15s",
              }}
            >
              <IcoUpload size={20} style={{ color: colors.cobalt, marginBottom: 4 }} />
              <div style={{ fontSize: 12, color: colors.gray }}>Drop this provider&apos;s SSP JSON here, or click to browse</div>
            </div>
          </>
        )}
        {providerLoadError && (
          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: radii.sm, backgroundColor: colors.errorBg, color: colors.red, fontSize: 12, fontWeight: 600 }}>
            {providerLoadError}
          </div>
        )}
      </Card>

      {/* Controls offered tree */}
      <Card>
        <SectionLabel>Controls Offered ({offeredControls.length})</SectionLabel>
        <p style={{ fontSize: 12, color: colors.gray, margin: "0 0 12px" }}>
          Controls provided by this leveraged system. View them by control family or by exporting provider component.
        </p>
        {offeredControls.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {(["control", "component"] as const).map((mode) => {
              const active = offeredView === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setOfferedView(mode)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: radii.sm,
                    border: `1px solid ${active ? colors.purple : colors.paleGray}`,
                    backgroundColor: active ? alpha(colors.purple, 10) : colors.card,
                    color: active ? colors.purple : colors.black,
                    cursor: "pointer", fontSize: 11, fontWeight: 700,
                  }}
                >
                  {mode === "control" ? <IcoShield size={11} /> : <IcoCube size={11} />}
                  By {mode === "control" ? "Control" : "Component"}
                </button>
              );
            })}
          </div>
        )}

        {offeredControls.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: colors.gray, fontSize: 12, fontStyle: "italic" }}>
            No provider SSP loaded for this authorization yet. Load it above to see controls offered.
          </div>
        ) : offeredView === "control" ? (
          <div style={{ border: `1px solid ${colors.paleGray}`, borderRadius: radii.md, overflow: "hidden" }}>
            {familyGroups.map(([fam, controls]) => {
              const famExpanded = expandedFamilies[fam] === true;
              return (
                <div key={fam}>
                  {/* Family row */}
                  <div
                    onClick={() => toggleFamily(fam)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      backgroundColor: colors.surfaceSubtle, cursor: "pointer",
                      borderBottom: `1px solid ${colors.paleGray}`,
                      userSelect: "none",
                    }}
                  >
                    <IcoChev open={famExpanded} style={{ color: colors.cobalt }} />
                    <IcoFolder size={13} style={{ color: colors.cobalt }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy }}>{fam.toUpperCase()}</span>
                    <span style={{ fontSize: 11, color: colors.gray }}>{FAMILY_NAMES[fam] || fam}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: radii.pill, backgroundColor: alpha(colors.purple, 10), color: colors.purple }}>
                      {controls.length}
                    </span>
                  </div>

                  {/* Controls within this family */}
                  {famExpanded && controls.map(({ controlId, entries }) => {
                    const ctrlExpanded = expandedControls[controlId] ?? false;
                    return (
                      <div key={controlId} style={{ borderBottom: `1px solid ${colors.bg}` }}>
                        {/* Control row */}
                        <div
                          style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 28px",
                            cursor: "pointer", transition: "background .1s",
                          }}
                          onClick={() => toggleControl(controlId)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = alpha(colors.cobalt, 5); }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
                        >
                          <IcoChev open={ctrlExpanded} style={{ color: colors.orange }} />
                          <IcoShield size={12} style={{ color: colors.orange }} />
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: fonts.mono, color: colors.navy }}>{controlId.toUpperCase()}</span>
                          <span style={{ fontSize: 10, color: colors.gray }}>{entries.length} component{entries.length > 1 ? "s" : ""}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`ctrl-${controlId}`); }}
                            style={{
                              marginLeft: "auto", background: "none", border: `1px solid ${colors.cobalt}`, borderRadius: radii.sm,
                              padding: "2px 8px", fontSize: 10, color: colors.cobalt, cursor: "pointer", fontWeight: 600,
                            }}
                          >
                            View Detail
                          </button>
                        </div>

                        {/* Expanded control detail inline */}
                        {ctrlExpanded && (
                          <div style={{ padding: "8px 12px 12px 48px", backgroundColor: alpha(colors.purple, 3) }}>
                            {entries.map((entry, ei) => (
                              <div key={ei} style={{ marginBottom: ei < entries.length - 1 ? 10 : 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: colors.purple, marginBottom: 4 }}>
                                  {entry.providerComponentTitle}
                                </div>
                                {entry.description && (
                                  <div style={{ fontSize: 12, color: colors.black, marginBottom: 6 }}>{entry.description}</div>
                                )}
                                {entry.provided.length > 0 && (
                                  <div style={{ marginBottom: 4 }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.darkGreen, marginBottom: 2 }}>Provided</div>
                                    {entry.provided.map((p) => (
                                      <div key={p.uuid} style={{ fontSize: 11, color: colors.gray, paddingLeft: 8, borderLeft: `2px solid ${colors.darkGreen}`, marginBottom: 3 }}>
                                        {p.description}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {entry.responsibilities.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: colors.orange, marginBottom: 2 }}>Responsibilities</div>
                                    {entry.responsibilities.map((r) => (
                                      <div key={r.uuid} style={{ fontSize: 11, color: colors.gray, paddingLeft: 8, borderLeft: `2px solid ${colors.orange}`, marginBottom: 3 }}>
                                        {r.description}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ border: `1px solid ${colors.paleGray}`, borderRadius: radii.md, overflow: "hidden" }}>
            {componentGroups.map((group) => {
              const componentExpanded = expandedComponents[group.componentTitle] === true;
              return (
                <div key={group.componentTitle}>
                  <div
                    onClick={() => toggleComponent(group.componentTitle)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      backgroundColor: colors.surfaceSubtle, cursor: "pointer",
                      borderBottom: `1px solid ${colors.paleGray}`,
                      userSelect: "none",
                    }}
                  >
                    <IcoChev open={componentExpanded} style={{ color: colors.purple }} />
                    <IcoCube size={13} style={{ color: colors.purple }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={group.componentTitle}>
                      {group.componentTitle}
                    </span>
                    <span style={{ fontSize: 10, color: colors.darkGreen }}>{group.providedCount} provided</span>
                    <span style={{ fontSize: 10, color: colors.orange }}>{group.responsibilityCount} resp.</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: radii.pill, backgroundColor: alpha(colors.purple, 10), color: colors.purple }}>
                      {group.controls.length}
                    </span>
                  </div>

                  {componentExpanded && group.controls.map(({ controlId, entry }) => {
                    const rowId = `${group.componentTitle}-${controlId}`;
                    const ctrlExpanded = expandedControls[rowId] ?? false;
                    return (
                      <div key={rowId} style={{ borderBottom: `1px solid ${colors.bg}` }}>
                        <div
                          style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 28px",
                            cursor: "pointer", transition: "background .1s",
                          }}
                          onClick={() => toggleControl(rowId)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = alpha(colors.purple, 5); }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
                        >
                          <IcoChev open={ctrlExpanded} style={{ color: colors.orange }} />
                          <IcoShield size={12} style={{ color: colors.orange }} />
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: fonts.mono, color: colors.navy }}>{controlId.toUpperCase()}</span>
                          <span style={{ fontSize: 10, color: colors.darkGreen }}>{entry.provided.length} provided</span>
                          <span style={{ fontSize: 10, color: colors.orange }}>{entry.responsibilities.length} responsibilities</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`ctrl-${controlId}`); }}
                            style={{
                              marginLeft: "auto", background: "none", border: `1px solid ${colors.cobalt}`, borderRadius: radii.sm,
                              padding: "2px 8px", fontSize: 10, color: colors.cobalt, cursor: "pointer", fontWeight: 600,
                            }}
                          >
                            View Detail
                          </button>
                        </div>

                        {ctrlExpanded && (
                          <div style={{ padding: "8px 12px 12px 48px", backgroundColor: alpha(colors.purple, 3) }}>
                            {renderProviderEntryDetail(entry)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

function ControlImplementationView({ ssp, navigate, leveragedIndex }: { ssp: SspParsed; navigate: (id: string) => void; leveragedIndex: LeveragedIndex }) {
  const oscal = useOscal();
  const ci = ssp.controlImplementation;
  const catalogSort = useCatalogSortIndex();
  const [scope, setScope] = useState("current");
  const isProfileLoaded = !!oscal.profile?.data;
  const expectedControlIds = useMemo(
    () => getExpectedControlIds(oscal.profile?.data, (oscal.catalog?.data as OscalCatalog) ?? null),
    [oscal.profile, oscal.catalog],
  );
  const controlEntries = useMemo(
    () => buildControlEntries(ssp, leveragedIndex, expectedControlIds),
    [ssp, leveragedIndex, expectedControlIds],
  );
  const irById = useMemo(
    () => new Map(ssp.controlImplementation.implementedRequirements.map((ir) => [ir.controlId, ir])),
    [ssp],
  );
  /* Group by family */
  const families = useMemo(() => {
    const map: Record<string, ControlNavEntry[]> = {};
    controlEntries.forEach((entry) => {
      const fam = getFamily(entry.controlId);
      (map[fam] ??= []).push(entry);
    });
    Object.values(map).forEach((entries) => entries.sort((a, b) => catalogSort.compare(a.controlId, b.controlId)));
    return Object.entries(map).sort(([a], [b]) => catalogSort.compare(a, b));
  }, [controlEntries, catalogSort]);

  const satisfiedCount = controlEntries.filter((entry) => isSatisfiedControlStatus(dashboardStatusForEntry(entry, irById.get(entry.controlId)))).length;
  const missingCount = controlEntries.filter((entry) => !entry.hasCurrent && !entry.hasProvider).length;

  const providerScopes = useMemo(() => {
    const map = new Map<string, { title: string; controls: { controlId: string; entries: import("../hooks/useLeveragedIndex").ControlExportEntry[] }[] }>();
    for (const [controlId, entries] of leveragedIndex.byControl.entries()) {
      entries.forEach((entry) => {
        const provider = entry.providerSspTitle;
        const current = map.get(provider) ?? { title: provider, controls: [] };
        const control = current.controls.find((c) => c.controlId === controlId);
        if (control) control.entries.push(entry);
        else current.controls.push({ controlId, entries: [entry] });
        map.set(provider, current);
      });
    }
    return [...map.values()]
      .map((provider) => ({
        ...provider,
        controls: provider.controls.sort((a, b) => catalogSort.compare(a.controlId, b.controlId)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [leveragedIndex, catalogSort]);

  useEffect(() => {
    if (scope !== "current" && !providerScopes.some((p) => p.title === scope)) setScope("current");
  }, [scope, providerScopes]);

  const selectedProvider = providerScopes.find((p) => p.title === scope);
  const selectedProviderFamilies = useMemo(() => {
    if (!selectedProvider) return [];
    const map: Record<string, { controlId: string; entries: import("../hooks/useLeveragedIndex").ControlExportEntry[] }[]> = {};
    selectedProvider.controls.forEach((control) => {
      const fam = getFamily(control.controlId);
      (map[fam] ??= []).push(control);
    });
    return Object.entries(map).sort(([a], [b]) => catalogSort.compare(a, b));
  }, [selectedProvider, catalogSort]);

  const currentScopeButton = scope === "current";

  return (
    <>
      <Card>
        <SectionLabel>Control Implementation</SectionLabel>
        {ci.description && <MarkupBlock value={ci.description} style={{ marginBottom: 12 }} />}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <StatChip value={families.length} label="Families" color={colors.cobalt} />
          <StatChip value={controlEntries.length} label={isProfileLoaded ? "Profile Controls" : "Controls"} color={colors.orange} />
          <StatChip value={satisfiedCount} label="Satisfied" color={colors.darkGreen} />
          <StatChip value={missingCount} label="Missing" color={colors.red} />
          <StatChip value={ci.implementedRequirements.reduce((n, r) => n + r.statements.length, 0)} label="Statements" color={colors.darkGreen} />
        </div>
        <div style={{ borderTop: `1px solid ${colors.paleGray}`, paddingTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: colors.cobalt, marginBottom: 8 }}>
            Show controls from
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setScope("current")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: radii.sm,
                border: `1px solid ${currentScopeButton ? colors.orange : colors.paleGray}`,
                backgroundColor: currentScopeButton ? colors.warningBg : colors.card,
                color: currentScopeButton ? colors.orange : colors.black,
                cursor: "pointer", fontSize: 12, fontWeight: 700,
              }}
            >
              <IcoShield size={12} /> Current SSP <span style={{ ...S.badge, marginLeft: 2 }}>{controlEntries.length}</span>
            </button>
            {providerScopes.map((provider) => {
              const active = scope === provider.title;
              return (
                <button
                  key={provider.title}
                  onClick={() => setScope(provider.title)}
                  title={provider.title}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: radii.sm,
                    border: `1px solid ${active ? colors.purple : colors.paleGray}`,
                    backgroundColor: active ? alpha(colors.purple, 10) : colors.card,
                    color: active ? colors.purple : colors.black,
                    cursor: "pointer", fontSize: 12, fontWeight: 700, maxWidth: 260,
                  }}
                >
                  <IcoLayers size={12} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{provider.title}</span>
                  <span style={{ ...S.badge, marginLeft: 2 }}>{provider.controls.length}</span>
                </button>
              );
            })}
          </div>
          {providerScopes.length > 0 && (
            <p style={{ fontSize: 11, color: colors.gray, margin: "8px 0 0" }}>
              The current SSP is shown by default. Loaded provider SSPs are available here without mixing their controls into the primary control list.
            </p>
          )}
        </div>
      </Card>
      {scope === "current" && families.map(([fam, entries]) => (
        <Card key={fam}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }}
            onClick={() => navigate(`ctrl-family-${fam}`)}>
            <IcoFolder size={14} style={{ color: colors.cobalt }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{fam.toUpperCase()}</span>
            <span style={{ fontSize: 12, color: colors.gray }}>{FAMILY_NAMES[fam] || fam}</span>
            <span style={S.badge}>{entries.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {entries.map((entry) => {
              const color = controlSourceColor(entry.hasCurrent, entry.hasProvider);
              return (
                <button key={entry.controlId}
                  onClick={() => navigate(`ctrl-${entry.controlId}`)}
                  title={controlSourceTitle(entry.hasCurrent, entry.hasProvider)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: radii.sm, fontSize: 11, fontWeight: 600,
                    fontFamily: fonts.mono, border: `1px solid ${color}`, background: alpha(color, 8),
                    color, cursor: "pointer", transition: "all .12s",
                  }}>
                  <ControlSourceIcon hasCurrent={entry.hasCurrent} hasProvider={entry.hasProvider} size={10} />{entry.controlId.toUpperCase()}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      {selectedProvider && (
        <>
          <Card>
            <SectionLabel>Provider Controls</SectionLabel>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.navy, margin: "0 0 6px" }}>{selectedProvider.title}</h3>
            <p style={{ fontSize: 12, color: colors.gray, margin: 0 }}>
              Controls offered by this loaded provider SSP. Select Current SSP above to return to the main system implementation.
            </p>
          </Card>
          {selectedProviderFamilies.map(([fam, controls]) => (
            <Card key={fam}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <IcoFolder size={14} style={{ color: colors.purple }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{fam.toUpperCase()}</span>
                <span style={{ fontSize: 12, color: colors.gray }}>{FAMILY_NAMES[fam] || fam}</span>
                <span style={S.badge}>{controls.length}</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {controls.map(({ controlId, entries }) => {
                  const provided = entries.reduce((n, e) => n + e.provided.length, 0);
                  const responsibilities = entries.reduce((n, e) => n + e.responsibilities.length, 0);
                  return (
                    <div key={controlId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: radii.sm, backgroundColor: alpha(colors.purple, 4), border: `1px solid ${alpha(colors.purple, 12)}` }}>
                      <IcoLayers size={12} style={{ color: colors.purple }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy, fontFamily: fonts.mono }}>{controlId.toUpperCase()}</span>
                      <span style={{ fontSize: 10, color: colors.darkGreen }}>{provided} provided</span>
                      <span style={{ fontSize: 10, color: colors.orange }}>{responsibilities} responsibilities</span>
                      <button
                        onClick={() => navigate(`ctrl-${controlId}`)}
                        style={{ marginLeft: "auto", background: "none", border: `1px solid ${colors.purple}`, borderRadius: radii.sm, padding: "2px 8px", fontSize: 10, color: colors.purple, cursor: "pointer", fontWeight: 700 }}
                      >
                        View Detail
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </>
      )}
    </>
  );
}

function ControlFamilyView({ familyId, ssp, navigate, leveragedIndex }: { familyId: string; ssp: SspParsed; navigate: (id: string) => void; leveragedIndex: LeveragedIndex }) {
  const oscal = useOscal();
  const catalogSort = useCatalogSortIndex();
  const expectedControlIds = useMemo(
    () => getExpectedControlIds(oscal.profile?.data, (oscal.catalog?.data as OscalCatalog) ?? null),
    [oscal.profile, oscal.catalog],
  );
  const familyControls = useMemo(() => {
    return buildControlEntries(ssp, leveragedIndex, expectedControlIds)
      .filter((entry) => getFamily(entry.controlId) === familyId)
      .sort((a, b) => catalogSort.compare(a.controlId, b.controlId));
  }, [ssp, leveragedIndex, expectedControlIds, familyId, catalogSort]);
  const irById = useMemo(
    () => new Map(ssp.controlImplementation.implementedRequirements.map((ir) => [ir.controlId, ir])),
    [ssp],
  );
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
          <StatChip value={familyControls.filter((entry) => isSatisfiedControlStatus(dashboardStatusForEntry(entry, irById.get(entry.controlId)))).length} label="Satisfied" color={colors.darkGreen} />
          <StatChip value={familyControls.filter((entry) => !entry.hasCurrent && !entry.hasProvider).length} label="Missing" color={colors.red} />
          <StatChip value={familyControls.reduce((n, entry) => n + (irById.get(entry.controlId)?.statements.length ?? 0), 0)} label="Statements" color={colors.cobalt} />
        </div>
      </Card>
      {familyControls.map((entry) => {
        const ir = irById.get(entry.controlId);
        return (
        <Card key={entry.controlId} style={!entry.hasCurrent && !entry.hasProvider ? { borderLeft: `4px solid ${colors.red}` } : undefined}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            onClick={() => navigate(`ctrl-${entry.controlId}`)}>
            <span title={controlSourceTitle(entry.hasCurrent, entry.hasProvider)} style={{ display: "inline-flex" }}>
              <ControlSourceIcon hasCurrent={entry.hasCurrent} hasProvider={entry.hasProvider} size={14} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.navy, fontFamily: fonts.mono }}>{entry.controlId.toUpperCase()}</span>
            {ir && !entry.hasCurrent && !entry.hasProvider && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.sm, background: alpha(colors.red, 8), color: colors.red, fontWeight: 700 }}>
                missing implementation statements
              </span>
            )}
            {!ir && !entry.hasProvider && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.sm, background: alpha(colors.red, 8), color: colors.red, fontWeight: 700 }}>
                missing from SSP
              </span>
            )}
            {entry.hasProvider && !entry.hasCurrent && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.sm, background: alpha(colors.purple, 8), color: colors.purple, fontWeight: 700 }}>
                satisfied by provider
              </span>
            )}
            {ir && ir.statements.length > 0 && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: radii.sm, background: colors.bg, color: colors.gray }}>
                {ir.statements.length} stmt{ir.statements.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {ir?.description && <MarkupBlock value={ir.description} style={{ fontSize: 12.5, marginTop: 4 }} />}
          {!ir && !entry.hasProvider && (
            <p style={{ fontSize: 12, color: colors.gray, margin: "6px 0 0" }}>
              This control is selected by the resolved profile but has no implementation entry in the SSP.
            </p>
          )}
          {ir && ir.props.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {ir.props.map((p, i) => (
                <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 2, background: colors.bg, color: colors.gray, fontFamily: fonts.mono }}>
                  {p.name}: {p.value}
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

function MissingControlView({ controlId, catalog, hasProvider, navigate }: { controlId: string; catalog: OscalCatalog | null; hasProvider: boolean; navigate: (id: string) => void }) {
  const catalogControl = findCatalogControl(catalog, controlId);
  const paramMap = catalogControl ? buildCatalogParamMap(catalog, catalogControl) : {};
  const familyId = getFamily(controlId);
  return (
    <>
      <Card style={{ borderLeft: `4px solid ${hasProvider ? colors.purple : colors.red}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {navIcon(controlSourceIconKey(false, hasProvider), controlSourceColor(false, hasProvider), 22)}
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: colors.navy, margin: 0, fontFamily: fonts.mono }}>{controlId.toUpperCase()}</h2>
            <div style={{ fontSize: 12, color: hasProvider ? colors.purple : colors.red, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {hasProvider ? "Satisfied by leveraged authorization" : "Missing implementation statements"}
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: colors.gray, margin: 0 }}>
          {hasProvider
            ? "This control is selected by the resolved profile and is offered by a loaded leveraged authorization."
            : "This control is selected by the resolved profile, but the current SSP has no implementation statements for it."}
        </p>
        <button
          onClick={() => navigate(`ctrl-family-${familyId}`)}
          style={{ marginTop: 12, background: "none", border: `1px solid ${colors.cobalt}`, borderRadius: radii.sm, color: colors.cobalt, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "5px 10px" }}
        >
          Back to {familyId.toUpperCase()} family
        </button>
      </Card>
      {catalogControl ? (
        <CatalogControlCard control={catalogControl} paramMap={paramMap} />
      ) : (
        <Card>
          <SectionLabel>Catalog Control</SectionLabel>
          <p style={{ fontSize: 12, color: colors.gray, margin: 0 }}>
            The resolved catalog does not contain prose for this control.
          </p>
        </Card>
      )}
    </>
  );
}

/* ───────────────────────────────────────────────────────────────────────────
   ByComponentTabs — disclosure for the optional Export / Inherited / Satisfied
   buckets on a by-component entry. Always shows the main "Implementation"
   body (description / remarks / set-parameters / responsible-roles). Only
   renders the tab strip when at least one optional bucket exists; otherwise
   falls through to the implementation body so simple by-components look the
   same as before.
   ─────────────────────────────────────────────────────────────────────────── */

type ByCompTabKey = "impl" | "exports" | "inherited" | "satisfied";

function ByComponentTabs({ bc, size, leveragedIndex, backMatter, sourceUrl, onOpenArtifact }: { bc: ByComponent; size: "req" | "stmt"; leveragedIndex: LeveragedIndex; backMatter: SspResource[]; sourceUrl?: string | null; onOpenArtifact: (artifact: ArtifactItem) => void }) {
  const isReq = size === "req";

  const exportCount = bc.export
    ? bc.export.provided.length + bc.export.responsibilities.length
    : 0;
  const hasExport =
    !!bc.export &&
    (exportCount > 0 || !!bc.export.description || !!bc.export.remarks);
  const hasInherited = bc.inherited.length > 0;
  const hasSatisfied = bc.satisfied.length > 0;

  const tabs: { key: ByCompTabKey; label: string; count?: number; color: string }[] = [
    { key: "impl", label: "Implementation", color: colors.cobalt },
  ];
  if (hasExport) tabs.push({ key: "exports", label: "Exports", count: exportCount, color: colors.brightBlue });
  if (hasInherited) tabs.push({ key: "inherited", label: "Inherited", count: bc.inherited.length, color: colors.darkGreen });
  if (hasSatisfied) tabs.push({ key: "satisfied", label: "Satisfied", count: bc.satisfied.length, color: colors.purple });

  const [active, setActive] = useState<ByCompTabKey>("impl");

  useEffect(() => {
    setActive("impl");
  }, [bc.uuid]);

  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  // No optional buckets — render implementation body inline, no tab strip.
  if (tabs.length === 1) {
    return <ByCompImplementation bc={bc} size={size} backMatter={backMatter} sourceUrl={sourceUrl} onOpenArtifact={onOpenArtifact} />;
  }

  const tabPad = isReq ? "6px 14px" : "4px 10px";
  const tabFs = isReq ? 12 : 11;

  return (
    <div>
      <div style={{
        display: "flex", gap: 0, flexWrap: "wrap",
        borderBottom: `2px solid ${colors.paleGray}`,
        marginBottom: isReq ? 12 : 8,
      }}>
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              style={{
                padding: tabPad, fontSize: tabFs,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? t.color : colors.gray,
                background: isActive ? alpha(t.color, 4) : "transparent",
                border: "none",
                borderBottom: isActive ? `2px solid ${t.color}` : "2px solid transparent",
                cursor: "pointer",
                transition: "all .12s",
                marginBottom: -2,
                fontFamily: fonts.sans,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span>{t.label}</span>
              {typeof t.count === "number" && (
                <span style={{
                  fontSize: tabFs - 1, fontWeight: 700,
                  padding: "0 6px", borderRadius: radii.pill,
                  background: isActive ? t.color : alpha(colors.gray, 15),
                  color: isActive ? colors.white : colors.gray,
                  minWidth: 16, textAlign: "center",
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab.key === "impl" && <ByCompImplementation bc={bc} size={size} backMatter={backMatter} sourceUrl={sourceUrl} onOpenArtifact={onOpenArtifact} />}
      {activeTab.key === "exports" && bc.export && <ByCompExports exp={bc.export} size={size} />}
      {activeTab.key === "inherited" && <ByCompInherited entries={bc.inherited} size={size} leveragedIndex={leveragedIndex} />}
      {activeTab.key === "satisfied" && <ByCompSatisfied entries={bc.satisfied} size={size} leveragedIndex={leveragedIndex} />}
    </div>
  );
}

function ByCompImplementation({ bc, size, backMatter, sourceUrl, onOpenArtifact }: { bc: ByComponent; size: "req" | "stmt"; backMatter: SspResource[]; sourceUrl?: string | null; onOpenArtifact: (artifact: ArtifactItem) => void }) {
  const isReq = size === "req";
  const descFs = isReq ? 13 : 12.5;

  const hasAny =
    bc.description || bc.remarks || bc.links.length > 0 ||
    (isReq && bc.setParameters.length > 0) ||
    (isReq && bc.responsibleRoles.length > 0);

  if (!hasAny) {
    return (
      <p style={{ fontSize: 12, color: colors.gray, fontStyle: "italic", margin: 0 }}>
        No implementation description provided.
      </p>
    );
  }

  return (
    <div>
      {bc.description && <MarkupBlock value={bc.description} style={{ fontSize: descFs }} />}
      {bc.remarks && <CollapsibleRemarks value={bc.remarks} compact />}

      {isReq && bc.setParameters.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: colors.orange, letterSpacing: 0.5, marginBottom: 6 }}>
            Parameters ({bc.setParameters.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {bc.setParameters.map((sp, i) => (
              <div key={i} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "4px 10px", backgroundColor: alpha(colors.orange, 6), borderRadius: radii.sm, border: `1px solid ${alpha(colors.orange, 15)}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono, color: colors.orange }}>{sp.paramId}</span>
                {sp.values.map((v, j) => (
                  <span key={j} style={{ fontSize: 11, fontFamily: fonts.mono, color: colors.black }}>{v}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {isReq && bc.responsibleRoles.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: colors.navy, letterSpacing: 0.5, marginBottom: 6 }}>
            Responsible Roles
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {bc.responsibleRoles.map((rr, i) => (
              <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: radii.pill, backgroundColor: colors.navy, color: colors.white, fontWeight: 500 }}>
                {rr.roleId}
              </span>
            ))}
          </div>
        </div>
      )}

      {bc.links.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <LinkChips
            label={null}
            links={bc.links.map((l) => {
              const artifact = artifactFromLink(l, backMatter, sourceUrl);
              return artifact
                ? { text: linkDisplayText(l, backMatter), rel: l.rel, onClick: () => onOpenArtifact(artifact) }
                : { text: linkDisplayText(l, backMatter), href: l.href, rel: l.rel };
            })}
          />
        </div>
      )}
    </div>
  );
}

/** Inline card showing resolved provider attribution for an inherited/satisfied entry */
function ProviderAttribution({ label, resolution, accentColor }: {
  label: string;
  resolution: { providerSspTitle: string; providerComponentTitle: string; controlId: string; responsibleRoles: { roleId: string }[] };
  accentColor: string;
}) {
  return (
    <div style={{
      marginTop: 6, padding: "6px 10px",
      backgroundColor: alpha(accentColor, 6),
      border: `1px solid ${alpha(accentColor, 18)}`,
      borderRadius: radii.sm,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: accentColor, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: colors.black, fontWeight: 600 }}>
        {resolution.providerSspTitle}
      </div>
      <div style={{ fontSize: 10, color: colors.gray, marginTop: 1 }}>
        Component: {resolution.providerComponentTitle}
        {resolution.controlId && <> &middot; Control: {resolution.controlId.toUpperCase()}</>}
      </div>
      {resolution.responsibleRoles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
          {resolution.responsibleRoles.map((rr, i) => (
            <span key={i} style={{ fontSize: 8, padding: "1px 5px", borderRadius: radii.pill, backgroundColor: accentColor, color: colors.white, fontWeight: 500 }}>
              {rr.roleId}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ByCompExports({ exp, size }: { exp: ExportBlock; size: "req" | "stmt" }) {
  const isReq = size === "req";
  const itemPad = isReq ? "8px 12px" : "6px 10px";
  const descFs = isReq ? 12.5 : 11.5;
  const headFs = isReq ? 10 : 9;
  const labelMb = isReq ? 4 : 3;
  const sectionMb = isReq ? 10 : 6;

  return (
    <div>
      {exp.description && (
        <MarkupBlock value={exp.description} style={{ fontSize: descFs, marginBottom: 8 }} />
      )}

      {exp.provided.length > 0 && (
        <div style={{ marginBottom: sectionMb }}>
          <div style={{ fontSize: headFs, fontWeight: 700, textTransform: "uppercase" as const, color: colors.brightBlue, letterSpacing: 0.5, marginBottom: labelMb }}>
            Provided ({exp.provided.length})
          </div>
          {exp.provided.map((p, i) => (
            <div key={i} style={{ padding: itemPad, marginBottom: 4, backgroundColor: alpha(colors.brightBlue, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.brightBlue}` }}>
              <MarkupBlock value={p.description} style={{ fontSize: descFs }} />
              {p.responsibleRoles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {p.responsibleRoles.map((rr, ri) => (
                    <span key={ri} style={{ fontSize: 9, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.navy, color: colors.white, fontWeight: 500 }}>
                      {rr.roleId}
                    </span>
                  ))}
                </div>
              )}
              {p.uuid && (
                <div style={{ fontSize: 9, fontFamily: fonts.mono, color: colors.gray, marginTop: 4 }}>
                  uuid: {p.uuid}
                </div>
              )}
              {p.remarks && <CollapsibleRemarks value={p.remarks} compact />}
            </div>
          ))}
        </div>
      )}

      {exp.responsibilities.length > 0 && (
        <div style={{ marginBottom: sectionMb }}>
          <div style={{ fontSize: headFs, fontWeight: 700, textTransform: "uppercase" as const, color: colors.orange, letterSpacing: 0.5, marginBottom: labelMb }}>
            Customer Responsibilities ({exp.responsibilities.length})
          </div>
          {exp.responsibilities.map((r, i) => (
            <div key={i} style={{ padding: itemPad, marginBottom: 4, backgroundColor: alpha(colors.orange, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.orange}` }}>
              <MarkupBlock value={r.description} style={{ fontSize: descFs }} />
              {r.responsibleRoles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                  {r.responsibleRoles.map((rr, ri) => (
                    <span key={ri} style={{ fontSize: 9, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.orange, color: colors.white, fontWeight: 500 }}>
                      {rr.roleId}
                    </span>
                  ))}
                </div>
              )}
              {r.providedUuid && (
                <div style={{ fontSize: 9, fontFamily: fonts.mono, color: colors.gray, marginTop: 4 }}>
                  provided-uuid: {r.providedUuid}
                </div>
              )}
              {r.remarks && <CollapsibleRemarks value={r.remarks} compact />}
            </div>
          ))}
        </div>
      )}

      {exp.remarks && <CollapsibleRemarks value={exp.remarks} compact />}
    </div>
  );
}

function ByCompInherited({ entries, size, leveragedIndex }: { entries: InheritedEntry[]; size: "req" | "stmt"; leveragedIndex: LeveragedIndex }) {
  const isReq = size === "req";
  const itemPad = isReq ? "8px 12px" : "6px 10px";
  const descFs = isReq ? 12.5 : 11.5;
  return (
    <div>
      {entries.map((ih, i) => {
        const resolved = ih.providedUuid ? leveragedIndex.provided.get(ih.providedUuid) : undefined;
        return (
          <div key={i} style={{ padding: itemPad, marginBottom: 4, backgroundColor: alpha(colors.darkGreen, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.darkGreen}` }}>
            <MarkupBlock value={ih.description} style={{ fontSize: descFs }} />
            {ih.responsibleRoles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {ih.responsibleRoles.map((rr, ri) => (
                  <span key={ri} style={{ fontSize: 9, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.darkGreen, color: colors.white, fontWeight: 500 }}>
                    {rr.roleId}
                  </span>
                ))}
              </div>
            )}
            {resolved ? (
              <ProviderAttribution label="Provided by" resolution={resolved} accentColor={colors.darkGreen} />
            ) : ih.providedUuid ? (
              <div style={{ fontSize: 9, fontFamily: fonts.mono, color: colors.gray, marginTop: 4 }}>
                provided-uuid: {ih.providedUuid}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ByCompSatisfied({ entries, size, leveragedIndex }: { entries: SatisfiedEntry[]; size: "req" | "stmt"; leveragedIndex: LeveragedIndex }) {
  const isReq = size === "req";
  const itemPad = isReq ? "8px 12px" : "6px 10px";
  const descFs = isReq ? 12.5 : 11.5;
  return (
    <div>
      {entries.map((sat, i) => {
        const resolved = sat.responsibilityUuid ? leveragedIndex.responsibilities.get(sat.responsibilityUuid) : undefined;
        return (
          <div key={i} style={{ padding: itemPad, marginBottom: 4, backgroundColor: alpha(colors.purple, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.purple}` }}>
            <MarkupBlock value={sat.description} style={{ fontSize: descFs }} />
            {sat.responsibleRoles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {sat.responsibleRoles.map((rr, ri) => (
                  <span key={ri} style={{ fontSize: 9, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.purple, color: colors.white, fontWeight: 500 }}>
                    {rr.roleId}
                  </span>
                ))}
              </div>
            )}
            {resolved ? (
              <ProviderAttribution label="Satisfies responsibility from" resolution={resolved} accentColor={colors.purple} />
            ) : sat.responsibilityUuid ? (
              <div style={{ fontSize: 9, fontFamily: fonts.mono, color: colors.gray, marginTop: 4 }}>
                responsibility-uuid: {sat.responsibilityUuid}
              </div>
            ) : null}
            {sat.remarks && <CollapsibleRemarks value={sat.remarks} compact />}
          </div>
        );
      })}
    </div>
  );
}

function ControlDetailView({ ir, ssp, catalog, leveragedIndex, sourceUrl }: { ir: ImplementedRequirement; ssp: SspParsed; catalog: OscalCatalog | null; leveragedIndex: LeveragedIndex; sourceUrl?: string | null }) {
  const compMap = useMemo(() => {
    const m: Record<string, string> = {};
    ssp.systemImplementation.components.forEach((c) => { m[c.uuid] = c.title || c.uuid.slice(0, 8); });
    return m;
  }, [ssp]);
  const partyByUuid = useMemo(() => new Map(ssp.metadata.parties.map((party) => [party.uuid, party])), [ssp]);

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
    const list: { uuid: string; title: string; type: string; status: string }[] = [];
    const addComp = (compUuid: string) => {
      if (!seen.has(compUuid)) {
        seen.add(compUuid);
        const full = ssp.systemImplementation.components.find((c) => c.uuid === compUuid);
        list.push({
          uuid: compUuid,
          title: full?.title || compMap[compUuid] || compUuid.slice(0, 12),
          type: full?.type || "",
          status: full?.status || "",
        });
      }
    };
    ir.byComponents.forEach((bc) => addComp(bc.componentUuid));
    ir.statements.forEach((st) => st.byComponents.forEach((bc) => addComp(bc.componentUuid)));
    return list;
  }, [ir, compMap, ssp]);

  const [activeCompUuid, setActiveCompUuid] = useState<string>(allComponents[0]?.uuid ?? "");
  const [activeArtifact, setActiveArtifact] = useState<ArtifactItem | null>(null);

  useEffect(() => {
    const firstCompUuid = allComponents[0]?.uuid ?? "";
    if (!activeCompUuid || !allComponents.some((comp) => comp.uuid === activeCompUuid)) {
      setActiveCompUuid(firstCompUuid);
    }
  }, [activeCompUuid, allComponents]);

  /* Status from props */
  const status = ir.props.find((p) => p.name === "implementation-status")?.value ?? "unknown";
  const familyLabel = FAMILY_NAMES[getFamily(ir.controlId)] || "";
  const implementationAttachmentCount = useMemo(
    () => countImplementationAttachments(ir, ssp.backMatter),
    [ir, ssp.backMatter],
  );

  const providerExportsForControl = useMemo(
    () => leveragedIndex.byControl.get(ir.controlId) ?? [],
    [leveragedIndex, ir.controlId],
  );
  const providerExportGroups = useMemo(() => {
    const groups = new Map<string, {
      title: string;
      providedCount: number;
      responsibilityCount: number;
      components: typeof providerExportsForControl;
    }>();
    providerExportsForControl.forEach((entry) => {
      const group = groups.get(entry.providerSspTitle) ?? {
        title: entry.providerSspTitle,
        providedCount: 0,
        responsibilityCount: 0,
        components: [],
      };
      group.providedCount += entry.provided.length;
      group.responsibilityCount += entry.responsibilities.length;
      group.components.push(entry);
      groups.set(entry.providerSspTitle, group);
    });
    return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [providerExportsForControl]);
  const [activeProviderExport, setActiveProviderExport] = useState("");
  useEffect(() => {
    if (providerExportGroups.length === 0) {
      if (activeProviderExport) setActiveProviderExport("");
      return;
    }
    if (!providerExportGroups.some((group) => group.title === activeProviderExport)) {
      setActiveProviderExport(providerExportGroups[0].title);
    }
  }, [activeProviderExport, providerExportGroups]);
  const selectedProviderExport = providerExportGroups.find((group) => group.title === activeProviderExport) ?? providerExportGroups[0];

  return (
    <>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span title={controlSourceTitle(true, providerExportGroups.length > 0)} style={{ display: "inline-flex" }}>
            <ControlSourceIcon hasCurrent hasProvider={providerExportGroups.length > 0} size={20} />
          </span>
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
        <Card style={{ backgroundColor: colors.warningBg, borderLeft: `4px solid ${colors.orange}` }}>
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

      {/* Remarks */}
      {ir.remarks && (
        <Card style={{ borderLeft: `4px solid ${colors.cobalt}` }}>
          <CollapsibleRemarks value={ir.remarks} />
        </Card>
      )}

      {/* Set Parameters (IR-level) */}
      {ir.setParameters.length > 0 && (
        <Card>
          <SectionLabel>Set Parameters ({ir.setParameters.length})</SectionLabel>
          <div style={{ display: "grid", gap: 8 }}>
            {ir.setParameters.map((sp, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 10px", backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono, color: colors.orange, whiteSpace: "nowrap" }}>{sp.paramId}</span>
                <span style={{ fontSize: 12, color: colors.black }}>=</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {sp.values.map((v, j) => (
                    <span key={j} style={{
                      fontSize: 12, fontFamily: fonts.mono, padding: "2px 8px", borderRadius: radii.sm,
                      backgroundColor: alpha(colors.orange, 8), color: colors.orange, border: `1px solid ${alpha(colors.orange, 20)}`,
                    }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Component-level implementations */}
      {allComponents.length > 0 && (
        <Card>
          <SectionLabel>Control Level Implementations ({allComponents.length} component{allComponents.length !== 1 ? "s" : ""})</SectionLabel>

          {/* Component tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${colors.paleGray}`, marginBottom: 16, flexWrap: "wrap" }}>
            {allComponents.map((comp) => {
              const isActive = comp.uuid === activeCompUuid;
              const { iconKey: typeIcon, color: baseTypeColor, assetType } = componentIcon(comp);
              const typeColor = isActive ? baseTypeColor : colors.gray;
              return (
                <button key={comp.uuid} onClick={() => setActiveCompUuid(comp.uuid)} title={assetType ? `${assetType} · ${comp.type}` : comp.type || undefined} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "8px 16px", fontSize: 12, fontWeight: isActive ? 700 : 500,
                  color: isActive ? colors.cobalt : colors.gray,
                  background: isActive ? alpha(colors.cobalt, 4) : "transparent",
                  border: "none", borderBottom: isActive ? `2px solid ${colors.cobalt}` : "2px solid transparent",
                  cursor: "pointer", transition: "all .12s", marginBottom: -2, fontFamily: fonts.sans,
                }}>
                  {navIcon(typeIcon, typeColor, 14)}
                  <span>{comp.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active component content */}
          {(() => {
            const compUuid = activeCompUuid;
            const activeComp = allComponents.find((c) => c.uuid === compUuid);

            /* Requirement-level by-component for this component */
            const reqBc = ir.byComponents.find((bc) => bc.componentUuid === compUuid);

            /* Statement-level by-components for this component */
            const stmtEntries = ir.statements
              .map((st) => {
                const bc = st.byComponents.find((b) => b.componentUuid === compUuid);
                return bc ? { statement: st, bc } : null;
              })
              .filter(Boolean) as { statement: SspStatement; bc: ByComponent }[];

            return (
              <div>
                {/* Component info bar: status + implementation-status */}
                {activeComp && (activeComp.status || reqBc?.implementationStatus) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {activeComp.status && <ComponentStateBadge state={activeComp.status} />}
                    {reqBc?.implementationStatus && <ImplStatusBadge status={reqBc.implementationStatus} />}
                  </div>
                )}

                {/* Requirement-level by-component (Implementation + tabbed disclosure) */}
                {reqBc && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, color: colors.cobalt, letterSpacing: 0.5, marginBottom: 6 }}>
                      Component Implementation
                    </div>
                    <ByComponentTabs key={reqBc.uuid} bc={reqBc} size="req" leveragedIndex={leveragedIndex} backMatter={ssp.backMatter} sourceUrl={sourceUrl} onOpenArtifact={setActiveArtifact} />
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
                              fontSize: 13, color: colors.cobalt, lineHeight: 1.7,
                              padding: "6px 10px", backgroundColor: alpha(colors.cobalt, 3),
                              border: `1px solid ${alpha(colors.cobalt, 13)}`, borderRadius: radii.sm,
                              marginBottom: 8, fontStyle: "italic",
                            }}>
                              {getCatalogLabel(catalogPart.props) && (
                                <span style={{ fontWeight: 700, fontFamily: fonts.mono, marginRight: 6, fontStyle: "normal" }}>
                                  {getCatalogLabel(catalogPart.props)}
                                </span>
                              )}
                              <CatalogProseWithParams text={catalogPart.prose} paramMap={catalogParamMap} />
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, fontWeight: 600, color: colors.brightBlue, fontFamily: fonts.mono, marginBottom: 4 }}>
                              {st.statementId}
                            </div>
                          )}
                          {/* Statement-level implementation-status */}
                          {bc.implementationStatus && (
                            <div style={{ marginBottom: 6 }}>
                              <ImplStatusBadge status={bc.implementationStatus} />
                            </div>
                          )}
                          {/* Component's implementation for this statement (tabbed disclosure) */}
                          <ByComponentTabs key={bc.uuid} bc={bc} size="stmt" leveragedIndex={leveragedIndex} backMatter={ssp.backMatter} sourceUrl={sourceUrl} onOpenArtifact={setActiveArtifact} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {!reqBc && stmtEntries.length === 0 && (
                  <p style={{ fontSize: 13, color: colors.gray, fontStyle: "italic" }}>No implementation details for this component.</p>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Implementation attachments and links */}
      {ir.links.length > 0 && (
        <Card style={{ borderLeft: `4px solid ${implementationAttachmentCount > 0 ? colors.darkGreen : colors.cobalt}` }}>
          <SectionLabel>
            Implementation Attachments & Links ({ir.links.length})
          </SectionLabel>
          {implementationAttachmentCount > 0 && (
            <p style={{ fontSize: 12, color: colors.gray, margin: "0 0 8px" }}>
              {attachmentTitle(implementationAttachmentCount)} referenced by this control implementation.
            </p>
          )}
          <LinkChips
            label={null}
            links={ir.links.map((l) => {
              const artifact = artifactFromLink(l, ssp.backMatter, sourceUrl);
              return artifact
                ? { text: linkDisplayText(l, ssp.backMatter), rel: l.rel, onClick: () => setActiveArtifact(artifact) }
                : { text: linkDisplayText(l, ssp.backMatter), href: l.href, rel: l.rel };
            })}
          />
        </Card>
      )}

      {/* Provider Exports for this control (from leveraged SSPs) */}
      {providerExportGroups.length > 0 && (
        <Card>
          <SectionLabel>
            Provider Exports for {ir.controlId.toUpperCase()}
          </SectionLabel>
          <p style={{ fontSize: 12, color: colors.gray, margin: "0 0 12px" }}>
            Select a loaded provider SSP to inspect what it offers for this control. Provider exports stay grouped separately from the current SSP implementation above.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {providerExportGroups.map((group) => {
              const active = group.title === selectedProviderExport?.title;
              return (
                <button
                  key={group.title}
                  onClick={() => setActiveProviderExport(group.title)}
                  title={group.title}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: radii.sm,
                    border: `1px solid ${active ? colors.purple : colors.paleGray}`,
                    backgroundColor: active ? alpha(colors.purple, 10) : colors.card,
                    color: active ? colors.purple : colors.black,
                    cursor: "pointer", fontSize: 12, fontWeight: 700, maxWidth: 300,
                  }}
                >
                  <IcoLayers size={12} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.title}</span>
                  <span style={{ ...S.badge, marginLeft: 2 }}>{group.components.length}</span>
                </button>
              );
            })}
          </div>

          {selectedProviderExport && (
            <div style={{ border: `1px solid ${alpha(colors.purple, 18)}`, borderRadius: radii.md, overflow: "hidden", backgroundColor: alpha(colors.purple, 3) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", backgroundColor: alpha(colors.purple, 8), borderBottom: `1px solid ${alpha(colors.purple, 18)}` }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: colors.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedProviderExport.title}>
                    {selectedProviderExport.title}
                  </div>
                  <div style={{ fontSize: 10, color: colors.gray, marginTop: 2 }}>
                    {selectedProviderExport.components.length} exporting component{selectedProviderExport.components.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <StatChip value={selectedProviderExport.providedCount} label="Provided" color={colors.darkGreen} />
                <StatChip value={selectedProviderExport.responsibilityCount} label="Responsibilities" color={colors.orange} />
              </div>

              <div style={{ display: "grid", gap: 10, padding: 12 }}>
                {selectedProviderExport.components.map((entry, ei) => (
                  <div key={`${entry.providerComponentTitle}-${ei}`} style={{ backgroundColor: colors.card, borderRadius: radii.sm, border: `1px solid ${colors.paleGray}`, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "9px 12px", borderBottom: `1px solid ${colors.bg}` }}>
                      <IcoCube size={13} style={{ color: colors.purple }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.navy, flex: 1, minWidth: 180 }}>{entry.providerComponentTitle}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: colors.darkGreen }}>{entry.provided.length} provided</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: colors.orange }}>{entry.responsibilities.length} responsibilities</span>
                    </div>

                    {entry.description && (
                      <div style={{ padding: "8px 12px 0" }}>
                        <MarkupBlock value={entry.description} style={{ fontSize: 12 }} />
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, padding: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: 0.5, color: colors.darkGreen, marginBottom: 6 }}>
                          Provided ({entry.provided.length})
                        </div>
                        {entry.provided.length === 0 ? (
                          <div style={{ fontSize: 11, color: colors.gray, fontStyle: "italic" }}>No provided entries.</div>
                        ) : entry.provided.map((p, pi) => (
                          <div key={pi} style={{ padding: "8px 10px", marginBottom: 6, backgroundColor: alpha(colors.darkGreen, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.darkGreen}` }}>
                            <MarkupBlock value={p.description} style={{ fontSize: 11.5 }} />
                            {p.responsibleRoles.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                                {p.responsibleRoles.map((rr, ri) => (
                                  <span key={ri} style={{ fontSize: 8, padding: "1px 5px", borderRadius: radii.pill, backgroundColor: colors.darkGreen, color: colors.white, fontWeight: 500 }}>
                                    {rr.roleId}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: 0.5, color: colors.orange, marginBottom: 6 }}>
                          Customer Responsibilities ({entry.responsibilities.length})
                        </div>
                        {entry.responsibilities.length === 0 ? (
                          <div style={{ fontSize: 11, color: colors.gray, fontStyle: "italic" }}>No customer responsibilities.</div>
                        ) : entry.responsibilities.map((r, ri) => (
                          <div key={ri} style={{ padding: "8px 10px", marginBottom: 6, backgroundColor: alpha(colors.orange, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.orange}` }}>
                            <MarkupBlock value={r.description} style={{ fontSize: 11.5 }} />
                            {r.responsibleRoles.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                                {r.responsibleRoles.map((rr, rri) => (
                                  <span key={rri} style={{ fontSize: 8, padding: "1px 5px", borderRadius: radii.pill, backgroundColor: colors.orange, color: colors.white, fontWeight: 500 }}>
                                    {rr.roleId}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <ArtifactModal artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />

      {/* Responsible Roles */}
      {ir.responsibleRoles.length > 0 && (
        <Card>
          <SectionLabel>Responsible Roles</SectionLabel>
          <div style={{ display: "grid", gap: 8 }}>
            {ir.responsibleRoles.map((rr, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                padding: "8px 10px", borderRadius: radii.md,
                backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.paleGray}`,
              }}>
                <span style={{ fontSize: 12, color: colors.navy, fontWeight: 800, fontFamily: fonts.mono }}>{rr.roleId}</span>
                {rr.partyUuids.map((pu) => <PartyChip key={pu} party={partyByUuid.get(pu)} fallbackUuid={pu} />)}
              </div>
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

function BackMatterView({ ssp, sourceUrl }: { ssp: SspParsed; sourceUrl?: string | null }) {
  const resources = ssp.backMatter;
  const [activeArtifact, setActiveArtifact] = useState<ArtifactItem | null>(null);
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
          {r.base64 && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setActiveArtifact({
                  title: r.title || r.uuid.slice(0, 12),
                  href: dataUrlFromBase64(r.base64!),
                  mediaType: r.base64!.mediaType || mediaTypeFromFilename(r.base64!.filename),
                  fileName: r.base64!.filename,
                  description: r.description,
                })}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: radii.pill, backgroundColor: alpha(colors.cobalt, 8), color: colors.cobalt, fontWeight: 700 }}
              >
                Preview embedded artifact{r.base64.mediaType ? ` (${r.base64.mediaType})` : ""}
              </button>
            </div>
          )}
          {r.rlinks && r.rlinks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {r.rlinks.map((rl, i) => {
                const artifact = artifactFromRlink(rl, r.title || r.uuid.slice(0, 12), r.description, sourceUrl);
                return artifact ? (
                  <button key={i} onClick={() => setActiveArtifact(artifact)} style={{ fontSize: 10.5, color: colors.cobalt, background: "transparent", padding: 0, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <IcoLink size={10} />{trunc(rl.href, 60)}
                  </button>
                ) : (
                  <a key={i} href={rl.href} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10.5, color: colors.cobalt, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <IcoLink size={10} />{trunc(rl.href, 60)}
                  </a>
                );
              })}
            </div>
          )}
        </Card>
      ))}
      <ArtifactModal artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SSP COMPONENT DETAIL VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

/** Renders component link relationships (depends-on, uses-service, uses-network)
 *  as click-through chips that navigate to the referenced component's detail. */
function ComponentRelationships({
  comp, ssp, navigate,
}: {
  comp: SspComponent; ssp: SspParsed; navigate: (id: string) => void;
}) {
  const components = ssp.systemImplementation.components;
  const indexByUuid = useMemo(() => {
    const m = new Map<string, number>();
    components.forEach((c, i) => m.set(c.uuid, i));
    return m;
  }, [components]);

  const groups: { rel: string; label: string; description: string; targets: { idx: number; comp: SspComponent }[] }[] = [
    { rel: "depends-on", label: "Depends On", description: "Components this component has a dependency on." },
    { rel: "uses-service", label: "Uses Service", description: "Service components this component uses." },
    { rel: "uses-network", label: "Uses Network", description: "Network components this component uses." },
  ].map((g) => {
    const targets = comp.links
      .filter((l) => l.rel === g.rel)
      .map((l) => indexByUuid.get(hrefToUuid(l.href)))
      .filter((idx): idx is number => idx !== undefined)
      .map((idx) => ({ idx, comp: components[idx] }));
    return { ...g, targets };
  }).filter((g) => g.targets.length > 0);

  if (groups.length === 0) return null;

  return (
    <Card>
      <SectionLabel>Relationships</SectionLabel>
      {groups.map((g) => (
        <div key={g.rel} style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors.navy, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
            {g.label}
          </div>
          <div style={{ fontSize: 11, color: colors.gray, marginBottom: 6 }}>{g.description}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {g.targets.map(({ idx, comp: target }) => {
              const { iconKey, color: iconColor } = componentIcon(target);
              return (
                <span
                  key={target.uuid}
                  onClick={() => navigate(`ssp-comp-${idx}`)}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: radii.pill,
                    background: alpha(iconColor, 0.12),
                    color: iconColor,
                    border: `1px solid ${alpha(iconColor, 0.35)}`,
                    fontWeight: 600, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  {navIcon(iconKey, iconColor, 11)}
                  {target.title || target.uuid.slice(0, 8)}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </Card>
  );
}

function SspComponentDetailView({
  comp, ssp, navigate,
}: {
  comp: SspComponent; ssp: SspParsed; navigate: (id: string) => void;
}) {
  /* Find all control implementations that reference this component */
  const relatedIRs = useMemo(() => {
    return ssp.controlImplementation.implementedRequirements.filter((ir) => {
      const byComp = ir.byComponents.some((bc) => bc.componentUuid === comp.uuid);
      const byStmt = ir.statements.some((st) =>
        st.byComponents.some((bc) => bc.componentUuid === comp.uuid),
      );
      return byComp || byStmt;
    });
  }, [ssp, comp.uuid]);

  /* Inventory items referencing this component */
  const relatedInventory = useMemo(() => {
    return ssp.systemImplementation.inventoryItems.filter((ii) =>
      ii.implementedComponents.some((ic) => ic.componentUuid === comp.uuid),
    );
  }, [ssp, comp.uuid]);

  const { iconKey, color: iconColor, assetType } = componentIcon(comp);
  const oscalProps = oscalNamespaceProps(comp.props);

  return (
    <div>
      {/* Breadcrumbs */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12, color: colors.gray }}>
        <span style={{ cursor: "pointer", color: colors.cobalt }} onClick={() => navigate("sys-impl")}>System Implementation</span>
        <span>›</span>
        <span style={{ cursor: "pointer", color: colors.cobalt }} onClick={() => navigate("sys-impl-components")}>Components</span>
        <span>›</span>
        <span style={{ fontWeight: 600, color: colors.navy }}>{comp.title}</span>
      </div>

      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: radii.md, backgroundColor: alpha(iconColor, 10), color: iconColor,
          border: `1px solid ${alpha(iconColor, 24)}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {navIcon(iconKey, iconColor, 30)}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 20, color: colors.navy, margin: "0 0 5px" }}>{comp.title}</h1>
          <span title={comp.uuid} style={{
            maxWidth: 420, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: radii.pill,
            backgroundColor: colors.surfaceSubtle, border: `1px solid ${colors.paleGray}`, color: colors.gray, fontSize: 10, fontWeight: 600,
          }}>
            {navIcon("tag", colors.gray, 10)}
            <span style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>UUID</span>
            <span style={{ fontFamily: fonts.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{comp.uuid}</span>
          </span>
        </div>
      </div>

      {/* Fields */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          {assetType && <VisualField label="Asset Type" value={assetType} icon={iconKey} color={iconColor} mono iconSize={30} iconBoxSize={54} minHeight={86} valueSize={15} />}
          <VisualField label="Type" value={comp.type || "—"} icon={componentTypeNavKey(comp.type)} color={componentTypeColor(comp.type)} mono iconSize={30} iconBoxSize={54} minHeight={86} valueSize={15} />
          <VisualField label="Status" value={comp.status || "—"} icon={componentStatusIconKey(comp.status)} color={componentStatusColor(comp.status)} iconSize={30} iconBoxSize={54} minHeight={86} valueSize={15} />
          <VisualField label="Related Controls" value={relatedIRs.length} icon="shield" color={colors.orange} iconSize={30} iconBoxSize={54} minHeight={86} valueSize={15} />
          <VisualField label="Inventory Items" value={relatedInventory.length} icon="box" color={colors.darkGreen} iconSize={30} iconBoxSize={54} minHeight={86} valueSize={15} />
        </div>
      </Card>

      {/* OSCAL namespace properties */}
      {oscalProps.length > 0 && (
        <Card style={{ borderLeft: `4px solid ${iconColor}` }}>
          <SectionLabel>OSCAL Properties ({oscalProps.length})</SectionLabel>
          <p style={{ fontSize: 11, color: colors.gray, margin: "-4px 0 10px", fontFamily: fonts.mono }}>
            {OSCAL_NAMESPACE}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {oscalProps.map((p, i) => (
              <div key={i} style={{
                padding: "8px 10px", borderRadius: radii.sm,
                backgroundColor: alpha(iconColor, 7), border: `1px solid ${alpha(iconColor, 22)}`,
              }}>
                <div style={{ fontSize: 9, color: iconColor, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 800, marginBottom: 2 }}>
                  {propDisplayName(p)}
                </div>
                <div style={{ fontSize: 12, color: colors.navy, fontFamily: fonts.mono, fontWeight: 700, wordBreak: "break-word" }}>{p.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Description */}
      {comp.description && (
        <Card>
          <SectionLabel>Description</SectionLabel>
          <MarkupBlock value={comp.description} />
        </Card>
      )}

      {/* Properties */}
      {comp.props.length > 0 && (
        <Card>
          <SectionLabel>Properties ({comp.props.length})</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {comp.props.map((p, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: radii.sm,
                background: colors.surfaceSubtle, color: colors.navy, fontFamily: fonts.mono,
              }}>
                {p.name}: {p.value}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Relationships — depends-on, uses-service, uses-network */}
      <ComponentRelationships comp={comp} ssp={ssp} navigate={navigate} />

      {/* Inventory Items */}
      {relatedInventory.length > 0 && (
        <Card>
          <SectionLabel>Inventory Items ({relatedInventory.length})</SectionLabel>
          {relatedInventory.map((ii) => {
            const { iconKey, color: iconColor } = inventoryItemIcon(ii, ssp.systemImplementation.components);
            return (
              <div key={ii.uuid} style={{
                padding: "8px 0", borderBottom: `1px solid ${colors.bg}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {navIcon(iconKey, iconColor, 13)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: colors.navy }}>{ii.description || ii.uuid.slice(0, 12)}</div>
                  {ii.props.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                      {ii.props.map((p, pi) => (
                        <span key={pi} style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 2, background: colors.bg, color: colors.gray, fontFamily: fonts.mono }}>
                          {p.name}: {p.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Related Controls */}
      {relatedIRs.length > 0 && (
        <Card>
          <SectionLabel>Related Controls ({relatedIRs.length})</SectionLabel>
          <p style={{ fontSize: 12, color: colors.gray, margin: "0 0 8px" }}>
            Controls that include implementation statements from this component.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {relatedIRs.map((ir) => (
              <span
                key={ir.uuid}
                onClick={() => navigate(`ctrl-${ir.controlId}`)}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: radii.pill,
                  backgroundColor: colors.navy, color: colors.white, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {ir.controlId.toUpperCase()}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* By-component descriptions for each related control */}
      {relatedIRs.length > 0 && (
        <Card>
          <SectionLabel>Implementation Statements</SectionLabel>
          {relatedIRs.map((ir) => {
            const byComps = ir.byComponents.filter((bc) => bc.componentUuid === comp.uuid);
            const stmtByComps = ir.statements.flatMap((st) =>
              st.byComponents
                .filter((bc) => bc.componentUuid === comp.uuid)
                .map((bc) => ({ ...bc, statementId: st.statementId })),
            );
            return (
              <div key={ir.uuid} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${colors.bg}` }}>
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: colors.orange, cursor: "pointer", marginBottom: 4 }}
                  onClick={() => navigate(`ctrl-${ir.controlId}`)}
                >
                  {ir.controlId.toUpperCase()}
                </div>
                {byComps.map((bc) => (
                  <div key={bc.uuid} style={{ marginLeft: 12, marginBottom: 4 }}>
                    {bc.implementationStatus && (
                      <div style={{ marginBottom: 4 }}><ImplStatusBadge status={bc.implementationStatus} /></div>
                    )}
                    <MarkupBlock value={bc.description} style={{ fontSize: 12.5 }} />
                    {bc.remarks && <CollapsibleRemarks value={bc.remarks} compact />}
                  </div>
                ))}
                {stmtByComps.map((sbc) => (
                  <div key={sbc.uuid} style={{ marginLeft: 12, marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: colors.gray }}>
                        Statement: {sbc.statementId}
                      </span>
                      {sbc.implementationStatus && <ImplStatusBadge status={sbc.implementationStatus} />}
                    </div>
                    <MarkupBlock value={sbc.description} style={{ fontSize: 12.5 }} />
                    {sbc.remarks && <CollapsibleRemarks value={sbc.remarks} compact />}
                  </div>
                ))}
              </div>
            );
          })}
        </Card>
      )}
    </div>
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

/* ── Provider-only control view (control exists only in a leveraged SSP) ── */
function ProviderOnlyControlView({ controlId, entries }: { controlId: string; entries: import("../hooks/useLeveragedIndex").ControlExportEntry[] }) {
  const familyLabel = FAMILY_NAMES[getFamily(controlId)] || "";
  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <IcoTag size={20} style={{ color: colors.purple }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.navy, margin: 0 }}>
            {controlId.toUpperCase()}{familyLabel ? ` ${familyLabel}` : ""}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: radii.pill,
            backgroundColor: colors.purple, color: colors.white, fontWeight: 600,
          }}>
            PROVIDER ONLY
          </span>
          <span style={{ fontSize: 12, color: colors.gray }}>
            This control is not implemented locally — it is available from a leveraged provider SSP.
          </span>
        </div>
      </Card>
      {entries.map((entry, ei) => (
        <Card key={ei}>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy, marginBottom: 2 }}>
            {entry.providerSspTitle}
          </div>
          <div style={{ fontSize: 11, color: colors.gray, marginBottom: 8 }}>
            Component: {entry.providerComponentTitle}
          </div>
          {entry.description && (
            <MarkupBlock value={entry.description} style={{ fontSize: 12, marginBottom: 10 }} />
          )}
          {entry.provided.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: colors.darkGreen, marginBottom: 4 }}>
                Provided ({entry.provided.length})
              </div>
              {entry.provided.map((p, pi) => (
                <div key={pi} style={{ padding: "8px 12px", marginBottom: 4, backgroundColor: alpha(colors.darkGreen, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.darkGreen}` }}>
                  <MarkupBlock value={p.description} style={{ fontSize: 12 }} />
                  {p.responsibleRoles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                      {p.responsibleRoles.map((rr, ri) => (
                        <span key={ri} style={{ fontSize: 9, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.darkGreen, color: colors.white, fontWeight: 500 }}>
                          {rr.roleId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {entry.responsibilities.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: colors.orange, marginBottom: 4 }}>
                Customer Responsibilities ({entry.responsibilities.length})
              </div>
              {entry.responsibilities.map((r, ri) => (
                <div key={ri} style={{ padding: "8px 12px", marginBottom: 4, backgroundColor: alpha(colors.orange, 5), borderRadius: radii.sm, borderLeft: `3px solid ${colors.orange}` }}>
                  <MarkupBlock value={r.description} style={{ fontSize: 12 }} />
                  {r.responsibleRoles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                      {r.responsibleRoles.map((rr, rri) => (
                        <span key={rri} style={{ fontSize: 9, padding: "1px 6px", borderRadius: radii.pill, backgroundColor: colors.orange, color: colors.white, fontWeight: 500 }}>
                          {rr.roleId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

interface ViewRouterProps {
  view: string;
  ssp: SspParsed;
  navigate: (id: string) => void;
  catalog: OscalCatalog | null;
  leveragedIndex: LeveragedIndex;
  sourceUrl?: string | null;
}

function ViewRouter({ view, ssp, navigate, catalog, leveragedIndex, sourceUrl }: ViewRouterProps) {
  const oscal = useOscal();
  const profileControlIds = useMemo(
    () => getExpectedControlIds(oscal.profile?.data, catalog),
    [oscal.profile, catalog],
  );
  if (view === "overview") return <OverviewView ssp={ssp} leveragedIndex={leveragedIndex} navigate={navigate} />;
  if (view === "metadata") return <MetadataView ssp={ssp} />;
  if (view === "sys-char") return <SystemCharacteristicsView ssp={ssp} sourceUrl={sourceUrl} />;
  if (view === "sys-char-auth-diagrams") return <DiagramSectionView title="Authorization Diagrams" section={ssp.systemCharacteristics.authorizationBoundary} backMatter={ssp.backMatter} sourceUrl={sourceUrl} />;
  if (view === "sys-char-network-diagrams") return <DiagramSectionView title="Network Diagrams" section={ssp.systemCharacteristics.networkArchitecture} backMatter={ssp.backMatter} sourceUrl={sourceUrl} />;
  if (view === "sys-char-data-diagrams") return <DiagramSectionView title="Data Flow Diagrams" section={ssp.systemCharacteristics.dataFlow} backMatter={ssp.backMatter} sourceUrl={sourceUrl} />;
  if (view === "sys-impl") return <SystemImplementationView ssp={ssp} navigate={navigate} />;
  if (view === "sys-impl-components") return <ComponentsView ssp={ssp} navigate={navigate} />;
  if (view === "sys-impl-users") return <UsersView ssp={ssp} />;
  if (view === "sys-impl-inventory") return <InventoryView ssp={ssp} />;
  if (view === "sys-impl-leveraged") return <LeveragedView ssp={ssp} navigate={navigate} sourceUrl={sourceUrl} />;
  if (view === "ctrl-impl") return <ControlImplementationView ssp={ssp} navigate={navigate} leveragedIndex={leveragedIndex} />;
  if (view === "back-matter") return <BackMatterView ssp={ssp} sourceUrl={sourceUrl} />;

  /* leveraged-auth-<index> — individual leveraged authorization detail */
  const leveragedMatch = view.match(/^leveraged-auth-(\d+)$/);
  if (leveragedMatch) {
    const idx = parseInt(leveragedMatch[1], 10);
    const la = ssp.systemImplementation.leveragedAuthorizations[idx];
    if (la) return <LeveragedAuthDetailView ssp={ssp} authIndex={idx} navigate={navigate} leveragedIndex={leveragedIndex} />;
  }

  /* ssp-comp-<index> — component detail */
  const compMatch = view.match(/^ssp-comp-(\d+)$/);
  if (compMatch) {
    const idx = parseInt(compMatch[1], 10);
    const comp = ssp.systemImplementation.components[idx];
    if (comp) return <SspComponentDetailView comp={comp} ssp={ssp} navigate={navigate} />;
  }

  /* ctrl-family-<prefix> — family group view */
  const famMatch = view.match(/^ctrl-family-(.+)$/);
  if (famMatch) {
    return <ControlFamilyView familyId={famMatch[1]} ssp={ssp} navigate={navigate} leveragedIndex={leveragedIndex} />;
  }

  /* ctrl-<control-id> */
  const ctrlMatch = view.match(/^ctrl-(.+)$/);
  if (ctrlMatch) {
    const controlId = ctrlMatch[1];
    const ir = ssp.controlImplementation.implementedRequirements.find(
      (r) => r.controlId === controlId,
    );
    if (ir) return <ControlDetailView ir={ir} ssp={ssp} catalog={catalog} leveragedIndex={leveragedIndex} sourceUrl={sourceUrl} />;
    /* Provider-only control — no local implementation but exists in leveraged index */
    const providerEntries = leveragedIndex.byControl.get(controlId);
    if (providerEntries) return <ProviderOnlyControlView controlId={controlId} entries={providerEntries} />;
    if (profileControlIds.includes(controlId)) return <MissingControlView controlId={controlId} catalog={catalog} hasProvider={false} navigate={navigate} />;
  }

  return <NotFoundView view={view} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SspPage() {
  const oscal = useOscal();
  const { token: authToken } = useAuth();
  const raw = oscal.ssp?.data ?? null;
  const fileName = oscal.ssp?.fileName ?? "";
  const urlDoc = useUrlDocument();
  const sourceUrl = oscal.ssp?.sourceUrl ?? urlDoc.sourceUrl;

  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const sidebar = useResizableSidebar({ storageKey: "oscal-viewer.sidebar.ssp.width" });
  const [mobilePath, setMobilePath] = useState<string[]>([]);
  const [mobileShowContent, setMobileShowContent] = useState(false);
  useAnalyticsView("System Security Plan", view);

  /* ── Leveraged SSP index ── */
  const leveragedIndex = useLeveragedIndex(oscal.leveragedSsps);
  const catalogSort = useCatalogSortIndex();

  /* ── Auto-load from ?url= query param ── */
  useEffect(() => {
    if (!urlDoc.json || oscal.ssp) return;
    try {
      const inner = (urlDoc.json as Record<string, unknown>)["system-security-plan"] ?? urlDoc.json;
      if (!(inner as Record<string, unknown>).metadata)
        throw new Error("Not a valid OSCAL SSP — missing metadata.");
      oscal.setSsp(urlDoc.json, fileNameFromUrl(urlDoc.sourceUrl!), urlDoc.sourceUrl);
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

  /* ── Auto-resolve SSP dependency graph ── */
  const storedResolved = useRef(new Set<string>());
  useEffect(() => {
    storedResolved.current.clear();
  }, [raw]);
  const handleResolved = useCallback((doc: ResolvedOscalDocument) => {
    const key = `${doc.modelKey}:${doc.url}`;
    if (storedResolved.current.has(key)) return;
    storedResolved.current.add(key);
    if (doc.modelKey === "profile" && !storedResolved.current.has("slot:profile")) {
      storedResolved.current.add("slot:profile");
      if (oscal.profile?.sourceUrl !== doc.url) {
        oscal.setProfile(doc.data, doc.label, doc.url);
      }
    }
    if (doc.modelKey === "catalog" && !storedResolved.current.has("slot:catalog")) {
      storedResolved.current.add("slot:catalog");
      if (oscal.catalog?.sourceUrl !== doc.url) {
        oscal.setCatalog(doc.data as unknown as import("../context/OscalContext").Catalog, doc.label, doc.url);
      }
    }
    if (doc.modelKey === "system-security-plan" && doc.relation === "leveraged authorization") {
      oscal.addLeveragedSsp(doc.json, doc.label, doc.url, doc.boundLaUuid);
    }
  }, [oscal]);
  const sspResolutionAlreadySatisfied = useMemo(() => {
    if (!ssp) return false;

    const importProfileHref = (raw as any)?.["system-security-plan"]?.["import-profile"]?.href
      ?? (raw as any)?.["import-profile"]?.href;
    if (importProfileHref && !oscal.profile) return false;

    const profileData = oscal.profile?.data ? ((oscal.profile.data as any)?.profile ?? oscal.profile.data) : null;
    const profileImports = Array.isArray((profileData as any)?.imports) ? (profileData as any).imports : [];
    if (profileImports.length > 0 && !oscal.catalog) return false;

    const leveraged = ssp.systemImplementation.leveragedAuthorizations.filter((la) => isAutoResolvableHref(pickLeveragedHref(la), sourceUrl));
    if (leveraged.some((la) => {
      const href = pickLeveragedHref(la);
      const resolvedHref = resolvePotentialHref(href, sourceUrl);
      return !oscal.leveragedSsps.some((entry) =>
        entry.boundLaUuid === la.uuid || (resolvedHref ? loadedEntryMatchesUrl(entry, resolvedHref) : false),
      );
    })) return false;

    return Boolean(importProfileHref || profileImports.length > 0 || leveraged.length > 0);
  }, [oscal.catalog, oscal.leveragedSsps, oscal.profile, raw, sourceUrl, ssp]);
  const graphResolver = useOscalGraphResolver({
    root: raw,
    rootModelKey: "system-security-plan",
    rootBaseUrl: sourceUrl,
    rootLabel: fileName || ssp?.metadata.title || "Loaded SSP",
    rootOrigin: sourceUrl ? "auto" : "manual",
    token: authToken,
    skip: sspResolutionAlreadySatisfied,
    getCachedDocument: useCallback((target: GraphResolverCachedTarget) => {
      if (target.modelKey === "profile" && oscal.profile && loadedEntryMatchesUrl(oscal.profile, target.url)) {
        return {
          json: oscal.profile.data,
          label: oscal.profile.fileName,
          url: oscal.profile.sourceUrl ?? target.url,
        };
      }
      if (target.modelKey === "catalog" && oscal.catalog && loadedEntryMatchesUrl(oscal.catalog, target.url)) {
        return {
          json: oscal.catalog.data,
          label: oscal.catalog.fileName,
          url: oscal.catalog.sourceUrl ?? target.url,
        };
      }
      if (target.modelKey === "system-security-plan" && target.relation === "leveraged authorization") {
        const leveraged = oscal.leveragedSsps.find((entry) =>
          (target.boundLaUuid && entry.boundLaUuid === target.boundLaUuid) || loadedEntryMatchesUrl(entry, target.url),
        );
        if (leveraged) {
          return {
            json: leveraged.data,
            label: leveraged.fileName,
            url: leveraged.sourceUrl ?? target.url,
          };
        }
      }
      return null;
    }, [oscal.catalog, oscal.leveragedSsps, oscal.profile]),
    onResolved: handleResolved,
  });

  /* ── Load file ── */
  const loadFile = useCallback((file: File) => {
    setError("");
    storedResolved.current.clear();
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
    storedResolved.current.clear();
    oscal.clearSsp();
    oscal.clearLeveragedSsps();
    setError("");
    setView("overview");
  }, [oscal]);

  /* ── Navigate ── */
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

  const profileControlIds = useMemo(
    () => getExpectedControlIds(oscal.profile?.data, (oscal.catalog?.data as OscalCatalog) ?? null),
    [oscal.profile, oscal.catalog],
  );

  /* ── Nav tree ── */
  const navTree = useMemo<NavItem[]>(() => {
    if (!ssp) return [];
    const items: NavItem[] = [];
    const si = ssp.systemImplementation;
    const sc = ssp.systemCharacteristics;

    items.push({ id: "overview", label: "Overview", icon: "home", color: colors.darkGreen, depth: 0 });
    items.push({ id: "metadata", label: "Metadata", icon: "info", color: colors.navy, depth: 0 });

    /* System Characteristics */
    items.push({ id: "sys-char", label: "System Characteristics", icon: "server", color: colors.darkGreen, depth: 0 });
    ([
      { id: "sys-char-auth-diagrams", label: "Authorization Diagrams", icon: "layers", color: colors.purple, section: sc.authorizationBoundary },
      { id: "sys-char-network-diagrams", label: "Network Diagrams", icon: "network", color: colors.cobalt, section: sc.networkArchitecture },
      { id: "sys-char-data-diagrams", label: "Data Flow Diagrams", icon: "link", color: colors.darkGreen, section: sc.dataFlow },
    ] as const).forEach((entry) => {
      const count = buildDiagramAssets(entry.section.diagrams, ssp.backMatter, urlDoc.sourceUrl).length;
      if (count === 0) return;
      items.push({
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        color: entry.color,
        depth: 1,
        parent: "sys-char",
        childCount: count,
        title: `View ${count} ${entry.label.toLowerCase()}`,
      });
    });

    /* System Implementation */
    items.push({ id: "sys-impl", label: "System Implementation", icon: "cube", color: colors.cobalt, depth: 0 });
    if (si.components.length > 0) {
      items.push({ id: "sys-impl-components", label: "Components", icon: "cube", color: colors.cobalt, depth: 1, parent: "sys-impl", childCount: si.components.length });
    }

    /* Build service-component hierarchy and emit nav items in tree order. */
    const hierarchy = buildComponentHierarchy(si.components);
    const emitComponent = (compIdx: number, depth: number, parentId: string): void => {
      const c = si.components[compIdx];
      const navId = `ssp-comp-${compIdx}`;
      const children = hierarchy.childrenByIndex.get(compIdx);
      const { iconKey, color: iconColor } = componentIcon(c);
      items.push({
        id: navId,
        label: c.title || c.uuid.slice(0, 12),
        icon: iconKey,
        color: iconColor,
        depth,
        parent: parentId,
        childCount: children?.length,
        title: c.uuid,
      });
      children?.forEach((childIdx) => emitComponent(childIdx, depth + 1, navId));
    };
    if (si.components.length > 0) {
      hierarchy.rootIndices.forEach((idx) => emitComponent(idx, 2, "sys-impl-components"));
    }
    if (si.users.length > 0) {
      items.push({ id: "sys-impl-users", label: "Users", icon: "users", color: colors.brightBlue, depth: 1, parent: "sys-impl", childCount: si.users.length });
    }
    if (si.inventoryItems.length > 0) {
      items.push({ id: "sys-impl-inventory", label: "Inventory Items", icon: "box", color: colors.darkGreen, depth: 1, parent: "sys-impl", childCount: si.inventoryItems.length });
    }
    if (si.leveragedAuthorizations.length > 0) {
      items.push({ id: "sys-impl-leveraged", label: "Leveraged Authorizations", icon: "link", color: colors.purple, depth: 1, parent: "sys-impl", childCount: si.leveragedAuthorizations.length });

      const loadedLaUuids = new Set(oscal.leveragedSsps.map((entry) => entry.boundLaUuid).filter(Boolean));

      si.leveragedAuthorizations.forEach((la, i) => {
        const loaded = loadedLaUuids.has(la.uuid);
        items.push({
          id: `leveraged-auth-${i}`,
          label: la.title || la.uuid.slice(0, 12),
          icon: loaded ? "layers" : "link",
          color: loaded ? colors.purple : colors.blueGray,
          depth: 2,
          parent: "sys-impl-leveraged",
          title: loaded ? "Provider SSP loaded" : "No provider SSP loaded",
          iconBadge: loaded ? "loaded" : undefined,
        });
      });
    }

    /* Control Implementation — group by family */
    items.push({ id: "ctrl-impl", label: "Control Implementation", icon: "shield", color: colors.orange, depth: 0 });

    /* Build the control family map from the resolved profile controls first,
       then decorate / extend it with current SSP implementations and provider
       offerings. Profile-selected controls with no implementation show as
       missing unless a leveraged authorization offers them. */
    const familyMap: Record<string, ControlNavEntry[]> = {};
    buildControlEntries(ssp, leveragedIndex, profileControlIds).forEach((entry) => {
      const fam = getFamily(entry.controlId);
      (familyMap[fam] ??= []).push(entry);
    });

    const sortedFamilies = Object.entries(familyMap).sort(([a], [b]) => catalogSort.compare(a, b));

    sortedFamilies.forEach(([fam, entries]) => {
      const famId = `ctrl-family-${fam}`;

      /* Separate base controls from enhancements */
      const controlIdSet = new Set(entries.map((e) => e.controlId));
      const baseEntries: ControlNavEntry[] = [];
      const enhancementMap: Record<string, ControlNavEntry[]> = {};
      const familyAttachmentCount = entries.reduce((count, entry) => count + entry.attachmentCount, 0);

      entries.forEach((entry) => {
        const parentId = getParentControlId(entry.controlId);
        if (parentId && controlIdSet.has(parentId)) {
          (enhancementMap[parentId] ??= []).push(entry);
        } else {
          baseEntries.push(entry);
        }
      });

      /* Sort base controls and enhancements by catalog sort-id */
      baseEntries.sort((a, b) => catalogSort.compare(a.controlId, b.controlId));
      Object.values(enhancementMap).forEach((arr) => arr.sort((a, b) => catalogSort.compare(a.controlId, b.controlId)));

      const providerCount = entries.filter((entry) => entry.hasProvider).length;
      const currentCount = entries.filter((entry) => entry.hasCurrent).length;
      const allLeveraged = entries.length > 0 && providerCount === entries.length;
      const mixedLeveraged = providerCount > 0 && !allLeveraged;
      const allMissing = entries.length > 0 && entries.every((entry) => !entry.hasCurrent && !entry.hasProvider);
      const familyHasProvider = providerCount > 0;
      const familyHasCurrent = currentCount > 0;
      const familyIcon = familyHasProvider
        ? controlSourceIconKey(familyHasCurrent, familyHasProvider)
        : allMissing ? "missing-control" : "folder";
      const familyColor = familyHasProvider
        ? controlSourceColor(familyHasCurrent, familyHasProvider)
        : allMissing ? colors.red : colors.cobalt;

      items.push({
        id: famId,
        label: `${fam.toUpperCase()} — ${FAMILY_NAMES[fam] || fam}`,
        icon: familyIcon,
        color: familyColor,
        depth: 1,
        parent: "ctrl-impl",
        childCount: baseEntries.length,
        attachmentCount: familyAttachmentCount || undefined,
        title: [
          allLeveraged ? "All controls in this family are offered by loaded provider SSPs" : undefined,
          mixedLeveraged ? `${providerCount} of ${entries.length} controls in this family are offered by loaded provider SSPs` : undefined,
          allMissing ? "Controls in this family are missing implementation statements" : undefined,
          familyAttachmentCount ? attachmentTitle(familyAttachmentCount) : undefined,
        ].filter(Boolean).join(" · ") || undefined,
      });

      baseEntries.forEach((entry) => {
        const ctrlId = `ctrl-${entry.controlId}`;
        const enhancements = enhancementMap[entry.controlId] ?? [];
        items.push({
          id: ctrlId,
          label: entry.controlId.toUpperCase(),
          icon: controlSourceIconKey(entry.hasCurrent, entry.hasProvider),
          color: controlSourceColor(entry.hasCurrent, entry.hasProvider),
          depth: 2,
          parent: famId,
          childCount: enhancements.length || undefined,
          attachmentCount: entry.attachmentCount || undefined,
          title: [
            controlSourceTitle(entry.hasCurrent, entry.hasProvider),
            entry.attachmentCount ? attachmentTitle(entry.attachmentCount) : undefined,
          ].filter(Boolean).join(" · "),
        });
        enhancements.forEach((enh) => {
          items.push({
            id: `ctrl-${enh.controlId}`,
            label: enh.controlId.toUpperCase(),
            icon: controlSourceIconKey(enh.hasCurrent, enh.hasProvider),
            color: controlSourceColor(enh.hasCurrent, enh.hasProvider),
            depth: 3,
            parent: ctrlId,
            attachmentCount: enh.attachmentCount || undefined,
            title: [
              controlSourceTitle(enh.hasCurrent, enh.hasProvider),
              enh.attachmentCount ? attachmentTitle(enh.attachmentCount) : undefined,
            ].filter(Boolean).join(" · "),
          });
        });
      });
    });

    /* Back matter */
    if (ssp.backMatter.length > 0) {
      items.push({ id: "back-matter", label: "Back Matter", icon: "book", color: colors.gray, depth: 0, childCount: ssp.backMatter.length });
    }

    return items;
  }, [ssp, leveragedIndex, catalogSort, urlDoc.sourceUrl, oscal.leveragedSsps, profileControlIds]);

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

  /* ── Modal for dependency resolution status ── */
  const resolverModalEl = (
    <ResolverModal
      items={graphResolver.items}
      onSkip={graphResolver.cancel}
    />
  );

  /* ── No data — drop zone ── */
  if (!ssp) {
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
  if (isMobile && ssp) {
    if (mobileShowContent) {
      return (
        <div style={S.shell}>
          {resolverModalEl}
          <div style={S.topBar}>
            <button onClick={() => setMobileShowContent(false)} style={S.mobileBackBtn}>← Back</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.white, flex: 1, textAlign: "center" }}>SSP</div>
            <button style={S.topBtn} onClick={handleNewFile}>New</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <ViewRouter view={view} ssp={ssp} navigate={mobileNavigate} catalog={(oscal.catalog?.data as OscalCatalog) ?? null} leveragedIndex={leveragedIndex} sourceUrl={urlDoc.sourceUrl} />
          </div>
        </div>
      );
    }

    /* Drill-down using navTree */
    const currentParent = mobilePath.length > 0 ? mobilePath[mobilePath.length - 1] : null;
    const drillChildren = navTree.filter((item) => {
      if (currentParent === null) return !item.parent;
      return item.parent === currentParent;
    });

    const breadcrumbs: { label: string }[] = [{ label: "SSP" }];
    for (const pid of mobilePath) {
      const n = navTree.find((i) => i.id === pid);
      breadcrumbs.push({ label: n?.label ?? pid });
    }

    return (
      <div style={S.shell}>
        {resolverModalEl}
        <div style={S.topBar}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.white }}>SSP</div>
          <button style={S.topBtn} onClick={handleNewFile}>New</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", backgroundColor: colors.card }}>
          {/* Breadcrumbs */}
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
          {/* Back */}
          {mobilePath.length > 0 && (
            <div onClick={mobileDrillBack}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", fontSize: 14, color: colors.brightBlue, cursor: "pointer", borderBottom: `1px solid ${colors.bg}`, fontWeight: 500, minHeight: 44 }}>
              ← Back
            </div>
          )}
          {/* Items */}
          {drillChildren.map((item) => {
            const hasKids = !!childCounts[item.id];
            return (
              <div key={item.id}
                onClick={() => {
                  if (hasKids) mobileDrillIn(item.id);
                  else mobileNavigate(item.id);
                }}
                title={item.title}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", fontSize: 14, cursor: "pointer", minHeight: 48, borderBottom: `1px solid ${colors.bg}` }}>
                <NavIconWithBadge icon={item.icon} color={item.color} badge={item.iconBadge} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                {item.attachmentCount != null && (
                  <span title={attachmentTitle(item.attachmentCount)} style={S.attachmentIndicator}>
                    <IcoPaperclip size={12} />
                    {item.attachmentCount > 1 && <span>{item.attachmentCount}</span>}
                  </span>
                )}
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

  /* ── Main layout ── */
  return (
    <div style={S.shell}>
      {resolverModalEl}
      {/* Top Bar */}
      <div style={S.topBar}>
        <div style={S.topBarLeft}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.white }}>OSCAL System Security Plan Viewer</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.topBtn} onClick={handleNewFile}>New File</button>
        </div>
      </div>

      <div style={S.body}>
        {/* SIDEBAR */}
        <nav className={`oscal-model-sidebar oscal-sidebar-label-${sidebar.labelMode}`} style={{ ...S.sidebar, ...sidebar.sidebarStyle }}>
          <div style={S.sidebarFilename}>{trunc(fileName, 40)}</div>
          {visibleNav.map((item) => {
            const hasChildren = !!childCounts[item.id];
            const isActive = view === item.id;
            const isCollapsed = !!mergedCollapsed[item.id];

            /* Reserve the chevron column with a spacer for any non-chevron item
               at depth >= 2 so icons align in a consistent column regardless of
               whether siblings (or the parent) have a chevron. Without this,
               leaf children of a chevron-bearing parent visually collapse into
               the same column as the parent icon. */
            const siblingsHaveChildren = item.depth >= 2 && !hasChildren;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (hasChildren) toggleGroup(item.id);
                  navigate(item.id);
                }}
                title={[item.label, item.title].filter(Boolean).join("\n")}
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
                {siblingsHaveChildren && <span style={{ width: 16, flexShrink: 0 }} />}
                <NavIconWithBadge icon={item.icon} color={isActive ? colors.orange : item.color} badge={item.iconBadge} />
                <span style={{
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.label}
                </span>
                {item.attachmentCount != null && (
                  <span title={attachmentTitle(item.attachmentCount)} style={S.attachmentIndicator}>
                    <IcoPaperclip size={12} />
                    {item.attachmentCount > 1 && <span>{item.attachmentCount}</span>}
                  </span>
                )}
                {item.childCount != null && <span style={S.badge}>{item.childCount}</span>}
              </div>
            );
          })}
        </nav>
        <div {...sidebar.resizeHandleProps} style={sidebar.resizeHandleStyle} />

        {/* CONTENT */}
        <div ref={contentRef} style={S.content}>
          <ViewRouter view={view} ssp={ssp} navigate={navigate} catalog={(oscal.catalog?.data as OscalCatalog) ?? null} leveragedIndex={leveragedIndex} sourceUrl={urlDoc.sourceUrl} />
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
    width: 320, minWidth: 320, backgroundColor: colors.card,
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
  attachmentIndicator: {
    display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0,
    fontSize: 10, fontWeight: 800, color: colors.darkGreen,
    backgroundColor: alpha(colors.darkGreen, 9), border: `1px solid ${alpha(colors.darkGreen, 20)}`,
    borderRadius: radii.pill, padding: "1px 5px",
  },
  content: { flex: 1, overflowY: "auto" as const, padding: 24 },
  mobileBackBtn: {
    fontSize: 14, fontWeight: 600, padding: "6px 12px", borderRadius: radii.sm,
    border: "none", cursor: "pointer", backgroundColor: "transparent", color: colors.white, minHeight: 44,
  },
  mobileBreadcrumbs: {
    display: "flex", flexWrap: "wrap" as const, gap: 2, padding: "10px 16px",
    fontSize: 12, color: colors.gray, borderBottom: `1px solid ${colors.bg}`, backgroundColor: colors.bg,
  },
};
