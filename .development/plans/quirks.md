# Quirks and observations

_Behavioural discoveries surfaced while writing tests. Updated as rounds land._

This is the scroll for future-me. Every round of test writing reveals
something the code actually does (vs. what it looks like it does).
Captured here so the refactor round has a roadmap and future sessions
pick up faster.

Organised into three buckets:
1. **Product quirks** — real behaviours in the application that tests had to codify
2. **Dead / unreachable branches** — code that can't execute via the public API
3. **Test infrastructure patterns** — what the harness needed to exercise each page

---

## 1. Product quirks (candidates for refactor)

### Duplicate code across files

- `fileNameFromUrl` is defined three times with identical implementations:
  - `src/hooks/useUrlDocument.ts:85` — exported
  - `src/hooks/useImportResolver.ts:113` — internal
  - `src/hooks/useChainResolver.ts:135` — internal
- Inline icon components (IcoBook, IcoInfo, IcoShield, IcoFolder, etc.)
  are re-defined in every page file instead of importing from
  `src/components/Icons.tsx`. `Icons.tsx` has 32 exported icons that
  none of the viewer pages use.

### Dead scaffolding

- `src/components/PageStub.tsx` — fully defined, exported, and tested
  (round 1 smoke test), but imported by nothing.
- `OscalModel.disabled?: boolean` flag — defined in
  `src/theme/tokens.ts:62`, wired into three places (`Layout.tsx:186`
  tab bar, `Layout.tsx:247` mobile menu, `HomePage.tsx:118-145` cards),
  but no entry in `oscalModels[]` ever sets it. All the "Coming soon"
  affordances are unreachable.
- `ExamplesPage.tsx` — referenced in the README's project structure
  tree, removed from the repo in PR #15, README never updated.

### Silently incomplete implementations

- **Profile `controlIds` collector** (`ProfilePage.tsx:748-788`) only
  reads `include-controls.with-ids`. The OSCAL spec's `matching`
  patterns and `exclude-controls` clauses are **silently dropped**.
  A profile that uses `matching: [{pattern: "ac-*"}]` will produce
  zero controls, not the matching set. Real UX bug.
- **`Profile` sidebar** shows control labels (`AC-1`) and never the
  control titles (`Policy and Procedures`). Titles appear in the
  FamilyView control grid and in `ControlModView` detail. Mobile
  drill-down search matches IDs and labels, not titles.
- **`AssessmentPlan.stats.totalActivities`** double-counts when
  activities are associated with multiple tasks. A plan with 2
  local-definitions activities that each back 2 tasks reports "5
  activities" in the sidebar summary. Off-by-confusion, not a hard
  bug, but misleading.

### Shape-of-data assumptions

- All seven viewer page `loadFile` validators use `json["<key>"] ?? json`
  to accept both wrapped and unwrapped root payloads. Tests exercise
  both shapes. This is probably intentional.
- Page validators require only `metadata` (AP, SSP, CDef, Catalog);
  **Profile additionally requires `imports`** (`ProfilePage.tsx:725`)
  and AssessmentResults additionally requires a `results` array that's
  `Array.isArray` true (`AssessmentResultsPage.tsx:519`) and POA&M
  requires a `poam-items` array.
- `OscalContext` treats each slot's `data` as `unknown` except for
  `catalog` which is strictly typed `Catalog`. Any code that reaches
  into profile/ssp/ap/ar/poam data casts.

### Chain resolver fragility

- `useChainResolver` cancels the whole chain on the first step's
  error. Intentional, but worth knowing — one bad hop means nothing
  upstream of it loads.
- File-dropped docs have `sourceUrl = null`, so any relative
  `import-*` href fails at `useChainResolver.ts:260` with
  `"Cannot resolve relative URL … — no base URL available."`
  This is the primary reason viewers feel broken when you drop a
  file instead of loading via `?url=`. Documented in round-1
  findings but worth re-noting.
- The chain resolver's 10-second `setTimeout` that aborts a stuck
  fetch was only covered in tests via `vi.spyOn(setTimeout)` — jsdom
  fake timers break `@testing-library/react`'s `waitFor`. Not a
  product bug, just an in-test gotcha.

### UI/layout quirks

- **Sidebar trees default to collapsed.** CatalogPage and
  ProfilePage collapse all groups/families; ComponentDefinitionPage
  collapses every parent node (components, control-implementations).
  **PoamPage** has mixed defaults — `sec-poam-items` and `sec-risks`
  open; `sec-observations` collapsed; `sec-findings` open only if
  findings exist. Tests have to click chevrons to reveal children
  in the collapsed sections.
- **POA&M mobile uses section-branch drill-down**, not a flat list.
  The root shows "POA&M Items (N)", "Risks (N)", "Findings (N)",
  "Observations (N)" as branch rows; you click a section first,
  then the item inside.
- **AssessmentResultsPage sidebar conditionally renders results.**
  When `ar.results.length === 1`, the sidebar skips the per-result
  row and renders the observation group tree directly. Only when
  there are 2+ results do individual result rows with titles
  appear. Tests that exercise the `ResultView` need a multi-result
  fixture.
- **Observations group by their `control-group` prop.** Missing
  prop → "Uncategorized" group. Seen in
  `AssessmentResultsPage.getControlGroup`.
- **`<Outlet />` tests need Route nesting.** Layout tests wrap in
  `<MemoryRouter><Routes><Route element={<Layout/>}><Route …/></Routes></MemoryRouter>`
  to get `Outlet` to mount a child page. Plain `<Layout/>` renders
  nothing in the main area.
- **Module-level flags in hooks.** `useCookieConsent` has a
  module-level `gaLoaded` flag; `ImportResolverBanner` and
  `ResolverModal` each have a module-level `injected` flag for
  keyframe `<style>` injection. Tests use `vi.resetModules()` +
  re-`import()` to reset between tests.

### Build / CI state (as of round 1)

- No tests in repo before this effort.
- No lint step in CI; `npm run lint` exists but is never invoked.
- Azure Static Web Apps workflow does `npm ci && npm run build`
  and deploys. No gating on anything.
- TypeScript `strict: true`, `noUnusedLocals`, `noUnusedParameters`
  all on. Compile passes cleanly.

---

## 2. Dead / unreachable branches

These are branches the JS engine can't reach via the current public
API surface. Per the coverage-first directive, they stay uncovered
and the refactor round should consider removing them.

| Location | Branch | Why unreachable |
|---|---|---|
| `src/theme/ThemeContext.tsx:34` | `if (typeof window === "undefined") return "light"` | SSR guard, jsdom always has `window` |
| `src/hooks/useIsMobile.ts:11` | same SSR ternary fallback | same |
| `src/hooks/useCookieConsent.ts:32` | `writeConsent(null)` clear-cookie branch | public API only calls with "accepted" or "declined" |
| `src/hooks/useUrlDocument.ts:56` | `.then((data) => if (!cancelled))` | success-then-unmount microtask race |
| `src/hooks/useImportResolver.ts` internal `fileNameFromUrl` catch | `return url` fallback when `new URL()` throws | only called with already-validated `fetchUrl` |
| `src/hooks/useImportResolver.ts:206` | `: "Empty import href."` else | `resolveHref` never returns null-URL for a non-`#` href without also setting `formatError` |
| `src/hooks/useChainResolver.ts` internal `fileNameFromUrl` catch | same | same |
| `src/hooks/useChainResolver.ts` `"Empty import href."` else | same | same |
| `src/hooks/useChainResolver.ts` top-of-for-loop `if (cancelled) return` | needs cancellation landing synchronously between iterations | no yield point between `setSteps(success)` of step N and start of step N+1 |

All nine would close with either `/* v8 ignore next */` comments or
small product-code edits (delete the dead branch). Neither counts
as "refactor" — they're clean-up after evidence is in.

---

## 3. Test infrastructure patterns

What every new page test needs. Factoring this into a shared helper
file is an obvious future move, but for now each page's test carries
its own copies.

### Global stubs (beforeEach)

```ts
stubMatchMedia(false);  // every page calls matchMedia somewhere
Element.prototype.scrollTo = vi.fn();  // pages use contentRef.scrollTo after navigate
```

### Providers wrapper

```tsx
<MemoryRouter initialEntries={[path]}>
  <AuthProvider>
    <OscalProvider>
      {preload && <Seed … />}
      <Page />
    </OscalProvider>
  </AuthProvider>
</MemoryRouter>
```

### Seed pattern

```tsx
function Seed({ data, ... }) {
  const { setX, setCatalog, ... } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setX(data, "x.json");
      // optionally setCatalog(...)
    }
  }, [...]);
  return null;
}
```

**The `didSeed` ref is load-bearing.** First attempt used `!current`
as the guard, which re-seeded after `New File` wiped state — breaking
every "New File resets to DropZone" test. The ref-based one-shot is
the right pattern.

### renderLoaded helper

```ts
async function renderLoaded(props = {}) {
  const utils = render(<Harness preload {...props} />);
  await waitFor(() => expect(screen.queryByText(/* landmark */)).not.toBeNull());
  return utils;
}
```

Every loaded-state test awaits this to handle the post-mount effect
flip. Using `screen.queryAllByText(…).length > 0` avoids the
multiple-matches throw when the landmark text appears in both sidebar
and content.

### File drop

```ts
function fireDrop(zone: Element, file: File) {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}
```

Simple plain-object `dataTransfer` works. Don't bother constructing
a real `DataTransfer`.

### Dropzone selector

```ts
const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
```

All seven viewer pages use a dashed-border div for the dropzone.
Fragile but works because every page follows the same scaffold.

### Finding text

Use `getAllByText` + `.length` assertions instead of `getByText` for
anything that might appear in both sidebar and content panel. Almost
every content title does.

### Timer-based tests

`vi.useFakeTimers()` breaks `@testing-library/react`'s `waitFor`.
For the 10 s abort test in `useChainResolver` / `useImportResolver`,
`vi.spyOn(globalThis, "setTimeout")` captures the callback without
freezing polls — fire it manually when you want the timeout to hit.

### FileReader

Works natively in jsdom. No stub needed.

---

## Provenance notes

The codebase has strong LLM-generation signature. The most visible
tells:

- Seven viewer pages with near-identical scaffolds (same comment
  banners, imports in same order, same state-machine shape, same
  validation-error copy verbatim).
- `fileNameFromUrl` regenerated in three places instead of imported.
- Icons re-defined per page instead of imported from `Icons.tsx`.
- Dead scaffolding (`disabled` flag, `PageStub`, scaffolded-but-unused
  imports) typical of "generate for completeness" output.
- Box-comment banners with `═══` bars around every section.
- Defensive code for states the adjacent code can't produce
  (the "Empty import href" else branches).

Most likely workflow: one engineer using an LLM-assisted editor,
generated the seven viewers by pattern ("same structure as the last
one"), then focused human iteration on AssessmentPlanPage only
(commits #47 and #43, +618 lines total, single file). No tests, no
lint gate, no end-to-end verification. The tests this effort is
writing are the verification pass that shipped incomplete the first
time.

This isn't a criticism of the code — it works, it deploys, it
shows OSCAL documents in a browser. But the quirks above are the
specific places where "LLM pattern-matched the surface" didn't
translate into "actually implements the spec correctly."

---

## Refactor candidates (for when coverage is full)

Not this round, not until global is at 100%. But the list is
written down so the eventual refactor has a starting point.

1. **Extract `fileNameFromUrl` to a shared util.** Kill the three copies.
2. **Import icons from `Icons.tsx` across pages.** Kill the inline re-definitions.
3. **Delete `PageStub`** or actually wire it in.
4. **Delete the `disabled` flag mechanism** or use it to gate the
   viewers that don't work (round-1 findings showed only AP works
   end-to-end).
5. **Fix the Profile controlIds collector** to honour `matching`
   and `exclude-controls`. This is a real spec conformance bug.
6. **Share the viewer-page shell** — top bar + sidebar + view-router
   + mobile drill-down is near-duplicated across seven files. A
   `<ViewerShell>` component that takes per-model configuration
   would collapse thousands of LOC.
7. **Delete SSR guards** — the app is explicitly client-only, no
   SSR. Guards are dead code in every environment we deploy to.
8. **Delete the dead "Empty import href" branches** in both
   resolvers. Pair with a small proof that `resolveHref` can't
   produce the state they guard against.
9. **Fix `AssessmentPlan.stats.totalActivities` double-counting.**
10. **Consolidate `useImportResolver` and `useChainResolver`.** They
    share 80% of their logic; one is a degenerate case of the
    other.
11. **README truth-up.** Kill the stale claims about stubs /
    `ExamplesPage`.

Each of these would light up several tests (the brittle ones are a
feature, per the scroll-carrier directive). When the tests scream,
you know you've touched a real behaviour.
