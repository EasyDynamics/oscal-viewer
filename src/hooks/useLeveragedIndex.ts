/* ═══════════════════════════════════════════════════════════════════════════
   useLeveragedIndex — builds O(1) lookup maps from loaded leveraged SSPs.

   Given an array of provider SSP payloads, iterates all
   implemented-requirements → by-components → export.provided / responsibilities
   and keys them by UUID so the consumer SSP can resolve its
   inherited[].provided-uuid and satisfied[].responsibility-uuid references.

   Also builds a control-id-based index so that provider exports can be shown
   on matching controls even without explicit UUID cross-references.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import type { UploadEntry } from "../context/OscalContext";

/* ── Public types ── */

export interface ProvidedResolution {
  providerSspTitle: string;
  providerComponentTitle: string;
  controlId: string;
  description: string;
  responsibleRoles: { roleId: string }[];
}

export interface ResponsibilityResolution {
  providerSspTitle: string;
  providerComponentTitle: string;
  controlId: string;
  description: string;
  linkedProvidedUuid?: string;
  responsibleRoles: { roleId: string }[];
}

/** Exports for a given control from a provider SSP */
export interface ControlExportEntry {
  providerSspTitle: string;
  providerComponentTitle: string;
  description: string;
  provided: { uuid: string; description: string; responsibleRoles: { roleId: string }[] }[];
  responsibilities: { uuid: string; description: string; providedUuid?: string; responsibleRoles: { roleId: string }[] }[];
}

export type ProvidedIndex = Map<string, ProvidedResolution>;
export type ResponsibilityIndex = Map<string, ResponsibilityResolution>;
/** control-id → array of export entries from all provider SSPs */
export type ControlExportIndex = Map<string, ControlExportEntry[]>;

export interface LeveragedIndex {
  provided: ProvidedIndex;
  responsibilities: ResponsibilityIndex;
  /** control-id based lookup — shows what providers export for a given control */
  byControl: ControlExportIndex;
  /** Total number of leveraged SSPs that contributed entries */
  providerCount: number;
}

/* ── Helpers ── */

/* eslint-disable @typescript-eslint/no-explicit-any */

function txt(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "prose" in v)
    return String((v as any).prose);
  return String(v);
}

function buildComponentMap(ssp: any): Map<string, string> {
  const m = new Map<string, string>();
  const si = ssp["system-implementation"];
  if (!si?.components) return m;
  for (const c of si.components) {
    if (c.uuid) m.set(c.uuid, c.title || c.uuid.slice(0, 12));
  }
  return m;
}

function getSspTitle(ssp: any): string {
  return ssp.metadata?.title || "Untitled SSP";
}

function buildMaps(
  leveragedSsps: UploadEntry<unknown>[],
): { provided: ProvidedIndex; responsibilities: ResponsibilityIndex; byControl: ControlExportIndex; providerCount: number } {
  const provided: ProvidedIndex = new Map();
  const responsibilities: ResponsibilityIndex = new Map();
  const byControl: ControlExportIndex = new Map();
  let providerCount = 0;

  for (const entry of leveragedSsps) {
    const raw = entry.data as Record<string, unknown>;
    const ssp = (raw["system-security-plan"] ?? raw) as any;
    if (!ssp.metadata) continue;

    const sspTitle = getSspTitle(ssp);
    const compMap = buildComponentMap(ssp);
    const ci = ssp["control-implementation"];
    if (!ci?.["implemented-requirements"]) continue;

    let contributed = false;

    for (const ir of ci["implemented-requirements"]) {
      const controlId: string = ir["control-id"] || "";
      if (!controlId) continue;
      const allBcs = [...(ir["by-components"] || [])];
      for (const st of ir.statements || []) {
        allBcs.push(...(st["by-components"] || []));
      }

      // Track per-component export entries; if a component has no export, we
      // still want the control to appear in `byControl` so the consumer SSP
      // shows that the provider implements it (just without exports).
      const componentEntries = new Map<string, ControlExportEntry>();
      const ensureEntry = (compUuid: string): ControlExportEntry => {
        const compTitle = compMap.get(compUuid) || (compUuid ? compUuid.slice(0, 12) : "Component");
        let entry = componentEntries.get(compUuid);
        if (!entry) {
          entry = {
            providerSspTitle: sspTitle,
            providerComponentTitle: compTitle,
            description: "",
            provided: [],
            responsibilities: [],
          };
          componentEntries.set(compUuid, entry);
        }
        return entry;
      };

      // Always record at least one entry per control so it appears in byControl
      // (use a blank component-uuid bucket if there are no by-components).
      if (allBcs.length === 0) ensureEntry("");

      for (const bc of allBcs) {
        const compUuid: string = bc["component-uuid"] || "";
        const entry = ensureEntry(compUuid);
        const exp = bc.export;
        if (!exp) continue;

        if (txt(exp.description)) entry.description = txt(exp.description);

        for (const p of exp.provided || []) {
          if (!p.uuid) continue;
          const roles = (p["responsible-roles"] || []).map((rr: any) => ({ roleId: rr["role-id"] || "" }));
          provided.set(p.uuid, {
            providerSspTitle: sspTitle,
            providerComponentTitle: entry.providerComponentTitle,
            controlId,
            description: txt(p.description),
            responsibleRoles: roles,
          });
          entry.provided.push({ uuid: p.uuid, description: txt(p.description), responsibleRoles: roles });
        }

        for (const r of exp.responsibilities || []) {
          if (!r.uuid) continue;
          const roles = (r["responsible-roles"] || []).map((rr: any) => ({ roleId: rr["role-id"] || "" }));
          responsibilities.set(r.uuid, {
            providerSspTitle: sspTitle,
            providerComponentTitle: entry.providerComponentTitle,
            controlId,
            description: txt(r.description),
            linkedProvidedUuid: r["provided-uuid"],
            responsibleRoles: roles,
          });
          entry.responsibilities.push({ uuid: r.uuid, description: txt(r.description), providedUuid: r["provided-uuid"], responsibleRoles: roles });
        }
      }

      if (componentEntries.size > 0) {
        const existing = byControl.get(controlId) || [];
        existing.push(...componentEntries.values());
        byControl.set(controlId, existing);
        contributed = true;
      }
    }

    if (contributed) providerCount++;
  }

  return { provided, responsibilities, byControl, providerCount };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── Hook ── */

export function useLeveragedIndex(leveragedSsps: UploadEntry<unknown>[]): LeveragedIndex {
  return useMemo(() => buildMaps(leveragedSsps), [leveragedSsps]);
}
