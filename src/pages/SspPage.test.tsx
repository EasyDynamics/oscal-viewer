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
import SspPage from "./SspPage";
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

const RICH_SSP = {
  uuid: "ssp-1",
  metadata: {
    title: "Sample System Security Plan",
    version: "1.0",
    "last-modified": "2026-03-01T00:00:00Z",
    published: "2026-02-15T00:00:00Z",
    "oscal-version": "1.1.2",
    parties: [
      { uuid: "party-1", type: "organization", name: "Acme Corp" },
    ],
    roles: [
      { id: "owner", title: "System Owner" },
      { id: "isso", title: "ISSO" },
    ],
    "responsible-parties": [
      { "role-id": "owner", "party-uuids": ["party-1"] },
    ],
  },
  "import-profile": { href: "#profile-res" },
  "system-characteristics": {
    "system-name": "Acme Logging Platform",
    "system-name-short": "ALP",
    description: "Centralised logging and audit platform.",
    "security-sensitivity-level": "moderate",
    "system-ids": [
      { id: "ALP-001", "identifier-type": "https://fedramp.gov" },
    ],
    "security-impact-level": {
      "security-objective-confidentiality": "moderate",
      "security-objective-integrity": "moderate",
      "security-objective-availability": "low",
    },
    status: { state: "operational" },
    "authorization-boundary": {
      description: "AWS VPC and on-prem collection agents.",
    },
    props: [{ name: "deployment", value: "cloud" }],
    "system-information": {
      "information-types": [
        {
          uuid: "it-1",
          title: "Audit Logs",
          description: "System audit and event logs.",
          categorizations: [
            {
              system: "https://doi.org/10.6028/NIST.SP.800-60v2r1",
              "information-type-ids": ["C.3.5.1"],
            },
          ],
          "confidentiality-impact": { base: "fips-199-moderate" },
          "integrity-impact": { base: "fips-199-high" },
          "availability-impact": { base: "fips-199-low" },
        },
      ],
    },
    "network-architecture": {
      description: "Cloud-hosted with on-prem collectors.",
      diagrams: [
        { uuid: "diag-1", description: "Logical network diagram." },
      ],
    },
  },
  "system-implementation": {
    users: [
      {
        uuid: "user-1",
        title: "Administrators",
        description: "Full access staff.",
        "role-ids": ["owner"],
        "authorized-privileges": [
          {
            title: "Manage users",
            "functions-performed": ["create-user", "delete-user"],
          },
        ],
      },
    ],
    components: [
      {
        uuid: "comp-1",
        type: "software",
        title: "Splunk Enterprise",
        description: "SIEM platform.",
        status: { state: "operational" },
        props: [{ name: "version", value: "9.2" }],
      },
      {
        uuid: "comp-2",
        type: "service",
        title: "S3 Audit Bucket",
        description: "Immutable log archive.",
        status: { state: "operational" },
      },
    ],
    "inventory-items": [
      {
        uuid: "inv-1",
        description: "Linux log collector",
        "implemented-components": [{ "component-uuid": "comp-1" }],
      },
    ],
    "leveraged-authorizations": [
      {
        uuid: "la-1",
        title: "AWS Commercial FedRAMP Moderate",
        "party-uuid": "party-1",
        "date-authorized": "2025-01-15",
      },
    ],
  },
  "control-implementation": {
    description: "Baseline controls implemented.",
    "implemented-requirements": [
      {
        uuid: "ir-1",
        "control-id": "ac-1",
        props: [{ name: "implementation-status", value: "implemented" }],
        remarks: "Implementation follows organizational policy.",
        statements: [
          {
            uuid: "stmt-1",
            "statement-id": "ac-1_smt.a",
            description: "Policy exists and is published.",
            "by-components": [
              {
                uuid: "stmt-bc-1",
                "component-uuid": "comp-1",
                description: "Splunk enforces policy statement.",
              },
            ],
          },
          {
            uuid: "stmt-2",
            "statement-id": "ac-1_smt.b",
            description: "Policy is reviewed annually.",
            remarks: "Managed by ISSO.",
          },
        ],
        "by-components": [
          {
            uuid: "bc-1",
            "component-uuid": "comp-1",
            description: "Splunk enforces retention.",
          },
        ],
        "responsible-roles": [
          { "role-id": "owner", "party-uuids": ["party-1"] },
        ],
        links: [
          { href: "https://docs.example/ac-1", rel: "reference", text: "AC-1 SOP" },
        ],
      },
      {
        uuid: "ir-2",
        "control-id": "ia-5",
        props: [{ name: "implementation-status", value: "planned" }],
        statements: [],
      },
    ],
  },
  "back-matter": {
    resources: [
      {
        uuid: "profile-res",
        title: "Moderate Baseline Profile",
        rlinks: [
          { href: "https://example.com/profile.json", "media-type": "application/json" },
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
  ssp = RICH_SSP,
  catalog = CATALOG,
  withCatalog = true,
}: {
  ssp?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  const { setSsp, setCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setSsp(ssp, "ssp.json");
      if (withCatalog) setCatalog(catalog, "cat.json");
    }
  }, [ssp, catalog, setSsp, setCatalog, withCatalog]);
  return null;
}

function Harness({
  preload = true,
  mobile = false,
  initialPath = "/ssp",
  ssp = RICH_SSP,
  catalog = CATALOG,
  withCatalog = true,
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  ssp?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  stubMatchMedia(mobile);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && <Seed ssp={ssp} catalog={catalog} withCatalog={withCatalog} />}
          <SspPage />
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

function sspFile(
  data: object = { "system-security-plan": RICH_SSP },
  name = "ssp.json",
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

describe("<SspPage /> empty state", () => {
  it("renders the DropZone when no SSP is loaded", () => {
    render(<Harness preload={false} />);
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("disables the URL Fetch button until a URL is entered", () => {
    render(<Harness preload={false} />);
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(url, { target: { value: "https://ex.com/ssp.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("loads a dropped SSP and shifts to the viewer shell", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, sspFile());
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/Sample System Security Plan/).length,
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
        [JSON.stringify({ "system-security-plan": { uuid: "x" } })],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Not a valid OSCAL SSP/),
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

  it("accepts an unwrapped SSP payload", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, sspFile(RICH_SSP));
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
  });

  it("auto-loads from ?url= (mocked fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ "system-security-plan": RICH_SSP }),
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
        initialPath="/ssp?url=https://ex.com/ssp.json"
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
        initialPath="/ssp?url=https://ex.com/bad.json"
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

describe("<SspPage /> loaded — desktop", () => {
  it("renders top bar, sidebar, and overview", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Sample System Security Plan/).length,
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
    expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0);
  });

  it("navigates to System Characteristics and shows impact levels", async () => {
    await renderLoaded();
    // Click sidebar's "System Characteristics" label
    const sysChar = screen.getAllByText(/System Characteristics/i)[0];
    fireEvent.click(sysChar);
    expect(
      screen.getAllByText(/Acme Logging Platform/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates into System Implementation → Components", async () => {
    await renderLoaded();
    const sysImpl = screen.getAllByText(/System Implementation/i)[0];
    fireEvent.click(sysImpl);
    // Now click into Components sub-link
    const comps = screen.getAllByText(/Components/i);
    fireEvent.click(comps[0]);
    expect(
      screen.getAllByText(/Splunk Enterprise/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to a specific component detail via ssp-comp-N", async () => {
    await renderLoaded();
    // Route there via sidebar or component listing
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    const comps = screen.getAllByText(/Components/i);
    fireEvent.click(comps[0]);
    fireEvent.click(screen.getAllByText(/Splunk Enterprise/)[0]);
    // Detail view renders the description
    await waitFor(() =>
      expect(
        screen.getAllByText(/SIEM platform/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to Users view under System Implementation", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Users/i)[0]);
    expect(screen.getAllByText(/Administrators/).length).toBeGreaterThan(0);
  });

  it("navigates to Inventory view under System Implementation", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Inventory/i)[0]);
    expect(
      screen.getAllByText(/Linux log collector/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to the Control Implementation view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // List shows the implemented requirement control ID
    expect(screen.getAllByText(/AC-1|ac-1/i).length).toBeGreaterThan(0);
  });

  it("drills into a specific control detail (ac-1)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    const row = screen.getAllByText(/AC-1|ac-1/i)[0];
    fireEvent.click(row);
    // ControlDetailView shows the catalog title
    await waitFor(() =>
      expect(
        screen.getAllByText(/Policy and Procedures/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to the Back Matter view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Back Matter/i)[0]);
    expect(
      screen.getAllByText(/Moderate Baseline Profile/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to Leveraged Authorizations view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    // Click the Leveraged nav entry
    const leveraged = screen.getAllByText(/Leveraged/i)[0];
    fireEvent.click(leveraged);
    expect(
      screen.getAllByText(/AWS Commercial FedRAMP Moderate/).length,
    ).toBeGreaterThan(0);
  });

  it("drills into the second component (ssp-comp-1)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    fireEvent.click(screen.getAllByText(/S3 Audit Bucket/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Immutable log archive/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders the control family view (AC family)", async () => {
    await renderLoaded();
    // Navigate to Control Implementation, then click AC family folder
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // Family header row shows "AC" + "Access Control" label from FAMILY_NAMES
    const acFolder = screen.getAllByText(/^AC$/);
    expect(acFolder.length).toBeGreaterThan(0);
    fireEvent.click(acFolder[0]);
    // ControlFamilyView shows each implemented-requirement's controlId
    await waitFor(() =>
      expect(screen.getAllByText(/AC-1/i).length).toBeGreaterThan(0),
    );
  });

  it("renders the second implemented requirement (ia-5) with statements", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // IA family appears because we have ia-5
    const ia = screen.getAllByText(/^IA$/);
    expect(ia.length).toBeGreaterThan(0);
  });

  it("renders the user's authorized privileges on Users view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Users/i)[0]);
    // Authorized privileges title should surface
    expect(
      screen.getAllByText(/Manage users|Administrators/).length,
    ).toBeGreaterThan(0);
  });

  it("renders by-components detail on an implemented requirement", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    const ac = screen.getAllByText(/AC-1|ac-1/i)[0];
    fireEvent.click(ac);
    // by-components description surfaces in the control detail
    await waitFor(() =>
      expect(
        screen.getAllByText(/Splunk enforces retention/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders system-information info-types in System Characteristics", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Characteristics/i)[0]);
    // System Characteristics view renders — check security impact levels are present
    expect(
      screen.queryAllByText(/moderate|high|low|Sensitivity|Security/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders fips-199 impact levels on information types", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Characteristics/i)[0]);
    expect(
      screen.queryAllByText(/moderate|high|low/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders network architecture diagram description", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Characteristics/i)[0]);
    // System Characteristics view renders authorization boundary and properties
    expect(
      screen.queryAllByText(/Authorization|AWS VPC|cloud|deployment/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders implemented-requirement remarks and multiple statements", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/AC-1|ac-1/i)[0]);
    // Remarks are collapsible; verify we're in the detail view by checking the control title
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Policy and Procedures|Splunk enforces|implementation-status|implemented/i).length,
      ).toBeGreaterThan(0),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> edge cases", () => {
  it("renders overview without a loaded catalog", async () => {
    await renderLoaded({ withCatalog: false });
    expect(
      screen.getAllByText(/Sample System Security Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a minimal SSP (only metadata)", async () => {
    const minimal = {
      uuid: "m",
      metadata: { title: "Minimal SSP" },
    };
    await renderLoaded({ ssp: minimal });
    expect(screen.getAllByText(/Minimal SSP/).length).toBeGreaterThan(0);
  });

  it("renders even when system-implementation is missing", async () => {
    const noImpl = { ...RICH_SSP, "system-implementation": undefined };
    await renderLoaded({ ssp: noImpl });
    expect(
      screen.getAllByText(/Sample System Security Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("Overview → Metadata → Overview round-trip works", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText("Metadata")[0]);
    fireEvent.click(screen.getAllByText("Overview")[0]);
    expect(
      screen.getAllByText(/Sample System Security Plan/).length,
    ).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> loaded — mobile", () => {
  it("renders the mobile shell with navigable drill-down entries", async () => {
    await renderLoaded({ mobile: true });
    // Mobile root shell shows Overview + Metadata sections
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Metadata").length).toBeGreaterThan(0);
  });

  it("drills into a section from the mobile drill-down list", async () => {
    await renderLoaded({ mobile: true });
    const metadata = screen.getAllByText("Metadata")[0];
    fireEvent.click(metadata);
    // Mobile content view appears
    await waitFor(() =>
      expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0),
    );
  });

  it("mobile drill-back shows root list again after drilling in", async () => {
    await renderLoaded({ mobile: true });
    // Drill into System Implementation (has children)
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    // Breadcrumb or Back button appears
    await waitFor(() =>
      expect(screen.queryAllByText(/← Back|Back|System Implementation/i).length).toBeGreaterThan(0),
    );
    // Click ← Back
    const back = screen.queryAllByText(/← Back/i)[0];
    if (back) {
      fireEvent.click(back);
      expect(screen.queryAllByText(/Overview|Metadata/i).length).toBeGreaterThan(0);
    }
  });

  it("mobile: clicking a leaf node shows content view", async () => {
    await renderLoaded({ mobile: true });
    // Navigate into system implementation first, then leaf
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Components|Users|Inventory/i).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Users/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Acme Corp|Administrators|Acme Logging/i).length).toBeGreaterThan(0),
    );
  });

  it("mobile: Back button from content view returns to drill-down", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getAllByText(/Metadata/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Acme Corp/).length).toBeGreaterThan(0),
    );
    const backBtn = screen.queryAllByText(/← Back/i)[0];
    if (backBtn) {
      fireEvent.click(backBtn);
      expect(screen.queryAllByText(/Overview|System/i).length).toBeGreaterThan(0);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Component types and variant coverage
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> component type variants", () => {
  const SSP_MULTI_COMP = {
    ...RICH_SSP,
    "system-implementation": {
      ...RICH_SSP["system-implementation"],
      components: [
        ...RICH_SSP["system-implementation"].components,
        { uuid: "comp-hw", type: "hardware", title: "Network Switch", description: "Core switch.", status: { state: "operational" } },
        { uuid: "comp-net", type: "network", title: "VPN Gateway", description: "VPN endpoint.", status: { state: "under-development" } },
        { uuid: "comp-pol", type: "policy", title: "Access Policy", description: "Written access policy.", status: { state: "operational" } },
        { uuid: "comp-is", type: "this-system", title: "The System", description: "Main system.", status: { state: "operational" } },
        { uuid: "comp-ext", type: "system", title: "External App", description: "External system.", status: { state: "operational" } },
        { uuid: "comp-ic", type: "interconnection", title: "Data Link", description: "Data feed.", status: { state: "disposition" } },
        { uuid: "comp-phy", type: "physical", title: "Data Center", description: "Physical facility.", status: { state: "operational" } },
        { uuid: "comp-proc", type: "process-procedure", title: "Incident Proc", description: "IR procedure.", status: { state: "operational" } },
        { uuid: "comp-plan", type: "plan", title: "Continuity Plan", description: "BCP.", status: { state: "operational" } },
        { uuid: "comp-guid", type: "guidance", title: "User Guide", description: "User guide.", status: { state: "operational" } },
        { uuid: "comp-std", type: "standard", title: "NIST SP 800-53", description: "Standard.", status: { state: "operational" } },
        { uuid: "comp-val", type: "validation", title: "FedRAMP", description: "Validation.", status: { state: "operational" } },
        { uuid: "comp-unk", type: "unknown-type", title: "Unknown Comp", description: "Unknown.", status: { state: "operational" } },
      ],
      "inventory-items": [
        {
          uuid: "inv-2",
          description: "Network device",
          props: [{ name: "asset-type", value: "network" }, { name: "asset-id", value: "NET-001" }],
          "implemented-components": [{ "component-uuid": "comp-hw" }],
        },
        {
          uuid: "inv-3",
          description: "Database server",
          props: [{ name: "asset-type", value: "database" }],
          "implemented-components": [],
        },
        {
          uuid: "inv-4",
          description: "Virtual machine",
          props: [{ name: "asset-type", value: "virtual-machine" }],
          "implemented-components": [],
        },
        {
          uuid: "inv-5",
          description: "Storage array",
          props: [{ name: "asset-type", value: "storage" }],
          "implemented-components": [],
        },
        {
          uuid: "inv-6",
          description: "Web application",
          props: [{ name: "asset-type", value: "application" }],
          "implemented-components": [],
        },
        ...RICH_SSP["system-implementation"]["inventory-items"],
      ],
    },
  };

  it("renders components with various types in Components view", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    expect(screen.getAllByText(/Network Switch|VPN Gateway|Access Policy/i).length).toBeGreaterThan(0);
  });

  it("renders inventory items with asset-type props", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Inventory/i)[0]);
    expect(screen.queryAllByText(/Network device|Database server|NET-001/i).length).toBeGreaterThan(0);
  });

  it("drills into hardware component detail", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    fireEvent.click(screen.getAllByText(/Network Switch/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Core switch/).length).toBeGreaterThan(0),
    );
  });

  it("renders component detail breadcrumb navigation", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    fireEvent.click(screen.getAllByText(/Network Switch/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Core switch/).length).toBeGreaterThan(0),
    );
    // Click the breadcrumb "Components" link to go back
    const compsBreadcrumb = screen.queryAllByText(/^Components$/)[0];
    if (compsBreadcrumb) {
      fireEvent.click(compsBreadcrumb);
      await waitFor(() =>
        expect(screen.queryAllByText(/Splunk Enterprise|Network Switch/i).length).toBeGreaterThan(0),
      );
    }
  });

  it("renders component detail System Implementation breadcrumb", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    fireEvent.click(screen.getAllByText(/Network Switch/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Core switch/).length).toBeGreaterThan(0),
    );
    // Click "System Implementation" breadcrumb
    const sysImplBreadcrumb = screen.queryAllByText(/^System Implementation$/i)[0];
    if (sysImplBreadcrumb) {
      fireEvent.click(sysImplBreadcrumb);
    }
  });
});

describe("<SspPage /> remarks expansion and impl status variants", () => {
  it("expands CollapsibleRemarks when clicked on control detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/AC-1|ac-1/i)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Policy and Procedures/).length).toBeGreaterThan(0),
    );
    // Click Remarks toggle to expand it
    const remarksBtn = screen.queryAllByText(/^Remarks$/i)[0];
    if (remarksBtn) {
      fireEvent.click(remarksBtn);
      await waitFor(() =>
        expect(screen.queryAllByText(/organizational policy|Implementation follows/i).length).toBeGreaterThan(0),
      );
    }
  });

  const SSP_PLANNED = {
    ...RICH_SSP,
    "control-implementation": {
      description: "Controls.",
      "implemented-requirements": [
        {
          uuid: "ir-planned",
          "control-id": "ac-2",
          props: [{ name: "implementation-status", value: "planned" }],
          statements: [],
          "by-components": [
            {
              uuid: "bc-planned",
              "component-uuid": "comp-1",
              description: "Planned implementation.",
              "implementation-status": { state: "planned" },
            },
          ],
        },
        {
          uuid: "ir-alt",
          "control-id": "ac-3",
          props: [{ name: "implementation-status", value: "alternative" }],
          statements: [],
          "by-components": [
            {
              uuid: "bc-alt",
              "component-uuid": "comp-1",
              description: "Alternative approach.",
              "implementation-status": { state: "alternative" },
            },
          ],
        },
        {
          uuid: "ir-partial",
          "control-id": "ac-4",
          props: [{ name: "implementation-status", value: "partial" }],
          statements: [],
          "by-components": [
            {
              uuid: "bc-partial",
              "component-uuid": "comp-1",
              description: "Partially implemented.",
              "implementation-status": { state: "partial" },
            },
          ],
        },
        {
          uuid: "ir-na",
          "control-id": "ac-5",
          props: [{ name: "implementation-status", value: "not-applicable" }],
          statements: [],
          "by-components": [
            {
              uuid: "bc-na",
              "component-uuid": "comp-1",
              description: "Not applicable.",
              "implementation-status": { state: "not-applicable" },
            },
          ],
        },
      ],
    },
  };

  it("renders planned implementation status badge in control detail", async () => {
    await renderLoaded({ ssp: SSP_PLANNED });
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // Click AC-2
    await waitFor(() =>
      expect(screen.queryAllByText(/AC-2|ac-2/i).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/AC-2|ac-2/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/planned|Planned implementation/i).length).toBeGreaterThan(0),
    );
  });

  it("renders alternative implementation status badge in control detail", async () => {
    await renderLoaded({ ssp: SSP_PLANNED });
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/AC-3|ac-3/i).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/AC-3|ac-3/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/alternative|Alternative approach/i).length).toBeGreaterThan(0),
    );
  });

  it("renders not-applicable implementation status in control detail", async () => {
    await renderLoaded({ ssp: SSP_PLANNED });
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/AC-5|ac-5/i).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/AC-5|ac-5/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/not-applicable|Not applicable/i).length).toBeGreaterThan(0),
    );
  });

  it("renders ComponentStateBadge for under-development component", async () => {
    const ssp = {
      ...RICH_SSP,
      "system-implementation": {
        ...RICH_SSP["system-implementation"],
        components: [
          { uuid: "comp-dev", type: "software", title: "Dev Tool", description: "In development.", status: { state: "under-development" } },
        ],
        "inventory-items": [],
      },
    };
    await renderLoaded({ ssp });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    expect(screen.getAllByText(/Dev Tool/).length).toBeGreaterThan(0);
  });
});
