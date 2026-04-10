# Architecture Research

**Domain:** Tauri v2 macOS floating widget
**Researched:** 2026-04-10
**Overall confidence:** MEDIUM -- based on training knowledge of Tauri v2 (up to mid-2025). Web verification tools were unavailable. All claims should be spot-checked against https://v2.tauri.app/reference/config/ before implementation.

---

## Window Architecture

### Always-on-Top, Frameless, Transparent Window

Tauri v2 configures windows in `tauri.conf.json` under the `app.windows` array. Each window entry accepts a `WindowConfig` object.

**Recommended `tauri.conf.json` window config:**

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Top Focus",
        "width": 300,
        "height": 60,
        "decorations": false,
        "alwaysOnTop": true,
        "transparent": true,
        "resizable": false,
        "skipTaskbar": true,
        "shadow": false,
        "x": null,
        "y": null
      }
    ]
  }
}
```

**Key properties:**

| Property | Value | Purpose |
|----------|-------|---------|
| `decorations` | `false` | Removes native title bar and window chrome -- required for custom widget look |
| `alwaysOnTop` | `true` | Window floats above all other windows |
| `transparent` | `true` | Enables transparent background -- required for rounded corners and custom shapes |
| `resizable` | `false` | Prevents user resize -- we control size programmatically |
| `skipTaskbar` | `true` | Hides from Dock (MEDIUM confidence -- verify property name, may be `skipTaskbar` or handled differently on macOS) |
| `shadow` | `false` | Disable native shadow since we use a CSS drop-shadow for custom styling |

**macOS-specific: Window Level**

`alwaysOnTop: true` maps to macOS `NSWindow.Level.floating` which is above normal windows but below alerts/modals. This is the correct level for a desktop widget -- it stays visible but does not block system dialogs.

**Confidence:** MEDIUM. The `alwaysOnTop` property is well-established in Tauri. The exact macOS window level mapping should be verified. Tauri v2 may also expose `windowLevel` or similar for finer control -- check docs.

### Transparent Window + Rounded Corners

When `transparent: true` is set:

1. The webview background must also be transparent. Set `background-color: transparent` on `html` and `body`.
2. On macOS with WebKit, this generally works without extra config.
3. Use CSS `border-radius` on your root container element for rounded corners.
4. Apply `box-shadow` or `filter: drop-shadow()` in CSS for the floating shadow effect.

```css
html, body {
  background: transparent;
  margin: 0;
  padding: 0;
}

.widget-container {
  background: rgba(30, 30, 30, 0.95);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
```

**macOS Vibrancy / Blur Effects**

Tauri v2 does not natively expose macOS vibrancy (NSVisualEffectView) through its config. Achieving a frosted-glass effect requires either:

1. A community plugin or custom Rust code using `tauri::Window` to access the underlying `NSWindow` and attach a vibrancy view.
2. CSS `backdrop-filter: blur()` -- works in WebKit but blurs **webview content behind the element**, not the desktop behind the window.

**Recommendation:** Skip vibrancy for v1. Use a solid dark background with high opacity (0.92-0.95). This is simpler, performs well, and looks clean. Vibrancy is a v2 polish item.

**Confidence:** MEDIUM on vibrancy limitations. LOW on whether Tauri v2 added vibrancy support since mid-2025.

### Two-Mode UI: Compact vs Expanded

**Approach: Resize the window programmatically from the frontend.**

Tauri v2 exposes window manipulation through `@tauri-apps/api/window`:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// Compact mode
await appWindow.setSize(new LogicalSize(300, 60));

// Expanded mode  
await appWindow.setSize(new LogicalSize(400, 200));
```

**Animation strategy:**

Tauri's `setSize()` is not animatable natively -- it snaps to the new size. Two approaches:

1. **CSS transition + delayed resize (recommended):** Animate the inner content container with CSS transitions. After the CSS animation completes, call `setSize()` to match. This gives visual smoothness.

2. **Incremental resize loop:** Call `setSize()` repeatedly in a requestAnimationFrame loop. This works but is janky because each call round-trips through IPC.

**Recommended pattern:**

```typescript
async function expandWidget() {
  // 1. Resize window to expanded size immediately (allows content to fill)
  await appWindow.setSize(new LogicalSize(400, 200));
  // 2. CSS class triggers transition animation on inner content
  document.querySelector('.widget').classList.add('expanded');
}

async function collapseWidget() {
  // 1. CSS class triggers collapse animation
  document.querySelector('.widget').classList.remove('expanded');
  // 2. After animation completes, shrink window
  setTimeout(async () => {
    await appWindow.setSize(new LogicalSize(300, 60));
  }, 200); // match CSS transition duration
}
```

**Gotcha:** When expanding, resize window FIRST then animate content in. When collapsing, animate content out FIRST then resize window. Otherwise content gets clipped during the transition.

**Confidence:** HIGH on setSize API existing. MEDIUM on exact import path (verify `@tauri-apps/api/window` vs `@tauri-apps/api/webviewWindow` in v2).

### Custom Drag Regions

Tauri v2 supports `data-tauri-drag-region` as an HTML attribute to make elements draggable:

```html
<div data-tauri-drag-region class="widget-header">
  <!-- This entire div is draggable -->
  <span class="task-text">My current task</span>
</div>
```

**How it works:**
- Any element with `data-tauri-drag-region` allows click-and-drag to move the window.
- Mouse events on child elements of the drag region still work (buttons, inputs are clickable).
- The drag region intercepts mousedown events that are not on interactive child elements.

**Gotchas:**

1. **Click vs drag ambiguity:** A quick click on the drag region triggers both click and potential drag. If your compact mode triggers expand-on-click, you need to distinguish between a click (mousedown + mouseup without movement) and a drag (mousedown + mousemove). Tauri handles this at the native level -- a click event still fires if no drag occurred.

2. **Nested interactive elements:** Buttons and inputs inside a drag region work correctly -- they receive click/focus events. But elements with custom mousedown handlers may conflict. Keep interactive elements clearly separated.

3. **Transparent areas:** If `transparent: true` is set and parts of the window are fully transparent, those transparent areas will NOT receive mouse events (clicks pass through to windows below). The drag region must have a visible/semi-opaque background to be draggable.

4. **The entire compact widget should be the drag region.** For the ~300x60px compact mode, make the whole container the drag region. In expanded mode, limit the drag region to a header bar to avoid conflicting with input fields and buttons.

**Confidence:** HIGH on `data-tauri-drag-region` existing and working this way. This is a core Tauri feature stable since v1.

### Position Persistence

Tauri v2 has a `window-state` plugin (`tauri-plugin-window-state`) that automatically saves and restores window position, size, and state (maximized, etc.) across sessions.

**Option A: tauri-plugin-window-state (recommended)**

```bash
cargo add tauri-plugin-window-state
npm install @tauri-apps/plugin-window-state
```

In `src-tauri/src/lib.rs`:
```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

This plugin automatically persists window position to a file and restores on launch.

**Gotcha:** This plugin saves window SIZE too. Since we programmatically control size (compact/expanded), we may need to configure it to only save position, or override the saved size on launch to always start in compact mode.

**Option B: Manual position persistence with tauri-plugin-store**

Save position manually when the window is moved:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// Listen for move events
await appWindow.onMoved(({ payload }) => {
  store.set('windowPosition', { x: payload.x, y: payload.y });
  store.save();
});

// On launch, restore position
const pos = await store.get('windowPosition');
if (pos) {
  await appWindow.setPosition(new LogicalPosition(pos.x, pos.y));
}
```

**Recommendation:** Start with Option B (manual via store) because it gives full control over what's persisted. The widget needs to always launch in compact mode regardless of last state, and position persistence is only ~10 lines of code. The window-state plugin adds magic that may fight with programmatic size changes.

**Confidence:** MEDIUM. The window-state plugin exists but exact v2 API should be verified. Manual approach is straightforward.

### Edge Snapping

**No built-in Tauri edge-snapping.** This must be implemented manually.

**Recommended approach: Implement in Rust via a Tauri command.**

```rust
use tauri::{command, Window, LogicalPosition, Monitor};

#[command]
async fn snap_to_nearest_edge(window: Window) -> Result<(), String> {
    let monitor = window.current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor")?;
    
    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();
    let window_pos = window.outer_position().map_err(|e| e.to_string())?;
    let window_size = window.outer_size().map_err(|e| e.to_string())?;
    
    let snap_threshold = 20; // pixels
    let edge_margin = 12; // margin from screen edge
    
    let mut x = window_pos.x;
    let mut y = window_pos.y;
    
    // Snap to left edge
    if (x - monitor_pos.x).abs() < snap_threshold {
        x = monitor_pos.x + edge_margin;
    }
    // Snap to right edge
    let right_edge = monitor_pos.x + monitor_size.width as i32 - window_size.width as i32;
    if (x - right_edge).abs() < snap_threshold {
        x = right_edge - edge_margin;
    }
    // Snap to top edge
    if (y - monitor_pos.y).abs() < snap_threshold {
        y = monitor_pos.y + edge_margin;
    }
    // Snap to bottom edge
    let bottom_edge = monitor_pos.y + monitor_size.height as i32 - window_size.height as i32;
    if (y - bottom_edge).abs() < snap_threshold {
        y = bottom_edge - edge_margin;
    }
    
    window.set_position(LogicalPosition::new(x as f64, y as f64))
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
```

**Why Rust, not JS:** The monitor geometry APIs (`current_monitor`, `outer_position`) are available on both sides, but doing it in Rust avoids an extra IPC round-trip for reading position and then another for setting it. Also, the Rust side has direct access to physical pixel coordinates which matters for Retina displays.

**Trigger:** Call `snap_to_nearest_edge` from the frontend's `onMoved` event listener, debounced to fire once after dragging stops.

**Confidence:** MEDIUM. The Monitor API in Tauri v2 should expose position/size. Exact method names may differ -- verify against docs.

---

## State & Storage

### tauri-plugin-store vs Manual serde_json

**For this project's needs (current task + 20-item history), use tauri-plugin-store.**

| Criterion | tauri-plugin-store | Manual serde_json |
|-----------|-------------------|-------------------|
| Setup effort | ~5 min (add dependency, init plugin) | ~30 min (define file path, read/write, error handling) |
| Reactivity | Built-in `onKeyChange` listeners | Must implement pub/sub manually |
| Thread safety | Handled by plugin | Must manage Mutex/RwLock yourself |
| Data format | JSON file in app data dir | JSON file wherever you put it |
| Auto-save | Configurable (save on change or manual) | Manual |
| Access from JS | Direct via `@tauri-apps/plugin-store` | Only via Tauri commands |
| Access from Rust | Via plugin API | Direct serde |

**Recommendation:** tauri-plugin-store. The data is simple (one current task, an array of 20 history items, user preferences). The plugin handles file I/O, serialization, and provides JS-side reactivity for free. Manual serde_json is only warranted if you need complex Rust-side data processing -- which this project does not.

**Store schema:**

```typescript
// store.json (auto-managed by plugin, stored in app data directory)
{
  "currentTask": {
    "text": "Write architecture doc",
    "createdAt": "2026-04-10T14:30:00Z"
  },
  "taskHistory": [
    { "text": "Previous task", "completedAt": "2026-04-10T13:00:00Z" },
    // ... up to 20 entries
  ],
  "preferences": {
    "opacity": 0.95,
    "shortcutToggle": "CmdOrCtrl+Shift+F",
    "shortcutNewTask": "CmdOrCtrl+Shift+N",
    "launchAtLogin": true,
    "windowPosition": { "x": 1200, "y": 50 }
  }
}
```

**Usage:**

```typescript
import { Store } from '@tauri-apps/plugin-store';

const store = await Store.load('store.json');

// Read
const task = await store.get('currentTask');

// Write
await store.set('currentTask', { text: 'New task', createdAt: new Date().toISOString() });
await store.save(); // persist to disk

// React to changes (useful if Rust side modifies store)
await store.onKeyChange('currentTask', (value) => {
  updateUI(value);
});
```

**Confidence:** HIGH on plugin existence and general API shape. MEDIUM on exact v2 method signatures (`Store.load` vs `new Store` -- verify).

---

## Shortcut System

### tauri-plugin-global-shortcut

Global shortcuts capture key combinations even when the app is not focused -- essential for a widget that's always visible but rarely focused.

**Setup:**

```bash
cargo add tauri-plugin-global-shortcut
npm install @tauri-apps/plugin-global-shortcut
```

**Rust side (src-tauri/src/lib.rs):**

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

**JS side (register shortcuts):**

```typescript
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

// Register toggle shortcut
await register('CmdOrCtrl+Shift+F', (event) => {
  if (event.state === 'Pressed') {
    toggleWidgetMode();
  }
});

// Register new task shortcut
await register('CmdOrCtrl+Shift+N', (event) => {
  if (event.state === 'Pressed') {
    openNewTaskInput();
  }
});
```

**Making shortcuts configurable:**

1. Store shortcut strings in tauri-plugin-store under `preferences.shortcutToggle` and `preferences.shortcutNewTask`.
2. On app launch, read stored shortcuts and register them.
3. In settings UI, unregister old shortcut, register new one, save to store.

```typescript
async function updateShortcut(action: string, newShortcut: string) {
  const oldShortcut = await store.get(`preferences.shortcut_${action}`);
  if (oldShortcut) await unregister(oldShortcut);
  await register(newShortcut, handlers[action]);
  await store.set(`preferences.shortcut_${action}`, newShortcut);
  await store.save();
}
```

**Key format:** Tauri uses Electron-style accelerator strings: `CmdOrCtrl+Shift+F`, `Alt+Space`, etc. `CmdOrCtrl` maps to Cmd on macOS.

**Gotchas:**

1. **Shortcut conflicts:** If another app already owns the shortcut, `register()` may fail silently or throw. Wrap in try/catch and inform the user.
2. **macOS permissions:** Global shortcuts may require Accessibility permissions on newer macOS versions. The app should handle the "not permitted" case gracefully.
3. **Event state:** The callback fires for both `Pressed` and `Released` events. Always check `event.state === 'Pressed'` to avoid double-firing.

**Confidence:** MEDIUM. The global-shortcut plugin is well-established from v1. The v2 API may have slightly different registration patterns -- verify import paths and callback signatures.

**Permissions config (tauri.conf.json):**

```json
{
  "plugins": {
    "global-shortcut": {
      "enabled": true
    }
  }
}
```

Tauri v2 uses a capability/permission system. You will also need to declare the shortcut permission in your capabilities:

```json
{
  "permissions": [
    "global-shortcut:default"
  ]
}
```

**Confidence:** LOW on exact permission string. Tauri v2's permission system changed significantly -- verify against docs.

---

## Launch at Login

### tauri-plugin-autostart

This is the standard approach. It uses macOS Login Items (via LaunchAgent or SMAppService on macOS 13+).

**Setup:**

```bash
cargo add tauri-plugin-autostart
npm install @tauri-apps/plugin-autostart
```

**Rust side:**

```rust
use tauri_plugin_autostart::MacosLauncher;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]) // optional launch args
        ))
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

**JS side (toggle from UI):**

```typescript
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

// Check current state
const enabled = await isEnabled();

// Toggle
if (enabled) {
  await disable();
} else {
  await enable();
}
```

**macOS launcher options:**

| Option | Mechanism | Notes |
|--------|-----------|-------|
| `MacosLauncher::LaunchAgent` | Creates a plist in `~/Library/LaunchAgents/` | Works on all macOS versions. Standard approach. |
| `MacosLauncher::AppleScript` | Uses `osascript` to add login item | Older approach, less reliable |

**Recommendation:** Use `MacosLauncher::LaunchAgent`. It is the most reliable mechanism and works without extra permissions.

**Gotcha:** On macOS 13+ (Ventura), Apple introduced `SMAppService` for managed login items. The `LaunchAgent` approach still works but the app may appear in System Settings > General > Login Items where users can disable it independently. This is fine -- it is expected macOS behavior.

**Confidence:** MEDIUM. The autostart plugin exists and LaunchAgent is the right mechanism. Exact v2 init API should be verified.

---

## Rust <-> Frontend Communication

Tauri v2 provides three communication patterns:

### 1. Commands (Rust functions callable from JS) -- PRIMARY PATTERN

```rust
// Rust side
#[tauri::command]
fn complete_task(store: tauri::State<'_, Store>, task_text: String) -> Result<(), String> {
    // Business logic in Rust
    Ok(())
}

// Register in builder
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![complete_task])
```

```typescript
// JS side
import { invoke } from '@tauri-apps/api/core';
await invoke('complete_task', { taskText: 'My task' });
```

### 2. Events (bidirectional pub/sub) -- FOR ASYNC NOTIFICATIONS

```rust
// Rust emits to frontend
window.emit("task-updated", &task_data)?;
```

```typescript
// JS listens
import { listen } from '@tauri-apps/api/event';
await listen('task-updated', (event) => {
  updateUI(event.payload);
});
```

### 3. tauri-plugin-store (shared state) -- FOR PERSISTENT DATA

As described in the Storage section. Both Rust and JS can read/write the same store.

**Recommended pattern for this project:**

For a simple widget like Top Focus, avoid over-engineering the Rust<->JS boundary. The recommended split:

| Concern | Where | Why |
|---------|-------|-----|
| UI rendering & animation | Frontend (JS/CSS) | WebKit handles this well |
| Task CRUD | Frontend via plugin-store | Simple key-value, no Rust logic needed |
| Edge snapping | Rust command | Needs monitor geometry, better in Rust |
| Position persistence | Frontend via plugin-store + window events | Simple coordinate save |
| Shortcut registration | Frontend via plugin-global-shortcut | Plugin handles it |
| Autostart toggle | Frontend via plugin-autostart | Plugin handles it |
| Window resize (mode switch) | Frontend via window API | Simple setSize call |

**Key insight:** For this project, almost everything can be done from the JS side using Tauri plugins. Custom Rust commands are only needed for edge snapping and potentially any future macOS-native integrations. Keep the Rust side thin.

**Confidence:** HIGH on commands and events pattern. This is core Tauri architecture unchanged from v1 to v2.

---

## Key Gotchas / Risks

### 1. CRITICAL: Transparent Window Click-Through

When `transparent: true`, fully transparent pixels pass mouse events through to windows below. If your widget has rounded corners, the transparent corner areas will not be clickable. This is correct behavior for a widget but means:

- The drag region must not extend into transparent areas
- The CSS container must have a background (even semi-transparent) everywhere you want interactivity

**Risk level:** Medium. Easy to solve with correct CSS but surprising if not expected.

### 2. CRITICAL: Tauri v2 Permission System

Tauri v2 introduced a granular capability/permission system. Every plugin and API requires explicit permission in `src-tauri/capabilities/default.json`. Missing permissions cause silent failures or runtime errors.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "default permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "store:default",
    "global-shortcut:default",
    "autostart:default",
    "window:default",
    "window:allow-set-size",
    "window:allow-set-position",
    "window:allow-set-always-on-top"
  ]
}
```

**Risk level:** High. This is the #1 source of "it works in dev but breaks in production" issues with Tauri v2. Must be configured correctly from day one.

**Confidence:** MEDIUM. The capability system exists but exact permission identifiers should be verified.

### 3. MODERATE: setSize/setPosition Coordinate Systems

Tauri v2 distinguishes between `LogicalSize`/`LogicalPosition` and `PhysicalSize`/`PhysicalPosition`. On Retina Macs (scale factor 2.0), mixing these up causes the window to appear at half or double the expected size/position.

**Rule:** Always use `Logical` variants for UI-facing operations. Tauri handles the physical pixel conversion.

**Risk level:** Medium. One-time learning curve.

### 4. MODERATE: macOS Dock Icon

By default, a Tauri app shows in the Dock. For a floating widget, you likely want to hide the Dock icon. This requires setting `LSUIElement` to `true` in the `Info.plist`:

In `tauri.conf.json`:
```json
{
  "bundle": {
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.15"
    }
  }
}
```

And manually adding to `src-tauri/Info.plist` (or via `tauri.conf.json` if supported):
```xml
<key>LSUIElement</key>
<true/>
```

This makes the app an "agent" app -- no Dock icon, no app menu bar. The widget floats without a traditional app presence.

**Gotcha:** Without the menu bar, standard Cmd+Q does not work. You need your own quit mechanism (context menu or shortcut).

**Risk level:** Medium. Important for UX but easy to miss.

**Confidence:** MEDIUM. `LSUIElement` is a well-known macOS pattern. How to set it in Tauri v2 config specifically should be verified.

### 5. LOW: Dark Mode / System Appearance

macOS has system-level dark/light mode. The webview inherits the system `prefers-color-scheme` media query. Since the design spec calls for a dark widget with orange accents, you should:

- Set the widget to always use dark styling (don't follow system theme)
- Or implement both themes and respect `prefers-color-scheme`

**Recommendation:** Always dark for v1. The orange-on-dark design is the brand. Respecting light mode is a v2 feature.

### 6. LOW: App Signing and Notarization

macOS requires code signing and notarization for distributed apps. For personal use (Tom only), this is not blocking -- you can run unsigned apps by right-clicking > Open. But if distributing:

- Need an Apple Developer account ($99/year)
- Tauri's bundler supports code signing via environment variables
- Notarization adds ~2 min to the build process

**Recommendation:** Skip for v1 personal use. Configure when/if distributing.

---

## Recommended Patterns

### Project Structure

```
src-tauri/
  src/
    lib.rs          # Plugin registration, command handlers
    main.rs         # Entry point (generated)
    commands/
      snap.rs       # Edge snapping logic
  capabilities/
    default.json    # Permission declarations
  tauri.conf.json   # Window config, bundle config
  Cargo.toml
src/                # Frontend
  index.html
  styles/
    main.css        # All styles (small enough for one file)
  scripts/
    app.ts          # Main app logic
    store.ts        # Store wrapper (current task, history, prefs)
    shortcuts.ts    # Shortcut registration
    window.ts       # Window resize, position, snap
  assets/
    icons/
```

### State Flow

```
User Action (click/shortcut)
    |
    v
Frontend JS (app.ts)
    |
    +--> Store Plugin (task data, preferences)
    |       |
    |       +--> JSON file on disk (auto-persisted)
    |
    +--> Window API (resize, reposition)
    |
    +--> Rust Command (edge snap only)
```

### Initialization Sequence

```
1. App launches
2. Rust: plugins initialize (store, global-shortcut, autostart)
3. Frontend loads
4. JS: Read store -> restore preferences
5. JS: Set window position from stored coordinates
6. JS: Register global shortcuts from stored preferences  
7. JS: Load current task (if any) and render compact mode
8. JS: Listen for window move events -> persist position
9. Ready
```

### CSS Architecture

For a ~300-400px widget, keep CSS simple:

- Single CSS file, no preprocessor needed
- CSS custom properties for theming (orange accent, opacity)
- CSS transitions for compact/expanded animation
- System font stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display'`)
- No CSS framework -- the widget is too small to warrant one

### Frontend Framework Decision

**Recommendation: Vanilla JS/TS (no React).**

Rationale:
- The UI has exactly 2 states (compact, expanded) with ~5 interactive elements
- React adds 40KB+ to the bundle for no benefit
- Vanilla TS with direct DOM manipulation is simpler to reason about for this scale
- No component reuse, no complex state derivation, no lists to reconcile

If TypeScript is desired (recommended for type safety with Tauri's invoke API), use a simple build setup with Vite.

---

## Sources and Verification Notes

All findings are based on training knowledge (up to mid-2025). The following should be verified against current Tauri v2 documentation before implementation:

1. **Window config property names** -- verify at https://v2.tauri.app/reference/config/#windowconfig
2. **Plugin import paths** -- verify `@tauri-apps/plugin-store` vs `@tauri-apps/api/...` patterns
3. **Capability permission identifiers** -- verify at https://v2.tauri.app/security/capabilities/
4. **`Store.load()` API** -- the store plugin API may use `new Store()` or `Store.load()` in v2
5. **Global shortcut callback signature** -- verify whether `event.state` pattern is current
6. **Autostart `MacosLauncher` enum** -- verify variant names and init signature
7. **`skipTaskbar`** -- verify this property exists on macOS in Tauri v2 (macOS handles this differently than Windows)
8. **`LSUIElement`** -- verify how to set this through Tauri v2 config vs manual plist editing
