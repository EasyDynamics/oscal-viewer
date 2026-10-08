import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { OscalProvider, useOscal, type Catalog } from "../context/OscalContext";
import ProfilePage from "./ProfilePage";
import catalogBasic from "../../samples/catalog-basic.json";
import profileBasic from "../../samples/profile-basic.json";

// SP 800-53 in miniature: AC-2 and three of its enhancements.
const miniCatalog = {
  uuid: "6a3b2c1d-0e9f-4a8b-b7c6-d5e4f3a2b1c0",
  metadata: { title: "Mini 800-53", "last-modified": "2026-10-07T00:00:00Z", version: "1", "oscal-version": "1.2.3" },
  groups: [
    {
      id: "ac",
      title: "Access Control",
      controls: [
        { id: "ac-1", title: "Policy and Procedures" },
        {
          id: "ac-2",
          title: "Account Management",
          controls: [
            { id: "ac-2.1", title: "Automated System Account Management" },
            { id: "ac-2.2", title: "Automated Temporary and Emergency Account Management" },
            { id: "ac-2.13", title: "Disable Accounts for High-risk Individuals" },
          ],
        },
      ],
    },
  ],
} as unknown as Catalog;

function miniProfile(includeControls: unknown[]) {
  return {
    uuid: "0d1c2b3a-4f5e-4d6c-8b7a-9e8f7a6b5c4d",
    metadata: { title: "Mini baseline", "last-modified": "2026-10-07T00:00:00Z", version: "1", "oscal-version": "1.2.3" },
    imports: [{ href: "mini-catalog.json", "include-controls": includeControls }],
  };
}

function LoadDocuments({ catalog, profile }: { catalog: Catalog; profile: unknown }) {
  const oscal = useOscal();
  useEffect(() => {
    oscal.setCatalog(catalog, "catalog.json");
    oscal.setProfile(profile, "profile.json");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function renderProfilePage(catalog: Catalog, profile: unknown) {
  // jsdom has no scrollTo (navigation scrolls the content pane) or matchMedia (useIsMobile).
  Element.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <AuthProvider>
        <OscalProvider>
          <LoadDocuments catalog={catalog} profile={profile} />
          <ProfilePage />
        </OscalProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

// An Overview stat card: the number sits just above its label.
const statValue = (label: string) =>
  screen.getAllByText(label, { selector: "div" }).find((el) => el.previousElementSibling)?.previousElementSibling?.textContent;

afterEach(() => vi.restoreAllMocks());

describe("ProfilePage control selection (issue #105)", () => {
  it("selects profile-basic's controls: a pattern and an id, minus an exclusion", async () => {
    renderProfilePage(catalogBasic.catalog as unknown as Catalog, profileBasic.profile);
    expect(await screen.findByText("Selected Controls")).toBeInTheDocument();
    expect(statValue("Selected Controls")).toBe("3");
    // Families are the catalog's top-level groups.
    expect(statValue("Control Families")).toBe("2");
    expect(screen.getByText("3 controls selected")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("S1 Organization of Information Security")[0]);
    expect(screen.getByRole("heading", { level: 1, name: "S1 Organization of Information Security" })).toBeInTheDocument();
    expect(screen.getAllByText("S1.1.1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("S1.1.2").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText("Imports")[0]);
    expect(screen.getByText("Selected Control IDs (3)")).toBeInTheDocument();
    expect(screen.getByText("Matching: s1.1.*; IDs: s2.1.1")).toBeInTheDocument();
    expect(screen.getByText("IDs: s2.1.2")).toBeInTheDocument();
    expect(screen.queryByText("S2.1.2")).not.toBeInTheDocument();
  });

  it("lists none of a control's enhancements when the profile selects none", async () => {
    renderProfilePage(miniCatalog, miniProfile([{ "with-ids": ["ac-1", "ac-2"] }]));
    fireEvent.click((await screen.findAllByText("AC Access Control"))[0]);
    fireEvent.click(screen.getAllByText("AC-2")[0]);
    expect(screen.getByRole("heading", { level: 1, name: "Account Management" })).toBeInTheDocument();
    expect(screen.queryByText(/Control Enhancements/)).not.toBeInTheDocument();
  });

  it("lists only the enhancements the profile selects", async () => {
    renderProfilePage(miniCatalog, miniProfile([{ "with-ids": ["ac-2", "ac-2.13"] }]));
    fireEvent.click((await screen.findAllByText("AC Access Control"))[0]);
    fireEvent.click(screen.getAllByText("AC-2")[0]);
    expect(screen.getByText("Control Enhancements (1)")).toBeInTheDocument();
    expect(screen.getByText("Disable Accounts for High-risk Individuals")).toBeInTheDocument();
    expect(screen.queryByText("Automated System Account Management")).not.toBeInTheDocument();
  });

  it("lists every enhancement with with-child-controls: yes", async () => {
    renderProfilePage(miniCatalog, miniProfile([{ "with-ids": ["ac-2"], "with-child-controls": "yes" }]));
    fireEvent.click((await screen.findAllByText("AC Access Control"))[0]);
    fireEvent.click(screen.getAllByText("AC-2")[0]);
    expect(screen.getByText("Control Enhancements (3)")).toBeInTheDocument();
  });
});
