import { describe, it, expect } from "vitest";
import type { Catalog } from "../context/OscalContext";
import { globToRegExp, indexCatalog, selectProfileControls, type ProfileImportSelection } from "./profileSelection";
import catalogBasic from "../../samples/catalog-basic.json";
import profileBasic from "../../samples/profile-basic.json";

const basicCatalog = indexCatalog(catalogBasic.catalog as unknown as Catalog);

// SP 800-53 in miniature: AC-2 has enhancements, one of them with a child of its own.
const nist = indexCatalog({
  uuid: "6a3b2c1d-0e9f-4a8b-b7c6-d5e4f3a2b1c0",
  metadata: { title: "Mini 800-53", "last-modified": "2026-10-07T00:00:00Z", version: "1", "oscal-version": "1.2.3" },
  groups: [
    {
      id: "ac",
      title: "Access Control",
      controls: [
        { id: "ac-1", title: "Policy and Procedures" },
        {
          id: "ac-2",
          title: "Account Management",
          controls: [
            { id: "ac-2.1", title: "Automated System Account Management" },
            { id: "ac-2.2", title: "Automated Temporary and Emergency Account Management", controls: [{ id: "ac-2.2.1", title: "Nested" }] },
            { id: "ac-2.13", title: "Disable Accounts for High-risk Individuals" },
          ],
        },
        { id: "ac-20", title: "Use of External Systems" },
      ],
    },
    { id: "au", title: "Audit and Accountability", controls: [{ id: "au-2", title: "Event Logging" }] },
  ],
} as Catalog);

const select = (imp: ProfileImportSelection, catalog = nist) => selectProfileControls([imp], catalog).ids;

describe("globToRegExp", () => {
  it("matches the whole id, with * for any run of characters and ? for one", () => {
    expect(globToRegExp("ac-2.*").test("ac-2.13")).toBe(true);
    expect(globToRegExp("ac-2.*").test("ac-20")).toBe(false);
    expect(globToRegExp("ac-?").test("ac-1")).toBe(true);
    expect(globToRegExp("ac-?").test("ac-20")).toBe(false);
    expect(globToRegExp("ac").test("ac-1")).toBe(false);
  });

  it("treats every other character literally", () => {
    expect(globToRegExp("s1.1.*").test("s1x1.1")).toBe(false);
    expect(globToRegExp("a+(b)[c]").test("a+(b)[c]")).toBe(true);
    expect(globToRegExp("AC-*").test("ac-1")).toBe(false);
  });
});

describe("selectProfileControls", () => {
  it("resolves the repo's profile-basic sample: a pattern, an id and an exclusion", () => {
    const selection = selectProfileControls(profileBasic.profile.imports, basicCatalog);
    expect(selection.ids).toEqual(["s1.1.1", "s1.1.2", "s2.1.1"]);
    expect(selection.byImport).toEqual([["s1.1.1", "s1.1.2", "s2.1.1"]]);
    expect(selection.resolved).toBe(true);
  });

  it("removes excluded controls from include-all", () => {
    expect(select({ "include-all": {}, "exclude-controls": [{ "with-ids": ["s1.1.2"] }] }, basicCatalog))
      .toEqual(["s1.1.1", "s2.1.1", "s2.1.2"]);
  });

  it("includes every control and enhancement with include-all", () => {
    expect(select({ "include-all": {} })).toEqual(["ac-1", "ac-2", "ac-2.1", "ac-2.2", "ac-2.2.1", "ac-2.13", "ac-20", "au-2"]);
  });

  it("leaves enhancements out unless with-child-controls is yes", () => {
    expect(select({ "include-controls": [{ "with-ids": ["ac-2"] }] })).toEqual(["ac-2"]);
    expect(select({ "include-controls": [{ "with-ids": ["ac-2"], "with-child-controls": "no" }] })).toEqual(["ac-2"]);
    expect(select({ "include-controls": [{ "with-ids": ["ac-2"], "with-child-controls": "yes" }] }))
      .toEqual(["ac-2", "ac-2.1", "ac-2.2", "ac-2.2.1", "ac-2.13"]);
  });

  it("applies with-child-controls to controls a pattern matches", () => {
    expect(select({ "include-controls": [{ matching: [{ pattern: "ac-2.2" }], "with-child-controls": "yes" }] }))
      .toEqual(["ac-2", "ac-2.2", "ac-2.2.1"]);
  });

  it("brings the ancestors of a selected enhancement, unless they are excluded", () => {
    expect(select({ "include-controls": [{ "with-ids": ["ac-2.2.1"] }] })).toEqual(["ac-2", "ac-2.2", "ac-2.2.1"]);
    expect(select({ "include-controls": [{ "with-ids": ["ac-2.1"] }], "exclude-controls": [{ "with-ids": ["ac-2"] }] }))
      .toEqual(["ac-2.1"]);
  });

  it("excludes a control however it was included", () => {
    expect(select({
      "include-controls": [{ "with-ids": ["ac-1", "ac-20"] }, { matching: [{ pattern: "ac-*" }] }],
      "exclude-controls": [{ matching: [{ pattern: "ac-2*" }] }],
    })).toEqual(["ac-1"]);
  });

  it("excludes descendants too when the exclusion has with-child-controls", () => {
    const imp = (children: "yes" | "no"): ProfileImportSelection => ({
      "include-controls": [{ "with-ids": ["ac-2"], "with-child-controls": "yes" }],
      "exclude-controls": [{ "with-ids": ["ac-2.2"], "with-child-controls": children }],
    });
    expect(select(imp("no"))).toEqual(["ac-2", "ac-2.1", "ac-2.2.1", "ac-2.13"]);
    expect(select(imp("yes"))).toEqual(["ac-2", "ac-2.1", "ac-2.13"]);
  });

  it("lists controls in catalog order, whatever order the profile names them in", () => {
    expect(select({ "include-controls": [{ "with-ids": ["au-2", "ac-2.1", "ac-1"] }] })).toEqual(["ac-1", "ac-2", "ac-2.1", "au-2"]);
  });

  it("treats a matching entry with no pattern as matching nothing", () => {
    expect(select({ "include-controls": [{ matching: [{}, { pattern: "" }] }] })).toEqual([]);
  });

  it("keeps ids the catalog doesn't have, after the catalog's, unless excluded", () => {
    expect(select({
      "include-controls": [{ "with-ids": ["zz-9", "ac-1", "zz-8"] }],
      "exclude-controls": [{ "with-ids": ["zz-8"] }],
    })).toEqual(["ac-1", "zz-9"]);
  });

  it("applies each import's exclusions to that import only", () => {
    const selection = selectProfileControls([
      { "include-controls": [{ "with-ids": ["ac-1", "au-2"] }], "exclude-controls": [{ "with-ids": ["au-2"] }] },
      { "include-controls": [{ "with-ids": ["au-2"] }] },
    ], nist);
    expect(selection.byImport).toEqual([["ac-1"], ["au-2"]]);
    expect(selection.ids).toEqual(["ac-1", "au-2"]);
  });

  it("reads malformed selections as empty instead of throwing", () => {
    const junk = [{ "include-controls": "ac-1", "exclude-controls": [null, { "with-ids": "ac-1", matching: {} }] }, null];
    expect(selectProfileControls(junk as unknown as ProfileImportSelection[], nist).ids).toEqual([]);
  });

  describe("without a catalog", () => {
    it("lists with-ids in profile order, minus exclusions by id or pattern", () => {
      const selection = selectProfileControls([{
        "include-controls": [{ "with-ids": ["ac-2", "ac-1", "ac-2.1", "au-2"] }, { matching: [{ pattern: "si-*" }] }],
        "exclude-controls": [{ "with-ids": ["ac-1"] }, { matching: [{ pattern: "au-*" }] }],
      }], null);
      expect(selection).toEqual({ ids: ["ac-2", "ac-2.1"], byImport: [["ac-2", "ac-2.1"]], resolved: false });
    });

    it("uses the fallback ids for include-all", () => {
      expect(selectProfileControls([{ "include-all": {}, "exclude-controls": [{ "with-ids": ["ac-1"] }] }], null, ["ac-1", "ac-2"]).ids)
        .toEqual(["ac-2"]);
    });
  });
});
