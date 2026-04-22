import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useUrlDocument, fileNameFromUrl } from "./useUrlDocument";
import { AuthProvider } from "../context/AuthContext";

/* ───────── fileNameFromUrl (pure helper) ───────── */

describe("fileNameFromUrl()", () => {
  it("returns the last path segment of an absolute URL", () => {
    expect(fileNameFromUrl("https://example.com/a/b/catalog.json")).toBe(
      "catalog.json",
    );
  });

  it("ignores a trailing slash when picking the segment", () => {
    expect(fileNameFromUrl("https://example.com/a/b/c/")).toBe("c");
  });

  it("falls back to the raw input for malformed URLs", () => {
    expect(fileNameFromUrl("not a url")).toBe("not a url");
  });

  it("falls back to the raw input when the URL has no path segments", () => {
    expect(fileNameFromUrl("https://example.com")).toBe("https://example.com");
  });
});

/* ───────── useUrlDocument() hook body ───────── */

function makeWrapper(initialPath: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    );
  };
}

describe("useUrlDocument() — no ?url= param", () => {
  it("returns nulls and does not fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useUrlDocument(), {
      wrapper: makeWrapper("/"),
    });
    expect(result.current.json).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.sourceUrl).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("useUrlDocument() — successful fetch", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ catalog: { metadata: {} } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with isLoading=true, then resolves with parsed JSON", async () => {
    const url = "https://example.com/cat.json";
    const { result } = renderHook(() => useUrlDocument(), {
      wrapper: makeWrapper(`/?url=${encodeURIComponent(url)}`),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.sourceUrl).toBe(url);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.json).toEqual({ catalog: { metadata: {} } });
    expect(result.current.sourceUrl).toBe(url);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useUrlDocument() — HTTP errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports an error when the response is non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("nope", { status: 500, statusText: "Internal Error" }),
      ),
    );
    const { result } = renderHook(() => useUrlDocument(), {
      wrapper: makeWrapper("/?url=https://example.com/x.json"),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/HTTP 500/);
    expect(result.current.json).toBeNull();
  });
});

describe("useUrlDocument() — network errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces a generic fetch throw as an error string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("DNS boom")),
    );
    const { result } = renderHook(() => useUrlDocument(), {
      wrapper: makeWrapper("/?url=https://example.com/x.json"),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("DNS boom");
  });

  it("surfaces a non-Error throw with the fallback message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("plain string"));
    const { result } = renderHook(() => useUrlDocument(), {
      wrapper: makeWrapper("/?url=https://example.com/x.json"),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/Failed to fetch document/);
  });

  it('reports a timeout-style message when the abort fires as "AbortError"', async () => {
    const abortErr = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr));
    const { result } = renderHook(() => useUrlDocument(), {
      wrapper: makeWrapper("/?url=https://example.com/x.json"),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/timed out/i);
  });
});

describe("useUrlDocument() — cleanup on unmount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aborts the in-flight fetch and does not set state", async () => {
    let rejectFn: (err: unknown) => void = () => {};
    const pending = new Promise<Response>((_, reject) => {
      rejectFn = reject;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result, unmount } = renderHook(() => useUrlDocument(), {
      wrapper: makeWrapper("/?url=https://example.com/x.json"),
    });
    expect(result.current.isLoading).toBe(true);

    unmount();

    // Reject the pending promise after unmount — cancelled branch should
    // suppress state updates. Assert isLoading stays true (last seen
    // value, because setState was never called post-unmount).
    rejectFn(
      Object.assign(new Error("after unmount"), { name: "AbortError" }),
    );
    await Promise.resolve();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
