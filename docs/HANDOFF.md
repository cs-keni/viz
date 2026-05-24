# HANDOFF

**Last updated:** 2026-05-24 by Claude Code (Sonnet 4.6)
**Session:** T1-T7 complete. Phase 1 implementation done — deployment pending.

## State

The Vite + React app is scaffolded and renders through `src/App.jsx`, which fetches `/graph.json`, shows loading/error states, and lazy-loads `src/components/Graph3D.jsx` behind `React.lazy` + `Suspense`.

`public/graph.json` was generated from `/mnt/c/obsidian` and currently contains 67 nodes and 175 links.

The vault repo also now has:
- `/mnt/c/obsidian/.github/scripts/gen_graph.py`
- `/mnt/c/obsidian/tests/test_gen_graph.py`

Existing unrelated dirty vault files were left untouched.

## Implemented

- T1: Vite React scaffold, dependencies, Vitest jsdom setup, test scripts.
- T2: Vault graph generator with pytest coverage for basic links, aliases, missing frontmatter, no links, duplicates, and degree counts.
- T3: `useGraphData` hook with schema validation and tests for success, 404, malformed JSON, and invalid schema.
- T4: `Graph3D` with `warmupTicks={100}`, Three.js sphere nodes, degree colors/sizes, recent-node emissive boost and stronger pulse, custom particle links, and ref-backed animation state.
- T5: `isMobile()` utility and bloom guard using `!isMobile() && window.WebGL2RenderingContext`; bloom uses `postProcessingComposer()` + Three.js `UnrealBloomPass`.
- T6: Graph3D code split through `React.lazy()` + `Suspense`; loading skeleton uses centered spinner on navy background.

## Commits

Viz repo:
- `375d1f9` — Initialize Vite React app
- `5ed533b` — Add generated graph data
- `d82acf8` — Add graph data hook
- `298f445` — Add 3D graph renderer
- `028cff6` — Add mobile bloom guard
- `2aa7b29` — Lazy load graph view

Vault repo:
- `d51d7bf` — Add vault graph generator

## Checks Run

- `npm run test` — 3 files, 14 tests passed
- `npm run build` — passed; emits a separate `Graph3D` chunk
- `npm run dev -- --host 127.0.0.1` — served successfully during T1 on port 5174 because 5173 was in use
- `python -m pytest tests/test_gen_graph.py` in `/mnt/c/obsidian` — 6 passed
- `python .github/scripts/gen_graph.py /mnt/c/obsidian > /mnt/c/dev/viz/public/graph.json`

## Remaining Work (Deployment)

All code is written. What's left is infrastructure:

1. **Create GitHub repo** — Kenny creates `cs-keni/viz` (public) on GitHub.
2. **Push viz repo** — `git remote add origin git@github.com:cs-keni/viz.git && git push -u origin main`
3. **Connect Vercel** — import `cs-keni/viz` on vercel.com; framework preset: Vite; no env vars needed.
4. **Create PAT** — GitHub → Settings → Developer Settings → Fine-grained tokens → New token:
   - Resource owner: cs-keni
   - Repository access: Only `cs-keni/viz`
   - Permissions: Contents → Read and write
   - Copy the token value
5. **Add secret to vault repo** — `cs-keni/obsidian-vault` → Settings → Secrets and variables → Actions → New secret → Name: `VIZ_REPO_PAT`, Value: (pasted token)
6. **Visual QA** — run `npm run dev` and inspect the WebGL graph in browser on desktop + mobile viewport.
7. **End-to-end test** — push a note to vault; verify graph.json updates in viz repo and Vercel redeploys.
