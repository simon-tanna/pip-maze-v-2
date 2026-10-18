// src/game/lib/ui.js
// One type treatment for every scene: Black Ops One for display,
// Pixelify Sans for body and HUD text. Panels and buttons in the palette.

import { P, css } from './palette.js';

export const FONT = {
  display: '"Black Ops One", Impact, "Arial Black", sans-serif',
  body: '"Pixelify Sans", "Courier New", monospace',
};

export const TEXT = {
  logo: (size = 80) => ({
    fontFamily: FONT.display,
    fontSize: `${size}px`,
    color: css(P.BLOOD),
    stroke: css(P.INK),
    strokeThickness: Math.round(size / 10),
    shadow: { offsetX: 0, offsetY: Math.round(size / 16), color: css(P.EMBER_DARK), fill: true, stroke: true },
  }),
  heading: (size = 28, color = P.CREAM) => ({
    fontFamily: FONT.display,
    fontSize: `${size}px`,
    color: css(color),
    stroke: css(P.INK),
    strokeThickness: Math.max(3, Math.round(size / 6)),
  }),
  body: (size = 16, color = P.CREAM) => ({
    fontFamily: FONT.body,
    fontSize: `${size}px`,
    color: css(color),
  }),
  label: (size = 13, color = P.STONE_LIGHT) => ({
    fontFamily: FONT.body,
    fontSize: `${size}px`,
    color: css(color),
    letterSpacing: 3,
  }),
};

// Stone slab panel: ink border, dark fill, lit top edge. Drawn once.
export function drawPanel(scene, x, y, w, h, { fill = P.SHADOW, alpha = 0.92, accent = P.STONE_DARK } = {}) {
  const g = scene.add.graphics();
  paintPanel(g, x, y, w, h, fill, alpha, accent);
  return g;
}

function paintPanel(g, x, y, w, h, fill, alpha, accent) {
  g.clear();
  g.fillStyle(P.INK, 1);
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle(fill, alpha);
  g.fillRect(x, y, w, h);
  g.fillStyle(accent, 1);
  g.fillRect(x, y, w, 2);
  g.fillRect(x, y, 2, h);
  g.fillStyle(P.INK, 0.6);
  g.fillRect(x, y + h - 2, w, 2);
}

// Focusable button. `setFocused(true)` gives it the fire accent.
export function createButton(scene, x, y, label, { width = 240, height = 48, size = 20, onClick = null } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const t = scene.add.text(0, 0, label, TEXT.heading(size, P.STONE_LIGHT)).setOrigin(0.5);
  c.add([g, t]);
  let focused = false;
  const draw = () => {
    paintPanel(g, -width / 2, -height / 2, width, height,
      focused ? P.EMBER_DARK : P.SHADOW, 0.95, focused ? P.FIRE : P.STONE_DARK);
    t.setColor(css(focused ? P.CREAM : P.STONE_LIGHT));
  };
  draw();
  c.setSize(width, height);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => c.emit('hover'));
  if (onClick) c.on('pointerdown', onClick);
  c.setFocused = (v) => { if (v !== focused) { focused = v; draw(); } return c; };
  c.isFocused = () => focused;
  return c;
}
