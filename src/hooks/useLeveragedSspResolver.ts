/* ═══════════════════════════════════════════════════════════════════════════
   useLeveragedSspResolver — auto-resolves SSP leveraged-authorizations.

   Walks `system-implementation.leveraged-authorizations`, fetches provider
   SSPs when their hrefs are resolvable, stores them as leveraged SSPs, and
   recursively follows provider SSP leveraged-authorizations. This supports
   nested inheritance chains such as RDP → ED-Connect → Azure → ED SOC.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "../context/AuthContext";
import type { UploadEntry } from "../context/OscalContext";
import type { ResolverItem } from "../components/ResolverModal";
import {
  checkUrlFormat,
  resolveHref,
  type BackMatterResource,
  type ResolveStatus,
} from "./useImportResolver";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LeveragedTarget {
  href: string;
  label: string;
  backMatter: BackMatterResource[];
  baseUrl: string | null;
  depth: number;
}

interface LeveragedStep {
  id: string;
  label: string;
  status: ResolveStatus;
  error: string | null;
  resolvedLabel: string | null;
  resolvedUrl: string | null;
}

export interface LeveragedSspResolverResult {
  items: ResolverItem[];
  cancel: () => void;
}

function fileNameFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || url;
  } catch {
    return url;
  }
}

function text(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "prose" in v) return String((v as any).prose);
  return String(v);
}

function unwrapSsp(json: unknown): any | null {
  const obj = json as Record<string, unknown> | null;
  if (!obj) return null;
  const ssp = (obj["system-security-plan"] ?? obj) as any;
  return ssp?.metadata ? ssp : null;
}

function backMatter(ssp: any): BackMatterResource[] {
  return (ssp?.["back-matter"]?.resources ?? []) as BackMatterResource[];
}

function pickLinkHref(links: any[]): string | null {
  if (!Array.isArray(links)) return null;
  const jsonLink = links.find((l) => String(l?.["media-type"] ?? "").toLowerCase().includes("json") && l?.href);
  if (jsonLink?.href) return jsonLink.href;

  const semantic = links.find((l) => {
    const rel = String(l?.rel ?? "").toLowerCase();
    return l?.href && (rel.includes("ssp") || rel.includes("source") || rel.includes("provider") || rel.includes("authorization"));
  });
  if (semantic?.href) return semantic.href;

  const anyJsonHref = links.find((l) => typeof l?.href === "string" && l.href.toLowerCase().includes(".json"));
  return anyJsonHref?.href ?? null;
}

function pickPropHref(props: any[]): string | null {
  if (!Array.isArray(props)) return null;
  const names = new Set(["href", "url", "ssp-url", "source-url", "provider-ssp", "provider-ssp-url", "oscal-url"]);
  const prop = props.find((p) => names.has(String(p?.name ?? "").toLowerCase()) && typeof p?.value === "string");
  return prop?.value ?? null;
}

function pickRemarksHref(remarks: unknown): string | null {
  const value = text(remarks);
  const match = value.match(/https?:\/\/\S+?\.json(?:[?#][^\s)]+)?/i);
  return match?.[0] ?? null;
}

function leveragedHref(la: any): string | null {
  if (typeof la?.href === "string") return la.href;
  if (typeof la?.url === "string") return la.url;
  if (typeof la?.source === "string") return la.source;
  if (typeof la?.link?.href === "string") return la.link.href;
  return pickLinkHref(la?.links) ?? pickLinkHref(la?.rlinks) ?? pickPropHref(la?.props) ?? pickRemarksHref(la?.remarks);
}

function extractTargets(json: unknown, baseUrl: string | null, depth: number): LeveragedTarget[] {
  const ssp = unwrapSsp(json);
  if (!ssp) return [];
  const bm = backMatter(ssp);
  const las = ssp["system-implementation"]?.["leveraged-authorizations"] ?? [];
  if (!Array.isArray(las)) return [];
  return las
    .map((la: any): LeveragedTarget | null => {
      const href = leveragedHref(la);
      if (!href) return null;
      return {
        href,
        label: la.title || "Leveraged SSP",
        backMatter: bm,
        baseUrl,
        depth,
      };
    })
    .filter(Boolean) as LeveragedTarget[];
}

function resolveUrl(target: LeveragedTarget): { url: string | null; error: string | null; title: string | null } {
  const resolvedHref = resolveHref(target.href, target.backMatter);
  if (resolvedHref.formatError) return { url: null, error: resolvedHref.formatError, title: resolvedHref.title };
  if (!resolvedHref.url) return { url: null, error: null, title: resolvedHref.title };

  const rawUrl = resolvedHref.url;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return { url: rawUrl, error: checkUrlFormat(rawUrl), title: resolvedHref.title };
  }
  if (!target.baseUrl) return { url: null, error: null, title: resolvedHref.title };
  try {
    const url = new URL(rawUrl, target.baseUrl).href;
    return { url, error: checkUrlFormat(url), title: resolvedHref.title };
  } catch {
    return { url: null, error: `Cannot resolve relative URL: ${rawUrl}`, title: resolvedHref.title };
  }
}

function stepId(url: string, depth: number): string {
  return `${depth}:${url}`;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export function useLeveragedSspResolver(
  rootSsp: unknown | null,
  rootBaseUrl: string | null,
  token: string | null,
  loadedSsps: UploadEntry<unknown>[],
  addLeveragedSsp: (data: unknown, fileName: string, sourceUrl?: string | null) => void,
): LeveragedSspResolverResult {
  const [steps, setSteps] = useState<LeveragedStep[]>([]);
  const controllersRef = useRef<AbortController[]>([]);

  const rootKey = useMemo(() => {
    const ssp = unwrapSsp(rootSsp);
    return ssp?.uuid || ssp?.metadata?.title || null;
  }, [rootSsp]);

  useEffect(() => {
    controllersRef.current.forEach((c) => c.abort());
    controllersRef.current = [];
    setSteps([]);

    if (!rootSsp || !rootKey) return;

    let cancelled = false;
    const visitedUrls = new Set<string>();
    const initiallyLoaded = new Set(
      loadedSsps.flatMap((entry) => [entry.sourceUrl, entry.fileName].filter(Boolean) as string[]),
    );

    const setStep = (id: string, updater: (prev: LeveragedStep | undefined) => LeveragedStep) => {
      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        const nextStep = updater(idx >= 0 ? prev[idx] : undefined);
        if (idx < 0) return [...prev, nextStep];
        const next = [...prev];
        next[idx] = nextStep;
        return next;
      });
    };

    (async () => {
      const queue = extractTargets(rootSsp, rootBaseUrl, 0);
      while (queue.length > 0 && !cancelled) {
        const target = queue.shift()!;
        const { url, error, title } = resolveUrl(target);
        if (!url) continue; // only auto-load fully resolvable URLs
        const id = stepId(url, target.depth);
        const label = `${target.depth > 0 ? "Nested " : ""}Provider SSP · ${title ?? target.label}`;

        if (visitedUrls.has(url) || initiallyLoaded.has(url)) continue;
        visitedUrls.add(url);

        if (error) {
          setStep(id, () => ({ id, label, status: "error", error, resolvedLabel: null, resolvedUrl: url }));
          continue;
        }

        setStep(id, () => ({ id, label, status: "loading", error: null, resolvedLabel: null, resolvedUrl: url }));

        const controller = new AbortController();
        controllersRef.current.push(controller);
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        try {
          const res = await authFetch(url, token, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("xml") || ct.includes("yaml")) throw new Error(`Referenced document is not JSON (${ct}): ${url}`);
          const parsed = await res.json();
          const ssp = unwrapSsp(parsed);
          if (!ssp) throw new Error("Fetched document does not appear to be a valid OSCAL SSP.");

          const resolvedLabel = title ?? fileNameFromUrl(url);
          addLeveragedSsp(parsed, resolvedLabel, url);
          setStep(id, () => ({ id, label, status: "success", error: null, resolvedLabel, resolvedUrl: url }));

          queue.push(...extractTargets(parsed, url, target.depth + 1));
        } catch (err) {
          if (cancelled) return;
          const isTimeout = (err as DOMException).name === "AbortError";
          setStep(id, () => ({
            id,
            label,
            status: "error",
            error: isTimeout ? `Timed out resolving provider SSP from ${url}` : err instanceof Error ? err.message : "Failed to fetch provider SSP",
            resolvedLabel: null,
            resolvedUrl: url,
          }));
        } finally {
          clearTimeout(timeoutId);
        }
      }
    })();

    return () => {
      cancelled = true;
      controllersRef.current.forEach((c) => c.abort());
      controllersRef.current = [];
    };
    // loadedSsps intentionally excluded so adding a provider does not restart the crawl.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootKey, rootBaseUrl, token]);

  const cancel = useCallback(() => {
    controllersRef.current.forEach((c) => c.abort());
    controllersRef.current = [];
  }, []);

  return {
    items: steps.map((s) => ({
      label: s.label,
      status: s.status,
      error: s.error,
      resolvedLabel: s.resolvedLabel,
      resolvedUrl: s.resolvedUrl,
    })),
    cancel,
  };
}
