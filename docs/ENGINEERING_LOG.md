# ENGINEERING LOG

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
