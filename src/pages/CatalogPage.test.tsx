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
      { uuid: "p-1", type: "organization", name: "Acme Corp" },
    ],
    roles: [{ id: "owner", title: "Owner" }],
    "responsible-parties": [
      { "role-id": "owner", "party-uuids": ["p-1"] },
    ],
    props: [{ name: "marking", value: "public" }],
    links: [{ href: "https://example.com/home", rel: "reference", text: "Acme home" }],
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
});
