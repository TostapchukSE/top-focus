# Roadmap: Top Focus

**Milestone:** v1.0 -- macOS Focus Widget
**Granularity:** Coarse (3 phases, 1-3 plans each)
**Created:** 2026-04-10

## Overview

Three phases take this from zero to a daily-driver macOS widget. Phase 1 produces a running Tauri v2 window with correct macOS behavior (non-activating, always-on-top, all Spaces, no Dock icon). Phase 2 builds the complete task lifecycle inside that shell (enter, display, complete, history, both display modes). Phase 3 adds global shortcuts, startup persistence, edge snapping, performance hardening, and code signing to make it ship-ready.

## Phases

- [x] **Phase 1: Foundation -- Tauri Project + Window Shell** - Running Tauri v2 app with correct macOS window behavior and visual shell (completed 2026-04-10)
- [ ] **Phase 2: Core Task Loop** - Full task lifecycle: enter, display, complete, history across compact and expanded modes
- [ ] **Phase 3: Polish, Shortcuts & Ship** - Global shortcuts, launch at login, edge snapping, performance audit, signed build

## Phase Details

### Phase 1: Foundation -- Tauri Project + Window Shell
**Goal**: A visible, draggable, orange widget shell running as a Tauri v2 app on macOS with all critical window behaviors working -- non-activating clicks, always-on-top, visible on all Spaces, no Dock icon, frameless with transparent rounded corners
**Depends on**: Nothing (first phase)
**Requirements**: WIN-01, WIN-02, WIN-03, WIN-04, WIN-05, WIN-06, WIN-07, WIN-08, WIN-09, BUILD-01, BUILD-02, BUILD-03, BUILD-04
**Success Criteria** (what must be TRUE):
  1. App launches and a frameless, rounded-corner orange widget is visible on screen with no Dock icon and no Cmd+Tab entry
  2. Clicking the widget does NOT steal focus from the currently active application (non-activating NSPanel behavior confirmed)
  3. Widget is visible on all Spaces / virtual desktops -- switching Spaces does not lose it
  4. Widget can be dragged to any position; position is saved and restored correctly on next launch (including off-screen fallback validation)
  5. Click vs drag is cleanly disambiguated -- a quick click without movement does not trigger a drag
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Dev environment + Tauri scaffold (Rust install, Bun, Tauri v2 project, all plugins, capabilities, window config, LSUIElement, macOSPrivateApi, orange HTML/CSS shell)
- [x] 01-02-PLAN.md -- Window behavior (NSPanel non-activating via objc crate, all-Spaces visibility, click/drag disambiguation, position persistence with monitor validation)
**UI hint**: yes

### Phase 2: Core Task Loop
**Goal**: Full working task lifecycle -- user can enter a task, see it in compact mode, expand to edit, mark complete with animation, see history, and re-select from history -- with both display modes and smooth transitions
**Depends on**: Phase 1
**Requirements**: MODE-01, MODE-02, MODE-03, MODE-04, MODE-05, MODE-06, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08, DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04
**Success Criteria** (what must be TRUE):
  1. Compact mode displays the current task as bold white text on orange background, readable at arm's length (~300x60px), with long text truncating via ellipsis
  2. Clicking the widget (or future shortcut) expands to ~400x200px with full task text, edit field, and action buttons (Done, Clear) -- transition animates smoothly (expand: resize then content; collapse: content then resize)
  3. User can type a new task, press Enter or click confirm, and the widget collapses to compact mode showing the new task
  4. Pressing Escape in expanded mode cancels editing and collapses without saving changes
  5. Marking a task complete shows a "Done" checkmark animation (~1.5s, green color shift) then clears to empty state with "What's your #1?" prompt
  6. Last 20 completed tasks are stored and surfaced for quick re-selection in expanded mode
  7. Opacity slider adjusts widget transparency (range 0.3-1.0, persisted)
**Plans**: TBD

Plans:
- [ ] 02-01: Store schema + compact/expanded modes (tauri-plugin-store data model, compact mode UI, expanded mode UI, mode toggle with resize animation, opacity slider)
- [ ] 02-02: Task lifecycle + history (task entry/confirm/collapse, Done animation, clear, empty state, Escape to cancel, task history with re-selection, position persistence of preferences)
**UI hint**: yes

### Phase 3: Polish, Shortcuts & Ship
**Goal**: Daily-driver quality -- global keyboard shortcuts with permission onboarding, launch at login, edge snapping, performance within targets, and a signed+notarized universal binary ready for use
**Depends on**: Phase 2
**Requirements**: KEYS-01, KEYS-02, KEYS-03, KEYS-04, BOOT-01, BOOT-02, BOOT-03, PERF-01, PERF-02, PERF-03, PERF-04, DESIGN-05
**Success Criteria** (what must be TRUE):
  1. Global keyboard shortcut toggles expand/collapse even when another app is focused (default Cmd+Shift+F, user-configurable)
  2. Global keyboard shortcut jumps directly to new task input (default Cmd+Shift+N, user-configurable)
  3. If Accessibility permission is not granted, app shows a clear onboarding prompt guiding user to System Settings; shortcut conflicts are reported, not silently swallowed
  4. Widget launches at macOS login in compact mode at its saved position within 1 second -- no splash screen
  5. Widget magnetically snaps to screen edges/corners when dragged within threshold (~20px) with margin (~12px)
  6. Idle CPU = 0.0% in compact mode, app bundle < 15 MB, WebKit zoom disabled
  7. App is code-signed, notarized, and built as a universal binary (Apple Silicon + Intel)
**Plans**: TBD

Plans:
- [ ] 03-01: Shortcuts + startup (global shortcut registration, Accessibility permission detection/onboarding, conflict handling, tauri-plugin-autostart with LaunchAgent, compact-mode-on-launch guarantee)
- [ ] 03-02: Edge snap + performance + build (Rust edge-snapping command, performance audit and fixes, WebKit zoom lock, code signing, notarization, universal binary)

## Milestone Summary

| Phase | Goal | Plans | Requirements |
|-------|------|-------|--------------|
| Phase 1: Foundation | Running Tauri v2 app with correct macOS window behavior | 2 | WIN-01..09, BUILD-01..04 (13) |
| Phase 2: Core Task Loop | Full task lifecycle with both display modes | 2 | MODE-01..06, TASK-01..08, DESIGN-01..04 (18) |
| Phase 3: Polish, Shortcuts & Ship | Daily-driver quality with shortcuts, startup, signing | 2 | KEYS-01..04, BOOT-01..03, PERF-01..04, DESIGN-05 (12) |

**Total: 43 requirements mapped across 3 phases, 6 plans**

## Risk Register (top 3)

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | 2/2 | Complete   | 2026-04-10 |
| 2 | **Tauri v2 capabilities/permissions misconfiguration** -- missing permissions in `capabilities/default.json` cause silent runtime failures. #1 source of "works in dev, breaks in prod." | High | Configure all plugin permissions in Phase 1 scaffolding (Plan 1). Test each permission explicitly. Required: `core:default`, `store:default`, `global-shortcut:default`, `autostart:default`, `window:allow-set-size`, `window:allow-set-position`, etc. |
| 3 | **Code signing left to last minute** -- unsigned builds blocked by Gatekeeper on macOS Sequoia+. "I'll sign it later" leads to a painful scramble when the app is otherwise done. | High | BUILD-04 is in Phase 1 scope (configure early). Phase 3 Plan 2 completes notarization and universal binary. Signing infrastructure set up before feature work, not after. |

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Core Task Loop | 0/2 | Not started | - |
| 3. Polish, Shortcuts & Ship | 0/2 | Not started | - |
