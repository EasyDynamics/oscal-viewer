import { describe, it, expect } from "vitest";
import { resourceLinkLabel, resourceLinkTooltip } from "./linkDisplay";

const resource = {
  title: "Standards for Security Categorization of Federal Information and Information Systems",
  citation: { text: "NIST (2004) FIPS 199." },
};

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
