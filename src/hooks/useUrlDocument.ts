/* ═══════════════════════════════════════════════════════════════════════════
   useUrlDocument — reads a `?url=` query-string parameter and fetches
   the JSON document it points to.

   Usage (in any model page):
     const { json, isLoading, error } = useUrlDocument();

   Compatible with the legacy OSCAL viewer URL scheme:
     /catalog?url=https://api.oscal.io/api/catalog/<uuid>
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth, authFetch } from "../context/AuthContext";

export interface UrlDocumentResult {
  /** The parsed JSON payload, or null while loading / if no URL was given */
  json: Record<string, unknown> | null;
  /** True while the fetch is in flight */
  isLoading: boolean;
  /** Human-readable error string, or null */
  error: string | null;
  /** The raw `url` param value (null if absent) */
  sourceUrl: string | null;
}

/**
 * Fetch a JSON document from the `?url=` query parameter (if present).
 * Returns `{ json, isLoading, error, sourceUrl }`.
 */
export function useUrlDocument(): UrlDocumentResult {
  const [searchParams] = useSearchParams();
  const url = searchParams.get("url");
  const { token } = useAuth();

  const [json, setJson] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    setIsLoading(true);
    setError(null);
    setJson(null);

    authFetch(url, token, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setJson(data as Record<string, unknown>);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          if ((err as DOMException).name === "AbortError") {
            setError(`Request timed out fetching ${url}`);
          } else {
            setError(err instanceof Error ? err.message : "Failed to fetch document");
          }
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [url, token]);

  return { json, isLoading, error, sourceUrl: url };
}

/** Extract a human-readable filename from a URL (last path segment). */
export function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || url;
  } catch {
    return url;
  }
}
