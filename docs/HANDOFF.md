# HANDOFF

**Last updated:** 2026-05-24 by Claude Code (Sonnet 4.6)
**Session:** Initial project setup — office-hours + eng review complete, implementation not yet started.

## State

The repo is empty. `git init` and the docs folder are the only things here. PHASES.md and TODOS.md exist. No Vite scaffold, no source files, no package.json.

The vault at `/mnt/c/obsidian` has ~70+ notes with wikilinks. It is the data source.

## What Was Decided This Session

1. **Stack locked**: react-force-graph-3d + vanilla Three.js effects. NOT @react-three/fiber. NOT @react-three/postprocessing (incompatible — requires R3F).

2. **Visual direction locked**: Neural/Organic — deep navy bg, blue-violet → gold nodes by degree, soft bloom, breathing pulse, particle trails.

3. **Architecture**: Fully static. Vite + React on Vercel. graph.json in public/. GitHub Action in vault repo pushes updates.

4. **7 engineering issues resolved** in the eng review:
   - Mobile bloom detection (skip UnrealBloomPass on mobile)
   - Code split Graph3D with React.lazy
   - Error state in useGraphData (not just spinner)
   - Schema validation for graph.json in useGraphData
   - Stale closure: animation callbacks read from useRef, not state
   - warmupTicks=100 to avoid simulation settling jank
   - pytest for gen_graph.py before wiring the Action

5. **Design doc** at: `~/.gstack/projects/viz/keni--design-20260524-120843.md`

## What Codex Should Do Next

Start with T1 and T2 in parallel, then T3, T4, T5+T6 (together), then T7.

**Priority order: T2 before T4** — you need gen_graph.py working + real graph.json before you can see Graph3D rendering real data. Use the vault at `/mnt/c/obsidian` as the input.

### T1 — Vite scaffold (do this first, in viz repo)

```bash
cd /mnt/c/dev/viz
npm create vite@latest . -- --template react
npm install react-force-graph-3d three
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

Add to vite.config.js:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
})
```

Create `src/setupTests.js`:
```js
import '@testing-library/jest-dom'
```

Add to package.json scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### T2 — gen_graph.py (in vault repo at /mnt/c/obsidian/.github/scripts/)

The script:
- Input: vault root path (arg 1)
- Walks all .md files in Maps/, Projects/, Areas/, Resources/, Daily Notes/
- Extracts: id (folder/filename without .md), label (filename without .md), folder (top-level dir), created (YAML frontmatter `created:` field, default to null), wikilinks `[[...]]` and `[[...|alias]]` (target = first part before |)
- Computes degree per node (outbound + inbound link count)
- Output: JSON to stdout with schema from AI_CONTEXT.md

Edge cases to handle:
- Missing YAML frontmatter → created: null
- Link targets that don't resolve to a file → still include as a node with degree from links
- `[[note|alias]]` → link target is "note"
- Duplicate links between same pair → deduplicate
- Self-links → skip

Run against vault:
```bash
cd /mnt/c/obsidian
python .github/scripts/gen_graph.py /mnt/c/obsidian > /mnt/c/dev/viz/public/graph.json
```

pytest at `/mnt/c/obsidian/tests/test_gen_graph.py`:
- test_basic_link: one file with [[other]], other file exists → link in output
- test_alias: [[note|alias]] → link to "note" not "alias"
- test_missing_frontmatter: file with no YAML → node present, created is null
- test_no_links: file with no wikilinks → node present, degree 0
- test_duplicate_links: file with [[note]] twice → one link in output
- test_degree: 3 files linking to one hub → hub has degree 3

### T3 — useGraphData hook

```js
// src/hooks/useGraphData.js
import { useState, useEffect } from 'react'

function validateGraph(data) {
  if (!Array.isArray(data?.nodes)) throw new Error('graph.json: nodes must be an array')
  if (!Array.isArray(data?.links)) throw new Error('graph.json: links must be an array')
  for (const n of data.nodes) {
    if (!n.id || !n.label) throw new Error(`graph.json: node missing id or label`)
  }
  return data
}

export function useGraphData(url = '/graph.json') {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`) ; return r.json() })
      .then(validateGraph)
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }) })
      .catch(error => { if (!cancelled) setState({ data: null, loading: false, error }) })
    return () => { cancelled = true }
  }, [url])
  return state
}
```

### T4 — Graph3D component

See AI_CONTEXT.md for full spec. Key implementation notes:

```jsx
// Pattern for stale-closure-safe animation
const graphRef = useRef(null)
useEffect(() => { graphRef.current = data }, [data])

// Pattern for particle Map
const particleMapRef = useRef(new Map())

// nodeThreeObject
const nodeThreeObject = useCallback((node) => {
  const radius = Math.log(node.degree + 1) * 3 || 2
  const color = colorForDegree(node.degree)
  const geo = new THREE.SphereGeometry(radius, 16, 16)
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: isRecentlyAdded(node.created) ? 0.6 : 0.2,
  })
  node._phase = Math.random() * Math.PI * 2  // stagger breathing
  return new THREE.Mesh(geo, mat)
}, [])

// linkThreeObject — particles
const linkThreeObject = useCallback((link) => {
  const positions = new Float32Array(5 * 3)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, opacity: 0.6, transparent: true })
  const points = new THREE.Points(geo, mat)
  const particles = Array.from({ length: 5 }, (_, i) => ({ t: i / 5 }))
  particleMapRef.current.set(link.__indexColor, { points, particles, link })
  return points
}, [])

// onRenderFramePost
const onRenderFramePost = useCallback((renderer, time) => {
  const graph = graphRef.current
  if (!graph) return
  // breathing pulse
  graph.nodes?.forEach(node => {
    if (node.__threeObj) {
      node.__threeObj.scale.setScalar(1 + 0.04 * Math.sin(time * 1.2 + (node._phase || 0)))
    }
  })
  // particle movement
  particleMapRef.current.forEach(({ points, particles, link }) => {
    const src = link.source, tgt = link.target
    if (!src?.x || !tgt?.x) return
    particles.forEach((p, i) => {
      p.t = (p.t + 0.003) % 1
      const pos = points.geometry.attributes.position
      pos.setXYZ(i, src.x + (tgt.x - src.x) * p.t, src.y + (tgt.y - src.y) * p.t, src.z + (tgt.z - src.z) * p.t)
    })
    points.geometry.attributes.position.needsUpdate = true
  })
}, [])
```

### T5+T6 — Mobile detection + code split

```js
// src/utils/device.js
export const isMobile = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
```

In Graph3D, after postProcessingComposer:
```js
if (!isMobile() && window.WebGL2RenderingContext) {
  const composer = fgRef.current.postProcessingComposer()
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.2)
  composer.addPass(bloomPass)
}
```

In App.jsx:
```jsx
const Graph3D = React.lazy(() => import('./components/Graph3D'))
// ...
<Suspense fallback={<LoadingSkeleton />}>
  <Graph3D data={data} />
</Suspense>
```

### T7 — GitHub Action YAML (vault repo)

Write to `/mnt/c/obsidian/.github/workflows/update-graph.yml`:

```yaml
name: Update Bobby Brain Viz graph

on:
  push:
    branches: [main]

jobs:
  update-graph:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout vault
        uses: actions/checkout@v4
        with:
          path: vault

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Generate graph.json
        run: python vault/.github/scripts/gen_graph.py vault > graph.json

      - name: Checkout viz repo
        uses: actions/checkout@v4
        with:
          repository: ${{ github.repository_owner }}/viz
          path: viz
          token: ${{ secrets.VIZ_REPO_PAT }}

      - name: Push graph.json to viz repo
        run: |
          cp graph.json viz/public/graph.json
          cd viz
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/graph.json
          git diff --cached --quiet || git commit -m "chore: update graph.json from vault push"
          git push
```

Kenny needs to add `VIZ_REPO_PAT` secret to the vault repo settings.

## Open Questions

- What is Kenny's GitHub username? (needed for Action YAML `repository:` field)
- Has Kenny created the public viz GitHub repo yet? (No — needs to be created)

## Commit Status

Nothing committed yet. After T1 (scaffold), do the initial commit. After each task, commit specific files and push.

## Architecture Notes

See docs/AI_CONTEXT.md for full architecture, data format, and visual spec.
