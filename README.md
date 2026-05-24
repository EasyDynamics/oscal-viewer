# OSCAL Viewer

OSCAL Viewer is a friendly, browser-based way to open and explore [OSCAL](https://pages.nist.gov/OSCAL/) JSON files.

If you are new to OSCAL, think of this project as a map reader: OSCAL is the structured data, and this viewer turns that data into pages, trees, badges, links, and drill-down views that are easier to understand.

All processing happens in your browser. Files are not uploaded to a server.

**Try it online:** [https://viewer.oscal.io](https://viewer.oscal.io)

**Learn about OSCAL from NIST:** [https://pages.nist.gov/OSCAL/](https://pages.nist.gov/OSCAL/)

## Who this is for

- You are learning OSCAL and want to see what the files look like when rendered.
- You have OSCAL JSON files and want to inspect them without writing code.
- You are a developer who wants to run the viewer locally and make changes.
- You are producing OSCAL content and want to understand the small set of OSCAL.io viewer hints.

## What is OSCAL?

OSCAL stands for **Open Security Controls Assessment Language**. It is a NIST standard for representing security and compliance information as structured data.

In plain language, OSCAL helps describe things like:

- security controls and control catalogs;
- tailored baselines and profiles;
- system security plans;
- component implementations;
- assessment plans, results, findings, risks, and POA&Ms.

You do not need to be an OSCAL expert to start using this viewer. Start with a sample file, open a model page, and use the sidebar to explore.

## Fastest way to use the viewer

1. Open [https://viewer.oscal.io](https://viewer.oscal.io).
2. Choose the OSCAL model you want to view.
3. Drag an OSCAL JSON file onto the page, or use a URL with `?url=`.
4. Use the left sidebar to drill into controls, systems, observations, findings, tasks, and related content.

Sample files are available in [samples/README.md](samples/README.md).

## Run it locally

You only need [Node.js](https://nodejs.org/) v18 or newer and npm.

```bash
git clone https://github.com/EasyDynamics/oscal-viewer.git
cd oscal-viewer
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## What the viewer can open

| OSCAL model | Beginner-friendly description | Viewer highlights |
|---|---|---|
| Catalog | A library of security controls | Control groups, statements, guidance, examples, and assessment methods |
| Profile | A tailored baseline built from one or more catalogs | Imports, selected controls, parameters, additions, and removals |
| Component Definition | How products or services implement controls | Component mappings, implementation statements, references, and badges |
| System Security Plan (SSP) | A system authorization package | System details, components, implemented controls, inherited controls, and leveraged authorizations |
| Assessment Plan | What an assessment plans to test | Activities, tasks, steps, methods, and related controls |
| Assessment Results | What an assessment found | Results, observations, findings, risks, and control drill-downs |
| POA&M | Remediation plan and milestones | POA&M items, risks, findings, observations, and catalog enrichment |

## Common features

- **Drag-and-drop loading** for local JSON files.
- **URL loading** with `?url=` for raw OSCAL JSON.
- **Sidebar navigation** for large documents.
- **Cross-reference resolution** for imports, profiles, catalogs, resources, and leveraged SSPs.
- **Catalog enrichment** so related control details can appear where useful.
- **Responsive layout** for desktop and mobile screens.
- **Browser-only processing** so files stay on your machine unless you intentionally load them from a URL.

## Documentation map

Start here, then drill down as needed:

- [docs/README.md](docs/README.md) — documentation index.
- [docs/developer/README.md](docs/developer/README.md) — local development, project structure, scripts, and architecture notes.
- [docs/oscal-io-extensions/README.md](docs/oscal-io-extensions/README.md) — preview of first-class OSCAL props and OSCAL.io viewer hints.
- [samples/README.md](samples/README.md) — sample file naming and local testing notes.

## For developers in a hurry

```bash
npm run dev       # start local Vite dev server
npm run build     # type-check and create production build
npm run preview   # preview production build locally
npm run lint      # run ESLint
npm run test      # run Vitest tests
```

See the full developer guide in [docs/developer/README.md](docs/developer/README.md).

## Privacy

The viewer is designed as a client-side app. Opening a local file processes it in the browser; the file is not uploaded by the app.

If you load a document through a remote URL, your browser will request that URL directly.

## License

See [LICENSE](LICENSE) for details.
