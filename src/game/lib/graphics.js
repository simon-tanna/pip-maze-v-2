// src/game/lib/graphics.js
// Character sprite configs and the image-backed pickups (key, chest).
// Procedural art lives in environment.js (chamber, boss arena) and
// hazard-art.js (hazards, FX, UI icons); colours come from palette.js.

import { TILE_SIZE } from './constants.js';

// Single source of truth for all playable character sprite sheets.
export const CHARACTER_CONFIGS = {
  pip: {
    key: "pip",
    animKey: "pip",
    frameWidth: 603,
    frameHeight: 846,
    tint: null,
  },
  john: {
    key: "john",
    animKey: "john",
    frameWidth: 92,
    frameHeight: 166,
    tint: null,
  },
  ellen: {
    key: "ellen",
    animKey: "ellen",
    frameWidth: 90,
    frameHeight: 169,
    tint: null,
  },
};

export function createPlayer(scene, x, y, characterKey) {
  const key = characterKey || scene.game.registry.get("character") || "pip";
  const cfg = CHARACTER_CONFIGS[key] || CHARACTER_CONFIGS.pip;
  const sprite = scene.add.sprite(x, y, cfg.animKey);
  sprite.setScale(TILE_SIZE / cfg.frameHeight);
  if (cfg.tint !== null) sprite.setTint(cfg.tint);
  return sprite;
}

export function drawChest(scene, x, y) {
  const img = scene.add.image(x, y, 'chest');
  img.setDisplaySize(TILE_SIZE, TILE_SIZE);
  return img;
}

export function drawKey(scene, x, y) {
  const img = scene.add.image(x, y, 'key');
  img.setDisplaySize(46, 43);
  return img;
}
