# Test coverage — round 2: easiest pure functions

_Branch: `claude/test-coverage-round-2` · Date: 2026-04-22_

Follow-on to round 1 (Vitest harness + CI). Now actually write tests
against the easiest-to-cover code in the repo. Target **5-8% total
line coverage**. **No coverage threshold / gate** — we just want to
see the number.

Also: **disable the deploy half of the Azure Static Web Apps
workflow** so pushes to this branch don't ship anything to production.

---

## Scope

- **Do:** pick pure exported helpers across four files, write
  deterministic unit tests, wire up `@vitest/coverage-v8` (already
  installed) with a `test:coverage` npm script. Disable the Azure
  deploy trigger.
- **Don't:** touch any product code, set coverage thresholds, add
  lint-in-CI (still next round), or test anything that requires
  React rendering / mocked fetch / context providers.

Success criteria:

1. `npm run test:coverage` runs locally, exits 0, prints a coverage
   summary.
2. Total line coverage lands somewhere in the 5–8% range.
3. The new tests would catch real regressions if anyone changed the
   tested helpers.
4. Azure workflow no longer runs on push / PR (but the file stays so
   it's trivial to re-enable).

---

## Target functions

All exported, all pure (no network, no React, no state), all small.
Picked because they're both *easy* and *high-value* — these helpers
are on the suspected-failure path from round 1's findings.

| Function | File | Why it's worth testing |
|---|---|---|
| `isValidJwtFormat` | `src/context/AuthContext.tsx:29` | Guards what we store in sessionStorage. Handles both JWS (3 parts) and JWE (5 parts, with possibly-empty encrypted-key). Non-obvious regex + shape rules. |
| `authHeaders` | `src/context/AuthContext.tsx:115` | Trivial bearer-header builder. Smoke case. |
| `checkUrlFormat` | `src/hooks/useImportResolver.ts:48` | Pre-flight rejection of non-JSON URL extensions. One failure here stops chain resolution dead. |
| `resolveHref` | `src/hooks/useImportResolver.ts:79` | Handles direct URLs *and* `#uuid` back-matter lookups *and* prefers JSON rlinks over XML. The most logic-dense helper in the batch. |
| `extractCatalogFromProfile` | `src/hooks/useChainResolver.ts:53` | First link in every chain that ends at a catalog. |
| `extractProfileFromSsp` | `src/hooks/useChainResolver.ts:67` | SSP/POA&M chain step. |
| `extractSspFromAp` | `src/hooks/useChainResolver.ts:83` | AP chain step. |
| `fileNameFromUrl` | `src/hooks/useUrlDocument.ts:85` | Used for display labels everywhere. |

---

## Coverage wiring

Extend `vitest.config.ts`:

```ts
test: {
  // …existing…
  coverage: {
    provider: "v8",
    reporter: ["text", "text-summary", "html"],
    include: ["src/**/*.{ts,tsx}"],
    exclude: [
      "src/**/*.test.{ts,tsx}",
      "src/test/setup.ts",
      "src/main.tsx",
      "src/vite-env.d.ts",
    ],
  },
},
```

Add to `package.json`:

```json
"test:coverage": "vitest run --coverage"
```

No thresholds. CI still runs `npm test` (no coverage flag). Coverage
is a local-inspection thing for now.

`.gitignore` will gain `coverage/` so the HTML report doesn't get
committed.

---

## Disabling the Azure deploy

The current workflow at
`.github/workflows/azure-static-web-apps-black-sea-0e2be830f.yml`
does checkout → install → build → deploy on every push to `main` and
every PR event against `main`.

Change its `on:` block to:

```yaml
on:
  workflow_dispatch:   # manual-only; disabled while test coverage ramps up
```

Leaves the file (and its Azure secrets wiring) intact, but neither
push nor PR events will trigger it. Re-enable by restoring the
original triggers.

Rationale: the user asked for the deploy part specifically disabled.
Keeping the workflow file around avoids losing the Azure SWA
configuration (deploy token secret, preview-URL comment logic,
close-pull-request job). `workflow_dispatch` is the cleanest "paused"
state.

---

## Expected coverage mix

Rough back-of-envelope:

| File | Lines | Covered lines (approx) |
|---|---:|---:|
| `AuthContext.tsx` | 160 | ~25 (helpers, not provider/hook/authFetch) |
| `useImportResolver.ts` | 304 | ~30 (helpers, not hook) |
| `useChainResolver.ts` | 406 | ~20 (extractors, not hook) |
| `useUrlDocument.ts` | 93 | ~10 (helper only) |
| `theme/tokens.ts` | 118 | ~5 (alpha, from round 1) |
| `components/PageStub.tsx` | 91 | ~25 (from round 1) |

Total covered ≈ 115 lines against a codebase total around 19,000
lines → ≈ 0.6 %. That's well below 5 %.

Bumping to the target means **also covering larger portions of the
touched files**, by exercising the hook pure paths too — e.g. unit
tests against helper-shaped internals that aren't currently exported.
Plan: if the first pass falls short of 5 %, add a few extra cases
that push further into branchy code (more `isValidJwtFormat` cases,
more `resolveHref` back-matter variants) to climb the number without
touching product code.

If we still can't clear 5 %, that's a finding worth calling out in
the PR body rather than padding with make-work assertions.

### Actual coverage — as measured

After writing every test described below plus bonus `applyTheme` /
`buildCssVarColors` coverage, the final `npm run test:coverage`
result was:

```
Statements   : 2.12% ( 117/5504 )
Branches     : 1.19% ( 69/5791 )
Functions    : 1.13% ( 20/1767 )
Lines        : 2.26% ( 105/4641 )
```

Below the 5-8 % target. The arithmetic is unavoidable: the seven
viewer pages contribute ~18 k of the ~19 k LOC (and ~4.1 k of the
4.6 k v8 statement budget). Even 100 % coverage of every
non-page file wouldn't clear 25 %; pure-helper coverage alone caps
out in the low single digits.

Concretely, the covered modules are in good shape:

| Module | Lines covered |
|---|---:|
| `src/theme/applyTheme.ts` | 100 % |
| `src/theme/themeConfig.ts` | 100 % |
| `src/theme/tokens.ts` | ≈ 100 % (folder aggregate 100 %) |
| `src/context/AuthContext.tsx` | 27.5 % (pure helpers only) |
| `src/hooks/useImportResolver.ts` | 21.3 % (pure helpers only) |
| `src/hooks/useChainResolver.ts` | 15.2 % (extractors only) |
| `src/hooks/useUrlDocument.ts` | 13.5 % (`fileNameFromUrl` only) |
| `src/components/PageStub.tsx` | from round 1 smoke |

Nothing in `src/pages/*` or the larger components is covered yet,
which is the correct scope for this round.

Getting into the 5-8 % range from here means reaching into hook
bodies (`renderHook` + mocked fetch) or context providers
(`<OscalProvider>` + `renderHook`). Both were explicitly out of
scope for this round. **Flagged in the PR body; deferred to
round 3.**

---

## Out of scope

- Tests for the hook bodies (`useImportResolver`, `useChainResolver`,
  `useAuth`). These need `renderHook` + mocked `fetch`. Next round.
- Tests for `OscalContext` and the per-page `loadFile` validators.
- Tests for the 2k-line viewer pages.
- Snapshot tests.
- CI-enforced coverage threshold.
- Mutation testing. Accessibility testing. Visual regression. E2E.

---

## Files this PR will add or modify

- **Add:** `.development/plans/test-coverage-round-2.md` (this file)
- **Add:** `src/context/AuthContext.test.ts`
- **Add:** `src/hooks/useImportResolver.test.ts`
- **Add:** `src/hooks/useChainResolver.test.ts`
- **Add:** `src/hooks/useUrlDocument.test.ts`
- **Modify:** `vitest.config.ts` (coverage block)
- **Modify:** `package.json` (new `test:coverage` script)
- **Modify:** `.gitignore` (ignore `coverage/`)
- **Modify:** `.github/workflows/azure-static-web-apps-…yml`
  (disable auto-triggers; keep `workflow_dispatch`)

No changes to existing product code.
