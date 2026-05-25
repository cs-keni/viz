# CURRENT TASK

## Phase 1 — Standalone hosted site

### Status: T1-T7 complete. Phase 1 implementation done — deployment pending.

### Active Tasks (in order)

**T1 — Initialize Vite + React project with Vitest — Complete**
- `npm create vite@latest . -- --template react` in `/mnt/c/dev/viz/`
- Install: `react-force-graph-3d three vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom`
- Add vitest config to vite.config.js
- Verify: `npm run dev` serves, `npm run test` runs

**T2 — Write gen_graph.py + pytest (vault repo: /mnt/c/obsidian/.github/scripts/) — Complete**
- Parse all .md files in vault → extract wikilinks + frontmatter created dates + compute degree
- Handle: missing frontmatter, no links, duplicate links, `[[note|alias]]` syntax (use note title)
- Output: graph.json with schema defined in AI_CONTEXT.md
- Write `tests/test_gen_graph.py` with at least 5 pytest fixtures
- Run against vault: `python .github/scripts/gen_graph.py /mnt/c/obsidian > /mnt/c/dev/viz/public/graph.json`
- Copy output to `/mnt/c/dev/viz/public/graph.json` for local dev

**T3 — Build useGraphData hook — Complete**
- Path: `src/hooks/useGraphData.js`
- Returns: `{ data, loading, error }`
- Fetches `public/graph.json` on mount
- Validates schema: nodes is array, links is array, each node has id + label
- On failure (fetch error OR invalid schema): sets error state
- Write `src/hooks/useGraphData.test.js`: fetch success, 404, malformed JSON, invalid schema

**T4 — Build Graph3D component — Complete**
- Path: `src/components/Graph3D.jsx`
- Props: `{ data }` (from useGraphData)
- `warmupTicks={100}` — pre-settle simulation
- `nodeThreeObject(node)` — THREE.SphereGeometry, color from colorForDegree, emissive for recent nodes
- `linkThreeObject(link)` — THREE.Points (5 particles), populate particle Map
- `postProcessingComposer()` — add UnrealBloomPass (skip on mobile)
- `onRenderFramePost(renderer, time)` — breathing + particle movement, reads graphRef.current
- `src/utils/colors.js`: `colorForDegree(d)`, `sizeForDegree(d)`, `isRecentlyAdded(created)`
- `src/utils/colors.test.js`: all bucket boundaries + date edge cases

**T5 — Mobile bloom detection — Complete**
- `src/utils/device.js`: `isMobile()` — check userAgent for mobile pattern
- In Graph3D: only add UnrealBloomPass if `!isMobile() && window.WebGL2RenderingContext`

**T6 — Code split Graph3D — Complete**
- In `src/App.jsx`: wrap Graph3D in `React.lazy(() => import('./components/Graph3D'))` + `<Suspense fallback={<LoadingSkeleton />}>`
- Loading skeleton: centered CSS spinner + navy background

**T7 — GitHub Action (vault repo) — Complete**
- Path: `/mnt/c/obsidian/.github/workflows/update-graph.yml`
- Trigger: `on: push` to main/master, plus `workflow_dispatch`
- Steps: checkout vault → gen_graph.py → checkout cs-keni/viz via VIZ_REPO_PAT → commit + push graph.json (skips if no diff)
- Committed to vault repo: `b832546`

### Not in scope for Phase 1

- Timeline scrubber
- Folder/cluster color toggle
- Phase 2 eportfolio embed
- Phase 3 Obsidian plugin

---

## Phase 2 — Interactivity + Rich Data

### Status: Planned. Not started.

### Active Tasks (in order)

**T8 — Extend gen_graph.py with excerpt + tags + generated_at — Not started**
- Add `excerpt` field to each node: first ~200 chars of body content after frontmatter, stripped of markdown syntax (`#` headings, `**bold**`, `[[wikilinks]]` → display text, `[text](url)` → text)
- Add `tags` field to each node: list of strings from frontmatter `tags` (handle both list and space-separated string formats)
- Add top-level `generated_at`: ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`)
- Note: existing `generated` field in graph.json → rename to `generated_at` (update AI_CONTEXT schema)
- Update `useGraphData` schema validation: add `generated_at` as optional top-level string; `excerpt` and `tags` are optional per-node (no breaking change)
- Add pytest fixtures: excerpt from body, excerpt strips markdown, tags as list, tags as string, generated_at present in output, empty body → empty excerpt

**T9 — Stats info overlay — Not started**
- New component: `src/components/StatsOverlay.jsx`
- Fixed position: bottom-left, `position: fixed`, subtle glassmorphism matching tooltip style
- Shows: `{nodes.length} notes · {links.length} connections · Updated {relativeTime(data.generated_at)}`
- `relativeTime()` util: "just now" / "N minutes ago" / "N hours ago" / "N days ago"
- Render in `App.jsx` below `<Suspense>`, passes `data` from `useGraphData`
- No animation on mount (keep it minimal)

**T10 — Camera fly-to + floating info panel on node click — Not started**
- **Fly-to:** on node left-click, call `fgRef.current.cameraPosition(targetPos, lookAt, 1000)`
  - `targetPos` = approach from current camera direction: `nodePos - normalize(nodePos - camPos) * 60`
  - `lookAt` = `{ x: node.x, y: node.y, z: node.z }`
  - Disable orbit for the duration (`isAutoRotatingRef.current = false`)
- **Info panel:** new component `src/components/InfoPanel.jsx`
  - Fixed right side, 280px wide, slides in from right on mount (`transform: translateX`)
  - Shows: title (label), excerpt (from `node.excerpt`), tags as pill badges, "X connections", formatted created date
  - `node.excerpt` may be undefined for old graph.json — render "No preview available" fallback
  - Dismiss: background click or `Escape` key → panel out, orbit resumes after 3s
- **Wire-up in Graph3D.jsx:**
  - `onNodeClick` adds fly-to before existing selection logic
  - Pass `selectedNode` object (not just id) up via state so InfoPanel can render its data
  - InfoPanel rendered outside `<ForceGraph3D>` (as a sibling), so it doesn't interfere with Three.js canvas
- **Prop drilling:** Graph3D currently owns everything. Two options:
  - Option A: lift `selectedNode` state to App.jsx and render InfoPanel there (clean separation)
  - Option B: render InfoPanel inside Graph3D's return fragment (simpler, no prop drilling)
  - **Decision: Option B** — Graph3D already manages all selection state; InfoPanel is purely presentational

### Not in scope for Phase 2

- Timeline scrubber
- Folder/cluster color toggle
- Phase 3 Obsidian plugin
