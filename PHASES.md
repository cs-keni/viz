# Bobby Brain Viz — PHASES

Live 3D knowledge graph for Kenny's Obsidian vault, hosted on Vercel.

## Phase 1 — Standalone hosted site (current)

### Setup
- [ ] Initialize Vite + React project (`npm create vite@latest . -- --template react`)
- [ ] Install deps: `react-force-graph-3d three vitest @vitest/ui @testing-library/react`
- [ ] Create project structure: `src/components/`, `src/hooks/`, `src/utils/`, `public/`
- [ ] Create `src/utils/colors.js` — `colorForDegree`, `sizeForDegree`, `isRecentlyAdded`
- [ ] Write Vitest tests for all color/size/date functions (all bucket boundaries)

### Data pipeline (Lane B — runs in parallel in vault repo)
- [ ] Write `.github/scripts/gen_graph.py` — parse vault .md files → graph.json
  - Extracts: wikilinks `[[...]]` and `[[note|alias]]`, YAML frontmatter `created`, degree per node
  - Handles: missing frontmatter, no links, duplicate links, aliases
  - Outputs: `{nodes: [{id, label, folder, created, degree}], links: [{source, target}], generated}`
- [ ] Write `tests/test_gen_graph.py` (pytest)
  - Fixtures: basic link, missing frontmatter, no links, duplicate links, alias `[[note|alias]]`
  - At minimum: 5 test cases covering parse correctness + edge cases
- [ ] Generate `public/graph.json` manually from vault once (for local dev)

### Core app
- [ ] Build `src/hooks/useGraphData.js`
  - Fetch `public/graph.json` on mount
  - Return `{data, loading, error}`
  - Validate schema on success: nodes is array, links is array, each node has id+label
  - Show error state on fetch failure OR invalid schema
- [ ] Write Vitest tests for useGraphData (fetch success, 404 failure, malformed JSON, invalid schema)
- [ ] Build `src/components/Graph3D.jsx`
  - `warmupTicks={100}` — graph appears settled on first render, no settling jank
  - `nodeThreeObject(node)` — THREE.SphereGeometry, discrete color buckets, emissive glow for recent nodes
  - `linkThreeObject(link)` — THREE.Points with 5 particles; populate particle state into useRef Map
  - `postProcessingComposer()` — add UnrealBloomPass (skip on mobile — detect WebGL2 + isMobile)
  - `onRenderFramePost(renderer, time)` — breathing pulse (node scale) + particle movement (Map iteration)
  - All animation callbacks read from `graphRef.current` (useRef), not React state — stale-closure safe
- [ ] Build `src/components/NodeTooltip.jsx` — floating div on node hover showing label
- [ ] Build loading skeleton (centered CSS spinner, navy bg, 300ms fade out when data ready)
- [ ] Build error card (shown on fetch failure or schema validation failure, with retry button)
- [ ] Code-split Graph3D with `React.lazy + Suspense` — loading skeleton covers the gap

### Deployment
- [ ] `git init` and create GitHub repo (`viz`, public)
- [ ] Connect to Vercel (auto-deploy on push to main)
- [ ] Verify Vercel build succeeds and graph renders live

### GitHub Action (vault repo — Lane B)
- [ ] Write `.github/workflows/update-graph.yml` in vault repo
  - Trigger: `on: push`
  - Run gen_graph.py, push `public/graph.json` to viz repo using `VIZ_REPO_PAT` secret
- [ ] Add `VIZ_REPO_PAT` secret to vault repo GitHub settings (PAT with repo write scope)
- [ ] Verify: push a note to vault → graph.json updates on viz repo → Vercel redeploys

### Polish
- [ ] Test on mobile (iOS Safari: bloom disabled, touch orbit/zoom works)
- [ ] Tune visual params: bloom strength, particle speed, pulse amplitude, color bucket thresholds
- [ ] LGTM check: the graph looks "like it's thinking"

## Phase 2 — Eportfolio embed

Handled by the eportfolio Claude Code instance. This repo exposes the public Vercel URL for iframe embedding.

## Phase 3 — Obsidian plugin

Package the same renderer as a local Obsidian plugin. Architecture TBD — depends on Phase 1 visual design being locked.

## Stretch goals (Phase 1+)

- [ ] Timeline scrubber — watch vault grow using `created` dates (needs UI + design)
- [ ] Click-on-node behavior — deep link to Obsidian or show metadata panel
- [ ] Folder/cluster color toggle — color nodes by Maps/Projects/Resources/Areas
- [ ] "Last updated" timestamp — display `generated` field from graph.json to detect stale pipeline

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 7 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **VERDICT:** ENG CLEARED — architecture review passed, 7 issues found and resolved, 0 critical gaps.
- **UNRESOLVED:** 0 decisions unresolved.
