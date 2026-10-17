// src/game/lib/palette.js
// "Torchlit Sandstone" — the single source of truth for every pixel colour.
// Ramps run dark → light. Light comes from the top-left; never rotate a
// texture that has lighting baked into it.
//
// Readability hierarchy (value + saturation budget):
//   hero (torch-lit, rim) > hazards (only saturated reds/steel) >
//   pickups (gold + glow) > decor (stone/moss ramps, dim) > floor (darkest)

export const P = Object.freeze({
  // Neutrals
  INK:         0x0e0a0c, // outlines, holes, contact shadow
  SHADOW:      0x1c1418, // deepest fill, UI panels

  // Floor ramp — low contrast on purpose so hazards read on top of it
  FLOOR_DARK:  0x2a1f1c,
  FLOOR:       0x3a2b24,
  FLOOR_LIGHT: 0x4d3a2e,

  // Wall / stone ramp
  STONE_DARK:  0x4a3428, // shadow side, mortar
  STONE_SIDE:  0x6b4c38, // front (south) face
  STONE:       0x8f6a4c, // top face
  STONE_LIGHT: 0xb48e64, // lit rim
  SAND:        0xd8b98a, // brightest stone highlight, dust

  // Organic decor
  MOSS_DARK:   0x26331f,
  MOSS:        0x45583a,
  BONE:        0x8a7f6c, // dimmer than linen so bones never read as mummies

  // Mummy / curse
  LINEN_DARK:  0x6f7562,
  LINEN:       0xb3b49a,
  CURSE_DARK:  0x1d5c4e,
  CURSE:       0x46e0b4, // mummy eyes, alert state, runes

  // Steel (blades, spikes, grates)
  STEEL_DARK:  0x3a3f4c,
  STEEL:       0x7d8799,
  STEEL_LIGHT: 0xd6dde6,

  // Fire ramp — reserved for hazards, lava and telegraphs
  EMBER_DARK:  0x6e1a0e,
  EMBER:       0xb8361a,
  FIRE:        0xf0742a,
  FIRE_HOT:    0xffbf47,
  FIRE_CORE:   0xfff1c9,

  // Gold — pickups only
  GOLD_DARK:   0x8c5a12,
  GOLD:        0xe8a92e,
  GOLD_LIGHT:  0xffe592,

  // UI
  BLOOD:       0xb3241d,
  CREAM:       0xf3e4c4,
});

// Light colours (fed to the LightsManager, not painted as pixels).
export const LIGHT = Object.freeze({
  AMBIENT: 0x9a8890,
  TORCH:   P.FIRE_HOT,
  FLAME:   P.FIRE,
  GOLD:    P.GOLD_LIGHT,
  CURSE:   P.CURSE,
});

// '#rrggbb' for Text styles and CSS.
export function css(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}
