import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen } from "@testing-library/react";

async function loadBanner() {
  // Reset modules so the module-level `injected` keyframe flag resets
  // between tests and we can assert both first-mount and subsequent-mount
  // behaviour.
  vi.resetModules();
  const mod = await import("./ImportResolverBanner");
  return mod.default;
}

function removeInjectedStyles() {
  document
    .querySelectorAll("style")
    .forEach((s) => {
      if (s.textContent?.includes("oscal-resolve-pulse")) s.remove();
    });
}

beforeEach(() => {
  removeInjectedStyles();
});

afterEach(() => {
  removeInjectedStyles();
});

describe("<ImportResolverBanner />", () => {
  it("renders null when status is idle", async () => {
    const Banner = await loadBanner();
    const { container } = render(
      <Banner modelLabel="Catalog" status="idle" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders loading copy and a spinner when status is loading", async () => {
    const Banner = await loadBanner();
    render(<Banner modelLabel="Catalog" status="loading" />);
    expect(screen.getByText(/Resolving Catalog/)).toBeInTheDocument();
    expect(
      screen.getByText(/Fetching and validating the referenced document/),
    ).toBeInTheDocument();
  });

  it("renders success copy when status is success", async () => {
    const Banner = await loadBanner();
    render(<Banner modelLabel="Profile" status="success" />);
    expect(screen.getByText(/Profile Loaded/)).toBeInTheDocument();
  });

  it("shows the resolvedLabel row when one is provided on success", async () => {
    const Banner = await loadBanner();
    render(
      <Banner
        modelLabel="Profile"
        status="success"
        resolvedLabel="NIST_SP-800-53_rev5_profile.json"
      />,
    );
    expect(
      screen.getByText("NIST_SP-800-53_rev5_profile.json"),
    ).toBeInTheDocument();
  });

  it("does not show a resolvedLabel row when none is provided", async () => {
    const Banner = await loadBanner();
    const { container } = render(
      <Banner modelLabel="Profile" status="success" />,
    );
    // No stray mono-family div past the header
    expect(container.querySelectorAll("div").length).toBeLessThan(6);
  });

  it("renders error copy when status is error", async () => {
    const Banner = await loadBanner();
    render(<Banner modelLabel="SSP" status="error" />);
    expect(screen.getByText(/SSP Resolution Failed/)).toBeInTheDocument();
  });

  it("renders the error message when provided", async () => {
    const Banner = await loadBanner();
    render(
      <Banner
        modelLabel="SSP"
        status="error"
        error="HTTP 500: Internal Error"
      />,
    );
    expect(screen.getByText("HTTP 500: Internal Error")).toBeInTheDocument();
  });

  it("does not render an error row when error is null and status is error", async () => {
    const Banner = await loadBanner();
    render(<Banner modelLabel="SSP" status="error" error={null} />);
    expect(
      screen.queryByText(/Internal Error/),
    ).not.toBeInTheDocument();
  });

  it("forwards a custom style prop to the wrapper", async () => {
    const Banner = await loadBanner();
    const { container } = render(
      <Banner
        modelLabel="Catalog"
        status="loading"
        style={{ marginTop: 99 }}
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.marginTop).toBe("99px");
  });

  it("injects the keyframes <style> tag once on first mount", async () => {
    const Banner = await loadBanner();
    render(<Banner modelLabel="Catalog" status="loading" />);
    const styles = Array.from(document.querySelectorAll("style")).filter((s) =>
      s.textContent?.includes("oscal-resolve-pulse"),
    );
    expect(styles.length).toBe(1);
  });

  it("does not re-inject keyframes on a subsequent mount within the same module load", async () => {
    const Banner = await loadBanner();
    render(<Banner modelLabel="A" status="loading" />);
    render(<Banner modelLabel="B" status="success" />);
    const styles = Array.from(document.querySelectorAll("style")).filter((s) =>
      s.textContent?.includes("oscal-resolve-pulse"),
    );
    // Still one total, not two
    expect(styles.length).toBe(1);
  });
});
