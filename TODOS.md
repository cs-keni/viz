# TODOS

## Search / filter bar

**What:** A text input (probably top-center, auto-hidden until focused) that highlights matching nodes by label and dims everything else. Clear button or Escape to reset.

**Why:** The graph is large enough now that finding a specific node by eye is difficult. Search makes it navigable.

**Pros:** High day-to-day utility. Relatively contained — just filter which InstancedMesh instances are brightened vs dimmed, reuse the existing `applySelectionColors` dimming system.

**Cons:** Needs careful UI design so it doesn't clutter the space view aesthetic.

**Depends on:** Nothing — can be added standalone.

---

## Share link (`#node=<id>` URL hash)

**What:** Parse `location.hash` on load; if it contains a node ID, auto-select that node (fly-to + open InfoPanel). When a node is selected, update the hash. Copy-link button in InfoPanel.

**Why:** Makes it easy to share a specific note with someone — send a URL, they land looking at the right node.

**Pros:** Tiny implementation. High value for portfolio use.

**Cons:** Node IDs contain slashes (e.g. `Projects/Bobby Brain Viz`) — need URI encoding.

**Depends on:** Nothing.

---

## Growth replay / timeline mode

**What:** A "play" button that animates nodes appearing in chronological order (using `node.created`). Nodes fade in one by one or in date-grouped bursts, with the camera doing a slow wide orbit. A scrubber lets you jump to any point in time.

**Why:** Compelling portfolio storytelling — "watch Bobby grow over time." Shows the knowledge graph as a living thing.

**Pros:** Visually stunning. All the data (created dates) is already in graph.json.

**Cons:** Most complex of the five. Needs careful interaction with the InstancedMesh visibility system — probably requires a per-instance visibility flag in the rAF loop.

**Depends on:** InstancedMesh architecture (current). Plan carefully before implementing.

---

## Path highlighting between two nodes

**What:** Alt-click (or a "find path" mode) lets you pick two nodes and renders the shortest path between them as a glowing traced edge — animated highlight traveling along the links.

**Why:** Shows how ideas connect across the graph. Strong "wow" demo moment.

**Pros:** Algorithmically straightforward (BFS on the link list). The visual effect (glowing path) can reuse the existing edge color system.

**Cons:** Needs a clear UX for "select two nodes" without clashing with the existing single-node select flow.

**Depends on:** Nothing structural. Plan the interaction model before implementing.

---

## Connection ripple on node select

**What:** When a node is clicked, a pulse wave animates outward along its edges to first-degree neighbors, then fades. A brief visual "this node connects to these" moment before the InfoPanel settles.

**Why:** Makes the graph feel alive and gives immediate visual feedback about a node's connectedness.

**Pros:** Pure visual polish, no data changes needed. Can be driven from the existing rAF loop.

**Cons:** Need to animate per-link objects in the rAF loop — links are currently rendered by react-force-graph-3d's own system, not our rAF. May need `linkThreeObject` to take over link rendering for this to work cleanly.

**Depends on:** Plan before implementing — touches the link rendering system.

---

## Display "last updated" timestamp from graph.json

**What:** Show a small "• last updated N days ago" line in the UI using the `generated` field from graph.json.

**Why:** If the GitHub Action breaks (PAT expired, repo renamed), the site silently shows stale data. Viewers have no indication. This makes the failure visible.

**Pros:** 5 lines of code. Makes pipeline failures immediately obvious.

**Cons:** None significant — the data is already in graph.json.

**Context:** The `generated` timestamp field is already in graph.json schema (added in design doc during eng review). The fetch hook already returns it as part of `data`. Only needs UI: a small fixed-position text element in the corner of the app.

**Depends on:** Phase 1 core app complete (graph.json fetching working).
