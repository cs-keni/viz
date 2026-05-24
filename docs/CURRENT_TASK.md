# CURRENT TASK

## Phase 1 — Standalone hosted site

### Status: Starting from zero — project scaffold not yet created.

### Active Tasks (in order)

**T1 — Initialize Vite + React project with Vitest**
- `npm create vite@latest . -- --template react` in `/mnt/c/dev/viz/`
- Install: `react-force-graph-3d three vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom`
- Add vitest config to vite.config.js
- Verify: `npm run dev` serves, `npm run test` runs

**T2 — Write gen_graph.py + pytest (vault repo: /mnt/c/obsidian/.github/scripts/)**
- Parse all .md files in vault → extract wikilinks + frontmatter created dates + compute degree
- Handle: missing frontmatter, no links, duplicate links, `[[note|alias]]` syntax (use note title)
- Output: graph.json with schema defined in AI_CONTEXT.md
- Write `tests/test_gen_graph.py` with at least 5 pytest fixtures
- Run against vault: `python .github/scripts/gen_graph.py /mnt/c/obsidian > /mnt/c/dev/viz/public/graph.json`
- Copy output to `/mnt/c/dev/viz/public/graph.json` for local dev

**T3 — Build useGraphData hook**
- Path: `src/hooks/useGraphData.js`
- Returns: `{ data, loading, error }`
- Fetches `public/graph.json` on mount
- Validates schema: nodes is array, links is array, each node has id + label
- On failure (fetch error OR invalid schema): sets error state
- Write `src/hooks/useGraphData.test.js`: fetch success, 404, malformed JSON, invalid schema

**T4 — Build Graph3D component**
- Path: `src/components/Graph3D.jsx`
- Props: `{ data }` (from useGraphData)
- `warmupTicks={100}` — pre-settle simulation
- `nodeThreeObject(node)` — THREE.SphereGeometry, color from colorForDegree, emissive for recent nodes
- `linkThreeObject(link)` — THREE.Points (5 particles), populate particle Map
- `postProcessingComposer()` — add UnrealBloomPass (skip on mobile)
- `onRenderFramePost(renderer, time)` — breathing + particle movement, reads graphRef.current
- `src/utils/colors.js`: `colorForDegree(d)`, `sizeForDegree(d)`, `isRecentlyAdded(created)`
- `src/utils/colors.test.js`: all bucket boundaries + date edge cases

**T5 — Mobile bloom detection**
- `src/utils/device.js`: `isMobile()` — check userAgent for mobile pattern
- In Graph3D: only add UnrealBloomPass if `!isMobile() && window.WebGL2RenderingContext`

**T6 — Code split Graph3D**
- In `src/App.jsx`: wrap Graph3D in `React.lazy(() => import('./components/Graph3D'))` + `<Suspense fallback={<LoadingSkeleton />}>`
- Loading skeleton: centered CSS spinner + navy background

**T7 — GitHub Action (vault repo)**
- Path: `/mnt/c/obsidian/.github/workflows/update-graph.yml`
- Trigger: `on: push`
- Steps: checkout vault, run gen_graph.py, checkout viz repo (using VIZ_REPO_PAT secret), commit + push graph.json
- See HANDOFF.md for full YAML template

### Not in scope for this task

- Timeline scrubber
- Click-on-node behavior
- Folder/cluster color toggle
- "Last updated" timestamp UI (in TODOS.md)
- Phase 2 eportfolio embed
- Phase 3 Obsidian plugin
