/* ═══════════════════════════════════════════════════════════════════════════
   useImportResolver — shared hook for resolving OSCAL cross-model
   import references (import-profile, import-ssp, import-ap, source).

   Handles:
     • Direct URL hrefs
     • #uuid back-matter resource references
     • Relative URL resolution against a base sourceUrl
     • JSON content-type validation
     • Fetch status tracking for visual feedback
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";
import { authFetch } from "../context/AuthContext";

/* ── Types ── */

export interface BackMatterResource {
  uuid: string;
  title?: string;
  description?: string;
  rlinks?: { href: string; "media-type"?: string }[];
}

export type ResolveStatus = "idle" | "loading" | "success" | "error";

export interface ResolveResult {
  /** Current fetch state */
  status: ResolveStatus;
  /** Human-readable error, or null */
  error: string | null;
  /** The fetched & validated JSON payload */
  json: unknown | null;
  /** The display label (resource title or filename from URL) */
  label: string | null;
  /** The fully resolved URL that was fetched */
  resolvedUrl: string | null;
}

/* ── Helpers ── */

/**
 * Resolve an href that may be a #uuid back-matter reference.
 * Returns the resolved URL (or null) and an optional resource title.
 */
export function resolveHref(
  href: string,
  backMatterResources: BackMatterResource[],
): { url: string | null; title: string | null } {
  if (!href) return { url: null, title: null };
  if (href.startsWith("#")) {
    const uuid = href.slice(1);
    const resource = backMatterResources.find((r) => r.uuid === uuid);
    if (resource) {
      // Prefer JSON rlink
      const jsonRlink = resource.rlinks?.find(
        (rl) => rl["media-type"]?.includes("json"),
      );
      const anyRlink = resource.rlinks?.[0];
      const rlink = jsonRlink ?? anyRlink;
      return { url: rlink?.href ?? null, title: resource.title ?? null };
    }
    return { url: null, title: null };
  }
  return { url: href, title: null };
}

/** Extract a human-readable filename from a URL (last path segment). */
function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || url;
  } catch {
    return url;
  }
}

/**
 * Resolve a potentially relative URL against a base URL.
 * Returns the absolute URL or an error message.
 */
function resolveRelativeUrl(
  url: string,
  baseUrl: string | null,
): { resolved: string | null; error: string | null } {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { resolved: url, error: null };
  }
  if (baseUrl) {
    try {
      return { resolved: new URL(url, baseUrl).href, error: null };
    } catch {
      return {
        resolved: null,
        error: `Cannot resolve relative URL: ${url}`,
      };
    }
  }
  return {
    resolved: null,
    error: `Cannot resolve relative URL "${url}" — document was loaded from a local file. Load the referenced model manually or use a document with absolute URLs.`,
  };
}

/* ── Hook ── */

/**
 * Fetch and validate a referenced OSCAL document.
 *
 * @param href          The import href (direct URL or #uuid back-matter ref)
 * @param backMatter    Array of back-matter resources for #uuid resolution
 * @param baseUrl       The source URL of the parent document (for relative URL resolution)
 * @param token         Auth JWT token (or null)
 * @param modelKey      The expected OSCAL wrapper key (e.g. "catalog", "profile", "system-security-plan")
 *                      Used to unwrap and validate the fetched JSON.
 * @param skip          Set to true to skip fetching (e.g. when data is already loaded)
 */
export function useImportResolver(
  href: string | null | undefined,
  backMatter: BackMatterResource[],
  baseUrl: string | null,
  token: string | null,
  modelKey: string,
  skip = false,
): ResolveResult {
  const [status, setStatus] = useState<ResolveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState<unknown | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  // Track the href we last resolved to avoid re-fetching
  const lastHref = useRef<string | null>(null);

  useEffect(() => {
    if (skip || !href) {
      setStatus("idle");
      setError(null);
      setJson(null);
      setLabel(null);
      setResolvedUrl(null);
      lastHref.current = null;
      return;
    }

    // Don't re-fetch if href hasn't changed
    if (href === lastHref.current) return;
    lastHref.current = href;

    // 1. Resolve href (could be #uuid)
    const { url: rawUrl, title: resourceTitle } = resolveHref(href, backMatter);
    if (!rawUrl) {
      setStatus("error");
      setError(
        href.startsWith("#")
          ? `Back-matter resource ${href} not found or has no download link.`
          : `Empty import href.`,
      );
      return;
    }

    // 2. Resolve relative URLs
    const { resolved: fetchUrl, error: relError } = resolveRelativeUrl(rawUrl, baseUrl);
    if (!fetchUrl) {
      setStatus("error");
      setError(relError);
      return;
    }

    // 3. Fetch
    let cancelled = false;
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    setJson(null);
    setResolvedUrl(fetchUrl);

    authFetch(fetchUrl, token, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        // Validate that the response is JSON
        const ct = res.headers.get("content-type") ?? "";
        if (ct && !ct.includes("json") && !ct.includes("octet-stream") && !ct.includes("text/plain")) {
          throw new Error(
            `Expected JSON but received "${ct}". The referenced document does not appear to be a JSON file.`,
          );
        }
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        // Validate the text is actually JSON
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(
            "The referenced document is not valid JSON. Please ensure the import points to a JSON OSCAL document.",
          );
        }
        // Unwrap if wrapped in model key
        const obj = parsed as Record<string, unknown>;
        const inner = obj[modelKey] ?? obj;
        const innerObj = inner as Record<string, unknown>;
        if (!innerObj.metadata && !innerObj.uuid) {
          throw new Error(
            `Fetched document does not appear to be a valid OSCAL ${modelKey} (no metadata or uuid found).`,
          );
        }
        setJson(parsed);
        setLabel(resourceTitle ?? fileNameFromUrl(fetchUrl));
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        if ((err as DOMException).name === "AbortError") return;
        setError(err instanceof Error ? err.message : `Failed to fetch ${modelKey}`);
        setStatus("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [href, backMatter, baseUrl, token, modelKey, skip]);

  return { status, error, json, label, resolvedUrl };
}
