# Top Focus

A minimal floating macOS widget that keeps your single most important task visible at all times.

<p align="center">
  <img src="Icons/%231 app icon.png" alt="Top Focus icon" width="128">
</p>

> **macOS only.** The app uses private NSPanel and `objc` APIs for always-on-top, non-activating window behavior. It does not build on Linux or Windows.

## What it does

Top Focus sits in your screen corner as a compact pill showing your #1 task. Click to expand, type your focus, and collapse — it stays on top of every window as a gentle, non-intrusive reminder of what matters most right now.

The app intentionally **hides from the Dock and Cmd-Tab**. After launch it lives in the menu bar tray (top-right of your screen).

## Features

- **Always-on-top floating widget** — stays visible across all apps and Spaces
- **Task history** — quickly re-select recent focuses from the expanded view
- **Adjustable opacity** — dial down visibility when you need less distraction
- **Drag anywhere** — position persists across restarts and monitor changes
- **Menu bar icon** — show/hide or quit from the tray; no Dock icon required
- **One-click complete** — hover the checkmark to mark done with a green flash
- **Right-click to quit** — no Dock required

## Prerequisites

- **macOS 10.15 Catalina or later**
- **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```
- **Rust 1.77.2+** via [rustup](https://rustup.rs)
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Bun** (JavaScript runtime / package manager)
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

## Development

```bash
git clone https://github.com/TostapchukSE/top-focus.git
cd top-focus
bun install
bun run tauri dev
```

The widget appears in the top-right of your screen. The Dock icon is hidden — access Show/Hide and Quit from the menu bar tray icon.

## Build a release app

```bash
bun run tauri build
```

The `.app` bundle and `.dmg` are written to `src-tauri/target/release/bundle/macos/` and `src-tauri/target/release/bundle/dmg/`.

**First-launch note:** the release build is ad-hoc signed (not notarized). macOS may block it on first open. Right-click the `.app` → **Open** to bypass Gatekeeper, or run:
```bash
xattr -cr "Top Focus.app"
```

## Code signing (optional)

To distribute to others or skip the Gatekeeper prompt, sign and notarize with an Apple Developer account:

1. Copy `.env.signing.example` → `.env.signing` and fill in your credentials
2. Update `signingIdentity` in `src-tauri/tauri.conf.json` with your certificate name
3. Run `bun run tauri build` — Tauri reads the env vars automatically

## Tech stack

- [Tauri 2](https://tauri.app) — native macOS shell
- Rust — window management, tray, autostart, global shortcuts
- Vanilla HTML / CSS / JS — zero framework overhead

## Icons

| App icon | Menu bar icon |
|----------|---------------|
| <img src="Icons/%231 app icon.png" width="64"> | <img src="Icons/%231 menu bar.png" width="64"> |
