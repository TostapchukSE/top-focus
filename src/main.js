// Top Focus — main.js
// Handles: position persistence, click/drag, expand/collapse, task lifecycle, history, opacity

const POSITION_KEY  = 'windowPosition';
const TASK_KEY      = 'currentTask';
const HISTORY_KEY   = 'taskHistory';
const PREFS_KEY     = 'preferences';
const MAX_HISTORY   = 20;
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
  store = await window.__TAURI__.store.Store.load('store.json');
}

// ── Position persistence (WIN-08, WIN-09) ─────────────────

async function restorePosition() {
  const saved = await store.get(POSITION_KEY);
  if (!saved || typeof saved.x !== 'number') return;

  const monitors = await window.__TAURI__.window.availableMonitors();
  if (!monitors?.length) return;

  const onScreen = monitors.some(m => {
    const r = m.position.x + m.size.width;
    const b = m.position.y + m.size.height;
    return saved.x >= m.position.x - 100 && saved.x < r &&
           saved.y >= m.position.y - 50  && saved.y < b;
  });

  if (onScreen) {
    await getWindow().setPosition(LogicalPosition(saved.x, saved.y));
  } else {
    const p = monitors[0];
    const x = p.position.x + p.size.width - SIZE_COMPACT.w - 12;
    const y = p.position.y + 12;
    await getWindow().setPosition(LogicalPosition(x, y));
    await store.set(POSITION_KEY, { x, y });
    await store.save();
  }
}

async function savePosition(x, y) {
  await store.set(POSITION_KEY, { x, y });
  await store.save();
}

function debouncedSavePosition(x, y) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => savePosition(x, y), SAVE_DEBOUNCE);
}

async function listenForMoves() {
  await getWindow().onMoved(({ payload }) => {
    debouncedSavePosition(payload.x, payload.y);
  });
}

// ── Expand / Collapse (MODE-01 through MODE-04) ───────────

async function expandWidget() {
  if (isExpanded || isAnimating) return;
  isAnimating = true;

  await getWindow().setSize(LogicalSize(SIZE_EXPANDED.w, SIZE_EXPANDED.h));

  // Brief pause so window resize settles before CSS animates in
  setTimeout(() => {
    document.querySelector('.widget').classList.add('expanded');
    isExpanded  = true;
    isAnimating = false;

    const input = document.getElementById('task-input');
    input.value = currentTask?.text ?? '';
    // Focus after CSS transition
    setTimeout(() => { input.focus(); input.select(); }, 150);
  }, 30);
}

async function collapseWidget() {
  if (!isExpanded || isAnimating) return;
  isAnimating = true;

  document.querySelector('.widget').classList.remove('expanded');

  setTimeout(async () => {
    await getWindow().setSize(LogicalSize(SIZE_COMPACT.w, SIZE_COMPACT.h));
    isExpanded  = false;
    isAnimating = false;
  }, 200);
}

// ── Click vs drag (WIN-07) ────────────────────────────────

let mouseDownPos  = null;
let mouseDownTime = 0;

function initClickDragDisambiguation() {
  const widget = document.querySelector('.widget');

  widget.addEventListener('mousedown', (e) => {
    mouseDownPos  = { x: e.clientX, y: e.clientY };
    mouseDownTime = Date.now();
  });

  widget.addEventListener('mouseup', (e) => {
    if (!mouseDownPos) return;
    const dx = e.clientX - mouseDownPos.x;
    const dy = e.clientY - mouseDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ms   = Date.now() - mouseDownTime;
    mouseDownPos  = null;
    mouseDownTime = 0;
    if (dist < DRAG_THRESHOLD && ms < 300) handleWidgetClick(e);
  });
}

function handleWidgetClick(e) {
  if (isExpanded) return;
  // Don't expand if the click came from inside expanded content
  expandWidget();
}

// ── Task display ──────────────────────────────────────────

function renderCompactTask() {
  const span = document.querySelector('.task-text');
  if (currentTask) {
    span.textContent = currentTask.text;
    span.classList.add('has-task');
  } else {
    span.textContent = "What's your #1?";
    span.classList.remove('has-task');
  }
}

// ── Task lifecycle (TASK-01 through TASK-08) ──────────────

async function confirmTask(text) {
  if (!text.trim()) return;
  currentTask = { text: text.trim(), createdAt: new Date().toISOString() };
  await store.set(TASK_KEY, currentTask);
  await store.save();
  renderCompactTask();
  collapseWidget();
}

async function clearTask() {
  currentTask = null;
  await store.set(TASK_KEY, null);
  await store.save();
  renderCompactTask();
  collapseWidget();
}

async function completeTask() {
  if (!currentTask) return;

  const task = currentTask;

  // Add to history before clearing
  await addToHistory(task);

  currentTask = null;
  await store.set(TASK_KEY, null);
  await store.save();

  // Collapse first, then show completion flash in compact mode
  isAnimating = true;
  document.querySelector('.widget').classList.remove('expanded');

  setTimeout(async () => {
    await getWindow().setSize(LogicalSize(SIZE_COMPACT.w, SIZE_COMPACT.h));
    isExpanded  = false;
    isAnimating = false;

    // Show green "Done ✓" state
    const span   = document.querySelector('.task-text');
    const widget = document.querySelector('.widget');
    span.textContent = 'Done ✓';
    widget.style.background = 'var(--color-green)';

    setTimeout(() => {
      widget.style.background = '';
      renderCompactTask();
    }, 1500);
  }, 200);
}

// ── History (TASK-07) ─────────────────────────────────────

async function addToHistory(task) {
  let history = (await store.get(HISTORY_KEY)) ?? [];
  // Remove duplicate if same text already in history
  history = history.filter(h => h.text !== task.text);
  history.unshift(task);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  await store.set(HISTORY_KEY, history);
  await store.save();
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
  const prefs   = (await store.get(PREFS_KEY)) ?? {};
  const opacity = prefs.opacity ?? 0.95;
  applyOpacity(opacity);

  const slider = document.getElementById('opacity-slider');
  slider.value = Math.round(opacity * 100);
  slider.addEventListener('input', async () => {
    const val = slider.value / 100;
    applyOpacity(val);
    const p = (await store.get(PREFS_KEY)) ?? {};
    p.opacity = val;
    await store.set(PREFS_KEY, p);
    await store.save();
  });
}

function applyOpacity(val) {
  document.querySelector('.widget').style.opacity = val;
}

// ── Controls wiring ───────────────────────────────────────

function initControls() {
  const taskInput = document.getElementById('task-input');
  const btnDone   = document.getElementById('btn-done');
  const btnClear  = document.getElementById('btn-clear');
  const btnClose  = document.getElementById('btn-close');

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

  // Done button: confirm if no task, complete if task exists
  btnDone.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentTask) {
      confirmTask(taskInput.value);
    } else {
      completeTask();
    }
  });

  btnClear.addEventListener('click', (e) => {
    e.stopPropagation();
    clearTask();
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

// ── Init ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initStore();
    await restorePosition();
    await listenForMoves();

    // Load persisted task
    currentTask = await store.get(TASK_KEY);
    renderCompactTask();

    // Load history
    const history = await store.get(HISTORY_KEY);
    renderHistory(history);

    await initOpacity();
    initControls();
    initClickDragDisambiguation();

    console.log('Top Focus initialized');
  } catch (err) {
    console.error('Init error:', err);
  }
});
