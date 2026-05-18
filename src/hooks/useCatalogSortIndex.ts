/* ═══════════════════════════════════════════════════════════════════════════
   useCatalogSortIndex — Builds a sort-id lookup from the loaded OSCAL catalog.

   Controls in an OSCAL catalog may carry a `sort-id` property (e.g.
   `{ name: "sort-id", value: "ac-01" }`).  When present this property
   determines the canonical ordering of controls within a family and of
   families themselves.

   The hook walks every group / control in the catalog, extracts sort-ids,
   and returns a comparator function that pages can use in `.sort()` calls.
   If no catalog is loaded, or it contains no sort-id properties, the
   comparator falls back to plain `localeCompare`.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import type { Catalog, Control, Group, OscalProp } from "../context/OscalContext";
import { useOscal } from "../context/OscalContext";

/** Extract the sort-id value from a props array, if present. */
function sortIdFromProps(props?: OscalProp[]): string | undefined {
  return props?.find((p) => p.name === "sort-id")?.value;
}

export interface CatalogSortIndex {
  /** Map from control/group id → sort-id value */
  map: Map<string, string>;
  /** True when the loaded catalog actually contains sort-id properties. */
  hasSortIds: boolean;
  /**
   * Comparator that orders two control-ids (or family prefixes) using
   * the catalog's sort-id props.  Falls back to `localeCompare`.
   */
  compare: (a: string, b: string) => number;
}

/** Walk a catalog and build the id → sort-id map. */
function buildSortMap(catalog: Catalog): Map<string, string> {
  const m = new Map<string, string>();

  function visitControl(ctrl: Control) {
    const sid = sortIdFromProps(ctrl.props);
    if (sid) m.set(ctrl.id, sid);
    ctrl.controls?.forEach(visitControl);
  }

  function visitGroup(grp: Group) {
    const sid = sortIdFromProps(grp.props);
    if (sid) m.set(grp.id, sid);
    grp.controls?.forEach(visitControl);
    grp.groups?.forEach(visitGroup);
  }

  catalog.groups?.forEach(visitGroup);
  catalog.controls?.forEach(visitControl);
  return m;
}

/**
 * Returns a `CatalogSortIndex` derived from the currently loaded catalog.
/** Numeric-aware string comparison (AC-2 before AC-10). */
const numericCompare = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true });

/**
 * Returns a `CatalogSortIndex` derived from the currently loaded catalog.
 * The comparator can sort control-ids, family prefixes, or any string —
 * it checks both operands against the map and falls back to numeric-aware
 * localeCompare so controls like AC-2 always sort before AC-10.
 */
export function useCatalogSortIndex(): CatalogSortIndex {
  const { catalog } = useOscal();

  return useMemo(() => {
    if (!catalog?.data) {
      return {
        map: new Map(),
        hasSortIds: false,
        compare: numericCompare,
      };
    }

    const map = buildSortMap(catalog.data);
    const hasSortIds = map.size > 0;

    const compare = (a: string, b: string): number => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const sa = map.get(aLower) ?? map.get(a) ?? a;
      const sb = map.get(bLower) ?? map.get(b) ?? b;
      return numericCompare(sa, sb);
    };

    return { map, hasSortIds, compare };
  }, [catalog]);
}
