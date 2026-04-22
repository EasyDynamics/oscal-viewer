import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const GA_ID = "G-J56BFX8610";

/**
 * useCookieConsent has a module-level `gaLoaded` flag that persists
 * across renders. Reset it (by re-importing the module) for each
 * test so behaviour is reproducible.
 */
async function loadHook() {
  vi.resetModules();
  const mod = await import("./useCookieConsent");
  return mod.useCookieConsent;
}

function clearAllCookies() {
  document.cookie
    .split("; ")
    .map((c) => c.split("=")[0])
    .filter(Boolean)
    .forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    });
}

beforeEach(() => {
  clearAllCookies();
  // Clear window flags set by previous tests
  delete (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`];
  delete (window as unknown as Record<string, unknown>).dataLayer;
  delete (window as unknown as Record<string, unknown>).gtag;
  // Remove any gtag scripts we injected previously
  document.querySelectorAll("script[src*='googletagmanager']").forEach((s) =>
    s.remove(),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCookieConsent() initial state", () => {
  it("returns null consent when no cookie is set", async () => {
    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current.consent).toBeNull();
  });

  it('returns "accepted" when the cookie value is accepted', async () => {
    document.cookie = "cookie_consent=accepted; Path=/";
    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current.consent).toBe("accepted");
  });

  it('returns "declined" when the cookie value is declined', async () => {
    document.cookie = "cookie_consent=declined; Path=/";
    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current.consent).toBe("declined");
  });

  it("returns null when the cookie value is garbage", async () => {
    document.cookie = "cookie_consent=junk; Path=/";
    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current.consent).toBeNull();
  });
});

describe("accept()", () => {
  it('writes the cookie, sets consent to "accepted", and injects the GA script', async () => {
    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());

    act(() => result.current.accept());

    expect(result.current.consent).toBe("accepted");
    expect(document.cookie).toContain("cookie_consent=accepted");

    const gaScript = document.querySelector(
      "script[src*='googletagmanager']",
    ) as HTMLScriptElement | null;
    expect(gaScript).not.toBeNull();
    expect(gaScript!.src).toContain(GA_ID);

    // gtag + dataLayer were initialised
    const w = window as unknown as Record<string, unknown>;
    expect(Array.isArray(w.dataLayer)).toBe(true);
    expect(typeof w.gtag).toBe("function");
  });

  it("re-enabling after a prior decline clears the ga-disable flag and does not re-inject the script", async () => {
    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());

    act(() => result.current.accept());
    // Simulate a later decline flipping the disable flag back on
    act(() => result.current.decline());
    const w = window as unknown as Record<string, unknown>;
    expect(w[`ga-disable-${GA_ID}`]).toBe(true);

    // Count current GA scripts so we can check idempotence
    const before = document.querySelectorAll(
      "script[src*='googletagmanager']",
    ).length;

    act(() => result.current.accept());

    expect(w[`ga-disable-${GA_ID}`]).toBe(false);
    const after = document.querySelectorAll(
      "script[src*='googletagmanager']",
    ).length;
    expect(after).toBe(before); // no new script injected
  });

  it("the injected gtag function forwards calls to dataLayer", async () => {
    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());

    act(() => result.current.accept());

    const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
    const startLen = w.dataLayer.length;
    w.gtag("event", "test");
    expect(w.dataLayer.length).toBe(startLen + 1);
  });
});

describe("decline()", () => {
  it('writes the cookie, sets consent to "declined", and sets the ga-disable flag', async () => {
    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());

    act(() => result.current.decline());

    expect(result.current.consent).toBe("declined");
    expect(document.cookie).toContain("cookie_consent=declined");

    const w = window as unknown as Record<string, unknown>;
    expect(w[`ga-disable-${GA_ID}`]).toBe(true);
  });

  it("removes any existing _ga / _ga_* cookies", async () => {
    document.cookie = "_ga=GA1.1.123; Path=/";
    document.cookie = "_ga_ABC=GA1.1.456; Path=/";
    document.cookie = "unrelated=keep-me; Path=/";

    const useCookieConsent = await loadHook();
    const { result } = renderHook(() => useCookieConsent());

    act(() => result.current.decline());

    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).not.toContain("_ga_ABC=");
    expect(document.cookie).toContain("unrelated=keep-me");
  });
});
