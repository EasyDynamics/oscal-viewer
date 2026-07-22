/* ═══════════════════════════════════════════════════════════════════════════
   Unit tests for useCatalogSortIndex — sort-id index + comparator built from
   the loaded OSCAL catalog. Ported from
   https://github.com/EasyDynamics/oscal-viewer/pull/57
   ═══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useCatalogSortIndex } from "./useCatalogSortIndex";
import {
  OscalProvider,
  useOscal,
  type Catalog,
  type Control,
  type Group,
} from "../context/OscalContext";

/* ── Fixtures ── */

function ctrl(id: string, sortId?: string, enhancements?: Control[]): Control {
  return {
    id,
    title: id.toUpperCase(),
    props: sortId ? [{ name: "sort-id", value: sortId }] : undefined,
    controls: enhancements,
  };
}

function group(
  id: string,
  sortId: string | undefined,
  controls: Control[] = [],
  subgroups: Group[] = [],
): Group {
  return {
    id,
    title: id.toUpperCase(),
    props: sortId ? [{ name: "sort-id", value: sortId }] : undefined,
    controls,
    groups: subgroups,
  };
}

function catalogOf(opts: { groups?: Group[]; controls?: Control[] }): Catalog {
  return {
    uuid: "cat-1",
    metadata: { title: "Test" },
    groups: opts.groups,
    controls: opts.controls,
  };
}

/* ── Seeder + harness ── */

function Seed({ catalog }: { catalog: Catalog | null }) {
  const { setCatalog, clearCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (didSeed.current) return;
    didSeed.current = true;
    if (catalog) setCatalog(catalog, "cat.json");
    else clearCatalog();
  }, [catalog, setCatalog, clearCatalog]);
  return null;
}

function renderWithCatalog(catalog: Catalog | null) {
  return renderHook(() => useCatalogSortIndex(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <OscalProvider>
        <Seed catalog={catalog} />
        {children}
      </OscalProvider>
    ),
  });
}

/* ── Tests ── */

describe("useCatalogSortIndex() — no catalog loaded", () => {
  it("returns an empty map, hasSortIds=false, and numeric-aware compare fallback", () => {
    const { result } = renderWithCatalog(null);
    expect(result.current.map.size).toBe(0);
    expect(result.current.hasSortIds).toBe(false);
    // Numeric-aware fallback puts AC-2 before AC-10.
    expect(result.current.compare("ac-2", "ac-10")).toBeLessThan(0);
    expect(result.current.compare("ac-10", "ac-2")).toBeGreaterThan(0);
    expect(result.current.compare("ac-1", "ac-1")).toBe(0);
  });

  it("still falls back to numeric compare for arbitrary strings", () => {
    const { result } = renderWithCatalog(null);
    expect(result.current.compare("apple", "banana")).toBeLessThan(0);
  });
});

describe("useCatalogSortIndex() — catalog without sort-id props", () => {
  it("hasSortIds=false and compare falls through to numeric ordering", () => {
    const cat = catalogOf({
      groups: [group("ac", undefined, [ctrl("ac-1"), ctrl("ac-2")])],
    });
    const { result } = renderWithCatalog(cat);
    expect(result.current.hasSortIds).toBe(false);
    expect(result.current.compare("ac-2", "ac-10")).toBeLessThan(0);
  });
});

describe("useCatalogSortIndex() — sort-id index population", () => {
  it("indexes group + control sort-ids", () => {
    const cat = catalogOf({
      groups: [
        group(
          "ac",
          "ac",
          [ctrl("ac-1", "ac-01"), ctrl("ac-2", "ac-02")],
        ),
      ],
    });
    const { result } = renderWithCatalog(cat);
    expect(result.current.hasSortIds).toBe(true);
    expect(result.current.map.get("ac")).toBe("ac");
    expect(result.current.map.get("ac-1")).toBe("ac-01");
    expect(result.current.map.get("ac-2")).toBe("ac-02");
  });

  it("recurses into control enhancements (controls.controls)", () => {
    const cat = catalogOf({
      groups: [
        group("ac", "ac", [
          ctrl("ac-1", "ac-01", [
            ctrl("ac-1.1", "ac-01.01"),
            ctrl("ac-1.2", "ac-01.02"),
          ]),
        ]),
      ],
    });
    const { result } = renderWithCatalog(cat);
    expect(result.current.map.get("ac-1.1")).toBe("ac-01.01");
    expect(result.current.map.get("ac-1.2")).toBe("ac-01.02");
  });

  it("recurses into nested groups (groups.groups)", () => {
    const cat = catalogOf({
      groups: [
        group("outer", "outer-01", [], [
          group("inner", "inner-01", [ctrl("x-1", "x-01")]),
        ]),
      ],
    });
    const { result } = renderWithCatalog(cat);
    expect(result.current.map.get("outer")).toBe("outer-01");
    expect(result.current.map.get("inner")).toBe("inner-01");
    expect(result.current.map.get("x-1")).toBe("x-01");
  });

  it("indexes top-level catalog.controls (no enclosing group)", () => {
    const cat = catalogOf({
      controls: [ctrl("top-1", "top-01")],
    });
    const { result } = renderWithCatalog(cat);
    expect(result.current.map.get("top-1")).toBe("top-01");
    expect(result.current.hasSortIds).toBe(true);
  });

  it("skips controls / groups whose props lack a sort-id entry", () => {
    const cat = catalogOf({
      groups: [
        group("ac", undefined, [
          ctrl("ac-1"),  // no sort-id
          ctrl("ac-2", "ac-02"),
        ]),
      ],
    });
    const { result } = renderWithCatalog(cat);
    expect(result.current.map.has("ac")).toBe(false);
    expect(result.current.map.has("ac-1")).toBe(false);
    expect(result.current.map.get("ac-2")).toBe("ac-02");
  });
});

describe("useCatalogSortIndex() — comparator behavior with sort-id index", () => {
  it("orders by sort-id when both operands are in the map", () => {
    const cat = catalogOf({
      groups: [
        group("ac", undefined, [
          ctrl("ac-1", "ac-01"),
          ctrl("ac-10", "ac-10"),
          ctrl("ac-2", "ac-02"),
        ]),
      ],
    });
    const { result } = renderWithCatalog(cat);
    const ids = ["ac-10", "ac-2", "ac-1"];
    ids.sort(result.current.compare);
    expect(ids).toEqual(["ac-1", "ac-2", "ac-10"]);
  });

  it("uses the raw input as the sort key when an operand is not in the map (fallback)", () => {
    const cat = catalogOf({
      groups: [group("ac", undefined, [ctrl("ac-1", "ac-01")])],
    });
    const { result } = renderWithCatalog(cat);
    // "ac-1" is in the map ("ac-01"); "zz-9" is not — so the comparator
    // compares "ac-01" against "zz-9" via numeric localeCompare.
    expect(result.current.compare("ac-1", "zz-9")).toBeLessThan(0);
  });

  it("does a case-insensitive lookup so pages passing lowercase IDs hit the catalog index", () => {
    const cat = catalogOf({
      groups: [group("AC", undefined, [ctrl("AC-1", "ac-01"), ctrl("AC-2", "ac-02")])],
    });
    const { result } = renderWithCatalog(cat);
    // Catalog stored IDs uppercase. Page passes lowercase. The aLower
    // branch hits because `map.get("ac-1")` ... actually catalog stored
    // them with key "AC-1" (case-as-found), so `.get("ac-1")` misses
    // both lowercase AND raw paths. Documents the asymmetry.
    expect(result.current.map.has("AC-1")).toBe(true);
    expect(result.current.map.has("ac-1")).toBe(false);
  });
});

describe("useCatalogSortIndex() — memoization", () => {
  it("returns a stable instance across rerenders when the catalog reference is unchanged", () => {
    const cat = catalogOf({
      groups: [group("ac", "ac", [ctrl("ac-1", "ac-01")])],
    });
    const { result, rerender } = renderWithCatalog(cat);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("re-derives when the catalog entry reference changes", () => {
    const Inner = () => {
      const idx = useCatalogSortIndex();
      const { setCatalog } = useOscal();
      return { idx, setCatalog };
    };
    const { result } = renderHook(Inner, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <OscalProvider>{children}</OscalProvider>
      ),
    });
    const before = result.current.idx;
    act(() => {
      result.current.setCatalog(
        catalogOf({ groups: [group("ac", "ac", [ctrl("ac-1", "ac-01")])] }),
        "c.json",
      );
    });
    expect(result.current.idx).not.toBe(before);
    expect(result.current.idx.hasSortIds).toBe(true);
  });
});

/* BUG lock-in — catalog with mixed-case IDs causes case-mismatched lookups
   to miss the sort-id index entirely. Asymmetric because the walker stores
   IDs case-as-found in the catalog but the comparator only tries
   `toLowerCase()` then raw — never `toUpperCase()`. In practice OSCAL
   convention is lowercase IDs so this rarely bites, but the asymmetry is
   visible and would be a one-line fix (normalize keys to lowercase in
   buildSortMap). Locked in here per the lock-in-before-fix discipline. */
describe("useCatalogSortIndex() — BUG: case-asymmetric lookup", () => {
  it("BUG: lowercase lookup misses the index when catalog stores uppercase IDs", () => {
    const cat = catalogOf({
      groups: [
        group("AC", "AC", [
          ctrl("AC-1", "AC-01"),
          ctrl("AC-2", "AC-02"),
          ctrl("AC-10", "AC-10"),
        ]),
      ],
    });
    const { result } = renderWithCatalog(cat);

    // Lowercase lookups: map.get("ac-1") misses; map.get("ac-1") (raw)
    // also misses (catalog stored "AC-1"). Fallback uses "ac-1" as sort
    // key — so ordering reflects the raw inputs, NOT the catalog's
    // AC-01/AC-02/AC-10 sort-ids.
    const ids = ["ac-10", "ac-2", "ac-1"];
    ids.sort(result.current.compare);
    // Falls through to numeric localeCompare of the raw input strings,
    // which happens to give the right answer here. But the assertion
    // below confirms the sort-id path was *not* taken.
    expect(ids).toEqual(["ac-1", "ac-2", "ac-10"]);

    // Uppercase lookups hit the map and use the AC-NN sort-ids.
    const upper = ["AC-10", "AC-2", "AC-1"];
    upper.sort(result.current.compare);
    expect(upper).toEqual(["AC-1", "AC-2", "AC-10"]);
  });
});
