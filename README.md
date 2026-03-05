# OSCAL Viewer

A client-side React application for viewing and navigating [OSCAL](https://pages.nist.gov/OSCAL/) (Open Security Controls Assessment Language) documents. Built by [Easy Dynamics](https://www.easydynamics.com/).

All processing happens in the browser — no server, no uploads, no data leaves your machine.

## OSCAL Models

The app provides a dedicated viewer page for each of the seven OSCAL models:

| Model | Description |
|---|---|
| Catalog | Control definitions and groups |
| Profile | Baseline selections / tailoring of catalog controls |
| Component Definition | Security capabilities and control implementations for components |
| System Security Plan (SSP) | Full system authorization package |
| Assessment Plan | Planned assessment activities |
| Assessment Results | Findings from an assessment |
| POA&M | Plan of Action and Milestones for remediation tracking |

The **Component Definition** viewer is fully implemented with a sidebar navigation tree, SPA-style content switching, back-matter resource resolution, and MITRE ATT&CK tag rendering. The remaining model viewers are stubbed and ready for development.

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite** — build tool and dev server
- **React Router** — client-side routing
- **EZD Brand Tokens** — centralized design system (Navy / Orange / Yellow palette, Roboto font)

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node)

## Getting Started

```bash
# Clone the repo
git clone https://github.com/EasyDynamics/oscal-viewer.git
cd oscal-viewer

# Install dependencies
npm install
```

## Development

Start the Vite dev server with hot-reload:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### VS Code

The repo includes `.vscode/launch.json` and `.vscode/tasks.json`. Press **F5** to start the dev server and launch Chrome with the debugger attached.

## Build

Create an optimized production build:

```bash
npm run build
```

Output is written to the `dist/` directory. To preview it locally:

```bash
npm run preview
```

## Lint

```bash
npm run lint
```

## Project Structure

```
src/
├── theme/
│   ├── tokens.ts        # Colors, fonts, spacing, radii, shadows
│   └── global.css       # Reset, base styles, Roboto import
├── components/
│   ├── Layout.tsx        # App shell — header + tab navigation
│   ├── Icons.tsx         # Shared SVG icon components
│   └── PageStub.tsx      # Reusable placeholder for unfinished viewers
├── pages/
│   ├── HomePage.tsx
│   ├── CatalogPage.tsx
│   ├── ProfilePage.tsx
│   ├── ComponentDefinitionPage.tsx   # Full sidebar + SPA viewer
│   ├── SspPage.tsx
│   ├── AssessmentPlanPage.tsx
│   ├── AssessmentResultsPage.tsx
│   └── PoamPage.tsx
├── App.tsx               # React Router wiring
└── main.tsx              # Entry point
```

## License

See [LICENSE](LICENSE) for details.