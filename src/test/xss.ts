import { expect } from "vitest";

/** Script-injection payloads that every OSCAL markup renderer must neutralize. */
export const XSS_PAYLOADS = [
  'Hello <img src=x onerror="alert(1)">',
  "<script>alert(1)</script>",
  "[x](javascript:alert(1))",
  '<a href="JaVaScRiPt:alert(1)">mixed case</a>',
  '<a href="java&#x09;script:alert(1)">tab inside the scheme</a>',
  '<details open ontoggle="alert(1)"><summary>s</summary></details>',
  '<svg onload="alert(1)"><a xlink:href="javascript:alert(1)"><text>t</text></a></svg>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<object data="javascript:alert(1)"></object><embed src="javascript:alert(1)">',
];

/**
 * Fails if `root` holds a script element, an event-handler attribute or a
 * javascript: URL in any attribute.
 */
export function expectNoActiveContent(root: ParentNode) {
  expect(root.querySelector("script")).toBeNull();
  for (const el of root.querySelectorAll("*")) {
    for (const { name, value } of el.attributes) {
      const where = `<${el.localName} ${name}="${value}">`;
      expect(name, where).not.toMatch(/^on/i);
      // Browsers strip leading spaces and control characters from a URL, and
      // tabs and newlines anywhere in it; to be safe, ignore all of them.
      const compact = [...value].filter((c) => c > " ").join("");
      expect(compact, where).not.toMatch(/^javascript:/i);
    }
  }
}
