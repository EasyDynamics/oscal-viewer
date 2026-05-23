/* ═══════════════════════════════════════════════════════════════════════════
  AuthContext — stores a bearer token in sessionStorage so authenticated requests
   can attach it as a Bearer token.

   • Token persists across in-tab navigation but clears when the tab closes.
   • Provides `token`, `setToken`, `clearToken`, and `isAuthenticated`.
   • All fetch calls (useUrlDocument, ProfilePage catalog resolution, etc.)
     read the token from this context to attach Authorization headers.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

const STORAGE_KEY = "oscal_jwt";

/**
 * Bearer token format check. Supports JWT/JWE and opaque API tokens that
 * use the RFC 6750 b64token character set. This intentionally does not
 * verify signatures; it only rejects empty/control-character input and
 * obvious non-token text.
 */
export function isValidBearerTokenFormat(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 8192) return false;
  return /^[A-Za-z0-9\-._~+/]+=*$/.test(trimmed);
}

export const isValidJwtFormat = isValidBearerTokenFormat;

export interface AuthContextValue {
  /** The current bearer token, or null if not set */
  token: string | null;
  /** Store a bearer token in the session */
  setToken: (jwt: string) => void;
  /** Remove the bearer token from the session */
  clearToken: () => void;
  /** Convenience flag — true when a non-empty token is present */
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ── Provider ── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, _setToken] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored && isValidBearerTokenFormat(stored)) return stored;
      if (stored) sessionStorage.removeItem(STORAGE_KEY); // corrupted — discard
      return null;
    } catch {
      return null;
    }
  });

  const setToken = useCallback((jwt: string) => {
    const trimmed = jwt.trim();
    if (!trimmed) return;
    if (!isValidBearerTokenFormat(trimmed)) {
      console.warn("AuthContext: rejected token — not a valid bearer token format");
      return;
    }
    try {
      sessionStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      /* quota / security — still keep it in memory */
    }
    _setToken(trimmed);
  }, []);

  const clearToken = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    _setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, setToken, clearToken, isAuthenticated: token != null }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ── */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/**
 * Build a headers object that includes the Authorization bearer token
 * when an access token is available. Merge with any extra headers you need.
 */
export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Returns true when the URL targets the OSCAL API backend where cookie-based
 * authentication is accepted.
 */
function isOscalApiOrigin(url: string): boolean {
  try {
    return new URL(url).hostname === "api.oscal.io";
  } catch {
    return false;
  }
}

/** Returns true for OSCAL hosts that should receive the configured bearer token. */
function isOscalAuthOrigin(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "api.oscal.io" || hostname === "registry.oscal.io";
  } catch {
    return false;
  }
}

function isCrossOrigin(url: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function proxyFetch(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch("/__proxy", {
    credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ url, headers }),
  });
}

/**
 * Fetch a URL with optional auth.
 *
 * - **Development**: routes through the Vite dev-server `/__proxy` endpoint
 *   so the Authorization header doesn't trigger browser CORS preflight
 *   failures (localhost isn't in the registry's allowed origins).
 * - **Production**: makes a direct request with the Authorization header.
 *   The registry's CORS policy already allows `viewer.oscal.io`.
 *
 * Credentials (`credentials: "include"`) are only sent to the API origin
 * (`api.oscal.io`). Bearer tokens are sent only to OSCAL auth origins
 * (`api.oscal.io` and `registry.oscal.io`) and are never forwarded to
 * third-party imports such as GitHub raw URLs.
 *
 * Without a token, it does a normal `fetch()` (with credentials for
 * the API origin to support cookie-based auth).
 */
export function authFetch(
  url: string,
  token: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<Response> {
  const needsCredentials = isOscalApiOrigin(url);
  const shouldSendAuthHeader = token != null && isOscalAuthOrigin(url);
  const requestHeaders: Record<string, string> = {
    Accept: "application/json, text/plain;q=0.9, */*;q=0.1",
    ...(shouldSendAuthHeader ? { Authorization: `Bearer ${token}` } : {}),
  };

  // In dev, route cross-origin JSON requests through the Vite server-side
  // proxy. This avoids browser CORS failures for registry/GitHub imports.
  // Cookie-only API requests stay direct because the proxy cannot read browser
  // cookies for api.oscal.io, but token-authenticated OSCAL requests can go
  // through the proxy with Authorization attached.
  if (import.meta.env.DEV && isCrossOrigin(url) && (!needsCredentials || token)) {
    return proxyFetch(url, requestHeaders, opts.signal);
  }

  if (!token) {
    return fetch(url, {
      ...(needsCredentials && { credentials: "include" as const }),
      headers: requestHeaders,
      signal: opts.signal,
    });
  }

  // Only send the Authorization header to OSCAL auth origins. Third-party
  // hosts (GitHub, vendor-hosted catalogs, etc.) don't need it and adding it
  // can trigger CORS preflight or leak the user's registry token.
  if (!shouldSendAuthHeader) {
    return fetch(url, { headers: requestHeaders, signal: opts.signal });
  }

  // In dev, route through the server-side proxy to avoid CORS
  // (localhost isn't in the registry's allowed origins)
  if (import.meta.env.DEV) return proxyFetch(url, requestHeaders, opts.signal);

  // In production, call the API directly — its CORS policy
  // allows the deployed viewer origin.
  return fetch(url, {
    ...(needsCredentials && { credentials: "include" as const }),
    signal: opts.signal,
    headers: requestHeaders,
  });
}
