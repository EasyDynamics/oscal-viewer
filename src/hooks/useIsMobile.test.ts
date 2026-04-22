import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import useIsMobile from "./useIsMobile";

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
      mql.listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
    },
  };
  return mql;
}

let mql: StubMQL;

beforeEach(() => {
  mql = makeMqlStub(false);
  vi.stubGlobal("matchMedia", () => mql);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIsMobile()", () => {
  it("returns false when the viewport does not match the mobile breakpoint", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true when the viewport matches the mobile breakpoint on mount", () => {
    mql = makeMqlStub(true);
    vi.stubGlobal("matchMedia", () => mql);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("updates when matchMedia fires a change event", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => mql.dispatch(true));
    expect(result.current).toBe(true);
    act(() => mql.dispatch(false));
    expect(result.current).toBe(false);
  });

  it("removes the change listener on unmount", () => {
    const { unmount } = renderHook(() => useIsMobile());
    expect(mql.listeners.length).toBe(1);
    unmount();
    expect(mql.listeners.length).toBe(0);
  });
});
