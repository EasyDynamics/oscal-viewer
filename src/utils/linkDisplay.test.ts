import { describe, it, expect } from "vitest";
import {
  catalogLinkDisplay,
  linkLabel,
  linkTooltip,
  resourceLinkLabel,
  resourceLinkTooltip,
  resourceName,
} from "./linkDisplay";

const resource = {
  title: "Standards for Security Categorization of Federal Information and Information Systems",
  citation: { text: "NIST (2004) FIPS 199." },
};

describe("resourceName()", () => {
  it("returns the title when present", () => {
    expect(resourceName(resource)).toBe(resource.title);
  });

  it("falls back to the citation text", () => {
    expect(resourceName({ citation: resource.citation })).toBe("NIST (2004) FIPS 199.");
  });

  it("treats empty strings as missing", () => {
    expect(resourceName({ title: "", citation: { text: "" } })).toBeUndefined();
  });

  it("returns undefined for an unresolved resource", () => {
    expect(resourceName(undefined)).toBeUndefined();
  });
});

describe("linkLabel()", () => {
  it("prefers the link's own text over the target name (control link)", () => {
    expect(linkLabel({ text: "Account Management" }, "AC-2", "AC-2")).toBe("Account Management");
  });

  it("falls back to the target name, then the fallback", () => {
    expect(linkLabel({}, "AC-2", "#ac-2")).toBe("AC-2");
    expect(linkLabel({ text: "" }, undefined, "https://example.com")).toBe("https://example.com");
  });
});

describe("linkTooltip()", () => {
  it("returns the target name when the label shows the link text", () => {
    expect(linkTooltip({ text: "Account Management" }, "AC-2")).toBe("AC-2");
  });

  it("returns undefined when there is no link text or no target name", () => {
    expect(linkTooltip({}, "AC-2")).toBeUndefined();
    expect(linkTooltip({ text: "SP 800-12" }, undefined)).toBeUndefined();
  });
});

describe("catalogLinkDisplay()", () => {
  const resources = { "res-1": resource, "res-2": {} };

  it("labels a control link with its text and puts the control ID in the tooltip", () => {
    expect(catalogLinkDisplay({ href: "#ac-2", text: "Account Management" }, resources))
      .toEqual({ label: "Account Management", tooltip: "AC-2" });
  });

  it("labels a control link without text by its upper-cased ID", () => {
    expect(catalogLinkDisplay({ href: "#ac-2" }, resources)).toEqual({ label: "AC-2", tooltip: undefined });
  });

  it("labels a resource link with its text and puts the resource title in the tooltip", () => {
    expect(catalogLinkDisplay({ href: "#res-1", text: "FIPS 199" }, resources))
      .toEqual({ label: "FIPS 199", tooltip: resource.title });
  });

  it("labels a resource link without text by the resource title", () => {
    expect(catalogLinkDisplay({ href: "#res-1" }, resources)).toEqual({ label: resource.title, tooltip: undefined });
  });

  it("falls back to the uuid for a resource with no title or citation", () => {
    expect(catalogLinkDisplay({ href: "#res-2" }, resources)).toEqual({ label: "res-2", tooltip: undefined });
  });

  it("labels an external link with its text, else its href", () => {
    expect(catalogLinkDisplay({ href: "https://example.com", text: "Example" }, resources))
      .toEqual({ label: "Example", tooltip: undefined });
    expect(catalogLinkDisplay({ href: "https://example.com" }, resources))
      .toEqual({ label: "https://example.com", tooltip: undefined });
  });

  it("does not treat inherited object keys as resources", () => {
    expect(catalogLinkDisplay({ href: "#constructor" }, resources).label).toBe("CONSTRUCTOR");
  });
});

describe("resourceLinkLabel()", () => {
  it("prefers the link's own text over the resource title", () => {
    expect(resourceLinkLabel({ text: "FIPS 199" }, resource, "Untitled")).toBe("FIPS 199");
  });

  it("falls back to the resource title when the link has no text", () => {
    expect(resourceLinkLabel({}, resource, "Untitled")).toBe(resource.title);
  });

  it("treats empty link text as missing", () => {
    expect(resourceLinkLabel({ text: "" }, resource, "Untitled")).toBe(resource.title);
  });

  it("falls back to the citation text when there is no title", () => {
    expect(resourceLinkLabel({}, { citation: resource.citation }, "Untitled")).toBe("NIST (2004) FIPS 199.");
  });

  it("uses the fallback when nothing else is available", () => {
    expect(resourceLinkLabel({}, {}, "abc-uuid")).toBe("abc-uuid");
  });

  it("uses the link text, then the fallback, when the resource does not resolve", () => {
    expect(resourceLinkLabel({ text: "Evidence" }, undefined, "#missing")).toBe("Evidence");
    expect(resourceLinkLabel({}, undefined, "#missing")).toBe("#missing");
  });
});

describe("resourceLinkTooltip()", () => {
  it("returns the resource title when the label shows the link text", () => {
    expect(resourceLinkTooltip({ text: "FIPS 199" }, resource)).toBe(resource.title);
  });

  it("returns the citation text when the resource has no title", () => {
    expect(resourceLinkTooltip({ text: "FIPS 199" }, { citation: resource.citation })).toBe("NIST (2004) FIPS 199.");
  });

  it("returns undefined when the link has no text (label is already the title)", () => {
    expect(resourceLinkTooltip({}, resource)).toBeUndefined();
  });

  it("returns undefined when the link text equals the resource title", () => {
    expect(resourceLinkTooltip({ text: resource.title }, resource)).toBeUndefined();
  });

  it("returns undefined when the resource has no name", () => {
    expect(resourceLinkTooltip({ text: "FIPS 199" }, {})).toBeUndefined();
  });
});
