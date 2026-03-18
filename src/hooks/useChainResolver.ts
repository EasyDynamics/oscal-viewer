/* ═══════════════════════════════════════════════════════════════════════════
   useChainResolver — sequential resolution of OSCAL dependency chains.

   Given an initial import href and a chain of model definitions, this hook
   resolves each link in sequence, passing the resolved data from each step
   to extract the next step's import reference.

   Example chains:
     SSP   → [Profile → Catalog]
     AP    → [SSP → Profile → Catalog]
     AR    → [AP → SSP → Profile → Catalog]
     POA&M → [SSP → Profile → Catalog]
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";
import { authFetch } from "../context/AuthContext";
import {
  resolveHref,
  checkUrlFormat,
  type BackMatterResource,
  type ResolveStatus,
} from "./useImportResolver";
import type { ResolverItem } from "../components/ResolverModal";

/* ── Types ── */

export interface ChainLink {
  /** Display label, e.g. "Profile", "Catalog" */
  label: string;
  /** OSCAL model wrapper key, e.g. "profile", "catalog" */
  modelKey: string;
  /** Extract the next import href + back-matter from this step's resolved JSON.
   *  Omit for the last step in the chain. */
  extractNext?: (json: unknown) => {
    href: string | null;
    backMatter: BackMatterResource[];
  };
}

export interface ChainStepResult {
  label: string;
  modelKey: string;
  status: ResolveStatus;
  error: string | null;
  json: unknown | null;
  resolvedLabel: string | null;
  resolvedUrl: string | null;
}

/* ── Extraction helpers ── */

/** Extract Catalog import from a resolved Profile JSON */
export function extractCatalogFromProfile(json: unknown): {
  href: string | null;
  backMatter: BackMatterResource[];
} {
  const obj = json as Record<string, unknown>;
  const profile = (obj.profile ?? obj) as Record<string, unknown>;
  const imports = profile.imports as Array<{ href: string }> | undefined;
  const href = imports?.[0]?.href ?? null;
  const bm = (((profile["back-matter"] as Record<string, unknown>)
    ?.resources as BackMatterResource[]) ?? []);
  return { href, backMatter: bm };
}

/** Extract Profile import from a resolved SSP JSON */
export function extractProfileFromSsp(json: unknown): {
  href: string | null;
  backMatter: BackMatterResource[];
} {
  const obj = json as Record<string, unknown>;
  const ssp = (obj["system-security-plan"] ?? obj) as Record<string, unknown>;
  const importProfile = ssp["import-profile"] as
    | Record<string, unknown>
    | undefined;
  const href = (importProfile?.href as string) ?? null;
  const bm = (((ssp["back-matter"] as Record<string, unknown>)
    ?.resources as BackMatterResource[]) ?? []);
  return { href, backMatter: bm };
}

/** Extract SSP import from a resolved Assessment Plan JSON */
export function extractSspFromAp(json: unknown): {
  href: string | null;
  backMatter: BackMatterResource[];
} {
  const obj = json as Record<string, unknown>;
  const ap = (obj["assessment-plan"] ?? obj) as Record<string, unknown>;
  const importSsp = ap["import-ssp"] as
    | Record<string, unknown>
    | undefined;
  const href = (importSsp?.href as string) ?? null;
  const bm = (((ap["back-matter"] as Record<string, unknown>)
    ?.resources as BackMatterResource[]) ?? []);
  return { href, backMatter: bm };
}

/* ── Pre-built chain constants ── */

/** SSP page: Profile → Catalog */
export const SSP_CHAIN: ChainLink[] = [
  { label: "Profile", modelKey: "profile", extractNext: extractCatalogFromProfile },
  { label: "Catalog", modelKey: "catalog" },
];

/** AP page: SSP → Profile → Catalog */
export const AP_CHAIN: ChainLink[] = [
  { label: "SSP", modelKey: "system-security-plan", extractNext: extractProfileFromSsp },
  { label: "Profile", modelKey: "profile", extractNext: extractCatalogFromProfile },
  { label: "Catalog", modelKey: "catalog" },
];

/** AR page: AP → SSP → Profile → Catalog */
export const AR_CHAIN: ChainLink[] = [
  { label: "Assessment Plan", modelKey: "assessment-plan", extractNext: extractSspFromAp },
  { label: "SSP", modelKey: "system-security-plan", extractNext: extractProfileFromSsp },
  { label: "Profile", modelKey: "profile", extractNext: extractCatalogFromProfile },
  { label: "Catalog", modelKey: "catalog" },
];

/** POA&M page: SSP → Profile → Catalog */
export const POAM_CHAIN: ChainLink[] = [
  { label: "SSP", modelKey: "system-security-plan", extractNext: extractProfileFromSsp },
  { label: "Profile", modelKey: "profile", extractNext: extractCatalogFromProfile },
  { label: "Catalog", modelKey: "catalog" },
];

/** Profile page: Catalog */
export const PROFILE_CHAIN: ChainLink[] = [
  { label: "Catalog", modelKey: "catalog" },
];

/* ── Helpers ── */

function fileNameFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || url;
  } catch {
    return url;
  }
}

/* ── Hook ── */

export function useChainResolver(
  initialHref: string | null | undefined,
  initialBackMatter: BackMatterResource[],
  baseUrl: string | null,
  token: string | null,
  chain: ChainLink[],
  skip = false,
): { steps: ChainStepResult[]; items: ResolverItem[] } {
  const makeIdle = (): ChainStepResult[] =>
    chain.map((l) => ({
      label: l.label,
      modelKey: l.modelKey,
      status: "idle" as const,
      error: null,
      json: null,
      resolvedLabel: null,
      resolvedUrl: null,
    }));

  const [steps, setSteps] = useState<ChainStepResult[]>(makeIdle);
  const lastHref = useRef<string | null>(null);
  const skipRef = useRef(skip);
  skipRef.current = skip;
  // Track whether we've gone through a null→non-null cycle (i.e. "New File" then load)
  const hasResetRef = useRef(false);

  useEffect(() => {
    // If we already resolved this href, don't re-resolve or reset
    if (initialHref != null && initialHref === lastHref.current) return;

    // No href → reset
    if (!initialHref || chain.length === 0) {
      setSteps(makeIdle());
      // If we previously resolved something, mark that a reset occurred
      if (lastHref.current !== null) hasResetRef.current = true;
      lastHref.current = null;
      return;
    }

    // Skip on initial page mount when data is already loaded by another chain,
    // but NOT after a reset cycle (user clicked "New File" then loaded a new doc)
    if (skipRef.current && !hasResetRef.current) {
      lastHref.current = initialHref;
      return;
    }

    hasResetRef.current = false;
    lastHref.current = initialHref;
    let cancelled = false;

    (async () => {
      let href: string | null = initialHref;
      let bm: BackMatterResource[] = initialBackMatter;
      let currentBase: string | null = baseUrl;

      // Reset all steps
      setSteps(makeIdle());

      for (let i = 0; i < chain.length; i++) {
        if (cancelled) return;
        const link = chain[i];

        /* 1. Resolve href (may be a #uuid back-matter ref) */
        const { url: rawUrl, title: resTitle, formatError } = resolveHref(href!, bm);
        if (formatError) {
          setSteps((prev) => {
            const n = [...prev];
            n[i] = { ...n[i], status: "error", error: formatError };
            return n;
          });
          return; // stop chain
        }
        if (!rawUrl) {
          setSteps((prev) => {
            const n = [...prev];
            n[i] = {
              ...n[i],
              status: "error",
              error: href!.startsWith("#")
                ? `Back-matter resource ${href} not found or has no download link.`
                : "Empty import href.",
            };
            return n;
          });
          return; // stop chain
        }

        /* 2. Resolve relative URL */
        let fetchUrl: string;
        if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
          fetchUrl = rawUrl;
        } else if (currentBase) {
          try {
            fetchUrl = new URL(rawUrl, currentBase).href;
          } catch {
            setSteps((prev) => {
              const n = [...prev];
              n[i] = {
                ...n[i],
                status: "error",
                error: `Cannot resolve relative URL: ${rawUrl}`,
              };
              return n;
            });
            return;
          }
        } else {
          setSteps((prev) => {
            const n = [...prev];
            n[i] = {
              ...n[i],
              status: "error",
              error: `Cannot resolve relative URL "${rawUrl}" — no base URL available.`,
            };
            return n;
          });
          return;
        }

        /* 3. Pre-flight: reject unsupported URL extensions */
        const urlFormatError = checkUrlFormat(fetchUrl);
        if (urlFormatError) {
          setSteps((prev) => {
            const n = [...prev];
            n[i] = { ...n[i], status: "error", error: urlFormatError };
            return n;
          });
          return; // stop chain
        }

        /* 4. Set loading */
        setSteps((prev) => {
          const n = [...prev];
          n[i] = { ...n[i], status: "loading", error: null, json: null, resolvedUrl: fetchUrl };
          return n;
        });

        /* 5. Fetch */
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10_000);
          const res = await authFetch(fetchUrl, token, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (cancelled) return;
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("xml") || ct.includes("yaml")) {
            throw new Error(`Referenced document is not JSON (${ct}): ${fetchUrl}`);
          }
          if (
            ct &&
            !ct.includes("json") &&
            !ct.includes("octet-stream") &&
            !ct.includes("text/plain")
          ) {
            throw new Error(`Expected JSON but received "${ct}": ${fetchUrl}`);
          }

          const text = await res.text();
          if (cancelled) return;

          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            // Check if it looks like XML
            const trimmed = text.trimStart();
            if (trimmed.startsWith("<")) {
              throw new Error(`Referenced document is not JSON (appears to be XML): ${fetchUrl}`);
            }
            throw new Error(`Referenced document is not valid JSON: ${fetchUrl}`);
          }

          const obj = parsed as Record<string, unknown>;
          const inner = (obj[link.modelKey] ?? obj) as Record<string, unknown>;
          if (!inner.metadata && !inner.uuid) {
            throw new Error(
              `Fetched document does not appear to be a valid OSCAL ${link.modelKey}.`,
            );
          }

          const resolvedLabel = resTitle ?? fileNameFromUrl(fetchUrl);

          setSteps((prev) => {
            const n = [...prev];
            n[i] = {
              ...n[i],
              status: "success",
              json: parsed,
              resolvedLabel,
              resolvedUrl: fetchUrl,
            };
            return n;
          });

          /* 6. Extract next step info */
          if (link.extractNext && i < chain.length - 1) {
            const next = link.extractNext(parsed);
            if (!next.href) return; // no next reference → stop chain
            href = next.href;
            bm = next.backMatter;
            currentBase = fetchUrl; // use fetched URL as base for next step
          }
        } catch (err) {
          if (cancelled) return;
          const isTimeout = (err as DOMException).name === "AbortError";
          setSteps((prev) => {
            const n = [...prev];
            n[i] = {
              ...n[i],
              status: "error",
              error: isTimeout
                ? `Timed out resolving ${link.modelKey} from ${fetchUrl}`
                : err instanceof Error
                  ? err.message
                  : `Failed to fetch ${link.modelKey}`,
            };
            return n;
          });
          return; // stop chain on error
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHref, token]);

  /* Build items for ResolverModal.
     Populate whenever any step is non-idle so the modal shows
     both successful and failed resolutions. */
  const items: ResolverItem[] = steps
    .filter((s) => s.status !== "idle")
    .map((s) => ({
      label: s.label,
      status: s.status,
      error: s.error,
      resolvedLabel: s.resolvedLabel,
      resolvedUrl: s.resolvedUrl,
    }));

  return { steps, items };
}
