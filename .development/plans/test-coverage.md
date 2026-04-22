# Test coverage — round 1: harness + CI

_Branch: `claude/test-coverage-audit` · Date: 2026-04-22_

Stand up a working test harness and get a required CI check running.
**No real coverage yet, no lint gate yet** — those are later rounds.

---

## Scope (this round only)

- **Do:** install Vitest, wire minimal config, write two smoke tests,
  add a GitHub Actions workflow that runs tests on push to any branch
  and on PRs into `main`.
- **Don't:** write tests for real logic yet (follow-up round). Don't
  touch ESLint / lint-in-CI (explicitly deferred one round).
- **Don't:** add coverage thresholds, E2E, visual regression, or
  whole-page component tests. Keep it boring.

Success criteria:

1. `npm test` runs locally, exits 0, reports at least one passing test.
2. The new GitHub Actions workflow shows up in the Checks tab on a PR.
3. The workflow can be selected as a required check in branch protection.
4. Nothing else about the build / dev flow changes.

---

## Framework pick

**Vitest + `@testing-library/react` + `jsdom`.** Rationale:

- Vite-native, picks up the existing `vite.config.ts` without a parallel
  build pipeline.
- Jest-compatible API (`describe`, `it`, `expect`), so future hires
  aren't learning a one-off.
- React 19 is supported in `@testing-library/react` ≥ 16.
- `jsdom` is sufficient for component smoke tests without needing a
  real browser.

No Jest. No ts-jest. No Babel config.

---

## Package changes

Add to `devDependencies`:

- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `@vitest/coverage-v8` (future-proof — not wired up this round but
  costs nothing to have installed)
- `jsdom`

New `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

CI uses `npm test`, which is single-pass. Dev uses `npm run test:watch`.

---

## Config

One new file: **`vitest.config.ts`** at the repo root. A separate file
(rather than merging into `vite.config.ts`) keeps the dev-server CORS
proxy plugin and the test config from bleeding into each other.

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
```

And **`src/test/setup.ts`**:

```ts
import "@testing-library/jest-dom/vitest";
```

That's all. No path aliases, no mocks, no custom matchers beyond
`jest-dom`.

Tests live next to the code they test (`foo.ts` → `foo.test.ts`) —
colocation, not a separate `__tests__/` directory.

---

## Sample tests (the two)

Two tests, each proving a different leg of the harness works:

**1. Pure-function test: `src/theme/tokens.test.ts`**
Targets `alpha()` from `src/theme/tokens.ts` — a tiny helper that
wraps a CSS variable in a `color-mix()` expression. Proves
TypeScript + Vitest + file resolution work.

```ts
import { describe, it, expect } from "vitest";
import { alpha } from "./tokens";

describe("alpha()", () => {
  it("defaults to 5% opacity", () => {
    expect(alpha("var(--c)")).toBe("color-mix(in srgb, var(--c) 5%, transparent)");
  });
  it("respects a custom percentage", () => {
    expect(alpha("var(--c)", 40)).toBe("color-mix(in srgb, var(--c) 40%, transparent)");
  });
});
```

**2. Component smoke test: `src/components/PageStub.test.tsx`**
Renders `PageStub` (the unused placeholder component — fine target
because it has no context/provider dependencies). Proves React +
`@testing-library/react` + `jsdom` work together.

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageStub from "./PageStub";

describe("<PageStub />", () => {
  it("renders the title it's given", () => {
    render(
      <PageStub title="Catalog" description="desc" accentColor="#000" icon={null} />
    );
    expect(screen.getByText("Catalog")).toBeInTheDocument();
  });
});
```

That's it. Two files, five lines of real assertion each. If either
fails, something's wrong with the harness.

---

## GitHub Actions workflow

New file: **`.github/workflows/test.yml`**

```yaml
name: Tests

on:
  push:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm test
```

Notes:

- `on: push:` (no filter) runs on every branch pushed, so the check
  exists on feature branches before a PR is opened.
- `on: pull_request: branches: [main]` ensures the check re-runs on
  every PR synchronize event against `main`.
- The workflow is named **Tests** and the job is named **test** — the
  GitHub Actions status check ID becomes `Tests / test`, which is what
  you'd reference in branch-protection settings.
- Node 20: matches the existing `npm ci` flow in the Azure workflow
  (which doesn't pin a version, so we're not breaking parity).
- No coverage upload yet. `@vitest/coverage-v8` is installed but
  unused — we'll wire it in a future round.

**You configure branch protection manually:** mark `Tests / test`
as a required check on `main`. I don't have rights to change repo
settings from here.

---

## Out of scope — explicitly

| Item | Why deferred |
|---|---|
| Lint in CI | User said next round, not this one |
| Tests for `useChainResolver`, `useImportResolver`, `OscalContext`, page validators | This is a harness round; real tests come next |
| Coverage thresholds | No baseline yet; meaningless this round |
| E2E / Playwright | Premature |
| Component tests for the 2k-line viewer pages | Pages need decomposition first |
| Visual regression / snapshot tests | Low-value until UI stabilises |

---

## Rough sequence for later rounds (for reference, not this PR)

1. **(this round)** Harness + CI check.
2. Lint in CI (`npm run lint`) as a second required check.
3. Tests for `useChainResolver` and `useImportResolver` — the suspect
   code from the last round's findings.
4. Tests for `OscalContext` and the per-page `loadFile` validators
   (probably worth extracting the validators into a shared module
   during that round).
5. Page decomposition + component-level tests. Big round.
6. Coverage reporting + threshold gate once we have a real baseline.

---

## Files this PR will add or modify

- **Add:** `.development/plans/test-coverage.md` (this file)
- **Modify:** `package.json` (scripts + devDependencies)
- **Modify:** `package-lock.json` (regenerated by `npm install`)
- **Add:** `vitest.config.ts`
- **Add:** `src/test/setup.ts`
- **Add:** `src/theme/tokens.test.ts`
- **Add:** `src/components/PageStub.test.tsx`
- **Add:** `.github/workflows/test.yml`

No changes to existing product code.
