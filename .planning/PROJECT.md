# Top Focus

## What This Is

A floating macOS desktop overlay built with Tauri v2 that displays your current #1 task as a persistent, always-on-top visual anchor. You manually enter one task at a time; the widget stays visible in a corner of your screen so after any interruption, re-engagement is a glance, not a search.

## Core Value

After an interruption, you see your #1 task instantly — no app-switching, no list-scanning, no re-orientation cost.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Always-on-top floating window, draggable, snaps to screen edges/corners, remembers position between sessions
- [ ] Compact mode (~300×60px): task name, bold, single line, orange accent design
- [ ] Expanded mode (~400×200px): full task text, edit field, action buttons — triggered by click or keyboard shortcut
- [ ] Task entry: free text, any length, confirmed to collapse to compact mode
- [ ] Mark complete: brief "Done ✓" visual state (~1-2 sec) then widget clears to empty "What's your #1?" state
- [ ] Task history: last 20 tasks stored locally, surfaced for quick re-selection
- [ ] Keyboard shortcut to toggle expand/collapse (user-configurable)
- [ ] Keyboard shortcut to open new task input directly (user-configurable)
- [ ] Opacity/transparency slider
- [ ] Launch at startup (configurable toggle, v1 must-have)
- [ ] Orange accent design (#FF6B2B or similar) — high-contrast white text, rounded corners, subtle shadow, dark mode support
- [ ] All data stored locally (JSON), no network calls, fully offline
- [ ] App size < 15 MB, launch < 1 second, negligible idle resource usage

### Out of Scope

- Cloud sync — v1 is local-only; complexity not justified yet
- Trello/Jira integration — explicit future consideration, requires auth/network
- AI focus prompts — requires Claude API + context model, v2+
- Time tracking / Pomodoro — v2; adds UI complexity
- Task queue (stack-rank 3-5 tasks) — v2; one task is the whole point of v1
- Daily review / nudge mode — v2

## Context

- **Builder:** Tom Ostapchuk (sole user and developer for v1)
- **Runtime:** Tauri v2 — Rust backend, macOS native WebKit webview. Chosen for native feel, small bundle (~5-10 MB), fast startup, low memory vs Electron (~150 MB)
- **Frontend:** HTML/CSS/JS (or React if complexity warrants it)
- **Storage:** Local JSON file — current task state + last 20 task history
- **Design language:** Prominent, modern, orange-first. SF Pro / system font stack. Should feel like a confident badge, not a utility tray icon. Compact mode readable from arm's length.
- **Task completion UX:** Brief "Done ✓" visual feedback (~1-2 sec) before clearing — provides satisfying micro-feedback before returning to empty state

## Constraints

- **Platform**: macOS only — Tauri targets macOS native webview; Windows/Linux out of scope for v1
- **Tech stack**: Tauri v2 + Rust backend — decided; no Electron alternative
- **Privacy**: No network calls in v1 — all state is local JSON
- **Performance**: App size < 15 MB, launch to visible < 1 sec, negligible idle CPU/RAM
- **Startup**: Must launch at login (macOS login item) — user-configurable toggle but must work in v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri v2 over Electron | 5-10 MB vs 150 MB bundle, native feel, lower resource usage | — Pending |
| One task only (not a list) | The value is the visual anchor — a list adds scanning cost back | — Pending |
| Manual task entry (no integrations) | Integrations add auth/sync complexity; v1 validates the core loop | — Pending |
| Brief "Done ✓" state on completion | Provides satisfying micro-feedback before clearing | — Pending |
| Launch at startup in v1 | Widget must survive reboots to be a persistent habit — not optional | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after initialization*
