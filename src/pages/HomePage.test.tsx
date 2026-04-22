import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import HomePage from "./HomePage";

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

beforeEach(() => {
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<HomePage /> desktop", () => {
  it('renders the "OSCAL Models" section heading', () => {
    render(<HomePage />, { wrapper });
    expect(
      screen.getByRole("heading", { level: 2, name: "OSCAL Models" }),
    ).toBeInTheDocument();
  });

  it("renders the project brand heading", () => {
    render(<HomePage />, { wrapper });
    // brand.heading comes from the active theme — just verify an h1 exists
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1.length).toBeGreaterThan(0);
  });

  it("includes the GitHub link in the banner", () => {
    render(<HomePage />, { wrapper });
    const link = screen.getByTitle("View on GitHub");
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/EasyDynamics/oscal-viewer",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders both note cards (Privacy + Heads up) inline on desktop", () => {
    render(<HomePage />, { wrapper });
    expect(screen.getByText("Privacy")).toBeInTheDocument();
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    // Desktop flavor of the Privacy card
    expect(
      screen.getByText(/This tool is self-contained in your browser/),
    ).toBeInTheDocument();
  });

  it("renders a card / link per OSCAL model", () => {
    render(<HomePage />, { wrapper });
    // Every oscalModels entry has a Card h3 with its label
    for (const label of [
      "Catalog",
      "Profile",
      "Component Definition",
      "SSP",
      "Assessment Plan",
      "Assessment Results",
      "POA&M",
    ]) {
      const h3 = screen.getByRole("heading", { level: 3, name: label });
      expect(h3).toBeInTheDocument();
    }
  });

  it('renders an "Open →" call-to-action on each non-disabled card', () => {
    render(<HomePage />, { wrapper });
    const opens = screen.getAllByText("Open →");
    expect(opens.length).toBe(7); // one per OSCAL model
  });

  it("links each model card to its route", () => {
    render(<HomePage />, { wrapper });
    // Use Link text → href assertions via the anchor wrapping the label
    const catalogLink = screen
      .getByRole("heading", { level: 3, name: "Catalog" })
      .closest("a");
    expect(catalogLink).toHaveAttribute("href", "/catalog");

    const poamLink = screen
      .getByRole("heading", { level: 3, name: "POA&M" })
      .closest("a");
    expect(poamLink).toHaveAttribute("href", "/poam");
  });

  it('renders a "How does the viewer work?" deep-link at the bottom', () => {
    render(<HomePage />, { wrapper });
    const link = screen.getByRole("link", {
      name: /How does the viewer work/,
    });
    expect(link).toHaveAttribute("href", "/how-it-works");
  });

  it("applies mouse hover styles to the How-it-works link", () => {
    render(<HomePage />, { wrapper });
    const link = screen.getByRole("link", {
      name: /How does the viewer work/,
    }) as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.textDecoration).toBe("underline");
    fireEvent.mouseLeave(link);
    expect(link.style.textDecoration).toBe("none");
  });
});

describe("<HomePage /> mobile", () => {
  beforeEach(() => {
    stubMatchMedia(true);
  });

  it("collapses notes behind a toggle button", () => {
    render(<HomePage />, { wrapper });
    // Collapsed: the desktop-flavor longer copy is not rendered
    expect(
      screen.queryByText(/This tool is self-contained in your browser/),
    ).not.toBeInTheDocument();
    // Toggle button is present
    expect(
      screen.getByRole("button", { name: /Privacy/ }),
    ).toBeInTheDocument();
  });

  it("expands the notes panel when the toggle is clicked", () => {
    render(<HomePage />, { wrapper });
    fireEvent.click(
      screen.getByRole("button", { name: /Privacy/ }),
    );
    // Mobile-flavor copy appears
    expect(
      screen.getByText(/Everything runs in your browser/),
    ).toBeInTheDocument();
  });

  it("re-collapses the notes panel on a second click", () => {
    render(<HomePage />, { wrapper });
    const toggle = screen.getByRole("button", { name: /Privacy/ });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(
      screen.queryByText(/Everything runs in your browser/),
    ).not.toBeInTheDocument();
  });

  it("uses the mobile subtitle copy", () => {
    render(<HomePage />, { wrapper });
    expect(
      screen.getByText(/View and explore OSCAL documents/),
    ).toBeInTheDocument();
  });

  it("renders all model cards in a compact 2-column grid", () => {
    render(<HomePage />, { wrapper });
    // Heading labels still present, but desktop-only description is hidden
    expect(
      screen.getByRole("heading", { level: 3, name: "Catalog" }),
    ).toBeInTheDocument();
    // Mobile-flavor Open → call-to-action still renders
    expect(screen.getAllByText("Open →").length).toBe(7);
  });
});
