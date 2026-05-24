import { describe, it, expect } from "vitest";
import { alpha } from "./tokens";

describe("alpha()", () => {
  it("defaults to 5% opacity", () => {
    expect(alpha("var(--c)")).toBe(
      "color-mix(in srgb, var(--c) 5%, transparent)",
    );
  });

  it("respects a custom percentage", () => {
    expect(alpha("var(--c)", 40)).toBe(
      "color-mix(in srgb, var(--c) 40%, transparent)",
    );
  });
});
