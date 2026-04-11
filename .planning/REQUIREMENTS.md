# Requirements: Top Focus

**Defined:** 2026-04-10
**Core Value:** After an interruption, you see your #1 task instantly — no app-switching, no list-scanning, no re-orientation cost.

---

## v1 Requirements

### Window Behavior

- [x] **WIN-01**: Widget is always-on-top, floating above all normal windows (maps to macOS `NSWindow.Level.floating`)
- [x] **WIN-02**: Widget does NOT steal focus when clicked — non-activating window behavior (NSPanel pattern via objc crate, critical day-one requirement)
- [x] **WIN-03**: Widget is visible on all Spaces / virtual desktops (`visibleOnAllWorkspaces: true` + `NSWindowCollectionBehavior.canJoinAllSpaces`)
- [x] **WIN-04**: Widget has no Dock icon and does not appear in Cmd+Tab (`LSUIElement: true` in Info.plist + `setActivationPolicy:Accessory` called post-setup to cover dev mode)
- [x] **WIN-05**: Widget is frameless, transparent background, rounded corners (12px), subtle CSS drop-shadow (`decorations: false`, `transparent: true`, `macOSPrivateApi: true`)
- [x] **WIN-06**: Widget is draggable by click-and-drag anywhere on its surface in compact mode; drag region restricted to header in expanded mode
- [x] **WIN-07**: Click vs drag disambiguated — a quick mousedown+mouseup without movement triggers expand, not a drag
- [x] **WIN-08**: Widget position is saved on move and restored on next launch (stored via tauri-plugin-store)
- [x] **WIN-09**: On launch, saved position is validated against current monitor bounds — falls back to primary display corner if off-screen

### Display Modes

- [x] **MODE-01**: Compact mode: ~300×60px, shows current task text (bold, ~16-18px, white/near-white on orange `#FF6B2B`), readable at arm's length
- [x] **MODE-02**: Expanded mode: ~400×200px, shows full task text, text input for editing, action buttons (Done, Clear)
- [x] **MODE-03**: Compact → expanded transition: window resizes first, CSS content animates in (150-250ms, ease-out)
- [x] **MODE-04**: Expanded → compact transition: CSS content animates out, then window shrinks (150-250ms, ease-out)
- [x] **MODE-05**: Long task text truncates cleanly in compact mode (CSS ellipsis); full text visible in expanded mode
- [x] **MODE-06**: Opacity/transparency slider (affects overall widget opacity, range 0.3–1.0, default 0.95)

### Task Lifecycle

- [x] **TASK-01**: User can enter a task as free text (up to 200 chars) via expanded mode text input
- [x] **TASK-02**: Pressing Enter or clicking confirm saves the task and collapses to compact mode
- [x] **TASK-03**: Clicking widget (or using keyboard shortcut) expands to show full text and action buttons
- [x] **TASK-04**: Pressing Escape in expanded mode collapses back to compact without saving changes
- [x] **TASK-05**: User can mark task complete — widget shows brief "Done ✓" visual state (~1.5 seconds: checkmark + color shift to green) then clears
- [x] **TASK-06**: After clearing, widget shows empty state prompt: "What's your top focus?" — warm, inviting, not nagging
- [x] **TASK-07**: Last 20 completed tasks stored in history and surfaced for quick re-selection in expanded mode
- [x] **TASK-08**: User can clear the current task without marking it complete (returns to empty state)

### Keyboard Shortcuts

- [ ] **KEYS-01**: Global keyboard shortcut to toggle expand/collapse (default: `CmdOrCtrl+Shift+F`, user-configurable)
- [ ] **KEYS-02**: Global keyboard shortcut to jump directly to new task input in expanded mode (default: `CmdOrCtrl+Shift+N`, user-configurable)
- [ ] **KEYS-03**: App detects when Accessibility permission for global shortcuts is not granted and shows a clear onboarding prompt guiding user to System Settings > Privacy & Security > Accessibility
- [ ] **KEYS-04**: Shortcut conflicts (another app owns the key combo) handled gracefully — user notified, not silently ignored

### Startup & Persistence

- [ ] **BOOT-01**: Widget launches at macOS login (configurable toggle, enabled by default — uses `tauri-plugin-autostart` with `LaunchAgent` mechanism)
- [ ] **BOOT-02**: Widget is visible at its saved position within 1 second of login — no splash screen, no loading indicator
- [ ] **BOOT-03**: Widget always launches in compact mode regardless of last state before quit

### Design

- [x] **DESIGN-01**: Orange accent color `#FF6B2B` as the widget background (or strong border) — warm, saturated, distinctive
- [x] **DESIGN-02**: High-contrast white/near-white text on orange — accessible contrast ratio
- [x] **DESIGN-03**: System font stack (`-apple-system, BlinkMacSystemFont, system-ui`) — feels native, no bundled fonts
- [x] **DESIGN-04**: Dark mode: widget uses its own dark + orange design (does not follow system light/dark toggle in v1 — always dark style)
- [ ] **DESIGN-05**: Edge snapping — widget magnetically snaps to nearest screen edge/corner when dragged within threshold (~20px), with small margin from edge (~12px)

### Performance & Quality

- [ ] **PERF-01**: App bundle size < 15 MB
- [ ] **PERF-02**: Idle CPU usage = 0.0% in compact mode (no continuous animations, no polling loops)
- [ ] **PERF-03**: Launch to visible widget < 1 second
- [ ] **PERF-04**: WebKit zoom disabled (`maximum-scale=1.0`) to prevent layout breaks from system text scaling

### Build & Distribution

- [x] **BUILD-01**: Tauri v2 project scaffolded with Bun, Rust installed (>= 1.77.2 via rustup), Xcode CLI tools confirmed
- [x] **BUILD-02**: All required plugins configured: `plugin-store`, `plugin-autostart`, `plugin-global-shortcut`, `plugin-positioner`
- [x] **BUILD-03**: Tauri v2 capabilities/permissions configured in `capabilities/default.json` — no silent failures
- [x] **BUILD-04**: Code signing and notarization configured (Apple Developer certificate) — set up early, not as a last step

---

## v2 Requirements

### Ghost / Click-Through Mode

- **GHOST-01**: Toggle click-through mode — widget visible but mouse events pass through to windows below (`ignoresMouseEvents`)
- **GHOST-02**: Click-through toggle accessible via keyboard shortcut or context menu

### Advanced UX

- **UX-01**: Multi-monitor awareness — widget remembers which display it belongs to, does not jump to primary on wake/reconnect
- **UX-02**: Edge peek / hide — widget slides mostly off-screen, peeks a few pixels, slides back in on hover or hotkey
- **UX-03**: Configurable accent color (color picker in settings — default orange)
- **UX-04**: Subtle idle animation (very gentle breathing glow on accent color — must be extremely subtle)
- **UX-05**: Double-click in compact mode to jump directly to text edit cursor

### Integrations

- **INT-01**: Trello integration — pull tasks from specific board/list
- **INT-02**: Jira integration — pull tasks from EV Connect Jira project

### AI Features

- **AI-01**: Claude API integration — 1-2 sentence "why this matters right now" reframe based on task text

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple tasks / task list | Destroys the core value — one task IS the product. Most-requested, most important to refuse. |
| Due dates, priorities, tags | List-manager territory; adds cognitive overhead to a tool designed to eliminate it |
| Notifications / alerts | A focus tool that interrupts you is an oxymoron. The widget's visibility IS the reminder. |
| Time tracking / Pomodoro | Different mental model; changes tool from focus anchor to productivity tracker |
| Sounds / audio feedback | Annoying after day 2; visual feedback only |
| Statistics / streaks | Gamification changes tool character; history for re-selection only, not measurement |
| Rich text / markdown | Formatting a task is procrastination. Plain text forces clarity. |
| Cloud sync | Adds network dependency to a tool that must work instantly, offline, always |
| Mac App Store distribution | `macOSPrivateApi: true` required for transparency blocks App Store; direct distribution only |
| Windows / Linux | macOS-only for v1; Tauri supports cross-platform but not in scope |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WIN-01 through WIN-09 | Phase 1 | ✅ Complete |
| BUILD-01 through BUILD-04 | Phase 1 | ✅ Complete |
| MODE-01 through MODE-06 | Phase 2 | ✅ Complete |
| TASK-01 through TASK-08 | Phase 2 | ✅ Complete |
| DESIGN-01 through DESIGN-04 | Phase 2 | ✅ Complete |
| KEYS-01 through KEYS-04 | Phase 3 | Pending |
| BOOT-01 through BOOT-03 | Phase 3 | Pending |
| PERF-01 through PERF-04 | Phase 3 | Pending |
| DESIGN-05 (edge snapping) | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Phase 1 (Foundation): 13 requirements — ✅ Complete
- Phase 2 (Core Task Loop): 18 requirements — ✅ Complete
- Phase 3 (Polish, Shortcuts & Ship): 12 requirements — Pending
- Unmapped: 0

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-11 — Phase 2 complete*
