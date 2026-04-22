import { describe, it, expect } from "vitest";
import {
  checkUrlFormat,
  resolveHref,
  type BackMatterResource,
} from "./useImportResolver";

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
    rlinks: [{ href: "https://example.com/cat.json", "media-type": "application/json" }],
  };
  const xmlOnlyResource: BackMatterResource = {
    uuid: "r-xml",
    rlinks: [{ href: "https://example.com/cat.xml", "media-type": "application/xml" }],
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
