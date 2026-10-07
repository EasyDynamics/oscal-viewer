import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { OscalProvider, useOscal } from "../context/OscalContext";
import AssessmentResultsPage from "./AssessmentResultsPage";
import { XSS_PAYLOADS, expectNoActiveContent } from "../test/xss";

// An assessment result whose observation description carries script payloads
// next to ordinary markdown.
const results = {
  uuid: "6f0c3b8e-1d2a-4c5b-9e7f-8a9b0c1d2e3f",
  metadata: { title: "Sanitizer results", "last-modified": "2026-10-07T00:00:00Z", version: "1.0", "oscal-version": "1.1.2" },
  results: [
    {
      uuid: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
      title: "Monthly run",
      description: "Results of the monthly run.",
      start: "2026-10-01T00:00:00Z",
      "reviewed-controls": { "control-selections": [{ "include-all": {} }] },
      observations: [
        {
          uuid: "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9",
          title: "Crafted observation",
          description: [...XSS_PAYLOADS, "Ordinary **bold** text and `code`."].join("\n\n"),
          methods: ["TEST"],
          collected: "2026-10-01T00:00:00Z",
        },
      ],
    },
  ],
};

function LoadResults() {
  const oscal = useOscal();
  useEffect(() => { oscal.setAssessmentResults(results, "sanitizer-results.json"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

afterEach(() => vi.restoreAllMocks());

describe("AssessmentResultsPage observation description", () => {
  it("renders as sanitized markdown, not raw HTML", async () => {
    // jsdom has no scrollTo (navigation scrolls the content pane) or matchMedia (useIsMobile).
    Element.prototype.scrollTo = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    const { container } = render(
      <MemoryRouter initialEntries={["/assessment-results"]}>
        <AuthProvider>
          <OscalProvider>
            <LoadResults />
            <AssessmentResultsPage />
          </OscalProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    // Sidebar groups start collapsed; an observation without a control-group prop is "Uncategorized".
    fireEvent.click((await screen.findAllByText("Uncategorized"))[0]);
    fireEvent.click(screen.getAllByText("Crafted observation")[0]);
    expect(screen.getByRole("heading", { level: 1, name: "Crafted observation" })).toBeInTheDocument();

    expectNoActiveContent(container);
    const description = container.querySelector(".oscal-markup");
    expect(description?.querySelector("strong")?.textContent).toBe("bold");
    expect(description?.querySelector("code")?.textContent).toBe("code");
  });
});
