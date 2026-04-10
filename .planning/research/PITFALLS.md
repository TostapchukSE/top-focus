# Pitfalls Research

**Domain:** Tauri v2 macOS floating widget
**Researched:** 2026-04-10
**Overall confidence:** MEDIUM -- based on training data through early 2025; web verification tools were unavailable. All findings should be validated against current Tauri v2 docs and GitHub issues before implementation.

---

## macOS Window Management Gotchas

### CRITICAL: Always-on-top does not mean "above fullscreen apps"

**What goes wrong:** You set `alwaysOnTop: true` in window config. It works fine -- until a user runs a fullscreen app (or Stage Manager). The widget vanishes behind the fullscreen window because macOS fullscreen creates a separate Space, and `alwaysOnTop` uses `NSWindow.Level.floating` which does not float above fullscreen Spaces.

**Why it happens:** macOS fullscreen is not just a maximized window -- it creates a new virtual desktop (Space). Floating-level windows belong to the original Space and are invisible on the fullscreen Space.

**Prevention:**
- Accept this as a platform constraint. Document it. Do not fight it.
- If you absolutely need presence in fullscreen, you would need `NSWindow.Level.statusBar` or higher, which requires setting the window level via raw NSWindow access through Tauri's `run_on_main_thread` + `objc` crate. This is fragile and may cause focus-stealing issues.
- **Recommended approach:** Accept that the widget disappears during fullscreen. Most fullscreen users (video, presentations) do not want a widget overlay anyway.

**Confidence:** HIGH -- this is fundamental macOS window management behavior.

### CRITICAL: Focus stealing / activation policy

**What goes wrong:** Clicking the widget to expand it steals focus from the user's current app. The user is typing in their editor, clicks the widget, and now keystrokes go to the widget's webview instead of their editor. This is the single most annoying behavior for a utility widget.

**Why it happens:** By default, Tauri windows are regular "activating" windows. Clicking them makes them key and main, which pulls focus.

**Prevention:**
- Set the window as a "panel" type (NSPanel) with `NSWindowStyleMask.nonactivatingPanel` behavior. In Tauri v2, this is not directly exposed in the config. You need to use the `tauri-plugin-positioner` or manipulate the window via Rust with the `objc` crate.
- In Tauri v2, the approach is:
  1. Create the window with `decorations: false`
  2. On the Rust side, use `window.ns_window()` to get the raw NSWindow pointer
  3. Cast it to NSPanel or set the `collectionBehavior` and `styleMask` to include `.nonactivatingPanel`
- **This is a DAY ONE requirement.** Without it, the widget is unusable as a background overlay.

**Confidence:** HIGH -- well-documented macOS AppKit behavior; Tauri v2 exposes `ns_window()` via the `tauri::window::Window` API.

### Mission Control and Spaces behavior

**What goes wrong:** The widget appears on only one Space, or it disappears when switching Spaces, or it duplicates across Spaces in confusing ways.

**Prevention:**
- Set `NSWindowCollectionBehavior.canJoinAllSpaces` via the `objc` crate on the raw NSWindow. This makes the widget appear on every Space.
- Without this, the widget lives on one Space and is invisible on others -- useless for a persistent overlay.
- Also set `NSWindowCollectionBehavior.stationary` to prevent the window from sliding during Space transitions.

**Confidence:** HIGH -- standard macOS API behavior.

### Dock icon showing when it should not

**What goes wrong:** A floating widget should not show a Dock icon or appear in Cmd+Tab. But by default, Tauri apps show both.

**Prevention:**
- Set `"macOSPrivateApi": true` in `tauri.conf.json` (Tauri v2 supports this to enable LSUIElement behavior)
- Alternatively, set `LSUIElement` to `true` in `Info.plist` via Tauri's bundle configuration. This makes the app a "UI Element" (accessory app) -- no Dock icon, no Cmd+Tab entry.
- In Tauri v2's `tauri.conf.json`, set: `"bundle" > "macOS" > "infoPlist" > "LSUIElement": true`
- **Consequence:** With `LSUIElement`, the app has no main menu bar. If you need settings/preferences, surface them via the widget itself (e.g., expanded mode) or a system tray icon.

**Confidence:** HIGH -- LSUIElement is a long-standing macOS convention for utility apps.

### Window dragging with decorations disabled

**What goes wrong:** You disable native title bar (`decorations: false`) for a custom look. Now the window cannot be dragged. Users expect to drag by clicking the widget body.

**Prevention:**
- Use the Tauri v2 `data-tauri-drag-region` attribute on your HTML elements. Any element with this attribute becomes a drag handle.
- Alternatively, implement `startDragging()` from `@tauri-apps/api/window` on mousedown events.
- **Gotcha within the gotcha:** `data-tauri-drag-region` does not work on elements that have click handlers. If your entire compact mode is a click target (to expand), you need to differentiate between drag and click -- typically by using mousedown + mousemove detection with a threshold.

**Confidence:** MEDIUM -- `data-tauri-drag-region` is documented in Tauri v2, but the click-vs-drag conflict requires testing.

### Window position persistence across display changes

**What goes wrong:** You save window position to restore it on launch. User unplugs external monitor. On next launch, the window restores to coordinates that are now off-screen.

**Prevention:**
- On launch, validate saved position against current screen bounds using `availableMonitors()` from `@tauri-apps/api/window`.
- If saved position is off-screen, fall back to a default corner of the primary display.
- Also handle display changes at runtime (monitor plugged/unplugged) -- Tauri v2 does not emit events for this natively, so poll or validate on window move.

**Confidence:** MEDIUM -- this is an application-level concern, not Tauri-specific. The API for checking monitors exists.

---

## Sandbox / Permissions Issues

### Login item registration

**What goes wrong:** The app needs to launch at login. macOS has changed login item APIs multiple times. The old `LSSharedFileList` API is deprecated. Modern macOS (13+) uses `SMAppService.register` for login items, and sandboxed apps must use the "Login Items" capability in their entitlements.

**Prevention:**
- Use `tauri-plugin-autostart` (available for Tauri v2). It wraps the appropriate macOS API.
- **Gotcha:** If the app is distributed outside the Mac App Store (likely), it still needs to be signed and notarized for the login item to work reliably on macOS 13+. Unsigned apps may get their login items silently stripped by Gatekeeper.
- Test login item behavior after notarization, not just in development.

**Confidence:** MEDIUM -- `tauri-plugin-autostart` exists for Tauri v2, but login item behavior is notoriously fragile across macOS versions. Verify against current macOS.

### Global keyboard shortcuts

**What goes wrong:** You register a global shortcut (e.g., Cmd+Shift+F to toggle the widget). On macOS, this requires Accessibility permissions. The user sees no prompt, the shortcut just silently fails.

**Prevention:**
- Use `tauri-plugin-global-shortcut` for Tauri v2.
- On macOS, global shortcuts that intercept keyboard events system-wide require the app to be in System Settings > Privacy & Security > Accessibility. Without this, shortcuts only work when the app is focused (useless for a background widget).
- **Critical UX:** Detect when the permission is not granted and show the user a clear prompt to enable it. Tauri does not do this automatically.
- Some shortcuts (Cmd+Space, Cmd+Tab, etc.) are reserved by the system and cannot be intercepted.

**Confidence:** MEDIUM -- the plugin exists; the Accessibility permission requirement is a well-known macOS constraint. Exact Tauri v2 API surface should be verified.

### File system access for local JSON storage

**What goes wrong:** You try to write the task JSON file to a convenient location and get a permission error, or the file ends up in an unexpected place.

**Prevention:**
- Use Tauri's `app_data_dir()` or `app_config_dir()` from `tauri::api::path` (Rust) or `@tauri-apps/api/path` (JS). These resolve to `~/Library/Application Support/<bundle-id>/`.
- Do NOT write to `~/Desktop`, `~/Documents`, or other user-visible folders -- these require explicit TCC (Transparency, Consent, and Control) permissions on modern macOS.
- For a non-sandboxed app (outside Mac App Store), `~/Library/Application Support/` is freely writable. This is the correct location.

**Confidence:** HIGH -- standard macOS file system conventions.

### Hardened runtime entitlements

**What goes wrong:** You build and sign the app with Hardened Runtime (required for notarization). The WebView stops working, or JavaScript execution fails, because Hardened Runtime disables JIT by default.

**Prevention:**
- Tauri's build tooling (`tauri build`) should handle the required entitlements automatically, including `com.apple.security.cs.allow-jit` for the WebView.
- If you customize entitlements, ensure you keep: `com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory`.
- **Gotcha:** If you add custom entitlements (e.g., for Accessibility), make sure you do not accidentally remove the default ones Tauri sets.

**Confidence:** MEDIUM -- Tauri's build system generally handles this, but entitlement conflicts are a known pain point.

---

## WebKit Quirks

### Transparent / vibrancy background

**What goes wrong:** You want a semi-transparent or frosted-glass widget background. You set `transparent: true` in Tauri config and `background: transparent` in CSS. The window has a white or black background instead, or transparency works but vibrancy (blur) does not.

**Prevention:**
- In `tauri.conf.json`, set `"transparent": true` on the window config.
- In CSS, set `html, body { background: transparent; }`.
- For vibrancy (macOS native blur effect), use `window.setVibrancy()` -- Tauri v2 supports this but only certain vibrancy types work (e.g., `under-window`, `sidebar`).
- **Known issue:** Transparent windows on macOS can have rendering artifacts during resize. Since the widget is a fixed small size, this may not matter.
- **Performance note:** Transparency/vibrancy adds GPU compositing cost. For a tiny widget this is negligible, but test idle GPU usage.

**Confidence:** MEDIUM -- transparent windows work in Tauri v2 on macOS, but edge cases around vibrancy types and rendering vary by macOS version.

### CSS `-webkit-app-region` vs Tauri drag regions

**What goes wrong:** You use `-webkit-app-region: drag` (an Electron convention) in CSS and it does nothing. Or you use Tauri's `data-tauri-drag-region` but it conflicts with CSS that uses `-webkit-` prefixes for other purposes.

**Prevention:**
- Use `data-tauri-drag-region` attribute, not CSS `-webkit-app-region`. Tauri v2 does not use the WebKit CSS property for drag.
- This is a common Electron-to-Tauri migration trap.

**Confidence:** HIGH -- documented Tauri v2 API difference from Electron.

### Font rendering: system font stack

**What goes wrong:** You specify `font-family: "SF Pro"` and it does not render SF Pro on all macOS versions. Or text looks blurry at small sizes.

**Prevention:**
- Use `-apple-system, BlinkMacSystemFont, system-ui` as the font stack. This resolves to SF Pro on macOS without needing to reference it by name.
- For the compact widget text (readable at arm's length), use `font-weight: 600` or `700` and a size of at least 14px. Below 13px, WebKit on macOS may disable subpixel antialiasing (depending on macOS version and user settings), making text look thin.
- **macOS Catalina+ change:** Apple disabled subpixel antialiasing system-wide. Text on non-Retina displays may look thinner than expected. On Retina displays (the vast majority now), this is not an issue.

**Confidence:** HIGH -- standard WebKit on macOS behavior.

### Rounded corners and window shape

**What goes wrong:** You want rounded corners on the widget. You set `border-radius` on the body, but the window itself is rectangular, so you see the window background in the corners.

**Prevention:**
- Use `transparent: true` in window config + `border-radius` on a wrapper div inside the body.
- The transparent window acts as an invisible rectangular canvas; your CSS creates the visual rounded shape.
- **Gotcha:** Click events still register on the transparent corners. For a small widget this is usually fine, but if precision matters, you would need to forward those clicks to the underlying window (which Tauri does not support natively).

**Confidence:** HIGH -- standard technique for custom-shaped Tauri/Electron windows.

### WebView zoom / text scaling

**What goes wrong:** The user has system-level text scaling or accessibility zoom enabled. Your carefully sized 300x60px widget is now 450x90px and overlaps screen edges.

**Prevention:**
- Consider disabling WebView zoom: in the webview HTML, add `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`.
- Respect system font size preferences where reasonable but test at extreme values.

**Confidence:** MEDIUM -- viewport meta behavior in Tauri's macOS WebView should be verified.

---

## Performance Traps

### Idle CPU usage from timers and animations

**What goes wrong:** The widget sits idle 99% of the time. But it uses 2-5% CPU constantly because of a CSS animation, a JavaScript setInterval polling loop, or a blinking cursor in a hidden input field.

**Prevention:**
- No CSS animations that run continuously (no infinite `@keyframes`). Use transitions triggered by state changes only.
- No `setInterval` or `requestAnimationFrame` loops. If you need periodic checks, use Tauri events (pushed from Rust) instead of JS polling.
- The "Done" checkmark animation should be a finite CSS transition, not a looping animation.
- **Measurement:** After building, check Activity Monitor for CPU usage when the widget is idle and in compact mode. Target: 0.0% CPU when idle.

**Confidence:** HIGH -- this is general web performance knowledge that directly applies.

### Memory usage from the WebView process

**What goes wrong:** Even a minimal Tauri app uses 30-80 MB of RAM because the WebView process has a baseline cost. This is much less than Electron (~150-300 MB) but more than a pure native app.

**Prevention:**
- This is inherent to WebKit WebView. You cannot reduce it below ~25-40 MB baseline.
- Keep the DOM small (the widget has maybe 10-20 elements -- this is fine).
- Avoid loading heavy JS frameworks. For a widget this simple, vanilla JS or a tiny framework (Preact, Solid) is better than React. React's runtime alone adds several MB to memory.
- **Recommendation:** Use vanilla HTML/CSS/JS. The widget has two states (compact/expanded) with a handful of elements. A framework adds complexity with zero benefit.

**Confidence:** HIGH -- well-established WebView baseline costs.

### WebView cold start time

**What goes wrong:** The app launches at login. The first render takes 500ms-1.5s because WebKit needs to initialize the WebView process, parse HTML/CSS/JS, and render.

**Prevention:**
- Keep the frontend minimal: one HTML file, inline CSS, minimal JS.
- Avoid dynamic imports, large bundled JS, or framework initialization.
- Tauri v2 improved startup time over v1, but the WebView initialization is the bottleneck, not Rust.
- Pre-render the compact mode state in the HTML so the first paint shows the widget immediately, then hydrate with JS for interactivity.
- **Target:** With a minimal frontend, 200-500ms from process start to visible widget is achievable. 1-second budget in the requirements is generous.

**Confidence:** MEDIUM -- exact startup times depend on macOS version and hardware. The general guidance is sound.

---

## Build & Distribution Issues

### CRITICAL: Code signing is not optional for distribution

**What goes wrong:** You build the app and send the `.dmg` to a friend (or yourself on another machine). macOS Gatekeeper blocks it with "app is damaged and can't be opened" or "unidentified developer."

**Why it happens:** macOS Sequoia (15+) is increasingly aggressive about unsigned/unnotarized apps. The old "right-click > Open" bypass is harder to find.

**Prevention:**
- Get an Apple Developer certificate ($99/year). Both "Developer ID Application" (for signing) and "Developer ID Installer" (for signing the DMG/pkg).
- Set up notarization in the Tauri build config. Tauri v2's `tauri build` can handle notarization if you provide the credentials.
- **For development only:** You can run unsigned builds locally. But test the signed+notarized build before considering the app "done."
- Environment variables needed: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`.

**Confidence:** HIGH -- code signing and notarization are mandatory for macOS distribution.

### Notarization requires specific entitlements

**What goes wrong:** You sign the app, submit it for notarization, and Apple rejects it. The error message is cryptic (usually a JSON blob with a UUID).

**Prevention:**
- Ensure Hardened Runtime is enabled (Tauri does this by default).
- Ensure the entitlements file includes the JIT and unsigned-memory entitlements (Tauri should set these).
- **Common failure:** Including a `com.apple.security.app-sandbox` entitlement when you are NOT distributing via the Mac App Store. For direct distribution, do NOT enable sandboxing -- it will restrict file access and login item behavior.
- Use `xcrun stapler validate` on the final `.app` to confirm notarization is stapled.

**Confidence:** MEDIUM -- general macOS notarization knowledge; exact Tauri v2 build behavior should be verified against current docs.

### Universal binary (Apple Silicon + Intel)

**What goes wrong:** You build on an M-series Mac. The binary only runs on Apple Silicon. Intel Mac users (still ~20% of the install base as of 2025) cannot run it.

**Prevention:**
- Build a universal binary: `tauri build --target universal-apple-darwin`.
- This requires having both `aarch64-apple-darwin` and `x86_64-apple-darwin` Rust targets installed: `rustup target add x86_64-apple-darwin`.
- **Gotcha:** Universal builds double the binary size. For a small app, 10 MB becomes 15-20 MB. Still within the requirement but worth noting.
- If targeting macOS 11+ only (reasonable), you can potentially skip Intel -- but check your user base.

**Confidence:** HIGH -- standard Rust cross-compilation for macOS.

### DMG vs PKG vs direct .app

**What goes wrong:** You distribute a `.app` directly. Users drag it to Applications, but it does not have the right permissions because it was not installed via a proper installer. Or: you create a DMG but macOS quarantine flags make the first launch confusing.

**Prevention:**
- Tauri v2 builds a `.dmg` by default on macOS. This is the standard distribution format.
- The DMG includes a drag-to-Applications prompt. This is sufficient for a simple utility.
- After notarization, the quarantine flag should resolve cleanly on first launch.
- Do NOT use a `.pkg` installer unless you need to install system-level components (you do not for this widget).

**Confidence:** HIGH.

---

## Plugin Maturity Assessment

Based on training data through early 2025. Confidence is MEDIUM across the board -- plugin ecosystem may have evolved.

| Plugin | Needed For | Maturity | Notes |
|--------|-----------|----------|-------|
| `@tauri-apps/plugin-global-shortcut` | Toggle expand/collapse, quick task input | Solid | Core plugin, well-maintained. macOS Accessibility permission required. |
| `@tauri-apps/plugin-autostart` | Launch at login | Moderate | Works but login item APIs are fragile across macOS versions. Test on target macOS version. |
| `@tauri-apps/plugin-positioner` | Snap to screen corners/edges | Moderate | Useful for initial positioning. Custom snap-to-edge logic may still be needed. |
| `@tauri-apps/plugin-store` | Persistent key-value storage | Solid | Alternative to raw JSON file. Uses a simple file-backed store. |
| `@tauri-apps/plugin-fs` | File system access | Solid | Core plugin. Needed if writing raw JSON instead of using plugin-store. |
| `@tauri-apps/plugin-shell` | Not needed | N/A | Avoid -- opens security surface for no benefit. |
| `@tauri-apps/plugin-window-state` | Remember window position/size | Moderate | May partially solve position persistence. Verify it handles multi-monitor correctly. |

**Key assessment:** The official Tauri v2 plugins (under `@tauri-apps/plugin-*`) are generally stable for core functionality. Third-party plugins vary widely. For this project, stick to official plugins only -- the requirements are simple enough.

**Recommendation:** Use `plugin-store` instead of manual JSON file handling. It is simpler, handles serialization, and avoids file corruption edge cases (e.g., crash during write).

---

## Risk Register (with mitigations)

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|-----------|------------|
| 1 | Widget steals focus from active app on click | **Critical** | **High** (default behavior) | Must configure NSPanel / non-activating behavior via objc crate on day one. This is the make-or-break UX issue. |
| 2 | Widget invisible on fullscreen Spaces | **Moderate** | **Certain** (by design) | Accept as platform constraint. Document for users. Do not attempt to override -- it creates worse problems. |
| 3 | Global shortcuts silently fail without Accessibility permission | **High** | **High** (first-run) | Detect permission state and show a clear setup prompt guiding user to System Settings. |
| 4 | Login item does not survive macOS updates or resets | **Moderate** | **Moderate** | Use official plugin. Test after notarization. Add a "check at launch" that re-registers if needed. |
| 5 | Unsigned builds blocked by Gatekeeper | **High** | **Certain** (for distribution) | Set up code signing and notarization early -- not as a last step. Test on a clean Mac. |
| 6 | Idle CPU usage above 0% from WebView | **Moderate** | **Moderate** | No continuous animations, no polling loops. Measure with Activity Monitor during development. |
| 7 | Window position restored off-screen after monitor change | **Low** | **Moderate** | Validate saved position against available monitors on launch. Fall back to primary display. |
| 8 | Drag-vs-click conflict on compact widget | **Moderate** | **High** | Implement mousedown + movement threshold to distinguish drag from click. |
| 9 | Transparent window rendering artifacts | **Low** | **Low** | Test on target macOS versions. Fixed window size minimizes resize-related artifacts. |
| 10 | Tauri v2 API breaking changes | **Moderate** | **Low** (v2 is stable release) | Pin Tauri version. Check changelog before upgrading. |
| 11 | Memory baseline of ~40 MB for a "tiny" widget | **Low** | **Certain** | Inherent to WebView. Acceptable for a desktop app. Do not chase below 25 MB -- it is not possible with a WebView. |
| 12 | macOS version compatibility (pre-Monterey) | **Low** | **Low** | Tauri v2 requires macOS 10.15+ (Catalina). This covers effectively all active Macs. No special handling needed. |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Window setup (early) | Focus stealing is the default and will make the widget feel broken | Implement non-activating panel behavior before any other UX work |
| Window setup (early) | Dock icon and Cmd+Tab presence make the widget feel heavy | Set LSUIElement immediately in config |
| Drag and snap | Click vs drag ambiguity on a small surface | Movement threshold detection; test on trackpad and mouse |
| Global shortcuts | Silent failure without accessibility permission | Build permission detection and onboarding flow |
| Launch at login | Works in dev, fails when notarized | Test the full signed+notarized build for login item behavior |
| Build/distribution | "I'll sign it later" leads to a painful last-mile scramble | Set up signing in the first build milestone, not the last |
| Storage | JSON file corruption on crash during write | Use plugin-store (atomic writes) or implement write-to-temp-then-rename pattern |
| Styling | Rounded corners with transparent window require specific layering | Set up transparent window + CSS border-radius on wrapper div from the start |

---

## Sources and Confidence Note

All findings in this document are based on training data through early 2025. Web search and documentation fetching tools were unavailable during this research session.

**Items that should be verified against current (April 2026) documentation:**
1. Tauri v2 plugin API surfaces -- especially `plugin-autostart` and `plugin-global-shortcut` for macOS
2. Whether Tauri v2 has added native support for non-activating panels (NSPanel) without requiring raw objc calls
3. Current notarization requirements and any changes in macOS Sequoia or later
4. Exact `tauri.conf.json` schema for `LSUIElement` and `macOSPrivateApi` settings
5. Whether `plugin-window-state` handles multi-monitor scenarios correctly

**Highest-confidence findings** (platform behavior, not Tauri-specific):
- Focus stealing, Space behavior, LSUIElement, font rendering, code signing requirements -- these are macOS fundamentals that have not changed.

**Lowest-confidence findings** (may have changed):
- Exact Tauri v2 plugin APIs, config key names, and whether specific workarounds are still needed vs. now being handled natively by Tauri.
