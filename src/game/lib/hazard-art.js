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

// Double-headed swinging axe. Pivot (the wall bracket) sits at (24, 3).
export const BLADE_PIVOT = { x: 24 / 48, y: 3 / 48 };

function paintBlade(g) {
  rect(g, P.INK, 20, 0, 8, 6);
  rect(g, P.STEEL_DARK, 21, 0, 6, 5);
  rect(g, P.STEEL_LIGHT, 22, 1, 1, 1);
  rect(g, P.INK, 22, 4, 4, 40);
  rect(g, P.STONE_SIDE, 23, 4, 2, 39);
  rect(g, P.STONE_LIGHT, 23, 4, 1, 39);
  // Crescent bits: wide at the edge, narrow at the haft.
  const cy = 30;
  for (let dy = -14; dy <= 14; dy++) {
    const t = Math.abs(dy) / 15;
    const reach = Math.round(17 * Math.sqrt(1 - t * t));
    const neck = Math.round(4 + 6 * t * t);
    const w = reach - neck;
    if (w <= 0) continue;
    const y = cy + dy;
    const lx = 22 - reach;
    rect(g, P.INK, lx - 1, y, w + 1, 1);
    rect(g, P.STEEL, lx, y, w, 1);
    rect(g, P.STEEL_LIGHT, lx, y, 2, 1);
    const rx = 26 + neck;
    rect(g, P.INK, rx, y, w + 1, 1);
    rect(g, P.STEEL, rx, y, w, 1);
    rect(g, P.STEEL_DARK, rx + w - 2, y, 2, 1);
  }
  rect(g, P.INK, 4, cy - 15, 40, 1, 0);
  rect(g, P.INK, 19, cy - 4, 10, 9);
  rect(g, P.STEEL_DARK, 20, cy - 3, 8, 7);
  rect(g, P.STEEL_LIGHT, 21, cy - 3, 3, 1);
}

// Shambling mummy, 4 frames. `alert` frames light the eyes for the chase.
export const MUMMY_FRAMES = 4;

function paintMummy(g, frame, alert) {
  const bob = [0, 1, 0, 1][frame];
  const step = [0, 2, 0, -2][frame];
  const sway = [0, -1, 0, 1][frame];
  const outlined = (color, x, y, w, h) => {
    rect(g, P.INK, x - 1, y - 1, w + 2, h + 2);
    rect(g, color, x, y, w, h);
  };
  // Legs (alternate lengths read as a stiff, dragging step).
  outlined(P.LINEN_DARK, 17, 34 + bob, 5, 9 + step);
  outlined(P.LINEN_DARK, 27, 34 + bob, 5, 9 - step);
  [36, 39].forEach((y) => { rect(g, P.LINEN, 17, y + bob, 5, 1); rect(g, P.LINEN, 27, y + bob, 5, 1); });
  // Arms reaching out.
  outlined(P.LINEN, 6, 22 + bob + sway, 10, 5);
  outlined(P.LINEN, 32, 22 + bob - sway, 10, 5);
  rect(g, P.LINEN_DARK, 6, 25 + bob + sway, 10, 1);
  rect(g, P.LINEN_DARK, 32, 25 + bob - sway, 10, 1);
  rect(g, P.STONE_DARK, 5, 23 + bob + sway, 1, 3);
  rect(g, P.STONE_DARK, 42, 23 + bob - sway, 1, 3);
  // Torso with diagonal wraps.
  outlined(P.LINEN, 15, 20 + bob, 18, 15);
  [22, 26, 30].forEach((y, i) => {
    for (let x = 15; x < 33; x++) {
      const yy = y + bob + Math.floor((x - 15) / 6) - i % 2;
      if (yy < 34 + bob) rect(g, P.LINEN_DARK, x, yy);
    }
  });
  rect(g, P.LINEN_DARK, 22 + sway, 35 + bob, 2, 3 + Math.abs(step)); // trailing wrap
  // Head.
  outlined(P.LINEN, 17, 8 + bob, 14, 12);
  rect(g, P.LINEN_DARK, 17, 11 + bob, 14, 1);
  rect(g, P.LINEN_DARK, 17, 18 + bob, 14, 1);
  rect(g, P.INK, 19, 13 + bob, 10, 3);
  if (alert) {
    rect(g, P.CURSE, 20, 13 + bob, 3, 3);
    rect(g, P.CURSE, 25, 13 + bob, 3, 3);
    rect(g, P.FIRE_CORE, 21, 14 + bob, 1, 1);
    rect(g, P.FIRE_CORE, 26, 14 + bob, 1, 1);
  } else {
    rect(g, P.CURSE_DARK, 21, 14 + bob, 2, 1);
    rect(g, P.CURSE_DARK, 25, 14 + bob, 2, 1);
  }
}

function paintShadow(g) {
  rect(g, P.INK, 6, 0, 20, 1, 0.3);
  rect(g, P.INK, 2, 1, 28, 1, 0.4);
  rect(g, P.INK, 0, 2, 32, 4, 0.45);
  rect(g, P.INK, 2, 6, 28, 1, 0.4);
  rect(g, P.INK, 6, 7, 20, 1, 0.3);
}

function paintSparkle(g) {
  rect(g, P.GOLD_LIGHT, 3, 0, 1, 7);
  rect(g, P.GOLD_LIGHT, 0, 3, 7, 1);
  rect(g, P.FIRE_CORE, 2, 2, 3, 3);
}

// Stepped radial halo for ADD-blended glows (no blur filters).
function paintGlow(g) {
  [[16, 0.08], [12, 0.12], [8, 0.18], [4, 0.28]].forEach(([r, a]) => {
    g.fillStyle(0xffffff, a);
    g.fillCircle(16, 16, r);
  });
}

// Tiny bitmap painter: one char per pixel, '.' is transparent.
function paintPattern(g, rows, colors) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => { if (colors[ch] !== undefined) rect(g, colors[ch], x, y); });
  });
}

const HEART = [
  '.ooo...ooo.',
  'offfo.offfo',
  'ofhfffffffo',
  'offfffffffo',
  'offfffffffo',
  '.offfffffo.',
  '..offfffo..',
  '...offfo...',
  '....ofo....',
  '.....o.....',
];

function paintHeart(g, full) {
  paintPattern(g, HEART, {
    o: P.INK,
    f: full ? P.BLOOD : P.SHADOW,
    h: full ? P.CREAM : P.SHADOW,
  });
}

function paintArrow(g) {
  for (let i = 0; i < 7; i++) rect(g, P.INK, 6 - i - 1, i, i * 2 + 3, 1);
  for (let i = 0; i < 6; i++) rect(g, P.GOLD_LIGHT, 6 - i, i + 1, i * 2 + 1, 1);
  rect(g, P.INK, 3, 7, 7, 4);
  rect(g, P.GOLD, 4, 7, 5, 3);
}

function paintRays(g) {
  const c = 128;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = a + Math.PI / 24;
    g.fillStyle(P.GOLD_LIGHT, i % 2 ? 0.16 : 0.26);
    g.fillTriangle(c, c, c + Math.cos(a) * 180, c + Math.sin(a) * 180, c + Math.cos(b) * 180, c + Math.sin(b) * 180);
  }
}

// Wall-hugging floor decor: low contrast, never brighter than one stone step.
function paintDecor(g, kind) {
  if (kind === 'bones') {
    rect(g, P.STONE_DARK, 12, 9, 12, 2);
    rect(g, P.BONE, 12, 8, 12, 2);
    rect(g, P.BONE, 11, 7, 2, 4);
    rect(g, P.BONE, 23, 7, 2, 4);
    rect(g, P.BONE, 28, 6, 7, 6);
    rect(g, P.FLOOR_DARK, 29, 8, 2, 2);
    rect(g, P.FLOOR_DARK, 32, 8, 2, 2);
  } else if (kind === 'rubble') {
    [[10, 6, 5, 4], [16, 9, 3, 3], [30, 5, 6, 4], [24, 11, 3, 2], [36, 10, 3, 3]].forEach(([x, y, w, h]) => {
      rect(g, P.FLOOR_DARK, x + 1, y + 1, w, h);
      rect(g, P.STONE_DARK, x, y, w, h);
      rect(g, P.STONE_SIDE, x, y, w - 1, 1);
    });
  } else if (kind === 'moss') {
    rect(g, P.MOSS_DARK, 6, 0, 18, 4);
    rect(g, P.MOSS_DARK, 10, 4, 8, 3);
    rect(g, P.MOSS, 8, 0, 12, 2);
    rect(g, P.MOSS, 12, 2, 4, 2);
    rect(g, P.MOSS_DARK, 30, 0, 10, 3);
    rect(g, P.MOSS, 32, 0, 6, 1);
  } else if (kind === 'pot') {
    rect(g, P.FLOOR_DARK, 15, 15, 16, 4);
    rect(g, P.STONE_DARK, 15, 8, 14, 9);
    rect(g, P.STONE_SIDE, 16, 9, 12, 7);
    rect(g, P.FLOOR_DARK, 18, 9, 8, 3);
    rect(g, P.STONE, 16, 9, 1, 6);
    rect(g, P.STONE_DARK, 31, 13, 5, 3);
    rect(g, P.STONE_SIDE, 32, 13, 3, 1);
  }
}

export const DECOR_KINDS = ['bones', 'rubble', 'moss', 'pot'];

export const HAZARD_KEYS = {
  spike: (state) => `hz-spike-${state}`,
  nozzle: (state) => `hz-nozzle-${state}`,
  flame: (frame) => `hz-flame-${frame}`,
  blade: 'hz-blade',
  mummy: (frame, alert) => `hz-mummy-${alert ? 'alert' : 'idle'}-${frame}`,
  dust: 'fx-dust',
  ember: 'fx-ember',
  shadow: 'fx-shadow',
  sparkle: 'fx-sparkle',
  glow: 'fx-glow',
  rays: 'fx-rays',
  heart: (full) => `ui-heart-${full ? 'full' : 'empty'}`,
  arrow: 'ui-arrow',
  decor: (kind) => `env-decor-${kind}`,
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
  bake(HAZARD_KEYS.blade, 48, 48, paintBlade);
  for (let f = 0; f < MUMMY_FRAMES; f++) {
    bake(HAZARD_KEYS.mummy(f, false), 48, 48, (g) => paintMummy(g, f, false));
    bake(HAZARD_KEYS.mummy(f, true), 48, 48, (g) => paintMummy(g, f, true));
  }
  bake(HAZARD_KEYS.dust, 8, 8, paintDust);
  bake(HAZARD_KEYS.ember, 2, 2, paintEmber);
  bake(HAZARD_KEYS.shadow, 32, 8, paintShadow);
  bake(HAZARD_KEYS.sparkle, 7, 7, paintSparkle);
  bake(HAZARD_KEYS.glow, 32, 32, paintGlow);
  bake(HAZARD_KEYS.rays, 256, 256, paintRays);
  bake(HAZARD_KEYS.heart(true), 11, 10, (g) => paintHeart(g, true));
  bake(HAZARD_KEYS.heart(false), 11, 10, (g) => paintHeart(g, false));
  bake(HAZARD_KEYS.arrow, 13, 11, paintArrow);
  DECOR_KINDS.forEach((k) => bake(HAZARD_KEYS.decor(k), 48, 48, (g) => paintDecor(g, k)));
}

// Animations built from the baked frames (global, so register once).
export function registerHazardAnimations(scene) {
  const make = (key, keys, frameRate) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: keys.map((k) => ({ key: k })), frameRate, repeat: -1 });
  };
  make('hz-flame', Array.from({ length: FLAME_FRAMES }, (_, f) => HAZARD_KEYS.flame(f)), 10);
  make('hz-mummy-walk', Array.from({ length: MUMMY_FRAMES }, (_, f) => HAZARD_KEYS.mummy(f, false)), 6);
  make('hz-mummy-chase', Array.from({ length: MUMMY_FRAMES }, (_, f) => HAZARD_KEYS.mummy(f, true)), 9);
}
