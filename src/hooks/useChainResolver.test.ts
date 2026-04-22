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
  extractCatalogFromProfile,
  extractProfileFromSsp,
  extractSspFromAp,
  useChainResolver,
  AP_CHAIN,
  PROFILE_CHAIN,
  type ChainLink,
} from "./useChainResolver";
import type { BackMatterResource } from "./useImportResolver";

/* ═════════════════════════════════════════════════════════════════════
   Extractors (preserved from round 2)
   ═════════════════════════════════════════════════════════════════════ */

describe("extractCatalogFromProfile()", () => {
  it("pulls the first import href from a profile-wrapped payload", () => {
    const json = {
      profile: {
        imports: [
          { href: "https://example.com/cat.json" },
          { href: "https://example.com/ignored.json" },
        ],
        "back-matter": { resources: [] },
      },
    };
    expect(extractCatalogFromProfile(json)).toEqual({
      href: "https://example.com/cat.json",
      backMatter: [],
    });
  });

  it("returns back-matter resources when present", () => {
    const resources = [{ uuid: "abc", rlinks: [{ href: "x.json" }] }];
    const json = {
      profile: {
        imports: [{ href: "#abc" }],
        "back-matter": { resources },
      },
    };
    const out = extractCatalogFromProfile(json);
    expect(out.href).toBe("#abc");
    expect(out.backMatter).toBe(resources);
  });

  it("yields a null href when imports is missing", () => {
    const json = { profile: { "back-matter": { resources: [] } } };
    expect(extractCatalogFromProfile(json).href).toBeNull();
  });

  it("accepts an unwrapped payload (no profile wrapper)", () => {
    // Exercises the `obj.profile ?? obj` right-hand fallback branch
    const json = {
      imports: [{ href: "https://example.com/cat.json" }],
      "back-matter": { resources: [] },
    };
    expect(extractCatalogFromProfile(json).href).toBe(
      "https://example.com/cat.json",
    );
  });

  it("returns [] for backMatter when resources is absent", () => {
    // Exercises the `?.resources ?? []` fallback branch
    const json = {
      profile: {
        imports: [{ href: "https://example.com/cat.json" }],
        "back-matter": {},
      },
    };
    expect(extractCatalogFromProfile(json).backMatter).toEqual([]);
  });
});

describe("extractProfileFromSsp()", () => {
  it("pulls import-profile.href from an SSP-wrapped payload", () => {
    const json = {
      "system-security-plan": {
        "import-profile": { href: "https://example.com/profile.json" },
        "back-matter": { resources: [] },
      },
    };
    expect(extractProfileFromSsp(json)).toEqual({
      href: "https://example.com/profile.json",
      backMatter: [],
    });
  });

  it("yields a null href when import-profile is absent", () => {
    const json = { "system-security-plan": { "back-matter": { resources: [] } } };
    expect(extractProfileFromSsp(json).href).toBeNull();
  });

  it("accepts an unwrapped SSP payload", () => {
    const json = {
      "import-profile": { href: "https://example.com/p.json" },
      "back-matter": {},
    };
    expect(extractProfileFromSsp(json)).toEqual({
      href: "https://example.com/p.json",
      backMatter: [],
    });
  });
});

describe("extractSspFromAp()", () => {
  it("pulls import-ssp.href from an AP-wrapped payload", () => {
    const json = {
      "assessment-plan": {
        "import-ssp": { href: "https://example.com/ssp.json" },
        "back-matter": { resources: [] },
      },
    };
    expect(extractSspFromAp(json)).toEqual({
      href: "https://example.com/ssp.json",
      backMatter: [],
    });
  });

  it("yields a null href when import-ssp is absent", () => {
    const json = { "assessment-plan": { "back-matter": { resources: [] } } };
    expect(extractSspFromAp(json).href).toBeNull();
  });

  it("accepts an unwrapped AP payload", () => {
    const json = {
      "import-ssp": { href: "https://example.com/s.json" },
      "back-matter": {},
    };
    expect(extractSspFromAp(json)).toEqual({
      href: "https://example.com/s.json",
      backMatter: [],
    });
  });
});

/* ═════════════════════════════════════════════════════════════════════
   Hook body
   ═════════════════════════════════════════════════════════════════════ */

interface Props {
  initialHref: string | null | undefined;
  backMatter: BackMatterResource[];
  baseUrl: string | null;
  token: string | null;
  chain: ChainLink[];
  skip?: boolean;
}

const CATALOG_ONLY: ChainLink[] = [{ label: "Catalog", modelKey: "catalog" }];

const DEFAULT_PROPS: Props = {
  initialHref: null,
  backMatter: [],
  baseUrl: null,
  token: null,
  chain: CATALOG_ONLY,
  skip: false,
};

function renderChain(overrides: Partial<Props> = {}) {
  const props = { ...DEFAULT_PROPS, ...overrides };
  return renderHook(
    (p: Props) =>
      useChainResolver(
        p.initialHref,
        p.backMatter,
        p.baseUrl,
        p.token,
        p.chain,
        p.skip,
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
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status: init.status ?? 200,
    statusText: init.status && init.status >= 400 ? "Internal Error" : "OK",
    headers,
  });
}

/* ─────────── Effect-level early returns ─────────── */

describe("useChainResolver() — effect early returns", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts idle with every step as idle when initialHref is null", () => {
    const { result } = renderChain({ initialHref: null });
    expect(result.current.steps.every((s) => s.status === "idle")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when the chain is empty", () => {
    const { result } = renderChain({
      initialHref: "https://example.com/x.json",
      chain: [],
    });
    expect(result.current.steps).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records lastHref and short-circuits when skip=true on first mount", () => {
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
      chain: CATALOG_ONLY,
      skip: true,
    });
    // No fetch attempted, steps stay idle
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.steps[0].status).toBe("idle");
  });

  it("does not re-run when initialHref stays the same across rerenders", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ catalog: { metadata: {} } }));
    const { result, rerender } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Rerender with same initialHref but a different backMatter ref
    rerender({
      ...DEFAULT_PROPS,
      initialHref: "https://example.com/cat.json",
      backMatter: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resets to idle when initialHref goes from set to null", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ catalog: { metadata: {} } }));
    const { result, rerender } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );

    rerender({ ...DEFAULT_PROPS, initialHref: null });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("idle"),
    );
    expect(result.current.steps[0].json).toBeNull();
  });

  it("skips re-resolution when token changes but initialHref is unchanged", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ catalog: { metadata: {} } }));
    const { result, rerender } = renderChain({
      initialHref: "https://example.com/cat.json",
      token: null,
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Changing token re-triggers useEffect ([initialHref, token]) but
    // the lastHref guard should short-circuit since initialHref is the
    // same URL.
    rerender({
      ...DEFAULT_PROPS,
      initialHref: "https://example.com/cat.json",
      token: "new-token",
    });

    // No new fetch triggered
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-runs the chain after a reset cycle even when skip=true", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ catalog: { metadata: {} } }));
    // Initial: skip=true, so first mount short-circuits
    const { result, rerender } = renderChain({
      initialHref: "https://example.com/one.json",
      skip: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    // Null-out the href to trigger reset → hasResetRef = true
    rerender({ ...DEFAULT_PROPS, initialHref: null, skip: true });
    // Set a new href with skip still true → should run because hasResetRef
    rerender({
      ...DEFAULT_PROPS,
      initialHref: "https://example.com/two.json",
      skip: true,
    });

    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(fetchMock).toHaveBeenCalled();
  });
});

/* ─────────── Per-step branches ─────────── */

describe("useChainResolver() — resolveHref errors", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops the chain when the first step has a formatError (direct .xml URL)", async () => {
    const { result } = renderChain({
      initialHref: "https://example.com/cat.xml",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/not JSON/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a missing #uuid with the 'not found or has no download link' message", async () => {
    const { result } = renderChain({
      initialHref: "#missing",
      backMatter: [],
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/#missing/);
  });
});

describe("useChainResolver() — relative URL resolution", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ catalog: { metadata: {} } }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves a relative href against baseUrl before fetching", async () => {
    const { result } = renderChain({
      initialHref: "sub/cat.json",
      baseUrl: "https://example.com/parent/doc.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/parent/sub/cat.json",
      expect.anything(),
    );
  });

  it("errors when href is relative and no baseUrl is provided", async () => {
    const { result } = renderChain({
      initialHref: "relative",
      baseUrl: null,
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/no base URL available/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("errors when baseUrl is unparseable and new URL() throws", async () => {
    const { result } = renderChain({
      initialHref: "relative",
      baseUrl: "not a url",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/Cannot resolve relative URL: relative/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useChainResolver() — pre-flight URL format rejection", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a resolved URL whose extension is unsupported", async () => {
    // rlink says JSON media-type but points at .xml — resolveHref accepts
    // it, and only the fetchUrl-level checkUrlFormat catches it.
    const { result } = renderChain({
      initialHref: "#r",
      backMatter: [
        {
          uuid: "r",
          rlinks: [
            {
              href: "https://example.com/oops.xml",
              "media-type": "application/json",
            },
          ],
        },
      ],
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/not JSON/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/* ─────────── Fetch-side error handling ─────────── */

describe("useChainResolver() — fetch response errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("errors on a non-2xx HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse("nope", { status: 500 })),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/HTTP 500/);
  });

  it("errors when response content-type is XML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse("<xml/>", { contentType: "application/xml" }),
      ),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/not JSON/);
  });

  it("errors when response content-type is YAML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse("k: v", { contentType: "text/yaml" }),
      ),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/not JSON/);
  });

  it("errors on an unexpected content-type (html)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse("<!doctype html>", { contentType: "text/html" }),
      ),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/Expected JSON/);
  });

  it("accepts octet-stream and text/plain (lenient) and an absent content-type header", async () => {
    // A response-like with headers.get returning null → exercises the ?? "" fallback
    const fakeRes = {
      ok: true,
      headers: { get: () => null },
      text: async () => JSON.stringify({ metadata: {} }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeRes));
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
  });

  it("reports XML-looking body that fails JSON.parse as such", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<?xml?><r/>", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/appears to be XML/);
  });

  it("reports garbage JSON as an invalid body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not-json-garbage", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/not valid JSON/);
  });

  it("errors when the unwrapped payload has neither metadata nor uuid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ unrelated: 1 })),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(
      /does not appear to be a valid OSCAL catalog/,
    );
  });

  it("succeeds with a payload wrapped under modelKey and metadata present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ catalog: { metadata: { title: "t" } } }),
      ),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(result.current.steps[0].json).toEqual({
      catalog: { metadata: { title: "t" } },
    });
  });

  it("succeeds with an unwrapped payload that only has uuid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ uuid: "cat-1" })),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
  });

  it("uses back-matter resource title as the resolvedLabel when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ catalog: { metadata: {} } })),
    );
    const { result } = renderChain({
      initialHref: "#r",
      backMatter: [
        {
          uuid: "r",
          title: "NIST Rev5",
          rlinks: [
            { href: "https://example.com/cat.json", "media-type": "application/json" },
          ],
        },
      ],
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(result.current.steps[0].resolvedLabel).toBe("NIST Rev5");
  });

  it("falls back to fileNameFromUrl for resolvedLabel when no title is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ catalog: { metadata: {} } })),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/a/b/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(result.current.steps[0].resolvedLabel).toBe("cat.json");
  });

  it("handles a URL with no path segments via the fileNameFromUrl fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ catalog: { metadata: {} } })),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(result.current.steps[0].resolvedLabel).toBe("https://example.com/");
  });
});

describe("useChainResolver() — authFetch rejections", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces a generic Error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("DNS boom")),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toBe("DNS boom");
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("plain string"));
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/Failed to fetch catalog/);
  });

  it("reports a timeout message on AbortError", async () => {
    const abortErr = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr));
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(
      /Timed out resolving catalog/,
    );
  });
});

/* ─────────── Multi-step chain behaviour ─────────── */

describe("useChainResolver() — multi-step chain", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs a 2-step chain end-to-end when extractNext provides the second href", async () => {
    const chain: ChainLink[] = [
      {
        label: "Profile",
        modelKey: "profile",
        extractNext: () => ({
          href: "https://example.com/cat.json",
          backMatter: [],
        }),
      },
      { label: "Catalog", modelKey: "catalog" },
    ];
    const profileRes = jsonResponse({ profile: { metadata: {} } });
    const catalogRes = jsonResponse({ catalog: { metadata: {} } });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(profileRes)
      .mockResolvedValueOnce(catalogRes);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderChain({
      initialHref: "https://example.com/profile.json",
      chain,
    });

    await waitFor(() =>
      expect(result.current.steps[1].status).toBe("success"),
    );
    expect(result.current.steps[0].status).toBe("success");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://example.com/cat.json");
  });

  it("halts cleanly without error when extractNext returns null href", async () => {
    const chain: ChainLink[] = [
      {
        label: "Profile",
        modelKey: "profile",
        extractNext: () => ({ href: null, backMatter: [] }),
      },
      { label: "Catalog", modelKey: "catalog" },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ profile: { metadata: {} } }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderChain({
      initialHref: "https://example.com/profile.json",
      chain,
    });

    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    // Second step never ran
    expect(result.current.steps[1].status).toBe("idle");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops the chain on a mid-chain failure and leaves later steps idle", async () => {
    const chain: ChainLink[] = [
      {
        label: "Profile",
        modelKey: "profile",
        extractNext: () => ({
          href: "https://example.com/cat.json",
          backMatter: [],
        }),
      },
      { label: "Catalog", modelKey: "catalog" },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ profile: { metadata: {} } }))
      .mockResolvedValueOnce(jsonResponse("fail", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderChain({
      initialHref: "https://example.com/profile.json",
      chain,
    });

    await waitFor(() =>
      expect(result.current.steps[1].status).toBe("error"),
    );
    expect(result.current.steps[0].status).toBe("success");
    expect(result.current.steps[1].error).toMatch(/HTTP 404/);
  });
});

/* ─────────── Items derivation ─────────── */

describe("useChainResolver() — items output", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("filters idle steps out of the items array", () => {
    const { result } = renderChain({
      initialHref: null,
      chain: AP_CHAIN,
    });
    expect(result.current.items).toEqual([]);
  });

  it("shapes each non-idle step as a ResolverItem", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ catalog: { metadata: {} } }),
    );
    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
      chain: PROFILE_CHAIN,
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("success"),
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      label: "Catalog",
      status: "success",
      error: null,
    });
  });
});

/* ─────────── Cleanup and cancellation ─────────── */

describe("useChainResolver() — cleanup and cancel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("aborts on unmount during a pending fetch", async () => {
    let rejectFn: (err: unknown) => void = () => {};
    const pending = new Promise<Response>((_, reject) => {
      rejectFn = reject;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result, unmount } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("loading"),
    );

    unmount();
    rejectFn(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    await Promise.resolve();
    // Hook is unmounted; no post-unmount state change observable.
    expect(result.current.steps[0].status).toBe("loading");
  });

  it("cancel() aborts the current fetch", async () => {
    let rejectFn: (err: unknown) => void = () => {};
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        rejectFn = reject;
        init.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("loading"),
    );

    result.current.cancel();
    // Signal.aborted should now trigger the rejection via the listener;
    // the chain's catch block reports the AbortError as a timeout.
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/Timed out resolving/);
    // Reference rejectFn to satisfy TS (the test uses the event listener
    // path, but we keep the closure capture for readability).
    expect(typeof rejectFn).toBe("function");
  });

  it("fires the 10s deadline via setTimeout and aborts", async () => {
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

    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderChain({
      initialHref: "https://example.com/cat.json",
    });

    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("loading"),
    );
    expect(capturedCb).not.toBeNull();

    capturedCb!();

    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("error"),
    );
    expect(result.current.steps[0].error).toMatch(/Timed out resolving/);
  });

  it("silently returns when cancelled between fetch success and text read", async () => {
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

    const { result, unmount } = renderChain({
      initialHref: "https://example.com/cat.json",
    });

    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("loading"),
    );

    unmount();
    resolveText(JSON.stringify({ catalog: { metadata: {} } }));
    await Promise.resolve();
    await Promise.resolve();

    // No transition to success observable (hook unmounted before text).
    expect(result.current.steps[0].status).toBe("loading");
  });

  it("silently returns when cancelled between authFetch resolution and res.ok check", async () => {
    // Engineer the exact window: fetch is pending while we unmount. The
    // abort signal fires, but since the mock ignores the signal and just
    // resolves normally after, the `if (cancelled) return;` guard
    // immediately after `await authFetch` catches it.
    let resolveFetch: (res: Response) => void = () => {};
    const pending = new Promise<Response>((r) => {
      resolveFetch = r;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result, unmount } = renderChain({
      initialHref: "https://example.com/cat.json",
    });
    await waitFor(() =>
      expect(result.current.steps[0].status).toBe("loading"),
    );

    unmount();

    // Resolve with a successful Response AFTER unmount. The cleanup set
    // cancelled=true; the post-await guard now fires.
    resolveFetch(
      new Response(JSON.stringify({ catalog: { metadata: {} } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();

    // No transition to success (cancelled guard ate it)
    expect(result.current.steps[0].status).toBe("loading");
  });
});
