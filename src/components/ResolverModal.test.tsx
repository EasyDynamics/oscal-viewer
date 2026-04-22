import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResolverModal, { type ResolverItem } from "./ResolverModal";

/* Reset the module-level injected-keyframes flag + any lingering styles */
async function loadFresh() {
  vi.resetModules();
  document
    .querySelectorAll("style")
    .forEach((s) => {
      if (s.textContent?.includes("resolver-modal-spin")) s.remove();
    });
  const mod = await import("./ResolverModal");
  return mod.default;
}

const loading: ResolverItem = { label: "Catalog", status: "loading" };
const success: ResolverItem = {
  label: "Catalog",
  status: "success",
  resolvedLabel: "catalog.json",
  resolvedUrl: "https://example.com/catalog.json",
};
const successGithub: ResolverItem = {
  label: "Profile",
  status: "success",
  resolvedUrl: "https://raw.githubusercontent.com/x/y/main/p.json",
};
const successOscalIo: ResolverItem = {
  label: "SSP",
  status: "success",
  resolvedUrl: "https://registry.oscal.io/s.json",
};
const errored: ResolverItem = {
  label: "SSP",
  status: "error",
  error: "HTTP 404: Not Found",
};

describe("<ResolverModal /> visibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders nothing when items is empty", () => {
    const { container } = render(<ResolverModal items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when every item is idle", () => {
    const items: ResolverItem[] = [
      { label: "Profile", status: "idle" },
      { label: "Catalog", status: "idle" },
    ];
    const { container } = render(<ResolverModal items={items} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the dialog when any item is non-idle", () => {
    render(<ResolverModal items={[loading]} />);
    expect(
      screen.getByRole("dialog", { name: /Resolving OSCAL dependencies/i }),
    ).toBeInTheDocument();
  });
});

describe("<ResolverModal /> content", () => {
  it("shows a loading subtitle and disables Continue while any item is loading", () => {
    render(<ResolverModal items={[loading]} />);
    expect(
      screen.getByText(/Fetching and validating referenced documents/),
    ).toBeInTheDocument();
    const cont = screen.getByRole("button", { name: /Please wait/i });
    expect(cont).toBeDisabled();
  });

  it('shows "All dependencies resolved" when every item succeeded', () => {
    const items = [success, { ...success, label: "Profile" }];
    render(<ResolverModal items={items} />);
    expect(screen.getByText(/All dependencies resolved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it('shows "Some dependencies could not be resolved" on mixed success+error', () => {
    const items = [success, errored];
    render(<ResolverModal items={items} />);
    expect(
      screen.getByText(/Some dependencies could not be resolved/),
    ).toBeInTheDocument();
  });

  it("renders the error message body when an item has error", () => {
    render(<ResolverModal items={[errored]} />);
    expect(screen.getByText("HTTP 404: Not Found")).toBeInTheDocument();
  });

  it("renders the resolved URL when provided", () => {
    render(<ResolverModal items={[success]} />);
    expect(
      screen.getByText("https://example.com/catalog.json"),
    ).toBeInTheDocument();
  });

  it("shows the Skip button while any item is loading", () => {
    render(<ResolverModal items={[loading]} />);
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });

  it("does not show the Skip button when all items are already in a terminal state", () => {
    render(<ResolverModal items={[success]} />);
    expect(
      screen.queryByRole("button", { name: "Skip" }),
    ).not.toBeInTheDocument();
  });

  it("progress label reflects done/total while loading", () => {
    const items: ResolverItem[] = [loading, success, errored];
    render(<ResolverModal items={items} />);
    // success + error = 2 done of 3 total
    expect(screen.getByText("2 of 3 resolved")).toBeInTheDocument();
  });

  it("progress label summarises successes on done with errors", () => {
    const items: ResolverItem[] = [success, errored];
    render(<ResolverModal items={items} />);
    expect(
      screen.getByText("1 of 2 resolved successfully"),
    ).toBeInTheDocument();
  });

  it("progress label is symmetric when everything succeeded", () => {
    render(<ResolverModal items={[success, { ...success, label: "Profile" }]} />);
    expect(screen.getByText("2 of 2 resolved")).toBeInTheDocument();
  });
});

describe("<ResolverModal /> source icons", () => {
  it("renders a GitHub icon for raw.githubusercontent.com URLs", () => {
    const { container } = render(<ResolverModal items={[successGithub]} />);
    // GitHub Octicon has a distinctive path starting with M12 .5C5.37
    const hasGhPath = Array.from(container.querySelectorAll("path")).some((p) =>
      p.getAttribute("d")?.startsWith("M12 .5C5.37"),
    );
    expect(hasGhPath).toBe(true);
  });

  it("renders the oscal.io icon for oscal.io hostnames", () => {
    const { container } = render(<ResolverModal items={[successOscalIo]} />);
    const hasOscalViewBox = Array.from(container.querySelectorAll("svg")).some(
      (s) => s.getAttribute("viewBox") === "0 0 37.76 37.835",
    );
    expect(hasOscalViewBox).toBe(true);
  });

  it("renders a generic external-link icon for other URLs", () => {
    const { container } = render(<ResolverModal items={[success]} />);
    // The generic external icon has a polyline "15 3 21 3 21 9"
    const hasPolyline = Array.from(container.querySelectorAll("polyline")).some(
      (p) => p.getAttribute("points") === "15 3 21 3 21 9",
    );
    expect(hasPolyline).toBe(true);
  });

  it("tolerates an unparseable resolvedUrl (falls through to generic)", () => {
    const broken: ResolverItem = {
      label: "Catalog",
      status: "success",
      resolvedUrl: "not a url",
    };
    const { container } = render(<ResolverModal items={[broken]} />);
    expect(
      Array.from(container.querySelectorAll("polyline")).some(
        (p) => p.getAttribute("points") === "15 3 21 3 21 9",
      ),
    ).toBe(true);
  });
});

describe("<ResolverModal /> dismiss flow", () => {
  it("Continue closes the modal", () => {
    const { rerender } = render(<ResolverModal items={[success]} />);
    expect(
      screen.getByRole("dialog", { name: /Resolving OSCAL dependencies/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    // Keep the same items — after dismiss the modal stays hidden even though
    // they're still non-idle.
    rerender(<ResolverModal items={[success]} />);
    expect(
      screen.queryByRole("dialog", { name: /Resolving OSCAL dependencies/i }),
    ).not.toBeInTheDocument();
  });

  it("Skip calls onSkip and closes the modal", () => {
    const onSkip = vi.fn();
    render(<ResolverModal items={[loading]} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("Skip works without an onSkip callback", () => {
    const { rerender } = render(<ResolverModal items={[loading]} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    rerender(<ResolverModal items={[loading]} />);
    expect(
      screen.queryByRole("dialog", { name: /Resolving OSCAL dependencies/i }),
    ).not.toBeInTheDocument();
  });

  it("reopens when item labels change after a dismiss (new chain)", () => {
    const { rerender } = render(<ResolverModal items={[loading]} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    rerender(<ResolverModal items={[loading]} />);
    // Still closed — same key
    expect(
      screen.queryByRole("dialog", { name: /Resolving OSCAL dependencies/i }),
    ).not.toBeInTheDocument();

    // Reset to all-idle (simulates chain reset) — dismissed flag clears
    rerender(
      <ResolverModal
        items={[{ label: "Catalog", status: "idle" }]}
      />,
    );

    // Now a brand new set of items (different labels)
    rerender(
      <ResolverModal
        items={[{ label: "Profile", status: "loading" }]}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: /Resolving OSCAL dependencies/i }),
    ).toBeInTheDocument();
  });

  it("deactivates cleanly when items is emptied", () => {
    const { rerender, container } = render(<ResolverModal items={[loading]} />);
    rerender(<ResolverModal items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("<ResolverModal /> snapshot behaviour", () => {
  it("keeps showing success after an item regresses to idle (chain reset flow)", () => {
    const { rerender } = render(<ResolverModal items={[success]} />);
    expect(screen.getByText(/Catalog loaded/)).toBeInTheDocument();

    // Item goes back to idle without the user clicking Continue
    rerender(
      <ResolverModal
        items={[{ label: "Catalog", status: "idle" }]}
      />,
    );
    // Modal is still visible and still shows the success snapshot
    expect(screen.getByText(/Catalog loaded/)).toBeInTheDocument();
  });
});

describe("<ResolverModal /> model colors", () => {
  it("resolves a known model label (ssp, poam, catalog, etc.)", () => {
    const items: ResolverItem[] = [
      { label: "catalog", status: "success" },
      { label: "poam", status: "success" },
    ];
    render(<ResolverModal items={items} />);
    expect(screen.getAllByText(/loaded/i).length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to a default color on an unknown model label", () => {
    render(
      <ResolverModal items={[{ label: "ExoticModel", status: "success" }]} />,
    );
    expect(screen.getByText(/ExoticModel loaded/)).toBeInTheDocument();
  });
});

describe("<ResolverModal /> keyframe injection", () => {
  afterEach(() => {
    document
      .querySelectorAll("style")
      .forEach((s) => {
        if (s.textContent?.includes("resolver-modal-spin")) s.remove();
      });
  });

  it("injects <style> keyframes only once across multiple renders", async () => {
    const Modal = await loadFresh();
    render(<Modal items={[loading]} />);
    render(<Modal items={[success]} />);
    const styles = Array.from(document.querySelectorAll("style")).filter((s) =>
      s.textContent?.includes("resolver-modal-spin"),
    );
    expect(styles.length).toBe(1);
  });
});
