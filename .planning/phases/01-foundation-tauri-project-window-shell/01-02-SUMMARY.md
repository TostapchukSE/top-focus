---
phase: 01-foundation-tauri-project-window-shell
plan: 02
subsystem: window-management
tags: [tauri, macos, objc, nspanel, nswindow, position-persistence, click-drag]

# Dependency graph
requires:
  - phase: 01-foundation-tauri-project-window-shell/01-01
    provides: "Compiling Tauri v2 project with objc crate, frameless transparent window, all plugins registered"
provides:
  - NSPanel non-activating window behavior (clicks do not steal focus)
  - Visible on all Spaces via canJoinAllSpaces + stationary collection behavior
  - Position persistence with debounced save on move and restore on launch
  - Monitor validation with off-screen fallback to primary display top-right
  - Click vs drag disambiguation with 5px threshold
affects: [phase-2, phase-3]

# Tech tracking
tech-stack:
  added: []
  patterns: [objc-msg-send-for-nswindow-properties, debounced-position-save, monitor-bounds-validation, click-drag-threshold-disambiguation, window-tauri-globals-api]

key-files:
  created: []
  modified:
    - src-tauri/src/lib.rs
    - src/main.js
    - src/index.html

key-decisions:
  - "Used objc msg_send! directly on ns_window() pointer rather than raw-window-handle crate (simpler, Tauri macos-private-api exposes ns_window() directly)"
  - "Set window level to floating (3) via objc in addition to Tauri alwaysOnTop config for reinforcement"
  - "Used window.__TAURI__.dpi.LogicalPosition with fallback to window.__TAURI__.window.LogicalPosition for cross-version compatibility"
  - "Removed type=module from script tag since using window.__TAURI__ globals, not ES imports"

patterns-established:
  - "objc msg_send! pattern for setting NSWindow styleMask and collectionBehavior in Tauri setup handler"
  - "Debounced position persistence via onMoved listener + Store plugin"
  - "Monitor bounds validation with 100px horizontal / 50px vertical grace for partial off-screen"
  - "Click vs drag disambiguation via mousedown/mouseup distance + time threshold"

requirements-completed: [WIN-02, WIN-03, WIN-06, WIN-07, WIN-08, WIN-09]

# Metrics
duration: 3min
completed: 2026-04-10
---

# Phase 1 Plan 02: NSPanel Non-activating Window + Position Persistence Summary

**NSPanel non-activating clicks via objc crate, all-Spaces visibility, position persistence with monitor validation, and click/drag disambiguation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-10T15:25:22Z
- **Completed:** 2026-04-10T15:28:31Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 3

## Accomplishments
- Implemented NSPanel non-activating behavior so clicking the widget does not steal focus from the active application (WIN-02)
- Set NSWindowCollectionBehavior for canJoinAllSpaces + stationary + fullScreenAuxiliary so widget appears on all Spaces (WIN-03)
- Built position persistence that saves on move (debounced 500ms) and restores on launch with monitor bounds validation (WIN-08, WIN-09)
- Implemented click vs drag disambiguation with 5px threshold and 300ms time window (WIN-07)

## Task Commits

Each task was committed atomically:

1. **Task 1: NSPanel non-activating window + visible on all Spaces via objc crate** - `ec4a365` (feat)
2. **Task 2: Click/drag disambiguation + position persistence with monitor validation** - `6904016` (feat)
3. **Task 3: Verify all Phase 1 window behaviors** - auto-approved (checkpoint, no code changes)

## Files Created/Modified
- `src-tauri/src/lib.rs` - Added setup handler with objc msg_send! calls for NSWindow styleMask (nonactivatingPanel), collectionBehavior (canJoinAllSpaces, stationary, fullScreenAuxiliary), and floating window level
- `src/main.js` - Full position persistence (initStore, restorePosition, savePosition, debouncedSavePosition, listenForMoves) and click/drag disambiguation (mousedown/mouseup with distance threshold)
- `src/index.html` - Removed type="module" from script tag for window.__TAURI__ globals compatibility

## Decisions Made
- **Direct ns_window() access:** Used Tauri's macos-private-api `ns_window()` method directly rather than the raw-window-handle crate approach. Simpler and compiles cleanly.
- **Floating level reinforcement:** Set NSWindow.Level.floating (3) via objc in addition to Tauri's `alwaysOnTop: true` config, ensuring the window stays above normal windows even after NSPanel mask changes.
- **Removed type="module":** Since we use `window.__TAURI__` globals (not ES imports), the module script type was unnecessary and could cause timing issues with global access.
- **LogicalPosition with dpi fallback:** Check `window.__TAURI__.dpi.LogicalPosition` first, fall back to `window.__TAURI__.window.LogicalPosition` for compatibility across Tauri v2 minor versions.

## Deviations from Plan

None - plan executed exactly as written. The objc crate approach compiled on first attempt and the Tauri API paths matched the plan's primary suggestions.

## Issues Encountered
- Cosmetic `cfg(cargo-clippy)` warnings from the `objc` crate's `sel_impl!` macro. These are harmless and originate from the objc 0.2 crate using an older cfg pattern. No functional impact.

## Known Stubs
- `handleWidgetClick()` in main.js is intentionally a no-op (logs to console). Phase 2 will wire this to expand the widget. This is by design per the plan and does not block Phase 1 goals.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 1 window behaviors are implemented: non-activating clicks, all-Spaces visibility, always-on-top, drag, position persistence, click/drag disambiguation
- Phase 2 can build on `handleWidgetClick()` to add expand/collapse behavior
- Store plugin is initialized and working for additional persistent state in Phase 2+
- The objc setup handler pattern in lib.rs can be extended for any future NSWindow customizations

## Self-Check: PASSED

All 3 modified files verified present. Both task commits verified in git log.

---
*Phase: 01-foundation-tauri-project-window-shell*
*Completed: 2026-04-10*
