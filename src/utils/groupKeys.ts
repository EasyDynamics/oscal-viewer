import type { Catalog, Group } from "../context/OscalContext";

/*
 * Navigation keys for catalog groups.
 *
 * OSCAL makes `group.id` optional, so the viewer can't rely on it to tell
 * groups apart. A group's key is its `id` when it has one, otherwise `@`
 * followed by its index path among its parent's groups (`@0`, `@0.1.2`).
 * An OSCAL `token` can't contain `@`, so a path key never collides with a
 * real id.
 */

export interface GroupKeys {
  /** The navigation key of a group in this catalog. */
  keyOf(group: Group): string;
  /** The group a key points to. Accepts either a group's id or its index path. */
  groupByKey(key: string): Group | undefined;
}

export function buildGroupKeys(catalog: Catalog): GroupKeys {
  const keyByGroup = new Map<Group, string>();
  const groupByKey = new Map<string, Group>();

  const visit = (groups: Group[] | undefined, parentPath: number[]) => {
    (groups ?? []).forEach((group, index) => {
      const path = [...parentPath, index];
      const pathKey = `@${path.join(".")}`;
      const id = typeof group.id === "string" && group.id !== "" ? group.id : undefined;
      // A repeated id (invalid, but possible) falls back to the path so every key stays unique.
      const key = id !== undefined && !groupByKey.has(id) ? id : pathKey;
      keyByGroup.set(group, key);
      groupByKey.set(key, group);
      groupByKey.set(pathKey, group);
      visit(group.groups, path);
    });
  };
  visit(catalog.groups, []);

  return {
    keyOf: (group) => keyByGroup.get(group) ?? group.id ?? "",
    groupByKey: (key) => groupByKey.get(key),
  };
}

const cache = new WeakMap<Catalog, GroupKeys>();

/** {@link buildGroupKeys}, built once per catalog object. */
export function groupKeys(catalog: Catalog): GroupKeys {
  let keys = cache.get(catalog);
  if (!keys) {
    keys = buildGroupKeys(catalog);
    cache.set(catalog, keys);
  }
  return keys;
}
