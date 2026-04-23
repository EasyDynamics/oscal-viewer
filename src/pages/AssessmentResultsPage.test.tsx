/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEffect, useRef } from "react";
import AssessmentResultsPage from "./AssessmentResultsPage";
import {
  OscalProvider,
  useOscal,
  type Catalog,
} from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   Fixtures
   ═══════════════════════════════════════════════════════════════════════════ */

const CATALOG: Catalog = {
  uuid: "cat-1",
  metadata: { title: "Sample Catalog" },
  groups: [
    {
      id: "ac",
      title: "Access Control",
      controls: [
        {
          id: "ac-1",
          title: "Policy and Procedures",
          props: [{ name: "label", value: "AC-1" }],
          parts: [
            { id: "ac-1-stmt", name: "statement", prose: "AC-1 body." },
          ],
        },
      ],
    },
  ],
};

const RICH_AR = {
  uuid: "ar-1",
  metadata: {
    title: "Sample Assessment Results",
    version: "1.0",
    "last-modified": "2026-03-01T00:00:00Z",
    published: "2026-02-15T00:00:00Z",
    "oscal-version": "1.1.2",
    parties: [
      { uuid: "party-1", type: "organization", name: "Acme Assessors" },
    ],
    roles: [{ id: "assessor", title: "Lead Assessor" }],
  },
  "import-ap": { href: "#ap-res" },
  results: [
    {
      uuid: "result-1",
      title: "Q1 Continuous Monitoring Result",
      description: "Results of the Q1 assessment activities.",
      start: "2026-03-01T00:00:00Z",
      end: "2026-03-05T00:00:00Z",
      "reviewed-controls": {
        "control-selections": [{ "with-ids": ["ac-1"] }],
      },
      observations: [
        {
          uuid: "obs-1",
          title: "Password Length Below Standard",
          description: "Minimum length is 8 characters.",
          methods: ["EXAMINE"],
          collected: "2026-03-02T00:00:00Z",
          props: [
            { name: "control-group", value: "AC" },
            { name: "result", value: "fail" },
          ],
          subjects: [
            {
              "subject-uuid": "subj-1",
              type: "component",
            },
          ],
        },
        {
          uuid: "obs-2",
          title: "Encryption at Rest Enabled",
          description: "AES-256 verified on all volumes.",
          methods: ["TEST"],
          props: [
            { name: "control-group", value: "SC" },
            { name: "result", value: "pass" },
          ],
        },
      ],
      risks: [
        {
          uuid: "risk-1",
          title: "Weak Credential Policy Risk",
          description: "Current policy allows short passwords.",
          statement: "Risk from weak passwords.",
          status: "open",
          props: [
            { name: "level", value: "moderate" },
          ],
          "related-observations": [{ "observation-uuid": "obs-1" }],
          "mitigating-factors": [
            {
              uuid: "mf-1",
              description: "Compensating controls limit blast radius.",
            },
          ],
          remediations: [
            {
              uuid: "rem-1",
              lifecycle: "planned",
              title: "Strengthen password policy",
              description: "Update policy to 12+ chars.",
              remarks: "Scheduled for Q2.",
              tasks: [
                {
                  uuid: "task-1",
                  title: "Draft policy update",
                  type: "action",
                },
              ],
            },
            {
              uuid: "rem-2",
              lifecycle: "completed",
              title: "Enable MFA",
              description: "Rolled out for all users.",
            },
            {
              uuid: "rem-3",
              lifecycle: "recommendation",
              title: "Train staff",
              description: "Awareness campaign.",
            },
          ],
        },
        {
          uuid: "risk-2",
          title: "Encryption Key Rotation Gap",
          description: "Keys not rotated on schedule.",
          status: "investigating",
          props: [{ name: "level", value: "high" }],
        },
      ],
      findings: [
        {
          uuid: "find-1",
          title: "AC-1 Password Policy Non-Compliance",
          description: "Policy fails AC-1 requirements.",
          target: {
            type: "objective-id",
            "target-id": "ac-1",
            status: { state: "not-satisfied" },
          },
          "related-observations": [{ "observation-uuid": "obs-1" }],
          "related-risks": [{ "risk-uuid": "risk-1" }],
        },
        {
          uuid: "find-2",
          title: "Encryption Controls Verified",
          description: "SC-28 fully implemented.",
          target: {
            type: "objective-id",
            "target-id": "sc-28",
            status: { state: "satisfied" },
          },
          "related-observations": [{ "observation-uuid": "obs-2" }],
        },
      ],
      "assessment-log": {
        entries: [
          {
            uuid: "log-1",
            title: "Assessment kickoff",
            start: "2026-03-01T00:00:00Z",
            description: "Opening meeting.",
          },
        ],
      },
    },
  ],
  "back-matter": {
    resources: [
      {
        uuid: "ap-res",
        title: "Source Assessment Plan",
        rlinks: [
          { href: "https://example.com/ap.json", "media-type": "application/json" },
        ],
      },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Harness
   ═══════════════════════════════════════════════════════════════════════════ */

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function Seed({
  ar = RICH_AR,
  catalog = CATALOG,
  withCatalog = true,
}: {
  ar?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  const { setAssessmentResults, setCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setAssessmentResults(ar, "ar.json");
      if (withCatalog) setCatalog(catalog, "cat.json");
    }
  }, [ar, catalog, setAssessmentResults, setCatalog, withCatalog]);
  return null;
}

function Harness({
  preload = true,
  mobile = false,
  initialPath = "/assessment-results",
  ar = RICH_AR,
  catalog = CATALOG,
  withCatalog = true,
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  ar?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  stubMatchMedia(mobile);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && <Seed ar={ar} catalog={catalog} withCatalog={withCatalog} />}
          <AssessmentResultsPage />
        </OscalProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function renderLoaded(
  props: Parameters<typeof Harness>[0] = {},
) {
  const utils = render(<Harness preload {...props} />);
  await waitFor(() => {
    expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0);
  });
  return utils;
}

function fireDrop(zone: Element, file: File) {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

function arFile(
  data: object = { "assessment-results": RICH_AR },
  name = "ar.json",
) {
  return new File([JSON.stringify(data)], name, { type: "application/json" });
}

beforeEach(() => {
  stubMatchMedia(false);
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ═══════════════════════════════════════════════════════════════════════════
   Empty state
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentResultsPage /> empty state", () => {
  it("renders the DropZone when no AR is loaded", () => {
    render(<Harness preload={false} />);
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("disables the URL Fetch button until a URL is entered", () => {
    render(<Harness preload={false} />);
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(url, { target: { value: "https://ex.com/ar.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("loads a dropped AR and shifts to the viewer shell", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, arFile());
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/Sample Assessment Results/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("rejects JSON missing metadata", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File(
        [JSON.stringify({ "assessment-results": { uuid: "x", results: [] } })],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText(/no metadata/)).toBeInTheDocument(),
    );
  });

  it("rejects JSON missing results array", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File(
        [
          JSON.stringify({
            "assessment-results": {
              uuid: "x",
              metadata: { title: "t" },
            },
          }),
        ],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText(/no results array/)).toBeInTheDocument(),
    );
  });

  it("surfaces a JSON parse error for non-JSON input", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File(["garbage"], "x.json", { type: "application/json" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/JSON/)).toBeInTheDocument(),
    );
  });

  it("accepts an unwrapped AR payload", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, arFile(RICH_AR));
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
  });

  it("auto-loads from ?url= (mocked fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ "assessment-results": RICH_AR }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    render(
      <Harness
        preload={false}
        initialPath="/assessment-results?url=https://ex.com/ar.json"
      />,
    );
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
  });

  it("surfaces HTTP errors from failed auto-load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("nope", { status: 500, statusText: "Internal Error" }),
      ),
    );
    render(
      <Harness
        preload={false}
        initialPath="/assessment-results?url=https://ex.com/bad.json"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument(),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — desktop
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentResultsPage /> loaded — desktop", () => {
  it("renders top bar, sidebar, and overview content", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Sample Assessment Results/).length,
    ).toBeGreaterThan(0);
  });

  it("New File resets to the DropZone", async () => {
    await renderLoaded();
    fireEvent.click(
      screen.getAllByRole("button", { name: /New File/i })[0],
    );
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("navigates to the Metadata view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText("Metadata")[0]);
    expect(screen.getAllByText(/Acme Assessors/).length).toBeGreaterThan(0);
  });

  it("navigates to the Findings list view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Findings \(\d+\)/i)[0]);
    expect(
      screen.getAllByText(/AC-1 Password Policy Non-Compliance/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to a specific Finding detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Findings \(\d+\)/i)[0]);
    fireEvent.click(
      screen.getAllByText(/AC-1 Password Policy Non-Compliance/)[0],
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/Policy fails AC-1 requirements/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to the Risks list view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Risks \(\d+\)/i)[0]);
    expect(
      screen.getAllByText(/Weak Credential Policy Risk/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to a specific Risk detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Risks \(\d+\)/i)[0]);
    fireEvent.click(
      screen.getAllByText(/Weak Credential Policy Risk/)[0],
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/Current policy allows short passwords/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to a Result view (only shown when there are 2+ results)", async () => {
    // Single-result ARs show the group tree directly; the Result row only
    // appears when ar.results.length >= 2. Use a two-result fixture.
    const multi = {
      ...RICH_AR,
      results: [
        RICH_AR.results[0],
        {
          uuid: "result-2",
          title: "Q2 Quick Check",
          start: "2026-06-01T00:00:00Z",
          observations: [],
          risks: [],
          findings: [],
        },
      ],
    };
    await renderLoaded({ ar: multi });
    // Click a result row in the sidebar (title is truncated at 30 chars)
    fireEvent.click(screen.getAllByText(/Q2 Quick Check/)[0]);
    // ResultView shows its description / title — title renders unabbreviated
    // inside the content panel
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Q2 Quick Check/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to a control-group view (AC)", async () => {
    await renderLoaded();
    // Groups appear in the sidebar under the result; click AC
    const ac = screen.getAllByText(/^AC$/);
    expect(ac.length).toBeGreaterThan(0);
    fireEvent.click(ac[0]);
    // GroupView lists the observation titles
    await waitFor(() =>
      expect(
        screen.getAllByText(/Password Length Below Standard/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to an Observation detail via group view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/^AC$/)[0]);
    fireEvent.click(
      screen.getAllByText(/Password Length Below Standard/)[0],
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/Minimum length is 8 characters/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("round-trips back to Overview via sidebar", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText("Metadata")[0]);
    fireEvent.click(screen.getAllByText("Overview")[0]);
    expect(
      screen.getAllByText(/Sample Assessment Results/).length,
    ).toBeGreaterThan(0);
  });

  it("renders risk detail with mitigating factors and remediations", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Risks \(\d+\)/i)[0]);
    fireEvent.click(screen.getAllByText(/Weak Credential Policy Risk/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Compensating controls limit blast radius/).length,
      ).toBeGreaterThan(0),
    );
    // Remediation lifecycle variants all render
    expect(screen.getAllByText(/Strengthen password policy/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Enable MFA/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Train staff/).length).toBeGreaterThan(0);
  });

  it("renders a remediation task inside a remediation", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Risks \(\d+\)/i)[0]);
    fireEvent.click(screen.getAllByText(/Weak Credential Policy Risk/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Draft policy update/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders a high-severity risk in the risks list", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Risks \(\d+\)/i)[0]);
    expect(
      screen.getAllByText(/Encryption Key Rotation Gap/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a satisfied finding alongside a non-satisfied one", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Findings \(\d+\)/i)[0]);
    expect(
      screen.getAllByText(/Encryption Controls Verified/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/AC-1 Password Policy Non-Compliance/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to the satisfied finding's detail view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Findings \(\d+\)/i)[0]);
    fireEvent.click(screen.getAllByText(/Encryption Controls Verified/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/SC-28 fully implemented/).length,
      ).toBeGreaterThan(0),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentResultsPage /> edge cases", () => {
  it("renders overview without a loaded catalog", async () => {
    await renderLoaded({ withCatalog: false });
    expect(
      screen.getAllByText(/Sample Assessment Results/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a minimal AR (metadata + single empty result)", async () => {
    const minimal = {
      uuid: "m",
      metadata: { title: "Minimal AR" },
      results: [
        { uuid: "r-0", title: "Empty Result", start: "2026-01-01" },
      ],
    };
    await renderLoaded({ ar: minimal });
    expect(screen.getAllByText(/Minimal AR/).length).toBeGreaterThan(0);
  });

  it("renders multi-result AR with distinct result entries", async () => {
    const multi = {
      ...RICH_AR,
      results: [
        RICH_AR.results[0],
        {
          uuid: "result-2",
          title: "Q2 Result",
          start: "2026-06-01T00:00:00Z",
          observations: [],
          risks: [],
          findings: [],
        },
      ],
    };
    await renderLoaded({ ar: multi });
    expect(
      screen.getAllByText(/Q1 Continuous Monitoring Result/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Q2 Result/).length).toBeGreaterThan(0);
  });

  it("handles an observation without control-group prop (Uncategorized)", async () => {
    const uncategorised = {
      ...RICH_AR,
      results: [
        {
          ...RICH_AR.results[0],
          observations: [
            {
              uuid: "obs-u",
              title: "Uncategorised observation",
              description: "no control-group prop",
              methods: ["EXAMINE"],
            },
          ],
        },
      ],
    };
    await renderLoaded({ ar: uncategorised });
    // Group "Uncategorized" appears in the sidebar
    expect(
      screen.getAllByText(/Uncategorized/).length,
    ).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentResultsPage /> loaded — mobile", () => {
  it("renders the mobile shell with navigable entries", async () => {
    await renderLoaded({ mobile: true });
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
  });

  it("drills into a group on mobile", async () => {
    await renderLoaded({ mobile: true });
    // Single-result AR renders group tree directly — drill into AC
    fireEvent.click(screen.getAllByText(/^AC$/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Password Length Below Standard/).length,
      ).toBeGreaterThan(0),
    );
  });
});
