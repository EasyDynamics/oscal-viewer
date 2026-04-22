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
import {
  checkUrlFormat,
  resolveHref,
  useImportResolver,
  type BackMatterResource,
} from "./useImportResolver";

/* ═════════════════════════════════════════════════════════════════════
   Pure helpers (preserved from round 2)
   ═════════════════════════════════════════════════════════════════════ */

describe("checkUrlFormat()", () => {
  it("accepts .json URLs", () => {
    expect(checkUrlFormat("https://example.com/catalog.json")).toBeNull();
  });

  it("accepts URLs without an extension", () => {
    expect(checkUrlFormat("https://api.example.com/catalogs/abc")).toBeNull();
  });

  it("rejects common non-JSON extensions", () => {
    expect(checkUrlFormat("https://example.com/catalog.xml")).toMatch(
      /not JSON/,
    );
    expect(checkUrlFormat("https://example.com/catalog.yaml")).toMatch(
      /not JSON/,
    );
    expect(checkUrlFormat("https://example.com/catalog.yml")).toMatch(
      /not JSON/,
    );
    expect(checkUrlFormat("https://example.com/catalog.html")).toMatch(
      /not JSON/,
    );
  });

  it("ignores case on the extension check", () => {
    expect(checkUrlFormat("https://example.com/CATALOG.XML")).toMatch(
      /not JSON/,
    );
  });

  it("returns null for unparseable URLs rather than throwing", () => {
    expect(checkUrlFormat("not a url at all")).toBeNull();
  });
});

describe("resolveHref()", () => {
  const jsonResource: BackMatterResource = {
    uuid: "r-json",
    title: "Catalog resource",
    rlinks: [
      { href: "https://example.com/cat.json", "media-type": "application/json" },
    ],
  };
  const xmlOnlyResource: BackMatterResource = {
    uuid: "r-xml",
    rlinks: [
      { href: "https://example.com/cat.xml", "media-type": "application/xml" },
    ],
  };
  const mixedResource: BackMatterResource = {
    uuid: "r-mixed",
    rlinks: [
      { href: "https://example.com/cat.xml", "media-type": "application/xml" },
      { href: "https://example.com/cat.json", "media-type": "application/json" },
    ],
  };

  it("returns null on an empty href without erroring", () => {
    expect(resolveHref("", [])).toEqual({
      url: null,
      title: null,
      formatError: null,
    });
  });

  it("passes a direct JSON URL through", () => {
    const out = resolveHref("https://example.com/cat.json", []);
    expect(out.url).toBe("https://example.com/cat.json");
    expect(out.formatError).toBeNull();
  });

  it("reports a formatError on a direct non-JSON URL", () => {
    const out = resolveHref("https://example.com/cat.xml", []);
    expect(out.url).toBeNull();
    expect(out.formatError).toMatch(/not JSON/);
  });

  it("resolves a #uuid back-matter reference with a JSON rlink", () => {
    const out = resolveHref("#r-json", [jsonResource]);
    expect(out.url).toBe("https://example.com/cat.json");
    expect(out.title).toBe("Catalog resource");
    expect(out.formatError).toBeNull();
  });

  it("prefers JSON rlink over XML when both are present", () => {
    const out = resolveHref("#r-mixed", [mixedResource]);
    expect(out.url).toBe("https://example.com/cat.json");
    expect(out.formatError).toBeNull();
  });

  it("emits a formatError when every rlink on the resource is unsupported", () => {
    const out = resolveHref("#r-xml", [xmlOnlyResource]);
    expect(out.url).toBeNull();
    expect(out.formatError).toMatch(/not JSON/);
  });

  it("returns nulls when the #uuid doesn't exist in back-matter", () => {
    expect(resolveHref("#nope", [jsonResource])).toEqual({
      url: null,
      title: null,
      formatError: null,
    });
  });
});

/* ═════════════════════════════════════════════════════════════════════
   Hook body
   ═════════════════════════════════════════════════════════════════════ */

interface Props {
  href: string | null;
  backMatter: BackMatterResource[];
  baseUrl: string | null;
  token: string | null;
  modelKey: string;
  skip?: boolean;
}

const DEFAULT_PROPS: Props = {
  href: null,
  backMatter: [],
  baseUrl: null,
  token: null,
  modelKey: "catalog",
  skip: false,
};

function renderResolver(overrides: Partial<Props> = {}) {
  const props = { ...DEFAULT_PROPS, ...overrides };
  return renderHook(
    (p: Props) =>
      useImportResolver(
        p.href,
        p.backMatter,
        p.baseUrl,
        p.token,
        p.modelKey,
        p.skip ?? false,
      ),
    { initialProps: props },
  );
}

function jsonResponse(
  body: unknown,
  init: { status?: number; contentType?: string } = {},
): Response {
  const headers: Record<string, string> = {
    "Content-Type": init.contentType ?? "application/json",
  };
  const text =
    typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status: init.status ?? 200,
    statusText: init.status && init.status >= 400 ? "Internal Error" : "OK",
    headers,
  });
}

describe("useImportResolver() — early-reset paths", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays idle when skip=true and no fetch is attempted", () => {
    const { result } = renderResolver({
      href: "https://example.com/x.json",
      skip: true,
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.json).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays idle when href is null", () => {
    const { result } = renderResolver({ href: null });
    expect(result.current.status).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays idle when href is an empty string", () => {
    const { result } = renderResolver({ href: "" });
    expect(result.current.status).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not re-fetch when rerendering with the same href", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ catalog: { metadata: {} } }),
    );
    const { result, rerender } = renderResolver({
      href: "https://example.com/x.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender({ ...DEFAULT_PROPS, href: "https://example.com/x.json" });
    // Rerender shouldn't trigger another fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useImportResolver() — resolveHref errors", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors on a direct non-JSON URL (formatError)", async () => {
    const { result } = renderResolver({
      href: "https://example.com/cat.xml",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not JSON/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("errors when a #uuid resource has only XML rlinks", async () => {
    const bm: BackMatterResource[] = [
      {
        uuid: "x",
        rlinks: [{ href: "https://example.com/cat.xml", "media-type": "application/xml" }],
      },
    ];
    const { result } = renderResolver({
      href: "#x",
      backMatter: bm,
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not JSON/);
  });

  it("errors with a specific message when a #uuid is missing from back-matter", async () => {
    const { result } = renderResolver({
      href: "#missing",
      backMatter: [],
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Back-matter resource #missing/);
  });
});

describe("useImportResolver() — relative URL resolution", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ catalog: { metadata: {} } }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors when href is relative and no baseUrl is provided", async () => {
    const { result } = renderResolver({
      href: "catalog",
      baseUrl: null,
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Cannot resolve relative URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves a relative href against baseUrl before fetching", async () => {
    const { result } = renderResolver({
      href: "sub/catalog",
      baseUrl: "https://example.com/parent/doc.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/parent/sub/catalog",
      expect.anything(),
    );
  });
});

describe("useImportResolver() — pre-flight extension check", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks a resolved absolute URL ending in an unsupported extension", async () => {
    // Pass a back-matter resource whose JSON-media-type rlink points at a
    // .xml URL — resolveHref happily returns it (media-type wins over
    // extension), so only the fetchUrl-level checkUrlFormat catches it.
    const { result } = renderResolver({
      href: "#r",
      backMatter: [
        {
          uuid: "r",
          rlinks: [
            { href: "https://example.com/oops.xml", "media-type": "application/json" },
          ],
        },
      ],
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not JSON/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useImportResolver() — fetch response paths", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("succeeds on a JSON response wrapped under modelKey, validates metadata", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ catalog: { metadata: { title: "t" } } }),
    );
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.json).toEqual({ catalog: { metadata: { title: "t" } } });
    expect(result.current.error).toBeNull();
    expect(result.current.label).toBe("cat.json");
  });

  it("uses the back-matter resource title as the label when available", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ catalog: { metadata: { title: "t" } } }),
    );
    const { result } = renderResolver({
      href: "#r",
      backMatter: [
        {
          uuid: "r",
          title: "NIST Rev5 Catalog",
          rlinks: [
            { href: "https://example.com/cat.json", "media-type": "application/json" },
          ],
        },
      ],
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.label).toBe("NIST Rev5 Catalog");
  });

  it("succeeds on an unwrapped payload that has uuid but no metadata", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ uuid: "cat-1" }));
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.json).toEqual({ uuid: "cat-1" });
  });

  it("errors when the payload has neither metadata nor uuid", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unrelated: 1 }));
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/no metadata or uuid found/);
  });

  it("errors on a non-2xx HTTP response", async () => {
    fetchMock.mockResolvedValue(jsonResponse("nope", { status: 500 }));
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/HTTP 500/);
  });

  it("errors when response content-type is XML", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse("<xml/>", { contentType: "application/xml" }),
    );
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not JSON/);
  });

  it("errors when response content-type is YAML", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse("k: v", { contentType: "text/yaml" }),
    );
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not JSON/);
  });

  it("errors on an unrecognised content-type (not json/octet-stream/text-plain)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse("hi", { contentType: "text/html" }),
    );
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Expected JSON/);
  });

  it("accepts octet-stream and text/plain content types (lenient)", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ metadata: {} }), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("accepts a response with no content-type header", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ metadata: {} }), {
        status: 200,
      }),
    );
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("reports an XML-looking body that fails JSON.parse as such", async () => {
    fetchMock.mockResolvedValue(
      new Response("<?xml version='1.0'?><root/>", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/appears to be XML/);
  });

  it("reports garbage JSON as an invalid body", async () => {
    fetchMock.mockResolvedValue(
      new Response("not-json-garbage", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not valid JSON/);
  });
});

describe("useImportResolver() — fetch-error paths", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces a generic Error message from authFetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("DNS boom")));
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("DNS boom");
  });

  it("falls back to a generic message when the rejection is not an Error instance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("plain string"));
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "profile",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Failed to fetch profile/);
  });

  it("reports a timeout-style message on AbortError", async () => {
    const abortErr = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr));
    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Timed out resolving catalog/);
  });
});

describe("useImportResolver() — cleanup on unmount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aborts an in-flight fetch and suppresses state updates after unmount", async () => {
    let rejectFn: (err: unknown) => void = () => {};
    const pending = new Promise<Response>((_, reject) => {
      rejectFn = reject;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result, unmount } = renderResolver({
      href: "https://example.com/cat.json",
    });

    // Effect runs on mount; status becomes "loading"
    await waitFor(() => expect(result.current.status).toBe("loading"));

    unmount();

    // Reject the promise post-unmount — cancelled branches should swallow
    // any would-be state update silently.
    rejectFn(new Error("late failure"));
    await Promise.resolve();

    // No crash, no state assertion change observable from unmounted hook
    expect(result.current.status).toBe("loading");
    expect(result.current.error).toBeNull();
  });

  it("silently returns from the text handler when unmounted between res.text() and its resolution", async () => {
    // Engineer the race: fetch resolves with a Response-like whose text()
    // is a controllable promise. Unmount before the text() resolves, then
    // resolve it — the text handler should hit its `if (cancelled) return`
    // guard and make no state updates.
    let resolveText: (s: string) => void = () => {};
    const textPromise = new Promise<string>((r) => {
      resolveText = r;
    });
    const fakeRes = {
      ok: true,
      headers: { get: () => "application/json" },
      text: () => textPromise,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeRes));

    const { result, unmount } = renderResolver({
      href: "https://example.com/cat.json",
    });

    await waitFor(() => expect(result.current.status).toBe("loading"));

    // Unmount first — sets cancelled = true via the cleanup function
    unmount();

    // Now resolve res.text() — the second .then((text) => if (cancelled)...)
    // handler fires with cancelled = true and exits silently.
    resolveText("{}");
    await Promise.resolve();
    await Promise.resolve();

    // Hook is unmounted; no success state should be observable.
    expect(result.current.status).toBe("loading");
  });
});

/* ═════════════════════════════════════════════════════════════════════
   Branch and function gap-closers
   ═════════════════════════════════════════════════════════════════════ */

describe("isRlinkSupported() (exercised via resolveHref)", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ metadata: {} }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("picks an rlink whose media-type has no JSON hint but whose extension is .json", async () => {
    // No explicit JSON media-type → jsonRlink filter fails → falls back to
    // isRlinkSupported which allows this by extension.
    const { result } = renderResolver({
      href: "#r",
      backMatter: [
        {
          uuid: "r",
          rlinks: [
            {
              href: "https://example.com/cat.json",
              "media-type": "text/plain",
            },
          ],
        },
      ],
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("picks an rlink with no media-type at all (extension check path)", async () => {
    const { result } = renderResolver({
      href: "#r",
      backMatter: [
        {
          uuid: "r",
          rlinks: [{ href: "https://example.com/cat.json" }],
        },
      ],
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("rejects an rlink with an HTML media-type", async () => {
    // No JSON rlink, and the only candidate has an HTML media-type →
    // isRlinkSupported returns false → no supported rlink → hook errors.
    const { result } = renderResolver({
      href: "#r",
      backMatter: [
        {
          uuid: "r",
          rlinks: [
            { href: "https://example.com/cat", "media-type": "text/html" },
          ],
        },
      ],
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not JSON/);
  });

  it("rejects an rlink with a YAML media-type", async () => {
    const { result } = renderResolver({
      href: "#r",
      backMatter: [
        {
          uuid: "r",
          rlinks: [
            { href: "https://example.com/cat", "media-type": "application/yaml" },
          ],
        },
      ],
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not JSON/);
  });

  it("rejects an rlink with no media-type whose href has an unsupported extension", async () => {
    const { result } = renderResolver({
      href: "#r",
      backMatter: [
        {
          uuid: "r",
          // No media-type + .xml extension → isRlinkSupported's
          // UNSUPPORTED_EXTENSIONS check rejects it.
          rlinks: [{ href: "https://example.com/cat.xml" }],
        },
      ],
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/not JSON/);
  });
});

describe("useImportResolver() — content-type header absent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a missing content-type header as empty string (lenient path)", async () => {
    // Construct a Response-like whose headers.get explicitly returns null,
    // forcing the `?? ""` fallback to be taken.
    const fakeRes = {
      ok: true,
      headers: { get: () => null },
      text: async () => JSON.stringify({ metadata: {} }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeRes));

    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });
});

describe("resolveHref() — resource exists but has no usable rlinks", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null url with no formatError when a resource has no rlinks", async () => {
    const { result } = renderResolver({
      href: "#r",
      backMatter: [{ uuid: "r", title: "labelled" }],
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    // Hits the hook's `!rawUrl` path with the #-prefix message
    expect(result.current.error).toMatch(/Back-matter resource #r/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("internal fileNameFromUrl fallback (no path segments)", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ metadata: {} }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the raw URL as the label when the path has no segments", async () => {
    const { result } = renderResolver({
      href: "https://example.com/",
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.label).toBe("https://example.com/");
  });
});

describe("resolveRelativeUrl() — new URL() throws on a malformed base", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors with a clear message when the baseUrl is itself unparseable", async () => {
    const { result } = renderResolver({
      href: "relative/path/doc",
      baseUrl: "not a url at all",
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Cannot resolve relative URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useImportResolver() — href-unchanged guard on re-run", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ metadata: {} }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips resolution when the effect re-runs with an unchanged href but a different backMatter ref", async () => {
    const { result, rerender } = renderResolver({
      href: "https://example.com/cat.json",
      backMatter: [],
      modelKey: "catalog",
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Rerender with a fresh [] for backMatter — different reference
    // triggers the useEffect, but the href-guard should early-return.
    rerender({
      ...DEFAULT_PROPS,
      href: "https://example.com/cat.json",
      backMatter: [],
      modelKey: "catalog",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("useImportResolver() — 10s timeout fires via setTimeout callback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("aborts the fetch when the 10s deadline passes", async () => {
    // Capture the 10s setTimeout the hook schedules, so we can fire it on
    // demand without actually waiting 10 seconds or running fake timers
    // (which would break @testing-library/react's waitFor).
    const originalSetTimeout = globalThis.setTimeout;
    let capturedCb: (() => void) | null = null;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(
      ((cb: () => void, delay?: number) => {
        if (delay === 10_000) {
          capturedCb = cb;
          return 999 as unknown as ReturnType<typeof setTimeout>;
        }
        return originalSetTimeout(cb, delay);
      }) as typeof setTimeout,
    );

    // Fetch that stays pending until its signal aborts
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderResolver({
      href: "https://example.com/cat.json",
      modelKey: "catalog",
    });

    await waitFor(() => expect(result.current.status).toBe("loading"));
    expect(capturedCb).not.toBeNull();

    // Fire the captured 10s callback — this is what the deadline would do
    capturedCb!();

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/Timed out resolving catalog/);
  });
});
