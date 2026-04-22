import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme, buildCssVarColors } from "./applyTheme";

describe("applyTheme()", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
    document.head.innerHTML = "";
  });

  it("sets data-theme on <html> for light mode", () => {
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("sets data-theme on <html> for dark mode", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("writes --color-* custom properties to the root element", () => {
    applyTheme("light");
    const style = document.documentElement.style;
    const hasColorVar = Array.from(style).some((k) => k.startsWith("--color-"));
    expect(hasColorVar).toBe(true);
  });

  it("ensures a favicon <link rel='icon'> is present after applying", () => {
    applyTheme("light");
    expect(document.querySelector("link[rel='icon']")).not.toBeNull();
  });
});

describe("buildCssVarColors()", () => {
  it("maps every token key to a var(--color-*) reference", () => {
    const map = buildCssVarColors();
    for (const value of Object.values(map)) {
      expect(value).toMatch(/^var\(--color-[a-z0-9-]+\)$/);
    }
  });

  it("includes at least one well-known token", () => {
    const map = buildCssVarColors() as Record<string, string>;
    expect(map.navy).toMatch(/^var\(--color-navy\)$/);
  });
});
