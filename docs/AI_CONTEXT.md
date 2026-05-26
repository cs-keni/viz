# AI_CONTEXT — Bobby Brain Viz

Live 3D knowledge graph for Kenny's Obsidian vault. Hosted on Vercel. Auto-updates from a GitHub Action in the vault repo.

## What This Is

Kenny has a personal Obsidian vault (`/mnt/c/obsidian`, private GitHub repo) that doubles as memory for his AI assistant Bobby. This repo renders the vault's note graph as a hosted, public-facing 3D visualization — beautiful enough for portfolio embed, accurate enough to show Bobby growing over time.

## Architecture

```
obsidian vault (private GitHub repo)
    └── GitHub Action: on push
            └── .github/scripts/gen_graph.py
                    └── parse all .md files → extract titles + wikilinks + created dates
                        → push public/graph.json to this repo

viz repo (this repo — public)
    ├── Vite + React
    ├── react-force-graph-3d (Three.js + d3-force-3d physics)
    ├── Custom Three.js visual effects (bloom, particles, breathing pulse)
    ├── Fetches public/graph.json at load time (fully static, no backend)
    └── Auto-deploys on push via Vercel
```

## Data Format — graph.json

```json
{
  "nodes": [
    {
      "id": "Projects/Bobby Brain Viz",
      "label": "Bobby Brain Viz",
      "folder": "Projects",
      "created": "2026-05-24",
      "degree": 3,
      "excerpt": "First ~200 chars of note body, markdown stripped…",
      "tags": ["project", "ai"]
    }
  ],
  "links": [
    { "source": "Projects/Bobby Brain Viz", "target": "Maps/Bobby" }
  ],
  "generated_at": "2026-05-24T12:00:00Z"
}
```

- `degree` is computed during generation and stored in JSON (not recalculated client-side).
- `excerpt` and `tags` are added in T8 (Phase 2). `excerpt` may be `""` for notes with no body.
- `generated_at` replaces the old `generated` field (T8). Used by the stats overlay for "Updated X ago".
- Schema validation in `useGraphData` treats `excerpt`, `tags`, `generated_at` as optional — old graph.json without them is still valid.

## Stack

- **Vite + React** (no SSR, fully static)
- **react-force-graph-3d** — physics simulation + Three.js rendering, hooks: `nodeThreeObject`, `postProcessingComposer()`, `onEngineStop`, `onNodeClick`
- **Three.js** — InstancedMesh node rendering, comets, starfield, nebulae, UnrealBloomPass
- **Vitest + React Testing Library** — unit tests for pure logic (colors, dates, useGraphData)
- **pytest** — tests for gen_graph.py Python parser (in vault repo)
- **Vercel** — free tier, auto-deploy on push to main

## Visual Direction — Neural/Organic (locked)

- Background: `#050820` (deep navy)
- Node color: discrete buckets by degree
  - 0-2: `#7B8CDE` (blue-violet)
  - 3-8: `#C4A0E8` (soft purple)
  - 9+: `#F4C87B` (gold)
- Recently added nodes (< 7 days): +50% emissive intensity, doubled pulse amplitude
- Node size: `log(degree + 1) * 3` px radius
- Bloom: Three.js `UnrealBloomPass` (strength 1.2, radius 0.4, threshold 0.2) — **desktop only**
- Particles: 5 per link, white, opacity 0.6, drift at 0.003/frame
- Breathing pulse: `scale = 1 + 0.04 * sin(time * 1.2 + node.phase)` — time is elapsed seconds
- `node.phase` = random `[0, 2π]` assigned at load to stagger each node's cycle

## Animation System — What Owns What

**This is the most critical architectural rule in the codebase.** Getting this wrong caused the invisible-nodes bug that took an entire session to diagnose.

### The rule: one animation owner

All per-frame animation lives in the **independent `requestAnimationFrame` loop** (`useEffect` with `[]` deps) inside `Graph3D.jsx`. Nothing else drives per-frame updates.

```
Independent rAF loop (useEffect [])
├── Cinematic orbit (applyAxisAngle, pivot, speed)
├── Shot timer (nextShotAt RAF-tick check)
├── Comets (spawn, animate trail/head, cleanup)
├── InstancedMesh init (once, when node.x is set after warmupTicks)
├── InstancedMesh matrix sync (every 2nd frame)
├── Emissive pulse per bucket (every 2nd frame)
├── Star twinkling (every 3rd frame)
└── Nebula drift (every frame)
```

### DO NOT use `onRenderFramePost`

`onRenderFramePost` is declared in react-force-graph-3d's PropTypes but **has no call sites in the library bundle**. It is an unimplemented stub and never fires. Passing it as a prop is a silent no-op. Any animation code placed there is dead code.

### Event callbacks (one-shot, not per-frame)

```
onEngineStop    → initInstancedMeshes() (fallback if rAF hasn't inited yet), zoomToFit, start cinematic
onNodeClick     → applySelectionColors(), open InfoPanel, pause orbit
onBackgroundClick → dismiss InfoPanel, resume orbit
nodeThreeObject → set node._radius, node._phase, node._baseEmissive; return invisible tracker Object3D
```

### Node rendering — InstancedMesh

Nodes are NOT individual `THREE.Mesh` objects. `nodeThreeObject` returns an invisible `THREE.Object3D` tracker (react-force-graph-3d uses 2D projected distance for hover/click, so the tracker is enough for interaction). Three `THREE.InstancedMesh` objects render all nodes — one per degree bucket (low/mid/high). This collapses 700+ draw calls into 3.

The rAF loop syncs InstancedMesh matrices from `node.x/y/z` (d3 simulation coordinates) every other frame.

---

## Key Implementation Decisions

1. **No @react-three/postprocessing** — it requires R3F. Use Three.js `UnrealBloomPass` directly via `postProcessingComposer()` getter on the ForceGraph3D ref.

2. **Mobile bloom detection** — detect `!WebGL2RenderingContext` or `navigator.userAgent` mobile pattern; skip `UnrealBloomPass` on mobile. Animation still runs.

3. **`warmupTicks={300}`** on ForceGraph3D — runs 300 simulation ticks synchronously before the first render and before the rAF loop starts. By the time the rAF loop fires for the first time, `node.x/y/z` are already set to settled positions. Nodes initialize at correct positions on frame 1.

4. **Stale closure pattern** — animation callbacks read from `graphRef.current` (useRef), not React state. Graph data stored in both `useState` (for re-renders) and `useRef` (for the rAF loop).

5. **Code splitting** — Graph3D wrapped in `React.lazy + Suspense`. Loading skeleton shows immediately; Three.js bundle fetches in parallel.

6. **Error state** — `useGraphData` returns `{data, loading, error}`. Error card rendered on fetch failure or schema validation failure.

7. **Schema validation** — Validate graph.json shape in `useGraphData`: check `nodes` is array, `links` is array, each node has `id` and `label`. No Zod — inline checks.

8. **Selection dimming** — `applySelectionColors()` calls `mesh.setColorAt(i, dim)` with near-black `(0.08, 0.08, 0.08)` on non-neighbor instances. Called once on click/dismiss, not per-frame.

## Project Structure

```
/mnt/c/dev/viz/
├── public/
│   └── graph.json              ← auto-generated by vault GitHub Action
├── src/
│   ├── components/
│   │   ├── Graph3D.jsx         ← main 3D component (lazy-loaded), ~788 lines
│   │   ├── InfoPanel.jsx       ← node click info panel (label, excerpt, tags, connections)
│   │   └── StatsOverlay.jsx    ← bottom-left stats (note count, links, updated)
│   ├── hooks/
│   │   ├── useGraphData.js     ← fetch + validate + parse
│   │   └── useGraphData.test.js
│   ├── utils/
│   │   ├── colors.js           ← colorForDegree, sizeForDegree, isRecentlyAdded
│   │   ├── colors.test.js
│   │   └── device.js           ← isMobile()
│   ├── App.jsx                 ← Suspense boundary, loading skeleton, error card
│   └── main.jsx
├── docs/                       ← AI handoff files (this folder)
├── PHASES.md                   ← implementation checklist
├── TODOS.md                    ← deferred items
├── package.json
└── vite.config.js
```

## Graph3D.jsx — Internal Structure

| Section | Lines (approx) | Purpose |
|---|---|---|
| Constants | top | `BACKGROUND_COLOR`, `STAR_COUNT`, `ORBIT_RESUME_DELAY`, `CINEMATIC_SHOTS` |
| Scene builders | module-level fns | `getCircleTex()`, `buildStarfield()`, `buildNebulae()`, `spawnComet()` |
| Component | `export default Graph3D` | All refs, state, callbacks, JSX |
| Independent rAF loop | `useEffect([])` early | Orbit, comets, InstancedMesh sync, stars, nebulae |
| `setForceGraphRef` | `useCallback` | One-time setup: forces, controls, bloom, starfield, nebulae |
| `initInstancedMeshes` | `useCallback` | Creates 3 InstancedMeshes; called by rAF and onEngineStop |
| `applySelectionColors` | `useCallback` | Per-instance color for selected/dimmed state |
| `onEngineStop` | `useCallback` | zoomToFit, start cinematic, fallback init |
| `nodeThreeObject` | `useCallback` | Sets node visual props, returns invisible tracker |
| `handleDismiss` / `onNodeClick` | `useCallback` | Selection state, orbit pause/resume, InfoPanel |
| JSX | `return` | ForceGraph3D + tooltip div + InfoPanel |

## Vault Structure (for gen_graph.py)

Vault root: `/mnt/c/obsidian/`

Folders to include: `Maps/`, `Projects/`, `Areas/`, `Resources/`, `Daily Notes/`

Notes are `.md` files. Links are `[[note title]]` or `[[note title|alias]]` (use title, ignore alias). YAML frontmatter `created: YYYY-MM-DD` is the node creation date.

## Phases

- Phase 1: Standalone hosted site (current)
- Phase 2: Eportfolio embed (handled by eportfolio Claude Code instance)
- Phase 3: Obsidian plugin (future)
