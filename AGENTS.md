# AGENTS.md — Bobby Brain Viz

Codex-specific instructions for this repo. Read this alongside `CLAUDE.md` (global) and `docs/AI_CONTEXT.md`.

## Session Start Checklist

Before writing or suggesting any code:

1. Read `docs/AI_CONTEXT.md` — architecture, animation system ownership, stack decisions.
2. Read `docs/HANDOFF.md` — current state, what's working, what's in progress.
3. Read `docs/CURRENT_TASK.md` — active task scope.
4. Read `docs/ENGINEERING_LOG.md` — recent changes and why they were made.

Do not skip these. They are the ground truth for this repo.

## Documentation Hygiene (Non-Negotiable)

**Update the docs after every single code change — no exceptions.**

| Doc | Update when |
|---|---|
| `docs/ENGINEERING_LOG.md` | Every code change. Add date header if missing, log what changed and why, note the commit hash. |
| `docs/HANDOFF.md` | Any change to architecture, visual effects, animation system, or component ownership. |
| `docs/AI_CONTEXT.md` | Any change to the animation system, rendering pipeline, data format, stack, or key implementation decisions. |
| `docs/CURRENT_TASK.md` | When starting or finishing a task. Keep it reflecting active work. |
| `PHASES.md` | When a task completes or scope changes. Mark checkboxes in real time. |

**Commit order is always:**
1. Change the code.
2. Update the relevant doc files (same commit).
3. Stage code + docs together — never commit code without the matching doc update.
4. Push immediately so Claude Code always has the latest.

## Critical Architecture Rule

All per-frame animation lives in the **independent `requestAnimationFrame` loop** (`useEffect([])`) in `Graph3D.jsx`. See `docs/AI_CONTEXT.md` → "Animation System — What Owns What" before touching any animation code.

**Never use `onRenderFramePost`** — it is declared in react-force-graph-3d PropTypes but has no call sites in the library bundle. It never fires. Any code placed there is dead.

## Key Files

- `src/components/Graph3D.jsx` — 3D rendering, all animation (~788 lines)
- `src/components/InfoPanel.jsx` — node click info panel
- `src/components/StatsOverlay.jsx` — bottom-left stats
- `src/hooks/useGraphData.js` — fetch + validate graph.json
- `src/utils/colors.js` — colorForDegree, sizeForDegree, isRecentlyAdded
- `docs/AI_CONTEXT.md` — architecture reference
- `docs/HANDOFF.md` — session handoff state
- `docs/ENGINEERING_LOG.md` — running change log

## Collaboration

You work alongside Claude Code (Sonnet 4.6) as an equal engineering partner. Review its work critically but don't silently overwrite. Preserve existing architecture unless Kenny explicitly asks to change it. Make small, reviewable changes.
