---
phase: 01-foundation-tauri-project-window-shell
plan: 01
subsystem: infra
tags: [tauri, rust, macos, vanilla-js, css-custom-properties, code-signing]

# Dependency graph
requires: []
provides:
  - Compiling Tauri v2 project with all plugins registered
  - Frameless transparent always-on-top orange widget shell (300x60px)
  - CSS design token system for colors, spacing, typography
  - Code signing infrastructure with ad-hoc placeholder
  - Tauri capabilities/permissions for all Phase 1 and Phase 2 APIs
affects: [01-02-PLAN, phase-2, phase-3]

# Tech tracking
tech-stack:
  added: [rust-1.94.1, tauri-2.10.3, tauri-plugin-store-2.4.2, tauri-plugin-autostart-2.5.1, tauri-plugin-global-shortcut-2.3.1, tauri-plugin-positioner-2.3.1, objc-0.2, bun-1.3.10]
  patterns: [vanilla-html-css-js, css-custom-properties-design-tokens, data-tauri-drag-region, transparent-window-with-shadow-padding]

key-files:
  created:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src-tauri/src/main.rs
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
    - src-tauri/Info.plist
    - src/index.html
    - src/styles.css
    - src/main.js
    - .env.signing.example
    - .gitignore
    - package.json
  modified: []

key-decisions:
  - "Used Info.plist file instead of inline infoPlist object in tauri.conf.json (Tauri v2 expects string path, not JSON object)"
  - "Changed identifier from com.topfocus.app to com.topfocus.widget (Tauri warns against .app suffix conflicting with macOS bundle extension)"
  - "Removed macos feature from autostart plugin and changed positioner feature from system-tray to tray-icon (matching actual available features in v2)"

patterns-established:
  - "CSS design tokens via :root custom properties for all colors, spacing, typography, and layout values"
  - "Transparent window canvas with 24px padding to accommodate CSS box-shadow without clipping"
  - "data-tauri-drag-region on widget container for native window dragging"
  - "Ad-hoc code signing (-) for dev builds with documented path to production signing"

requirements-completed: [BUILD-01, BUILD-02, BUILD-03, BUILD-04, WIN-01, WIN-04, WIN-05]

# Metrics
duration: 9min
completed: 2026-04-10
---

# Phase 1 Plan 01: Tauri v2 Project Scaffold + Orange Widget Shell Summary

**Tauri v2 project with frameless transparent always-on-top orange widget, all plugins registered, CSS design tokens, and ad-hoc code signing infrastructure**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-10T15:12:37Z
- **Completed:** 2026-04-10T15:22:34Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Installed Rust 1.94.1 and scaffolded a Tauri v2 project that compiles and bundles successfully
- Created a 300x60px orange widget shell with 12px rounded corners, CSS shadow, and transparent background
- Registered all 4 plugins (store, autostart, global-shortcut, positioner) plus objc crate for future NSPanel work
- Configured capabilities with correct core:window: permission prefixes for all needed APIs
- Set up code signing with ad-hoc identity and documented all 6 Apple signing env vars

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Rust, scaffold Tauri v2 project, install all dependencies** - `6baa6b8` (feat)
2. **Task 2: Create orange widget HTML/CSS shell and verify visual rendering** - `d423a1e` (feat)
3. **Task 3: Create code signing environment variable template (BUILD-04)** - `d334031` (chore)

## Files Created/Modified
- `package.json` - Project manifest with Tauri CLI and all plugin JS packages
- `src-tauri/Cargo.toml` - Rust dependencies: tauri with macos-private-api, all 4 plugins, objc
- `src-tauri/src/lib.rs` - Plugin registration for store, autostart, global-shortcut, positioner
- `src-tauri/src/main.rs` - Entry point calling top_focus_lib::run()
- `src-tauri/tauri.conf.json` - Window config (frameless, transparent, always-on-top, 348x108), LSUIElement via Info.plist, ad-hoc signing
- `src-tauri/Info.plist` - LSUIElement=true to hide Dock icon and Cmd+Tab entry
- `src-tauri/capabilities/default.json` - All permissions: core:default, store, global-shortcut, autostart, core:window with set-size/set-position/start-dragging/set-always-on-top/available-monitors/current-monitor
- `src/index.html` - Widget HTML shell with data-tauri-drag-region and viewport meta
- `src/styles.css` - Full design token system, transparent body, orange widget with shadow, typography
- `src/main.js` - Minimal DOMContentLoaded initialization placeholder
- `.env.signing.example` - Template documenting all 6 Apple code signing env vars
- `.gitignore` - Excludes node_modules, target, .env.signing, bun.lock, .DS_Store

## Decisions Made
- **Info.plist as separate file:** Tauri v2's `infoPlist` config field expects a string file path, not an inline JSON object. Created `src-tauri/Info.plist` with LSUIElement=true.
- **Identifier changed to com.topfocus.widget:** Tauri warns that identifiers ending in `.app` conflict with the macOS bundle extension. Changed from `com.topfocus.app`.
- **Plugin feature corrections:** The `macos` feature does not exist on `tauri-plugin-autostart` (it auto-detects platform). The `system-tray` feature on `tauri-plugin-positioner` was renamed to `tray-icon` in v2.
- **Capability permission prefix:** Tauri v2 requires `core:window:` prefix for window permissions (not bare `window:`). Discovered via build error and corrected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed infoPlist config format**
- **Found during:** Task 1 (compilation verification)
- **Issue:** Plan specified inline `"infoPlist": {"LSUIElement": true}` but Tauri v2 expects a string path to a plist file
- **Fix:** Created `src-tauri/Info.plist` file and set `"infoPlist": "Info.plist"` in tauri.conf.json
- **Files modified:** src-tauri/tauri.conf.json, src-tauri/Info.plist (new)
- **Committed in:** 6baa6b8

**2. [Rule 1 - Bug] Fixed bundle identifier .app suffix**
- **Found during:** Task 1 (compilation verification)
- **Issue:** `com.topfocus.app` identifier conflicts with macOS .app bundle extension
- **Fix:** Changed to `com.topfocus.widget`
- **Committed in:** 6baa6b8

**3. [Rule 3 - Blocking] Removed non-existent macos feature from autostart plugin**
- **Found during:** Task 1 (compilation)
- **Issue:** `tauri-plugin-autostart` does not have a `macos` feature; it auto-detects platform
- **Fix:** Changed to plain `tauri-plugin-autostart = "2"` without features
- **Committed in:** 6baa6b8

**4. [Rule 3 - Blocking] Fixed positioner plugin feature name**
- **Found during:** Task 1 (compilation)
- **Issue:** Feature `system-tray` does not exist on `tauri-plugin-positioner`; the correct name is `tray-icon`
- **Fix:** Changed to `features = ["tray-icon"]`
- **Committed in:** 6baa6b8

**5. [Rule 3 - Blocking] Fixed capability permission prefixes**
- **Found during:** Task 1 (compilation)
- **Issue:** `window:default`, `window:allow-set-size` etc. not recognized; Tauri v2 requires `core:window:` prefix
- **Fix:** Changed all window permissions to use `core:window:` prefix
- **Committed in:** 6baa6b8

---

**Total deviations:** 5 auto-fixed (2 bugs, 3 blocking)
**Impact on plan:** All fixes were necessary to achieve compilation. Plan's research had MEDIUM confidence on several Tauri v2 config details; real build errors exposed the correct values. No scope creep.

## Issues Encountered
- None beyond the deviations listed above. All issues were caught by the compiler and fixed in-line during Task 1.

## Known Stubs
- None. All files contain real, functional code. The `main.js` is intentionally minimal (Phase 2 adds logic).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tauri v2 app compiles and bundles successfully with all plugins
- Orange widget shell is ready for NSPanel non-activating behavior (Plan 01-02)
- Position persistence and click/drag disambiguation are ready to be added (Plan 01-02)
- All capabilities pre-declared for Phase 2 APIs

## Self-Check: PASSED

All 12 files verified present. All 3 task commits verified in git log.

---
*Phase: 01-foundation-tauri-project-window-shell*
*Completed: 2026-04-10*
