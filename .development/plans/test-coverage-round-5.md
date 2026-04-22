# Test coverage — round 5: useImportResolver hook body

_Branch: `claude/test-coverage-round-5` · Date: 2026-04-22_

Narrow by design: just finish `src/hooks/useImportResolver.ts` to
100 %. The sister module `useChainResolver.ts` is its own round
(round 6). Doing one resolver at a time keeps the PR scope tight
and the mocking pattern reviewable.

---

## Scope

**One module:** `src/hooks/useImportResolver.ts`

Current coverage (from round 4): statements 22.79 %, branches
29.34 %, functions 37.5 %, lines 21.31 %. Pure helpers
(`checkUrlFormat`, `resolveHref`) are already at 100 %. The hook
body (lines 163–304) is the remaining ~140 lines of fetch-chain
logic.

**Target:** 100 % lines / 100 % branches / 100 % functions on
`useImportResolver.ts`.

## Explicitly deferred

- `useChainResolver.ts` hook body — next round.
- Round-4 residual gaps (SSR guards, `writeConsent(null)`,
  `useUrlDocument` race) — revisit as a product-code cleanup.
- Components, pages, lint-in-CI, coverage threshold.

---

## What's in the hook body

Following the source in `src/hooks/useImportResolver.ts:163-304`:

```
useImportResolver(href, backMatter, baseUrl, token, modelKey, skip)
  useEffect on [href, backMatter, baseUrl, token, modelKey, skip]:
    1. if skip || !href → reset all state, lastHref = null
    2. if href === lastHref.current → bail (no re-fetch)
    3. resolveHref(href, backMatter)
       - formatError (e.g. all-XML rlinks) → status=error
       - no URL (missing #uuid) → status=error (custom message per #-prefix)
    4. resolveRelativeUrl(rawUrl, baseUrl)
       - relative + no baseUrl → status=error
       - relative + baseUrl → resolve absolute
    5. Set loading, set resolvedUrl
    6. checkUrlFormat(fetchUrl) pre-flight
       - unsupported ext → status=error
    7. authFetch(fetchUrl, token, { signal })
       .then((res) =>
         if !res.ok → throw HTTP <status>
         content-type xml|yaml → throw not JSON
         content-type non-json/octet-stream/text-plain → throw expected JSON
         return res.text()
       )
       .then((text) =>
         if cancelled → return (silent)
         JSON.parse
           - OK → unwrap obj[modelKey] ?? obj
                  validate metadata or uuid
                  → status=success, json, label = title ?? fileName
           - fail + looks like XML → throw appears to be XML
           - fail otherwise → throw not valid JSON
       )
       .catch((err) =>
         if cancelled → return (silent)
         name=AbortError → error "Timed out resolving <modelKey> from <url>"
         otherwise → error message or fallback
       )
  cleanup: cancelled = true; clearTimeout; controller.abort()
```

## Test case list

To hit every branch, organised by what entry criterion sets them up:

**Early-reset paths**

1. `skip=true` → idle, no fetch.
2. `href=null` → idle.
3. `href=""` (empty string, falsy) → idle.
4. Stable `href` across re-render → `fetch` called exactly once.

**resolveHref errors**

5. Direct non-JSON URL (`.xml`) → `status=error`, message "not JSON".
6. `#uuid` with only XML rlinks → `status=error`, format error.
7. `#uuid` missing from back-matter → `status=error`, "not found or
   has no download link" with the leading `#`.
8. Non-`#` empty-ish href that resolves to no URL (e.g. an href
   that starts with `#` and points nowhere — covered by #7) —
   also the `!href.startsWith("#")` branch of the "Empty import
   href" message. Since the early bailout in step 1 catches empty
   strings, reaching "Empty import href." requires a truthy but
   URL-less input. Document this as an unreachable branch if
   coverage shows.

**resolveRelativeUrl errors**

9. Relative URL, no `baseUrl` → `status=error`, includes "no base
   URL available".

**Pre-flight extension check**

10. `checkUrlFormat` rejects the resolved absolute URL (e.g. a
    redirected-to-xml URL) → `status=error`.

**Fetch result paths**

11. HTTP 500 → `error=/HTTP 500/`.
12. Response content-type `application/xml` → error "not JSON".
13. Response content-type `text/yaml` → error "not JSON".
14. Response content-type `text/html` (non-JSON / non-octet /
    non-plain) → error "Expected JSON but received".
15. Response content-type `application/json`, body parses, wrapped
    under `modelKey`, has `metadata` → `status=success`, `json`
    set, `label` uses back-matter title when available.
16. Response content-type `application/json`, body parses, not
    wrapped, has `uuid` only (no metadata) → `status=success`.
17. Response content-type `application/json`, body parses, lacks
    both `metadata` and `uuid` → error "no metadata or uuid found".
18. Response body starts with `<` and fails JSON.parse → error
    "appears to be XML".
19. Response body is garbage and fails JSON.parse → error "not
    valid JSON".

**Fetch-error paths**

20. `authFetch` rejects with a generic `Error` → `status=error`,
    uses the message.
21. `authFetch` rejects with a non-Error value → fallback message
    `Failed to fetch <modelKey>`.
22. `authFetch` rejects with `AbortError` → error "Timed out
    resolving <modelKey> from <fetchUrl>".

**Label / title paths**

23. Back-matter resource has a `title` → `label === title`.
24. Direct URL (no back-matter title) → `label === fileNameFromUrl`.

**Cleanup**

25. Unmount while fetch is still pending → `cancelled = true`,
    aborts the controller; no `setState` after unmount.
26. Unmount after fetch returns but before `.then((text))` runs →
    silent return in the text handler.

Not every case is its own `it()` — several combine naturally
(e.g. #15 + #23 together). Aim for ~15 test blocks.

## Mocking approach

- `vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(...)))`
  — the real `authFetch` calls `fetch` when no token is supplied.
- No need to wrap in `<AuthProvider>` since we pass `token=null`
  directly to the hook.
- No router wrapper needed (hook doesn't use routing).
- `renderHook` with an explicit props argument so we can rerender
  and drive state transitions.
- `waitFor` for async state changes.

## Out of scope (again, for clarity)

- Any product-code changes (even SSR guard removal).
- `useChainResolver` — round 6.
- Components, pages, lint, threshold.

## Files this PR will add / modify

- **Add:** `.development/plans/test-coverage-round-5.md` (this file)
- **Rename:** `src/hooks/useImportResolver.test.ts` →
  `src/hooks/useImportResolver.test.tsx` if JSX wrappers end up
  needed. (Current pure-helper tests use no JSX, so the rename is
  conditional.)
- **Extend:** `src/hooks/useImportResolver.test.*` with hook-body
  cases.

Nothing else.
