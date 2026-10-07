import { describe, it, expect } from "vitest";
import type { Catalog, Group } from "../context/OscalContext";
import { buildGroupKeys, groupKeys } from "./groupKeys";

// The catalog from issue #100: groups with and without ids, nested two deep.
function reproCatalog(): Catalog {
  return {
    uuid: "2b7e4c1a-9d3f-4e8b-a6c5-0f1e2d3c4b5a",
    metadata: { title: "Group id repro catalog", "last-modified": "2026-09-30T00:00:00Z", version: "1.0", "oscal-version": "1.2.3" },
    groups: [
      {
        title: "Organizational Controls (no id)",
        groups: [
          {
            title: "Information Security Policies (no id)",
            groups: [{ title: "Policy Review (no id)", controls: [{ id: "org-2", title: "Review of Policies" }] }],
            controls: [{ id: "org-1", title: "Policies for Information Security" }],
          },
        ],
      },
      { id: "ac", title: "Access Control (has an id)", controls: [{ id: "ac-1", title: "Policy and Procedures" }] },
      { title: "Technological Controls (no id)", controls: [{ id: "tech-1", title: "User Endpoint Devices" }] },
    ],
  } as Catalog;
}

const groupsOf = (catalog: Catalog) => {
  const [org, ac, tech] = catalog.groups as Group[];
  const policies = org.groups![0];
  const review = policies.groups![0];
  return { org, policies, review, ac, tech };
};

describe("buildGroupKeys()", () => {
  it("uses the group's id when it has one", () => {
    const catalog = reproCatalog();
    expect(buildGroupKeys(catalog).keyOf(groupsOf(catalog).ac)).toBe("ac");
  });

  it("uses @ and the index path for groups without an id, at every depth", () => {
    const catalog = reproCatalog();
    const keys = buildGroupKeys(catalog);
    const { org, policies, review, tech } = groupsOf(catalog);
    expect(keys.keyOf(org)).toBe("@0");
    expect(keys.keyOf(policies)).toBe("@0.0");
    expect(keys.keyOf(review)).toBe("@0.0.0");
    expect(keys.keyOf(tech)).toBe("@2");
  });

  it("gives every group a different key", () => {
    const catalog = reproCatalog();
    const keys = buildGroupKeys(catalog);
    const all = Object.values(groupsOf(catalog)).map((g) => keys.keyOf(g));
    expect(new Set(all).size).toBe(all.length);
  });

  it("looks a group up by its key", () => {
    const catalog = reproCatalog();
    const keys = buildGroupKeys(catalog);
    const { review, ac } = groupsOf(catalog);
    expect(keys.groupByKey("@0.0.0")).toBe(review);
    expect(keys.groupByKey("ac")).toBe(ac);
  });

  it("also accepts the index path of a group that has an id", () => {
    const catalog = reproCatalog();
    expect(buildGroupKeys(catalog).groupByKey("@1")).toBe(groupsOf(catalog).ac);
  });

  it("returns undefined for an unknown key, including the old `undefined` key", () => {
    const keys = buildGroupKeys(reproCatalog());
    expect(keys.groupByKey("undefined")).toBeUndefined();
    expect(keys.groupByKey("@9")).toBeUndefined();
  });

  it("treats an empty id as missing", () => {
    const catalog = reproCatalog();
    groupsOf(catalog).tech.id = "";
    expect(buildGroupKeys(catalog).keyOf(groupsOf(catalog).tech)).toBe("@2");
  });

  it("keeps keys unique when two groups repeat an id", () => {
    const catalog = reproCatalog();
    const { ac, tech } = groupsOf(catalog);
    tech.id = "ac";
    const keys = buildGroupKeys(catalog);
    expect(keys.keyOf(ac)).toBe("ac");
    expect(keys.keyOf(tech)).toBe("@2");
    expect(keys.groupByKey("ac")).toBe(ac);
    expect(keys.groupByKey("@2")).toBe(tech);
  });

  it("handles a catalog with no groups", () => {
    const keys = buildGroupKeys({ ...reproCatalog(), groups: undefined } as Catalog);
    expect(keys.groupByKey("@0")).toBeUndefined();
  });
});

describe("groupKeys()", () => {
  it("builds the keys once per catalog object", () => {
    const catalog = reproCatalog();
    expect(groupKeys(catalog)).toBe(groupKeys(catalog));
    expect(groupKeys(reproCatalog())).not.toBe(groupKeys(catalog));
  });
});
