# oscal-viewer — findings from repo scan

_Date: 2026-04-22 · Branch: `claude/scan-repository-22aOB` · HEAD: `15240d4`_

Working notes from a pass through the repo to answer "what makes only Assessment
Plan actually work?" These are raw notes intended to feed later GitHub issues,
not a polished doc.

---

## TL;DR

1. There is no code-level kill switch disabling six of seven viewers.
   The `disabled: true` flag on `OscalModel` is wired into both the tab bar
   and the home-page cards, but **nothing in `oscalModels[]` has it set**.
2. All seven viewer pages are substantial (2,000-3,400 lines each), routed
   unconditionally in `App.tsx`, and share the same upload / URL-load /
   validate / view-router structure. Structurally they look finished.
3. Recent git history shows **only `AssessmentPlanPage.tsx` has had real
   feature work lately** (PRs #47 and #43, 472 + 146 lines, both in that
   one file). Every other viewer has been dormant for months.
4. Likely runtime reason the others "don't work": most viewers depend on
   a loaded **Catalog** to render control details, and they rely on a
   fragile network-driven **chain resolver** to auto-fetch the catalog from
   the document's `import*` href. File-drop loads have no base URL, so the
   chain resolver errors out at `useChainResolver.ts:260`, the catalog
   never loads, and control tables render with blanks. Assessment Plan
   sidesteps this because its main content (tasks, activities, steps) is
   self-contained in the AP document.
5. The README is stale: it says only Component Definition is fully
   implemented (outdated) and references an `ExamplesPage.tsx` that was
   removed in PR #15.

---

## Map of the disable mechanism (exists, currently inert)

| Layer | File:Line | What it does |
|---|---|---|
| Flag definition | `src/theme/tokens.ts:56-63` | `OscalModel.disabled?: boolean` |
| Flag values | `src/theme/tokens.ts:65-115` | None of the 7 models set it |
| Tab bar gate | `src/components/Layout.tsx:186-204` | Disabled → gray "Coming soon" span, `pointer-events: none` |
| Mobile menu gate | `src/components/Layout.tsx:247-260` | Disabled → skipped entirely |
| Home-card gate | `src/pages/HomePage.tsx:113-149` | Disabled → `opacity: 0.45`, `filter: grayscale(50%)`, "Coming soon", wrapped in plain `<div>` not `<Link>` |
| Route gate | `src/App.tsx:24-41` | **None** — routes are wired unconditionally, so direct URLs still work |

So flipping `disabled: true` on a model dims the UI but doesn't block
direct navigation. If we want a real kill switch, we'd need to either
redirect the route in `App.tsx` or add an early check inside each page.

**Dead weight:** `src/components/PageStub.tsx` is a placeholder
component that's imported by nothing. Either wire it in or delete it.

---

## Viewer page inventory

All 7 follow the same shape (verified by direct read):

```
useOscal() → grab state + filename
useUrlDocument() → optional ?url= fetch
useEffect(validate + store in context)
loadFile(File) → FileReader → JSON.parse → check metadata → store
handleNewFile() → clear
if (!data) return <DropZone/>
<Sidebar/> + <ViewRouter view={view} .../>
```

| Page | Lines | Root key it extracts | Chain used |
|---|---:|---|---|
| CatalogPage | 2,280 | `catalog` | none |
| ProfilePage | 2,456 | `profile` | PROFILE_CHAIN (Catalog) |
| ComponentDefinitionPage | 2,990 | `component-definition` | `useImportResolver` (per-import, not chain) |
| SspPage | 2,722 | `system-security-plan` | SSP_CHAIN (Profile → Catalog) |
| AssessmentPlanPage | 2,065 | `assessment-plan` | AP_CHAIN (SSP → Profile → Catalog) |
| AssessmentResultsPage | 3,368 | `assessment-results` | AR_CHAIN (AP → SSP → Profile → Catalog) |
| PoamPage | 2,503 | `plan-of-action-and-milestones` | POAM_CHAIN (SSP → Profile → Catalog) |

Validation errors thrown (grep-confirmed):
- Catalog: `"no metadata found"`
- Profile: `"no metadata found"`, `"no imports found"`
- Component Definition: `"no metadata found"`
- SSP: `"missing metadata"`
- Assessment Plan: `"missing metadata"`
- Assessment Results: `"no metadata found"`, `"no results array found"`
- POA&M: `"no metadata found"`, `"no poam-items array found"`

---

## Why Assessment Plan is the only polished viewer

Git log (`git log --stat -20`):

| PR | Insertions | Files touched |
|---|---:|---|
| #47 feat: enhance task management with nested tasks | **472** | `AssessmentPlanPage.tsx` only |
| #46 feat: skip functionality to ResolverModal | small | `ResolverModal.tsx` |
| #43 feat: refactor step card to step table | **146** | `AssessmentPlanPage.tsx` only |
| #41 catalog family name on profile page | small | `ProfilePage.tsx` |
| #40 URL format checks | small | multiple |

Two of the three most recent feature PRs are monolithic rewrites of
`AssessmentPlanPage.tsx`. Tasks / activities / steps / nested subtasks
(the things those PRs polished) are Assessment Plan concepts, not
Assessment Results. When the user says "the assessment works," they
mean **Assessment Plan**.

---

## Why the other 5 viewers likely fail at runtime (hypothesis)

The 5 non-catalog viewers render control detail rows by looking up
control IDs in a loaded `catalog`. When a user drops an SSP / POA&M /
AR / AP / CD file from disk:

1. The page auto-fires `useChainResolver()` to walk the import chain and
   fetch the catalog over the network.
2. `useChainResolver` at `:239-265` builds the next fetch URL relative to
   `baseUrl`. For `?url=`-loaded docs, `baseUrl === urlDoc.sourceUrl`, so
   relative `import-profile` / `import-ssp` hrefs resolve fine.
3. **For file-dropped docs, `baseUrl === null`.** Any relative href in
   `import-profile` → chain errors at `:260` with
   `"Cannot resolve relative URL '...' — no base URL available."`
4. Chain halts. No catalog ever loads. Control tables render with
   empty cells. Feels "broken."

Even when `baseUrl` is set, the chain is fragile:
- 10 s per-step timeout (`:290`)
- Any non-2xx halts the chain (`:293`)
- Content-type sniffing rejects XML (`:296`) and non-JSON/non-octet (`:299`)
- One failed step kills the rest (`:371`)

AssessmentPlan dodges this because its dominant views (Tasks / Activities
/ Steps) render directly from the AP document without needing a catalog.

**Not verified end-to-end by running the app.** Dev-server walkthrough
pending — see `runbook.md`.

---

## Confirmed & ruled out

| Claim | Status | Evidence |
|---|---|---|
| `disabled` flag is what hides broken viewers | **FALSE** | No model has `disabled: true` in `tokens.ts` |
| TS build is broken | **FALSE** | `npx tsc -b` passes clean |
| Route-level guard blocks non-AP viewers | **FALSE** | All 7 routes wired in `App.tsx:24-41` |
| Common parent component gates content | **FALSE** | `Layout.tsx` renders `<Outlet/>` unconditionally |
| Assessment Plan is the actively developed viewer | **TRUE** | Last 2 feature PRs (#47, #43) both exclusively AP |
| README project-structure claims are accurate | **FALSE** | Lists `ExamplesPage.tsx` (removed in #15), calls 6 viewers stubs (they're not) |
| `PageStub.tsx` is live | **FALSE** | No imports; dead code |

---

## Loose ends & open questions

- Which baseline does `samples/ssp-example.json` reference? If it needs
  NIST SP 800-53 rev5 and we don't have a catalog loaded, the control
  views will be empty even with the sample file.
- Is the production instance at `viewer.oscal.io` running HEAD of this
  branch or an earlier tag? Production "works" suggests the chain
  resolver reaches out to real URLs that the user provides via `?url=`,
  not file drops.
- `public/staticwebapp.config.json` is Azure-flavored — confirm whether
  the CORS / rewrite rules in production mask the file-drop base-URL
  issue (they don't, but good to double-check).
- `useImportResolver` (Component Definition) vs `useChainResolver`
  (everyone else) — two parallel resolution systems. Likely worth
  consolidating.

---

## Proposed roadmap (for later GitHub issues)

Rough shape — none of these is committed to yet:

1. **Readme truth-up** — remove stub claims, remove `ExamplesPage`
   reference, document which viewers actually render without a catalog.
2. **File-drop catalog path** — support either (a) a manual "also drop
   the catalog here" step or (b) a catalog upload button that applies
   across all viewers. Current UX: if you file-drop an SSP, you're stuck.
3. **Unify resolvers** — `useImportResolver` + `useChainResolver` do
   similar work; pick one.
4. **Viewer-by-viewer audit** with a real sample file for each (now in
   `samples/`). For each one:
   - Does overview render?
   - Does the sidebar populate?
   - Does clicking a control / finding / observation show content?
   - Which fields fail silently (empty string vs missing)?
5. **`disabled: true` as a temporary kill switch** — while viewers
   1-through-5 are audited/fixed, mark them disabled in `tokens.ts` and
   add a route redirect so direct URLs don't slip past. Gives us a
   honest-to-users deploy state without reverting code.
6. **Delete or wire up `PageStub.tsx`** — don't leave it hanging.
