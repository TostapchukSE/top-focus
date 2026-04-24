// Top Focus — main.js
// Handles: position persistence, click/drag, expand/collapse, task lifecycle, history, opacity

const POSITION_KEY  = 'windowPosition';
const TASK_KEY      = 'currentTask';
const HISTORY_KEY   = 'taskHistory';
const PREFS_KEY     = 'preferences';
const MAX_HISTORY   = 20;
const MAX_TASK_LEN  = 150;
const DRAG_THRESHOLD = 5;    // px
const SAVE_DEBOUNCE  = 500;  // ms

// Window sizes (inner widget + 48px padding for shadow)
const SIZE_COMPACT  = { w: 348, h: 108 };
const SIZE_EXPANDED = { w: 448, h: 268 };

let store       = null;
let saveTimeout = null;
let currentTask = null; // { text: string, createdAt: string } | null
let isExpanded  = false;
let isAnimating = false;

// ── Tauri helpers ──────────────────────────────────────────

function getWindow() {
  return window.__TAURI__.window.getCurrentWindow();
}

function LogicalSize(w, h) {
  const api = window.__TAURI__.dpi || window.__TAURI__.window;
  return new api.LogicalSize(w, h);
}

function LogicalPosition(x, y) {
  const api = window.__TAURI__.dpi || window.__TAURI__.window;
  return new api.LogicalPosition(x, y);
}

// ── Store ──────────────────────────────────────────────────

async function initStore() {
  try {
    store = await window.__TAURI__.store.Store.load('store.json');
    // Validate store is functional by reading a key
    await store.get(POSITION_KEY);
  } catch (err) {
    console.error('Store corrupted or unreadable, resetting:', err);
    // Create a fresh store — old data is lost but app is functional
    store = await window.__TAURI__.store.Store.load('store.json');
    await store.clear();
    await store.save();
  }
}

/** Safely read from store with fallback */
async function storeGet(key, fallback = null) {
  try {
    const val = await store.get(key);
    return val ?? fallback;
  } catch (err) {
    console.error(`Store read error for "${key}":`, err);
    return fallback;
  }
}

/** Safely write to store */
async function storeSet(key, value) {
  try {
    await store.set(key, value);
    await store.save();
  } catch (err) {
    console.error(`Store write error for "${key}":`, err);
  }
}

// ── Position persistence (WIN-08, WIN-09) ─────────────────

async function restorePosition() {
  const saved = await storeGet(POSITION_KEY);
  if (!saved || typeof saved.x !== 'number') return;

  const monitors = await window.__TAURI__.window.availableMonitors();
  if (!monitors?.length) return;

  // Monitor positions/sizes from Tauri are in physical pixels;
  // convert to logical using each monitor's scaleFactor.
  const onScreen = monitors.some(m => {
    const sf = m.scaleFactor || 1;
    const logicalW = m.size.width  / sf;
    const logicalH = m.size.height / sf;
    const logicalX = m.position.x  / sf;
    const logicalY = m.position.y  / sf;
    const r = logicalX + logicalW;
    const b = logicalY + logicalH;
    return saved.x >= logicalX - 100 && saved.x < r &&
           saved.y >= logicalY - 50  && saved.y < b;
  });

  if (onScreen) {
    await getWindow().setPosition(LogicalPosition(saved.x, saved.y));
  } else {
    const p = monitors[0];
    const sf = p.scaleFactor || 1;
    const x = (p.position.x / sf) + (p.size.width / sf) - SIZE_COMPACT.w - 12;
    const y = (p.position.y / sf) + 12;
    await getWindow().setPosition(LogicalPosition(x, y));
    await storeSet(POSITION_KEY, { x, y });
  }
}

async function savePosition(x, y) {
  await storeSet(POSITION_KEY, { x, y });
}

function debouncedSavePosition(x, y) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => savePosition(x, y), SAVE_DEBOUNCE);
}

async function listenForMoves() {
  let throttled = false;
  await getWindow().onMoved(({ payload }) => {
    if (throttled) return;
    throttled = true;
    setTimeout(() => { throttled = false; }, 100);
    debouncedSavePosition(payload.x, payload.y);
  });
}

// ── Expand / Collapse (MODE-01 through MODE-04) ───────────

/** Helper: wait for ms */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function expandWidget() {
  if (isExpanded || isAnimating) return;
  isAnimating = true;

  try {
    await getWindow().setSize(LogicalSize(SIZE_EXPANDED.w, SIZE_EXPANDED.h));

    // Brief pause so window resize settles before CSS animates in
    await wait(30);

    document.querySelector('.widget').classList.add('expanded');
    isExpanded = true;

    const input = document.getElementById('task-input');
    input.value = currentTask?.text ?? '';
    // Focus after CSS transition
    await wait(150);
    input.focus();
    input.select();
  } finally {
    isAnimating = false;
  }
}

async function collapseWidget() {
  if (!isExpanded || isAnimating) return;
  isAnimating = true;

  try {
    document.querySelector('.widget').classList.remove('expanded');

    await wait(200);

    await getWindow().setSize(LogicalSize(SIZE_COMPACT.w, SIZE_COMPACT.h));
    isExpanded = false;
  } finally {
    isAnimating = false;
  }
}

// ── Click vs drag (WIN-07) ────────────────────────────────

function initClickDragDisambiguation() {
  const compactContent = document.querySelector('.compact-content');

  compactContent.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    function onMove(ev) {
      if (dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        dragging = true;
        getWindow().startDragging();
        cleanup();
      }
    }

    function onUp() {
      cleanup();
      if (!dragging && !isExpanded) expandWidget();
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function handleWidgetClick() {
  if (isExpanded) return;
  expandWidget();
}

// ── Task display ──────────────────────────────────────────

// Scale font size so text wraps and fits the compact pill's box.
// Measures actual rendered height — not a char-count heuristic, since
// "MMMMM" and "iiiii" render very differently at the same length.
function adaptTaskFontSize(span, text) {
  const container = span.parentElement; // .compact-content
  // Available height inside compact-content (60px widget, no vertical padding).
  // Leave 2px slack so descenders don't clip.
  const availH = container.clientHeight - 2;

  const candidates = [
    { size: 17, lh: 1.25 },
    { size: 15, lh: 1.25 },
    { size: 14, lh: 1.2  },
    { size: 13, lh: 1.2  },
    { size: 12, lh: 1.2  },
    { size: 11, lh: 1.2  },
    { size: 10, lh: 1.15 },
  ];

  for (const { size, lh } of candidates) {
    span.style.fontSize   = size + 'px';
    span.style.lineHeight = String(lh);
    // Force reflow so getBoundingClientRect reflects the new size
    void span.offsetHeight;
    if (span.getBoundingClientRect().height <= availH) return;
  }
  // Fell through — smallest candidate applied; extreme tasks just clip.
}

function renderCompactTask() {
  const span   = document.querySelector('.task-text');
  const widget = document.querySelector('.widget');
  if (currentTask) {
    span.textContent = currentTask.text;
    span.classList.add('has-task');
    widget.classList.add('has-task');
    adaptTaskFontSize(span, currentTask.text);
  } else {
    span.textContent = "What's your top focus?";
    span.classList.remove('has-task');
    widget.classList.remove('has-task');
    span.style.fontSize   = '';
    span.style.lineHeight = '';
  }
}

// ── Task lifecycle (TASK-01 through TASK-08) ──────────────

async function confirmTask(text) {
  if (!text.trim()) return;
  const trimmed = text.trim().slice(0, MAX_TASK_LEN);
  currentTask = { text: trimmed, createdAt: new Date().toISOString() };
  await storeSet(TASK_KEY, currentTask);
  renderCompactTask();
  collapseWidget();
}

async function quickCompleteTask() {
  if (!currentTask) return;

  const task = currentTask;
  await addToHistory(task);

  currentTask = null;
  await storeSet(TASK_KEY, null);

  // Show green "Done ✓" in compact mode briefly, then return to empty state
  const span   = document.querySelector('.task-text');
  const widget = document.querySelector('.widget');
  span.textContent = 'Done \u2713';
  widget.classList.remove('has-task');
  widget.style.background = 'var(--color-green)';

  await wait(2000);

  widget.style.background = '';
  renderCompactTask();
}

// ── History (TASK-07) ─────────────────────────────────────

async function addToHistory(task) {
  let history = await storeGet(HISTORY_KEY, []);
  // Remove duplicate if same text already in history
  history = history.filter(h => h.text !== task.text);
  history.unshift(task);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  await storeSet(HISTORY_KEY, history);
  renderHistory(history);
}

function renderHistory(history) {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (!history?.length) return;

  history.forEach(item => {
    const pill = document.createElement('button');
    pill.className = 'history-pill';
    pill.textContent = item.text;
    pill.title = item.text;
    pill.addEventListener('click', () => {
      document.getElementById('task-input').value = item.text;
      document.getElementById('task-input').focus();
    });
    list.appendChild(pill);
  });
}

// ── Opacity (MODE-06) ─────────────────────────────────────

async function initOpacity() {
  const prefs   = await storeGet(PREFS_KEY, {});
  const opacity = prefs.opacity ?? 0.95;
  applyOpacity(opacity);

  const slider = document.getElementById('opacity-slider');
  slider.value = Math.round(opacity * 100);
  slider.addEventListener('input', async () => {
    const val = slider.value / 100;
    applyOpacity(val);
    const p = await storeGet(PREFS_KEY, {});
    p.opacity = val;
    await storeSet(PREFS_KEY, p);
  });
}

function applyOpacity(val) {
  document.querySelector('.widget').style.opacity = val;
}

// ── Controls wiring ───────────────────────────────────────

function initControls() {
  const taskInput = document.getElementById('task-input');
  const btnDone   = document.getElementById('btn-done');
  const btnClose  = document.getElementById('btn-close');
  const btnCheck  = document.getElementById('btn-check');

  // Prevent compact-view click from expanding; trigger quick complete
  btnCheck.addEventListener('mousedown', (e) => e.stopPropagation());
  btnCheck.addEventListener('click', (e) => {
    e.stopPropagation();
    quickCompleteTask();
  });

  // Enter confirms, Shift+Enter adds newline (task is single-line concept but let's keep Enter clean)
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      confirmTask(taskInput.value);
    }
    if (e.key === 'Escape') {
      // Restore original text and collapse
      taskInput.value = currentTask?.text ?? '';
      collapseWidget();
    }
  });

  // "Set focus" — save the entered text and collapse back to the widget.
  // Clearing the focus is handled only by the hover checkmark in compact view.
  btnDone.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmTask(taskInput.value);
  });

  btnClose.addEventListener('click', (e) => {
    e.stopPropagation();
    taskInput.value = currentTask?.text ?? '';
    collapseWidget();
  });

  // Global Escape to collapse
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isExpanded) {
      taskInput.value = currentTask?.text ?? '';
      collapseWidget();
    }
  });
}

// ── Right-click context menu (Quit) ──────────────────────

let contextMenuEl = null;

function initContextMenu() {
  // Build a custom context menu (no native confirm() — it doesn't work
  // correctly with non-activating NSPanel windows).
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = '<button class="context-menu-item" data-action="quit">Quit Top Focus</button>';
  menu.style.display = 'none';
  document.body.appendChild(menu);
  contextMenuEl = menu;

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu.style.left = e.clientX + 'px';
    menu.style.top  = e.clientY + 'px';
    menu.style.display = 'block';
  });

  menu.addEventListener('click', (e) => {
    const action = e.target.dataset?.action;
    if (action === 'quit') {
      // Flush any pending position save before quitting
      flushAndQuit();
    }
    menu.style.display = 'none';
  });

  // Dismiss on click elsewhere or Escape
  document.addEventListener('mousedown', (e) => {
    if (!menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      menu.style.display = 'none';
    }
  });
}

/** Flush pending position save, then quit gracefully */
async function flushAndQuit() {
  // If there's a pending debounced position save, flush it now
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    try {
      const pos = await storeGet(POSITION_KEY);
      if (pos) {
        await store.set(POSITION_KEY, pos);
        await store.save();
      }
    } catch (_) {
      // Best-effort; don't block quit
    }
  }
  window.__TAURI__.core.invoke('quit');
}

// ── Init ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initStore();
    await restorePosition();
    await listenForMoves();

    // Load persisted task
    currentTask = await storeGet(TASK_KEY);
    renderCompactTask();

    // Load history
    const history = await storeGet(HISTORY_KEY, []);
    renderHistory(history);

    await initOpacity();
    initControls();
    initClickDragDisambiguation();
    initContextMenu();
  } catch (err) {
    console.error('Init error:', err);
  }
});
