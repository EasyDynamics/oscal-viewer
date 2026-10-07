import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { OscalProvider, useOscal, type Catalog } from "../context/OscalContext";
import AssessmentPlanPage from "./AssessmentPlanPage";

const plan = {
  "assessment-plan": {
    uuid: "7d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6",
    metadata: { title: "Access control plan", "last-modified": "2026-10-07T00:00:00Z", version: "1.0", "oscal-version": "1.1.2" },
    "local-definitions": {
      activities: [{
        uuid: "9e8d7c6b-5a49-4382-9716-05f4e3d2c1b0",
        title: "Review the access control policy",
        description: "Interview the policy owner.",
        "related-controls": { "control-selections": [{ "include-controls": [{ "control-id": "ac-1" }] }] },
      }],
    },
  },
};

const catalog = {
  uuid: "3c2b1a09-8f7e-4d6c-b5a4-938271605f4e",
  metadata: { title: "Access catalog", "last-modified": "2026-10-07T00:00:00Z", version: "1.0", "oscal-version": "1.1.2" },
  groups: [{
    id: "ac",
    title: "Access Control",
    controls: [{
      id: "ac-1",
      title: "Policy and Procedures",
      params: [{ id: "ac-1_prm_1", label: "organization-defined personnel" }],
      parts: [{ id: "ac-1_smt", name: "statement", prose: "Disseminate the policy to {{ insert: param, ac-1_prm_1 }}." }],
    }],
  }],
} as unknown as Catalog;

// A catalog that lacks ac-1, e.g. after the user loads a different one.
const otherCatalog = { ...catalog, groups: [] } as unknown as Catalog;

function LoadDocs() {
  const oscal = useOscal();
  useEffect(() => {
    oscal.setAssessmentPlan(plan, "plan.json");
    oscal.setCatalog(catalog, "catalog.json");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <button onClick={() => oscal.setCatalog(otherCatalog, "other.json")}>Load other catalog</button>;
}

afterEach(() => vi.restoreAllMocks());

describe("AssessmentPlanPage control details", () => {
  it("keeps working when the loaded catalog stops containing the control", async () => {
    // jsdom has no scrollTo (navigation scrolls the content pane) or matchMedia (useIsMobile).
    Element.prototype.scrollTo = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    render(
      <MemoryRouter initialEntries={["/assessment-plan"]}>
        <AuthProvider>
          <OscalProvider>
            <LoadDocs />
            <AssessmentPlanPage />
          </OscalProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Controls \(1\)/ }));
    // Expand the control entry, then its catalog panel.
    fireEvent.click(screen.getByText("Policy and Procedures"));
    fireEvent.click(screen.getAllByText("Policy and Procedures")[1]);
    expect(screen.getByText("Disseminate the policy to [Assignment: organization-defined personnel].")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Load other catalog" }));
    expect(screen.getByText(/not found in loaded catalog/)).toBeInTheDocument();
  });
});
