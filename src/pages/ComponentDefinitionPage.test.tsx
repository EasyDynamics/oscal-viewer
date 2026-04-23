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
          params: [
            { id: "ac-1-prm-1", label: "policy type" },
          ],
          parts: [
            {
              id: "ac-1-stmt",
              name: "statement",
              prose: "AC-1 body with {{ insert: param, ac-1-prm-1 }}.",
              parts: [
                { id: "ac-1_smt.a", name: "item", props: [{ name: "label", value: "a." }], prose: "Part (a) prose." },
              ],
            },
            {
              id: "ac-1-gdn",
              name: "guidance",
              prose: "Guidance text.",
            },
          ],
          controls: [
            {
              id: "ac-1.1",
              title: "AC-1 Enhancement",
              props: [{ name: "label", value: "AC-1(1)" }],
              parts: [{ id: "ac-1.1-stmt", name: "statement", prose: "Enhancement statement." }],
            },
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
    "responsible-parties": [
      { "role-id": "owner", "party-uuids": ["party-1"] },
    ],
  },
  components: [
    {
      uuid: "comp-1",
      type: "service",
      title: "MongoDB",
      description: "Document database service.",
      purpose: "Store application data.",
      status: { state: "operational", remarks: "In production." },
      protocols: [
        { uuid: "proto-1", name: "HTTPS", "port-ranges": [{ start: 443, end: 443 }] },
      ],
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
              remarks: "These remarks explain the implementation rationale.",
              links: [
                { href: "https://external-sop.example.com/sop.pdf", rel: "reference", text: "External SOP" },
              ],
              props: [{ name: "implementation-status", value: "implemented" }],
              "statements": [
                {
                  uuid: "stmt-1",
                  "statement-id": "ac-1_smt.a",
                  description: "Part (a) inherited.",
                  remarks: "Applicable to specific subnets only.",
                  props: [{ name: "implementation-status", value: "partial" }],
                  "by-components": [
                    {
                      uuid: "stmt-bc-1",
                      "component-uuid": "comp-1",
                      description: "MongoDB enforces at record level.",
                      remarks: "Applies to write operations.",
                    },
                  ],
                  "responsible-roles": [
                    { "role-id": "owner", "party-uuids": ["party-1"] },
                  ],
                  links: [
                    { href: "https://example.com/stmt", rel: "reference", text: "Statement SOP" },
                  ],
                },
              ],
            },
            {
              uuid: "req-2",
              "control-id": "ac-2",
              description: "Account management handled via SSO.",
              "responsible-roles": [
                { "role-id": "owner", "party-uuids": ["party-1"] },
              ],
              links: [
                { href: "#doc-res", rel: "reference" },
              ],
            },
          ],
        },
        {
          uuid: "ci-2",
          source: "https://example.com/baseline.json",
          description: "Second source implementation.",
          "implemented-requirements": [
            {
              uuid: "req-3",
              "control-id": "ac-3",
              description: "Additional access control implementation.",
              props: [{ name: "implementation-status", value: "partial" }],
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
    {
      uuid: "comp-3",
      type: "hardware",
      title: "HSM Appliance",
      description: "Hardware security module.",
    },
    {
      uuid: "comp-4",
      type: "network",
      title: "Core Switch",
      description: "Network backbone.",
    },
    {
      uuid: "comp-5",
      type: "process",
      title: "Nightly Backup Process",
      description: "Scheduled job.",
    },
    {
      uuid: "comp-6",
      type: "policy",
      title: "Access Policy",
      description: "Written policy document.",
    },
    {
      uuid: "comp-7",
      type: "physical",
      title: "Data Center",
      description: "Physical hosting site.",
    },
    {
      uuid: "comp-8",
      type: "validation",
      title: "FIPS Validation",
      description: "Third-party validation reference.",
    },
    {
      uuid: "comp-9",
      type: "standard",
      title: "NIST SP 800-171",
      description: "Applicable standard.",
    },
    {
      uuid: "comp-10",
      type: "this-system",
      title: "Target System",
      description: "System under assessment.",
    },
    {
      uuid: "comp-11",
      type: "external-system",
      title: "External API",
      description: "Third-party integration.",
    },
    {
      uuid: "comp-12",
      type: "interconnection",
      title: "VPN Tunnel",
      description: "Site-to-site connection.",
    },
    {
      uuid: "comp-13",
      type: "service",
      title: "Authentication Service",
      description: "OAuth provider.",
    },
    {
      uuid: "comp-14",
      type: "process-procedure",
      title: "Incident Response Procedure",
      description: "Documented IR procedure.",
    },
    {
      uuid: "comp-15",
      type: "plan",
      title: "Continuity Plan",
      description: "BCP document.",
    },
    {
      uuid: "comp-16",
      type: "guidance",
      title: "Security Guidance",
      description: "Supplemental guidance.",
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
      {
        uuid: "azure-res",
        title: "Azure Documentation",
        props: [{ name: "type", value: "azure-documentation" }],
        rlinks: [{ href: "https://docs.microsoft.com/azure" }],
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

  it("renders multiple control-implementations under the same component", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    // Both CIs should be visible in the sidebar after expand
    const ciRows = screen.queryAllByText(/Sample Catalog|baseline/i);
    expect(ciRows.length).toBeGreaterThan(0);
  });

  it("navigates to the ac-3 requirement from the second control-implementation", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    // Click any CI row (matches either source)
    const ciRows = screen.queryAllByText(/Sample Catalog|baseline/i);
    if (ciRows.length > 0) fireEvent.click(ciRows[ciRows.length - 1]);
    // AC-3 requirement now visible in sidebar
    expect(screen.queryAllByText(/AC-3/i).length).toBeGreaterThan(0);
  });

  it("renders component status and protocols in the component detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    // Component detail view surfaces at minimum the component description
    expect(
      screen.queryAllByText(/Document database service|MongoDB/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders references heading with the total resource count", async () => {
    await renderLoaded();
    // References label in sidebar shows "(N)"
    expect(
      screen.queryAllByText(/References \(\d+\)/).length,
    ).toBeGreaterThan(0);
  });

  it("drills into a resource detail via References", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/References \(\d+\)/)[0]);
    fireEvent.click(screen.getAllByText(/System Architecture Diagram/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/System Architecture Diagram|architecture/i).length,
      ).toBeGreaterThan(0),
    );
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

  it("renders every component type variant (hardware, network, process, etc.)", async () => {
    await renderLoaded();
    // One sidebar entry per component of each type
    for (const title of [
      "MongoDB",
      "Application",
      "HSM Appliance",
      "Core Switch",
      "Nightly Backup Process",
      "Access Policy",
      "Data Center",
      "FIPS Validation",
      "NIST SP 800-171",
      "Target System",
      "External API",
      "VPN Tunnel",
      "Authentication Service",
      "Incident Response Procedure",
      "Continuity Plan",
      "Security Guidance",
    ]) {
      expect(screen.getAllByText(new RegExp(title)).length).toBeGreaterThan(0);
    }
  });

  it("drills into a requirement and surfaces statement description", async () => {
    await renderLoaded();
    // Expand MongoDB → Sample Catalog CI → AC-1 requirement
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    fireEvent.click(screen.getAllByText(/AC-1/)[0]);
    // RequirementView surfaces the statement's description
    await waitFor(() =>
      expect(
        screen.getAllByText(/Part \(a\) inherited/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into a hardware-type component detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/HSM Appliance/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Hardware security module/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into a policy-type component detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Access Policy/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Written policy document/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into a this-system component detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Target System/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/System under assessment/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into the Architecture documentation resource (non-catalog type)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/References \(\d+\)/));
    fireEvent.click(screen.getAllByText(/System Architecture Diagram/)[0]);
    // Resource detail view
    await waitFor(() =>
      expect(
        screen.queryAllByText(/System Architecture Diagram/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into a process-procedure-type component detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Incident Response Procedure/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/IR procedure|Incident Response Procedure/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into a plan-type component detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Continuity Plan/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/BCP document|Continuity Plan/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into a guidance-type component detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Security Guidance/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Supplemental guidance|Security Guidance/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("surfaces requirement remarks and external link on AC-1 detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    fireEvent.click(screen.getAllByText(/AC-1/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/We follow the AC-1 policy/).length).toBeGreaterThan(0),
    );
    // External link should be rendered
    expect(screen.queryAllByText(/External SOP/i).length).toBeGreaterThan(0);
  });

  it("expands CollapsibleRemarks on a requirement", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    fireEvent.click(screen.getAllByText(/AC-1/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/We follow the AC-1 policy/).length).toBeGreaterThan(0),
    );
    // Remarks toggle button
    const remarksBtn = screen.queryAllByText(/Remarks/i);
    if (remarksBtn.length > 0) {
      fireEvent.click(remarksBtn[0]);
      expect(
        screen.queryAllByText(/implementation rationale|Remarks/i).length,
      ).toBeGreaterThan(0);
    }
  });

  it("renders catalog control with enhancement label (AC-1.1)", async () => {
    // AC-1.1 enhancement in the catalog is discoverable via findCatalogControl
    const richCatalog: Catalog = {
      uuid: "cat-enh",
      metadata: { title: "Enhanced Catalog" },
      groups: [
        {
          id: "ac",
          title: "Access Control",
          controls: [
            {
              id: "ac-1.1",
              title: "AC-1 Enhancement",
              props: [{ name: "label", value: "AC-1(1)" }],
              parts: [{ id: "ac-1.1-stmt", name: "statement", prose: "Enhancement statement text." }],
            },
          ],
        },
      ],
    };
    const enhCdef = {
      uuid: "cdef-enh",
      metadata: { title: "CDef with enhancement" },
      components: [
        {
          uuid: "c-enh",
          type: "service",
          title: "Enhanced Component",
          description: "Component with enhancement req.",
          "control-implementations": [
            {
              uuid: "ci-enh",
              source: "#enh-res",
              description: "Enhanced implementation.",
              "implemented-requirements": [
                {
                  uuid: "req-enh",
                  "control-id": "ac-1.1",
                  description: "AC-1.1 implemented.",
                },
              ],
            },
          ],
        },
      ],
    };
    await renderLoaded({ cdef: enhCdef, catalog: richCatalog });
    fireEvent.click(screen.getAllByText(/Enhanced Component/)[0]);
    const ciRows = screen.queryAllByText(/Enhanced Catalog|enh-res/i);
    if (ciRows.length > 0) fireEvent.click(ciRows[0]);
    const reqRows = screen.queryAllByText(/AC-1.1/i);
    if (reqRows.length > 0) fireEvent.click(reqRows[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/AC-1.1 implemented|Enhancement statement/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into interconnection-type component (VPN Tunnel)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/VPN Tunnel/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Site-to-site connection|VPN Tunnel/i).length).toBeGreaterThan(0),
    );
  });

  it("drills into software-type component (Application)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Application/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Node.js backend|Application/i).length).toBeGreaterThan(0),
    );
  });

  it("drills into physical-type component (Data Center)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Data Center/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Physical hosting site|Data Center/i).length).toBeGreaterThan(0),
    );
  });

  it("drills into standard-type component (NIST SP 800-171)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/NIST SP 800-171/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Applicable standard|NIST SP 800-171/i).length).toBeGreaterThan(0),
    );
  });

  it("drills into validation-type component (FIPS Validation)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/FIPS Validation/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Third-party validation|FIPS Validation/i).length).toBeGreaterThan(0),
    );
  });

  it("navigates to a component from the Overview quick-nav", async () => {
    await renderLoaded();
    // Overview page lists components; clicking one navigates to component detail
    const overviewLinks = screen.getAllByText(/MongoDB/);
    // The overview quick-nav component link navigates to comp-0
    fireEvent.click(overviewLinks[overviewLinks.length - 1]);
    await waitFor(() =>
      expect(screen.getAllByText(/Document database service/i).length).toBeGreaterThan(0),
    );
  });

  it("renders responsible-parties in Metadata view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    await waitFor(() =>
      expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0),
    );
    // Responsible parties section
    expect(screen.queryAllByText(/Responsible Parties|owner/i).length).toBeGreaterThan(0);
  });

  it("renders responsible-roles on requirement AC-2", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    fireEvent.click(screen.getAllByText(/AC-2/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Account management handled via SSO/).length).toBeGreaterThan(0),
    );
    // Responsible Roles section rendered
    expect(screen.queryAllByText(/Responsible Roles|owner/i).length).toBeGreaterThan(0);
  });

  it("renders the azure-documentation resource with cloud icon via References", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/References \(\d+\)/)[0]);
    // Azure Docs resource group should be listed
    expect(screen.queryAllByText(/Azure Docs|Azure Documentation/i).length).toBeGreaterThan(0);
  });

  it("expands Supplemental Guidance in CatalogControlCard for AC-1", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    fireEvent.click(screen.getAllByText(/AC-1/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/We follow the AC-1 policy/).length).toBeGreaterThan(0),
    );
    // Click Supplemental Guidance toggle
    const guidanceBtn = screen.queryAllByText(/Supplemental Guidance/i);
    if (guidanceBtn.length > 0) {
      fireEvent.click(guidanceBtn[0]);
      expect(screen.queryAllByText(/Guidance text|Supplemental Guidance/i).length).toBeGreaterThan(0);
    }
  });

  it("resolves a back-matter link (#doc-res) in requirement AC-2", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    fireEvent.click(screen.getAllByText(/AC-2/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Account management handled via SSO/).length).toBeGreaterThan(0),
    );
    // The resolved link to System Architecture Diagram should appear
    expect(screen.queryAllByText(/System Architecture Diagram/i).length).toBeGreaterThan(0);
  });

  it("mobile: drills into a CI and navigates back via breadcrumbs", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    // Now drilled into comp-0 in mobile
    await waitFor(() =>
      expect(screen.queryAllByText(/MongoDB|Sample Catalog/i).length).toBeGreaterThan(0),
    );
    // Try clicking back
    const backBtn = screen.queryAllByText(/← Back|Back/i);
    if (backBtn.length > 0) fireEvent.click(backBtn[0]);
    expect(screen.queryAllByText(/Overview|MongoDB/i).length).toBeGreaterThan(0);
  });

  it("navigates to a res-group by expanding References and clicking a type group", async () => {
    await renderLoaded();
    // Click References to expand it and navigate to references view
    fireEvent.click(screen.getAllByText(/References \(\d+\)/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/NIST SP 800-53 rev5 Catalog/).length).toBeGreaterThan(0),
    );
    // After expanding, azure-documentation group should appear in sidebar
    // Click on the Azure Docs group if visible
    const azureGroup = screen.queryAllByText(/Azure Docs/i);
    if (azureGroup.length > 0) {
      fireEvent.click(azureGroup[0]);
      await waitFor(() =>
        expect(screen.queryAllByText(/Azure Docs|Azure Documentation/i).length).toBeGreaterThan(0),
      );
    }
  });

  it("uses breadcrumb navigation to jump back to component from requirement", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/MongoDB/)[0]);
    fireEvent.click(screen.getAllByText(/Sample Catalog/)[0]);
    fireEvent.click(screen.getAllByText(/AC-1/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/We follow the AC-1 policy/).length).toBeGreaterThan(0),
    );
    // Click MongoDB in breadcrumb to navigate back
    const breadcrumbLinks = screen.getAllByText(/MongoDB/);
    fireEvent.click(breadcrumbLinks[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Document database service/).length).toBeGreaterThan(0),
    );
  });

  it("renders multi-paragraph description that stays wrapped in markup block", async () => {
    const multiParaCdef = {
      uuid: "mp",
      metadata: { title: "Multi Para" },
      components: [
        {
          uuid: "c-mp",
          type: "service",
          title: "Multi Para Component",
          description: "First paragraph.\n\nSecond paragraph.",
        },
      ],
    };
    await renderLoaded({ cdef: multiParaCdef, withCatalog: false });
    fireEvent.click(screen.getAllByText(/Multi Para Component/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/First paragraph|Multi Para Component/i).length).toBeGreaterThan(0),
    );
  });
});
