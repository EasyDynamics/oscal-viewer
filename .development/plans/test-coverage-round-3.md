# Test coverage — round 3: OscalContext only

_Branch: `claude/test-coverage-round-3` · Date: 2026-04-22_

Narrow scope by design: just cover `src/context/OscalContext.tsx`.
No other files touched. No coverage threshold.

---

## Scope

Exactly one module under test: **`src/context/OscalContext.tsx`**.

- `OscalProvider` — 7 state slots (catalog, componentDefinition,
  profile, ssp, assessmentPlan, assessmentResults, poam), each with
  a paired `setX` / `clearX` callback.
- `isLoaded(modelKey)` — dispatches on a string key for all 7 slots
  plus the default case.
- `useOscal()` — throws if called outside a `<OscalProvider>`.

That's it for this round. No lint, no viewer pages, no hook bodies,
no other contexts.

**Coverage target for this module: 100 % lines and 100 % branches.**
Every `case` in `isLoaded`'s switch (all 7 slots + `default`) gets
exercised. Every setter and clearer gets called. `useOscal()` is
tested both inside and outside a provider.

---

## Approach

`@testing-library/react`'s `renderHook` with a thin `<OscalProvider>`
wrapper. Pattern:

```ts
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OscalProvider>{children}</OscalProvider>
);
const { result } = renderHook(() => useOscal(), { wrapper });
act(() => result.current.setCatalog(fake, "x.json"));
expect(result.current.isLoaded("catalog")).toBe(true);
```

File colocates with the source: `src/context/OscalContext.test.tsx`.

---

## What to test

Concrete case list, covering every branch and every line:

1. `useOscal()` throws with the expected message when no provider is
   in the tree (covers the `if (!ctx) throw` line).
2. `useOscal()` returns the context value when wrapped in
   `<OscalProvider>` (covers the happy return path).
3. Initial state: all 7 slots are `null`, `isLoaded(key)` returns
   `false` for every known key (covers the initial-`useState(null)`
   on each slot and every `case` arm returning `false`).
4. `isLoaded("nonsense-key")` returns `false` (covers the `default`
   branch of the switch).
5. For each of the 7 slots, separately:
   - `setX(data, name)` stores the upload, and the matching context
     field now returns `{ data, fileName }` — covers each `_setX`
     callback.
   - `isLoaded("<slot-key>")` becomes `true` after `setX` — covers
     each non-default `case` returning `true`.
   - `clearX()` resets the slot to `null` and `isLoaded` becomes
     `false` — covers each `clearX` callback.

Count: 2 + 1 + 1 + (7 × 3) = 25 assertions, organised as roughly
10 `it(...)` blocks.

---

## Expected coverage impact

`OscalContext.tsx` is ~240 lines (~100 lines of type declarations
up top, ~120 lines of provider/callbacks/isLoaded, ~20 lines of the
`useOscal` hook). v8 counts statements, not comments or declarations,
so realistically we're adding on the order of 70–100 covered
statements.

Against the ~4.6 k total v8 statement budget that's a **+1.5 – 2 %
line-coverage bump**, taking the overall number from the current
**2.26 %** to roughly **3.8 – 4.3 %**.

Still short of the 5-8 % round-2 aim. That's fine — we're doing
this one piece at a time and no threshold is enforced. The point
of this round is *full coverage of one module*, not moving the
global number.

**Per-file target (hard):** `src/context/OscalContext.tsx` should
report **100 % lines / 100 % branches / 100 % functions** in
`npm run test:coverage` output. If any line or branch shows
uncovered, the test file is incomplete.

---

## Out of scope

- Lint in CI (still next round after coverage rounds settle).
- Tests for `AuthContext` provider, `ThemeContext` provider, any
  hooks with fetch calls.
- Tests for per-page `loadFile` validators.
- Tests for viewer pages.
- Coverage threshold enforcement.
- Any product-code changes.

---

## Files this PR will add or modify

- **Add:** `.development/plans/test-coverage-round-3.md` (this file)
- **Add:** `src/context/OscalContext.test.tsx`

That's it. Two files. No config changes, no product changes, no
workflow changes.
