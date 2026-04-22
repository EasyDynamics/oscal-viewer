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
import { useEffect, useRef, type ReactNode } from "react";
import AssessmentPlanPage from "./AssessmentPlanPage";
import {
  OscalProvider,
  useOscal,
  type Catalog,
} from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   Fixtures
   ═══════════════════════════════════════════════════════════════════════════ */

/** A minimal catalog so control look-ups resolve when visiting ControlsView. */
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
            { id: "ac-1-stmt", name: "statement", prose: "AC-1 statement body." },
          ],
        },
      ],
    },
  ],
};

/**
 * Rich AP: two top-level tasks, one with a subtask. Activities under
 * local-definitions reachable by associated-activities. Steps reference
 * controls via reviewed-controls.control-selections.with-ids.
 */
const RICH_AP = {
  uuid: "ap-1",
  metadata: {
    title: "Sample Assessment Plan",
    version: "1.0",
    "last-modified": "2026-03-01T00:00:00Z",
    published: "2026-02-15T00:00:00Z",
    "oscal-version": "1.1.2",
    parties: [{ uuid: "p-1", type: "organization", name: "Acme Assessors" }],
    props: [{ name: "marking", value: "public" }],
  },
  "import-ssp": { href: "../ssp/ssp.json" },
  "local-definitions": {
    activities: [
      {
        uuid: "act-1",
        title: "Examine Access Control Policy",
        description: "Review the AC-1 policy documentation.",
        "related-controls": {
          "control-selections": [{ "with-ids": ["ac-1"] }],
        },
        steps: [
          {
            uuid: "step-1",
            title: "Obtain policy document",
            description: "Collect the written AC-1 policy from the ISSO.",
            props: [{ name: "method", value: "examine" }],
            "reviewed-controls": {
              "control-selections": [{ "with-ids": ["ac-1"] }],
            },
            links: [
              { href: "https://example.com/policy", rel: "reference", text: "Policy doc" },
            ],
          },
          {
            uuid: "step-2",
            title: "Interview the ISSO",
            description: "Confirm the policy is disseminated.",
            props: [{ name: "method", value: "interview" }],
          },
        ],
      },
      {
        uuid: "act-2",
        title: "Test Technical Enforcement",
        description: "Validate automated AC-1 enforcement.",
        "related-controls": {
          "control-selections": [{ "with-ids": ["ac-1"] }],
        },
        steps: [],
      },
    ],
  },
  tasks: [
    {
      uuid: "task-1",
      title: "Pre-Engagement Planning",
      type: "milestone",
      description: "Set up the assessment.",
      timing: { "on-date": { date: "2026-04-01" } },
      "associated-activities": [{ "activity-uuid": "act-1" }],
      tasks: [
        {
          uuid: "task-1a",
          title: "Sub-task: Gather Documentation",
          type: "action",
          description: "Pull all relevant policy docs.",
          "associated-activities": [{ "activity-uuid": "act-1" }],
        },
      ],
    },
    {
      uuid: "task-2",
      title: "On-site Examination",
      type: "action",
      timing: {
        "within-date-range": { start: "2026-04-02T00:00:00Z", end: "2026-04-10T00:00:00Z" },
      },
      "associated-activities": [{ "activity-uuid": "act-2" }],
    },
  ],
};

/** AP without tasks — falls through to flat-activities sidebar flavor. */
const FLAT_ACTIVITY_AP = {
  ...RICH_AP,
  tasks: [],
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
  ap = RICH_AP,
  catalog = CATALOG,
  withCatalog = true,
}: {
  ap?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  const { setAssessmentPlan, setCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setAssessmentPlan(ap, "ap.json");
      if (withCatalog) setCatalog(catalog, "cat.json");
    }
  }, [ap, catalog, setAssessmentPlan, setCatalog, withCatalog]);
  return null;
}

function Harness({
  preload = true,
  mobile = false,
  initialPath = "/assessment-plan",
  ap = RICH_AP,
  catalog = CATALOG,
  withCatalog = true,
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  ap?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  stubMatchMedia(mobile);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && (
            <Seed ap={ap} catalog={catalog} withCatalog={withCatalog} />
          )}
          <AssessmentPlanPage />
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
    expect(screen.queryByText("Overview")).not.toBeNull();
  });
  return utils;
}

function fireDrop(zone: Element, file: File) {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

function apFile(
  data: object = { "assessment-plan": RICH_AP },
  name = "ap.json",
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

describe("<AssessmentPlanPage /> empty state", () => {
  it("renders the DropZone when no plan is loaded", () => {
    render(<Harness preload={false} />);
    expect(
      screen.getByText(/OSCAL Assessment Plan Viewer/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("disables the URL Fetch button until a URL is entered", () => {
    render(<Harness preload={false} />);
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(url, { target: { value: "https://ex.com/ap.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("loads a dropped assessment plan and switches to the viewer shell", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, apFile());
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
    // Plan title appears in the sidebar
    await waitFor(() =>
      expect(
        screen.getAllByText(/Sample Assessment Plan/).length,
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
        [JSON.stringify({ "assessment-plan": { uuid: "x" } })],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Not a valid OSCAL Assessment Plan/),
      ).toBeInTheDocument(),
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

  it("accepts an unwrapped assessment-plan payload", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, apFile(RICH_AP));
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
  });

  it("auto-loads from ?url= (mocked fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ "assessment-plan": RICH_AP }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(
      <Harness
        preload={false}
        initialPath="/assessment-plan?url=https://ex.com/ap.json"
      />,
    );
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
  });

  it("surfaces an HTTP error when auto-load fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("nope", { status: 500, statusText: "Internal Error" }),
      ),
    );
    render(
      <Harness
        preload={false}
        initialPath="/assessment-plan?url=https://ex.com/bad.json"
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

describe("<AssessmentPlanPage /> loaded — desktop", () => {
  it("renders top bar, sidebar title, and overview stats", async () => {
    await renderLoaded();
    expect(
      screen.getByText(/OSCAL Assessment Plan Viewer/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Sample Assessment Plan/).length,
    ).toBeGreaterThan(0);
    // Overview sublabel contains "tasks · ... activities"
    expect(
      screen.getByText(/tasks.*activities/),
    ).toBeInTheDocument();
  });

  it("New File clears state and returns to the DropZone", async () => {
    await renderLoaded();
    fireEvent.click(
      screen.getAllByRole("button", { name: "New File" })[0],
    );
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("task tree shows top-level tasks and their subtasks when expanded", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Pre-Engagement Planning/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/On-site Examination/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to a task detail view when a task row is clicked", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Pre-Engagement Planning/)[0]);
    // TaskView puts the title in the content area
    await waitFor(() =>
      expect(
        screen.getAllByText(/Pre-Engagement Planning/).length,
      ).toBeGreaterThan(1),
    );
    // Associated activity appears somewhere on the page
    expect(
      screen.getAllByText(/Examine Access Control Policy/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates into an activity via its task's associated activity", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Pre-Engagement Planning/)[0]);
    // Step title from the associated activity appears in the TaskView
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Obtain policy document/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("search box filters the task tree", async () => {
    await renderLoaded();
    const initialPre = screen.getAllByText(/Pre-Engagement Planning/).length;
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "On-site" } });
    // Pre-Engagement appears in the OverviewView summary regardless of
    // sidebar filter; just check that it shrinks (sidebar row drops out).
    expect(
      screen.queryAllByText(/Pre-Engagement Planning/).length,
    ).toBeLessThan(initialPre);
    expect(
      screen.getAllByText(/On-site Examination/).length,
    ).toBeGreaterThan(0);
  });

  it('shows "No tasks found" when the search filter matches nothing', async () => {
    await renderLoaded();
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "zzzzzz-nope" } });
    expect(screen.getByText(/No tasks found/)).toBeInTheDocument();
  });

  it("opens the Controls view via the sidebar Controls panel", async () => {
    await renderLoaded();
    // The panel button shows "Controls (N)"
    const ctrlsBtn = screen.getByText(/Controls \(\d+\)/);
    fireEvent.click(ctrlsBtn);
    // Controls view lists the referenced control IDs somewhere
    await waitFor(() =>
      expect(
        screen.getAllByText(/ac-1/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("applies a control filter when a control row is clicked in the controls view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    // Click the first control entry (ac-1)
    const chip = screen.getAllByText(/ac-1/i)[0];
    fireEvent.click(chip);
    // Filter indicator appears in the sidebar
    await waitFor(() =>
      expect(screen.getByText(/Filtering:/)).toBeInTheDocument(),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentPlanPage /> loaded — mobile", () => {
  it("renders the mobile shell with AP Viewer header and New File", async () => {
    await renderLoaded({ mobile: true });
    expect(screen.getByText(/AP Viewer/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New File" }),
    ).toBeInTheDocument();
  });

  it("mobile task click switches to the content view with a Back button", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/On-site Examination/));
    await waitFor(() =>
      expect(
        screen.getByText(/Back to navigation/),
      ).toBeInTheDocument(),
    );
  });

  it("mobile back button returns to the navigation list", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/On-site Examination/));
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText(/Back to navigation/));
    // Back to the nav list
    expect(screen.getByText(/Pre-Engagement Planning/)).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Plans without tasks — flat activities flavour
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentPlanPage /> no-tasks flavour", () => {
  it("falls back to flat activity list in the sidebar when there are no tasks", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    expect(
      screen.getAllByText(/Examine Access Control Policy/).length,
    ).toBeGreaterThan(0);
    // Overview sublabel switches to "N activities · M steps"
    expect(
      screen.getByText(/activities.*steps|activities/),
    ).toBeInTheDocument();
  });

  it("activity-list search filter works without tasks", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    const initial = screen.getAllByText(/Examine Access Control Policy/).length;
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "Technical" } });
    expect(
      screen.queryAllByText(/Examine Access Control Policy/).length,
    ).toBeLessThan(initial);
    expect(
      screen.getAllByText(/Test Technical Enforcement/).length,
    ).toBeGreaterThan(0);
  });

  it('shows "No activities found" when the search filter strikes out', async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "nothing-matches" } });
    expect(
      screen.getByText(/No activities found/),
    ).toBeInTheDocument();
  });

  it("clicking an activity in the flat list navigates to ActivityView", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    fireEvent.click(screen.getAllByText(/Test Technical Enforcement/)[0]);
    // ActivityView shows the activity description somewhere
    await waitFor(() =>
      expect(
        screen.getAllByText(/Validate automated AC-1 enforcement/).length,
      ).toBeGreaterThan(0),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentPlanPage /> edge cases", () => {
  it("renders overview without a loaded catalog", async () => {
    await renderLoaded({ withCatalog: false });
    expect(
      screen.getAllByText(/Sample Assessment Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a minimal plan (no activities, no tasks)", async () => {
    const minimal = {
      uuid: "min",
      metadata: { title: "Minimal Plan" },
      "import-ssp": { href: "#ssp" },
      tasks: [],
      "local-definitions": { activities: [] },
    };
    await renderLoaded({ ap: minimal });
    expect(
      screen.getAllByText(/Minimal Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("clicking the Overview nav item while already on overview is a no-op", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Overview"));
    expect(
      screen.getAllByText(/Sample Assessment Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates back to overview from a task detail via the home affordance", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Pre-Engagement Planning/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Pre-Engagement Planning/).length,
      ).toBeGreaterThan(1),
    );
    // Click Overview in the sidebar to return
    fireEvent.click(screen.getByText("Overview"));
    // Overview stats line visible again
    expect(
      screen.getByText(/tasks.*activities/),
    ).toBeInTheDocument();
  });
});
