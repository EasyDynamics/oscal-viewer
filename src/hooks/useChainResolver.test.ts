import { describe, it, expect } from "vitest";
import {
  extractCatalogFromProfile,
  extractProfileFromSsp,
  extractSspFromAp,
} from "./useChainResolver";

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
});
