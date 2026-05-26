# HANDOFF

**Last updated:** 2026-05-26 by Codex (GPT-5.5 xmedium)
**Session:** Global Codex instruction update for documentation freshness. Previous performance/Phase 2 state preserved below.

## State

Phase 1 + Phase 2 fully deployed. Site is live on Vercel. GitHub Action auto-updates graph.json on every vault push.

Global Codex instructions at `/home/keni/.codex/AGENTS.md` now make documentation freshness an explicit priority: meaningful code, architecture, implementation, workflow, tooling, or task-status changes must update the relevant shared docs in the same change. This was added to prevent stale architecture or implementation notes from misleading future Codex/Claude sessions.

Visual effects working:
- **Nodes**: 3 `THREE.InstancedMesh` objects (one per degree bucket), matrix sync in rAF loop
- **Orbit**: Manual `camera.position.applyAxisAngle` — pauses on drag, resumes after 3s
- **Cinematic shots**: Wide, hub close-ups, underworld, polar, side sweep — cycle via RAF-tick timer
- **Comets**: Camera-relative 60-80° cone spawning, staggered fade (head 55-82%, trail 70-100%)
- **Stars**: 4000-point starfield, twinkling every 3rd frame
- **Nebulae**: `THREE.BackSide`, `emissiveIntensity: 0.12`, slow drift in rAF
- **Bloom**: `UnrealBloomPass(size, 1.4, 0.4, 0.25)` — desktop only, threshold 0.25
- **Node clustering**: `charge(-200)`, `link.distance(70)`, `forceCollide` from `d3-force-3d`
- **Edges**: `#4a78e0 / #8860cc / #d4881a`, `linkOpacity={0.85}`
- **Selection**: Click node → dim non-neighbors via `setColorAt`, open InfoPanel, pause orbit
- **Stats overlay**: Bottom-left, note count / connections / "Updated N ago"

## Critical architectural rule — read before touching Graph3D.jsx

All per-frame animation lives in the **independent `requestAnimationFrame` loop** (`useEffect([])`) and nowhere else. See `AI_CONTEXT.md` → "Animation System — What Owns What" for the full breakdown and the reason `onRenderFramePost` must never be used.

## Implemented

- T1: Vite React scaffold, dependencies, Vitest jsdom setup.
- T2: Vault graph generator (`gen_graph.py`) with pytest coverage.
- T3: `useGraphData` hook with schema validation and tests.
- T4: `Graph3D` with all visual effects.
- T5: `isMobile()` bloom guard.
- T6: Code split via `React.lazy` + `Suspense`.
- T7: GitHub Action in vault repo (`update-graph.yml`).
- T8: `gen_graph.py` extended with `excerpt`, `tags`, `generated_at`.
- T9: `StatsOverlay` component.
- T10: Camera fly-to + `InfoPanel` on node click.
- Perf: InstancedMesh optimization (700+ → 3 draw calls).

## Key file — Graph3D.jsx (~788 lines)

| Callback / section | Owns |
|---|---|
| Independent rAF `useEffect([])` | Orbit, shot timer, comets, InstancedMesh sync, star twinkling, nebula drift |
| `setForceGraphRef` | One-time setup: d3 forces, OrbitControls config, bloom, starfield, nebulae |
| `initInstancedMeshes` | Creates 3 InstancedMeshes; called by rAF loop (normal) and onEngineStop (fallback) |
| `applySelectionColors` | `setColorAt` per instance for selected/dimmed state; called on click/dismiss only |
| `onEngineStop` | `zoomToFit`, start cinematic reel, fallback `initInstancedMeshes` |
| `nodeThreeObject` | Sets `node._radius`, `_phase`, `_baseEmissive`; returns invisible `Object3D` tracker |
| `onNodeClick` / `handleDismiss` | Selection state, orbit pause/resume, InfoPanel open/close |

Notable module-level helpers:
- `getCircleTex()`: cached canvas texture for circular `PointsMaterial` points (comets)
- `spawnComet(scene, spawnT, camera)`: camera-relative 60-80° cone spawn
- `buildStarfield()`: `THREE.Points`, 4000 stars with per-star phases for twinkling
- `buildNebulae(scene)`: 3 large `BackSide` spheres for ambient atmosphere

## Most recent commits

- `73a1426` — docs: log InstancedMesh optimization + onRenderFramePost ghost prop postmortem
- `cb381d3` — fix: move all per-frame work to rAF loop, remove ghost onRenderFramePost
- `72941c3` — fix: use node.x/y/z for InstancedMesh sync (earlier failed attempt)
- `549f198` — GitHub Action commit (auto graph.json update)
