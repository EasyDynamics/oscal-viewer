/* ═══════════════════════════════════════════════════════════════════════════
   AuthContext — stores a JWT in sessionStorage so authenticated requests
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
 * JWT format check supporting both JWS and JWE tokens:
 *  - JWS: 3 Base64URL segments (header.payload.signature)
 *  - JWE: 5 Base64URL segments (header.encryptedKey.iv.ciphertext.tag)
 *        The encryptedKey segment may be empty for "dir" key agreement.
 * Does NOT verify signatures — just ensures the shape is plausible so we
 * don't store arbitrary strings (XSS payloads, HTML, etc.).
 */
export function isValidJwtFormat(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 3 && parts.length !== 5) return false;
  const base64urlRe = /^[A-Za-z0-9_-]*$/; // allow empty for JWE encrypted-key
  if (!parts.every((p) => base64urlRe.test(p))) return false;
  // At minimum the first segment (header) must be non-empty
  if (parts[0].length === 0) return false;
  // For JWS: all 3 parts must be non-empty
  if (parts.length === 3) return parts.every((p) => p.length > 0);
  // For JWE: header, iv, ciphertext, and tag must be non-empty
  //          encryptedKey (parts[1]) may be empty ("dir" algorithm)
  return parts[0].length > 0 && parts[2].length > 0 && parts[3].length > 0 && parts[4].length > 0;
}

export interface AuthContextValue {
  /** The current JWT, or null if not set */
  token: string | null;
  /** Store a JWT in the session */
  setToken: (jwt: string) => void;
  /** Remove the JWT from the session */
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
      if (stored && isValidJwtFormat(stored)) return stored;
      if (stored) sessionStorage.removeItem(STORAGE_KEY); // corrupted — discard
      return null;
    } catch {
      return null;
    }
  });

  const setToken = useCallback((jwt: string) => {
    const trimmed = jwt.trim();
    if (!trimmed) return;
    if (!isValidJwtFormat(trimmed)) {
      console.warn("AuthContext: rejected token — not a valid JWT format (expected header.payload.signature)");
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
 * when a JWT is available. Merge with any extra headers you need.
 */
export function authHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Returns true when the URL targets the OSCAL API backend where
 * cookie-based and token-based authentication are accepted.
 * Public registries / third-party hosts don't need credentials.
 */
function isOscalApiOrigin(url: string): boolean {
  try {
    return new URL(url).hostname === "api.oscal.io";
  } catch {
    return false;
  }
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
 * (`api.oscal.io`). Sending credentials to third-party hosts (e.g.
 * registry.oscal.io, GitHub) would break CORS because those servers
 * respond with `Access-Control-Allow-Origin: *` which is incompatible
 * with credentialed requests.
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

  if (!token) {
    return fetch(url, {
      ...(needsCredentials && { credentials: "include" as const }),
      signal: opts.signal,
    });
  }

  // Only send the Authorization header to the API backend.
  // Third-party hosts (registry catalogs, GitHub, etc.) don't need it
  // and adding it triggers CORS preflight that those servers may not handle.
  if (!needsCredentials) {
    return fetch(url, { signal: opts.signal });
  }

  // In dev, route through the server-side proxy to avoid CORS
  // (localhost isn't in the registry's allowed origins)
  if (import.meta.env.DEV) {
    return fetch("/__proxy", {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: opts.signal,
      body: JSON.stringify({
        url,
        headers: { Authorization: `Bearer ${token}` },
      }),
    });
  }

  // In production, call the API directly — its CORS policy
  // allows the deployed viewer origin.
  return fetch(url, {
    credentials: "include",
    signal: opts.signal,
    headers: { Authorization: `Bearer ${token}` },
  });
}
