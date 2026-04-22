import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

/* Stub matchMedia since ThemeContext and useIsMobile both call it. */
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<App />", () => {
  it("mounts without crashing and renders the default route (HomePage)", () => {
    render(<App />);
    // HomePage renders this section heading
    expect(screen.getByText("OSCAL Models")).toBeInTheDocument();
  });

  it("wraps the tree in ThemeProvider (data-theme is applied to <html>)", () => {
    render(<App />);
    // applyTheme() runs on mount via ThemeProvider's effect
    expect(
      ["light", "dark"].includes(
        document.documentElement.getAttribute("data-theme") ?? "",
      ),
    ).toBe(true);
  });
});
