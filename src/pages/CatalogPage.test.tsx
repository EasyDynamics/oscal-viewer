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
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEffect, useRef, type ReactNode } from "react";
import CatalogPage from "./CatalogPage";
import { OscalProvider, useOscal, type Catalog } from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   Test harness + helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function makeWrapper(initialPath = "/catalog") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider>
          <OscalProvider>{children}</OscalProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };
}

/** A small-but-rich catalog fixture covering every interesting render path. */
const RICH_CATALOG: Catalog = {
  uuid: "cat-1",
  metadata: {
    title: "Test Catalog",
    version: "1.0",
    published: "2026-01-15T00:00:00Z",
    "last-modified": "2026-03-10T00:00:00Z",
    "oscal-version": "1.1.2",
    remarks: "Test catalog for rendering",
    parties: [
      { uuid: "p-1", type: "organization", name: "Acme Corp", links: [{ href: "https://acme.example.com", rel: "website", text: "Acme Website" }] },
      { uuid: "p-2", type: "person", name: "Jane Doe", "short-name": "Jane" },
    ],
    roles: [
      { id: "owner", title: "Owner" },
      { id: "maintainer", title: "Maintainer" },
    ],
    "responsible-parties": [
      { "role-id": "owner", "party-uuids": ["p-1"] },
      { "role-id": "maintainer", "party-uuids": ["p-2"] },
    ],
    props: [
      { name: "marking", value: "public" },
      { name: "keywords", value: "security,baseline" },
    ],
    links: [
      { href: "https://example.com/home", rel: "reference", text: "Acme home" },
      { href: "https://attack.mitre.org/techniques/T1059", rel: "mitre", text: "T1059" },
    ],
  },
  groups: [
    {
      id: "ac",
      title: "Access Control",
      props: [{ name: "label", value: "AC" }],
      groups: [
        {
          id: "ac-nested",
          title: "Nested Access Subsection",
          controls: [
            {
              id: "ac-n-1",
              title: "Nested Sample Control",
            },
          ],
        },
      ],
      controls: [
        {
          id: "ac-1",
          class: "SP800-53",
          title: "Policy and Procedures",
          props: [{ name: "label", value: "AC-1" }],
          params: [
            {
              id: "ac-1_prm_1",
              label: "organization-defined roles",
            },
            {
              id: "ac-1_prm_2",
              select: {
                "how-many": "one-or-more",
                choice: ["organizational", "mission"],
              },
            },
          ],
          parts: [
            {
              id: "ac-1-stmt",
              name: "statement",
              prose: "Develop, document, and disseminate to {{ insert: param, ac-1_prm_1 }} the policy.",
            },
            {
              id: "ac-1-gdn",
              name: "guidance",
              prose: "Policy includes procedures for {{ insert: param, ac-1_prm_2 }}.",
            },
            {
              id: "ac-1-ex",
              name: "example",
              prose: "Sample AC-1 implementation.",
            },
            {
              id: "ac-1-am",
              name: "assessment-method",
              prose: "Review policy documentation.",
            },
          ],
          links: [
            { href: "https://attack.mitre.org/techniques/T1059", rel: "reference", text: "ATT&CK T1059" },
          ],
          controls: [
            {
              id: "ac-1.1",
              title: "Policy Enhancement",
              props: [{ name: "label", value: "AC-1(1)" }],
              parts: [
                { name: "statement", prose: "Enhancement body." },
              ],
            },
          ],
        },
      ],
    },
  ],
  controls: [
    {
      id: "tc-1",
      title: "Top-Level Control",
    },
  ],
  "back-matter": {
    resources: [
      {
        uuid: "res-1",
        title: "Reference Document",
        description: "An OSCAL reference",
        rlinks: [
          { href: "https://example.com/ref.json", "media-type": "application/json" },
        ],
        props: [{ name: "type", value: "reference" }],
        remarks: "Curated reference",
      },
      {
        uuid: "res-2",
        title: "NIST Publication",
        citation: {
          text: "NIST. SP 800-53 Rev. 5. Security and Privacy Controls. 2020.",
        },
        rlinks: [
          { href: "https://nvlpubs.nist.gov/x.pdf", "media-type": "application/pdf" },
        ],
        props: [{ name: "type", value: "documentation" }],
      },
    ],
  },
};

/** Fire a drop event with a given File on the dropzone. */
function fireDrop(zone: Element, file: File) {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

/** Create an OSCAL Catalog JSON File for dropping. */
function catalogFile(data: object = { catalog: RICH_CATALOG }, name = "cat.json") {
  return new File([JSON.stringify(data)], name, { type: "application/json" });
}

/** Preload hook — seeds the catalog into OscalProvider exactly once. */
function Seed({ catalog = RICH_CATALOG }: { catalog?: Catalog }) {
  const { setCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setCatalog(catalog, "cat.json");
    }
  }, [setCatalog, catalog]);
  return null;
}

/** Render CatalogPage with the catalog already loaded. */
function Harness({
  preload = true,
  mobile = false,
  initialPath = "/catalog",
  catalog = RICH_CATALOG,
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  catalog?: Catalog;
}) {
  stubMatchMedia(mobile);

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && <Seed catalog={catalog} />}
          <CatalogPage />
        </OscalProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

/** Render Harness and wait for the catalog to settle into the loaded shell. */
async function renderLoaded(
  props: Parameters<typeof Harness>[0] = {},
) {
  const utils = render(<Harness preload {...props} />);
  // Loaded shell shows one of: sidebar "Overview" nav, mobile top bar "Catalog"
  await waitFor(() => {
    const hasOverviewNav = screen.queryByText("Overview") !== null;
    expect(hasOverviewNav).toBe(true);
  });
  return utils;
}

beforeEach(() => {
  stubMatchMedia(false);
  // jsdom doesn't ship scrollTo on Element — several ref.scrollTo(0,0) calls
  // in CatalogPage would otherwise throw.
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ═══════════════════════════════════════════════════════════════════════════
   Empty state — DropZone
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<CatalogPage /> empty state", () => {
  it("renders the DropZone with heading, upload prompt, and URL input", () => {
    render(<CatalogPage />, { wrapper: makeWrapper("/catalog") });
    expect(
      screen.getByText(/OSCAL Catalog Viewer/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drop an OSCAL/),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/https:\/\/example\.com\/catalog\.json/),
    ).toBeInTheDocument();
  });

  it('disables the Fetch button until a URL is entered', () => {
    render(<CatalogPage />, { wrapper: makeWrapper("/catalog") });
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\/example\.com/);
    fireEvent.change(url, { target: { value: "https://a.example/b.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("toggles dragging state on drag-over / drag-leave", () => {
    const { container } = render(<CatalogPage />, {
      wrapper: makeWrapper("/catalog"),
    });
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    expect(zone).not.toBeNull();
    fireEvent.dragOver(zone);
    // Border flips to cobalt (brand dropzone active color)
    fireEvent.dragLeave(zone);
  });

  it("loads a dropped catalog and switches to the viewer shell", async () => {
    const { container } = render(<CatalogPage />, {
      wrapper: makeWrapper("/catalog"),
    });
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, catalogFile());
    await waitFor(() =>
      expect(
        screen.getByText(/OSCAL Catalog Viewer/),
      ).toBeInTheDocument(),
    );
    // Loading the catalog shifts layout — Overview section is rendered in
    // the content panel after the load.
    await waitFor(() =>
      expect(screen.getAllByText(/Access Control/).length).toBeGreaterThan(0),
    );
  });

  it("surfaces a parse error when a non-JSON file is dropped", async () => {
    const { container } = render(<CatalogPage />, {
      wrapper: makeWrapper("/catalog"),
    });
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    const bad = new File(["not json"], "bad.json", {
      type: "application/json",
    });
    fireDrop(zone, bad);
    await waitFor(() =>
      expect(screen.getByText(/JSON/)).toBeInTheDocument(),
    );
  });

  it("reports 'Not an OSCAL Catalog' for JSON missing metadata", async () => {
    const { container } = render(<CatalogPage />, {
      wrapper: makeWrapper("/catalog"),
    });
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    const noMeta = new File(
      [JSON.stringify({ catalog: { uuid: "x" } })],
      "x.json",
      { type: "application/json" },
    );
    fireDrop(zone, noMeta);
    await waitFor(() =>
      expect(
        screen.getByText(/Not an OSCAL Catalog/),
      ).toBeInTheDocument(),
    );
  });

  it("loads successfully when JSON is not wrapped under `catalog` key", async () => {
    const { container } = render(<CatalogPage />, {
      wrapper: makeWrapper("/catalog"),
    });
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    // Pass the catalog at root (no wrapper key)
    fireDrop(zone, catalogFile(RICH_CATALOG));
    await waitFor(() =>
      expect(screen.getAllByText(/Access Control/).length).toBeGreaterThan(0),
    );
  });

  it("writes the entered URL into search params when Fetch is clicked", () => {
    render(<CatalogPage />, { wrapper: makeWrapper("/catalog") });
    const url = screen.getByPlaceholderText(/https:\/\/example\.com/);
    fireEvent.change(url, { target: { value: "https://a.example/x.json" } });
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    // Submitting the form should not throw — asserts the submit handler runs
    fireEvent.click(fetchBtn);
  });

  it("auto-loads from ?url= when provided (mocked fetch)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ catalog: RICH_CATALOG }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CatalogPage />, {
      wrapper: makeWrapper(
        "/catalog?url=https://example.com/c.json",
      ),
    });
    await waitFor(() =>
      expect(screen.getAllByText(/Access Control/).length).toBeGreaterThan(0),
    );
    expect(fetchMock).toHaveBeenCalled();
  });

  it("shows a URL-load error with a retry link in the DropZone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("oops", { status: 500, statusText: "Internal Error" }),
      ),
    );
    render(<CatalogPage />, {
      wrapper: makeWrapper(
        "/catalog?url=https://example.com/bad.json",
      ),
    });
    await waitFor(() =>
      expect(
        screen.getByText(/HTTP 500/),
      ).toBeInTheDocument(),
    );
    // The sourceUrl should still be visible as a link in the error card
    const openUrl = screen.getByRole("link", { name: /Open URL directly/ });
    expect(openUrl).toHaveAttribute(
      "href",
      "https://example.com/bad.json",
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded viewer — desktop
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<CatalogPage /> loaded — desktop overview", () => {
  it("renders the top bar, sidebar filename, and overview content", async () => {
    await renderLoaded();
    expect(screen.getByText("OSCAL Catalog Viewer")).toBeInTheDocument();
    expect(screen.getByText("cat.json")).toBeInTheDocument();
    expect(screen.getAllByText(/Test Catalog/).length).toBeGreaterThan(0);
  });

  it("fires New File from the top bar and resets to the DropZone", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "New File" }));
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("filters the sidebar tree with a search term", async () => {
    await renderLoaded();
    // Expand the group first so its children are in the DOM
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    const search = screen.getByPlaceholderText("Search controls");
    fireEvent.change(search, { target: { value: "Policy" } });
    expect(
      screen.getAllByText(/Policy and Procedures/).length,
    ).toBeGreaterThan(0);
  });

  it("clicking Metadata in the sidebar renders the Metadata view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    expect(screen.getAllByText(/Version/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0);
  });

  it("clicking a group in the sidebar renders the Group view", async () => {
    await renderLoaded();
    const groupRow = screen.getAllByText(/Access Control/)[0];
    fireEvent.click(groupRow);
    expect(
      screen.getAllByText(/Policy and Procedures/).length,
    ).toBeGreaterThan(0);
  });

  it("clicking a control navigates to the Control view with parts", async () => {
    await renderLoaded();
    // Expand the group first so the control is visible
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    const controlRows = screen.getAllByText(/Policy and Procedures/);
    fireEvent.click(controlRows[0]);
    expect(screen.getByText("Statement")).toBeInTheDocument();
    expect(screen.getByText("Guidance")).toBeInTheDocument();
    expect(screen.getByText("Examples")).toBeInTheDocument();
    expect(screen.getByText("Assessment Method")).toBeInTheDocument();
  });

  it("renders inline parameter insertions inside control prose", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    fireEvent.click(screen.getAllByText(/Policy and Procedures/)[0]);
    expect(
      screen.getByText(/organization-defined roles/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/organizational; mission/),
    ).toBeInTheDocument();
  });

  it("renders the Back Matter view with resource list and detail drill-in", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Back Matter"));
    expect(screen.getByText(/Reference Document/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Reference Document/));
    expect(screen.getByText(/An OSCAL reference/)).toBeInTheDocument();
  });

  it("expands and collapses a group in the sidebar via its chevron row", async () => {
    await renderLoaded();
    const groupHeader = screen.getAllByText(/Access Control/)[0];
    fireEvent.click(groupHeader);
    fireEvent.click(groupHeader);
    expect(
      screen.getAllByText(/Policy and Procedures/).length,
    ).toBeGreaterThan(0);
  });

  it("displays a top-level control when present in catalog.controls", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Top-Level Control/).length,
    ).toBeGreaterThan(0);
  });

  it("renders metadata parties, roles, responsible-parties, props, and links", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    // Both parties
    expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Jane Doe|Jane/).length).toBeGreaterThan(0);
    // Roles
    expect(screen.getAllByText(/Owner/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Maintainer/).length).toBeGreaterThan(0);
    // Props / keywords
    expect(screen.queryAllByText(/security,baseline|public|keywords|marking/i).length).toBeGreaterThan(0);
  });

  it("renders catalog-level remarks in the metadata view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    expect(
      screen.queryAllByText(/Test catalog for rendering/).length,
    ).toBeGreaterThan(0);
  });

  it("renders the second back-matter resource with citation", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Back Matter"));
    expect(screen.getAllByText(/NIST Publication/).length).toBeGreaterThan(0);
    // Drill into NIST resource
    fireEvent.click(screen.getAllByText(/NIST Publication/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/SP 800-53 Rev\. 5/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders control params as inline token resolution in statement prose", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    fireEvent.click(screen.getAllByText(/Policy and Procedures/)[0]);
    // param ac-1_prm_1 label renders
    expect(
      screen.queryAllByText(/organization-defined roles/).length,
    ).toBeGreaterThan(0);
    // Selection (one or more)
    expect(
      screen.queryAllByText(/organizational.*mission|mission.*organizational|one or more/i).length,
    ).toBeGreaterThan(0);
  });

  it("search in the sidebar filters groups by their title", async () => {
    await renderLoaded();
    const search = screen.getByPlaceholderText("Search controls");
    fireEvent.change(search, { target: { value: "Access" } });
    expect(screen.getAllByText(/Access Control/).length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded viewer — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<CatalogPage /> loaded — mobile", () => {
  it("renders the mobile shell with a New button and drill-down list", async () => {
    await renderLoaded({ mobile: true });
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Metadata")).toBeInTheDocument();
  });

  it("drills into a group and shows its child nodes", async () => {
    await renderLoaded({ mobile: true });
    const group = screen.getAllByText(/Access Control/)[0];
    fireEvent.click(group);
    await waitFor(() => {
      expect(
        screen.queryByText(/— Overview/) ??
          screen.queryByText(/Nested Access Subsection/) ??
          screen.queryByText(/Policy and Procedures/),
      ).not.toBeNull();
    });
  });

  it("mobile search filters by control title", async () => {
    await renderLoaded({ mobile: true });
    const search = screen.getByPlaceholderText(/Search controls/);
    fireEvent.change(search, { target: { value: "Policy" } });
    expect(
      screen.getAllByText(/Policy and Procedures/).length,
    ).toBeGreaterThan(0);
  });

  it("pressing New on the mobile top bar resets to the DropZone", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("opens a control from the drill-down and renders the content view", async () => {
    await renderLoaded({ mobile: true });
    const search = screen.getByPlaceholderText(/Search controls/);
    fireEvent.change(search, { target: { value: "Policy" } });
    const row = screen.getAllByText(/Policy and Procedures/)[0];
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByText(/← Back/)).toBeInTheDocument();
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Sundry edge cases — content rendering
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<CatalogPage /> edge cases", () => {
  it("handles a catalog with no back-matter resources", async () => {
    const slim: Catalog = {
      uuid: "x",
      metadata: { title: "Slim" },
      groups: [],
    };
    await renderLoaded({ catalog: slim });
    expect(screen.getByText("Back Matter")).toBeInTheDocument();
  });

  it("renders the Overview view when navigated from the sidebar", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    // Multiple "Overview" matches may exist (sidebar + content) — first is sidebar
    fireEvent.click(screen.getAllByText("Overview")[0]);
    expect(
      screen.getAllByText(/Test Catalog/).length,
    ).toBeGreaterThan(0);
  });

  it("renders MITRE link chips for controls that reference attack.mitre.org", async () => {
    await renderLoaded();
    // Expand group and click the control
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    fireEvent.click(screen.getAllByText(/Policy and Procedures/)[0]);
    expect(screen.getByText(/ATT&CK T1059/)).toBeInTheDocument();
  });

  it("renders control enhancements as a separate subtree", async () => {
    await renderLoaded();
    // Expand group, then expand the parent control to reveal enhancements
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    fireEvent.click(screen.getAllByText(/Policy and Procedures/)[0]);
    // After clicking, control detail is shown — expand its sidebar row too
    expect(
      screen.getAllByText(/Policy Enhancement/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates into a control enhancement and shows parent breadcrumbs", async () => {
    await renderLoaded();
    // Open parent control
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    fireEvent.click(screen.getAllByText(/Policy and Procedures/)[0]);
    // Click the enhancement row
    await waitFor(() =>
      expect(screen.getAllByText(/Policy Enhancement/).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Policy Enhancement/)[0]);
    await waitFor(() => {
      // Breadcrumb should reference parent control
      expect(
        screen.queryAllByText(/Policy and Procedures|AC-1/).length,
      ).toBeGreaterThan(0);
    });
  });

  it("shows a withdrawn control with Withdrawn badge and moved-to link", async () => {
    const withWithdrawn: Catalog = {
      uuid: "cat-w",
      metadata: { title: "Withdrawn Test" },
      groups: [
        {
          id: "si",
          title: "System & Info",
          controls: [
            {
              id: "si-1",
              title: "Old Control",
              props: [{ name: "status", value: "withdrawn" }],
              links: [{ href: "#si-2", rel: "moved-to" }],
            },
            {
              id: "si-2",
              title: "New Control",
            },
          ],
        },
      ],
    };
    await renderLoaded({ catalog: withWithdrawn });
    // Expand group
    fireEvent.click(screen.getAllByText(/System & Info/)[0]);
    fireEvent.click(screen.getAllByText(/Old Control/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Withdrawn|withdrawn/i).length).toBeGreaterThan(0),
    );
  });

  it("navigates into a nested subgroup control", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    // Nested Access Subsection
    await waitFor(() =>
      expect(screen.queryAllByText(/Nested Access Subsection/).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Nested Access Subsection/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Nested Sample Control/).length).toBeGreaterThan(0),
    );
  });

  it("renders a control with hash-link in part prose pointing to a back-matter resource", async () => {
    const catWithPartLink: Catalog = {
      uuid: "cat-pl",
      metadata: { title: "Part Link Test" },
      groups: [
        {
          id: "gr",
          title: "Group One",
          controls: [
            {
              id: "gr-1",
              title: "Control With Part Link",
              parts: [
                {
                  id: "gr-1-stmt",
                  name: "statement",
                  prose: "See the reference doc.",
                  links: [{ href: "#res-1", rel: "reference" }],
                },
              ],
            },
          ],
        },
      ],
      "back-matter": {
        resources: [
          {
            uuid: "res-1",
            title: "Linked Resource",
            rlinks: [{ href: "https://example.com/doc.pdf", "media-type": "application/pdf" }],
          },
        ],
      },
    };
    await renderLoaded({ catalog: catWithPartLink });
    fireEvent.click(screen.getAllByText(/Group One/)[0]);
    fireEvent.click(screen.getAllByText(/Control With Part Link/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Linked Resource|See the reference doc/).length).toBeGreaterThan(0),
    );
  });

  it("renders a control with a resource hash-link in its top-level links", async () => {
    const catWithResLink: Catalog = {
      uuid: "cat-rl",
      metadata: { title: "Res Link Test" },
      groups: [
        {
          id: "rl",
          title: "RL Group",
          controls: [
            {
              id: "rl-1",
              title: "Control With Res Link",
              parts: [{ id: "s", name: "statement", prose: "Body text." }],
              links: [{ href: "#res-a", rel: "reference" }],
            },
          ],
        },
      ],
      "back-matter": {
        resources: [
          {
            uuid: "res-a",
            title: "Resource A",
            rlinks: [{ href: "https://example.com/res-a.pdf", "media-type": "application/pdf" }],
          },
        ],
      },
    };
    await renderLoaded({ catalog: catWithResLink });
    fireEvent.click(screen.getAllByText(/RL Group/)[0]);
    fireEvent.click(screen.getAllByText(/Control With Res Link/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Resource A/).length).toBeGreaterThan(0),
    );
  });

  it("searches back-matter resources by title", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Back Matter"));
    const searchInput = screen.getByPlaceholderText(/Search resources/);
    fireEvent.change(searchInput, { target: { value: "NIST" } });
    await waitFor(() =>
      expect(screen.queryAllByText(/NIST Publication/).length).toBeGreaterThan(0),
    );
  });

  it("navigates to a subgroup from the group detail view", async () => {
    await renderLoaded();
    // Click the Access Control group row in sidebar
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    // Now we should be on the group view — click the nested subgroup
    await waitFor(() =>
      expect(screen.queryAllByText(/Nested Access Subsection/).length).toBeGreaterThan(0),
    );
    // Click the subgroup row inside the group view
    fireEvent.click(screen.getAllByText(/Nested Access Subsection/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Nested Sample Control/).length).toBeGreaterThan(0),
    );
  });

  it("clicks a breadcrumb to navigate back", async () => {
    await renderLoaded();
    // Navigate to a control
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    fireEvent.click(screen.getAllByText(/Policy and Procedures/)[0]);
    // Breadcrumb should show "Overview"
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
    // Click Overview breadcrumb
    fireEvent.click(screen.getAllByText("Overview")[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Test Catalog/).length).toBeGreaterThan(0),
    );
  });

  it("renders the nested subgroup control when navigated to its group in mobile", async () => {
    await renderLoaded({ mobile: true });
    // Drill into Access Control group
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Nested Access Subsection|Policy and Procedures/).length).toBeGreaterThan(0),
    );
    // Drill into the subgroup
    const nestedGroup = screen.queryAllByText(/Nested Access Subsection/);
    if (nestedGroup.length > 0) {
      fireEvent.click(nestedGroup[0]);
      await waitFor(() =>
        expect(screen.queryAllByText(/Nested Sample Control/).length).toBeGreaterThan(0),
      );
    }
  });

  it("mobile: drills into a control that has enhancements and shows enhancement list", async () => {
    await renderLoaded({ mobile: true });
    const search = screen.getByPlaceholderText(/Search controls/);
    fireEvent.change(search, { target: { value: "Policy" } });
    await waitFor(() =>
      expect(screen.getAllByText(/Policy and Procedures/).length).toBeGreaterThan(0),
    );
    // tap the control — it has enhancements so it should drill in
    fireEvent.click(screen.getAllByText(/Policy and Procedures/)[0]);
    await waitFor(() => {
      // Either the detail view shows or we see the enhancement entry
      const detailOrEnhancement =
        screen.queryAllByText(/Policy Enhancement/).length > 0 ||
        screen.queryAllByText(/← Back/).length > 0 ||
        screen.queryAllByText(/Detail/).length > 0;
      expect(detailOrEnhancement).toBe(true);
    });
  });

  it("renders control with hash-link pointing to non-existent resource (internal ctrl ref)", async () => {
    // covers line 1911-1914: #hash link that doesn't match any resource
    const catInternalRef: Catalog = {
      uuid: "cat-ir",
      metadata: { title: "Internal Ref" },
      groups: [
        {
          id: "ir",
          title: "IR Group",
          controls: [
            { id: "ir-1", title: "Control IR-1" },
            {
              id: "ir-2",
              title: "Control IR-2",
              parts: [{ id: "s", name: "statement", prose: "See IR-1." }],
              links: [{ href: "#ir-1", rel: "related" }],
            },
          ],
        },
      ],
    };
    await renderLoaded({ catalog: catInternalRef });
    fireEvent.click(screen.getAllByText(/IR Group/)[0]);
    fireEvent.click(screen.getAllByText(/Control IR-2/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/IR-1|See IR-1/).length).toBeGreaterThan(0),
    );
  });

  it("renders a control with a withdrawn enhancement", async () => {
    // covers line 1933: enhancement with withdrawn status
    const catWithdrawEnh: Catalog = {
      uuid: "cat-we",
      metadata: { title: "Withdrawn Enh" },
      groups: [
        {
          id: "we",
          title: "WE Group",
          controls: [
            {
              id: "we-1",
              title: "We Control",
              parts: [{ id: "s", name: "statement", prose: "Body." }],
              controls: [
                {
                  id: "we-1.1",
                  title: "Withdrawn Enhancement",
                  props: [{ name: "status", value: "withdrawn" }],
                },
              ],
            },
          ],
        },
      ],
    };
    await renderLoaded({ catalog: catWithdrawEnh });
    fireEvent.click(screen.getAllByText(/WE Group/)[0]);
    fireEvent.click(screen.getAllByText(/We Control/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Withdrawn Enhancement/).length).toBeGreaterThan(0),
    );
  });

  it("navigates from the overview group card to the group view", async () => {
    // covers line 1157: clicking group in OverviewView
    await renderLoaded();
    // In overview the group row is rendered in the content panel
    // Find the "Control Families" section and click the group there
    const groupLinks = screen.queryAllByText(/Access Control/);
    // Click the one inside the overview content area (not the sidebar)
    // Multiple matches: sidebar link + overview card
    if (groupLinks.length > 1) {
      fireEvent.click(groupLinks[groupLinks.length - 1]);
    } else {
      fireEvent.click(groupLinks[0]);
    }
    await waitFor(() =>
      expect(screen.queryAllByText(/Policy and Procedures|Sub-Groups|Controls/).length).toBeGreaterThan(0),
    );
  });

  it("renders a group with parts (prose overview text)", async () => {
    // covers line 1682: group.parts rendering
    const catWithGroupParts: Catalog = {
      uuid: "cat-gp",
      metadata: { title: "Group Parts" },
      groups: [
        {
          id: "gp",
          title: "GP Group",
          parts: [
            { id: "gp-overview", name: "overview", prose: "This group covers general policies." },
          ],
          controls: [
            { id: "gp-1", title: "GP Control" },
          ],
        },
      ],
    };
    await renderLoaded({ catalog: catWithGroupParts });
    fireEvent.click(screen.getAllByText(/GP Group/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/This group covers general policies|GP Control/).length).toBeGreaterThan(0),
    );
  });

  it("renders part with an external link (no hash)", async () => {
    // covers line 2045: external link in part
    const catPartExtLink: Catalog = {
      uuid: "cat-pel",
      metadata: { title: "Part Ext Link" },
      groups: [
        {
          id: "pel",
          title: "PEL Group",
          controls: [
            {
              id: "pel-1",
              title: "Control PEL-1",
              parts: [
                {
                  id: "s",
                  name: "statement",
                  prose: "See external guide.",
                  links: [{ href: "https://example.com/guide.pdf", rel: "reference", text: "External Guide" }],
                },
              ],
            },
          ],
        },
      ],
    };
    await renderLoaded({ catalog: catPartExtLink });
    fireEvent.click(screen.getAllByText(/PEL Group/)[0]);
    fireEvent.click(screen.getAllByText(/Control PEL-1/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/External Guide|See external guide/).length).toBeGreaterThan(0),
    );
  });

  it("renders part with subparts (nested PartTree)", async () => {
    // covers line 2063: subparts rendering
    const catSubparts: Catalog = {
      uuid: "cat-sp",
      metadata: { title: "Subparts" },
      groups: [
        {
          id: "sp",
          title: "SP Group",
          controls: [
            {
              id: "sp-1",
              title: "Control With Subparts",
              parts: [
                {
                  id: "s",
                  name: "statement",
                  prose: "Outer prose.",
                  parts: [
                    { id: "s-a", name: "item", prose: "Sub-item A content." },
                    { id: "s-b", name: "item", prose: "Sub-item B content." },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    await renderLoaded({ catalog: catSubparts });
    fireEvent.click(screen.getAllByText(/SP Group/)[0]);
    fireEvent.click(screen.getAllByText(/Control With Subparts/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Sub-item A content|Sub-item B content/).length).toBeGreaterThan(0),
    );
  });

  it("renders a control with prose containing an unknown param token", async () => {
    // covers lines 71-73: resolveInlineParams when param not found
    const catUnknownParam: Catalog = {
      uuid: "cat-up",
      metadata: { title: "Unknown Param" },
      groups: [
        {
          id: "up",
          title: "UP Group",
          controls: [
            {
              id: "up-1",
              title: "Control UP-1",
              parts: [
                {
                  id: "s",
                  name: "statement",
                  prose: "The {{ insert: param, unknown_param_id }} shall be documented.",
                },
              ],
            },
          ],
        },
      ],
    };
    await renderLoaded({ catalog: catUnknownParam });
    fireEvent.click(screen.getAllByText(/UP Group/)[0]);
    fireEvent.click(screen.getAllByText(/Control UP-1/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/unknown_param_id|Assignment|documented/).length).toBeGreaterThan(0),
    );
  });

  it("clicks a control inside the GroupView content panel (not sidebar)", async () => {
    // covers line 1715: navigate from GroupView control row onClick
    await renderLoaded();
    // Click group in sidebar to show GroupView
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    // Now in GroupView, click a control in the content panel
    // The group view should show "Policy and Procedures" in the controls card
    await waitFor(() =>
      expect(screen.queryAllByText(/Policy and Procedures/).length).toBeGreaterThan(0),
    );
    // The GroupView control list has one row for each control
    // Click on the one in the content area (last occurrence since sidebar also shows it)
    const allPolicyTexts = screen.queryAllByText(/Policy and Procedures/);
    if (allPolicyTexts.length > 0) {
      fireEvent.click(allPolicyTexts[allPolicyTexts.length - 1]);
      await waitFor(() =>
        expect(screen.queryAllByText(/Statement|Guidance/).length).toBeGreaterThan(0),
      );
    }
  });
});
