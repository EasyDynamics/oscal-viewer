import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen } from "@testing-library/react";
import HowItWorksPage from "./HowItWorksPage";

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<HowItWorksPage />", () => {
  it("renders the main page heading", () => {
    render(<HowItWorksPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /How the Viewer Works/,
      }),
    ).toBeInTheDocument();
  });

  it("renders the Catalog-as-source-of-truth section", () => {
    render(<HowItWorksPage />);
    expect(
      screen.getByText(/The Catalog is the Source of Truth/),
    ).toBeInTheDocument();
  });

  it("mentions every OSCAL model in the resolution walk-through", () => {
    render(<HowItWorksPage />);
    const body = document.body.textContent ?? "";
    for (const model of [
      "Catalog",
      "Profile",
      "Component Definition",
      "SSP",
      "Assessment Plan",
      "Assessment Results",
      "POA&M",
    ]) {
      expect(body).toContain(model);
    }
  });

  it("uses compact mobile-style header sizing when isMobile is true", () => {
    stubMatchMedia(true);
    render(<HowItWorksPage />);
    const h1 = screen.getByRole("heading", {
      level: 1,
      name: /How the Viewer Works/,
    });
    // Mobile h1 font-size is 22, desktop is 28
    expect(h1.style.fontSize).toBe("22px");
  });

  it("uses full-size header when isMobile is false", () => {
    stubMatchMedia(false);
    render(<HowItWorksPage />);
    const h1 = screen.getByRole("heading", {
      level: 1,
      name: /How the Viewer Works/,
    });
    expect(h1.style.fontSize).toBe("28px");
  });

  it("renders inline SVG icons alongside section headers", () => {
    const { container } = render(<HowItWorksPage />);
    const svgs = container.querySelectorAll("svg");
    // The page defines 8 inline icons and uses several of them
    expect(svgs.length).toBeGreaterThan(5);
  });
});
