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
import PoamPage from "./PoamPage";
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
          parts: [{ id: "ac-1-stmt", name: "statement", prose: "AC-1 body." }],
        },
      ],
    },
  ],
};

const RICH_POAM = {
  uuid: "poam-1",
  metadata: {
    title: "Sample POA&M",
    version: "1.0",
    "last-modified": "2026-03-01T00:00:00Z",
    published: "2026-02-15T00:00:00Z",
    "oscal-version": "1.1.2",
    parties: [
      { uuid: "party-1", type: "organization", name: "Acme Corp" },
    ],
    roles: [{ id: "owner", title: "System Owner" }],
  },
  "import-ssp": { href: "#ssp-res" },
  "system-id": {
    "identifier-type": "http://ietf.org/rfc/rfc4122",
    id: "sys-1234",
  },
  observations: [
    {
      uuid: "obs-1",
      title: "Weak Password Policy",
      description: "Minimum password length is 8, should be 12.",
      methods: ["EXAMINE"],
      collected: "2026-02-01T00:00:00Z",
      "relevant-evidence": [
        { href: "https://ex.com/evidence", description: "Scan report" },
      ],
    },
    {
      uuid: "obs-2",
      title: "Unencrypted Backup",
      description: "Daily backups lack encryption at rest.",
      methods: ["TEST"],
      collected: "2026-02-05T00:00:00Z",
    },
  ],
  risks: [
    {
      uuid: "risk-1",
      title: "Credential Stuffing Exposure",
      description: "Weak passwords enable credential-stuffing attacks.",
      status: "open",
      "related-observations": [{ "observation-uuid": "obs-1" }],
      "risk-log": {
        entries: [
          {
            uuid: "log-1",
            title: "Risk identified",
            "start": "2026-02-10T00:00:00Z",
            description: "Initial logging.",
          },
        ],
      },
    },
    {
      uuid: "risk-2",
      title: "Data at Rest Exposure",
      description: "Unencrypted backups risk data disclosure.",
      status: "investigating",
    },
  ],
  findings: [
    {
      uuid: "find-1",
      title: "AC-1 Policy Gap",
      description: "Password policy does not meet AC-1 requirements.",
      target: {
        type: "objective-id",
        "target-id": "ac-1",
        status: { state: "not-satisfied" },
      },
      "related-observations": [{ "observation-uuid": "obs-1" }],
      "related-risks": [{ "risk-uuid": "risk-1" }],
    },
  ],
  "poam-items": [
    {
      uuid: "pi-1",
      title: "Strengthen Password Policy",
      description: "Update policy to require 12+ character passwords.",
      "related-findings": [{ "finding-uuid": "find-1" }],
      "related-observations": [{ "observation-uuid": "obs-1" }],
      "related-risks": [{ "risk-uuid": "risk-1" }],
    },
    {
      uuid: "pi-2",
      title: "Encrypt Backup Volumes",
      description: "Enable AES-256 on all backup jobs.",
      "related-observations": [{ "observation-uuid": "obs-2" }],
      "related-risks": [{ "risk-uuid": "risk-2" }],
    },
  ],
  "back-matter": {
    resources: [
      {
        uuid: "ssp-res",
        title: "Source SSP",
        rlinks: [
          { href: "https://example.com/ssp.json", "media-type": "application/json" },
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
  poam = RICH_POAM,
  catalog = CATALOG,
  withCatalog = true,
}: {
  poam?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  const { setPoam, setCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setPoam(poam, "poam.json");
      if (withCatalog) setCatalog(catalog, "cat.json");
    }
  }, [poam, catalog, setPoam, setCatalog, withCatalog]);
  return null;
}

function Harness({
  preload = true,
  mobile = false,
  initialPath = "/poam",
  poam = RICH_POAM,
  catalog = CATALOG,
  withCatalog = true,
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  poam?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  stubMatchMedia(mobile);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && <Seed poam={poam} catalog={catalog} withCatalog={withCatalog} />}
          <PoamPage />
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

function poamFile(
  data: object = { "plan-of-action-and-milestones": RICH_POAM },
  name = "poam.json",
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

describe("<PoamPage /> empty state", () => {
  it("renders the DropZone when no POA&M is loaded", () => {
    render(<Harness preload={false} />);
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("disables the URL Fetch button until a URL is entered", () => {
    render(<Harness preload={false} />);
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(url, { target: { value: "https://ex.com/poam.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("loads a dropped POA&M and shifts to the viewer shell", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, poamFile());
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/Sample POA&M|Sample POA/).length,
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
        [
          JSON.stringify({
            "plan-of-action-and-milestones": {
              uuid: "x",
              "poam-items": [],
            },
          }),
        ],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText(/no metadata/)).toBeInTheDocument(),
    );
  });

  it("rejects JSON missing poam-items array", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File(
        [
          JSON.stringify({
            "plan-of-action-and-milestones": {
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
      expect(screen.getByText(/no poam-items array/)).toBeInTheDocument(),
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

  it("accepts an unwrapped POA&M payload", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, poamFile(RICH_POAM));
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
  });

  it("auto-loads from ?url= (mocked fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ "plan-of-action-and-milestones": RICH_POAM }),
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
        initialPath="/poam?url=https://ex.com/p.json"
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
        initialPath="/poam?url=https://ex.com/bad.json"
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

describe("<PoamPage /> loaded — desktop", () => {
  it("renders top bar, sidebar, and overview", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Sample POA/).length,
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

  it("navigates to a POA&M item detail", async () => {
    await renderLoaded();
    fireEvent.click(
      screen.getAllByText(/Strengthen Password Policy/)[0],
    );
    // Detail view shows description
    await waitFor(() =>
      expect(
        screen.getAllByText(/Update policy to require 12\+ character passwords/)
          .length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows related observations, risks, findings on a POA&M item", async () => {
    await renderLoaded();
    fireEvent.click(
      screen.getAllByText(/Strengthen Password Policy/)[0],
    );
    // Should surface the related titles
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Weak Password Policy/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to a Risk detail", async () => {
    await renderLoaded();
    const riskRow = screen.getAllByText(/Credential Stuffing Exposure/)[0];
    fireEvent.click(riskRow);
    await waitFor(() =>
      expect(
        screen.getAllByText(
          /Weak passwords enable credential-stuffing attacks/,
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to a Finding detail", async () => {
    await renderLoaded();
    const findingRow = screen.getAllByText(/AC-1 Policy Gap/)[0];
    fireEvent.click(findingRow);
    await waitFor(() =>
      expect(
        screen.getAllByText(
          /Password policy does not meet AC-1 requirements/,
        ).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to an Observation detail (after expanding Observations section)", async () => {
    await renderLoaded();
    // Observations section is collapsed by default — click the header to expand
    fireEvent.click(screen.getByText(/Observations \(\d+\)/));
    const obsRow = screen.getAllByText(/Weak Password Policy/)[0];
    fireEvent.click(obsRow);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Minimum password length is 8/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("round-trips back to Overview via sidebar", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText("Metadata")[0]);
    fireEvent.click(screen.getAllByText("Overview")[0]);
    expect(
      screen.getAllByText(/Sample POA/).length,
    ).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<PoamPage /> edge cases", () => {
  it("renders overview without a loaded catalog", async () => {
    await renderLoaded({ withCatalog: false });
    expect(
      screen.getAllByText(/Sample POA/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a minimal POA&M (metadata + empty poam-items)", async () => {
    const minimal = {
      uuid: "m",
      metadata: { title: "Minimal POA&M" },
      "poam-items": [],
    };
    await renderLoaded({ poam: minimal });
    expect(
      screen.getAllByText(/Minimal POA/).length,
    ).toBeGreaterThan(0);
  });

  it("handles a POA&M with no risks, findings, or observations", async () => {
    const bare = {
      uuid: "b",
      metadata: { title: "Bare POA&M" },
      "poam-items": [
        { uuid: "pi-x", title: "Just one item", description: "Simple." },
      ],
    };
    await renderLoaded({ poam: bare });
    expect(screen.getAllByText(/Just one item/).length).toBeGreaterThan(0);
  });

  it("search filters the sidebar", async () => {
    await renderLoaded();
    const search = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(search, { target: { value: "Encrypt" } });
    expect(
      screen.getAllByText(/Encrypt Backup Volumes/).length,
    ).toBeGreaterThan(0);
  });

  it("renders the Risk detail with status and description", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Credential Stuffing Exposure/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Weak passwords enable credential-stuffing attacks/)
          .length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders the Finding detail with related risks and observations cross-links", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/AC-1 Policy Gap/)[0]);
    // Finding view surfaces related observation + risk titles
    await waitFor(() => {
      const haveRelated =
        screen.queryAllByText(/Weak Password Policy/).length > 0 ||
        screen.queryAllByText(/Credential Stuffing Exposure/).length > 0;
      expect(haveRelated).toBe(true);
    });
  });

  it("drills from an Observation detail and shows methods + evidence", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/Observations \(\d+\)/));
    fireEvent.click(screen.getAllByText(/Weak Password Policy/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Minimum password length is 8/).length,
      ).toBeGreaterThan(0),
    );
    // Methods surface
    expect(
      screen.getAllByText(/EXAMINE|examine/i).length,
    ).toBeGreaterThan(0);
  });

  it("expands the Observations section and lists all observations", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/Observations \(\d+\)/));
    expect(
      screen.getAllByText(/Weak Password Policy/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Unencrypted Backup/).length,
    ).toBeGreaterThan(0);
  });

  it("drills into a POA&M item showing poam-id prop when present", async () => {
    // Extend fixture for this test only
    const withPoamId = {
      ...RICH_POAM,
      "poam-items": [
        {
          uuid: "pi-withid",
          title: "Add encryption",
          description: "Encrypt backup volumes",
          props: [{ name: "poam-id", value: "POAM-001" }],
        },
      ],
    };
    await renderLoaded({ poam: withPoamId });
    // Sidebar label should include the poam-id prefix
    expect(
      screen.getAllByText(/POAM-001/).length,
    ).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<PoamPage /> loaded — mobile", () => {
  it("renders the mobile shell with navigable drill-down entries", async () => {
    await renderLoaded({ mobile: true });
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
  });

  it("drills into a POA&M item on mobile via the POA&M Items section", async () => {
    await renderLoaded({ mobile: true });
    // Mobile root shows section branches — click into POA&M Items first
    fireEvent.click(screen.getByText(/POA&M Items \(\d+\)/));
    // Now the item list is shown; click the first POA&M item
    fireEvent.click(screen.getAllByText(/Strengthen Password Policy/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Update policy to require 12/).length,
      ).toBeGreaterThan(0),
    );
  });
});
