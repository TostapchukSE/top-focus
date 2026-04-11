# Roadmap: Top Focus

**Milestone:** v1.0 -- macOS Focus Widget
**Granularity:** Coarse (3 phases, 1-3 plans each)
**Created:** 2026-04-10

## Overview

Three phases take this from zero to a daily-driver macOS widget. Phase 1 produces a running Tauri v2 window with correct macOS behavior (non-activating, always-on-top, all Spaces, no Dock icon). Phase 2 builds the complete task lifecycle inside that shell (enter, display, complete, history, both display modes). Phase 3 adds global shortcuts, startup persistence, edge snapping, performance hardening, and code signing to make it ship-ready.

## Phases

- [x] **Phase 1: Foundation -- Tauri Project + Window Shell** - Running Tauri v2 app with correct macOS window behavior and visual shell (completed 2026-04-10)
- [x] **Phase 2: Core Task Loop** - Full task lifecycle: enter, display, complete, history across compact and expanded modes (completed 2026-04-11)
- [ ] **Phase 3: Polish, Shortcuts & Ship** - Global shortcuts, launch at login, edge snapping, performance audit, signed build

## Phase Details

### Phase 1: Foundation -- Tauri Project + Window Shell
**Goal**: A visible, draggable, orange widget shell running as a Tauri v2 app on macOS with all critical window behaviors working -- non-activating clicks, always-on-top, visible on all Spaces, no Dock icon, frameless with transparent rounded corners
**Depends on**: Nothing (first phase)
**Requirements**: WIN-01, WIN-02, WIN-03, WIN-04, WIN-05, WIN-06, WIN-07, WIN-08, WIN-09, BUILD-01, BUILD-02, BUILD-03, BUILD-04
**Status**: ✅ Complete — 2026-04-10
**Success Criteria** (all met):
  1. ✅ App launches and a frameless, rounded-corner orange widget is visible on screen with no Dock icon and no Cmd+Tab entry
  2. ✅ Clicking the widget does NOT steal focus from the currently active application (non-activating NSPanel behavior confirmed)
  3. ✅ Widget is visible on all Spaces / virtual desktops -- switching Spaces does not lose it
  4. ✅ Widget can be dragged to any position; position is saved and restored correctly on next launch (including off-screen fallback validation)
  5. ✅ Click vs drag is cleanly disambiguated -- a quick click without movement does not trigger a drag
**Plans**: 2/2 complete

Plans:
- [x] 01-01-PLAN.md -- Dev environment + Tauri scaffold (Rust install, Bun, Tauri v2 project, all plugins, capabilities, window config, LSUIElement, macOSPrivateApi, orange HTML/CSS shell)
- [x] 01-02-PLAN.md -- Window behavior (NSPanel non-activating via objc crate, all-Spaces visibility, click/drag disambiguation, position persistence with monitor validation)

---

### Phase 2: Core Task Loop
**Goal**: Full working task lifecycle -- user can enter a task, see it in compact mode, expand to edit, mark complete with animation, see history, and re-select from history -- with both display modes and smooth transitions
**Depends on**: Phase 1
**Requirements**: MODE-01, MODE-02, MODE-03, MODE-04, MODE-05, MODE-06, TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08, DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04
**Status**: ✅ Complete — 2026-04-11
**Success Criteria** (all met):
  1. ✅ Compact mode displays the current task as bold white text on orange background, readable at arm's length (~300x60px), with long text truncating via ellipsis
  2. ✅ Clicking the widget expands to ~400x220px with full task text, edit field, and action buttons (Done, Clear) -- transition animates smoothly
  3. ✅ User can type a new task, press Enter or click confirm, and the widget collapses to compact mode showing the new task
  4. ✅ Pressing Escape in expanded mode cancels editing and collapses without saving changes
  5. ✅ Marking a task complete shows a "Done ✓" animation (~1.5s, green color shift) then clears to empty state with "What's your top focus?" prompt
  6. ✅ Last 20 completed tasks are stored and surfaced for quick re-selection in expanded mode
  7. ✅ Opacity slider adjusts widget transparency (range 0.3-1.0, persisted)
**Plans**: 2/2 complete

Plans:
- [x] 02-01-PLAN.md -- Compact/expanded modes with transitions
- [x] 02-02-PLAN.md -- Task lifecycle + history

**Additional work (2026-04-11):**
- System tray icon with Show/Hide toggle and Quit menu item
- Dock icon reliably hidden via `setActivationPolicy:Accessory` called post-setup (covers both dev and bundled modes)
- 10 bug fixes: `isAnimating` stuck flag, nested setTimeout races, monitor scale factor mismatch, history list overflow, task maxlength, confirm() dialog in NSPanel, tray toggle, graceful quit with store flush, store corruption recovery, quickComplete auto-expand removed

---

### Phase 3: Polish, Shortcuts & Ship
**Goal**: Daily-driver quality -- global keyboard shortcuts with permission onboarding, launch at login, edge snapping, performance within targets, and a signed+notarized universal binary ready for use
**Depends on**: Phase 2
**Requirements**: KEYS-01, KEYS-02, KEYS-03, KEYS-04, BOOT-01, BOOT-02, BOOT-03, PERF-01, PERF-02, PERF-03, PERF-04, DESIGN-05
**Status**: Not started
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

---

## Milestone Summary

| Phase | Goal | Plans | Requirements | Status |
|-------|------|-------|--------------|--------|
| Phase 1: Foundation | Running Tauri v2 app with correct macOS window behavior | 2/2 | WIN-01..09, BUILD-01..04 (13) | ✅ Complete |
| Phase 2: Core Task Loop | Full task lifecycle with both display modes | 2/2 | MODE-01..06, TASK-01..08, DESIGN-01..04 (18) | ✅ Complete |
| Phase 3: Polish, Shortcuts & Ship | Daily-driver quality with shortcuts, startup, signing | 0/2 | KEYS-01..04, BOOT-01..03, PERF-01..04, DESIGN-05 (12) | Pending |

**Total: 43 requirements mapped across 3 phases, 6 plans**
**Progress: 31/43 requirements complete (72%)**

## Risk Register (top 3)

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | **NSPanel non-activating window** — clicking widget steals focus from other apps | Critical | ✅ Resolved Phase 1 via objc crate msg_send! |
| 2 | **Tauri v2 capabilities/permissions misconfiguration** -- missing permissions cause silent runtime failures | High | ✅ Resolved Phase 1 — all permissions configured and tested |
| 3 | **Code signing left to last minute** -- unsigned builds blocked by Gatekeeper on macOS Sequoia+ | High | BUILD-04 infrastructure in place; Phase 3 Plan 2 completes notarization |

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundation | 2/2 | ✅ Complete | 2026-04-10 |
| 2. Core Task Loop | 2/2 | ✅ Complete | 2026-04-11 |
| 3. Polish, Shortcuts & Ship | 0/2 | Not started | - |
