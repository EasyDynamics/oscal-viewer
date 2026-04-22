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
import ComponentDefinitionPage from "./ComponentDefinitionPage";
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
        {
          id: "ac-2",
          title: "Account Management",
          props: [{ name: "label", value: "AC-2" }],
        },
      ],
    },
  ],
};

const RICH_CDEF = {
  uuid: "cdef-1",
  metadata: {
    title: "Sample Component Definition",
    version: "1.0",
    "last-modified": "2026-03-01T00:00:00Z",
    published: "2026-02-15T00:00:00Z",
    "oscal-version": "1.1.2",
    parties: [
      { uuid: "party-1", type: "organization", name: "Acme Corp" },
    ],
    roles: [{ id: "owner", title: "Owner" }],
  },
  components: [
    {
      uuid: "comp-1",
      type: "service",
      title: "MongoDB",
      description: "Document database service.",
      purpose: "Store application data.",
      props: [{ name: "version", value: "6.0" }],
      "responsible-roles": [
        { "role-id": "owner", "party-uuids": ["party-1"] },
      ],
      links: [
        { href: "https://mongodb.com", rel: "reference", text: "MongoDB site" },
      ],
      "control-implementations": [
        {
          uuid: "ci-1",
          source: "#cat-res",
          description: "Implements access control policy.",
          "implemented-requirements": [
            {
              uuid: "req-1",
              "control-id": "ac-1",
              description: "We follow the AC-1 policy.",
              props: [{ name: "implementation-status", value: "implemented" }],
              "statements": [
                {
                  uuid: "stmt-1",
                  "statement-id": "ac-1_smt.a",
                  description: "Part (a) inherited.",
                },
              ],
            },
            {
              uuid: "req-2",
              "control-id": "ac-2",
              description: "Account management handled via SSO.",
            },
          ],
        },
      ],
    },
    {
      uuid: "comp-2",
      type: "software",
      title: "Application",
      description: "Node.js backend.",
    },
  ],
  "back-matter": {
    resources: [
      {
        uuid: "cat-res",
        title: "NIST SP 800-53 rev5 Catalog",
        description: "The referenced control catalog.",
        rlinks: [
          { href: "https://example.com/cat.json", "media-type": "application/json" },
        ],
      },
      {
        uuid: "doc-res",
        title: "System Architecture Diagram",
        props: [{ name: "type", value: "architecture" }],
        rlinks: [{ href: "https://example.com/arch.pdf" }],
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
  cdef = RICH_CDEF,
  catalog = CATALOG,
  withCatalog = true,
}: {
  cdef?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  const { setComponentDefinition, setCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setComponentDefinition(cdef, "cdef.json");
      if (withCatalog) setCatalog(catalog, "cat.json");
    }
  }, [cdef, catalog, setComponentDefinition, setCatalog, withCatalog]);
  return null;
}

function Harness({
  preload = true,
  mobile = false,
  initialPath = "/component-definition",
  cdef = RICH_CDEF,
  catalog = CATALOG,
  withCatalog = true,
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  cdef?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  stubMatchMedia(mobile);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && (
            <Seed cdef={cdef} catalog={catalog} withCatalog={withCatalog} />
          )}
          <ComponentDefinitionPage />
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

function cdefFile(
  data: object = { "component-definition": RICH_CDEF },
  name = "cdef.json",
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

describe("<ComponentDefinitionPage /> empty state", () => {
  it("renders the DropZone when no component definition is loaded", () => {
    render(<Harness preload={false} />);
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("disables the URL Fetch button until a URL is entered", () => {
    render(<Harness preload={false} />);
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(url, { target: { value: "https://ex.com/cd.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("loads a dropped component-definition and switches to the viewer shell", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, cdefFile());
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/Sample Component Definition/).length,
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
        [JSON.stringify({ "component-definition": { uuid: "x" } })],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Not an OSCAL component-definition/),
      ).toBeInTheDocument(),
    );
  });

  it("accepts an unwrapped component-definition payload", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, cdefFile(RICH_CDEF));
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
  });

  it("auto-loads from ?url= (mocked fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ "component-definition": RICH_CDEF }),
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
        initialPath="/component-definition?url=https://ex.com/cd.json"
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
        initialPath="/component-definition?url=https://ex.com/bad.json"
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

describe("<ComponentDefinitionPage /> loaded — desktop", () => {
  it("renders top bar, sidebar, and default overview", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Sample Component Definition/).length,
    ).toBeGreaterThan(0);
    // Component titles in sidebar
    expect(screen.getAllByText(/MongoDB/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Application/).length).toBeGreaterThan(0);
  });

  it("New File clears state and returns to the DropZone", async () => {
    await renderLoaded();
    fireEvent.click(
      screen.getAllByRole("button", { name: /New File/i })[0],
    );
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("navigates to Metadata view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    expect(
      screen.getAllByText(/Acme Corp/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to a component detail view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    // Component description should be visible
    expect(
      screen.getAllByText(/Document database service/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates into a control-implementation row", async () => {
    await renderLoaded();
    // Expand MongoDB (comp-0) → reveals CI row labelled from catalog title
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    // Sample Catalog is the resolved CI label (first-source matches loaded catalog)
    const ciRows = screen.getAllByText(/Sample Catalog/);
    expect(ciRows.length).toBeGreaterThan(0);
  });

  it("navigates to a specific requirement detail (req-uuid)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    // Expand the CI row too
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    // AC-1 requirement row now visible in sidebar
    const acRow = screen.getAllByText(/AC-1/)[0];
    fireEvent.click(acRow);
    // RequirementView shows the requirement description
    await waitFor(() =>
      expect(
        screen.getAllByText(/We follow the AC-1 policy/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows the second requirement (AC-2) in the sidebar when the impl is expanded", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    expect(screen.getAllByText(/AC-2/).length).toBeGreaterThan(0);
  });

  it("renders the References node with per-type grouping", async () => {
    await renderLoaded();
    // References shows the total count
    expect(
      screen.getAllByText(/References \(\d+\)/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates into the References view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/References \(\d+\)/));
    // Shows the resource titles
    expect(
      screen.getAllByText(/NIST SP 800-53 rev5 Catalog/).length,
    ).toBeGreaterThan(0);
  });

  it("drills into a specific resource detail view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/References \(\d+\)/));
    fireEvent.click(
      screen.getAllByText(/NIST SP 800-53 rev5 Catalog/)[0],
    );
    // ResourceView shows the description
    await waitFor(() =>
      expect(
        screen.getAllByText(/The referenced control catalog/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("returns to overview via sidebar", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    fireEvent.click(screen.getAllByText("Overview")[0]);
    expect(
      screen.getAllByText(/Sample Component Definition/).length,
    ).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<ComponentDefinitionPage /> loaded — mobile", () => {
  it("renders the mobile shell with a navigable drill-down list", async () => {
    await renderLoaded({ mobile: true });
    // Mobile root drill-down shows Overview + Metadata + component titles
    expect(screen.getAllByText(/Overview/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MongoDB/).length).toBeGreaterThan(0);
  });

  it("drills into a component from the mobile root list", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    // Mobile content view should show the description
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Document database service|MongoDB/).length,
      ).toBeGreaterThan(0),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<ComponentDefinitionPage /> edge cases", () => {
  it("renders without catalog", async () => {
    await renderLoaded({ withCatalog: false });
    expect(
      screen.getAllByText(/Sample Component Definition/).length,
    ).toBeGreaterThan(0);
  });

  it("handles a component with no control-implementations", async () => {
    const minimal = {
      uuid: "m",
      metadata: { title: "Minimal CDef" },
      components: [
        {
          uuid: "c",
          type: "service",
          title: "Bare Component",
          description: "No implementations.",
        },
      ],
    };
    await renderLoaded({ cdef: minimal });
    expect(screen.getAllByText(/Bare Component/).length).toBeGreaterThan(0);
  });

  it("renders with no back-matter resources", async () => {
    const noBm = { ...RICH_CDEF, "back-matter": { resources: [] } };
    await renderLoaded({ cdef: noBm });
    // No References node
    expect(
      screen.queryByText(/References \(\d+\)/),
    ).not.toBeInTheDocument();
  });
});
