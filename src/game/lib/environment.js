// src/game/lib/environment.js
// Static chamber art: autotiled walls, flagstone floors and ambient occlusion,
// baked once per chamber into a single DynamicTexture. All coordinates here
// are top-left based (0..47) and every fill is pixel-aligned.

import { TILE_SIZE } from './constants.js';
import { P } from './palette.js';
import { mulberry32, tileRng } from './generator.js';
import { HAZARD_KEYS, DECOR_KINDS, bakeHazardTextures } from './hazard-art.js';

const T = TILE_SIZE;

// Neighbour bits: set when that neighbour is open floor.
export const OPEN_N = 1;
export const OPEN_E = 2;
export const OPEN_S = 4;
export const OPEN_W = 8;

const WALL_VARIANTS = 3;
const FLOOR_VARIANTS = 5;
const FRONT_FACE_TOP = 32; // a wall with floor below shows a 16px front face

function rect(g, color, x, y, w = 1, h = 1, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, w, h);
}

function isOpen(map, c, r) {
  if (r < 0 || r >= map.length || c < 0 || c >= map[r].length) return false;
  return map[r][c] !== 1;
}

export function wallMask(map, c, r) {
  return (isOpen(map, c, r - 1) ? OPEN_N : 0)
       | (isOpen(map, c + 1, r) ? OPEN_E : 0)
       | (isOpen(map, c, r + 1) ? OPEN_S : 0)
       | (isOpen(map, c - 1, r) ? OPEN_W : 0);
}

function paintWallAutotile(g, mask, variant) {
  const rng = mulberry32(0xA11 + mask * 31 + variant * 977);
  const faceTop = (mask & OPEN_S) ? FRONT_FACE_TOP : T;

  // Top face: two capstone slabs; the seam position varies per variant.
  rect(g, P.STONE, 0, 0, T, faceTop);
  const seamX = [24, 15, 31][variant];
  rect(g, P.STONE_DARK, seamX, 0, 1, faceTop);
  rect(g, P.STONE_LIGHT, seamX + 1, 0, 1, faceTop);
  const seamY = [12, 20, 8][variant];
  if (seamY < faceTop - 2) {
    const [sx, sw] = variant === 1 ? [seamX + 1, T - seamX - 1] : [0, seamX];
    rect(g, P.STONE_DARK, sx, seamY, sw, 1);
    rect(g, P.STONE_LIGHT, sx, seamY + 1, sw, 1);
  }
  for (let i = 0; i < 6; i++) {
    const x = 2 + Math.floor(rng() * (T - 4));
    const y = 2 + Math.floor(rng() * (faceTop - 4));
    rect(g, rng() < 0.5 ? P.STONE_DARK : P.STONE_LIGHT, x, y);
  }

  // Rims: north and west catch the key light, east falls into shadow.
  if (mask & OPEN_N) {
    rect(g, P.STONE_LIGHT, 0, 0, T, 2);
    rect(g, P.SAND, 0, 0, T, 1);
  }
  if (mask & OPEN_W) {
    rect(g, P.STONE_LIGHT, 0, 0, 2, faceTop);
    rect(g, P.SAND, 0, 0, 1, faceTop);
  }
  if (mask & OPEN_E) {
    rect(g, P.STONE_DARK, T - 2, 0, 2, faceTop);
    rect(g, P.SHADOW, T - 1, 0, 1, faceTop);
  }

  if (!(mask & OPEN_S)) return;

  // Front face: darker brick courses under an overhanging cap lip.
  const y0 = FRONT_FACE_TOP;
  rect(g, P.STONE_SIDE, 0, y0, T, T - y0);
  rect(g, P.SAND, 0, y0, T, 1);
  rect(g, P.STONE_DARK, 0, y0 + 1, T, 2);
  rect(g, P.STONE_DARK, 0, y0 + 9, T, 1);
  const offsets = variant === 2 ? [4, 12] : [0, 8];
  [[y0 + 3, offsets[0]], [y0 + 10, offsets[1]]].forEach(([by, off]) => {
    for (let bx = off; bx < T; bx += 16) rect(g, P.STONE_DARK, bx, by, 1, 6);
    rect(g, P.STONE, 0, by, T, 1);
  });
  if (rng() < 0.45) {
    // Moss creeping down from the cap lip.
    const mx = 4 + Math.floor(rng() * 32);
    rect(g, P.MOSS_DARK, mx, y0 + 1, 10, 3);
    rect(g, P.MOSS, mx + 1, y0 + 1, 7, 2);
    rect(g, P.MOSS_DARK, mx + 3, y0 + 4, 2, 3);
  }
  rect(g, P.INK, 0, T - 1, T, 1);
  if (mask & OPEN_W) rect(g, P.STONE, 0, y0 + 3, 1, T - y0 - 4);
  if (mask & OPEN_E) rect(g, P.SHADOW, T - 1, y0, 1, T - y0);
}

function stone(g, x, y, w, h) {
  rect(g, P.FLOOR_LIGHT, x, y, w - 1, 1);
  rect(g, P.FLOOR_LIGHT, x, y, 1, h - 1);
  rect(g, P.FLOOR_DARK, x + w - 1, y, 1, h);
  rect(g, P.FLOOR_DARK, x, y + h - 1, w, 1);
}

function paintFlagstone(g, variant) {
  rect(g, P.FLOOR, 0, 0, T, T);
  const layouts = [
    [[0, 0, 24, 24], [24, 0, 24, 24], [0, 24, 24, 24], [24, 24, 24, 24]],
    [[0, 0, 48, 48]],
    [[0, 0, 48, 16], [0, 16, 48, 16], [0, 32, 48, 16]],
    [[0, 0, 30, 48], [30, 0, 18, 24], [30, 24, 18, 24]],
    [[0, 0, 24, 24], [24, 0, 24, 24], [0, 24, 48, 24]],
  ];
  layouts[variant].forEach(([x, y, w, h]) => stone(g, x, y, w, h));

  const rng = mulberry32(0xF100 + variant * 7919);
  for (let i = 0; i < 9; i++) {
    const x = 2 + Math.floor(rng() * 44);
    const y = 2 + Math.floor(rng() * 44);
    rect(g, rng() < 0.6 ? P.FLOOR_DARK : P.FLOOR_LIGHT, x, y);
  }
  if (variant === 4) {
    // Hairline crack — low contrast, reads as texture not as a hazard.
    [[10, 30], [11, 31], [12, 31], [13, 32], [14, 33], [15, 33], [16, 34]]
      .forEach(([x, y]) => rect(g, P.FLOOR_DARK, x, y));
  }
}

// Stepped (not smooth) occlusion bands keep the pixel-art look.
const AO_BANDS = [0.55, 0.36, 0.2, 0.08];

function paintAO(g, side) {
  const bandPx = side === 'e' || side === 's' ? 1 : 3;
  const bands = side === 'e' || side === 's' ? AO_BANDS.slice(1) : AO_BANDS;
  bands.forEach((alpha, i) => {
    const o = i * bandPx;
    if (side === 'n') rect(g, P.INK, 0, o, T, bandPx, alpha);
    if (side === 's') rect(g, P.INK, 0, T - o - bandPx, T, bandPx, alpha);
    if (side === 'w') rect(g, P.INK, o, 0, bandPx, T, alpha);
    if (side === 'e') rect(g, P.INK, T - o - bandPx, 0, bandPx, T, alpha);
  });
}

const wallKey = (mask, v) => `env-wall-${mask}-${v}`;
const floorKey = (v) => `env-floor-${v}`;
const aoKey = (side) => `env-ao-${side}`;

export function bakeEnvironmentTextures(scene) {
  const bake = (key, paint) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    paint(g);
    g.generateTexture(key, T, T);
    g.destroy();
  };
  for (let mask = 0; mask < 16; mask++) {
    for (let v = 0; v < WALL_VARIANTS; v++) bake(wallKey(mask, v), (g) => paintWallAutotile(g, mask, v));
  }
  for (let v = 0; v < FLOOR_VARIANTS; v++) bake(floorKey(v), (g) => paintFlagstone(g, v));
  ['n', 'e', 's', 'w'].forEach((side) => bake(aoKey(side), (g) => paintAO(g, side)));
}

export const DECOR_CHANCE = 0.12;

// Picks decor deterministically: only plain floor next to a wall, never on a
// tile in `avoid` (hazards, pickups, the critical path). Moss only hangs off
// a wall to the north.
export function planDecor(map, seed, avoid = new Set(), chance = DECOR_CHANCE) {
  const out = [];
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] !== 0 || avoid.has(`${c},${r}`)) continue;
      const wallN = !isOpen(map, c, r - 1);
      if (!wallN && isOpen(map, c - 1, r) && isOpen(map, c + 1, r)) continue;
      const rng = tileRng(seed, c + 500, r + 500);
      if (rng() >= chance) continue;
      const kinds = wallN ? DECOR_KINDS : DECOR_KINDS.filter((k) => k !== 'moss');
      out.push({ col: c, row: r, kind: kinds[Math.floor(rng() * kinds.length)] });
    }
  }
  return out;
}

// Bakes the whole static layer of a chamber into one texture and returns an
// Image showing it. Same seed + map → identical pixels.
export function drawChamber(scene, map, seed, { key = 'env-chamber', decor = [] } = {}) {
  bakeEnvironmentTextures(scene);
  bakeHazardTextures(scene);
  const rows = map.length;
  const cols = map[0].length;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const dt = scene.textures.addDynamicTexture(key, cols * T, rows * T);
  const at = { originX: 0, originY: 0 };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * T;
      const y = r * T;
      const rng = tileRng(seed, c, r);
      if (map[r][c] === 1) {
        dt.stamp(wallKey(wallMask(map, c, r), Math.floor(rng() * WALL_VARIANTS)), null, x, y, at);
        continue;
      }
      const v = rng();
      dt.stamp(floorKey(v < 0.4 ? 0 : v < 0.6 ? 1 : v < 0.75 ? 2 : v < 0.9 ? 3 : 4), null, x, y, at);
      if (!isOpen(map, c, r - 1)) dt.stamp(aoKey('n'), null, x, y, at);
      if (!isOpen(map, c - 1, r)) dt.stamp(aoKey('w'), null, x, y, at);
      if (!isOpen(map, c + 1, r)) dt.stamp(aoKey('e'), null, x, y, at);
      if (!isOpen(map, c, r + 1)) dt.stamp(aoKey('s'), null, x, y, at);
    }
  }
  decor.forEach(({ col, row, kind }) => dt.stamp(HAZARD_KEYS.decor(kind), null, col * T, row * T, at));
  dt.render();
  return scene.add.image(0, 0, key).setOrigin(0, 0);
}

// Menu backdrop: a wall band across the top, flagstones below, two braziers.
// Lit by the scene's LightsManager, which this enables.
export function drawTempleBackdrop(scene, { ambient, braziers = [[3, 4], [16, 4]] } = {}) {
  const map = Array.from({ length: 15 }, (_, r) => Array.from({ length: 20 }, (_, c) =>
    (r < 4 || r === 14 || c === 0 || c === 19 ? 1 : 0)));
  scene.lights.enable().setAmbientColor(ambient);
  drawChamber(scene, map, 0xD00D, { key: 'env-backdrop' }).setLighting(true).setDepth(-10);
  braziers.forEach(([c, r]) => {
    const x = c * T + T / 2;
    const y = r * T + T / 2;
    scene.add.image(x, y, HAZARD_KEYS.nozzle(1)).setDepth(-9);
    scene.add.sprite(x, y + 8, HAZARD_KEYS.flame(0)).setOrigin(0.5, 1).setDepth(-8).play('hz-flame');
    const light = scene.lights.addLight(x, y - 12, 260, P.FIRE, 1.6);
    scene.tweens.add({ targets: light, intensity: 1.9, duration: 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });
  return map;
}
