# Top Focus

A minimal floating macOS widget that keeps your single most important task visible at all times.

<p align="center">
  <img src="Icons/%231 app icon.png" alt="Top Focus icon" width="128">
</p>

## What it does

Top Focus sits in your screen corner as a compact pill showing your #1 task. Click to expand, type your focus, and collapse — it stays on top of every window as a gentle, non-intrusive reminder of what matters most right now.

## Features

- **Always-on-top floating widget** — stays visible across all apps and spaces
- **Task history** — quickly re-select recent focuses from the expanded view
- **Adjustable opacity** — dial down visibility when you need less distraction
- **Drag anywhere** — position persists across restarts and monitor changes
- **Menu bar icon** — access from the tray; app runs without a Dock icon
- **One-click complete** — hover the checkmark to mark done with a green flash
- **Right-click to quit** — no Dock required

## Tech stack

- [Tauri 2](https://tauri.app) — native macOS shell
- Rust — window management, tray, autostart, global shortcuts
- Vanilla HTML / CSS / JS — zero framework overhead

## Development

**Prerequisites:** Rust, Node.js/Bun, Xcode Command Line Tools

```bash
bun install
bun run tauri dev
```

**Build a release:**

```bash
bun run tauri build
```

The signed `.dmg` and `.app` are output to `src-tauri/target/release/bundle/`.

## Icons

| App icon | Menu bar icon |
|----------|---------------|
| <img src="Icons/%231 app icon.png" width="64"> | <img src="Icons/%231 menu bar.png" width="64"> |
