# HANDOFF

**Last updated:** 2026-05-25 by Claude Code (Sonnet 4.6)
**Session:** Phase 1 complete + deployed. Visual polish debugged (orbit, comets, nebulae, edges, bloom). Phase 2 planned (T8-T10).

## State

Phase 1 is fully deployed. Site is live on Vercel. GitHub Action auto-updates graph.json on every vault push.

Visual effects working:
- Manual orbit via `camera.position.applyAxisAngle` (Three.js r184 compatible)
- Comets via independent `requestAnimationFrame` loop (not `onRenderFramePost`)
- Nebulae: `THREE.BackSide`, `emissiveIntensity: 0.12` (no outline, no overbright)
- Bloom: `UnrealBloomPass(size, 1.4, 0.4, 0.25)` — threshold 0.25 prevents nebula bloom
- Node clustering: `charge(-200)`, `link.distance(70)`, `forceCollide` from `d3-force-3d`
- Edges: `#4a78e0 / #8860cc / #d4881a`, `linkOpacity={0.85}`

## Implemented

- T1: Vite React scaffold, dependencies, Vitest jsdom setup, test scripts.
- T2: Vault graph generator with pytest coverage.
- T3: `useGraphData` hook with schema validation and tests.
- T4: `Graph3D` with all visual effects (orbit, comets, nebulae, bloom, breathing, particles).
- T5: `isMobile()` bloom guard.
- T6: Code split via `React.lazy` + `Suspense`.
- T7: GitHub Action in vault repo (`update-graph.yml`).

### Key file — Graph3D.jsx (~529 lines)

- `getCircleTex()`: module-cached canvas texture for circular PointsMaterial points
- `spawnComet(scene, spawnT, camera)`: camera-relative 60-80° cone spawning
- Independent rAF `useEffect`: orbit (`applyAxisAngle`) + comet spawn/animate/cleanup
- `setForceGraphRef`: sets `charge(-200)`, `link.distance(70)`, `forceCollide`, `controls.autoRotate = false`
- `buildNebulae`: `emissiveIntensity: 0.12`, `side: THREE.BackSide`
- `onRenderFramePost`: node breathing/glimmer, star twinkling, nebula drift, `controls.update()`
- Comet staggered fade: head fades at 55-82%, trail at 70-100% of duration

## Phase 2 — Planned (T8-T10)

See `CURRENT_TASK.md` for full task specs.

**T8** — Extend `gen_graph.py`: add `excerpt` (stripped markdown body), `tags` (frontmatter), `generated_at` (ISO UTC).

**T9** — `StatsOverlay` component: fixed bottom-left, shows note count / connection count / "Updated N ago".

**T10** — Camera fly-to + `InfoPanel` on node click:
- `fgRef.current.cameraPosition(targetPos, lookAt, 1000)` approaches from current camera direction, 60 units from node
- Panel renders on right side, shows label / excerpt / tags / connections / created date
- Dismiss: background click or Escape; orbit resumes after 3s

## Commits (Phase 1 visual polish, 2026-05-25)

Most recent commit on main: `98172a6` — "Stagger comet fade: head disappears before tail"

Earlier Phase 1 commits: `375d1f9`, `5ed533b`, `d82acf8`, `298f445`, `028cff6`, `2aa7b29` (viz repo); `d51d7bf`, `b832546` (vault repo).
