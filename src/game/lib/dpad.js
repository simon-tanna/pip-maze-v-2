const BTN_IDS = ['btn-up', 'btn-down', 'btn-left', 'btn-right'];

// On-screen controls only make sense on touch screens; desktop players use
// the keyboard and the pad would cover the play field.
export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export function hideDpad() {
  const el = document.getElementById('dpad');
  if (el) el.style.display = 'none';
}

export function showDpad() {
  const el = document.getElementById('dpad');
  if (el) el.style.display = isTouchDevice() ? 'grid' : 'none';
}

export function showFireButton(visible) {
  const el = document.getElementById('fire-container');
  if (el) el.style.display = visible && isTouchDevice() ? 'block' : 'none';
}

// Wires the four d-pad buttons to onDir(dCol, dRow) and stores the
// listeners on the scene so unwireDpad() can remove them on shutdown.
// The optional onRelease(dCol, dRow) fires when a finger lifts or slides
// off a button, for hold-to-walk.
export function wireDpad(scene, onDir, onRelease = null) {
  const handlers = [];
  const map = [
    ['btn-up', 0, -1],
    ['btn-down', 0, 1],
    ['btn-left', -1, 0],
    ['btn-right', 1, 0],
  ];
  map.forEach(([id, dCol, dRow]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const fn = (e) => {
      e.preventDefault();
      onDir(dCol, dRow);
    };
    btn.addEventListener('pointerdown', fn);
    handlers.push({ el: btn, type: 'pointerdown', fn });
    if (onRelease) {
      const up = () => onRelease(dCol, dRow);
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
        btn.addEventListener(type, up);
        handlers.push({ el: btn, type, fn: up });
      });
    }
  });
  scene._dpadHandlers = handlers;
}

export function unwireDpad(scene) {
  if (!scene._dpadHandlers) return;
  scene._dpadHandlers.forEach(({ el, type, fn }) => {
    el.removeEventListener(type, fn);
  });
  scene._dpadHandlers = null;
}
