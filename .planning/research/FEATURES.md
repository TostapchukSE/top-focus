# Features Research

**Domain:** macOS floating focus widget
**Researched:** 2026-04-10
**Confidence:** MEDIUM (based on training data knowledge of macOS productivity ecosystem; no live web verification available)

## Competitive Landscape (brief)

The "single focus task" space sits at the intersection of several product categories:

**Direct competitors (single-task focus):**
- **One Big Thing** — menubar app that asks "What's your one thing today?" Simple text entry, lives in the menubar. No floating widget.
- **Focusbar** — menubar-based focus task display. Shows current task in the macOS menu bar text area. Lightweight but constrained to menubar width.
- **Intention** — asks for your intention at session start, displays it. More meditation-adjacent than task-adjacent.

**Adjacent: Focus/session apps (broader scope):**
- **Session** — Pomodoro + focus sessions. Beautiful design but oriented around time blocks, not persistent task display.
- **Flow** — Pomodoro timer with menubar presence. Time-centric, not task-centric.
- **Centered** — Writing/work focus app. Blocks distractions and shows focus state. More about environment control.

**Adjacent: Sticky notes / floating widgets:**
- **macOS Stickies** (built-in) — Floating notes, always visible, but general-purpose. No task completion concept. Feels dated.
- **Mela** — Recipe app (not relevant despite the prompt mentioning it).
- **StickyNote** / **Notchmeister** — Floating note concepts, but general-purpose, not task-focused.

**Adjacent: Menubar task managers:**
- **Things 3** (menubar quick-entry), **Todoist** (menubar), **TickTick** — All have menubar presence but are full task managers. The opposite of "one task."

**Key gap Top Focus fills:** No mainstream app provides a persistent, floating, always-on-top single-task visual anchor on macOS. Menubar apps exist but are tiny, easily ignored, and hidden behind the notch on modern MacBooks. Stickies exist but have no task lifecycle (enter -> do -> complete -> next). This is a real gap.

## Table Stakes (must have or it feels broken)

These features are non-negotiable. Without them, the widget feels like a tech demo, not a tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Always-on-top floating window | The entire value proposition. If it goes behind windows, it's useless. | Med | macOS window level management via Tauri; need to handle full-screen app behavior |
| Draggable positioning | Users will want it in their preferred corner. Fixed position = uninstall. | Low | Standard window drag; store position in local state |
| Position persistence across restarts | If it resets position every launch, it feels amateur. | Low | Save x,y to local JSON |
| Single task display (compact mode) | Must show one task, readable at a glance from arm's length. | Low | Typography and contrast are everything here |
| Task entry (expanded mode) | Must be able to type/edit the task. Friction here kills the whole loop. | Low | Text input with confirm action |
| Mark task complete | Without a "done" action, there's no task lifecycle, just a sticky note. | Low | Button/shortcut + visual feedback |
| Empty state ("What's your #1?") | After completing a task, the widget must prompt for the next one. The empty state IS the nudge. | Low | This is a core UX moment -- make it inviting, not nagging |
| Launch at login | If you have to manually open it, you won't. Habit requires zero friction to start. | Low | macOS login item via Tauri |
| Keyboard shortcut (global) | Power users will want to interact without mousing to the widget. Essential for flow. | Med | Global hotkey registration on macOS requires accessibility permissions |
| Dark mode support | macOS users expect it. Mismatch with system theme looks broken. | Low | CSS media query + Tauri theme detection |
| Minimal resource usage | A focus widget that spins fans or eats RAM is an ironic disaster. | Low | Tauri inherently handles this well vs Electron |
| Graceful full-screen behavior | When user is in a full-screen app, widget needs a sane behavior (either show on all spaces, or have a way to access it). | Med | macOS window level + space assignment; this is a real UX decision |

## Differentiators (what makes the best ones stand out)

These separate "nice tool" from "indispensable tool."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Satisfying completion animation | The "Done" micro-feedback (1-2 sec checkmark) creates a dopamine hit that reinforces the habit loop. Best focus apps nail this moment. | Low | Already in PROJECT.md -- good instinct. Make it feel like checking off a physical list. |
| Edge snapping | Widget magnetically snaps to screen edges/corners. Makes repositioning feel intentional, not sloppy. | Med | Calculate proximity to edges, snap when within threshold |
| Opacity/transparency control | Lets users tune the widget's visual weight. Some want it bold, some want it ghosted. Respects user preference without adding modes. | Low | CSS opacity + slider in settings |
| Task history (last N tasks) | Quick re-selection of recent tasks avoids retyping recurring work. "Back to that thing from this morning" in one click. | Low | Already planned (20 tasks). Good number -- enough to be useful, not enough to become a list to manage. |
| Click-through mode | Widget is visible but mouse clicks pass through to the window below. Eliminates "I accidentally clicked the widget" friction. | Med | macOS `ignoresMouseEvents` on the window. Toggle with hotkey. This is a genuine differentiator -- few floating widgets offer it. |
| Compact auto-truncation with tooltip | Long task text truncates cleanly in compact mode, full text on hover. Keeps compact mode truly compact. | Low | CSS truncation + title attribute or custom tooltip |
| Screen edge peek/hide | Widget can be mostly hidden off-screen edge, peek out just a few pixels, and slide in on hover or hotkey. Reduces visual noise when you're in flow but keeps it accessible. | Med | Animate position based on hover/proximity |
| Multi-monitor awareness | Remembers which display it belongs to. Doesn't jump to primary monitor on wake/reconnect. | Med | Monitor enumeration + position relative to display bounds |
| Subtle idle animation | A very subtle breathing glow or pulse on the accent color when idle. Subconsciously draws the eye back without being annoying. Must be extremely subtle. | Low | CSS animation on the border/shadow. Danger: easy to overdo. |
| Configurable accent color | Some users will want to match their aesthetic. Orange default is strong but personalization increases attachment. | Low | Color picker in settings, CSS variable |

## Anti-Features (deliberately exclude -- and why)

These are features that sound reasonable but actively undermine the core value of "one task, always visible, zero friction."

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multiple tasks / task list | The ENTIRE value is one task. A list reintroduces scanning cost, prioritization anxiety, and guilt about the other items. This is the #1 feature request you'll get and the #1 thing to refuse. | Stay ruthlessly single-task. If users want a list, they already have Things/Todoist/Reminders. |
| Due dates / deadlines | Adds time pressure to what should be a calm visual anchor. Creates anxiety about overdue items. | The task is "now." There is no "when." |
| Priority levels / tags / categories | Organizational metadata is list-manager territory. It adds cognitive overhead to a tool whose purpose is reducing cognitive overhead. | Free text only. The user's brain is the categorization engine. |
| Notifications / alerts / reminders | A focus tool that interrupts you is an oxymoron. Notifications are the problem, not the solution. | The widget's persistence IS the reminder. Its visibility replaces notifications. |
| Integrations (Jira, Trello, etc.) in v1 | Auth flows, sync state, error handling, network dependency -- each integration 10x's complexity and adds failure modes to a tool that must be rock-solid simple. | Manual entry. Copy-paste from your task manager is fine. The widget is the display layer, not the source of truth. |
| Time tracking / Pomodoro | Adds timer anxiety. "I've been on this task for 3 hours" induces guilt, not focus. Different mental model entirely. | If users want timers, they have Session/Flow/Be Focused. |
| Statistics / analytics / streaks | "You completed 7 tasks today!" gamification changes the tool from a focus anchor to a productivity tracker. Different product entirely. | Task history for re-selection only, not for measurement. |
| Rich text / markdown in task | Formatting a task description is procrastination disguised as productivity. Plain text forces clarity. | Plain text only. If you can't state your task in one sentence, you haven't clarified it yet. |
| Cloud sync | Adds network dependency, account creation, privacy concerns, and sync conflict complexity to a tool that must work instantly, offline, always. | Local JSON. The task is ephemeral by nature -- it changes hourly/daily. There's nothing to sync. |
| Widgets/complications on other surfaces | Don't try to also be a menubar item, a notification center widget, a Control Center tile, AND a floating widget. Pick the one surface that works and do it perfectly. | Floating window only. One surface, done well. |
| Sounds / audio feedback | Audio on task completion sounds cute in a demo and annoying after day 2. Focus tools should be silent. | Visual feedback only. The checkmark animation is enough. |

## UX Patterns Worth Stealing

### 1. The "What's Next?" Prompt (from Intention / journaling apps)
When the widget is empty, don't show a blank box. Show a warm, inviting prompt: "What's your #1 focus?" This turns the empty state from "I have nothing to do" into "I get to choose what matters." The prompt IS the feature.

### 2. Expand-on-Click, Collapse-on-Confirm (from Spotlight / Alfred)
Compact mode is the resting state. Click to expand. Type or edit. Press Enter or click confirm. Immediately collapse back to compact. The expanded state is transient -- like a modal that respects your time. Never leave the widget expanded after an action.

### 3. Escape-to-Dismiss (from every good macOS app)
Pressing Escape in expanded mode should collapse back to compact without saving changes. This is so expected on macOS that its absence feels like a bug.

### 4. Ghost Mode (from PiP video players)
Picture-in-Picture players on macOS reduce opacity and become click-through when you're not interacting with them. This pattern is perfect for a focus widget: visible enough to read, invisible enough to not interfere. Toggle with a hotkey or auto-activate after N seconds of no interaction.

### 5. Edge Magnetism (from macOS window management)
Snap to screen edges and corners with a small margin (8-16px from edge). When dragged near an edge, gently magnetize. This makes positioning feel deliberate and prevents the widget from feeling "loose" on the desktop.

### 6. Instant Launch, No Splash (from menubar apps)
The widget should appear at its last position within 500ms of login. No splash screen, no loading indicator, no window animation. It should feel like it was always there. Splash screens on utility apps signal "I'm heavier than I should be."

### 7. Satisfying Completion (from Todoist / Things 3)
Things 3's completion animation (the circle fills, the task fades) is beloved because it provides a moment of satisfaction. Top Focus's "Done" state should feel equally satisfying. A brief (1-1.5 sec) state change -- checkmark, color shift to green, then fade back to empty state. Don't skip this moment; it's what makes users want to complete tasks in this tool specifically.

### 8. Double-Click to Edit (from Finder / spreadsheets)
In compact mode, single-click expands to show action buttons. Double-click (or a dedicated edit shortcut) jumps straight to the text editing cursor. This saves a click for the "I need to rephrase my task" flow.

### 9. Drag from Title Area Only (from macOS windows)
Make the widget draggable from a specific grab area (top edge or a subtle grip indicator), not the entire surface. This prevents accidental drags when trying to click, and follows macOS window conventions.

### 10. Respect "Do Not Disturb" / Focus Modes (from macOS system)
When macOS Focus mode is active, the widget should still be visible (it's not a notification), but could optionally reduce its visual prominence. This shows awareness of the system ecosystem.

## Design Patterns for Non-Annoying Floating Widgets

**What makes floating widgets annoying:**
- Covering interactive elements you need (buttons, text fields)
- Requiring interaction to dismiss when you didn't summon them
- Moving unpredictably after sleep/wake or display changes
- Being too large for their content
- Having distracting animations in peripheral vision
- Not respecting full-screen apps or presentation mode

**What makes them feel native and welcome:**
- Consistent, predictable position (always where you left it)
- Appropriate size (compact mode should be SMALL -- 300x60px is right)
- Subtle shadow that grounds it on the desktop without looking heavy
- Rounded corners matching macOS design language (12-16px radius)
- System font (SF Pro) so it feels like part of the OS
- Smooth but fast animations (150-250ms, ease-out curve)
- High contrast text for readability at arm's length
- Vibrancy/blur background (NSVisualEffectView) if possible through Tauri, to match macOS aesthetic

## Feature Dependencies

```
Launch at login -> Position persistence (must remember where to appear)
Compact mode -> Task entry exists (need a task to display)
Mark complete -> Empty state (what happens after completion)
Empty state -> Task entry (prompt to enter next task)
Task history -> Mark complete (history populated by completions)
Click-through mode -> Global hotkey (need a way to re-engage the widget)
Edge snapping -> Draggable positioning (snapping requires drag)
Opacity slider -> Settings UI (needs a place to live)
```

## MVP Recommendation

**Prioritize (v1 must-ship):**
1. Always-on-top floating window with drag + position persistence
2. Compact/expanded mode toggle
3. Task entry, display, and completion with "Done" animation
4. Empty state prompt
5. Launch at login
6. One global hotkey (toggle expand/collapse)
7. Dark mode support

**Strong v1 candidates (ship if time allows):**
8. Task history (last 20) for re-selection
9. Edge snapping
10. Opacity slider
11. Second global hotkey (quick task entry)

**Defer to v2:**
- Click-through / ghost mode
- Edge peek/hide
- Multi-monitor awareness
- Configurable accent color
- Subtle idle animation

**Never build:**
- Task lists, due dates, priorities, tags, integrations, timers, analytics, sync

## Sources

- Training data knowledge of macOS productivity app ecosystem (Confidence: MEDIUM)
- Direct experience with macOS window management APIs and Tauri capabilities (Confidence: MEDIUM)
- No live web verification was possible; findings should be validated against current App Store listings

**Note:** WebSearch was unavailable during this research. The competitive landscape section may miss newer entrants from late 2025-2026. The feature analysis and UX patterns are based on established patterns that are unlikely to have changed significantly.
