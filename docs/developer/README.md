# Developer README

This guide is for developers who want to run OSCAL Viewer locally, understand the project layout, and make changes safely.

For the beginner project overview, start with [../../README.md](../../README.md).

## Tech stack

- **React 19** and **TypeScript** for the UI.
- **Vite** for the dev server and production build.
- **React Router** for client-side routes.
- **Vitest** and Testing Library for tests.
- **ESLint** for linting.
- **Token-based theming** for Easy Dynamics and OSCAL.io visual themes.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer.
- npm, which comes with Node.js.
- A browser for local testing.

## Local setup

```bash
git clone https://github.com/EasyDynamics/oscal-viewer.git
cd oscal-viewer
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server with hot reload. |
| `npm run build` | Runs TypeScript project checks and creates the production build. |
| `npm run preview` | Serves the production build locally for review. |
| `npm run lint` | Runs ESLint across the repo. |
| `npm run test` | Runs the Vitest suite once. |
| `npm run test:watch` | Runs Vitest in watch mode. |

## VS Code workflow

The repo includes VS Code task and launch configuration. Press **F5** to start the dev server and launch Chrome with the debugger attached.

## Project structure

```text
src/
├── App.tsx                 # React Router wiring
├── main.tsx                # React entry point
├── components/             # Shared UI components
├── context/                # App-level React context providers
├── hooks/                  # OSCAL loading, resolution, and responsive hooks
├── pages/                  # One main page per OSCAL model or static page
├── test/                   # Shared test setup
├── theme/                  # Theme tokens, contracts, config, and CSS
└── utils/                  # Shared domain helpers

samples/                    # Local sample OSCAL files
tests/fixtures/             # Test fixtures
public/                     # Static web app config and public assets
docs/                       # Deeper project documentation
```

## Main app concepts

### Model pages

Each OSCAL model has a page in `src/pages/`. The page usually handles four jobs:

1. read the loaded model data from `OscalContext`;
2. parse the OSCAL JSON into UI-friendly structures;
3. build sidebar navigation state;
4. render the selected detail view.

### Shared OSCAL state

`src/context/OscalContext.tsx` stores the loaded OSCAL documents and exposes setter, clearer, and reader functions for each supported model.

### Import and reference resolution

Resolution hooks in `src/hooks/` help connect related OSCAL documents, such as profile-to-catalog chains and assessment-plan-to-SSP-to-profile-to-catalog chains.

Important hooks include:

- `useUrlDocument()` for loading JSON from a `?url=` query parameter.
- `useImportResolver()` for resolving imports.
- `useChainResolver()` for chained dependency resolution.
- `useLeveragedIndex()` and `useLeveragedSspResolver()` for SSP leveraged authorization support.
- `useOscalGraphResolver()` for resolver graph scenarios.

### Styling and themes

Theme code lives in `src/theme/`.

- `tokens.ts` defines common design tokens.
- `themeContract.ts` defines the CSS variable contract.
- `themeConfig.ts` registers available themes.
- `applyTheme.ts` applies the selected theme at runtime.
- `themes/` contains tenant-specific theme definitions.

Prefer existing tokens and shared visual helpers before adding one-off colors or spacing.

### OSCAL.io viewer hints

Optional viewer-specific props are documented separately in [../oscal-io-extensions/README.md](../oscal-io-extensions/README.md). Keep these hints small, namespaced, and non-normative.

## Adding or changing a feature

1. Identify the model page or shared component that owns the behavior.
2. Check whether similar behavior already exists on another model page.
3. Keep parsing helpers close to the page unless they are clearly reusable.
4. Prefer shared components for badges, links, modals, and layout patterns.
5. Add or update tests when behavior is easy to isolate.
6. Run lint, tests, and build before opening a pull request.

## Testing tips

- Use `samples/` for manual testing in the browser.
- Use `tests/fixtures/` for repeatable automated test data.
- Keep fixtures small enough to understand, but realistic enough to exercise cross-reference behavior.
- Prefer behavior-focused tests over snapshot-heavy tests.

## Build output

`npm run build` writes the optimized production build to `dist/`.

Use `npm run preview` to inspect the built app locally before deployment.

## Troubleshooting

| Symptom | Things to check |
|---|---|
| The dev server does not start | Confirm Node.js is v18 or newer, then rerun `npm install`. |
| A sample file does not load | Confirm it is valid JSON and matches one supported OSCAL model. |
| Import resolution fails | Check browser network access, relative URLs, CORS, and whether the imported document path is reachable. |
| A page renders but lacks enriched control details | Load or resolve the related catalog/profile chain. |
| Theme changes look inconsistent | Reuse tokens from `src/theme/` instead of hard-coded values. |
