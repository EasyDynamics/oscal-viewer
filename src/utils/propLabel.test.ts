import { describe, it, expect } from "vitest";
import oscalio from "../theme/themes/oscalio";
import easydynamics from "../theme/themes/easydynamics";
import type { ThemeColors } from "../theme/themeContract";
import { PROP_PALETTE, PROP_PALETTE_TOKENS, propColor, propColorIndex, propDescription, shortNamespace } from "./propLabel";

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("propColorIndex()", () => {
  it("is stable: the same name always gets the same colour", () => {
    expect(propColorIndex("label")).toBe(propColorIndex("label"));
    expect(propColor("implementation-status")).toBe(propColor("implementation-status"));
    // Pinned so a change to the hash (which would recolour every label) is deliberate.
    expect(["label", "sort-id", "status", "method", "asset-type", "poam-id"].map((n) => propColorIndex(n)))
      .toEqual([1, 5, 1, 4, 2, 0]);
  });

  it("stays in range and spreads common names across the palette", () => {
    const names = ["label", "sort-id", "status", "method", "asset-type", "poam-id", "control-origination", "implementation-status", "type", "version"];
    const indexes = names.map((n) => propColorIndex(n));
    for (const i of indexes) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(PROP_PALETTE.length);
    }
    expect(new Set(indexes).size).toBeGreaterThanOrEqual(4);
  });
});

describe("prop palette contrast", () => {
  const modes: [string, ThemeColors | undefined][] = [
    ["oscalio light", oscalio.colors], ["oscalio dark", oscalio.darkColors],
    ["easydynamics light", easydynamics.colors], ["easydynamics dark", easydynamics.darkColors],
  ];
  it.each(modes.filter(([, c]) => c))("every accent has at least 4.5:1 against card in %s", (_, themeColors) => {
    for (const token of PROP_PALETTE_TOKENS) {
      expect(contrast(themeColors![token], themeColors!.card), token).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("shortNamespace()", () => {
  it("gives no prefix for the NIST OSCAL namespace or none", () => {
    expect(shortNamespace(undefined)).toBeNull();
    expect(shortNamespace("")).toBeNull();
    expect(shortNamespace("http://csrc.nist.gov/ns/oscal")).toBeNull();
    expect(shortNamespace("http://csrc.nist.gov/ns/oscal/")).toBeNull();
  });

  it("shortens other namespaces to their organisation", () => {
    expect(shortNamespace("https://fedramp.gov/ns/oscal")).toBe("fedramp");
    expect(shortNamespace("https://www.cisa.gov/ns/oscal")).toBe("cisa");
    expect(shortNamespace("http://csrc.nist.gov/ns/rmf")).toBe("nist");
    expect(shortNamespace("http://oscal.io/ns")).toBe("oscal.io");
    expect(shortNamespace("urn:example:ns:custom")).toBe("custom");
  });
});

describe("propDescription()", () => {
  it("lists name and value, then ns and class when present", () => {
    expect(propDescription({ name: "label", value: "AC-1" })).toBe("name: label\nvalue: AC-1");
    expect(propDescription({ name: "control-origination", value: "sp-corporate", ns: "https://fedramp.gov/ns/oscal", class: "origin" }))
      .toBe("name: control-origination\nvalue: sp-corporate\nns: https://fedramp.gov/ns/oscal\nclass: origin");
  });

  it("writes non-string values as text", () => {
    expect(propDescription({ name: "n", value: 3 })).toBe("name: n\nvalue: 3");
  });
});
