/* ═══════════════════════════════════════════════════════════════════════════
   OscalContext — global store for uploaded OSCAL documents.

   • Keeps each model's data in memory so navigating between tabs
     doesn't lose the upload.
   • Exposes the loaded Catalog to every page — Component-Definition,
     Assessment-Plan, etc. can look up controls & statements.
   • Also exposes per-model "loaded" flags so the Layout tab bar can
     show upload indicators.
   ═══════════════════════════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/* ── Re-usable OSCAL Catalog types ── */

export interface OscalProp {
  name: string;
  value: string;
  ns?: string;
  class?: string;
}

export interface OscalLink {
  href: string;
  rel?: string;
  text?: string;
  "resource-fragment"?: string;
}

export interface Party {
  uuid: string;
  type: string;
  name: string;
  "short-name"?: string;
}

export interface Role {
  id: string;
  title: string;
}

export interface CatalogMetadata {
  title: string;
  version?: string;
  "last-modified"?: string;
  "oscal-version"?: string;
  parties?: Party[];
  roles?: Role[];
  props?: OscalProp[];
  links?: OscalLink[];
}

export interface Part {
  id?: string;
  name: string;
  prose?: string;
  parts?: Part[];
  props?: OscalProp[];
  links?: OscalLink[];
}

export interface Param {
  id: string;
  label?: string;
  usage?: string;
  class?: string;
  dependsOn?: string;
  select?: { "how-many"?: string; choice?: string[] };
  guidelines?: { prose: string }[];
  constraints?: { description?: string; tests?: unknown[] }[];
}

export interface Control {
  id: string;
  class?: string;
  title: string;
  params?: Param[];
  props?: OscalProp[];
  links?: OscalLink[];
  parts?: Part[];
  controls?: Control[]; // enhancements
}

export interface Group {
  id: string;
  class?: string;
  title: string;
  props?: OscalProp[];
  parts?: Part[];
  groups?: Group[];
  controls?: Control[];
}

export interface Resource {
  uuid: string;
  title?: string;
  citation?: { text: string };
  rlinks?: { href: string }[];
}

export interface Catalog {
  uuid: string;
  metadata: CatalogMetadata;
  groups?: Group[];
  controls?: Control[]; // top-level controls (rare)
  "back-matter"?: { resources?: Resource[] };
}

/* ── Upload entry — wraps any model payload + filename ── */

export interface UploadEntry<T> {
  data: T;
  fileName: string;
}

/* ── Context shape ── */

export interface OscalContextValue {
  /* Catalog */
  catalog: UploadEntry<Catalog> | null;
  setCatalog: (data: Catalog, fileName: string) => void;
  clearCatalog: () => void;

  /* Component Definition (generic payload — typed by consumer) */
  componentDefinition: UploadEntry<unknown> | null;
  setComponentDefinition: (data: unknown, fileName: string) => void;
  clearComponentDefinition: () => void;

  /* Future model slots — add as pages get built */
  profile: UploadEntry<unknown> | null;
  setProfile: (data: unknown, fileName: string) => void;
  clearProfile: () => void;

  ssp: UploadEntry<unknown> | null;
  setSsp: (data: unknown, fileName: string) => void;
  clearSsp: () => void;

  assessmentPlan: UploadEntry<unknown> | null;
  setAssessmentPlan: (data: unknown, fileName: string) => void;
  clearAssessmentPlan: () => void;

  assessmentResults: UploadEntry<unknown> | null;
  setAssessmentResults: (data: unknown, fileName: string) => void;
  clearAssessmentResults: () => void;

  poam: UploadEntry<unknown> | null;
  setPoam: (data: unknown, fileName: string) => void;
  clearPoam: () => void;

  /** Quick lookup — returns true if a given model key has data loaded */
  isLoaded: (modelKey: string) => boolean;
}

const OscalContext = createContext<OscalContextValue | null>(null);

/* ── Provider ── */

export function OscalProvider({ children }: { children: ReactNode }) {
  const [catalog, _setCatalog] = useState<UploadEntry<Catalog> | null>(null);
  const [componentDefinition, _setComponentDefinition] = useState<UploadEntry<unknown> | null>(null);
  const [profile, _setProfile] = useState<UploadEntry<unknown> | null>(null);
  const [ssp, _setSsp] = useState<UploadEntry<unknown> | null>(null);
  const [assessmentPlan, _setAssessmentPlan] = useState<UploadEntry<unknown> | null>(null);
  const [assessmentResults, _setAssessmentResults] = useState<UploadEntry<unknown> | null>(null);
  const [poam, _setPoam] = useState<UploadEntry<unknown> | null>(null);

  const setCatalog = useCallback((data: Catalog, fileName: string) => _setCatalog({ data, fileName }), []);
  const clearCatalog = useCallback(() => _setCatalog(null), []);

  const setComponentDefinition = useCallback((data: unknown, fileName: string) => _setComponentDefinition({ data, fileName }), []);
  const clearComponentDefinition = useCallback(() => _setComponentDefinition(null), []);

  const setProfile = useCallback((data: unknown, fileName: string) => _setProfile({ data, fileName }), []);
  const clearProfile = useCallback(() => _setProfile(null), []);

  const setSsp = useCallback((data: unknown, fileName: string) => _setSsp({ data, fileName }), []);
  const clearSsp = useCallback(() => _setSsp(null), []);

  const setAssessmentPlan = useCallback((data: unknown, fileName: string) => _setAssessmentPlan({ data, fileName }), []);
  const clearAssessmentPlan = useCallback(() => _setAssessmentPlan(null), []);

  const setAssessmentResults = useCallback((data: unknown, fileName: string) => _setAssessmentResults({ data, fileName }), []);
  const clearAssessmentResults = useCallback(() => _setAssessmentResults(null), []);

  const setPoam = useCallback((data: unknown, fileName: string) => _setPoam({ data, fileName }), []);
  const clearPoam = useCallback(() => _setPoam(null), []);

  const isLoaded = useCallback(
    (modelKey: string): boolean => {
      switch (modelKey) {
        case "catalog": return catalog != null;
        case "component-definition": return componentDefinition != null;
        case "profile": return profile != null;
        case "ssp": return ssp != null;
        case "assessment-plan": return assessmentPlan != null;
        case "assessment-results": return assessmentResults != null;
        case "poam": return poam != null;
        default: return false;
      }
    },
    [catalog, componentDefinition, profile, ssp, assessmentPlan, assessmentResults, poam],
  );

  return (
    <OscalContext.Provider
      value={{
        catalog, setCatalog, clearCatalog,
        componentDefinition, setComponentDefinition, clearComponentDefinition,
        profile, setProfile, clearProfile,
        ssp, setSsp, clearSsp,
        assessmentPlan, setAssessmentPlan, clearAssessmentPlan,
        assessmentResults, setAssessmentResults, clearAssessmentResults,
        poam, setPoam, clearPoam,
        isLoaded,
      }}
    >
      {children}
    </OscalContext.Provider>
  );
}

/* ── Hook ── */

export function useOscal(): OscalContextValue {
  const ctx = useContext(OscalContext);
  if (!ctx) throw new Error("useOscal must be used within <OscalProvider>");
  return ctx;
}
