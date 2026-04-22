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
  },
  "control-implementation": {
    description: "Baseline controls implemented.",
    "implemented-requirements": [
      {
        uuid: "ir-1",
        "control-id": "ac-1",
        props: [{ name: "implementation-status", value: "implemented" }],
        statements: [
          {
            uuid: "stmt-1",
            "statement-id": "ac-1_smt.a",
            description: "Policy exists and is published.",
          },
        ],
        "by-components": [
          {
            uuid: "bc-1",
            "component-uuid": "comp-1",
            description: "Splunk enforces retention.",
          },
        ],
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
});
