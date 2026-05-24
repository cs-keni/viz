# TODOS

## Display "last updated" timestamp from graph.json

**What:** Show a small "• last updated N days ago" line in the UI using the `generated` field from graph.json.

**Why:** If the GitHub Action breaks (PAT expired, repo renamed), the site silently shows stale data. Viewers have no indication. This makes the failure visible.

**Pros:** 5 lines of code. Makes pipeline failures immediately obvious.

**Cons:** None significant — the data is already in graph.json.

**Context:** The `generated` timestamp field is already in graph.json schema (added in design doc during eng review). The fetch hook already returns it as part of `data`. Only needs UI: a small fixed-position text element in the corner of the app.

**Depends on:** Phase 1 core app complete (graph.json fetching working).
