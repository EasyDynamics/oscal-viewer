# OSCAL Viewer

A client-side React application for viewing and navigating [OSCAL](https://pages.nist.gov/OSCAL/) (Open Security Controls Assessment Language) documents.

All processing happens in the browser — no server, no uploads, no data leaves your machine.

**Production instance:** [https://viewer.oscal.io](https://viewer.oscal.io)

## OSCAL Models

The app provides a fully implemented SPA-style viewer page for each of the seven OSCAL models, each with sidebar navigation, content drill-down, and cross-reference resolution:

| Model | Description | Key Features |
|---|---|---|
| Catalog | Control definitions and groups | Group/sub-group/control hierarchy; 5-section control views (overview, statement, guidance, examples, assessment method) |
| Profile | Baseline selections / tailoring of catalog controls | Import visualization; parameter constraints; add/remove badges; family/control tree |
| Component Definition | Security capabilities and control implementations | Control-to-component mappings; markdown rendering; MITRE ATT&CK tag rendering |
| System Security Plan (SSP) | Full system authorization package | System characteristics; component hierarchy with service relationships; control implementation with export/inherited/satisfied blocks; leveraged authorization detail with controls-offered tree; provider SSP upload and cross-resolution |
| Assessment Plan | Planned assessment activities | Activity and task views; step parsing; control method tracking |
| Assessment Results | Findings from an assessment | Results → control families → observations drill-down; observation detail views |
| POA&M | Plan of Action and Milestones | POAM items → risks → findings → observations hierarchy; catalog enrichment |

### Common Viewer Features

All model viewers share these capabilities:

- **Sidebar tree navigation** — hierarchical, collapsible tree with icons and badges
- **SPA-style content switching** — navigate without page reloads; scroll-to-top on view change
- **Import/profile chain resolution** — automatically or manually resolve `import-profile` and other OSCAL references
- **Back-matter resource resolution** — link `rlink` references to resources
- **Responsive layout** — mobile-friendly with drill-in navigation on narrow viewports
- **URL loading** — load documents directly via `?url=` query parameter
- **Drag-and-drop upload** — drop JSON files onto the viewer to load them
- **Catalog enrichment** — control detail views pull titles, parts, and parameters from resolved catalogs

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite** — build tool and dev server
- **React Router** — client-side routing
- **Theming** — token-based design system with multiple theme support (Easy Dynamics, OSCAL.io)

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
│   ├── tokens.ts          # Colors, fonts, spacing, radii, shadows
│   ├── themeContract.ts   # CSS-variable contract for theming
│   ├── themeConfig.ts     # Theme registry and configuration
│   ├── applyTheme.ts      # Runtime theme application
│   ├── global.css         # Reset, base styles, font import
│   └── themes/            # Per-tenant theme definitions
├── components/
│   ├── Layout.tsx              # App shell — header + tab navigation
│   ├── Icons.tsx               # Shared SVG icon components
│   ├── PageStub.tsx            # Reusable placeholder page component
│   ├── CookieBanner.tsx        # Cookie consent banner
│   ├── ImportResolverBanner.tsx # Import resolution UI
│   ├── ResolverModal.tsx       # Modal for resolving OSCAL imports
│   ├── ResolveFailSnackbar.tsx # Error notification for failed resolutions
│   └── LinkChips.tsx           # Chip-style link components
├── context/
│   ├── AuthContext.tsx    # Authentication state
│   ├── OscalContext.tsx   # Loaded OSCAL documents + leveraged SSP state
│   └── ThemeContext.tsx   # Active theme state
├── hooks/
│   ├── useImportResolver.ts  # Resolve OSCAL import chains
│   ├── useChainResolver.ts   # Chained profile/catalog resolution
│   ├── useLeveragedIndex.ts  # O(1) lookup maps for leveraged SSP exports
│   ├── useUrlDocument.ts     # Load document from URL query param
│   ├── useCookieConsent.ts   # Cookie consent logic
│   └── useIsMobile.ts        # Responsive breakpoint hook
├── pages/
│   ├── HomePage.tsx                  # Dashboard with model cards
│   ├── CatalogPage.tsx              # Catalog viewer
│   ├── ProfilePage.tsx              # Profile viewer
│   ├── ComponentDefinitionPage.tsx  # Component Definition viewer
│   ├── SspPage.tsx                  # System Security Plan viewer
│   ├── AssessmentPlanPage.tsx       # Assessment Plan viewer
│   ├── AssessmentResultsPage.tsx    # Assessment Results viewer
│   ├── PoamPage.tsx                 # POA&M viewer
│   ├── HowItWorksPage.tsx          # How It Works info page
│   └── PrivacyPolicyPage.tsx        # Privacy Policy page
├── App.tsx               # React Router wiring
└── main.tsx              # Entry point
```

## License

See [LICENSE](LICENSE) for details.