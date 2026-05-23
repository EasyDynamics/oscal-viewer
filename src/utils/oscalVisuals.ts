import { colors } from "../theme/tokens";

export interface OscalVisualProp {
  name: string;
  value: string;
  ns?: string;
  class?: string;
}

export interface VisualMeta {
  iconKey: string;
  color: string;
  label?: string;
}

export interface ResolvedComponentVisual extends VisualMeta {
  assetType?: string;
  localAssetType?: string;
}

export const OSCAL_NAMESPACE = "http://csrc.nist.gov/ns/oscal";

export function isOscalNamespace(ns?: string): boolean {
  return (ns || "").replace(/\/$/, "") === OSCAL_NAMESPACE;
}

export function oscalNamespaceProps<T extends OscalVisualProp>(props: T[] = []): T[] {
  return props.filter((p) => isOscalNamespace(p.ns));
}

export function findOscalProp<T extends OscalVisualProp>(props: T[] = [], name: string): T | undefined {
  return props.find((p) => p.name === name && isOscalNamespace(p.ns)) ?? props.find((p) => p.name === name);
}

export function findRequiredOscalProp<T extends OscalVisualProp>(props: T[] = [], name: string): T | undefined {
  return props.find((p) => p.name === name && isOscalNamespace(p.ns));
}

export function isWithdrawnStatusProp(prop: OscalVisualProp): boolean {
  return prop.name === "status" && prop.value === "withdrawn" && isOscalNamespace(prop.ns);
}

export function propDisplayName(prop: OscalVisualProp): string {
  return prop.class ? `${prop.name} (${prop.class})` : prop.name;
}

export function componentTypeVisual(type: string): VisualMeta {
  switch (type) {
    case "this-system": return { iconKey: "this-system", color: colors.navy };
    case "system": return { iconKey: "ext-system", color: colors.cobalt };
    case "interconnection": return { iconKey: "interconnection", color: colors.purple };
    case "software": return { iconKey: "software", color: colors.brightBlue };
    case "hardware": return { iconKey: "hardware", color: colors.blueGray };
    case "service": return { iconKey: "service", color: colors.mint };
    case "policy": return { iconKey: "policy", color: colors.orange };
    case "physical": return { iconKey: "physical", color: colors.darkGreen };
    case "process-procedure": return { iconKey: "process-procedure", color: colors.cobalt };
    case "plan": return { iconKey: "plan", color: colors.brightBlue };
    case "guidance": return { iconKey: "guidance", color: colors.yellow };
    case "standard": return { iconKey: "standard", color: colors.red };
    case "validation": return { iconKey: "validation", color: colors.darkGreen };
    case "network": return { iconKey: "network", color: colors.purple };
    default: return { iconKey: "cube", color: colors.cobalt };
  }
}

const CANONICAL_ASSET_TYPES = new Set([
  "operating-system",
  "database",
  "web-server",
  "dns-server",
  "email-server",
  "directory-server",
  "pbx",
  "firewall",
  "router",
  "switch",
  "storage-array",
  "appliance",
]);

export function isCanonicalAssetType(assetType?: string): assetType is string {
  return !!assetType && CANONICAL_ASSET_TYPES.has(assetType.toLowerCase());
}

export function assetTypeVisual(assetType: string): VisualMeta {
  switch (assetType.toLowerCase()) {
    case "operating-system": return { iconKey: "software", color: colors.brightBlue, label: "Operating system" };
    case "database": return { iconKey: "database", color: colors.cobalt, label: "Database" };
    case "web-server": return { iconKey: "software", color: colors.brightBlue, label: "Web server" };
    case "dns-server": return { iconKey: "network", color: colors.purple, label: "DNS server" };
    case "email-server": return { iconKey: "service", color: colors.mint, label: "Email server" };
    case "directory-server": return { iconKey: "service", color: colors.mint, label: "Directory server" };
    case "pbx": return { iconKey: "hardware", color: colors.blueGray, label: "PBX" };
    case "firewall": return { iconKey: "network", color: colors.red, label: "Firewall" };
    case "router": return { iconKey: "network", color: colors.purple, label: "Router" };
    case "switch": return { iconKey: "network", color: colors.purple, label: "Switch" };
    case "storage-array": return { iconKey: "database", color: colors.darkGreen, label: "Storage array" };
    case "appliance": return { iconKey: "hardware", color: colors.blueGray, label: "Appliance" };
    default: return { iconKey: "box", color: colors.darkGreen };
  }
}

export function resolveComponentVisual(component: { type: string; props?: OscalVisualProp[] }): ResolvedComponentVisual {
  const assetType = findOscalProp(component.props ?? [], "asset-type")?.value;
  if (isCanonicalAssetType(assetType)) {
    return { ...assetTypeVisual(assetType), assetType };
  }
  return { ...componentTypeVisual(component.type), localAssetType: assetType };
}

const PROP_VISUALS: Record<string, VisualMeta & { label: string }> = {
  label: { label: "Label", iconKey: "tag", color: colors.cobalt },
  "baseline-configuration-name": { label: "Baseline", iconKey: "shield-layers", color: colors.navy },
  "implementation-point": { label: "Implementation Point", iconKey: "process-procedure", color: colors.purple },
  "allows-authenticated-scan": { label: "Authenticated Scan", iconKey: "validation", color: colors.darkGreen },
  virtual: { label: "Virtual", iconKey: "cloud", color: colors.brightBlue },
  public: { label: "Public", iconKey: "network", color: colors.orange },
  "asset-type": { label: "Asset Type", iconKey: "box", color: colors.darkGreen },
  function: { label: "Function", iconKey: "process-procedure", color: colors.mint },
  model: { label: "Model", iconKey: "file-code", color: colors.cobalt },
};

const BACK_MATTER_RESOURCE_VISUALS: Record<string, VisualMeta & { label: string }> = {
  "azure-documentation": { label: "Azure Docs", iconKey: "cloud", color: colors.cobalt },
  standards: { label: "Standards", iconKey: "book", color: colors.navy },
  "iac-tooling": { label: "IaC Tooling", iconKey: "code", color: colors.mint },
  "threat-intelligence": { label: "Threat Intel", iconKey: "target", color: colors.red },
};

export function propVisual(prop: OscalVisualProp): VisualMeta & { label: string } {
  if (prop.name === "asset-type" && isCanonicalAssetType(prop.value)) {
    return { ...assetTypeVisual(prop.value), label: PROP_VISUALS["asset-type"].label };
  }
  return PROP_VISUALS[prop.name] ?? { label: propDisplayName(prop), iconKey: "tag", color: colors.gray };
}

export function raisedOscalProps<T extends OscalVisualProp>(props: T[] = []): T[] {
  const preferred = Object.keys(PROP_VISUALS);
  const csrcProps = oscalNamespaceProps(props);
  return preferred.flatMap((name) => csrcProps.filter((p) => p.name === name));
}

export function isBackMatterResourceTypeProp(prop: OscalVisualProp): boolean {
  return prop.name === "type" || prop.name === "definition-type";
}

export function backMatterResourceType(resource: { props?: OscalVisualProp[] }): string {
  const props = resource.props ?? [];
  return props.find((p) => p.name === "type")?.value ?? props.find((p) => p.name === "definition-type")?.value ?? "other";
}

export function backMatterResourceVisual(resourceOrType: { props?: OscalVisualProp[] } | string): VisualMeta & { label: string } {
  const type = typeof resourceOrType === "string" ? resourceOrType : backMatterResourceType(resourceOrType);
  return BACK_MATTER_RESOURCE_VISUALS[type] ?? {
    label: type === "other" ? "Resources" : type.replace(/-/g, " "),
    iconKey: "book",
    color: colors.gray,
  };
}
