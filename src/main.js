// Top Focus -- Phase 1
// Handles: position persistence (WIN-08, WIN-09), click/drag disambiguation (WIN-07)

const POSITION_KEY = 'windowPosition';
const DRAG_THRESHOLD = 5; // pixels -- movement beyond this is a drag, not a click
const SAVE_DEBOUNCE = 500; // ms -- debounce position saves during drag

let store = null;
let saveTimeout = null;

// --- Position Persistence (WIN-08, WIN-09) ---

async function initStore() {
  // Tauri v2 with withGlobalTauri: true exposes APIs on window.__TAURI__
  const storeApi = window.__TAURI__.store;
  store = await storeApi.Store.load('store.json');
  return store;
}

async function restorePosition() {
  if (!store) return;

  const saved = await store.get(POSITION_KEY);
  if (!saved || typeof saved.x !== 'number' || typeof saved.y !== 'number') {
    console.log('No saved position, using default');
    return;
  }

  // Validate against current monitors (WIN-09)
  const windowApi = window.__TAURI__.window;
  const monitors = await windowApi.availableMonitors();

  if (!monitors || monitors.length === 0) {
    console.log('No monitors detected, using default position');
    return;
  }

  // Check if saved position is within any monitor's bounds
  const isOnScreen = monitors.some((monitor) => {
    const pos = monitor.position;
    const size = monitor.size;
    const monitorLeft = pos.x;
    const monitorTop = pos.y;
    const monitorRight = pos.x + size.width;
    const monitorBottom = pos.y + size.height;

    return (
      saved.x >= monitorLeft - 100 && // Allow partial off-screen (100px grace)
      saved.x < monitorRight &&
      saved.y >= monitorTop - 50 &&
      saved.y < monitorBottom
    );
  });

  const appWindow = windowApi.getCurrentWindow();

  if (isOnScreen) {
    const LogicalPosition = window.__TAURI__.dpi
      ? window.__TAURI__.dpi.LogicalPosition
      : windowApi.LogicalPosition;
    await appWindow.setPosition(new LogicalPosition(saved.x, saved.y));
    console.log('Position restored: (' + saved.x + ', ' + saved.y + ')');
  } else {
    console.log('Saved position is off-screen, falling back to top-right of primary');
    // Fall back to top-right corner of primary display with 12px margin
    const primary = monitors[0];
    const fallbackX = primary.position.x + primary.size.width - 348 - 12;
    const fallbackY = primary.position.y + 12;
    const LogicalPosition = window.__TAURI__.dpi
      ? window.__TAURI__.dpi.LogicalPosition
      : windowApi.LogicalPosition;
    await appWindow.setPosition(new LogicalPosition(fallbackX, fallbackY));
    // Save the fallback position
    await store.set(POSITION_KEY, { x: fallbackX, y: fallbackY });
    await store.save();
  }
}

async function savePosition(x, y) {
  if (!store) return;
  await store.set(POSITION_KEY, { x, y });
  await store.save();
}

function debouncedSavePosition(x, y) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => savePosition(x, y), SAVE_DEBOUNCE);
}

async function listenForMoves() {
  const windowApi = window.__TAURI__.window;
  const appWindow = windowApi.getCurrentWindow();

  await appWindow.onMoved(({ payload }) => {
    debouncedSavePosition(payload.x, payload.y);
  });
}

// --- Click vs Drag Disambiguation (WIN-07) ---
// data-tauri-drag-region handles native drag. We layer click detection on top.
// A "click" is mousedown + mouseup within DRAG_THRESHOLD pixels and within 300ms.
// In Phase 1, click is a no-op (expand arrives Phase 2). But we wire it now.

let mouseDownPos = null;
let mouseDownTime = 0;

function initClickDragDisambiguation() {
  const widget = document.querySelector('.widget');

  widget.addEventListener('mousedown', (e) => {
    mouseDownPos = { x: e.clientX, y: e.clientY };
    mouseDownTime = Date.now();
  });

  widget.addEventListener('mouseup', (e) => {
    if (!mouseDownPos) return;

    const dx = Math.abs(e.clientX - mouseDownPos.x);
    const dy = Math.abs(e.clientY - mouseDownPos.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const elapsed = Date.now() - mouseDownTime;

    if (distance < DRAG_THRESHOLD && elapsed < 300) {
      // This is a click, not a drag
      handleWidgetClick();
    }

    mouseDownPos = null;
    mouseDownTime = 0;
  });
}

function handleWidgetClick() {
  // Phase 1: no-op. Phase 2 will expand the widget here.
  console.log('Widget clicked (expand will be wired in Phase 2)');
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initStore();
    await restorePosition();
    await listenForMoves();
    initClickDragDisambiguation();
    console.log('Top Focus initialized');
  } catch (err) {
    console.error('Initialization error:', err);
  }
});
