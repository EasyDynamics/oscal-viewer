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
          class: "SP800-53",
          title: "Policy and Procedures",
          props: [{ name: "label", value: "AC-1" }],
          params: [
            {
              id: "ac-1_prm_1",
              label: "organization-defined policy",
            },
            {
              id: "ac-1_prm_2",
              select: { "how-many": "one-or-more", choice: ["annually", "quarterly"] },
            },
          ],
          parts: [
            {
              id: "ac-1-stmt",
              name: "statement",
              prose: "AC-1 body uses {{ insert: param, ac-1_prm_1 }} and {{ insert: param, ac-1_prm_2 }}.",
              parts: [
                {
                  id: "ac-1-stmt-a",
                  name: "item",
                  props: [{ name: "label", value: "a." }],
                  prose: "Sub-statement a.",
                  links: [
                    { href: "https://ex.com/doc", text: "Doc", "resource-fragment": "frag-1" },
                    { href: "#anchor", text: "Anchor" },
                  ],
                },
              ],
            },
            { id: "ac-1-guide", name: "guidance", prose: "AC-1 guidance text." },
            { id: "ac-1-ex", name: "example", prose: "Example text." },
            { id: "ac-1-assess", name: "assessment-method", prose: "Assess via review." },
          ],
          controls: [
            {
              id: "ac-1.1",
              title: "Automated Tooling",
              props: [{ name: "label", value: "AC-1(1)" }],
            },
          ],
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
      { uuid: "party-1", type: "organization", name: "Acme Corp", "short-name": "ACME" },
      { uuid: "party-2", type: "person", name: "Alice Adams" },
    ],
    roles: [
      { id: "owner", title: "System Owner" },
      { id: "assessor", title: "Assessor" },
    ],
    "responsible-parties": [
      { "role-id": "owner", "party-uuids": ["party-1"] },
    ],
    props: [{ name: "marking", value: "CUI" }],
    revisions: [
      {
        title: "Initial draft",
        version: "0.9",
        "last-modified": "2026-01-10T00:00:00Z",
        "oscal-version": "1.1.2",
        remarks: "Initial draft release.",
      },
      {
        // no title → falls back to "Revision <version>"
        version: "0.8",
        "last-modified": "2025-12-15T00:00:00Z",
      },
    ],
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
      types: ["finding"],
      collected: "2026-02-01T00:00:00Z",
      expires: "2027-02-01T00:00:00Z",
      remarks: "Observed during a manual configuration review.",
      origins: [
        { actors: [{ type: "party", "actor-uuid": "party-1" }] },
      ],
      subjects: [
        { type: "component", "subject-uuid": "sub-1" },
        { type: "component", "subject-uuid": "sub-2" },
      ],
      props: [{ name: "severity", value: "high" }],
      links: [{ href: "https://ex.com/obs", text: "Obs link" }],
      "relevant-evidence": [
        { href: "https://ex.com/evidence", description: "Scan report" },
        { href: "https://ex.com/evidence2" },
      ],
    },
    {
      uuid: "obs-2",
      title: "Unencrypted Backup",
      description: "Daily backups lack encryption at rest.",
      methods: ["TEST", "INTERVIEW"],
      collected: "2026-02-05T00:00:00Z",
    },
  ],
  risks: [
    {
      uuid: "risk-1",
      title: "Credential Stuffing Exposure",
      description: "Weak passwords enable credential-stuffing attacks.",
      statement: "An attacker can brute-force accounts given weak password rules.",
      status: "open",
      deadline: "2025-01-01T00:00:00Z", // deliberately in the past → overdue
      "threat-ids": [
        { system: "http://fedramp.gov/ns/oscal", id: "T-001" },
      ],
      characterizations: [
        {
          origin: { actors: [{ type: "party", "actor-uuid": "party-1" }] },
          facets: [
            { name: "likelihood", system: "oscal", value: "high" },
            { name: "impact", system: "oscal", value: "moderate" },
          ],
        },
      ],
      "mitigating-factors": [
        { uuid: "mf-1", description: "Account lockouts reduce exploitability." },
      ],
      remediations: [
        {
          uuid: "rem-1",
          lifecycle: "planned",
          title: "Password Policy Overhaul",
          description: "Rewrite the password policy and roll out to all systems.",
          props: [
            { name: "type", value: "mitigation" },
          ],
          "responsible-roles": [{ "role-id": "owner" }],
          tasks: [
            {
              uuid: "task-1",
              type: "milestone",
              title: "Draft new policy",
              description: "Write the new password policy document.",
              timing: {
                "within-date-range": { start: "2026-03-01T00:00:00Z", end: "2026-04-01T00:00:00Z" },
              },
              "responsible-roles": [{ "role-id": "owner" }],
              dependencies: [{ "task-uuid": "task-dep" }],
            },
            {
              uuid: "task-2",
              type: "action",
              title: "Publish policy",
              description: "Communicate new rules to end users.",
              timing: {
                "on-date": { date: "2026-04-15T00:00:00Z" },
              },
            },
          ],
        },
      ],
      "related-observations": [{ "observation-uuid": "obs-1" }],
      "risk-log": {
        entries: [
          {
            uuid: "log-1",
            title: "Risk identified",
            "start": "2026-02-10T00:00:00Z",
            description: "Initial logging.",
            "logged-by": [{ "party-uuid": "party-1" }],
            "related-responses": [{ "response-uuid": "rem-1" }],
          },
        ],
      },
      props: [{ name: "severity", value: "high" }],
      links: [{ href: "https://ex.com/risk", text: "Risk link" }],
    },
    {
      uuid: "risk-2",
      title: "Data at Rest Exposure",
      description: "Unencrypted backups risk data disclosure.",
      statement: "Theft of backup tapes could expose customer records.",
      status: "investigating",
    },
    {
      uuid: "risk-3",
      title: "Closed Legacy Risk",
      description: "Previously remediated concern.",
      statement: "Closed; retained for audit trail.",
      status: "closed",
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
        status: {
          state: "not-satisfied",
          reason: "insufficient",
          remarks: "Gap identified during review.",
        },
      },
      "implementation-statement-uuid": "impl-1",
      origins: [
        { actors: [{ type: "party", "actor-uuid": "party-1" }] },
      ],
      "related-observations": [{ "observation-uuid": "obs-1" }],
      "related-risks": [{ "risk-uuid": "risk-1" }],
      props: [{ name: "severity", value: "high" }],
      links: [{ href: "https://ex.com/finding", text: "Finding link" }],
    },
    {
      uuid: "find-2",
      title: "Backup Control Satisfied",
      description: "Backup control meets policy.",
      target: {
        type: "statement-id",
        "target-id": "cp-9",
        status: { state: "satisfied" },
      },
    },
  ],
  "poam-items": [
    {
      uuid: "pi-1",
      title: "Strengthen Password Policy",
      description: "Update policy to require 12+ character passwords.",
      props: [{ name: "poam-id", value: "POAM-100" }],
      "responsible-roles": [{ "role-id": "owner" }],
      "required-assets": [
        {
          uuid: "ra-1",
          title: "Updated policy doc",
          description: "New password policy document.",
        },
      ],
      "remediation-tasks": [
        {
          uuid: "rt-1",
          type: "milestone",
          title: "Draft policy",
          "responsible-roles": [{ "role-id": "owner" }],
          dependencies: [{ "task-uuid": "task-dep" }],
        },
      ],
      origins: [
        { actors: [{ type: "party", "actor-uuid": "party-1" }] },
      ],
      "related-findings": [{ "finding-uuid": "find-1" }],
      "related-observations": [{ "observation-uuid": "obs-1" }],
      "related-risks": [{ "risk-uuid": "risk-1" }],
      links: [{ href: "https://ex.com/item", text: "Item link" }],
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
        remarks: "Imported SSP reference.",
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

  it("expands the ControlDetailPanel in a finding detail view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/AC-1 Policy Gap/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Control Details/).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Control Details/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Statement|Guidance|Parameters|Policy and Procedures/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates from POA&M item detail to a related risk via cross-link", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Strengthen Password Policy/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Credential Stuffing Exposure/).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Credential Stuffing Exposure/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Weak passwords enable credential-stuffing attacks/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates from POA&M item detail to a related finding via cross-link", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Strengthen Password Policy/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/AC-1 Policy Gap/).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/AC-1 Policy Gap/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Password policy does not meet AC-1 requirements/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates from POA&M item detail to a related observation via cross-link", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Strengthen Password Policy/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Weak Password Policy/).length).toBeGreaterThan(0),
    );
    // Click the observation row in the related observations section
    const obsLinks = screen.queryAllByText(/Weak Password Policy/);
    fireEvent.click(obsLinks[obsLinks.length - 1]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Minimum password length is 8/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates from Risk detail to a related observation via cross-link", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Credential Stuffing Exposure/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Related Observations/).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Weak Password Policy/).slice(-1)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Minimum password length is 8/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates from Finding detail to a related observation via cross-link", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/AC-1 Policy Gap/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Related Observations/).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Weak Password Policy/).slice(-1)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Minimum password length is 8/).length,
      ).toBeGreaterThan(0),
    );
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

  it("navigates mobile Risks section and drills into a risk", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/Risks \(\d+\)/));
    fireEvent.click(screen.getAllByText(/Credential Stuffing Exposure/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Weak passwords enable credential-stuffing attacks/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates mobile Findings section and drills into a finding", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/Findings \(\d+\)/));
    fireEvent.click(screen.getAllByText(/AC-1 Policy Gap/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Password policy does not meet AC-1 requirements/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates mobile Observations section and drills into an observation", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/Observations \(\d+\)/));
    fireEvent.click(screen.getAllByText(/Weak Password Policy/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Minimum password length is 8/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("mobile back button returns from section list to root menu", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/Risks \(\d+\)/));
    expect(screen.queryAllByText(/Credential Stuffing Exposure/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/← Back/));
    await waitFor(() =>
      expect(screen.queryAllByText(/POA&M Items/).length).toBeGreaterThan(0),
    );
  });
});
