# Test coverage — round 8: the three bigger components

_Branch: `claude/test-coverage-round-8` · Date: 2026-04-22_

The last non-page surface. All three are interactive components
with state machines, effects, and DOM event handlers. After this
the uncovered surface is almost entirely the 7 viewer pages.

## Scope

| File | LOC | Flavour |
|---|---:|---|
| `src/components/ImportResolverBanner.tsx` | 213 | Stateless display; 3 visual states |
| `src/components/ResolverModal.tsx` | 510 | Modal with activation latch, snapshot refs, skip/continue |
| `src/components/Layout.tsx` | 625 | Shell with nav, mobile menu, JWT popover, outside-click |

Combined: 1,348 LOC. Target: ≥ 95 % lines each, aiming for 100 %
with the same honesty about genuinely unreachable branches we've
shown in prior rounds.

## Per-file approach

### `ImportResolverBanner.tsx`

Stateless function component that picks color scheme by status.
Module-level `injected` flag for keyframe injection — reset with
`vi.resetModules()` to test both first-mount injection and
subsequent-mount short-circuit.

Cases:
- `status="idle"` → renders null.
- `status="loading"` → spinner, shimmer bar, "Resolving {label}…".
- `status="success"` → check icon, "{label} Loaded".
- `status="success"` + resolvedLabel → resolved label row visible.
- `status="error"` → error icon, "{label} Resolution Failed".
- `status="error"` + error message → error row visible.
- Style prop merged into wrapper.
- First mount injects `<style>` keyframes, subsequent don't.

### `ResolverModal.tsx`

The big one. State machine:
- `activated` latches on when any item goes non-idle; only clears
  via `handleContinue`.
- `dismissed` blocks re-display until items reset to all-idle
  (new chain).
- `snapshotRef` keeps the "most advanced" state per item so a
  late reset to idle doesn't wipe visible success/error.
- Continue button disabled while anyLoading; Skip button appears
  only while anyLoading.

Cases:
- No items → null.
- All items idle → null (activated never latches).
- One loading item → modal visible, shimmer bar, "Resolving X…".
- One success item → "All dependencies resolved", Continue enabled.
- Mixed success+error → "Some dependencies could not be resolved".
- Progress bar width reflects done/total.
- Skip button calls `onSkip` and closes.
- Continue button closes and sets `dismissedKeyRef`.
- Re-entry with same item labels after dismiss → stays closed.
- Re-entry with different item labels after dismiss → reopens.
- Snapshot keeps success after item resets to idle.
- Chain empty → deactivates.
- Source icons: GitHub / oscal.io / generic for `resolvedUrl`.
- `modelColor` resolves known labels vs unknown fallback.
- Role=dialog, aria-modal=true, aria-label.

### `Layout.tsx`

Desktop + mobile variants plus a JWT popover. Wrappable in
`MemoryRouter` + the three providers; uses `useOscal`, `useAuth`,
`useTheme`, `useIsMobile`.

Cases:
- Desktop: renders header, tab bar, brand logo, theme toggle,
  JWT icon.
- Mobile: hamburger replaces tab bar; menu opens on click.
- Mobile menu closes on route change.
- Mobile menu closes on outside mousedown / touchstart.
- JWT popover opens on icon click; shows inert "Load" state with
  no token, "Loaded" state with token.
- JWT submit with valid input stores token; invalid input is
  rejected (caught by `isValidJwtFormat`).
- JWT submit with empty/whitespace is no-op.
- JWT clear button removes token.
- JWT popover closes on outside click.
- Theme toggle flips resolvedMode.
- Tab bar uses `oscalModels` array — render every route.
- `brand.logoUrl` branch: the tagline fallback text.
- A `disabled: true` flag flips a tab to "Coming soon" (flag
  inert today but code path testable with a mock of oscalModels).
  If mocking at the module level is painful, skip this case —
  same as the round-4 residuals.

## Mocking approach

- `matchMedia` stub for mobile vs desktop.
- `MemoryRouter` wrapper so `useLocation` works and `NavLink`
  renders.
- Wrap the three providers (`ThemeProvider`, `AuthProvider`,
  `OscalProvider`).
- For outside-click tests, dispatch `MouseEvent('mousedown')`
  directly on `document.body`.

## Out of scope

- Product-code changes.
- Viewer pages, lint, threshold.

## Files added / modified

- Add: `.development/plans/test-coverage-round-8.md`
- Add: `src/components/ImportResolverBanner.test.tsx`
- Add: `src/components/ResolverModal.test.tsx`
- Add: `src/components/Layout.test.tsx`
