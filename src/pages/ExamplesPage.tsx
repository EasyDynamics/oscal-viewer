/* ═══════════════════════════════════════════════════════════════════════════
   Examples Page — Directory of publicly available OSCAL JSON content.
   Each link opens the appropriate model viewer in a new tab with the
   JSON URL pre-loaded via the ?url= query parameter.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useMemo, type CSSProperties } from "react";
import { colors, fonts, shadows, radii } from "../theme/tokens";
import useIsMobile from "../hooks/useIsMobile";

/* ── Types ── */

type ModelType =
  | "Catalog"
  | "Profile"
  | "Resolved Profile Catalog"
  | "Component Definition"
  | "SSP"
  | "Assessment Plan"
  | "Assessment Results"
  | "POA&M";

type SourceTag =
  | "NIST Official"
  | "FedRAMP"
  | "International Gov"
  | "Community"
  | "Vendor"
  | "Plugfest"
  | "Tool Test Data";

interface ExampleEntry {
  filename: string;
  modelType: ModelType;
  framework: string;
  source: SourceTag;
  repo: string;
  rawUrl: string;
  description: string;
  notes?: string;
}

/* ── Viewer path mapping ── */

const viewerPath: Record<ModelType, string> = {
  Catalog: "/catalog",
  Profile: "/profile",
  "Resolved Profile Catalog": "/catalog",
  "Component Definition": "/component-definition",
  SSP: "/ssp",
  "Assessment Plan": "/assessment-plan",
  "Assessment Results": "/assessment-results",
  "POA&M": "/poam",
};

/* ── Display order ── */

const MODEL_ORDER: ModelType[] = [
  "Catalog",
  "Profile",
  "Resolved Profile Catalog",
  "Component Definition",
  "SSP",
  "Assessment Plan",
  "Assessment Results",
  "POA&M",
];

const SOURCE_ORDER: SourceTag[] = [
  "NIST Official",
  "FedRAMP",
  "International Gov",
  "Community",
  "Vendor",
  "Plugfest",
  "Tool Test Data",
];

/* ── Colors per model / source ── */

const modelColor: Record<ModelType, string> = {
  Catalog: colors.navy,
  Profile: colors.brightBlue,
  "Resolved Profile Catalog": colors.cobalt,
  "Component Definition": colors.cobalt,
  SSP: colors.darkGreen,
  "Assessment Plan": colors.purple,
  "Assessment Results": colors.yellow,
  "POA&M": colors.red,
};

const sourceColor: Record<SourceTag, string> = {
  "NIST Official": colors.tintBlue,
  FedRAMP: colors.cobalt,
  "International Gov": colors.tintGreen,
  Community: colors.tintPurple,
  Vendor: colors.tintOrange,
  Plugfest: colors.red,
  "Tool Test Data": colors.blueGray,
};

/* ═══════════════════════════════════════════════════════════════════════════
   DATA — Every publicly available OSCAL JSON example file
   ═══════════════════════════════════════════════════════════════════════════ */

const examples: ExampleEntry[] = [
  // ── NIST Official: SP 800-53 Rev 5 ──
  { filename: "NIST_SP-800-53_rev5_catalog.json", modelType: "Catalog", framework: "NIST SP 800-53 Rev 5", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json", description: "Complete SP 800-53 Rev 5 control catalog" },
  { filename: "NIST_SP-800-53_rev5_LOW-baseline_profile.json", modelType: "Profile", framework: "NIST SP 800-53B Low", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline_profile.json", description: "Low baseline profile for SP 800-53 Rev 5" },
  { filename: "NIST_SP-800-53_rev5_MODERATE-baseline_profile.json", modelType: "Profile", framework: "NIST SP 800-53B Moderate", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline_profile.json", description: "Moderate baseline profile for SP 800-53 Rev 5" },
  { filename: "NIST_SP-800-53_rev5_HIGH-baseline_profile.json", modelType: "Profile", framework: "NIST SP 800-53B High", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline_profile.json", description: "High baseline profile for SP 800-53 Rev 5" },
  { filename: "NIST_SP-800-53_rev5_PRIVACY-baseline_profile.json", modelType: "Profile", framework: "NIST SP 800-53B Privacy", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_PRIVACY-baseline_profile.json", description: "Privacy baseline profile for SP 800-53 Rev 5" },
  { filename: "NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53B Low", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog.json", description: "Resolved Low baseline catalog" },
  { filename: "NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog-min.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53B Low", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog-min.json", description: "Resolved Low baseline catalog (minified)", notes: "Minified" },
  { filename: "NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53B Moderate", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog.json", description: "Resolved Moderate baseline catalog" },
  { filename: "NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53B Moderate", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json", description: "Resolved Moderate baseline catalog (minified)", notes: "Minified" },
  { filename: "NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53B High", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog.json", description: "Resolved High baseline catalog" },
  { filename: "NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog-min.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53B High", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog-min.json", description: "Resolved High baseline catalog (minified)", notes: "Minified" },
  { filename: "NIST_SP-800-53_rev5_PRIVACY-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53B Privacy", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_PRIVACY-baseline-resolved-profile_catalog.json", description: "Resolved Privacy baseline catalog" },
  { filename: "NIST_SP-800-53_rev5_PRIVACY-baseline-resolved-profile_catalog-min.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53B Privacy", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_PRIVACY-baseline-resolved-profile_catalog-min.json", description: "Resolved Privacy baseline catalog (minified)", notes: "Minified" },

  // ── NIST Official: SP 800-53 Rev 4 (Legacy) ──
  { filename: "NIST_SP-800-53_rev4_catalog.json", modelType: "Catalog", framework: "NIST SP 800-53 Rev 4", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_catalog.json", description: "SP 800-53 Rev 4 control catalog", notes: "Legacy" },
  { filename: "NIST_SP-800-53_rev4_LOW-baseline_profile.json", modelType: "Profile", framework: "NIST SP 800-53 Rev 4 Low", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_LOW-baseline_profile.json", description: "Low baseline profile (Rev 4)", notes: "Legacy" },
  { filename: "NIST_SP-800-53_rev4_MODERATE-baseline_profile.json", modelType: "Profile", framework: "NIST SP 800-53 Rev 4 Moderate", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_MODERATE-baseline_profile.json", description: "Moderate baseline profile (Rev 4)", notes: "Legacy" },
  { filename: "NIST_SP-800-53_rev4_HIGH-baseline_profile.json", modelType: "Profile", framework: "NIST SP 800-53 Rev 4 High", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_HIGH-baseline_profile.json", description: "High baseline profile (Rev 4)", notes: "Legacy" },
  { filename: "NIST_SP-800-53_rev4_LOW-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53 Rev 4 Low", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_LOW-baseline-resolved-profile_catalog.json", description: "Resolved Low baseline catalog (Rev 4)", notes: "Legacy" },
  { filename: "NIST_SP-800-53_rev4_LOW-baseline-resolved-profile_catalog-min.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53 Rev 4 Low", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_LOW-baseline-resolved-profile_catalog-min.json", description: "Resolved Low baseline catalog (Rev 4, minified)", notes: "Legacy / Minified" },
  { filename: "NIST_SP-800-53_rev4_MODERATE-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53 Rev 4 Moderate", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_MODERATE-baseline-resolved-profile_catalog.json", description: "Resolved Moderate baseline catalog (Rev 4)", notes: "Legacy" },
  { filename: "NIST_SP-800-53_rev4_MODERATE-baseline-resolved-profile_catalog-min.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53 Rev 4 Moderate", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_MODERATE-baseline-resolved-profile_catalog-min.json", description: "Resolved Moderate baseline catalog (Rev 4, minified)", notes: "Legacy / Minified" },
  { filename: "NIST_SP-800-53_rev4_HIGH-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53 Rev 4 High", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_HIGH-baseline-resolved-profile_catalog.json", description: "Resolved High baseline catalog (Rev 4)", notes: "Legacy" },
  { filename: "NIST_SP-800-53_rev4_HIGH-baseline-resolved-profile_catalog-min.json", modelType: "Resolved Profile Catalog", framework: "NIST SP 800-53 Rev 4 High", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_HIGH-baseline-resolved-profile_catalog-min.json", description: "Resolved High baseline catalog (Rev 4, minified)", notes: "Legacy / Minified" },

  // ── NIST Official: Example files ──
  { filename: "basic-catalog.json", modelType: "Catalog", framework: "Tutorial", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/catalog/json/basic-catalog.json", description: "Simple catalog excerpt from ISO/IEC 27002:2013 for learning OSCAL structure" },
  { filename: "example-component-definition.json", modelType: "Component Definition", framework: "NIST SP 800-53 Rev 5", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/component-definition/json/example-component-definition.json", description: "MongoDB component showing TLS implementations for SC-8, SC-8.1" },
  { filename: "ssp-example.json", modelType: "SSP", framework: "NIST SP 800-53 Rev 4 Moderate", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/ssp/json/ssp-example.json", description: "Enterprise Logging and Auditing System SSP" },
  { filename: "ifa_ssp-example.json", modelType: "SSP", framework: "NIST SP 800-53 Rev 5", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/ssp/json/ifa_ssp-example.json", description: "IFA GoodRead fictional link shortener SSP" },
  { filename: "oscal_leveraged-example_ssp.json", modelType: "SSP", framework: "NIST SP 800-53", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/ssp/json/oscal_leveraged-example_ssp.json", description: "Cloud provider leveraged authorization SSP" },
  { filename: "oscal_leveraging-example_ssp.json", modelType: "SSP", framework: "NIST SP 800-53", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/ssp/json/oscal_leveraging-example_ssp.json", description: "Customer system inheriting provider controls SSP" },
  { filename: "ifa_assessment-plan-example.json", modelType: "Assessment Plan", framework: "NIST SP 800-53 Rev 5", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/ap/json/ifa_assessment-plan-example.json", description: "IFA GoodRead assessment plan" },
  { filename: "ifa_assessment-results-example.json", modelType: "Assessment Results", framework: "NIST SP 800-53 Rev 5", source: "NIST Official", repo: "https://github.com/usnistgov/oscal-content", rawUrl: "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/ar/json/ifa_assessment-results-example.json", description: "IFA GoodRead assessment results" },

  // ── FedRAMP Rev 5 Baselines ──
  { filename: "FedRAMP_rev5_HIGH-baseline_profile.json", modelType: "Profile", framework: "FedRAMP Rev 5 High", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev5/baselines/json/FedRAMP_rev5_HIGH-baseline_profile.json", description: "FedRAMP Rev 5 High baseline profile" },
  { filename: "FedRAMP_rev5_MODERATE-baseline_profile.json", modelType: "Profile", framework: "FedRAMP Rev 5 Moderate", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev5/baselines/json/FedRAMP_rev5_MODERATE-baseline_profile.json", description: "FedRAMP Rev 5 Moderate baseline profile" },
  { filename: "FedRAMP_rev5_LOW-baseline_profile.json", modelType: "Profile", framework: "FedRAMP Rev 5 Low", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev5/baselines/json/FedRAMP_rev5_LOW-baseline_profile.json", description: "FedRAMP Rev 5 Low baseline profile" },
  { filename: "FedRAMP_rev5_LI-SaaS-baseline_profile.json", modelType: "Profile", framework: "FedRAMP Rev 5 LI-SaaS", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev5/baselines/json/FedRAMP_rev5_LI-SaaS-baseline_profile.json", description: "FedRAMP Rev 5 LI-SaaS baseline profile" },

  // ── FedRAMP Rev 5 Templates ──
  { filename: "FedRAMP-SSP-OSCAL-Template.json", modelType: "SSP", framework: "FedRAMP Rev 5", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev5/templates/ssp/json/FedRAMP-SSP-OSCAL-Template.json", description: "SSP template with FedRAMP extensions and sample data" },
  { filename: "FedRAMP-SAP-OSCAL-Template.json", modelType: "Assessment Plan", framework: "FedRAMP Rev 5", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev5/templates/sap/json/FedRAMP-SAP-OSCAL-Template.json", description: "Security Assessment Plan template" },
  { filename: "FedRAMP-SAR-OSCAL-Template.json", modelType: "Assessment Results", framework: "FedRAMP Rev 5", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev5/templates/sar/json/FedRAMP-SAR-OSCAL-Template.json", description: "Security Assessment Report template" },
  { filename: "FedRAMP-POAM-OSCAL-Template.json", modelType: "POA&M", framework: "FedRAMP Rev 5", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev5/templates/poam/json/FedRAMP-POAM-OSCAL-Template.json", description: "POA&M template for tracking risks and remediation" },

  // ── FedRAMP Rev 4 (Deprecated) ──
  { filename: "FedRAMP_rev4_HIGH-baseline_profile.json", modelType: "Profile", framework: "FedRAMP Rev 4 High", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev4/baselines/json/FedRAMP_rev4_HIGH-baseline_profile.json", description: "FedRAMP Rev 4 High baseline profile", notes: "Deprecated" },
  { filename: "FedRAMP_rev4_MODERATE-baseline_profile.json", modelType: "Profile", framework: "FedRAMP Rev 4 Moderate", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev4/baselines/json/FedRAMP_rev4_MODERATE-baseline_profile.json", description: "FedRAMP Rev 4 Moderate baseline profile", notes: "Deprecated" },
  { filename: "FedRAMP_rev4_LOW-baseline_profile.json", modelType: "Profile", framework: "FedRAMP Rev 4 Low", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev4/baselines/json/FedRAMP_rev4_LOW-baseline_profile.json", description: "FedRAMP Rev 4 Low baseline profile", notes: "Deprecated" },
  { filename: "FedRAMP_rev4_LI-SaaS-baseline_profile.json", modelType: "Profile", framework: "FedRAMP Rev 4 LI-SaaS", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev4/baselines/json/FedRAMP_rev4_LI-SaaS-baseline_profile.json", description: "FedRAMP Rev 4 LI-SaaS baseline profile", notes: "Deprecated" },
  { filename: "FedRAMP-SSP-OSCAL-Template.json (Rev 4)", modelType: "SSP", framework: "FedRAMP Rev 4", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev4/templates/ssp/json/FedRAMP-SSP-OSCAL-Template.json", description: "FedRAMP Rev 4 SSP template", notes: "Deprecated" },
  { filename: "FedRAMP-SAP-OSCAL-Template.json (Rev 4)", modelType: "Assessment Plan", framework: "FedRAMP Rev 4", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev4/templates/sap/json/FedRAMP-SAP-OSCAL-Template.json", description: "FedRAMP Rev 4 SAP template", notes: "Deprecated" },
  { filename: "FedRAMP-SAR-OSCAL-Template.json (Rev 4)", modelType: "Assessment Results", framework: "FedRAMP Rev 4", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev4/templates/sar/json/FedRAMP-SAR-OSCAL-Template.json", description: "FedRAMP Rev 4 SAR template", notes: "Deprecated" },
  { filename: "FedRAMP-POAM-OSCAL-Template.json (Rev 4)", modelType: "POA&M", framework: "FedRAMP Rev 4", source: "FedRAMP", repo: "https://github.com/GSA/fedramp-automation", rawUrl: "https://raw.githubusercontent.com/GSA/fedramp-automation/master/dist/content/rev4/templates/poam/json/FedRAMP-POAM-OSCAL-Template.json", description: "FedRAMP Rev 4 POA&M template", notes: "Deprecated" },

  // ── Australian ISM ──
  { filename: "ISM_catalog.json", modelType: "Catalog", framework: "Australian ISM", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_catalog.json", description: "Australian Information Security Manual catalog" },
  { filename: "ISM_E8_ML1-baseline_profile.json", modelType: "Profile", framework: "Australian Essential Eight ML1", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_E8_ML1-baseline_profile.json", description: "Essential Eight Maturity Level 1 baseline profile" },
  { filename: "ISM_E8_ML2-baseline_profile.json", modelType: "Profile", framework: "Australian Essential Eight ML2", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_E8_ML2-baseline_profile.json", description: "Essential Eight Maturity Level 2 baseline profile" },
  { filename: "ISM_E8_ML3-baseline_profile.json", modelType: "Profile", framework: "Australian Essential Eight ML3", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_E8_ML3-baseline_profile.json", description: "Essential Eight Maturity Level 3 baseline profile" },
  { filename: "ISM_NON_CLASSIFIED-baseline_profile.json", modelType: "Profile", framework: "Australian ISM Non-Classified", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_NON_CLASSIFIED-baseline_profile.json", description: "ISM Non-Classified baseline profile" },
  { filename: "ISM_OFFICIAL_SENSITIVE-baseline_profile.json", modelType: "Profile", framework: "Australian ISM OFFICIAL:Sensitive", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_OFFICIAL_SENSITIVE-baseline_profile.json", description: "ISM OFFICIAL:Sensitive baseline profile" },
  { filename: "ISM_PROTECTED-baseline_profile.json", modelType: "Profile", framework: "Australian ISM PROTECTED", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_PROTECTED-baseline_profile.json", description: "ISM PROTECTED baseline profile" },
  { filename: "ISM_SECRET-baseline_profile.json", modelType: "Profile", framework: "Australian ISM SECRET", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_SECRET-baseline_profile.json", description: "ISM SECRET baseline profile" },
  { filename: "ISM_TOP_SECRET-baseline_profile.json", modelType: "Profile", framework: "Australian ISM TOP SECRET", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_TOP_SECRET-baseline_profile.json", description: "ISM TOP SECRET baseline profile" },
  { filename: "ISM_E8_ML1-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "Australian Essential Eight ML1", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_E8_ML1-baseline-resolved-profile_catalog.json", description: "Resolved Essential Eight ML1 baseline catalog" },
  { filename: "ISM_E8_ML2-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "Australian Essential Eight ML2", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_E8_ML2-baseline-resolved-profile_catalog.json", description: "Resolved Essential Eight ML2 baseline catalog" },
  { filename: "ISM_E8_ML3-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "Australian Essential Eight ML3", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_E8_ML3-baseline-resolved-profile_catalog.json", description: "Resolved Essential Eight ML3 baseline catalog" },
  { filename: "ISM_NON_CLASSIFIED-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "Australian ISM Non-Classified", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_NON_CLASSIFIED-baseline-resolved-profile_catalog.json", description: "Resolved ISM Non-Classified baseline catalog" },
  { filename: "ISM_OFFICIAL_SENSITIVE-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "Australian ISM OFFICIAL:Sensitive", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_OFFICIAL_SENSITIVE-baseline-resolved-profile_catalog.json", description: "Resolved ISM OFFICIAL:Sensitive baseline catalog" },
  { filename: "ISM_PROTECTED-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "Australian ISM PROTECTED", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_PROTECTED-baseline-resolved-profile_catalog.json", description: "Resolved ISM PROTECTED baseline catalog" },
  { filename: "ISM_SECRET-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "Australian ISM SECRET", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_SECRET-baseline-resolved-profile_catalog.json", description: "Resolved ISM SECRET baseline catalog" },
  { filename: "ISM_TOP_SECRET-baseline-resolved-profile_catalog.json", modelType: "Resolved Profile Catalog", framework: "Australian ISM TOP SECRET", source: "International Gov", repo: "https://github.com/AustralianCyberSecurityCentre/ism-oscal", rawUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_TOP_SECRET-baseline-resolved-profile_catalog.json", description: "Resolved ISM TOP SECRET baseline catalog" },

  // ── Community ──
  { filename: "CMMC_v2_catalog.json", modelType: "Catalog", framework: "CMMC v2", source: "Community", repo: "https://github.com/ceagan/oscal-cmmc", rawUrl: "https://raw.githubusercontent.com/ceagan/oscal-cmmc/main/CMMC_v2_catalog.json", description: "CMMC v2 control catalog (community)" },
  { filename: "NIST_SP-800-171_rev2_catalog.json", modelType: "Catalog", framework: "SP 800-171 Rev 2", source: "Community", repo: "https://github.com/FATHOM5CORP/oscal", rawUrl: "https://raw.githubusercontent.com/FATHOM5CORP/oscal/main/content/SP800-171/oscal-content/catalogs/NIST_SP-800-171_rev2_catalog.json", description: "SP 800-171 Rev 2 catalog (FATHOM5)" },
  { filename: "NIST_SP-800-53_rev4_catalog.json", modelType: "Catalog", framework: "SP 800-53 Rev 4", source: "Community", repo: "https://github.com/GovReady/800-171-parse", rawUrl: "https://raw.githubusercontent.com/GovReady/800-171-parse/master/data/NIST_SP-800-53_rev4_catalog.json", description: "SP 800-53 Rev 4 catalog (GovReady)" },
  { filename: "handmade_800-171_rev1_catalog.json", modelType: "Catalog", framework: "SP 800-171 Rev 1", source: "Community", repo: "https://github.com/GovReady/800-171-parse", rawUrl: "https://raw.githubusercontent.com/GovReady/800-171-parse/master/data/handmade_800-171_rev1_catalog.json", description: "Handmade SP 800-171 Rev 1 catalog (GovReady)" },

  // ── Plugfest: EasyDynamics Comply0 — CYFUN + FedRAMP 20x ──
  { filename: "cyfun_Framework_oscal_catalog.json", modelType: "Catalog", framework: "CYFUN Framework", source: "Plugfest", repo: "https://github.com/OSCAL-Foundation/plugfest-2025", rawUrl: "https://raw.githubusercontent.com/OSCAL-Foundation/plugfest-2025/main/interop-sharing/easydynamics-comply0/cyfun/cyfun_Framework_oscal_catalog.json", description: "CYFUN control framework catalog" },
  { filename: "cyfun_Basic_oscal_profile.json", modelType: "Profile", framework: "CYFUN Basic", source: "Plugfest", repo: "https://github.com/OSCAL-Foundation/plugfest-2025", rawUrl: "https://raw.githubusercontent.com/OSCAL-Foundation/plugfest-2025/main/interop-sharing/easydynamics-comply0/cyfun/cyfun_Basic_oscal_profile.json", description: "CYFUN Basic baseline profile" },
  { filename: "cyfun_Essential_oscal_profile.json", modelType: "Profile", framework: "CYFUN Essential", source: "Plugfest", repo: "https://github.com/OSCAL-Foundation/plugfest-2025", rawUrl: "https://raw.githubusercontent.com/OSCAL-Foundation/plugfest-2025/main/interop-sharing/easydynamics-comply0/cyfun/cyfun_Essential_oscal_profile.json", description: "CYFUN Essential baseline profile" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ExamplesPage() {
  const [search, setSearch] = useState("");
  const [modelFilters, setModelFilters] = useState<Set<ModelType>>(new Set());
  const [sourceFilters, setSourceFilters] = useState<Set<SourceTag>>(new Set());
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const isMobile = useIsMobile();

  /* ── Filter logic ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return examples.filter((e) => {
      if (modelFilters.size > 0 && !modelFilters.has(e.modelType)) return false;
      if (sourceFilters.size > 0 && !sourceFilters.has(e.source)) return false;
      if (q) {
        const haystack = `${e.filename} ${e.framework} ${e.description} ${e.notes ?? ""} ${e.source}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [search, modelFilters, sourceFilters]);

  /* ── Group by model type ── */
  const grouped = useMemo(() => {
    const map = new Map<ModelType, ExampleEntry[]>();
    for (const mt of MODEL_ORDER) map.set(mt, []);
    for (const e of filtered) {
      map.get(e.modelType)!.push(e);
    }
    return map;
  }, [filtered]);

  /* ── Toggle helpers ── */
  function toggleModel(m: ModelType) {
    setModelFilters((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  }
  function toggleSource(s: SourceTag) {
    setSourceFilters((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 1500);
    });
  }

  function viewerUrl(entry: ExampleEntry): string {
    const base = viewerPath[entry.modelType];
    return `${base}?url=${encodeURIComponent(entry.rawUrl)}`;
  }

  const totalShown = filtered.length;

  return (
    <div>
      {/* ── About banner ── */}
      <div style={{ ...s.banner, ...(isMobile ? { padding: "14px 12px" } : {}) }}>
        <h1 style={{ ...s.heading, ...(isMobile ? { fontSize: "1.2rem" } : {}) }}>OSCAL JSON Content Examples</h1>
        <p style={s.subtitle}>
          A comprehensive directory of publicly available OSCAL JSON files from NIST, FedRAMP, international governments,
          and the community. Click any file to open it in the viewer. Use the filters and search to narrow results.
        </p>
        <p style={{ ...s.subtitle, marginTop: 8, fontSize: 13, color: colors.gray }}>
          Showing <strong>{totalShown}</strong> of {examples.length} files
        </p>
      </div>

      {/* ── Filters panel ── */}
      <div style={{ ...s.filterPanel, ...(isMobile ? { padding: "12px 10px" } : {}) }}>
        {/* Search */}
        <div style={s.filterSection}>
          <label style={s.filterLabel}>Search</label>
          <input
            type="text"
            placeholder="Filter by filename, framework, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={s.searchInput}
          />
        </div>

        {/* Model type filter */}
        <div style={s.filterSection}>
          <label style={s.filterLabel}>Model Type</label>
          <div style={s.chipRow}>
            {MODEL_ORDER.map((m) => {
              const active = modelFilters.has(m);
              const count = examples.filter((e) => e.modelType === m).length;
              return (
                <button
                  key={m}
                  onClick={() => toggleModel(m)}
                  style={{
                    ...s.filterChip,
                    backgroundColor: active ? modelColor[m] : colors.bg,
                    color: active ? colors.textOnAccent : colors.black,
                    borderColor: active ? modelColor[m] : colors.paleGray,
                  }}
                >
                  {m} <span style={{ opacity: 0.7, marginLeft: 4 }}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Source filter */}
        <div style={s.filterSection}>
          <label style={s.filterLabel}>Source</label>
          <div style={s.chipRow}>
            {SOURCE_ORDER.map((src) => {
              const active = sourceFilters.has(src);
              const count = examples.filter((e) => e.source === src).length;
              if (count === 0) return null;
              return (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  style={{
                    ...s.filterChip,
                    backgroundColor: active ? sourceColor[src] : colors.bg,
                    color: active ? colors.textOnAccent : colors.black,
                    borderColor: active ? sourceColor[src] : colors.paleGray,
                  }}
                >
                  {src} <span style={{ opacity: 0.7, marginLeft: 4 }}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {(modelFilters.size > 0 || sourceFilters.size > 0 || search) && (
          <button
            onClick={() => { setModelFilters(new Set()); setSourceFilters(new Set()); setSearch(""); }}
            style={s.clearBtn}
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* ── Grouped results ── */}
      {MODEL_ORDER.map((modelType) => {
        const entries = grouped.get(modelType)!;
        if (entries.length === 0) return null;
        return (
          <section key={modelType} style={s.section}>
            <div style={s.sectionHeader}>
              <span style={{ ...s.sectionDot, backgroundColor: modelColor[modelType] }} />
              <h2 style={s.sectionTitle}>{modelType}</h2>
              <span style={s.sectionCount}>{entries.length} file{entries.length !== 1 ? "s" : ""}</span>
            </div>

            <div style={s.table}>
              {/* Table header — hidden on mobile */}
              {!isMobile && (
                <div style={s.tableHeaderRow}>
                  <span style={{ ...s.th, flex: 3 }}>Filename</span>
                  <span style={{ ...s.th, flex: 2 }}>Framework</span>
                  <span style={{ ...s.th, flex: 1.2 }}>Source</span>
                  <span style={{ ...s.th, flex: 2.5 }}>Description</span>
                  <span style={{ ...s.th, flex: 1.2, textAlign: "center" }}>Actions</span>
                </div>
              )}

              {/* Rows */}
              {entries.map((entry, i) => isMobile ? (
                <div key={`${entry.rawUrl}-${i}`} style={{ padding: "10px 12px", borderBottom: `1px solid ${colors.paleGray}`, backgroundColor: i % 2 === 0 ? colors.card : colors.bg }}>
                  <a href={viewerUrl(entry)} target="_blank" rel="noopener noreferrer" style={{ ...s.fileLink, fontSize: 13, display: "block", marginBottom: 4 }}>
                    {entry.filename}
                  </a>
                  <div style={{ fontSize: 11, color: colors.gray, marginBottom: 4 }}>{entry.framework}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ ...s.sourceBadge, backgroundColor: sourceColor[entry.source] }}>{entry.source}</span>
                    {entry.notes && <span style={s.notesBadge}>{entry.notes}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: colors.gray, marginBottom: 6 }}>{entry.description}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => copyUrl(entry.rawUrl)} style={s.actionBtn}>{copiedUrl === entry.rawUrl ? "✓" : "Copy URL"}</button>
                    <a href={entry.repo} target="_blank" rel="noopener noreferrer" style={s.repoLink}>Repo</a>
                  </div>
                </div>
              ) : (
                <div
                  key={`${entry.rawUrl}-${i}`}
                  style={{
                    ...s.tableRow,
                    backgroundColor: i % 2 === 0 ? colors.card : colors.bg,
                  }}
                >
                  {/* Filename → opens viewer */}
                  <span style={{ ...s.td, flex: 3 }}>
                    <a
                      href={viewerUrl(entry)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={s.fileLink}
                      title={`Open ${entry.filename} in the ${entry.modelType} viewer`}
                    >
                      {entry.filename}
                    </a>
                    {entry.notes && (
                      <span style={s.notesBadge}>{entry.notes}</span>
                    )}
                  </span>

                  {/* Framework */}
                  <span style={{ ...s.td, flex: 2, fontSize: 12 }}>{entry.framework}</span>

                  {/* Source badge */}
                  <span style={{ ...s.td, flex: 1.2 }}>
                    <span style={{ ...s.sourceBadge, backgroundColor: sourceColor[entry.source] }}>
                      {entry.source}
                    </span>
                  </span>

                  {/* Description */}
                  <span style={{ ...s.td, flex: 2.5, fontSize: 12, color: colors.gray }}>
                    {entry.description}
                  </span>

                  {/* Actions */}
                  <span style={{ ...s.td, flex: 1.2, display: "flex", gap: 6, justifyContent: "center", flexShrink: 0, minWidth: 130 }}>
                    <button
                      onClick={() => copyUrl(entry.rawUrl)}
                      title="Copy raw JSON URL"
                      style={s.actionBtn}
                    >
                      {copiedUrl === entry.rawUrl ? "✓" : "Copy URL"}
                    </button>
                    <a
                      href={entry.repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View GitHub repo"
                      style={s.repoLink}
                    >
                      Repo
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {totalShown === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: colors.gray }}>
          <p style={{ fontSize: 16 }}>No files match your current filters.</p>
          <button
            onClick={() => { setModelFilters(new Set()); setSourceFilters(new Set()); setSearch(""); }}
            style={{ ...s.clearBtn, marginTop: 12 }}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Sources / References ── */}
      <footer style={s.footer}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px", color: colors.navy }}>References &amp; Sources</h3>
        <div style={s.footerLinks}>
          <a href="https://pages.nist.gov/OSCAL/" target="_blank" rel="noopener noreferrer" style={s.footerLink}>NIST OSCAL Project</a>
          <a href="https://oscalfoundation.org/" target="_blank" rel="noopener noreferrer" style={s.footerLink}>OSCAL Foundation</a>
          <a href="https://github.com/usnistgov/oscal-content" target="_blank" rel="noopener noreferrer" style={s.footerLink}>OSCAL Content Repo</a>
          <a href="https://github.com/GSA/fedramp-automation" target="_blank" rel="noopener noreferrer" style={s.footerLink}>FedRAMP Automation</a>
          <a href="https://github.com/oscal-club/awesome-oscal" target="_blank" rel="noopener noreferrer" style={s.footerLink}>awesome-oscal</a>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const s: Record<string, CSSProperties> = {
  /* Banner */
  banner: {
    backgroundColor: colors.card,
    borderLeft: `5px solid ${colors.navy}`,
    borderRadius: radii.md,
    padding: "24px 28px",
    marginBottom: 20,
    boxShadow: shadows.sm,
  },
  heading: {
    fontSize: "1.5rem",
    fontFamily: fonts.sans,
    fontWeight: 700,
    color: colors.navy,
    margin: "0 0 6px",
  },
  subtitle: {
    fontSize: 14,
    color: colors.black,
    lineHeight: 1.6,
    margin: 0,
  },

  /* Filters */
  filterPanel: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.md,
    padding: "18px 22px",
    marginBottom: 24,
    boxShadow: shadows.sm,
  },
  filterSection: {
    marginBottom: 14,
  },
  filterLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    color: colors.gray,
    marginBottom: 6,
    fontFamily: fonts.sans,
  },
  searchInput: {
    width: "100%",
    padding: "8px 12px",
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.sm,
    fontSize: 13,
    fontFamily: fonts.sans,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
  },
  filterChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: radii.pill,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 500,
    fontFamily: fonts.sans,
    cursor: "pointer",
    transition: "all .15s",
    whiteSpace: "nowrap" as const,
  },
  clearBtn: {
    display: "inline-block",
    padding: "5px 12px",
    fontSize: 12,
    color: colors.brightBlue,
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: fonts.sans,
    fontWeight: 500,
  },

  /* Sections */
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sectionDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: fonts.sans,
    color: colors.black,
    margin: 0,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.gray,
    fontWeight: 400,
    fontFamily: fonts.sans,
  },

  /* Table */
  table: {
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.md,
    overflow: "hidden",
    boxShadow: shadows.sm,
  },
  tableHeaderRow: {
    display: "flex",
    alignItems: "center",
    backgroundColor: colors.navy,
    padding: "8px 14px",
    gap: 10,
  },
  th: {
    fontSize: 11,
    fontWeight: 600,
    fontFamily: fonts.sans,
    color: colors.white,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    gap: 10,
    borderBottom: `1px solid ${colors.paleGray}`,
    transition: "background-color .1s",
  },
  td: {
    fontSize: 13,
    fontFamily: fonts.sans,
    color: colors.black,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  /* Links & badges */
  fileLink: {
    color: colors.brightBlue,
    textDecoration: "none",
    fontWeight: 500,
    fontSize: 12,
    wordBreak: "break-all" as const,
  },
  notesBadge: {
    display: "inline-block",
    marginLeft: 6,
    padding: "1px 6px",
    borderRadius: radii.sm,
    backgroundColor: colors.yellow,
    color: colors.tintOrange,
    fontSize: 10,
    fontWeight: 600,
    verticalAlign: "middle",
  },
  sourceBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: radii.pill,
    color: colors.textOnAccent,
    fontSize: 10,
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
    fontFamily: fonts.sans,
  },
  actionBtn: {
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 500,
    fontFamily: fonts.sans,
    color: colors.navy,
    backgroundColor: colors.bg,
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.sm,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  repoLink: {
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 500,
    fontFamily: fonts.sans,
    color: colors.gray,
    textDecoration: "none",
    border: `1px solid ${colors.paleGray}`,
    borderRadius: radii.sm,
    backgroundColor: colors.bg,
  },

  /* Footer */
  footer: {
    marginTop: 40,
    padding: "18px 22px",
    borderTop: `1px solid ${colors.paleGray}`,
  },
  footerLinks: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 16,
  },
  footerLink: {
    fontSize: 13,
    color: colors.brightBlue,
    textDecoration: "none",
    fontFamily: fonts.sans,
  },
};
