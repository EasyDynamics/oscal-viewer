/* ═══════════════════════════════════════════════════════════════════════════
   useOscalGraphResolver — graph/tree resolution for OSCAL dependencies.

   Handles branching dependency graphs such as:
     • Profile → multiple Catalog imports
     • SSP → Profile → Catalog(s), plus leveraged/provider SSPs
     • AP → SSP and AR → AP and POA&M → SSP
     • Component Definition → imported Component Definitions + Catalog sources
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "../context/AuthContext";
import type { ResolverItem } from "../components/ResolverModal";
import {
  checkUrlFormat,
  resolveHref,
  type BackMatterResource,
  type ResolveStatus,
} from "./useImportResolver";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OscalModelKey =
  | "catalog"
  | "profile"
  | "component-definition"
  | "system-security-plan"
  | "assessment-plan"
  | "assessment-results"
  | "plan-of-action-and-milestones";

interface DependencyTarget {
  href: string;
  label: string;
  modelKey: OscalModelKey;
  accepts?: OscalModelKey[];
  relation: string;
  /** UUID of the leveraged-authorization that introduced this target. */
  boundLaUuid?: string;
  backMatter: BackMatterResource[];
  baseUrl: string | null;
  parentId: string;
  depth: number;
}

export interface GraphResolveNode {
  id: string;
  parentId: string | null;
  label: string;
  modelKey: OscalModelKey;
  relation: string;
  status: ResolveStatus;
  error: string | null;
  /** UI state only; resolved payloads are delivered through onResolved. */
  json: unknown | null;
  resolvedLabel: string | null;
  resolvedUrl: string | null;
  depth: number;
  /** Timestamp used to force a visible timeout if the browser/proxy fetch hangs. */
  startedAt?: number;
}

export interface ResolvedOscalDocument {
  modelKey: OscalModelKey;
  json: unknown;
  data: Record<string, unknown>;
  label: string;
  url: string;
  parentId: string | null;
  relation: string;
  /** UUID of the leveraged-authorization that introduced this document. */
  boundLaUuid?: string;
}

export interface GraphResolverCachedTarget {
  modelKey: OscalModelKey;
  accepts?: OscalModelKey[];
  relation: string;
  href: string;
  url: string;
  parentId: string;
  depth: number;
  boundLaUuid?: string;
}

export interface CachedOscalDocument {
  json: unknown;
  data?: Record<string, unknown>;
  label?: string;
  url?: string;
}

export interface GraphResolverResult {
  nodes: GraphResolveNode[];
  items: ResolverItem[];
  cancel: () => void;
}

interface UseOscalGraphResolverOptions {
  root: unknown | null;
  rootModelKey: OscalModelKey;
  rootBaseUrl: string | null;
  rootLabel?: string | null;
  rootOrigin?: ResolverItem["origin"];
  token: string | null;
  skip?: boolean;
  onResolved?: (doc: ResolvedOscalDocument) => void;
  getCachedDocument?: (target: GraphResolverCachedTarget) => CachedOscalDocument | null | undefined;
}

const MODEL_LABELS: Record<OscalModelKey, string> = {
  catalog: "Catalog",
  profile: "Profile",
  "component-definition": "Component Definition",
  "system-security-plan": "SSP",
  "assessment-plan": "Assessment Plan",
  "assessment-results": "Assessment Results",
  "plan-of-action-and-milestones": "POA&M",
};

const DEPENDENCY_FETCH_TIMEOUT_MS = 20_000;
const PROFILE_FETCH_TIMEOUT_MS = 8_000;

function text(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "prose" in v) return String((v as any).prose);
  return String(v);
}

function fileNameFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || url;
  } catch {
    return url;
  }
}

function unwrapModel(json: unknown, modelKey: OscalModelKey): Record<string, unknown> | null {
  const obj = json as Record<string, unknown> | null;
  if (!obj) return null;
  const inner = (obj[modelKey] ?? obj) as Record<string, unknown> | null;
  if (!inner || typeof inner !== "object") return null;
  if (inner.metadata || inner.uuid) return inner;
  return null;
}

function detectModelKey(json: unknown, preferred: OscalModelKey, accepts: OscalModelKey[] = [preferred]): OscalModelKey | null {
  if (unwrapModel(json, preferred)) return preferred;
  return accepts.find((key) => unwrapModel(json, key)) ?? null;
}

function titleOf(model: Record<string, unknown> | null): string | null {
  const md = model?.metadata as Record<string, unknown> | undefined;
  return (md?.title as string | undefined) ?? (model?.title as string | undefined) ?? null;
}

function backMatterOf(model: Record<string, unknown> | null): BackMatterResource[] {
  return (((model?.["back-matter"] as Record<string, unknown> | undefined)?.resources as BackMatterResource[] | undefined) ?? []);
}

function pickLinkHref(links: any[], relWords: string[]): string | null {
  if (!Array.isArray(links)) return null;

  const semantic = links.find((l) => {
    const searchable = [l?.rel, l?.text, l?.title, l?.["media-type"], l?.mediaType]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return l?.href && relWords.some((word) => searchable.includes(word));
  });
  if (semantic?.href) return semantic.href;

  const jsonLink = links.find((l) => linkMediaType(l).includes("json") && l?.href);
  if (jsonLink?.href) return jsonLink.href;

  const anyJsonHref = links.find((l) => typeof l?.href === "string" && /\.json(?:[?#].*)?$/i.test(l.href));
  return anyJsonHref?.href ?? null;
}

function linkList(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function linkMediaType(link: any): string {
  return String(link?.["media-type"] ?? link?.mediaType ?? "").toLowerCase();
}

function isSspLink(link: any): boolean {
  const rel = String(link?.rel ?? "").toLowerCase();
  const mediaType = linkMediaType(link);
  return Boolean(link?.href) && (
    mediaType.includes("oscal.system-security-plan") ||
    mediaType.includes("system-security-plan") ||
    rel.includes("system-security-plan") ||
    rel.includes("ssp") ||
    rel.includes("leveraged") ||
    rel.includes("provider") ||
    rel.includes("authorization")
  );
}

function sspLinkedTargets(model: Record<string, unknown>, bm: BackMatterResource[], baseUrl: string | null, parentId: string, depth: number): DependencyTarget[] {
  const metadata = model.metadata as Record<string, unknown> | undefined;
  const systemImplementation = model["system-implementation"] as Record<string, unknown> | undefined;
  const links = [
    ...linkList(model.links),
    ...linkList(metadata?.links),
    ...linkList(systemImplementation?.links),
  ];

  return links.filter(isSspLink).map((link, index) => ({
    href: link.href,
    label: link.text || link.title || `Linked SSP ${index + 1}`,
    modelKey: "system-security-plan" as const,
    relation: link.rel ? `ssp link: ${link.rel}` : "ssp link",
    backMatter: bm,
    baseUrl,
    parentId,
    depth,
  }));
}

function pickPropHref(props: any[], names: string[]): string | null {
  if (!Array.isArray(props)) return null;
  const allowed = new Set(names);
  const prop = props.find((p) => allowed.has(String(p?.name ?? "").toLowerCase()) && typeof p?.value === "string");
  return prop?.value ?? null;
}

function pickRemarksJsonUrl(remarks: unknown): string | null {
  const match = text(remarks).match(/https?:\/\/\S+?\.json(?:[?#][^\s)]+)?/i);
  return match?.[0] ?? null;
}

function leveragedHref(la: any): string | null {
  if (typeof la?.href === "string") return la.href;
  if (typeof la?.url === "string") return la.url;
  if (typeof la?.source === "string") return la.source;
  if (typeof la?.link?.href === "string") return la.link.href;
  const links = [...(la?.links ?? []), ...(la?.rlinks ?? [])];
  return pickLinkHref(links, ["ssp", "source", "provider", "authorization", "leveraged", "system-security-plan"])
    ?? (links.length === 1 && typeof links[0]?.href === "string" ? links[0].href : null)
    ?? pickPropHref(la?.props, ["href", "url", "ssp-url", "source-url", "provider-ssp", "provider-ssp-url", "oscal-url"])
    ?? pickRemarksJsonUrl(la?.remarks);
}

function uniqTargets(targets: DependencyTarget[]): DependencyTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.parentId}|${target.modelKey}|${target.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractDependencies(
  json: unknown,
  modelKey: OscalModelKey,
  baseUrl: string | null,
  parentId: string,
  depth: number,
): DependencyTarget[] {
  const model = unwrapModel(json, modelKey);
  if (!model) return [];
  const bm = backMatterOf(model);
  const targets: DependencyTarget[] = [];

  if (modelKey === "profile") {
    const imports = model.imports as Array<{ href?: string }> | undefined;
    imports?.forEach((imp, index) => {
      if (!imp.href) return;
      targets.push({
        href: imp.href,
        label: imports.length > 1 ? `Catalog ${index + 1}` : "Catalog",
        modelKey: "catalog",
        relation: "profile import",
        backMatter: bm,
        baseUrl,
        parentId,
        depth,
      });
    });
  }

  if (modelKey === "system-security-plan") {
    const leveraged = ((model["system-implementation"] as any)?.["leveraged-authorizations"] ?? []) as any[];
    leveraged.forEach((la, index) => {
      const href = leveragedHref(la);
      if (!href) return;
      targets.push({
        href,
        label: la.title || `Provider SSP ${index + 1}`,
        modelKey: "system-security-plan",
        relation: "leveraged authorization",
        boundLaUuid: typeof la.uuid === "string" ? la.uuid : undefined,
        backMatter: bm,
        baseUrl,
        parentId,
        depth,
      });
    });

    const importProfile = model["import-profile"] as Record<string, unknown> | undefined;
    const profileHref = importProfile?.href as string | undefined;
    if (profileHref) {
      targets.push({
        href: profileHref,
        label: "Profile",
        modelKey: "profile",
        relation: "import-profile",
        backMatter: bm,
        baseUrl,
        parentId,
        depth,
      });
    }

    targets.push(...sspLinkedTargets(model, bm, baseUrl, parentId, depth));
  }

  if (modelKey === "assessment-plan") {
    const importSsp = model["import-ssp"] as Record<string, unknown> | undefined;
    const href = importSsp?.href as string | undefined;
    if (href) {
      targets.push({ href, label: "SSP", modelKey: "system-security-plan", relation: "import-ssp", backMatter: bm, baseUrl, parentId, depth });
    }
  }

  if (modelKey === "assessment-results") {
    const importAp = model["import-ap"] as Record<string, unknown> | undefined;
    const href = importAp?.href as string | undefined;
    if (href) {
      targets.push({ href, label: "Assessment Plan", modelKey: "assessment-plan", relation: "import-ap", backMatter: bm, baseUrl, parentId, depth });
    }
  }

  if (modelKey === "plan-of-action-and-milestones") {
    const importSsp = model["import-ssp"] as Record<string, unknown> | undefined;
    const href = importSsp?.href as string | undefined;
    if (href) {
      targets.push({ href, label: "SSP", modelKey: "system-security-plan", relation: "import-ssp", backMatter: bm, baseUrl, parentId, depth });
    }
  }

  if (modelKey === "component-definition") {
    const importCdefs = [
      ...(((model["import-component-definitions"] as Array<{ href?: string }> | undefined) ?? [])),
      ...(((model["import-component-definition"] as Array<{ href?: string }> | undefined) ?? [])),
    ];
    importCdefs.forEach((imp, index) => {
      if (!imp.href) return;
      targets.push({
        href: imp.href,
        label: importCdefs.length > 1 ? `Component Definition ${index + 1}` : "Component Definition",
        modelKey: "component-definition",
        relation: "import-component-definition",
        backMatter: bm,
        baseUrl,
        parentId,
        depth,
      });
    });

    const components = (model.components as any[] | undefined) ?? [];
    components.forEach((component, componentIndex) => {
      const impls = (component?.["control-implementations"] as any[] | undefined) ?? [];
      impls.forEach((impl, implIndex) => {
        if (!impl?.source) return;
        targets.push({
          href: impl.source,
          label: `${component?.title || `Component ${componentIndex + 1}`} · Source ${implIndex + 1}`,
          modelKey: "catalog",
          accepts: ["catalog", "profile"],
          relation: "control implementation source",
          backMatter: bm,
          baseUrl,
          parentId,
          depth,
        });
      });
    });
  }

  return uniqTargets(targets);
}

function resolveTargetUrl(target: DependencyTarget): { url: string | null; title: string | null; error: string | null } {
  const resolved = resolveHref(target.href, target.backMatter);
  if (resolved.formatError) return { url: null, title: resolved.title, error: resolved.formatError };
  if (!resolved.url) return { url: null, title: resolved.title, error: target.href.startsWith("#") ? `Back-matter resource ${target.href} not found or has no download link.` : "Empty import href." };

  const rawUrl = resolved.url;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return { url: rawUrl, title: resolved.title, error: checkUrlFormat(rawUrl) };
  }

  if (!target.baseUrl) {
    return { url: null, title: resolved.title, error: `Cannot resolve relative URL "${rawUrl}" — no base URL available.` };
  }

  try {
    const url = resolveRegistryApiRelativeUrl(rawUrl, target.baseUrl, target.modelKey) ?? new URL(rawUrl, target.baseUrl).href;
    return { url, title: resolved.title, error: checkUrlFormat(url) };
  } catch {
    return { url: null, title: resolved.title, error: `Cannot resolve relative URL: ${rawUrl}` };
  }
}

function isUnresolvableLocalLeveragedTarget(target: DependencyTarget, url: string | null, error: string | null): boolean {
  return target.relation === "leveraged authorization"
    && !url
    && Boolean(error?.includes("no base URL"));
}

function registryCollectionForModel(modelKey: OscalModelKey): string | null {
  switch (modelKey) {
    case "catalog": return "catalogs";
    case "profile": return "profiles";
    case "system-security-plan": return "system-security-plans";
    case "assessment-plan": return "assessment-plans";
    case "assessment-results": return "assessment-results";
    case "component-definition": return "component-definitions";
    case "plan-of-action-and-milestones": return "plans-of-action-and-milestones";
    default: return null;
  }
}

function resolveRegistryApiRelativeUrl(rawUrl: string, baseUrl: string, modelKey: OscalModelKey): string | null {
  try {
    const base = new URL(baseUrl);
    if (base.hostname !== "registry.oscal.io") return null;
    const match = base.pathname.match(/^\/api\/v1\/([^/]+)\//);
    const collection = registryCollectionForModel(modelKey);
    if (!match || !collection) return null;
    const raw = new URL(rawUrl, "https://placeholder.invalid/");
    if (raw.pathname.startsWith("/")) return null;
    const relativePath = raw.pathname.replace(/^\.\//, "");
    if (!relativePath || relativePath.startsWith("../")) return null;
    return `${base.origin}/api/v1/${match[1]}/${collection}/${relativePath}${raw.search}${raw.hash}`;
  } catch {
    return null;
  }
}

function nodeId(parentId: string, modelKey: OscalModelKey, urlOrHref: string): string {
  return `${parentId}>${modelKey}>${urlOrHref}`;
}

async function fetchJson(url: string, token: string | null, signal: AbortSignal, timeoutMs: number, onText?: () => void): Promise<unknown> {
  const res = await authFetch(url, token, { signal, timeoutMs });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("xml") || ct.includes("yaml")) throw new Error(`Referenced document is not JSON (${ct}): ${url}`);
  if (ct && !ct.includes("json") && !ct.includes("octet-stream") && !ct.includes("text/plain")) {
    throw new Error(`Expected JSON but received "${ct}": ${url}`);
  }

  const textBody = await res.text();
  onText?.();
  try {
    return JSON.parse(textBody);
  } catch {
    const trimmed = textBody.trimStart();
    if (trimmed.startsWith("<")) throw new Error(`Referenced document is not JSON (appears to be XML): ${url}`);
    throw new Error(`Referenced document is not valid JSON: ${url}`);
  }
}

function fetchTimeoutMsForModel(modelKey: OscalModelKey): number {
  return modelKey === "profile" ? PROFILE_FETCH_TIMEOUT_MS : DEPENDENCY_FETCH_TIMEOUT_MS;
}

function fetchTimeoutMs(target: DependencyTarget): number {
  return fetchTimeoutMsForModel(target.modelKey);
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export function useOscalGraphResolver({
  root,
  rootModelKey,
  rootBaseUrl,
  rootLabel,
  rootOrigin,
  token,
  skip = false,
  onResolved,
  getCachedDocument,
}: UseOscalGraphResolverOptions): GraphResolverResult {
  const [nodes, setNodes] = useState<GraphResolveNode[]>([]);
  const controllersRef = useRef<AbortController[]>([]);
  const controllersByNodeRef = useRef<Map<string, AbortController>>(new Map());
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;
  const getCachedDocumentRef = useRef(getCachedDocument);
  getCachedDocumentRef.current = getCachedDocument;
  const rootRef = useRef(root);
  rootRef.current = root;

  const rootKey = useMemo(() => {
    const model = unwrapModel(root, rootModelKey);
    return model?.uuid ?? titleOf(model) ?? null;
  }, [root, rootModelKey]);
  const rootId = rootKey ? `root:${rootModelKey}:${rootKey}` : null;

  useEffect(() => {
    if (!getCachedDocument) return;
    setNodes((prev) => prev.map((node) => {
      if (node.status !== "loading" || !node.resolvedUrl) return node;
      const cached = getCachedDocument({
        modelKey: node.modelKey,
        relation: node.relation,
        href: node.resolvedUrl,
        url: node.resolvedUrl,
        parentId: node.parentId ?? "",
        depth: node.depth,
      });
      if (!cached) return node;
      const matchedModelKey = detectModelKey(cached.json, node.modelKey) ?? node.modelKey;
      const model = cached.data ?? unwrapModel(cached.json, matchedModelKey);
      const cachedUrl = cached.url ?? node.resolvedUrl;
      return {
        ...node,
        modelKey: matchedModelKey,
        status: "success",
        error: null,
        resolvedLabel: cached.label ?? titleOf(model) ?? fileNameFromUrl(cachedUrl),
        resolvedUrl: cachedUrl,
      };
    }));
  }, [getCachedDocument]);

  useEffect(() => {
    if (!nodes.some((node) => node.status === "loading")) return;
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setNodes((prev) => prev.map((node) => {
        if (node.status !== "loading" || !node.startedAt) return node;
        const timeoutMs = fetchTimeoutMsForModel(node.modelKey);
        if (now - node.startedAt < timeoutMs) return node;
        controllersByNodeRef.current.get(node.id)?.abort();
        controllersByNodeRef.current.delete(node.id);
        return {
          ...node,
          status: "error",
          error: `Timed out resolving ${node.modelKey} from ${node.resolvedUrl ?? node.label} after ${Math.round(timeoutMs / 1000)} seconds`,
          json: null,
        };
      }));
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [nodes]);

  useEffect(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current = [];
    controllersByNodeRef.current.forEach((controller) => controller.abort());
    controllersByNodeRef.current.clear();
    setNodes([]);

    const currentRoot = rootRef.current;
    if (skip || !currentRoot || !rootKey) return;

    let cancelled = false;
    const visitedUrls = new Set<string>();
    const queuedIds = new Set<string>();

    const upsertNode = (id: string, updater: (prev: GraphResolveNode | undefined) => GraphResolveNode) => {
      setNodes((prev) => {
        const idx = prev.findIndex((node) => node.id === id);
        const nextNode = updater(idx >= 0 ? prev[idx] : undefined);
        if (idx < 0) return [...prev, nextNode];
        const next = [...prev];
        next[idx] = nextNode;
        return next;
      });
    };

    (async () => {
      const queue = extractDependencies(currentRoot, rootModelKey, rootBaseUrl, rootId!, 0);

      while (queue.length > 0 && !cancelled) {
        const target = queue.shift()!;
        const { url, title, error } = resolveTargetUrl(target);
        const id = nodeId(target.parentId, target.modelKey, url ?? target.href);
        const resolvedLabel = title ?? (url ? fileNameFromUrl(url) : null);

        if (queuedIds.has(id)) continue;
        queuedIds.add(id);

        const baseNode = (): Omit<GraphResolveNode, "status" | "error" | "json" | "resolvedLabel" | "resolvedUrl"> => ({
          id,
          parentId: target.parentId,
          label: title ?? target.label ?? MODEL_LABELS[target.modelKey],
          modelKey: target.modelKey,
          relation: target.relation,
          depth: target.depth,
        });

        if (isUnresolvableLocalLeveragedTarget(target, url, error)) {
          continue;
        }

        if (!url || error) {
          upsertNode(id, () => ({ ...baseNode(), status: "error", error: error ?? "Unable to resolve dependency URL.", json: null, resolvedLabel, resolvedUrl: url }));
          continue;
        }

        const cached = getCachedDocumentRef.current?.({
          modelKey: target.modelKey,
          accepts: target.accepts,
          relation: target.relation,
          href: target.href,
          url,
          parentId: target.parentId,
          depth: target.depth,
          boundLaUuid: target.boundLaUuid,
        });
        if (cached) {
          const matchedModelKey = detectModelKey(cached.json, target.modelKey, target.accepts) ?? target.modelKey;
          const model = cached.data ?? unwrapModel(cached.json, matchedModelKey);
          if (model) {
            const cachedUrl = cached.url ?? url;
            const label = cached.label ?? titleOf(model) ?? resolvedLabel ?? fileNameFromUrl(cachedUrl);
            visitedUrls.add(url);
            upsertNode(id, () => ({ ...baseNode(), label, modelKey: matchedModelKey, status: "success", error: null, json: null, resolvedLabel: label, resolvedUrl: cachedUrl }));
            if (target.relation !== "leveraged authorization") {
              queue.push(...extractDependencies(cached.json, matchedModelKey, cachedUrl, id, target.depth + 1));
            }
            onResolvedRef.current?.({
              modelKey: matchedModelKey,
              json: cached.json,
              data: model,
              label,
              url: cachedUrl,
              parentId: target.parentId,
              relation: target.relation,
              boundLaUuid: target.boundLaUuid,
            });
            continue;
          }
        }

        if (visitedUrls.has(url)) {
          upsertNode(id, () => ({ ...baseNode(), status: "success", error: null, json: null, resolvedLabel: resolvedLabel ?? "Already resolved", resolvedUrl: url }));
          continue;
        }
        visitedUrls.add(url);

        upsertNode(id, () => ({ ...baseNode(), status: "loading", error: null, json: null, resolvedLabel: null, resolvedUrl: url, startedAt: Date.now() }));

        const controller = new AbortController();
        controllersRef.current.push(controller);
        controllersByNodeRef.current.set(id, controller);
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const fetchTimeout = fetchTimeoutMs(target);

        try {
          const parsed = await Promise.race([
            fetchJson(url, token, controller.signal, fetchTimeout, () => {
              const fetchedLabel = title ?? fileNameFromUrl(url);
              upsertNode(id, () => ({ ...baseNode(), label: fetchedLabel, status: "success", error: null, json: null, resolvedLabel: fetchedLabel, resolvedUrl: url }));
            }),
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                controller.abort();
                upsertNode(id, () => ({
                  ...baseNode(),
                  status: "error",
                  error: `Timed out resolving ${target.modelKey} from ${url} after ${Math.round(fetchTimeout / 1000)} seconds`,
                  json: null,
                  resolvedLabel: null,
                  resolvedUrl: url,
                }));
                reject(new DOMException("Dependency fetch timed out", "AbortError"));
              }, fetchTimeout);
            }),
          ]);
          if (timeoutId) clearTimeout(timeoutId);
          if (cancelled) return;

          const matchedModelKey = detectModelKey(parsed, target.modelKey, target.accepts);
          const model = matchedModelKey ? unwrapModel(parsed, matchedModelKey) : null;
          if (!model) throw new Error(`Fetched document does not appear to be a valid OSCAL ${target.modelKey}.`);

          const label = titleOf(model) ?? title ?? fileNameFromUrl(url);
          upsertNode(id, () => ({ ...baseNode(), label, modelKey: matchedModelKey ?? target.modelKey, status: "success", error: null, json: null, resolvedLabel: label, resolvedUrl: url }));

          const resolvedDoc: ResolvedOscalDocument = {
            modelKey: matchedModelKey ?? target.modelKey,
            json: parsed,
            data: model,
            label,
            url,
            parentId: target.parentId,
            relation: target.relation,
            boundLaUuid: target.boundLaUuid,
          };

          if (target.relation !== "leveraged authorization") {
            queue.push(...extractDependencies(parsed, matchedModelKey ?? target.modelKey, url, id, target.depth + 1));
          }

          onResolvedRef.current?.(resolvedDoc);
        } catch (err) {
          if (cancelled) return;
          const isTimeout = (err as DOMException).name === "AbortError";
          upsertNode(id, () => ({
            ...baseNode(),
            status: "error",
            error: isTimeout ? `Timed out resolving ${target.modelKey} from ${url} after ${Math.round(fetchTimeout / 1000)} seconds` : err instanceof Error ? err.message : `Failed to fetch ${target.modelKey}`,
            json: null,
            resolvedLabel: null,
            resolvedUrl: url,
          }));
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
          controllersByNodeRef.current.delete(id);
        }
      }

    })();

    return () => {
      cancelled = true;
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current = [];
      controllersByNodeRef.current.forEach((controller) => controller.abort());
      controllersByNodeRef.current.clear();
    };
  }, [rootModelKey, rootBaseUrl, rootKey, token, skip]);

  const cancel = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current = [];
  }, []);

  return {
    nodes,
    items: [
      ...(rootId && rootLabel && nodes.length > 0 ? [{
        id: rootId,
        parentId: null,
        label: MODEL_LABELS[rootModelKey],
        modelKey: rootModelKey,
        relation: rootOrigin === "manual" ? "uploaded file" : "loaded file",
        depth: 0,
        status: "success" as const,
        error: null,
        resolvedLabel: rootLabel,
        resolvedUrl: rootBaseUrl,
        origin: rootOrigin ?? (rootBaseUrl ? "auto" : "manual"),
      }] : []),
      ...nodes.map((node) => ({
        id: node.id,
        parentId: node.parentId,
        label: node.label,
        modelKey: node.modelKey,
        relation: node.relation,
        depth: node.depth + (rootLabel ? 1 : 0),
        status: node.status,
        error: node.error,
        resolvedLabel: node.resolvedLabel,
        resolvedUrl: node.resolvedUrl,
        origin: "auto" as const,
      })),
    ],
    cancel,
  };
}
