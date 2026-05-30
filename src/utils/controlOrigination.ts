import { alpha, colors } from "../theme/tokens";
import { isOscalNamespace, OSCAL_NAMESPACE, type OscalVisualProp } from "./oscalVisuals";

export const CONTROL_ORIGINATION_VALUES = ["organization", "system-specific", "customer-configured", "customer-provided", "inherited"] as const;
export type ControlOrigination = typeof CONTROL_ORIGINATION_VALUES[number];
export type ControlOriginationRollup = ControlOrigination | "mixed" | "unspecified";
export type ControlOriginationSource = "implemented-requirement" | "statement" | "by-component";

export interface ControlOriginationResolution {
  value?: string;
  source?: ControlOriginationSource;
}

export interface ControlOriginationIssue {
  controlId: string;
  location: string;
  value: string;
  message: string;
}

export interface ControlOriginationByComponent {
  componentUuid?: string;
  uuid?: string;
  props?: OscalVisualProp[];
}

export interface ControlOriginationStatement {
  statementId?: string;
  uuid?: string;
  props?: OscalVisualProp[];
  byComponents?: ControlOriginationByComponent[];
}

export interface ControlOriginationRequirement {
  controlId: string;
  props?: OscalVisualProp[];
  byComponents?: ControlOriginationByComponent[];
  statements?: ControlOriginationStatement[];
}

export interface ControlOriginationSspLike {
  controlImplementation: {
    implementedRequirements: ControlOriginationRequirement[];
  };
}

export function isControlOrigination(value?: string): value is ControlOrigination {
  return CONTROL_ORIGINATION_VALUES.includes(value as ControlOrigination);
}

export function findControlOriginationProp<T extends OscalVisualProp>(props: T[] = []): T | undefined {
  return props.find((p) => p.name === "control-origination" && isOscalNamespace(p.ns));
}

export function isOscalNamespaceProp(prop: OscalVisualProp): boolean {
  return isOscalNamespace(prop.ns);
}

export function resolveControlOrigination(
  requirementProps: OscalVisualProp[] = [],
  statementProps: OscalVisualProp[] = [],
  byComponentProps: OscalVisualProp[] = [],
): ControlOriginationResolution {
  const byComponentProp = findControlOriginationProp(byComponentProps);
  if (byComponentProp?.value) return { value: byComponentProp.value, source: "by-component" };
  const statementProp = findControlOriginationProp(statementProps);
  if (statementProp?.value) return { value: statementProp.value, source: "statement" };
  const requirementProp = findControlOriginationProp(requirementProps);
  if (requirementProp?.value) return { value: requirementProp.value, source: "implemented-requirement" };
  return {};
}

export function rollupControlOrigination(ir: ControlOriginationRequirement): ControlOriginationRollup | string {
  const values = [
    ...(ir.byComponents ?? []).map((bc) => resolveControlOrigination(ir.props, [], bc.props).value),
    ...(ir.statements ?? []).flatMap((st) => (st.byComponents ?? []).map((bc) => resolveControlOrigination(ir.props, st.props, bc.props).value)),
  ].filter((value): value is string => !!value);

  if (values.length === 0) return findControlOriginationProp(ir.props)?.value || "unspecified";
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) return "unspecified";
  if (unique.length === 1) return unique[0];
  return "mixed";
}

export function controlOriginationMeta(value?: string): { label: string; color: string; background: string; icon: string; description: string } {
  const lower = (value || "unspecified").trim().toLowerCase();
  switch (lower) {
    case "organization":
      return { label: "Organization-wide", color: colors.navy, background: alpha(colors.navy, 8), icon: "users", description: "Implemented by the organization, but not specific to this system." };
    case "system-specific":
      return { label: "System-specific", color: colors.cobalt, background: alpha(colors.cobalt, 9), icon: "this-system", description: "Implemented specifically for this system." };
    case "customer-configured":
      return { label: "Customer-configured", color: colors.orange, background: alpha(colors.orange, 10), icon: "process-procedure", description: "Provided by the system, but configured by the customer." };
    case "customer-provided":
      return { label: "Customer-provided", color: colors.red, background: alpha(colors.red, 10), icon: "users", description: "Must be implemented by the customer." };
    case "inherited":
      return { label: "Inherited", color: colors.darkGreen, background: alpha(colors.darkGreen, 10), icon: "layers", description: "Inherited from an underlying system." };
    case "mixed":
      return { label: "Mixed sources", color: colors.purple, background: alpha(colors.purple, 10), icon: "folder-layers", description: "Multiple child implementation entries declare different control origination values." };
    case "unspecified":
      return { label: "Source unspecified", color: colors.gray, background: colors.surfaceSubtle, icon: "info", description: "No OSCAL control-origination property was found." };
    default:
      return { label: value || "Unknown source", color: colors.gray, background: colors.surfaceSubtle, icon: "tag", description: "Unrecognized OSCAL control-origination value." };
  }
}

export function controlOriginationSourceLabel(source?: ControlOriginationSource): string {
  if (source === "by-component") return "set on by-component";
  if (source === "statement") return "inherited from statement";
  if (source === "implemented-requirement") return "inherited from implemented requirement";
  return "not declared";
}

export function collectControlOriginationIssues(ssp: ControlOriginationSspLike): ControlOriginationIssue[] {
  const issues: ControlOriginationIssue[] = [];
  const inspect = (controlId: string, location: string, props: OscalVisualProp[] = []) => {
    props.filter((p) => p.name === "control-origination").forEach((prop) => {
      if (!isOscalNamespaceProp(prop)) {
        issues.push({
          controlId,
          location,
          value: prop.value || "(empty)",
          message: `control-origination is ignored unless ns is ${OSCAL_NAMESPACE}.`,
        });
      } else if (!isControlOrigination(prop.value)) {
        issues.push({
          controlId,
          location,
          value: prop.value || "(empty)",
          message: "control-origination must be organization, system-specific, customer-configured, customer-provided, or inherited.",
        });
      }
    });
  };

  ssp.controlImplementation.implementedRequirements.forEach((ir) => {
    inspect(ir.controlId, "implemented requirement", ir.props);
    (ir.byComponents ?? []).forEach((bc) => inspect(ir.controlId, `by-component ${bc.componentUuid || bc.uuid || "unknown"}`, bc.props));
    (ir.statements ?? []).forEach((st) => {
      inspect(ir.controlId, `statement ${st.statementId || st.uuid || "unknown"}`, st.props);
      (st.byComponents ?? []).forEach((bc) => inspect(ir.controlId, `statement ${st.statementId || st.uuid || "unknown"} / by-component ${bc.componentUuid || bc.uuid || "unknown"}`, bc.props));
    });
  });
  return issues;
}
