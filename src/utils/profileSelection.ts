import type { Catalog, Control, Group } from "../context/OscalContext";

/*
 * Which catalog controls an OSCAL profile selects, following the selection
 * rules of NIST's profile resolution specification:
 *
 * - `include-all` selects every control, enhancements included.
 * - `include-controls` selects controls by `with-ids` and by `matching`, a
 *   glob (`*` and `?`) matched against the whole id.
 * - `with-child-controls: yes` also selects every descendant of a selected
 *   control. Without it, enhancements must be selected themselves.
 * - `exclude-controls` uses the same rules, and an excluded control stays
 *   excluded however it was included.
 * - A selected control brings its ancestors, unless they are excluded.
 *
 * Each import selects from its own source. The viewer loads one catalog, so
 * every import is applied to it, and ids a catalog doesn't have are kept so
 * that they still show.
 */

/** An `include-controls` or `exclude-controls` entry. */
export interface ControlSelector {
  "with-ids"?: string[];
  matching?: { pattern?: string }[];
  "with-child-controls"?: "yes" | "no";
}

export interface ProfileImportSelection {
  "include-all"?: unknown;
  "include-controls"?: ControlSelector[];
  "exclude-controls"?: ControlSelector[];
}

/** A catalog control with where it sits in the catalog. */
export interface CatalogControlEntry {
  control: Control;
  /** Ids of the controls this one is nested in, outermost first. */
  ancestors: string[];
  /** The catalog's top-level group the control is in, if any. */
  topGroup?: Group;
}

export interface CatalogIndex {
  /** Every control, enhancements included, in document order. */
  entries: CatalogControlEntry[];
  byId: Map<string, CatalogControlEntry>;
}

export function indexCatalog(catalog: Catalog): CatalogIndex {
  const entries: CatalogControlEntry[] = [];
  const byId = new Map<string, CatalogControlEntry>();
  const visitControl = (control: Control, ancestors: string[], topGroup?: Group) => {
    if (typeof control?.id !== "string") return;
    const entry = { control, ancestors, topGroup };
    entries.push(entry);
    if (!byId.has(control.id)) byId.set(control.id, entry);
    for (const child of control.controls ?? []) visitControl(child, [...ancestors, control.id], topGroup);
  };
  const visitGroup = (group: Group, topGroup: Group) => {
    for (const control of group.controls ?? []) visitControl(control, [], topGroup);
    for (const sub of group.groups ?? []) visitGroup(sub, topGroup);
  };
  for (const group of catalog.groups ?? []) visitGroup(group, group);
  for (const control of catalog.controls ?? []) visitControl(control, []);
  return { entries, byId };
}

/** A `matching` pattern as a regular expression: `*` is any run of characters, `?` any one. */
export function globToRegExp(glob: string): RegExp {
  const source = glob.replace(/[.+^${}()|[\]\\/]/g, "\\$&").replace(/\?/g, ".").replace(/\*/g, ".*");
  return new RegExp(`^${source}$`);
}

interface CompiledSelector {
  ids: string[];
  idSet: Set<string>;
  patterns: RegExp[];
  withChildren: boolean;
}

// Profiles are untrusted input, so anything that isn't the expected array is read as empty.
const arrayOf = <T>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

function compile(selectors: ControlSelector[] | undefined): CompiledSelector[] {
  return arrayOf(selectors).map((s) => {
    const ids = arrayOf(s?.["with-ids"]).filter((id): id is string => typeof id === "string");
    return {
      ids,
      idSet: new Set(ids),
      // A `matching` with no pattern matches nothing.
      patterns: arrayOf(s?.matching).flatMap((m) => (typeof m?.pattern === "string" && m.pattern !== "" ? [globToRegExp(m.pattern)] : [])),
      withChildren: s?.["with-child-controls"] === "yes",
    };
  });
}

const namesId = (s: CompiledSelector, id: string) => s.idSet.has(id) || s.patterns.some((p) => p.test(id));

const selectsEntry = (s: CompiledSelector, e: CatalogControlEntry) =>
  namesId(s, e.control.id) || (s.withChildren && e.ancestors.some((a) => namesId(s, a)));

export interface ProfileSelection {
  /** Every selected control id: in catalog order, then ids the catalog doesn't have. */
  ids: string[];
  /** The ids each import selects, in the same order. */
  byImport: string[][];
  /** True when a catalog was available, so patterns and child controls could be resolved. */
  resolved: boolean;
}

/**
 * The controls a profile's imports select from `catalog`. Without a catalog,
 * only ids named in `with-ids` can be known (patterns and child controls need
 * the catalog), and `include-all` selects `includeAllFallback`.
 */
export function selectProfileControls(
  imports: ProfileImportSelection[] | undefined,
  catalog: CatalogIndex | null | undefined,
  includeAllFallback: string[] = [],
): ProfileSelection {
  const byImport = arrayOf(imports).map((imp) => selectImport(imp ?? {}, catalog, includeAllFallback));
  const all = new Set(byImport.flat());
  const ids = catalog ? catalog.entries.map((e) => e.control.id).filter((id) => all.delete(id)) : [];
  ids.push(...all);
  return { ids, byImport, resolved: !!catalog };
}

function selectImport(imp: ProfileImportSelection, catalog: CatalogIndex | null | undefined, includeAllFallback: string[]): string[] {
  const includes = compile(imp["include-controls"]);
  const excludes = compile(imp["exclude-controls"]);
  const includeAll = imp["include-all"] != null;
  const selected = new Set<string>();

  if (catalog) {
    const excluded = (e: CatalogControlEntry) => excludes.some((s) => selectsEntry(s, e));
    for (const e of catalog.entries) {
      if ((includeAll || includes.some((s) => selectsEntry(s, e))) && !excluded(e)) selected.add(e.control.id);
    }
    for (const id of [...selected]) {
      for (const a of catalog.byId.get(id)?.ancestors ?? []) {
        const ancestor = catalog.byId.get(a);
        if (ancestor && !excluded(ancestor)) selected.add(a);
      }
    }
    const ordered = catalog.entries.map((e) => e.control.id).filter((id) => selected.delete(id));
    // Ids this catalog doesn't have: another import's source, or a typo worth seeing.
    for (const id of includes.flatMap((s) => s.ids)) {
      if (!catalog.byId.has(id) && !excludes.some((s) => namesId(s, id))) selected.add(id);
    }
    return [...ordered, ...selected];
  }

  for (const id of includeAll ? includeAllFallback : includes.flatMap((s) => s.ids)) {
    if (!excludes.some((s) => namesId(s, id))) selected.add(id);
  }
  return [...selected];
}
