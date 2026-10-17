// src/game/lib/hazard-art.js
// Baked hazard + FX textures for the redesign. Every hazard has an idle look,
// a telegraph (wind-up) look and an active look, so danger is readable before
// it lands. Coordinates are top-left based and pixel-aligned.

import { P } from './palette.js';
import { mulberry32 } from './generator.js';

export const SPIKE_STATE = { IDLE: 0, ARMED: 1, UP: 2 };
export const NOZZLE_STATE = { IDLE: 0, HOT: 1 };
export const FLAME_FRAMES = 4;
export const FLAME_W = 48;
export const FLAME_H = 64;

function rect(g, color, x, y, w = 1, h = 1, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, w, h);
}

// Row-by-row pixel triangle (no anti-aliased paths), lit from the left.
function spikeTri(g, cx, baseY, h, hw) {
  for (let i = 0; i < h; i++) {
    const y = baseY - h + i;
    const w = Math.round((hw * (i + 1)) / h);
    rect(g, P.STEEL_LIGHT, cx - w, y, w + 1, 1);
    if (w > 0) rect(g, P.STEEL, cx + 1, y, w, 1);
    if (w > 1) rect(g, P.STEEL_DARK, cx + w, y, 1, 1);
  }
  rect(g, P.INK, cx - hw - 1, baseY, hw * 2 + 3, 1);
}

const SPIKE_COLS = [14, 24, 34];
const SPIKE_ROWS = [17, 27, 37];

function paintSpikeFrame(g, state) {
  rect(g, P.INK, 4, 4, 40, 40);
  rect(g, P.STEEL_DARK, 5, 5, 38, 38);
  rect(g, P.STEEL, 5, 5, 38, 1);
  rect(g, P.STEEL, 5, 5, 1, 38);
  rect(g, P.SHADOW, 5, 42, 38, 1);
  rect(g, P.SHADOW, 42, 5, 1, 38);
  [[8, 8], [39, 8], [8, 39], [39, 39]].forEach(([x, y]) => rect(g, P.STEEL_LIGHT, x, y));

  if (state === SPIKE_STATE.ARMED) {
    // Telegraph: the frame heats up so the tile reads as "about to fire".
    rect(g, P.EMBER, 4, 4, 40, 2);
    rect(g, P.EMBER, 4, 42, 40, 2);
    rect(g, P.EMBER, 4, 4, 2, 40);
    rect(g, P.EMBER, 42, 4, 2, 40);
    [[4, 4], [42, 4], [4, 42], [42, 42]].forEach(([x, y]) => rect(g, P.FIRE_HOT, x, y, 2, 2));
  }

  SPIKE_ROWS.forEach((cy) => {
    SPIKE_COLS.forEach((cx) => {
      rect(g, P.INK, cx - 3, cy - 1, 7, 3);
      if (state === SPIKE_STATE.IDLE) {
        rect(g, P.STEEL, cx, cy, 1, 1); // tip glint: the plate still reads as a trap
      } else if (state === SPIKE_STATE.ARMED) {
        spikeTri(g, cx, cy + 1, 4, 1);
      } else {
        rect(g, P.SHADOW, cx + 1, cy - 4, 4, 5, 0.7);
        spikeTri(g, cx, cy + 1, 9, 4);
      }
    });
  });
}

function paintNozzle(g, state) {
  rect(g, P.INK, 7, 24, 34, 18, 0.35); // soot on the surrounding floor
  rect(g, P.INK, 9, 26, 30, 14);
  rect(g, P.STEEL_DARK, 10, 27, 28, 12);
  rect(g, P.STEEL, 10, 27, 28, 1);
  rect(g, P.STEEL, 10, 27, 1, 12);
  rect(g, P.SHADOW, 10, 38, 28, 1);
  [13, 21, 29].forEach((x) => {
    if (state === NOZZLE_STATE.HOT) {
      rect(g, P.EMBER, x, 30, 6, 6);
      rect(g, P.FIRE, x + 1, 31, 4, 4);
      rect(g, P.FIRE_HOT, x + 2, 32, 2, 2);
    } else {
      rect(g, P.INK, x, 30, 6, 6);
      rect(g, P.EMBER_DARK, x + 1, 34, 4, 2);
    }
  });
}

// Bands from the outside in; the tip of the flame cools toward ember.
const FLAME_BANDS = [P.EMBER, P.FIRE, P.FIRE_HOT, P.FIRE_CORE];

function paintFlameFrame(g, frame) {
  const rng = mulberry32(0xF1A3 + frame * 131);
  const H = [30, 34, 31, 35][frame];
  const base = FLAME_H - 1;
  for (let k = 0; k < H; k++) {
    const t = k / H;
    const hw = Math.round(Math.pow(1 - t, 0.6) * 13 + Math.sin(t * 9 + frame * 1.7) * 1.5);
    if (hw <= 0) continue;
    const cx = 24 + Math.round(Math.sin(t * 5 + frame * 1.3) * 2.5 * t);
    const y = base - k;
    // Inner bands shrink faster toward the tip.
    const fracs = [1, 0.72 - t * 0.3, 0.45 - t * 0.35, 0.18 - t * 0.25];
    fracs.forEach((f, i) => {
      const w = Math.round(hw * f);
      if (w <= 0) return;
      rect(g, FLAME_BANDS[i], cx - w, y, w * 2, 1);
    });
  }
  for (let i = 0; i < 3; i++) {
    const x = 18 + Math.floor(rng() * 12);
    const y = base - H - 2 - Math.floor(rng() * 8);
    rect(g, i === 0 ? P.FIRE_HOT : P.FIRE, x, y, 2, 2);
  }
}

function paintDust(g) {
  rect(g, P.STONE_LIGHT, 2, 1, 4, 1, 0.8);
  rect(g, P.SAND, 1, 2, 6, 3, 0.85);
  rect(g, P.STONE_LIGHT, 2, 5, 4, 1, 0.8);
}

function paintEmber(g) {
  rect(g, P.FIRE_HOT, 0, 0, 2, 2);
}

export const HAZARD_KEYS = {
  spike: (state) => `hz-spike-${state}`,
  nozzle: (state) => `hz-nozzle-${state}`,
  flame: (frame) => `hz-flame-${frame}`,
  dust: 'fx-dust',
  ember: 'fx-ember',
};

export function bakeHazardTextures(scene) {
  const bake = (key, w, h, paint) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    paint(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  Object.values(SPIKE_STATE).forEach((s) => bake(HAZARD_KEYS.spike(s), 48, 48, (g) => paintSpikeFrame(g, s)));
  Object.values(NOZZLE_STATE).forEach((s) => bake(HAZARD_KEYS.nozzle(s), 48, 48, (g) => paintNozzle(g, s)));
  for (let f = 0; f < FLAME_FRAMES; f++) bake(HAZARD_KEYS.flame(f), FLAME_W, FLAME_H, (g) => paintFlameFrame(g, f));
  bake(HAZARD_KEYS.dust, 8, 8, paintDust);
  bake(HAZARD_KEYS.ember, 2, 2, paintEmber);
}
