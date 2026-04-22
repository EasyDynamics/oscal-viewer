import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";

const STORAGE_KEY = "theme-mode";

/**
 * Stubbed MediaQueryList that lets tests drive `matches` and dispatch
 * `change` events on demand. Matches the minimal surface the product
 * code uses: `matches`, `addEventListener`, `removeEventListener`.
 */
interface StubMQL {
  matches: boolean;
  listeners: Array<(e: MediaQueryListEvent) => void>;
  addEventListener: (type: "change", cb: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (type: "change", cb: (e: MediaQueryListEvent) => void) => void;
  dispatch: (matches: boolean) => void;
}

function makeMqlStub(initial: boolean): StubMQL {
  const mql: StubMQL = {
    matches: initial,
    listeners: [],
    addEventListener: (_t, cb) => {
      mql.listeners.push(cb);
    },
    removeEventListener: (_t, cb) => {
      mql.listeners = mql.listeners.filter((l) => l !== cb);
    },
    dispatch: (matches: boolean) => {
      mql.matches = matches;
      const ev = { matches } as MediaQueryListEvent;
      mql.listeners.forEach((cb) => cb(ev));
    },
  };
  return mql;
}

let mql: StubMQL;

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  mql = makeMqlStub(false);
  vi.stubGlobal("matchMedia", () => mql);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useTheme()", () => {
  it("throws when called outside a <ThemeProvider>", () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      /useTheme must be used within <ThemeProvider>/,
    );
  });

  it("returns the context value when wrapped", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current).toBeDefined();
    expect(typeof result.current.setMode).toBe("function");
    expect(typeof result.current.toggleMode).toBe("function");
  });
});

describe("<ThemeProvider> initial mode", () => {
  it('defaults to "system" when localStorage is empty', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("system");
  });

  it.each(["light", "dark", "system"] as const)(
    'restores "%s" from localStorage on mount',
    (stored) => {
      localStorage.setItem(STORAGE_KEY, stored);
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.mode).toBe(stored);
    },
  );

  it('falls back to "system" when the stored value is corrupted', () => {
    localStorage.setItem(STORAGE_KEY, "neon-pink");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("system");
  });

  it('falls back to "system" when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("system");
  });
});

describe("<ThemeProvider> resolvedMode", () => {
  it('resolves "system" mode to light when OS prefers light', () => {
    mql = makeMqlStub(false);
    vi.stubGlobal("matchMedia", () => mql);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("system");
    expect(result.current.resolvedMode).toBe("light");
  });

  it('resolves "system" mode to dark when OS prefers dark', () => {
    mql = makeMqlStub(true);
    vi.stubGlobal("matchMedia", () => mql);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.resolvedMode).toBe("dark");
  });

  it("uses the user choice when mode is an explicit light/dark", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    mql = makeMqlStub(false); // OS prefers light
    vi.stubGlobal("matchMedia", () => mql);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.resolvedMode).toBe("dark");
  });

  it("updates resolvedMode when the OS preference changes (while mode is system)", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.resolvedMode).toBe("light");
    act(() => mql.dispatch(true));
    expect(result.current.resolvedMode).toBe("dark");
    act(() => mql.dispatch(false));
    expect(result.current.resolvedMode).toBe("light");
  });

  it("applies the theme on mount and whenever resolvedMode changes", () => {
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    act(() => mql.dispatch(true));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("setMode()", () => {
  it("updates state and persists to localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setMode("dark"));
    expect(result.current.mode).toBe("dark");
    expect(result.current.resolvedMode).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("tolerates a localStorage.setItem throw but still updates state", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => result.current.setMode("light"));
    expect(result.current.mode).toBe("light");
  });
});

describe("toggleMode()", () => {
  it("flips from light to dark", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("flips from dark to light", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it('from "system" resolved as light, flips to explicit dark', () => {
    mql = makeMqlStub(false);
    vi.stubGlobal("matchMedia", () => mql);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("system");
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("dark");
  });

  it('from "system" resolved as dark, flips to explicit light', () => {
    mql = makeMqlStub(true);
    vi.stubGlobal("matchMedia", () => mql);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("system");
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("light");
  });

  it("tolerates a localStorage.setItem throw but still updates state", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => result.current.toggleMode());
    // mode was "system", resolvedMode was "light" → should flip to "dark"
    expect(result.current.mode).toBe("dark");
  });
});

describe("<ThemeProvider> cleanup", () => {
  it("removes the matchMedia change listener on unmount", () => {
    const { unmount } = renderHook(() => useTheme(), { wrapper });
    expect(mql.listeners.length).toBe(1);
    unmount();
    expect(mql.listeners.length).toBe(0);
  });
});
