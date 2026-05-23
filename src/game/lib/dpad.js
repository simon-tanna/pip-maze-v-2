const BTN_IDS = ['btn-up', 'btn-down', 'btn-left', 'btn-right'];

export function hideDpad() {
  const el = document.getElementById('dpad');
  if (el) el.style.display = 'none';
}

export function showDpad() {
  const el = document.getElementById('dpad');
  if (el) el.style.display = 'grid';
}

// Wires the four d-pad buttons to onDir(dCol, dRow) and stores the
// listeners on the scene so unwireDpad() can remove them on shutdown.
export function wireDpad(scene, onDir) {
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
    handlers.push({ el: btn, fn });
  });
  scene._dpadHandlers = handlers;
}

export function unwireDpad(scene) {
  if (!scene._dpadHandlers) return;
  scene._dpadHandlers.forEach(({ el, fn }) => {
    el.removeEventListener('pointerdown', fn);
  });
  scene._dpadHandlers = null;
}
