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
}

export interface ResolvedOscalDocument {
  modelKey: OscalModelKey;
  json: unknown;
  data: Record<string, unknown>;
  label: string;
  url: string;
  parentId: string | null;
  relation: string;
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
  token: string | null;
  skip?: boolean;
  onResolved?: (doc: ResolvedOscalDocument) => void;
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

  const jsonLink = links.find((l) => String(l?.["media-type"] ?? "").toLowerCase().includes("json") && l?.href);
  if (jsonLink?.href) return jsonLink.href;

  const semantic = links.find((l) => {
    const rel = String(l?.rel ?? "").toLowerCase();
    return l?.href && relWords.some((word) => rel.includes(word));
  });
  if (semantic?.href) return semantic.href;

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
  return pickLinkHref([...(la?.links ?? []), ...(la?.rlinks ?? [])], ["ssp", "source", "provider", "authorization", "leveraged"])
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

    const leveraged = ((model["system-implementation"] as any)?.["leveraged-authorizations"] ?? []) as any[];
    leveraged.forEach((la, index) => {
      const href = leveragedHref(la);
      if (!href) return;
      targets.push({
        href,
        label: la.title || `Provider SSP ${index + 1}`,
        modelKey: "system-security-plan",
        relation: "leveraged authorization",
        backMatter: bm,
        baseUrl,
        parentId,
        depth,
      });
    });

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
    const url = new URL(rawUrl, target.baseUrl).href;
    return { url, title: resolved.title, error: checkUrlFormat(url) };
  } catch {
    return { url: null, title: resolved.title, error: `Cannot resolve relative URL: ${rawUrl}` };
  }
}

function nodeId(parentId: string, modelKey: OscalModelKey, urlOrHref: string): string {
  return `${parentId}>${modelKey}>${urlOrHref}`;
}

async function fetchJson(url: string, token: string | null, signal: AbortSignal, onText?: () => void): Promise<unknown> {
  const res = await authFetch(url, token, { signal });
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

/* eslint-enable @typescript-eslint/no-explicit-any */

export function useOscalGraphResolver({
  root,
  rootModelKey,
  rootBaseUrl,
  token,
  skip = false,
  onResolved,
}: UseOscalGraphResolverOptions): GraphResolverResult {
  const [nodes, setNodes] = useState<GraphResolveNode[]>([]);
  const controllersRef = useRef<AbortController[]>([]);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;
  const rootRef = useRef(root);
  rootRef.current = root;

  const rootKey = useMemo(() => {
    const model = unwrapModel(root, rootModelKey);
    return model?.uuid ?? titleOf(model) ?? null;
  }, [root, rootModelKey]);

  useEffect(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current = [];
    setNodes([]);

    const currentRoot = rootRef.current;
    if (skip || !currentRoot || !rootKey) return;

    let cancelled = false;
    const rootId = `root:${rootModelKey}:${rootKey}`;
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
      const queue = extractDependencies(currentRoot, rootModelKey, rootBaseUrl, rootId, 0);
      const resolvedDocs: ResolvedOscalDocument[] = [];

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

        if (!url || error) {
          upsertNode(id, () => ({ ...baseNode(), status: "error", error: error ?? "Unable to resolve dependency URL.", json: null, resolvedLabel, resolvedUrl: url }));
          continue;
        }

        if (visitedUrls.has(url)) {
          upsertNode(id, () => ({ ...baseNode(), status: "success", error: null, json: null, resolvedLabel: resolvedLabel ?? "Already resolved", resolvedUrl: url }));
          continue;
        }
        visitedUrls.add(url);

        upsertNode(id, () => ({ ...baseNode(), status: "loading", error: null, json: null, resolvedLabel: null, resolvedUrl: url }));

        const controller = new AbortController();
        controllersRef.current.push(controller);
        const timeoutId = setTimeout(() => controller.abort(), 15_000);

        try {
          const parsed = await fetchJson(url, token, controller.signal, () => {
            const fetchedLabel = title ?? fileNameFromUrl(url);
            upsertNode(id, () => ({ ...baseNode(), label: fetchedLabel, status: "success", error: null, json: null, resolvedLabel: fetchedLabel, resolvedUrl: url }));
          });
          clearTimeout(timeoutId);
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
          };

          queue.push(...extractDependencies(parsed, matchedModelKey ?? target.modelKey, url, id, target.depth + 1));

          resolvedDocs.push(resolvedDoc);
        } catch (err) {
          if (cancelled) return;
          const isTimeout = (err as DOMException).name === "AbortError";
          upsertNode(id, () => ({
            ...baseNode(),
            status: "error",
            error: isTimeout ? `Timed out resolving ${target.modelKey} from ${url}` : err instanceof Error ? err.message : `Failed to fetch ${target.modelKey}`,
            json: null,
            resolvedLabel: null,
            resolvedUrl: url,
          }));
        } finally {
          clearTimeout(timeoutId);
        }
      }

      // Let the resolver UI paint the final success state before pushing large
      // OSCAL documents into global context (large catalogs can be 10MB+). Do
      // this after the queue drains so context updates cannot abort an active
      // sibling dependency fetch and leave that node stuck in loading state.
      setTimeout(() => {
        if (cancelled) return;
        resolvedDocs.forEach((doc) => onResolvedRef.current?.(doc));
      }, 0);
    })();

    return () => {
      cancelled = true;
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current = [];
    };
  }, [rootModelKey, rootBaseUrl, rootKey, token, skip]);

  const cancel = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current = [];
  }, []);

  return {
    nodes,
    items: nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      label: node.label,
      modelKey: node.modelKey,
      relation: node.relation,
      depth: node.depth,
      status: node.status,
      error: node.error,
      resolvedLabel: node.resolvedLabel,
      resolvedUrl: node.resolvedUrl,
    })),
    cancel,
  };
}
