import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { OscalProvider, useOscal, type Catalog } from "../context/OscalContext";
import CatalogPage from "./CatalogPage";

// The catalog from issue #100: groups with and without ids, nested two deep.
const catalog = {
  uuid: "2b7e4c1a-9d3f-4e8b-a6c5-0f1e2d3c4b5a",
  metadata: { title: "Group id repro catalog", "last-modified": "2026-09-30T00:00:00Z", version: "1.0", "oscal-version": "1.2.3" },
  groups: [
    {
      title: "Organizational Controls (no id)",
      groups: [
        {
          title: "Information Security Policies (no id)",
          groups: [{ title: "Policy Review (no id)", controls: [{ id: "org-2", title: "Review of Policies" }] }],
          controls: [{ id: "org-1", title: "Policies for Information Security" }],
        },
      ],
    },
    { id: "ac", title: "Access Control (has an id)", controls: [{ id: "ac-1", title: "Policy and Procedures" }] },
    { title: "Technological Controls (no id)", controls: [{ id: "tech-1", title: "User Endpoint Devices" }] },
  ],
} as unknown as Catalog;

function LoadCatalog() {
  const oscal = useOscal();
  useEffect(() => { oscal.setCatalog(catalog, "repro-group-no-id.json"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function renderCatalogPage({ mobile }: { mobile: boolean }) {
  // jsdom has no scrollTo (navigation scrolls the content pane) or matchMedia (useIsMobile).
  Element.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  return render(
    <MemoryRouter initialEntries={["/catalog"]}>
      <AuthProvider>
        <OscalProvider>
          <LoadCatalog />
          <CatalogPage />
        </OscalProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const heading = (name: string) => screen.getByRole("heading", { level: 1, name });

afterEach(() => vi.restoreAllMocks());

describe("CatalogPage groups without an id (issue #100)", () => {
  it("opens a group without an id from the sidebar, and expands only that group", async () => {
    renderCatalogPage({ mobile: false });
    fireEvent.click((await screen.findAllByText("Organizational Controls (no id)"))[0]);

    expect(heading("Organizational Controls (no id)")).toBeInTheDocument();
    expect(screen.queryByText("View not found")).not.toBeInTheDocument();
    // Its sub-group is now listed, but the other group without an id stays collapsed.
    expect(screen.getAllByText("Information Security Policies (no id)").length).toBeGreaterThan(0);
    expect(screen.queryByText("User Endpoint Devices")).not.toBeInTheDocument();
  });

  it("opens nested groups, and the control breadcrumb leads back to its group", async () => {
    renderCatalogPage({ mobile: false });
    fireEvent.click((await screen.findAllByText("Organizational Controls (no id)"))[0]);
    fireEvent.click(screen.getAllByText("Information Security Policies (no id)")[0]);
    expect(heading("Information Security Policies (no id)")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Policy Review (no id)")[0]);
    expect(heading("Policy Review (no id)")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Review of Policies")[0]);
    expect(heading("Review of Policies")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Policy Review (no id)")[0]);
    expect(heading("Policy Review (no id)")).toBeInTheDocument();
    expect(screen.queryByText("View not found")).not.toBeInTheDocument();
  });

  it("shows Family ID only for a group that has an id", async () => {
    renderCatalogPage({ mobile: false });
    fireEvent.click((await screen.findAllByText("Technological Controls (no id)"))[0]);
    expect(heading("Technological Controls (no id)")).toBeInTheDocument();
    expect(screen.queryByText("Family ID")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Access Control (has an id)")[0]);
    expect(heading("Access Control (has an id)")).toBeInTheDocument();
    expect(screen.getByText("Family ID")).toBeInTheDocument();
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("drills into a group without an id on mobile", async () => {
    renderCatalogPage({ mobile: true });
    fireEvent.click(await screen.findByText("Organizational Controls (no id)"));

    expect(screen.queryByText("No items at this level")).not.toBeInTheDocument();
    expect(screen.queryByText(/group-undefined/)).not.toBeInTheDocument();
    expect(screen.getByText("Information Security Policies (no id)")).toBeInTheDocument();
    expect(screen.getByText(/^Organizational Controls \(no id\) .*Overview$/)).toBeInTheDocument();
  });
});
