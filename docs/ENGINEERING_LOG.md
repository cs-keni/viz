# ENGINEERING LOG

## 2026-05-29 — Increase camera maxDistance and starfield radius (Claude Code, Sonnet 4.6)

Constellation has grown large enough that the default zoom limit clips it. Increased `controls.maxDistance` (3000 → 4500) and `STAR_RADIUS` (4000 → 6000). First attempt used 6000/8000 but felt too zoomed out; dialed back to these values.

Commit: `TBD`

## 2026-05-26 — Global Codex documentation hygiene rule (Codex, GPT-5.5 xmedium)

### Why we did this

Kenny asked for the global Codex instructions, not just repo-local instructions, to always prioritize updating docs. The goal is to prevent architecture and implementation docs from becoming stale after code or workflow changes.

### What changed

Updated `/home/keni/.codex/AGENTS.md` so the global workflow now explicitly requires relevant shared docs to be updated in the same change as meaningful code, architecture, implementation, workflow, tooling, or task-status changes. The rule also calls out other authoritative tracking docs such as `PHASES.md`, roadmap files, design notes, and architecture references.

### Checks

No app checks were run because this was an instruction/documentation-only change.

### Commit

`b04e523` — docs: prioritize documentation freshness.

## 2026-05-26 — InstancedMesh performance optimization + invisible-nodes bug marathon (Claude Code, Sonnet 4.6)

### Why we did this

At 700+ nodes the graph lagged visibly when zoomed out. Each node was its own `THREE.Mesh` returned from `nodeThreeObject`, meaning 700+ individual draw calls per frame. The plan is to scale to 1000+ nodes, so this wasn't a problem that would shrink. The optimization goal: collapse all node draw calls into 3 (one `InstancedMesh` per degree bucket: low/mid/high), cutting GPU overhead by ~230×.

### What changed in the refactor

`nodeThreeObject` was changed to return an invisible `THREE.Object3D` tracker (react-force-graph-3d uses 2D projected distance for hover/click, so a trackerless interaction still works). Three `THREE.InstancedMesh` objects were created in a new `initInstancedMeshes` callback — one per degree bucket, with per-instance matrix uploads on every frame. Per-frame sync was placed in `onRenderFramePost`, matching the existing pattern used for star twinkling and nebula drift.

This is where the codebase got messy: two separate animation systems now existed — the independent rAF loop (orbit, comets) and `onRenderFramePost` (everything node-visual). Responsibility was split across two callbacks with no clear rule for which went where.

---

### Bug 1 — React crashed silently on mount (Temporal Dead Zone)

**Symptom:** Blank screen. Browser showed an empty `<div id="root">`, no canvas, no React mount.

**Root cause:** `onEngineStop` was declared in the component before `initInstancedMeshes`, but referenced it in its `useCallback` deps array. JavaScript evaluates `useCallback(fn, [deps])` synchronously — at that point, `initInstancedMeshes` was still in the temporal dead zone (`const` not yet initialized). React's render phase threw a `ReferenceError` before mounting.

**Fix:** Reordered callback declarations so `initInstancedMeshes` and `applySelectionColors` appear before `onEngineStop` in the component body.

**Key learning:** `useCallback` deps arrays are evaluated eagerly. Any `const` in the array must be declared *above* the `useCallback` call. This is a silent React anti-pattern that produces blank screens with no useful error message.

---

### Bug 2 — Nodes invisible on first load (first attempt — wrong root cause)

**Symptom:** Graph renders edges and link particles but no glowing node spheres. Nodes appear after camera cuts to a new cinematic angle (~12 seconds).

**First theory:** `initInstancedMeshes` was only called from `onEngineStop` (after physics settle). We moved the init check to `onRenderFramePost` with `node.__threeObj` as the readiness signal, then to `node._radius !== undefined`. Committed as `2f75038`, then `72941c3`. User confirmed still broken both times.

---

### Bug 3 — Nodes invisible on first load (root cause: ghost prop)

**Root cause (confirmed with console instrumentation):** `onRenderFramePost` is **declared in react-force-graph-3d's PropTypes but has zero call sites in the library bundle**. It was added to the API surface but never implemented. The callback was never invoked — not just "unreliable after physics", but literally never called, ever.

This meant:
- All InstancedMesh init/sync logic was dead code
- Star twinkling was dead code (stars were static, just not noticeable)
- Nebula drift was dead code (same)
- `initInstancedMeshes` was only reachable via `onEngineStop`, which fires when d3-force physics fully converge — 10–20 seconds for 700+ nodes. That matched the user's observed delay exactly.

**Diagnosis path:** Instrumented with `console.log` at the top of `onRenderFramePost` (unconditional, frame 1). No logs appeared despite canvas rendering. Then fetched the library source and grepped: `onRenderFramePost` appears exactly twice — both times in the PropTypes declaration block.

**Fix:** Moved ALL per-frame work into the existing independent `requestAnimationFrame` loop that already drives orbit and comets:

```js
// In the rAF tick — after comets, before rafId = requestAnimationFrame(tick)

// Init once: warmupTicks={300} runs synchronously before the rAF loop fires,
// so node.x is already set to settled positions on the first tick.
if (!instanceInitializedRef.current) {
  const n0 = graphRef.current?.nodes?.[0]
  if (n0?._radius !== undefined && n0?.x !== undefined) {
    initInstancedMeshes()
  }
}

// Sync every 2nd frame
if (frame % 2 === 0 && instanceInitializedRef.current) { /* matrix upload */ }

// Stars every 3rd frame, nebulae every frame
```

Removed `onRenderFramePost` callback and prop entirely. Committed as `cb381d3`.

---

### Correcting a wrong entry from 2026-05-25

Bug 2 in the previous session's log ("Comets never appeared") stated: *"`onRenderFramePost` stops being called reliably or stops entirely after physics settles."* This was the wrong root cause. `onRenderFramePost` never fires at all — it was already dead from day 1. Comets appeared to be an `onRenderFramePost` problem because the original comet code was inside it. Stars and nebulae were silently broken the same way (static stars, non-drifting nebulae) — the visual effect is subtle enough that it went unnoticed.

**Corrected root cause:** `onRenderFramePost` is an unimplemented stub in react-force-graph-3d. Never use it. All per-frame animation belongs in the independent rAF loop.

---

### Architecture lesson

The original PHASES.md spec called for `onRenderFramePost` for breathing/particle animation. That was wrong from the start. The correct pattern, now consistent throughout the codebase:

- **Independent rAF loop** (`useEffect` with `[]`): ALL per-frame animation — orbit, comets, InstancedMesh sync, star twinkling, nebula drift.
- **Event callbacks** (`onEngineStop`, `onNodeClick`, etc.): one-shot state changes only.
- **`onRenderFramePost`**: do not use. It exists in PropTypes but does nothing.

---

### Performance result

Draw calls for 700 nodes: **700+ → 3** (one InstancedMesh per degree bucket). Frame throttling: matrix sync every 2nd frame (30fps), star colors every 3rd frame. The graph is now scale-ready to 1000+ nodes.

---

### Commits this session

| Hash | Description |
|---|---|
| `5087da1` | InstancedMesh optimization (initial, with TDZ crash) |
| `2f75038` | Fix invisible nodes (wrong root cause — __threeObj check) |
| `72941c3` | Fix invisible nodes (wrong root cause — node.x/y/z swap) |
| `cb381d3` | **Definitive fix** — move all per-frame work to rAF loop, remove ghost onRenderFramePost |

---

## 2026-05-25 — Visual polish debug marathon + Phase 2 planning (Claude Code, Sonnet 4.6)

### Session summary

Full visual QA pass on the live site using `/browse`, surfacing and fixing six separate bugs in the 3D graph renderer. Then planned Phase 2 (fly-to, info panel, stats overlay, gen_graph.py extension).

### Bugs Debugged and Fixed

#### Bug 1 — Auto-orbit not working (Three.js r184 breaking change)

**Symptom:** Camera never rotated. `/browse` screenshots taken 8 seconds apart showed identical camera positions.

**Root cause:** Three.js r147+ requires `controls.update(deltaTime)` with an explicit delta for `autoRotate` to apply rotation. The `react-force-graph-3d` library calls `controls.update()` with no argument, so the delta defaults to zero and rotation never accumulates.

**Fix:** Disabled `controls.autoRotate = false`. Implemented manual orbit in the independent rAF loop:
```js
camera.position.applyAxisAngle(new THREE.Vector3(0,1,0), 0.001)
camera.lookAt(controls.target)
```
Orbit pauses on `controls 'start'` event, resumes 3s after `'end'` event via `setTimeout`.

**Key learning:** Never rely on `OrbitControls.autoRotate` in projects where the library controls the update loop. Manual `applyAxisAngle` is portable across all Three.js versions.

---

#### Bug 2 — Comets never appeared (onRenderFramePost is a ghost prop)

**Symptom:** No comets visible ever, even with correct spawn logic.

**Root cause (originally documented incorrectly — corrected 2026-05-26):** `onRenderFramePost` is declared in react-force-graph-3d's PropTypes but **has no call sites in the library bundle**. It was never implemented. The callback never fires, not just "after physics settles" — it never fires at all. The comet spawn logic was inside this dead callback.

**Fix:** Moved ALL comet logic (spawn, animate trail/head, cleanup) into the same independent `requestAnimationFrame` loop that handles orbit. The loop runs unconditionally every frame for the lifetime of the component.

```js
useEffect(() => {
  let rafId
  const tick = () => {
    // orbit + comets here
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}, [])
```

**Key learning:** Do not use `onRenderFramePost`. It is an unimplemented stub. All per-frame animation belongs in the independent rAF loop. (This bug also silently broke star twinkling and nebula drift, which lived in `onRenderFramePost` — confirmed and fixed 2026-05-26.)

---

#### Bug 3 — Comets spawning behind camera (randomOnSphere distributes evenly)

**Symptom:** Even when comets ran, most were invisible because they spawned/moved behind the camera.

**Root cause:** `randomOnSphere()` distributes uniformly across the full sphere surface. ~50% of spawn points are in the rear hemisphere, invisible to the camera. The comet sweeps from a random point to another random point — often fully out of view.

**Fix:** Camera-relative cone-angle spawning. `mkEdge()` samples a direction 60-80° from `camera.getWorldDirection()` using cross products to build a camera-aligned coordinate frame:

```js
const camFwd = camera.getWorldDirection(...)
const camRight = crossVectors(camFwd, camera.up).normalize()
const camUp2 = crossVectors(camRight, camFwd).normalize()
const coneAngle = (Math.PI / 180) * (60 + Math.random() * 20)
const spin = Math.random() * Math.PI * 2
direction = camFwd * cos(coneAngle) + camRight * sin(coneAngle)*cos(spin) + camUp2 * sin(coneAngle)*sin(spin)
```

Comets now always spawn at screen edges and sweep across visible space.

---

#### Bug 4 — Comet points rendered as squares (PointsMaterial default)

**Symptom:** At the tail fade, distinct squares were visible instead of soft circular glowing points.

**Root cause:** `THREE.PointsMaterial` renders WebGL `gl_PointCoord` quads — square pixels with no alpha masking. The circular appearance requires an explicit alpha texture.

**Fix:** Module-level cached canvas texture (`getCircleTex()`) — 64×64 canvas with a radial gradient (opaque white center → transparent edge), set as `map` with `alphaTest: 0.01`:

```js
const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
g.addColorStop(0, 'rgba(255,255,255,1)')
g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
g.addColorStop(1, 'rgba(255,255,255,0)')
```

Applied to both the trail (`PointsMaterial`) and the head point. Module-level caching ensures only one `CanvasTexture` is ever allocated.

---

#### Bug 5 — Nebula spheres showing visible outline ring (THREE.DoubleSide)

**Symptom:** Large translucent nebula spheres showed a visible circular outline, like a faint ring floating in space. Visible when orbiting.

**Root cause:** `THREE.DoubleSide` renders both front AND back faces. At a sphere's silhouette edge, both faces align and their opacity adds together, creating a visible seam/ring. The camera is positioned *inside* the nebula spheres (they're large background elements, r=165-230, centered near origin where camera starts).

**Fix:** Changed to `THREE.BackSide`. Camera inside the sphere → only inner surface is relevant. BackSide renders the interior surface correctly, and the silhouette doubling never occurs.

---

#### Bug 6 — Edges nearly invisible (edgeColorForDegree too dark)

**Symptom:** Links between nodes were almost invisible against the dark navy background.

**Root cause:** Original `edgeColorForDegree` returned dark colors (`#2e4080`, `#4a3060`, `#6a4820`) — these have RGB values well below bloom threshold and no emissive boost, so they vanish into the background.

**Fix:** Brightened to vivid blue-violet-gold: `#4a78e0` (low degree), `#8860cc` (mid), `#d4881a` (high). Also raised `linkOpacity` from 0.6 → 0.85.

---

#### Bug 7 — Node clustering too dense (d3 charge too weak)

**Symptom:** 67 nodes with 175 links collapsed into a tight cluster. Highly connected nodes occupied the same position.

**Root cause:** Default d3 `charge.strength(-30)` is too weak — link tension at 175 edges dominates and pulls everything toward the center.

**Fix:** Three-part physics tuning:
1. `charge().strength(-200)` — stronger repulsion
2. `link().distance(70)` — explicit preferred edge length
3. `forceCollide(n => sizeForDegree(n.degree) * 2.5 + 12)` — hard constraint that prevents overlap regardless of link tension (imported from `d3-force-3d`)

`forceCollide` is the critical addition because it acts as a rigid body constraint that link forces cannot override.

---

#### Bug 8 — Nebula background too blue / overbright (bloom threshold too low)

**Symptom:** Background nebulae glowed intensely, washing out the foreground nodes. The overall look was more "blue fog" than "deep space."

**Root cause:** `emissiveIntensity: 0.6` on nebula meshes + bloom `threshold: 0.15` meant the nebulae themselves triggered bloom amplification.

**Fix:** `emissiveIntensity: 0.12` (5× reduction) + bloom threshold raised to `0.25`. Nebulae are now subtle ambient atmosphere; bloom activates only on bright node cores.

---

#### Git pattern: push rejections from GitHub Action commits

**Symptom:** `git push` rejected because Vercel/GitHub Action had committed to main since last pull.

**Pattern:** `git stash && git pull --rebase origin main && git stash pop && git push origin main`

Using rebase (not merge) keeps the linear history clean.

---

### Implemented This Session

| Item | Result |
|---|---|
| Manual orbit via `applyAxisAngle` | Replaces broken `autoRotate` across Three.js versions |
| Comet logic in independent rAF | Survives physics simulation settling |
| Camera-relative comet spawning | Comets always visible (60-80° cone from camera fwd) |
| Circle texture for PointsMaterial | Soft circular glowing comets, not squares |
| `THREE.BackSide` on nebulae | Eliminated silhouette outline ring |
| Bright `edgeColorForDegree` | Visible blue/violet/gold links |
| Physics: charge -200, collide force | Open, readable node layout |
| Bloom threshold 0.25 | Nebulae don't trigger bloom amplification |

### Phase 2 Planned

T8: gen_graph.py extension (excerpt, tags, generated_at)
T9: Stats info overlay (note count, connections, last updated)
T10: Camera fly-to + floating info panel on node click

### Current State

Live at Vercel. All Phase 1 visual effects working:
- Manual orbit (pauses on drag, resumes after 3s)
- Comets (camera-relative, staggered fade, circular points)
- Nebulae (BackSide, subtle emissive)
- Node clustering (charge -200, forceCollide)
- Bloom (threshold 0.25)

Commits this session: `8f93d7e` through `98172a6` (multiple comet/orbit fix iterations).

---

## 2026-05-24 — T7 GitHub Action (Claude Code, Sonnet 4.6)

### Session summary

Implemented the GitHub Action that auto-updates `public/graph.json` in the viz repo on every vault push.

### Implemented

| Task | Result |
|---|---|
| T7 | Added `/mnt/c/obsidian/.github/workflows/update-graph.yml`; triggers on push to main/master + workflow_dispatch; runs gen_graph.py, diffs, and pushes graph.json to cs-keni/viz via VIZ_REPO_PAT |

### Checks

- Vault repo committed: `b832546`

### Gotchas

- GitHub username resolved from `git config user.name` and `git remote -v`: `cs-keni`, vault repo is `obsidian-vault`, viz repo will be `viz`.
- Workflow uses `[skip ci]` in the commit message so Vercel doesn't double-deploy when graph.json is the only change.
- Diff guard (`git diff --cached --quiet`) skips the commit entirely when graph.json didn't change (e.g. vault push with no wikilink changes).

### Remaining before go-live

1. Create public GitHub repo `cs-keni/viz` and push the viz repo.
2. Connect Vercel to `cs-keni/viz` for auto-deploy.
3. Add `VIZ_REPO_PAT` secret (fine-grained PAT with Contents: write on `cs-keni/viz`) to vault repo secrets.
4. Visual QA: run `npm run dev` and inspect WebGL graph in browser.

---

## 2026-05-24 — T1-T6 implementation (Codex, GPT-5.5 xmedium)

### Session summary

Implemented the standalone Vite + React graph visualizer through T6. The app now fetches generated graph data, lazy-loads the 3D renderer, and renders a Three.js/react-force-graph-3d knowledge graph with desktop bloom, breathing nodes, and link particles.

### Implemented

| Task | Result |
|---|---|
| T1 | Scaffolded Vite React app, installed `react-force-graph-3d`, `three`, Vitest, Testing Library, and jsdom |
| T2 | Added `/mnt/c/obsidian/.github/scripts/gen_graph.py` and pytest coverage; generated `public/graph.json` with 67 nodes and 175 links |
| T3 | Added `useGraphData` with fetch, schema validation, loading/error state, and hook tests |
| T4 | Added `Graph3D`, color/date utilities, `warmupTicks={100}`, Three.js node meshes, custom particle links, and stale-closure-safe animation refs |
| T5 | Added `isMobile()` and guarded `UnrealBloomPass` with `!isMobile() && window.WebGL2RenderingContext` |
| T6 | Replaced starter UI with the app shell and lazy-loaded `Graph3D` via `React.lazy` + `Suspense` |

### Checks

- `npm run test` — 3 files, 14 tests passed
- `npm run build` — passed; generated a separate `Graph3D` chunk
- `npm run dev -- --host 127.0.0.1` — served successfully during T1 on port 5174
- `python -m pytest tests/test_gen_graph.py` in `/mnt/c/obsidian` — 6 passed

### Gotchas

- `npm create vite@latest . -- --template react --force` cancelled in the non-empty repo, so Vite was scaffolded in a temporary directory and copied into place.
- Vitest with this Vite/OXC setup requires JSX tests to use `.jsx`; the hook test is `src/hooks/useGraphData.test.jsx`.
- jsdom startup is slow in this environment, so even small Vitest suites take around 40-50 seconds.
- The vault repo had unrelated dirty files before T2. Only the generator and test files were committed there.

### Commits

Viz repo: `375d1f9`, `5ed533b`, `d82acf8`, `298f445`, `028cff6`, `2aa7b29`.

Vault repo: `d51d7bf`.

## 2026-05-24 — Initial session (Claude Code, Sonnet 4.6)

### Session summary

Kicked off the project from a blank directory. Ran office-hours + plan-eng-review before writing any code.

### Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Graph library | react-force-graph-3d | Layer 1: battle-tested, handles physics + Three.js, hooks are expressive enough for all visual effects |
| Post-processing | Three.js UnrealBloomPass via postProcessingComposer() | @react-three/postprocessing requires R3F and won't work here |
| Visual aesthetic | Neural/Organic | Locked by Kenny: deep navy, blue-violet → gold by degree, breathing pulse, particle trails |
| Data pipeline | Python gen_graph.py → graph.json → Vercel public/ | Fully static, no backend, free tier |
| Mobile bloom | Disabled on mobile (WebGL2 + userAgent detection) | iOS Safari render target issues + perf |
| Code splitting | React.lazy + Suspense on Graph3D | ~1MB Three.js bundle; loading skeleton covers the gap |
| Error state | useGraphData returns {data, loading, error} | First deploy has no graph.json until Action runs |
| Animation pattern | useRef for graph data in animation callbacks | Stale closure prevention |
| Simulation warmup | warmupTicks=100 | Avoids visible settling jank on portfolio page |
| Testing | Vitest (JS), pytest (Python) | Vitest native to Vite; pytest for gen_graph.py edge cases |

### Key files created this session

- `PHASES.md` — implementation checklist
- `TODOS.md` — deferred items
- `docs/AI_CONTEXT.md` — project architecture reference
- `docs/HANDOFF.md` — state + implementation guide for next agent
- `docs/CURRENT_TASK.md` — active task list
- `docs/ENGINEERING_LOG.md` — this file
- `~/.gstack/projects/viz/keni--design-20260524-120843.md` — approved design doc (office-hours output)

### Commits

None yet — scaffold not started.

### What's next

T1-T7 per CURRENT_TASK.md. Codex is picking up implementation.

---

*Add new entries above this line in format: `## YYYY-MM-DD — Description (Agent, Model)`*
