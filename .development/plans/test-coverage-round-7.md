# Test coverage — round 7: App + small components

_Branch: `claude/test-coverage-round-7` · Date: 2026-04-22_

Batch round. Covers everything in `src/` that isn't a page and
isn't a context/hook (those are done). Three bigger components —
`ImportResolverBanner`, `ResolverModal`, `Layout` — are deferred
to a separate round because they're bigger and more interactive.

## Scope — 5 files, target 100% each

| File | LOC | Notes |
|---|---:|---|
| `src/App.tsx` | 48 | Router. Test renders and reaches each route path. |
| `src/components/CookieBanner.tsx` | 84 | Hides when consent is set; two action buttons. |
| `src/components/ResolveFailSnackbar.tsx` | 93 | Timer-driven visibility; dismiss button. |
| `src/components/LinkChips.tsx` | 196 | Chip rendering, category resolution, href vs onClick branches. |
| `src/components/Icons.tsx` | 362 | 32 pure SVG icon components. Table-driven render test. |

## Deferred to round 8+

| File | LOC | Why deferred |
|---|---:|---|
| `src/components/ImportResolverBanner.tsx` | 213 | Complex state, needs mocked resolver status |
| `src/components/ResolverModal.tsx` | 510 | Modal with state machine, skip button, close/cancel |
| `src/components/Layout.tsx` | 625 | Nav bar + mobile menu + JWT popover + route-dependent styling |

Plus any product-code cleanup for the dead-branch residuals from
rounds 4, 5, 6 (SSR guards, unreachable else branches).

## Test approach

- Plain `render` from `@testing-library/react` plus `screen` queries.
- Use `MemoryRouter` for `App.tsx` — can't use `BrowserRouter` since
  App already wraps in `BrowserRouter`. Actually easiest: test
  `App` as-is and just verify it mounts and shows the default
  route. Direct route navigation via `MemoryRouter` requires
  extracting the router from App — out of scope.
- `useCookieConsent`, `useIsMobile`, `useTheme` already 100 % covered
  in round 4. CookieBanner just needs reset-cookie-state between
  tests and a stubbed `matchMedia`.
- `ResolveFailSnackbar` uses `setTimeout` for auto-dismiss. Test
  with `vi.useFakeTimers()` for the visibility lifecycle. Won't
  affect React since there's no `waitFor` here (direct assertions).
- `LinkChips`: table-driven test per category, plus href vs
  onClick branches, plus empty-list short-circuit, plus the
  string-label and node-label branches.
- `Icons.tsx`: table-driven render test of all 32 icons — each
  renders and has an `svg` element. Covers every exported function.

## Files added / modified

- Add: `.development/plans/test-coverage-round-7.md` (this)
- Add: `src/App.test.tsx`
- Add: `src/components/CookieBanner.test.tsx`
- Add: `src/components/ResolveFailSnackbar.test.tsx`
- Add: `src/components/LinkChips.test.tsx`
- Add: `src/components/Icons.test.tsx`

No product-code changes.
