# Stack Research

**Domain:** macOS floating desktop widget (Tauri v2)
**Researched:** 2026-04-10
**Confidence:** HIGH (verified against npm registry and Tauri source on GitHub)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri | 2.10.x | App framework (Rust backend + WebKit webview) | Confirmed stable at 2.10.3. Sub-10MB bundles, native macOS WebKit, sub-second startup. v2 is the active development line — v1 is legacy. |
| Rust | >= 1.77.2 | Backend language (required by Tauri) | Tauri's minimum supported Rust version is 1.77.2. Use latest stable (install via `rustup`). |
| Bun | 1.3.x | JavaScript runtime and package manager | Already installed on this machine. Faster than npm/pnpm for installs and scripts. Tauri CLI works with any JS package manager. |
| HTML/CSS/JS | N/A | Frontend (no framework) | Correct choice for this project — see rationale below. |

### Tauri v2 Plugins (Official, First-Party)

| Plugin | Version | Purpose | Why Recommended |
|--------|---------|---------|-----------------|
| `@tauri-apps/plugin-store` | 2.4.2 | Persistent key-value JSON storage | Official plugin, full macOS support. Handles current task + 20-item history. Simpler than manual fs operations — auto-persists, provides reactive API. |
| `@tauri-apps/plugin-autostart` | 2.5.1 | Launch at macOS login | Official plugin, full macOS support. Uses `launchd` on macOS. Required for the "survives reboots" requirement. |
| `@tauri-apps/plugin-global-shortcut` | 2.3.1 | System-wide keyboard shortcuts | Official plugin, full macOS support. Needed for toggle expand/collapse and quick-input shortcuts. |
| `@tauri-apps/plugin-positioner` | 2.3.1 | Window positioning helpers | Official plugin, full macOS support. Provides snap-to-corner/edge positioning out of the box. Useful for initial placement and edge-snapping. |

### Frontend Dependencies

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `@tauri-apps/api` | 2.10.1 | Tauri JavaScript API bindings | Required for calling Tauri window APIs, invoking Rust commands, and interacting with plugins from the frontend. |

### Build Tooling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@tauri-apps/cli` | 2.10.1 | Tauri build/dev CLI | Required. Handles `tauri dev`, `tauri build`, scaffolding, and code signing. |
| Bun | 1.3.x | Package management + script runner | Already on the system. Use `bun install`, `bun run tauri dev`, etc. |

### No Additional Frontend Dependencies Needed

This is a deliberate, load-bearing decision. The project needs:
- One text input
- One text display
- Two modes (compact/expanded)
- A few buttons
- A slider (opacity)

This is 200-400 lines of HTML/CSS/JS total. React, Svelte, or any framework would add:
- Build step complexity (Vite config, JSX transforms)
- Bundle size (React alone is ~40KB gzipped — larger than the entire app's HTML/CSS/JS)
- Abstraction overhead for a UI that has exactly one component

**Use vanilla HTML/CSS/JS with no build step.** Tauri serves static files from `src-ui/` (or similar). The `@tauri-apps/api` package is the only JS dependency, imported via ES modules.

## Implementation Notes

### Window Configuration (tauri.conf.json)

Verified directly from Tauri v2 source code — these fields exist in the window config schema:

```jsonc
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Top Focus",
        "width": 300,
        "height": 60,
        "alwaysOnTop": true,
        "decorations": false,
        "transparent": true,
        "resizable": false,
        "skipTaskbar": true,
        "visibleOnAllWorkspaces": true,
        "acceptFirstMouse": true,
        "shadow": false,
        "x": null,
        "y": null
      }
    ],
    "macOSPrivateApi": true
  }
}
```

Key fields and why:
- **`alwaysOnTop: true`** — Core requirement. Window floats above all others.
- **`decorations: false`** — Removes native title bar. The widget draws its own UI edge-to-edge.
- **`transparent: true`** — Enables transparent/rounded-corner background. **Requires `macOSPrivateApi: true`** (confirmed in source: "Note that on macOS this requires the macos-private-api feature flag").
- **`resizable: false`** — Widget has fixed sizes (compact: 300x60, expanded: 400x200). Resize programmatically on mode toggle.
- **`skipTaskbar: true`** — Widget should not appear in the Dock's window list.
- **`visibleOnAllWorkspaces: true`** — Widget follows you across macOS Spaces/desktops.
- **`acceptFirstMouse: true`** — Clicking the widget when it's not the focused app immediately registers the click (no "activate then click" behavior).
- **`shadow: false`** — We'll use CSS box-shadow for the subtle shadow effect instead, giving us full control over shadow styling.

### Draggable Window (No Title Bar)

Since `decorations: false` removes the title bar, the window needs a custom drag region. Tauri v2 provides two approaches:

1. **CSS attribute (recommended):** Add `data-tauri-drag-region` attribute to an HTML element. Any mousedown on that element initiates window dragging. Apply this to the main container div.

2. **JS API fallback:** Call `window.startDragging()` from `@tauri-apps/api/window` on mousedown events. Use this only if `data-tauri-drag-region` doesn't work for specific elements.

The `data-tauri-drag-region` approach is simpler and sufficient. The entire compact-mode widget surface should be the drag region, with click-through to the expand action.

### Window Position Persistence

Tauri v2 does NOT auto-persist window position. Implement manually:

1. Listen for window move events via `@tauri-apps/api/window` (`onMoved` event)
2. Debounce and save `{x, y}` to the store plugin
3. On app launch, read stored position and call `window.setPosition()`
4. Fallback: use `@tauri-apps/plugin-positioner` to place at a default corner if no stored position exists

### Plugin: Store (`tauri-plugin-store`)

Use this over manual filesystem operations. Reasons:
- Auto-serializes/deserializes JSON
- Provides a reactive `.onChange()` listener
- Handles file creation, atomic writes, and error recovery
- Single file at `~/.local/share/com.topfocus.app/store.json` (or similar app data dir)

Data model is simple:

```json
{
  "currentTask": "Write the STACK.md research file",
  "taskHistory": [
    { "text": "Previous task", "completedAt": "2026-04-10T12:00:00Z" }
  ],
  "windowPosition": { "x": 1200, "y": 50 },
  "settings": {
    "opacity": 0.95,
    "launchAtStartup": true,
    "shortcutToggle": "CmdOrCtrl+Shift+F",
    "shortcutNewTask": "CmdOrCtrl+Shift+N"
  }
}
```

### Plugin: Autostart (`tauri-plugin-autostart`)

Full macOS support confirmed. Uses `launchd` plist under the hood. The plugin provides:
- `enable()` / `disable()` — toggle launch-at-login
- `isEnabled()` — check current state

Wire the settings toggle to these calls. Note: this registers the app with macOS's login items system, which is the correct way (not a custom LaunchAgent plist).

### Plugin: Global Shortcut (`tauri-plugin-global-shortcut`)

Full macOS support confirmed. Register shortcuts like:
- `CmdOrCtrl+Shift+F` — toggle expand/collapse
- `CmdOrCtrl+Shift+N` — open new task input

**macOS caveat:** The app needs Accessibility permissions for global shortcuts to work when the app is not focused. Tauri handles the permission prompt, but the user must grant it in System Settings > Privacy & Security > Accessibility.

### macOS System Font Stack

The macOS WebKit webview has native access to system fonts. Use this CSS:

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
```

Since this is macOS-only and uses WebKit, `-apple-system` resolves to SF Pro automatically. No need to bundle fonts. SF Pro Display is used at larger sizes, SF Pro Text at body sizes — the system handles this automatically with `-apple-system`.

For the compact mode task text (needs to be readable at arm's length), use `font-weight: 700` (bold) at `16-18px`.

### Transparent Window + Rounded Corners

With `transparent: true` and `macOSPrivateApi: true`:

```css
html, body {
  background: transparent;
  margin: 0;
  padding: 0;
}

.widget {
  background: rgba(30, 30, 30, var(--opacity, 0.95));
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
```

The webview background is transparent; the `.widget` div provides the visible rounded rectangle with the dark background.

### Build and Dev Setup

```bash
# Prerequisites (one-time)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh  # Install Rust
# Xcode Command Line Tools (required for macOS compilation)
xcode-select --install

# Project scaffold
bun create tauri-app top-focus --template vanilla
cd top-focus

# Install Tauri plugins (JS side)
bun add @tauri-apps/api @tauri-apps/plugin-store @tauri-apps/plugin-autostart @tauri-apps/plugin-global-shortcut @tauri-apps/plugin-positioner

# Add Rust plugin crates (in src-tauri/Cargo.toml)
# tauri-plugin-store = "2"
# tauri-plugin-autostart = "2"
# tauri-plugin-global-shortcut = "2"
# tauri-plugin-positioner = "2"

# Development
bun run tauri dev     # Hot-reload dev server + Rust compilation
bun run tauri build   # Production .app bundle
```

### Tauri v2 vs v1: Confirmed v2 is Correct

- **v2 is the active, stable release line** (2.10.3 as of April 2026)
- **v1 is legacy/maintenance-only** — no new features, security patches only
- v2 has a different plugin system (all plugins are now `@tauri-apps/plugin-*` instead of `tauri-plugin-*-api`)
- v2 uses capabilities/permissions system for security (replaces v1's `allowlist`)
- v2 scaffolding uses `bun create tauri-app` (not `create-tauri-app` from v1)
- All official plugins have been ported to v2 with full macOS support

**No migration concerns** — this is a greenfield project starting on v2 directly.

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| **React / Svelte / Vue** | Overkill for ~300 lines of UI. Adds build complexity (Vite), bundle size, and abstraction layers. The widget has one text field, one display, and a few buttons. Vanilla JS is faster to write, debug, and keeps the bundle tiny. |
| **Vite / Webpack / any bundler** | Not needed without a framework. Tauri serves static files directly. The `@tauri-apps/api` package can be imported via ES modules from `node_modules` or vendored. If ES module imports from node_modules prove awkward, a single `esbuild --bundle` script is sufficient — no Vite config needed. |
| **Electron** | Already decided against. 150MB+ bundle vs ~5-10MB Tauri. Higher memory/CPU usage. No advantage for a single-platform macOS widget. |
| **tauri-plugin-fs (manual file operations)** | The store plugin handles JSON persistence with less code, atomic writes, and error handling. Manual fs is only needed for complex file operations (binary files, multiple files, streaming). |
| **Custom LaunchAgent plist** | The autostart plugin handles this correctly via macOS login items API. Rolling your own plist is fragile and doesn't respect macOS's native login item management. |
| **Tailwind CSS** | For ~100 lines of CSS, Tailwind's build step and utility classes add complexity without value. Write the CSS directly. |
| **TypeScript** | For ~300 lines of vanilla JS with a simple data model (one string + one array), TypeScript's setup cost (tsconfig, compilation) exceeds its value. If the frontend grows beyond ~500 lines, reconsider. |

## Prerequisites to Install

Rust is not currently installed on this machine. Before development begins:

```bash
# 1. Install Rust via rustup (required)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version  # Should be >= 1.77.2

# 2. Ensure Xcode CLI tools are installed (required for macOS compilation)
xcode-select --install  # May already be installed

# 3. Install Tauri CLI globally (optional, can use bun run instead)
cargo install tauri-cli
```

## Confidence Summary

| Area | Confidence | Basis |
|------|------------|-------|
| Tauri v2 version/stability | **HIGH** | Verified: npm registry shows 2.10.1 (JS), GitHub source shows 2.10.3 (Rust). Actively maintained with frequent releases. |
| Window config (always-on-top, transparent, decorations) | **HIGH** | Verified: Read actual Rust source code for window config struct. All fields confirmed to exist with correct names. |
| macOSPrivateApi requirement for transparency | **HIGH** | Verified: Source code comment explicitly states "on macOS this requires the macos-private-api feature flag." |
| Plugin availability + macOS support | **HIGH** | Verified: All four plugins (store, autostart, global-shortcut, positioner) confirmed via npm registry + GitHub Cargo.toml with `macos = { level = "full" }`. |
| Drag region via `data-tauri-drag-region` | **MEDIUM** | Based on Tauri v2 documentation knowledge and `startDragging()` confirmed in source. The HTML attribute approach is standard Tauri pattern but I did not find the exact attribute parsing in the source grep. Fallback to JS API is confirmed. |
| Vanilla JS over React recommendation | **HIGH** | Architectural judgment based on project scope (one component, ~300 LOC). No external verification needed — this is a complexity/scope assessment. |
| macOS system font stack | **HIGH** | `-apple-system` resolving to SF Pro in WebKit is well-established macOS behavior, not version-dependent. |
| Bun compatibility with Tauri CLI | **MEDIUM** | Bun is installed and works as a package manager. Tauri CLI is framework-agnostic and uses standard npm scripts. Should work, but if issues arise, `npm` via Node.js is the safe fallback. |

### Key Uncertainties

1. **`data-tauri-drag-region` behavior in v2.10.x** — Confirmed `startDragging()` API exists. The HTML attribute is the standard approach but should be tested early in development. If it doesn't work on the transparent, decoration-less window, fall back to JS API.

2. **`macOSPrivateApi` App Store implications** — Enabling `macOSPrivateApi` uses private Apple APIs for window transparency. This is fine for direct distribution but would be rejected from the Mac App Store. Since this is a personal tool (v1 is for the sole developer), this is a non-issue. Flag if distribution plans change.

3. **Accessibility permissions for global shortcuts** — macOS requires explicit user permission for apps to register global keyboard shortcuts. The app should handle the "permission not granted" state gracefully and guide the user to System Settings.
