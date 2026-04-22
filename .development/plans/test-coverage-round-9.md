# Test coverage — round 9: three non-viewer pages

_Branch: `claude/test-coverage-round-9` · Date: 2026-04-22_

Clean-sweep round before the 7 viewer-page grind. These three are
the simple static / light-state pages that already picked up some
coverage accidentally via App.tsx's smoke test.

## Scope

| File | LOC | Current | Complexity |
|---|---:|---:|---|
| `src/pages/PrivacyPolicyPage.tsx` | 199 | 25 % | 3 consent states × 2 buttons |
| `src/pages/HowItWorksPage.tsx` | 473 | 5.88 % | Pure static render |
| `src/pages/HomePage.tsx` | 296 | 66 % | Dashboard grid + mobile notes toggle |

Target: ≥ 95 % per file. 100 % where reachable without mocking
`oscalModels` or `brand` at the module level.

## Out of scope

- The 7 viewer pages (CatalogPage, ProfilePage, etc.) — next rounds.
- Product-code changes.
- Lint, threshold.

## Files added

- `.development/plans/test-coverage-round-9.md`
- `src/pages/PrivacyPolicyPage.test.tsx`
- `src/pages/HowItWorksPage.test.tsx`
- `src/pages/HomePage.test.tsx`
