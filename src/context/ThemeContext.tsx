/* ═══════════════════════════════════════════════════════════════════════════
   Theme Context — manages light/dark/system mode with localStorage
   persistence and OS preference detection.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import type { ColorMode, ResolvedMode } from "../theme/themeContract";
import { applyTheme } from "../theme/applyTheme";

const STORAGE_KEY = "theme-mode";

interface ThemeContextValue {
  /** User preference: "light" | "dark" | "system" */
  mode: ColorMode;
  /** Computed effective mode: "light" | "dark" */
  resolvedMode: ResolvedMode;
  /** Update the user's mode preference */
  setMode: (mode: ColorMode) => void;
  /** Convenience toggle: light ↔ dark (sets explicit, not system) */
  toggleMode: () => void;
}

const ThemeCtx = createContext<ThemeContextValue | null>(null);

function getSystemPreference(): ResolvedMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolve(mode: ColorMode): ResolvedMode {
  return mode === "system" ? getSystemPreference() : mode;
}

function readStored(): ColorMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system")
      return stored;
  } catch {
    /* localStorage may be unavailable */
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(readStored);
  const [systemPref, setSystemPref] = useState<ResolvedMode>(
    getSystemPreference
  );

  const resolvedMode: ResolvedMode =
    mode === "system" ? systemPref : mode;

  /* Listen for OS preference changes */
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setSystemPref(e.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  /* Apply CSS vars whenever resolved mode changes */
  useEffect(() => {
    applyTheme(resolvedMode);
  }, [resolvedMode]);

  const setMode = useCallback((m: ColorMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next: ColorMode = resolve(prev) === "light" ? "dark" : "light";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedMode, setMode, toggleMode }),
    [mode, resolvedMode, setMode, toggleMode]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
