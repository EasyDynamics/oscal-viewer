import { describe, expect, it } from "vitest";
import {
  collectControlOriginationIssues,
  findControlOriginationProp,
  isControlOrigination,
  resolveControlOrigination,
  rollupControlOrigination,
  type ControlOriginationRequirement,
} from "./controlOrigination";
import { OSCAL_NAMESPACE } from "./oscalVisuals";

const oscalProp = (value: string) => ({ name: "control-origination", value, ns: OSCAL_NAMESPACE });
const localProp = (value: string) => ({ name: "control-origination", value });

describe("control origination utilities", () => {
  it("recognizes only allowed OSCAL values", () => {
    expect(isControlOrigination("system-specific")).toBe(true);
    expect(isControlOrigination("customer-provided")).toBe(true);
    expect(isControlOrigination("provider-owned")).toBe(false);
  });

  it("finds only OSCAL-namespaced control-origination props", () => {
    expect(findControlOriginationProp([localProp("inherited")])).toBeUndefined();
    expect(findControlOriginationProp([localProp("inherited"), oscalProp("system-specific")])?.value).toBe("system-specific");
  });

  it("resolves child values over parent values", () => {
    expect(resolveControlOrigination([oscalProp("organization")]).value).toBe("organization");
    expect(resolveControlOrigination([oscalProp("organization")], [oscalProp("inherited")])).toEqual({
      value: "inherited",
      source: "statement",
    });
    expect(resolveControlOrigination([oscalProp("organization")], [oscalProp("inherited")], [oscalProp("customer-provided")])).toEqual({
      value: "customer-provided",
      source: "by-component",
    });
  });

  it("rolls up a parent-only value", () => {
    const requirement: ControlOriginationRequirement = {
      controlId: "ac-1",
      props: [oscalProp("organization")],
      byComponents: [],
      statements: [],
    };

    expect(rollupControlOrigination(requirement)).toBe("organization");
  });

  it("rolls up mixed child values", () => {
    const requirement: ControlOriginationRequirement = {
      controlId: "ac-2",
      props: [oscalProp("organization")],
      byComponents: [{ componentUuid: "one", props: [oscalProp("system-specific")] }],
      statements: [{
        statementId: "ac-2_smt.a",
        props: [oscalProp("inherited")],
        byComponents: [{ componentUuid: "two", props: [] }],
      }],
    };

    expect(rollupControlOrigination(requirement)).toBe("mixed");
  });

  it("collects namespace and value issues", () => {
    const issues = collectControlOriginationIssues({
      controlImplementation: {
        implementedRequirements: [
          {
            controlId: "ac-3",
            props: [localProp("system-specific")],
            byComponents: [{ componentUuid: "cmp", props: [oscalProp("provider-owned")] }],
            statements: [],
          },
        ],
      },
    });

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ controlId: "ac-3", location: "implemented requirement", value: "system-specific" });
    expect(issues[0].message).toContain(OSCAL_NAMESPACE);
    expect(issues[1]).toMatchObject({ controlId: "ac-3", location: "by-component cmp", value: "provider-owned" });
  });
});
