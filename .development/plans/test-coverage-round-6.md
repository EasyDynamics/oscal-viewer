# Test coverage — round 6: useChainResolver hook body

_Branch: `claude/test-coverage-round-6` · Date: 2026-04-22_

Finish the second round-1 suspect module. Round 5 handled
`useImportResolver`; this round does `useChainResolver` — the
multi-step chain variant that the SSP / AP / AR / POA&M / Profile
pages all depend on.

## Scope

One module: `src/hooks/useChainResolver.ts`.

Current (from round 2): statements 14.11 %, branches 12.9 %,
functions 13.63 %, lines 15.23 %. Extractors at 100 %; the hook
body (lines 146-404, ~270 LOC) is the remaining work.

**Target:** ≥ 99 % lines on `useChainResolver.ts`. Aim for 100 %
with the same honesty about genuinely unreachable branches that
round 5 used (two residuals there; could be similar here).

## Cases to cover

Follows the source at `src/hooks/useChainResolver.ts:146-404`.

**Effect-level early returns**

- Same `initialHref` as lastHref — no re-run.
- Null / undefined `initialHref` — reset to idle.
- Empty chain — reset to idle.
- `skip=true` without a prior reset — records lastHref, no fetch.
- `skip=true` after a null → non-null cycle — runs the chain.

**Per-step branches (loop body)**

- `cancelled` set between iterations → early return.
- `resolveHref` format error → stop chain.
- `resolveHref` null URL with `#`-prefix → "not found" message.
- `resolveHref` null URL, non-`#` href → "Empty import href"
  (unreachable via public API, per round 5).
- Absolute URL passes through.
- Relative URL + base → `new URL()` succeeds.
- Relative URL + unparseable base → `new URL()` throws, error path.
- Relative URL + no base → "no base URL available" error.
- `checkUrlFormat` rejects resolved URL → stop chain.
- Set loading state.

**Fetch paths**

- `authFetch` rejects with `AbortError` → "Timed out resolving ..." .
- `authFetch` rejects with generic Error → message surfaced.
- `authFetch` rejects with non-Error → fallback message.
- `res.ok=false` → "HTTP <status>" error.
- content-type xml → "not JSON".
- content-type yaml → "not JSON".
- content-type unknown (not json/octet/plain) → "Expected JSON but received".
- content-type header absent → `?? ""` fallback.
- `cancelled` between fetch and text → silent.
- `JSON.parse` throws with XML-looking body → "appears to be XML".
- `JSON.parse` throws with garbage → "not valid JSON".
- Parsed obj wrapped in modelKey → unwrap and validate.
- Parsed obj unwrapped → use as-is.
- Inner has metadata → success.
- Inner has uuid only → success.
- Inner has neither → "does not appear to be a valid OSCAL ...".
- Success → label derivation (resTitle vs fileNameFromUrl fallback).
- `extractNext` returns href → chain continues.
- `extractNext` returns null href → chain halts cleanly, no error.
- Final step (no `extractNext`) → chain completes.

**Cleanup & external cancel**

- Unmount during fetch → cancelled=true, controller aborts.
- 10 s `setTimeout` deadline fires → controller.abort() → AbortError.
- Returned `cancel()` method aborts in-flight fetch.

**Derived `items`**

- Idle steps filtered out.
- Shape matches `ResolverItem`.

## Mocking approach

Same as round 5: `vi.stubGlobal('fetch', vi.fn())`. No provider
wrappers needed (hook uses `authFetch` as a plain function with
token=null in tests).

For the 10 s setTimeout test, capture-via-`vi.spyOn(globalThis,
'setTimeout')` and fire the captured callback manually — same
technique round 5 used to avoid breaking `@testing-library/react`'s
`waitFor`.

For multi-step chain tests, use `AP_CHAIN` (`assessment-plan →
system-security-plan → profile → catalog`) or a compact custom
chain with controllable `extractNext`.

## Out of scope

- Product-code changes (including removing dead branches).
- Components / pages / lint / threshold.

## Files added / modified

- Add: `.development/plans/test-coverage-round-6.md` (this file)
- Extend: `src/hooks/useChainResolver.test.ts` with hook-body cases
  — keep the round-2 extractor tests untouched.
