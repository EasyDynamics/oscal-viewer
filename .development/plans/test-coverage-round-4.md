# Test coverage — round 4: mop up small context/hook modules

_Branch: `claude/test-coverage-round-4` · Date: 2026-04-22_

Finish every small file under `src/context/` and `src/hooks/`
**except** the two big resolver hook bodies. Getting each target
file to **100 % lines / branches / functions**, per the
coverage-first directive.

No product-code changes. No lint work yet (that stays blocked until
global coverage reaches 100 %).

---

## In scope — target files, 100 % each

| File | Current | Target |
|---|---:|---:|
| `src/context/AuthContext.tsx` | 27.5 % | 100 % |
| `src/context/ThemeContext.tsx` | 0 % | 100 % |
| `src/hooks/useUrlDocument.ts` | 13.5 % | 100 % |
| `src/hooks/useIsMobile.ts` | 0 % | 100 % |
| `src/hooks/useCookieConsent.ts` | 0 % | 100 % |

Expected global bump: 3.03 % → roughly **8-11 %**.

## Explicitly deferred — not this round

- `src/hooks/useChainResolver.ts` hook body (~270 LOC, fetch chain).
- `src/hooks/useImportResolver.ts` hook body (~140 LOC, fetch).
- Components under `src/components/`.
- The 7 viewer pages under `src/pages/`.

Those are round 5+. Deferring the two resolver hook bodies keeps
this round's mocking surface bounded — everything here can be
tested with `renderHook`, jsdom globals, and small `vi.stubGlobal`
shims, without the full complexity of chain-stepping fetch state
machines.

---

## Per-file approach

### `AuthContext.tsx`

Round 2 covered `isValidJwtFormat` and `authHeaders`. Remaining
surface:

- `AuthProvider` initial-state branches (sessionStorage populated
  with a valid token, with a corrupted value, with nothing,
  sessionStorage throwing entirely).
- `setToken` with valid, invalid-format, empty/whitespace inputs
  (exercises the `console.warn` early-return).
- `setToken` catches a `sessionStorage.setItem` throw (quota /
  security) but keeps the token in memory.
- `clearToken` removes the key and nulls state, tolerates a throw.
- `useAuth` outside a provider throws.
- `authFetch`:
  - no token → plain `fetch(url, { signal })`
  - with token, dev mode → POST to `/__proxy` with token in body
  - with token, prod mode → direct fetch with `Authorization` header

`vi.stubGlobal('fetch', vi.fn())` for fetch mocking. Use
`vi.stubEnv('DEV', true|false)` to flip the dev/prod branch.
Stub `sessionStorage` methods per-test with
`vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(...)`
where needed.

### `ThemeContext.tsx`

Test cases:

- `useTheme` outside a provider throws.
- Initial `mode` read from localStorage when valid
  ("light" / "dark" / "system"), falls through to `"system"` when
  missing or corrupted, tolerates a localStorage read throw.
- `resolvedMode` reflects OS preference when `mode === "system"`,
  reflects the user choice otherwise.
- `setMode` writes to localStorage and updates state; tolerates a
  localStorage write throw.
- `toggleMode` from light → dark, from dark → light, from system
  picks based on `resolve()`.
- matchMedia `change` event updates `systemPref` and therefore
  `resolvedMode` (when mode is `"system"`).
- The `applyTheme` effect runs when `resolvedMode` changes. Verify
  by spying on `document.documentElement.getAttribute("data-theme")`.

`window.matchMedia` needs a stub. Standard pattern:

```ts
const mqls = new Map<string, MockMQL>();
vi.stubGlobal("matchMedia", (q: string) => { /* returns MockMQL */ });
```

### `useUrlDocument.ts`

Round 2 covered `fileNameFromUrl`. Remaining: the hook body.

- No `?url=` param → hook returns nulls, never fetches.
- Valid `?url=` → triggers a fetch, eventually yields
  `{ json, isLoading: false, error: null, sourceUrl }`.
- Fetch returns non-OK → `error` is populated with status text.
- Fetch throws (e.g. abort) → `error` mentions timeout when
  `AbortError`.
- Unmount during fetch aborts and does not update state
  (`cancelled` branch).
- Changing the `url` param mid-flight cancels the previous fetch
  via the cleanup function.
- Token dependency — changing the token should refetch.

`vi.stubGlobal('fetch', vi.fn())` is used indirectly via
`authFetch`. Might be simpler to mock the `authFetch` export
directly with `vi.mock('../context/AuthContext', …)` partial.

The hook uses `useSearchParams` from `react-router-dom`, so
tests wrap in a `<MemoryRouter initialEntries={['/?url=...']}>`.
Also wraps in `<AuthProvider>`.

### `useIsMobile.ts`

Minimal:

- Stubbed matchMedia reports `matches: false` → hook returns
  `false`.
- Stubbed matchMedia reports `matches: true` → hook returns
  `true` on mount.
- Firing the stored `change` handler flips the returned boolean.
- Unmount removes the `change` listener (verify the stub's
  `removeEventListener` was called with the same handler).

### `useCookieConsent.ts`

Tricky — there's a module-level `gaLoaded` flag that persists
across tests. Each test resets state with `vi.resetModules()` +
re-import.

Also needs jsdom to support `document.cookie` (it does) and
`window.dataLayer`, `window.gtag`, and `window[`ga-disable-${ID}`]`
(we set these during the test).

Cases:

- `consent` initial value: null when no cookie, `"accepted"` /
  `"declined"` when cookie is set, null when cookie value is junk.
- `accept()` writes the cookie, updates state, and calls
  `enableGA` — which appends the gtag `<script>` to `document.head`
  and initialises `window.gtag` / `window.dataLayer` on first call,
  and flips the disable flag back on subsequent calls.
- `decline()` writes the cookie, updates state, sets
  `window[`ga-disable-${GA_ID}`] = true`, and removes `_ga` /
  `_ga_*` cookies.

---

## Common test utilities

Where the same setup repeats (matchMedia stubbing, sessionStorage
spies, routed-and-authed wrappers), move it to a small
`src/test/helpers.ts` once the pattern is obvious. If it's obvious
only in two places, inline it. Don't pre-optimise a helper file.

---

## Out of scope

- Lint in CI.
- Any product-code changes, even innocuous extraction / rename.
- `useChainResolver` / `useImportResolver` hook bodies.
- Any component or page tests.
- Coverage threshold enforcement.

---

## Files this PR will add / modify

- **Add:** `.development/plans/test-coverage-round-4.md` (this file)
- **Extend:** `src/context/AuthContext.test.ts` (already exists for
  pure helpers — append provider + `authFetch` cases)
- **Add:** `src/context/ThemeContext.test.tsx`
- **Extend:** `src/hooks/useUrlDocument.test.ts` (already exists —
  append hook-body cases)
- **Add:** `src/hooks/useIsMobile.test.ts`
- **Add:** `src/hooks/useCookieConsent.test.ts`
- Possibly: `src/test/helpers.ts` if shared setup becomes painful
  to inline.
