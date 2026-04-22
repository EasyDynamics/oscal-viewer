# oscal-viewer — local dev runbook

How to spin up the viewer locally and walk through each of the seven
OSCAL model viewers with a real sample document.

---

## Prereqs

- Node 18+ (per README)
- `npm install` has been run once in the repo root
  (already done in this environment)

---

## Start the dev server

### Foreground (terminal stays attached)

```bash
npm run dev
```

Vite binds to `http://localhost:5173` (port is locked via
`vite.config.ts:153-156` — `strictPort: true`, so it fails rather than
hopping to 5174 if 5173 is busy).

### Background (the technique used in this environment)

Claude Code's `Bash` tool with `run_in_background: true` starts the
dev server and returns a task ID. Output streams to a log file you can
tail. Rough shape:

```bash
# start
npm run dev   # (run_in_background: true)
# returns: Command running in background with ID: <id>
#         Output is being written to: /tmp/.../<id>.output
```

To check status or wait for the `ready in …ms` line, use the `Monitor`
tool on the output file with an `until` check for `Local:   http://`.

Stop the server by killing the background task (same task ID).

### Verify it's up

```bash
curl -s http://localhost:5173/ | head -20        # should serve index.html
curl -s http://localhost:5173/catalog | head -5  # SPA — same HTML
```

---

## Sample OSCAL documents

Seven canonical NIST sample files (one per model) are now in `samples/`.
Downloaded from `github.com/usnistgov/oscal-content/tree/main/examples`,
so they're authoritative but small (minimised variants, all under 14 KB).

| File | Model | Root key | Use with |
|---|---|---|---|
| `samples/catalog-basic.json` | Catalog | `catalog` | `/catalog` |
| `samples/profile-basic.json` | Profile | `profile` | `/profile` |
| `samples/component-definition-example.json` | Component Definition | `component-definition` | `/component-definition` |
| `samples/ssp-example.json` | SSP | `system-security-plan` | `/ssp` |
| `samples/assessment-plan-ifa.json` | Assessment Plan | `assessment-plan` | `/assessment-plan` |
| `samples/assessment-results-ifa.json` | Assessment Results | `assessment-results` | `/assessment-results` |
| `samples/poam-ifa.json` | POA&M | `plan-of-action-and-milestones` | `/poam` |

### Re-fetching them

```bash
cd samples && \
  BASE="https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples" && \
  curl -fsSL -o catalog-basic.json                "$BASE/catalog/json/basic-catalog-min.json" && \
  curl -fsSL -o profile-basic.json                "$BASE/profile/json/basic-profile-min.json" && \
  curl -fsSL -o component-definition-example.json "$BASE/component-definition/json/example-component-definition-min.json" && \
  curl -fsSL -o ssp-example.json                  "$BASE/ssp/json/ssp-example-min.json" && \
  curl -fsSL -o assessment-plan-ifa.json          "$BASE/ap/json/ifa_assessment-plan-example-min.json" && \
  curl -fsSL -o assessment-results-ifa.json       "$BASE/ar/json/ifa_assessment-results-example-min.json" && \
  curl -fsSL -o poam-ifa.json                     "$BASE/poam/json/ifa_plan-of-action-and-milestones-min.json"
```

Sanity-check each file parses and has the right root key:

```bash
for f in samples/*.json; do
  printf '%-40s  ' "$f"
  python3 -c "import json; d=json.load(open('$f')); print(next(iter(d)))"
done
```

---

## Loading documents into the viewer

There are two routes a document takes into a page — they exercise
**different** code paths, and understanding which you're testing matters.

### A. File drop / upload (no base URL)

Go to e.g. `http://localhost:5173/ssp`, drop `samples/ssp-example.json`
into the drop zone. This exercises `loadFile()` in the page (e.g.
`SspPage.tsx:2322`). The `sourceUrl` is `null`, so `useChainResolver`
cannot resolve relative `import-profile` / `import-ssp` hrefs — any
cross-document lookup for the catalog will fail with
`"Cannot resolve relative URL '…' — no base URL available."`

This is the "broken" path for 5 of the 7 viewers.

### B. URL parameter (base URL is the document's own URL)

```
http://localhost:5173/ssp?url=<absolute-URL-to-ssp.json>
```

This exercises `useUrlDocument()` + the `/__proxy` CORS-bypass endpoint
baked into the Vite dev server (`vite.config.ts:17-148`). The page's
`sourceUrl` is set, and `useChainResolver` will attempt to fetch the
linked documents relative to that URL.

### B.1 — Serve samples over HTTP so `?url=` works

The samples reference each other using relative paths. To exercise the
full chain resolver, run a tiny static server for `samples/`:

```bash
# in a second terminal
cd samples && python3 -m http.server 8000
```

Then hit pages like:

```
http://localhost:5173/catalog?url=http://localhost:8000/catalog-basic.json
http://localhost:5173/ssp?url=http://localhost:8000/ssp-example.json
```

Note: the NIST sample SSP / AP / AR / POA&M files reference specific
upstream documents (NIST SP 800-53 rev5 catalog, etc.) that aren't in
our local `samples/`. Expect chain-resolver errors until we mirror
those too.

---

## Test matrix — walk each viewer

For each page, try both loading paths and note what actually renders.
This is the grid we want to fill in to replace the README's
"6 viewers are stubs" claim with something honest.

| Page | File drop | `?url=` (served) | Overview renders? | Sidebar renders? | Control details? |
|---|---|---|---|---|---|
| Catalog | `catalog-basic.json` | same | ? | ? | n/a |
| Profile | `profile-basic.json` | same | ? | ? | ? (chain → catalog) |
| Component Definition | `component-definition-example.json` | same | ? | ? | ? |
| SSP | `ssp-example.json` | same | ? | ? | ? (chain → profile → catalog) |
| Assessment Plan | `assessment-plan-ifa.json` | same | **yes, per repo history** | **yes** | partial (tasks self-contained) |
| Assessment Results | `assessment-results-ifa.json` | same | ? | ? | ? (chain → AP → SSP → profile → catalog) |
| POA&M | `poam-ifa.json` | same | ? | ? | ? (chain → SSP → profile → catalog) |

Things to check at each page:
1. Does the overview render any content at all?
2. Does the sidebar populate with groups / controls / tasks / etc.?
3. Click the first real item in the sidebar — does the detail view
   show useful info, or all blanks?
4. Open DevTools → Network. Is the app making doomed `fetch`es that
   are failing silently? What do they target?
5. Open DevTools → Console. Any parse errors / React warnings?

Record findings in `findings.md` under "Viewer audit" (add a new
section when results are in).

---

## Common gotchas

- **Port 5173 is locked.** If it's busy, Vite exits. Find the culprit
  and kill it, don't change the port (we want a stable URL for
  bookmarks / `?url=` links).
- **`/__proxy` is dev-only.** Production (Azure Static Web Apps) does
  not include it — the production site relies on upstream servers
  sending permissive CORS headers. This means behavior between dev and
  production can differ for URL-loaded docs.
- **Relative `href` in a file-dropped doc will never resolve.**
  Confirmed code path at `useChainResolver.ts:260`. Any "no base URL
  available" console error traces back to this.
- **JWT popover (top-right lock icon).** The app sends any pasted
  token as a Bearer header to all fetches. Irrelevant for NIST public
  samples, but remember it's there when testing against gated
  registries.

---

## How to kill the dev server

If started in the foreground: `Ctrl-C`.
If started in the background via this tooling: use the task ID
returned when you launched it.
Fallback: `lsof -i :5173` or `pgrep -f "vite"`, then `kill`.
