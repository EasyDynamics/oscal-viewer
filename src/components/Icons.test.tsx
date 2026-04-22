import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import * as Icons from "./Icons";

/**
 * Table-driven smoke test over every exported Icon. Each is a pure
 * SVG component — rendering it should produce an <svg> element with
 * the requested width/height.
 */
const ALL_ICON_NAMES = Object.keys(Icons).filter((k) => k.startsWith("Icon"));

describe("Icons.tsx — every exported icon renders", () => {
  it("has the expected set of exported icon names", () => {
    // Spot-check a handful of known ones; the full count is the main signal.
    expect(ALL_ICON_NAMES).toContain("IconShield");
    expect(ALL_ICON_NAMES).toContain("IconLock");
    expect(ALL_ICON_NAMES).toContain("IconGitHub");
    expect(ALL_ICON_NAMES.length).toBeGreaterThanOrEqual(30);
  });

  it.each(ALL_ICON_NAMES)("%s renders an <svg> with a square default size", (name) => {
    const Cmp = (Icons as unknown as Record<string, ComponentType>)[name];
    const { container } = render(<Cmp />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const w = svg?.getAttribute("width");
    const h = svg?.getAttribute("height");
    expect(w).toBe(h);
    expect(Number(w)).toBeGreaterThan(0);
  });

  it.each(ALL_ICON_NAMES)("%s respects a custom size prop", (name) => {
    const Cmp = (Icons as unknown as Record<string, ComponentType<{ size?: number }>>)[name];
    const { container } = render(<Cmp size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it.each(ALL_ICON_NAMES)("%s forwards an inline style prop", (name) => {
    const Cmp = (Icons as unknown as Record<string, ComponentType<{ style?: React.CSSProperties }>>)[name];
    const { container } = render(<Cmp style={{ color: "rgb(255, 0, 0)" }} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("style")).toMatch(/color/);
  });
});
