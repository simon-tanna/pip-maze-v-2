// src/game/lib/graphics.js
// Pure pixel-art drawing functions. Each accepts a Phaser Scene, a position,
// and returns the created Graphics object. No game logic here — only fillRect calls.

import { TILE_SIZE } from './constants.js';
import { mulberry32 } from './generator.js';

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

export function drawKeyIcon(scene, x, y) {
  const img = scene.add.image(x, y, 'key');
  img.setDisplaySize(26, 24);
  return img;
}

function paintFlameNozzle(g) {
  const baseColor = 0x443322;
  const highlight = 0x887766;
  const pit = 0x1a1a1a;

  g.fillStyle(baseColor);
  g.fillRect(-16, 10, 32, 14);

  g.fillStyle(highlight);
  g.fillRect(-16, 10, 32, 2);
  g.fillRect(-16, 10, 2, 14);

  g.fillStyle(pit);
  g.fillRect(-12, 14, 6, 8);
  g.fillRect(-3, 14, 6, 8);
  g.fillRect(6, 14, 6, 8);

  g.fillStyle(0x332211);
  g.fillRect(-12, 17, 24, 1);
}

function paintSpikeBase(g) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = -16 + col * 16;
      const cy = -16 + row * 16 + 6;
      g.fillStyle(0x2a1808);
      g.fillCircle(cx, cy, 4);
      g.fillStyle(0x0a0604);
      g.fillCircle(cx, cy, 2.5);
    }
  }
}

function paintSpike(g) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = -16 + col * 16;
      const cy = -16 + row * 16;
      const base = cy + 8;
      const tip  = cy - 8;
      const hw   = 7;

      g.fillStyle(0x111111);
      g.beginPath();
      g.moveTo(cx - hw - 1, base + 1);
      g.lineTo(cx + hw + 1, base + 1);
      g.lineTo(cx, tip - 2);
      g.closePath();
      g.fillPath();

      g.fillStyle(0x909090);
      g.beginPath();
      g.moveTo(cx - hw, base);
      g.lineTo(cx + hw, base);
      g.lineTo(cx, tip);
      g.closePath();
      g.fillPath();

      g.fillStyle(0xcccccc);
      g.beginPath();
      g.moveTo(cx - hw, base);
      g.lineTo(cx, base);
      g.lineTo(cx, tip);
      g.closePath();
      g.fillPath();

      g.fillStyle(0x585858);
      g.beginPath();
      g.moveTo(cx, base);
      g.lineTo(cx + hw, base);
      g.lineTo(cx, tip);
      g.closePath();
      g.fillPath();

      g.lineStyle(1, 0x333333);
      g.beginPath();
      g.moveTo(cx, base);
      g.lineTo(cx, tip);
      g.strokePath();

      g.fillStyle(0xffffff);
      g.fillRect(cx - 1, tip, 2, 3);
    }
  }
}

export function drawFlameNozzle(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.flameNozzle);
}

export function drawSpikeBase(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.spikeBase);
}

export function drawSpike(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.spike);
}

export function createFlame(scene, x, y) {
  const g = scene.add.graphics();
  g.x = x;
  g.y = y + 10;

  let frame = 0;

  const render = (f) => {
    g.clear();
    const colors = [0xffffff, 0xffdd00, 0xff6600, 0xcc1100];
    const jitter = f % 2 === 0 ? 2 : -2;
    const heightPulse = f % 3 === 0 ? 3 : 0;

    g.fillStyle(colors[3]);
    g.beginPath();
    g.moveTo(-14 + jitter, 0);
    g.lineTo(14 + jitter, 0);
    g.lineTo(8, -14 - heightPulse);
    g.lineTo(0, -26 + jitter * 2);
    g.lineTo(-8, -14 - heightPulse);
    g.closePath();
    g.fillPath();

    g.fillStyle(colors[2]);
    g.beginPath();
    g.moveTo(-10 - jitter, 0);
    g.lineTo(10 - jitter, 0);
    g.lineTo(6, -12);
    g.lineTo(0, -18 - heightPulse);
    g.lineTo(-6, -12);
    g.closePath();
    g.fillPath();

    g.fillStyle(colors[1]);
    g.fillRect(-6 + jitter / 2, -10, 12, 10);
    g.fillRect(-2 + jitter / 2, -15, 4, 6);

    if (f % 2 === 0) {
      g.fillStyle(colors[0]);
      g.fillRect(-2, -8, 4, 6);
    }
  };

  scene.time.addEvent({
    delay: 70,
    callback: () => {
      frame++;
      render(frame);
    },
    loop: true,
  });

  return g;
}

export function drawBlade(scene, pivotX, pivotY) {
  const g = scene.add.graphics();
  const handleLength = 22;
  const bladeWidth = 14;
  const bladeHeight = 11;

  const colorWood = 0x6d3d1e;
  const colorSteel = 0x999999;
  const colorSteelLight = 0xdddddd;
  const colorSteelDark = 0x444444;
  const colorOutline = 0x1a1a1a;

  g.lineStyle(1, colorOutline);
  g.fillStyle(0x555555);
  g.fillRect(-4, -4, 8, 8);
  g.strokeRect(-4, -4, 8, 8);

  g.fillStyle(colorOutline);
  g.fillRect(-2, 0, 4, handleLength + 2);
  g.fillStyle(colorWood);
  g.fillRect(-1, 0, 2, handleLength);

  function drawAxeSide(side) {
    const s = side;

    g.beginPath();
    g.moveTo(s, handleLength - 6);
    g.lineTo((bladeWidth + 2) * s, handleLength - bladeHeight);
    g.lineTo((bladeWidth + 4) * s, handleLength);
    g.lineTo((bladeWidth + 2) * s, handleLength + bladeHeight);
    g.lineTo(s, handleLength + 6);
    g.closePath();

    g.fillStyle(colorSteel);
    g.fillPath();
    g.lineStyle(1.5, colorOutline);
    g.strokePath();

    g.lineStyle(0);
    g.fillStyle(colorSteelLight);
    g.beginPath();
    g.moveTo(bladeWidth * s, handleLength - (bladeHeight - 3));
    g.lineTo((bladeWidth + 3) * s, handleLength - (bladeHeight - 4));
    g.lineTo((bladeWidth + 3) * s, handleLength + (bladeHeight - 4));
    g.lineTo(bladeWidth * s, handleLength + (bladeHeight - 3));
    g.fillPath();
  }

  drawAxeSide(1);
  drawAxeSide(-1);

  g.fillStyle(colorSteelLight);
  g.fillRect(-1, handleLength - 10, 2, 4);

  g.lineStyle(1.5, colorOutline);
  g.fillStyle(colorSteelDark);
  g.fillCircle(0, handleLength, 3.5);
  g.strokeCircle(0, handleLength, 3.5);

  g.x = pivotX;
  g.y = pivotY;
  g.angle = -40;
  return g;
}

function paintMummy(g) {
  const colorSkin = 0x3d2b1f;
  const colorWrap = 0xd2b48c;
  const colorWrapLight = 0xe8dcc8;
  const colorWrapShadow = 0x8b7355;
  const colorEye = 0xccff00;

  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(0, 22, 20, 6);

  g.fillStyle(colorSkin);
  g.fillRect(-10, 8, 6, 14);
  g.fillStyle(colorWrap);
  g.fillRect(-10, 8, 6, 3);
  g.fillRect(-10, 14, 6, 2);
  g.fillRect(-10, 19, 7, 3);

  g.fillStyle(colorSkin);
  g.fillRect(3, 8, 6, 14);
  g.fillStyle(colorWrapShadow);
  g.fillRect(3, 8, 6, 4);
  g.fillStyle(colorWrap);
  g.fillRect(3, 14, 6, 3);
  g.fillRect(2, 20, 7, 2);

  g.fillStyle(colorSkin);
  g.fillRect(-12, -6, 24, 16);

  g.fillStyle(colorWrapShadow);
  g.beginPath();
  g.moveTo(-12, -4);
  g.lineTo(12, 4);
  g.lineTo(12, 8);
  g.lineTo(-12, 0);
  g.fillPath();

  g.fillStyle(colorWrap);
  g.fillRect(-12, -6, 24, 3);
  g.fillRect(-12, 2, 24, 3);
  g.fillRect(-10, 10, 20, 2);

  g.fillStyle(colorWrap);
  g.fillRect(-22, -2, 10, 5);
  g.fillStyle(colorWrapShadow);
  g.fillRect(-22, 3, 4, 6);

  g.fillStyle(colorWrapLight);
  g.fillRect(10, -5, 12, 5);
  g.fillStyle(colorSkin);
  g.fillRect(22, -4, 2, 4);

  g.fillStyle(colorWrapShadow);
  g.fillRect(-10, -19, 20, 15);

  g.fillStyle(0x1a1a1a);
  g.fillRect(-10, -15, 20, 6);

  g.fillStyle(colorWrap);
  g.beginPath();
  g.moveTo(-10, -19);
  g.lineTo(10, -15);
  g.lineTo(10, -13);
  g.lineTo(-10, -17);
  g.fillPath();

  g.fillStyle(colorEye);
  g.fillRect(-5, -13, 2, 2);
  g.fillRect(4, -13, 2, 2);
  g.fillStyle(0xffffff);
  g.fillRect(-4.5, -12.5, 1, 1);
  g.fillRect(4.5, -12.5, 1, 1);
}

export function drawMummy(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.mummy);
}

function paintWallTile(g, variantIdx) {
  g.fillStyle(0x8a6840);
  g.fillRect(-24, -24, 48, 48);

  const bricks = [
    [-22, -22, 21, 13],
    [1, -22, 21, 13],
    [-22, -7, 21, 13],
    [1, -7, 21, 13],
    [-22, 8, 21, 14],
    [1, 8, 21, 14],
  ];

  bricks.forEach(([bx, by, bw, bh]) => {
    g.fillStyle(0x3d2200);
    g.fillRect(bx, by, bw, bh);
    g.fillStyle(0x7a5030);
    g.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
    g.fillStyle(0xc8a876);
    g.fillRect(bx + 2, by + 2, bw - 4, bh - 3);
    g.fillStyle(0xd4b88a);
    g.fillRect(bx + 2, by + 2, 5, 2);
  });

  if (variantIdx === 1) {
    g.fillStyle(0x2a1400);
    g.fillRect(-20, 9, 2, 1);
    g.fillRect(-18, 10, 2, 2);
    g.fillRect(-16, 12, 1, 3);
    g.fillRect(-15, 15, 1, 2);
    g.fillRect(-14, 17, 2, 2);
  } else if (variantIdx === 2) {
    g.fillStyle(0x3d5c18);
    g.fillRect(-20, -22, 10, 3);
    g.fillRect(3, -22, 8, 3);
    g.fillStyle(0x5a8020);
    g.fillRect(-19, -22, 8, 2);
    g.fillRect(4, -22, 6, 2);
  }
}

function paintFloorTile(g, variantIdx) {
  g.fillStyle(0x3a2810);
  g.fillRect(-24, -24, 48, 48);
  g.fillStyle(0x5c3d1e);
  g.fillRect(-23, -23, 46, 46);
  g.fillStyle(0x7a5c35);
  g.fillRect(-21, -21, 42, 42);

  g.fillStyle(0x9a7c52);
  g.fillRect(-21, -21, 42, 1);
  g.fillRect(-21, -21, 1, 42);
  g.fillStyle(0x4a2e14);
  g.fillRect(-21, 20, 42, 1);
  g.fillRect(20, -21, 1, 42);

  g.fillStyle(0x3a2810);
  g.fillRect(-21, -21, 2, 2);
  g.fillRect(19, -21, 2, 2);
  g.fillRect(-21, 19, 2, 2);
  g.fillRect(19, 19, 2, 2);

  const speckRng = mulberry32(0x510C + variantIdx * 9973);
  for (let i = 0; i < 7; i++) {
    const sx = -19 + Math.floor(speckRng() * 38);
    const sy = -19 + Math.floor(speckRng() * 38);
    g.fillStyle(speckRng() < 0.5 ? 0x3a2810 : 0x9a7c52);
    g.fillRect(sx, sy, 1, 1);
  }

  if (variantIdx === 1) {
    g.fillStyle(0x2a1808);
    g.fillRect(-10, -8, 1, 4);
    g.fillRect(-9, -4, 1, 4);
    g.fillRect(-8, 0, 1, 4);
    g.fillRect(-7, 4, 1, 4);
    g.fillRect(-6, 8, 1, 3);
    g.fillRect(-8, 0, 5, 1);
    g.fillRect(-3, 0, 1, 3);
    g.fillStyle(0x9a7c52);
    g.fillRect(-11, -8, 1, 1);
    g.fillRect(-9, 0, 1, 1);
  } else if (variantIdx === 2) {
    const tuftRng = mulberry32(0xABCDE);
    for (let i = 0; i < 5; i++) {
      const gx = -10 + Math.floor(tuftRng() * 20);
      const gy = -6 + Math.floor(tuftRng() * 14);
      g.fillStyle(0x3d5c18);
      g.fillRect(gx, gy, 2, 3);
      g.fillStyle(0x5a8020);
      g.fillRect(gx, gy, 1, 2);
      g.fillStyle(0x7ab030);
      g.fillRect(gx, gy, 1, 1);
    }
  } else if (variantIdx === 3) {
    g.fillStyle(0xc8a070);
    g.fillRect(-18, 14, 6, 2);
    g.fillRect(-14, 10, 8, 2);
    g.fillRect(-8, 6, 8, 2);
    g.fillRect(-2, 2, 8, 2);
    g.fillRect(4, -2, 8, 2);
    g.fillRect(10, -6, 6, 2);
    g.fillStyle(0xe0bc8c);
    g.fillRect(-14, 10, 4, 1);
    g.fillRect(-2, 2, 4, 1);
    g.fillRect(10, -6, 3, 1);
    const sandRng = mulberry32(0xDEAD);
    for (let i = 0; i < 6; i++) {
      const jx = -16 + Math.floor(sandRng() * 30);
      const jy = -8 + Math.floor(sandRng() * 22);
      g.fillStyle(0xd4b088);
      g.fillRect(jx, jy, 1, 1);
    }
  } else if (variantIdx === 4) {
    g.fillStyle(0xe8dcc0);
    g.fillRect(-8, -4, 1, 9);
    g.fillRect(-7, -5, 1, 1);
    g.fillRect(-7, 5, 2, 1);
    g.fillStyle(0xc8b89c);
    g.fillRect(-8, 1, 1, 1);
    g.fillStyle(0xe8dcc0);
    g.fillRect(2, -8, 9, 1);
    g.fillRect(1, -9, 1, 1);
    g.fillRect(11, -9, 1, 1);
    g.fillRect(4, 6, 7, 1);
    g.fillRect(4, 5, 1, 1);
    g.fillStyle(0xfff8e0);
    g.fillRect(-8, -4, 1, 1);
    g.fillRect(2, -8, 1, 1);
  } else if (variantIdx === 5) {
    g.fillStyle(0x2a1808);
    g.fillRect(-4, -6, 1, 3);
    g.fillRect(-4, -3, 8, 1);
    g.fillRect(3, -6, 1, 3);
    g.fillRect(-3, -2, 6, 1);
    g.fillRect(-1, 0, 2, 5);
    g.fillStyle(0x6a4828);
    g.fillRect(-4, -6, 1, 1);
    g.fillRect(3, -6, 1, 1);
    g.fillRect(-1, 0, 1, 1);
  } else if (variantIdx === 6) {
    g.fillStyle(0x5c3d1e);
    g.fillRect(-7, -7, 14, 14);
    g.fillStyle(0x8a6c42);
    g.fillRect(-6, -6, 12, 12);
    g.fillStyle(0xaa8a5e);
    g.fillRect(-6, -6, 12, 1);
    g.fillRect(-6, -6, 1, 12);
    g.fillStyle(0x4a2e14);
    g.fillRect(-6, 5, 12, 1);
    g.fillRect(5, -6, 1, 12);
    g.fillStyle(0x3a2810);
    g.fillRect(-3, -2, 1, 1);
    g.fillRect(2, 1, 1, 1);
  }
}

export function wallTileKey(variantValue) {
  if (variantValue < 0.5) return 'wall-tile-0';
  if (variantValue < 0.8) return 'wall-tile-1';
  return 'wall-tile-2';
}

export function floorTileKey(variantValue) {
  if (variantValue < 0.55) return 'floor-tile-0';
  if (variantValue < 0.72) return 'floor-tile-1';
  if (variantValue < 0.82) return 'floor-tile-2';
  if (variantValue < 0.90) return 'floor-tile-3';
  if (variantValue < 0.95) return 'floor-tile-4';
  if (variantValue < 0.985) return 'floor-tile-5';
  return 'floor-tile-6';
}

// Bake all 3 wall + 3 floor variants into 48x48 textures once.
// Paint helpers use centred coords (-24..24), so we position the temp
// Graphics at (24, 24) before calling generateTexture so the captured
// region is (0..48, 0..48).
export function bakeTileTextures(scene) {
  const bake = (key, paint, variantIdx) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    g.translateCanvas(TILE_SIZE / 2, TILE_SIZE / 2);
    paint(g, variantIdx);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  };

  for (let i = 0; i < 3; i++) bake(`wall-tile-${i}`, paintWallTile, i);
  for (let i = 0; i < 7; i++) bake(`floor-tile-${i}`, paintFloorTile, i);
}

export function drawWallTile(scene, x, y, rng) {
  const g = scene.add.graphics();
  const v = rng();
  const idx = v < 0.5 ? 0 : v < 0.8 ? 1 : 2;
  paintWallTile(g, idx);
  g.x = x;
  g.y = y;
  return g;
}

export function drawFloorTile(scene, x, y, rng) {
  const g = scene.add.graphics();
  const v = rng();
  const idx =
    v < 0.55 ? 0 :
    v < 0.72 ? 1 :
    v < 0.82 ? 2 :
    v < 0.90 ? 3 :
    v < 0.95 ? 4 :
    v < 0.985 ? 5 : 6;
  paintFloorTile(g, idx);
  g.x = x;
  g.y = y;
  return g;
}

function paintBossFloorTile(g, variantIdx) {
  g.fillStyle(0x0a0604, 1);
  g.fillRect(-24, -24, 48, 48);
  g.fillStyle(0x1a1208, 1);
  g.fillRect(-23, -23, 46, 46);
  g.fillStyle(0x4a3828, 1);
  g.fillRect(-22, -22, 44, 44);
  g.fillStyle(0x6a5440, 1);
  g.fillRect(-22, -22, 44, 2);
  g.fillRect(-22, -22, 2, 44);
  g.fillStyle(0x3a2818, 1);
  g.fillRect(-22, 20, 44, 2);
  g.fillRect(20, -22, 2, 44);

  if (variantIdx === 1) {
    g.fillStyle(0x1a0e06, 1);
    g.fillRect(-12, -10, 2, 2);
    g.fillRect(-10, -8,  2, 2);
    g.fillRect(-8,  -6,  2, 3);
    g.fillRect(-6,  -3,  2, 3);
    g.fillRect(-4,   0,  2, 3);
    g.fillRect(-2,   3,  2, 3);
    g.fillRect(0,    6,  2, 3);
    g.fillRect(2,    9,  2, 2);
  } else if (variantIdx === 2) {
    g.fillStyle(0x2a3d10, 1);
    g.fillRect(-22, 8,  8, 14);
    g.fillRect(-14, 14, 6, 8);
    g.fillStyle(0x3d5c18, 1);
    g.fillRect(-20, 10, 5, 10);
    g.fillRect(-12, 16, 4, 5);
    g.fillStyle(0x5a8020, 1);
    g.fillRect(-19, 11, 3, 6);
    g.fillRect(-11, 17, 2, 3);
    g.fillStyle(0x7ab030, 1);
    g.fillRect(-18, 12, 2, 2);
    g.fillStyle(0x2a3d10, 1);
    g.fillRect(14, -22, 6, 8);
    g.fillStyle(0x3d5c18, 1);
    g.fillRect(15, -21, 4, 6);
    g.fillStyle(0x5a8020, 1);
    g.fillRect(16, -20, 2, 3);
  } else if (variantIdx === 3) {
    g.fillStyle(0x2a1408, 1);
    g.fillRect(-7, -8, 14, 2);
    g.fillRect(-7, -8, 2, 16);
    g.fillRect( 5, -8, 2, 16);
    g.fillRect(-7,  6, 14, 2);
    g.fillRect(-1, -4, 2, 12);
    g.fillRect(-4,  0, 8,  2);
    g.fillStyle(0xcc6600, 1);
    g.fillRect(-6, -7, 12, 1);
    g.fillRect(-6, -7, 1, 14);
    g.fillRect( 5, -7, 1, 14);
    g.fillRect(-6,  6, 12, 1);
    g.fillRect( 0, -3, 1, 10);
    g.fillRect(-3,  1, 6,  1);
    g.fillStyle(0xffaa33, 1);
    g.fillRect(-6, -7, 1, 1);
    g.fillRect( 5, -7, 1, 1);
    g.fillRect(-6,  6, 1, 1);
    g.fillRect( 5,  6, 1, 1);
  }
}

export function bakeBossFloorTextures(scene) {
  const bake = (key, variantIdx) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    g.translateCanvas(TILE_SIZE / 2, TILE_SIZE / 2);
    paintBossFloorTile(g, variantIdx);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  };

  for (let i = 0; i < 4; i++) bake(`boss-floor-${i}`, i);
}

export function drawBossFloorTile(scene, x, y, variantIdx) {
  return scene.add.image(x, y, `boss-floor-${variantIdx}`);
}

function paintVineTuftVariant(g, seed) {
  const rng = mulberry32(seed >>> 0);
  const count = 3 + Math.floor(rng() * 4);
  const used = [];
  for (let i = 0; i < count; i++) {
    let sx;
    let tries = 0;
    do {
      sx = -13 + Math.floor(rng() * 26);
      tries++;
    } while (used.some((u) => Math.abs(u - sx) < 3) && tries < 5);
    used.push(sx);

    const len = 10 + Math.floor(rng() * 13);
    g.fillStyle(0x2a3d10);
    g.fillRect(sx, -24, 2, len);

    const lA = Math.floor(len * (0.3 + rng() * 0.2));
    g.fillStyle(0x3d5c18);
    g.fillRect(sx - 3, -24 + lA, 6, 3);
    g.fillStyle(0x5a8020);
    g.fillRect(sx - 2, -24 + lA, 4, 2);
    g.fillStyle(0x7ab030);
    g.fillRect(sx - 2, -24 + lA, 2, 1);

    if (rng() < 0.75) {
      const lB = Math.floor(len * (0.65 + rng() * 0.2));
      g.fillStyle(0x3d5c18);
      g.fillRect(sx - 2, -24 + lB, 5, 3);
      g.fillStyle(0x5a8020);
      g.fillRect(sx - 1, -24 + lB, 3, 2);
      g.fillStyle(0x7ab030);
      g.fillRect(sx - 1, -24 + lB, 1, 1);
    }

    if (rng() < 0.4) {
      const lC = Math.floor(len * 0.92);
      g.fillStyle(0x3d5c18);
      g.fillRect(sx - 1, -24 + lC, 3, 2);
    }
  }
}

function paintGroundPlant(g) {
  g.fillStyle(0x2a3d10);
  g.fillRect(-2, -14, 4, 14);
  g.fillStyle(0x3d5c18);
  g.fillRect(-1, -13, 2, 12);
  g.fillStyle(0x5a8020);
  g.fillRect(-1, -13, 1, 5);

  g.fillStyle(0x2a3d10);
  g.fillRect(-12, -10, 9, 3);
  g.fillRect(-9, -13, 4, 4);
  g.fillStyle(0x3d5c18);
  g.fillRect(-11, -9, 7, 2);
  g.fillRect(-8, -12, 2, 3);
  g.fillStyle(0x7ab030);
  g.fillRect(-10, -8, 3, 1);

  g.fillStyle(0x2a3d10);
  g.fillRect(3, -10, 9, 3);
  g.fillRect(5, -13, 4, 4);
  g.fillStyle(0x3d5c18);
  g.fillRect(4, -9, 7, 2);
  g.fillRect(6, -12, 2, 3);
  g.fillStyle(0x7ab030);
  g.fillRect(7, -8, 3, 1);
}

function paintBones(g) {
  g.fillStyle(0xe8dcc0);
  g.fillRect(-14, -3, 12, 2);
  g.fillRect(-15, -4, 1, 1);
  g.fillRect(-15, -1, 1, 1);
  g.fillRect(-2, -4, 1, 1);
  g.fillRect(-2, -1, 1, 1);
  g.fillStyle(0xc8b89c);
  g.fillRect(-14, -1, 12, 1);

  g.fillStyle(0xe8dcc0);
  g.fillRect(-6, 7, 14, 2);
  g.fillRect(-7, 6, 1, 1);
  g.fillRect(-7, 9, 1, 1);
  g.fillRect(8, 6, 1, 1);
  g.fillRect(8, 9, 1, 1);
  g.fillStyle(0xc8b89c);
  g.fillRect(-6, 9, 14, 1);

  g.fillStyle(0xe8dcc0);
  g.fillRect(2, -11, 9, 7);
  g.fillRect(3, -12, 7, 1);
  g.fillStyle(0xc8b89c);
  g.fillRect(2, -5, 9, 1);
  g.fillStyle(0x2a1808);
  g.fillRect(3, -9, 2, 2);
  g.fillRect(8, -9, 2, 2);
  g.fillRect(5, -6, 3, 1);
  g.fillStyle(0xfff8e0);
  g.fillRect(2, -11, 1, 1);
  g.fillRect(3, -12, 1, 1);
}

function paintBrokenPot(g) {
  g.fillStyle(0x4a2008);
  g.fillRect(-12, 0, 24, 11);
  g.fillStyle(0x8a3818);
  g.fillRect(-11, 1, 22, 9);
  g.fillStyle(0xb04828);
  g.fillRect(-11, 1, 22, 3);
  g.fillStyle(0xc85838);
  g.fillRect(-11, 1, 22, 1);
  g.fillStyle(0x1a0a04);
  g.fillRect(-9, 3, 18, 5);

  g.fillStyle(0x4a2008);
  g.fillRect(8, -9, 8, 7);
  g.fillStyle(0xa84830);
  g.fillRect(9, -8, 6, 5);
  g.fillStyle(0xc85838);
  g.fillRect(9, -8, 6, 1);

  g.fillStyle(0x4a2008);
  g.fillRect(-14, -3, 5, 4);
  g.fillStyle(0x8a3818);
  g.fillRect(-13, -2, 3, 2);
}

function paintSandPile(g) {
  g.fillStyle(0x6a4828);
  g.fillEllipse(0, 6, 32, 10);
  g.fillStyle(0x8a6c42);
  g.fillEllipse(0, 4, 26, 9);
  g.fillStyle(0xc8a070);
  g.fillEllipse(0, 2, 20, 7);
  g.fillStyle(0xe0bc8c);
  g.fillEllipse(0, 0, 12, 4);
  g.fillStyle(0xf0d8a8);
  g.fillEllipse(0, -1, 5, 2);
}

function paintScarab(g) {
  g.fillStyle(0x0a0a0a);
  g.fillEllipse(0, 1, 20, 16);
  g.fillStyle(0x1a1a1a);
  g.fillEllipse(0, 0, 18, 14);
  g.fillStyle(0x2a2a2a);
  g.fillRect(-7, -5, 6, 10);
  g.fillRect(1, -5, 6, 10);
  g.fillStyle(0x0a0a0a);
  g.fillRect(-1, -6, 2, 12);

  g.fillStyle(0x1a1a1a);
  g.fillRect(-13, -4, 5, 1);
  g.fillRect(-13, 0, 5, 1);
  g.fillRect(-13, 4, 5, 1);
  g.fillRect(8, -4, 5, 1);
  g.fillRect(8, 0, 5, 1);
  g.fillRect(8, 4, 5, 1);

  g.fillStyle(0x2a2a2a);
  g.fillEllipse(0, -8, 8, 5);
  g.fillStyle(0xd4a000);
  g.fillRect(-2, -9, 1, 1);
  g.fillRect(1, -9, 1, 1);

  g.fillStyle(0x4a4a4a);
  g.fillRect(-4, -3, 2, 1);
  g.fillRect(3, -3, 2, 1);
}

function paintGlyphChip(g) {
  g.fillStyle(0x4a2e14);
  g.fillRect(-9, -12, 18, 24);
  g.fillStyle(0x6a4828);
  g.fillRect(-9, -12, 18, 1);
  g.fillRect(-9, -12, 1, 24);
  g.fillStyle(0x2a1808);
  g.fillRect(-9, 11, 18, 1);
  g.fillRect(8, -12, 1, 24);

  g.fillStyle(0x1a0a04);
  g.fillRect(-3, -10, 6, 1);
  g.fillRect(-1, -10, 2, 5);
  g.fillRect(-4, -7, 8, 1);

  g.fillRect(-5, -2, 10, 1);
  g.fillRect(-5, -2, 1, 3);
  g.fillRect(4, -2, 1, 3);
  g.fillRect(-2, 0, 1, 1);
  g.fillRect(2, 0, 1, 1);

  g.fillRect(-5, 6, 10, 1);
  g.fillRect(-5, 8, 10, 1);
  g.fillRect(-3, 7, 1, 1);
  g.fillRect(2, 7, 1, 1);

  g.fillStyle(0x6a4828);
  g.fillRect(-3, -10, 1, 1);
  g.fillRect(-5, -2, 1, 1);
  g.fillRect(-5, 6, 1, 1);
}

export function drawBones(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.bones);
}

export function drawBrokenPot(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.pot);
}

export function drawSandPile(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.sandPile);
}

export function drawScarab(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.scarab);
}

export function drawGlyphChip(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.glyph);
}

export function pickDecor(rngVal, wallAbove) {
  if (wallAbove) {
    if (rngVal < 0.60) return 'vine';
    if (rngVal < 0.75) return 'bones';
    if (rngVal < 0.90) return 'glyph';
    return 'pot';
  }
  if (rngVal < 0.35) return 'plant';
  if (rngVal < 0.55) return 'bones';
  if (rngVal < 0.70) return 'pot';
  if (rngVal < 0.85) return 'sandPile';
  if (rngVal < 0.95) return 'scarab';
  return 'glyph';
}

export function drawVineTuft(scene, x, y, rng) {
  const v = rng ? rng() : 0;
  const idx = v < 0.34 ? 0 : v < 0.67 ? 1 : 2;
  return scene.add.image(x, y, `decor-vine-${idx}`);
}

export function drawGroundPlant(scene, x, y) {
  return scene.add.image(x, y, DECOR_KEYS.plant);
}

export const DECOR_KEYS = {
  vine: 'decor-vine-0',
  plant: 'decor-plant',
  flameNozzle: 'decor-flame-nozzle',
  spikeBase: 'decor-spike-base',
  spike: 'decor-spike',
  mummy: 'decor-mummy',
  bones: 'decor-bones',
  pot: 'decor-pot',
  sandPile: 'decor-sand-pile',
  scarab: 'decor-scarab',
  glyph: 'decor-glyph',
};

const DECOR_BAKE_SIZE = 64;

export function bakeDecorTextures(scene) {
  const bake = (key, paint) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    g.translateCanvas(DECOR_BAKE_SIZE / 2, DECOR_BAKE_SIZE / 2);
    paint(g);
    g.generateTexture(key, DECOR_BAKE_SIZE, DECOR_BAKE_SIZE);
    g.destroy();
  };
  bake('decor-vine-0', (g) => paintVineTuftVariant(g, 0x10F1));
  bake('decor-vine-1', (g) => paintVineTuftVariant(g, 0x20F2));
  bake('decor-vine-2', (g) => paintVineTuftVariant(g, 0x30F3));
  bake(DECOR_KEYS.plant, paintGroundPlant);
  bake(DECOR_KEYS.flameNozzle, paintFlameNozzle);
  bake(DECOR_KEYS.spikeBase, paintSpikeBase);
  bake(DECOR_KEYS.spike, paintSpike);
  bake(DECOR_KEYS.mummy, paintMummy);
  bake(DECOR_KEYS.bones, paintBones);
  bake(DECOR_KEYS.pot, paintBrokenPot);
  bake(DECOR_KEYS.sandPile, paintSandPile);
  bake(DECOR_KEYS.scarab, paintScarab);
  bake(DECOR_KEYS.glyph, paintGlyphChip);
}

export function drawLavaGlow(scene, x, y, w, h) {
  const g = scene.add.graphics();
  g.fillStyle(0xff6600, 0.10);
  g.fillEllipse(0, 0, w, h);
  g.fillStyle(0xff6600, 0.14);
  g.fillEllipse(0, 0, w * 0.75, h * 0.78);
  g.fillStyle(0xff8800, 0.18);
  g.fillEllipse(0, 0, w * 0.5, h * 0.55);
  g.fillStyle(0xffaa33, 0.22);
  g.fillEllipse(0, 0, w * 0.3, h * 0.35);
  g.x = x;
  g.y = y;
  return g;
}

export function drawLavaChannel(scene, x, y, height, opts = {}) {
  const width = opts.width ?? 8;
  const midCrack = opts.midCrack ?? true;
  const g = scene.add.graphics();
  g.x = x;
  g.y = y;

  const top = -height / 2;
  const half = width / 2;
  const crackY = top + Math.floor(height * 0.4);

  let frame = 0;

  const render = (f) => {
    g.clear();

    g.fillStyle(0x882200, 1);
    g.fillRect(-half - 1, top, width + 2, height);

    g.fillStyle(0xcc3300, 1);
    g.fillRect(-half, top, width, height);

    g.fillStyle(0xff5500, 1);
    g.fillRect(-half + 1, top, width - 2, height);

    if (width >= 6) {
      g.fillStyle(0xff8800, 1);
      g.fillRect(-half + 2, top, width - 4, height);
    }

    if (width >= 7) {
      const innerHalf = Math.max(1, Math.floor((width - 5) / 2));
      g.fillStyle(0xffcc33, 1);
      g.fillRect(-innerHalf, top, innerHalf * 2 + 1, height);
    }

    g.fillStyle(0x882200, 1);
    g.fillRect(-half - 2, top, width + 4, 4);
    g.fillStyle(0xcc3300, 1);
    g.fillRect(-half - 1, top, width + 2, 6);
    g.fillStyle(0xff5500, 1);
    g.fillRect(-half, top, width, 8);
    g.fillStyle(0xffcc33, 1);
    g.fillRect(-half + 1, top + 1, width - 2, 5);
    g.fillStyle(0xffe680, 1);
    g.fillRect(-1, top + 1, 2, 4);

    if (midCrack) {
      g.fillStyle(0x882200, 1);
      g.fillRect(-half - 2, crackY, width + 4, 10);
      g.fillStyle(0xcc3300, 1);
      g.fillRect(-half - 1, crackY + 1, width + 2, 8);
      g.fillStyle(0xff5500, 1);
      g.fillRect(-half, crackY + 1, width, 8);
      g.fillStyle(0xff8800, 1);
      g.fillRect(-half + 1, crackY + 2, width - 2, 6);
      g.fillStyle(0xffcc33, 1);
      g.fillRect(-half + 2, crackY + 2, width - 4, 6);
      g.fillStyle(0xffe680, 1);
      g.fillRect(-1, crackY + 3, 2, 4);
    }

    g.fillStyle(0xffe680, 1);
    const segLen = 6;
    const gap = 10;
    const cycle = segLen + gap;
    const scrollOffset = (f * 3) % cycle;
    for (let sy = top + 2 - scrollOffset; sy < top + height - 4; sy += cycle) {
      const segStart = Math.max(top + 2, sy);
      const segEnd = Math.min(top + height - 4, sy + segLen);
      if (segEnd > segStart) {
        g.fillRect(-1, segStart, 2, segEnd - segStart);
      }
    }

    const bottom = top + height;
    g.fillStyle(0xff5500, 1);
    g.fillRect(-half - 1, bottom - 4, width + 2, 4);
    g.fillStyle(0xff8800, 1);
    g.fillRect(-half, bottom - 3, width, 3);
    g.fillStyle(0xffcc33, 1);
    g.fillRect(-half + 1, bottom - 2, width - 2, 2);
    g.fillStyle(0xffe680, 1);
    g.fillRect(-1, bottom - 2, 2, 2);
  };

  render(0);

  scene.time.addEvent({
    delay: 120,
    loop: true,
    callback: () => {
      if (!g.scene) return;
      frame++;
      render(frame);
    },
  });

  return g;
}

export function drawLavaPool(scene, x, y, w = 90, h = 22) {
  const g = scene.add.graphics();
  g.x = x;
  g.y = y;

  let frame = 0;

  const render = (f) => {
    g.clear();
    const pulse = (f % 2 === 0) ? 0 : 1;

    g.fillStyle(0xff5500, 0.35);
    g.fillEllipse(0, 0, w + 20, h + 10);
    g.fillStyle(0xff6600, 0.5);
    g.fillEllipse(0, 0, w + 8, h + 4);

    g.fillStyle(0x882200, 1);
    g.fillEllipse(0, 0, w, h);
    g.fillStyle(0xcc3300, 1);
    g.fillEllipse(0, 0, w - 4, h - 2);
    g.fillStyle(0xff5500, 1);
    g.fillEllipse(0, 0, w - 10, h - 5);
    g.fillStyle(0xff8800, 1);
    g.fillEllipse(0, 0, w - 18, h - 8);
    g.fillStyle(0xffcc33, 1);
    g.fillEllipse(0, 0, w - 28 - pulse, h - 12);
    g.fillStyle(0xffe680, 1);
    g.fillEllipse(0, -1, w - 40 - pulse * 2, h - 16);
  };

  render(0);

  scene.time.addEvent({
    delay: 180,
    loop: true,
    callback: () => {
      if (!g.scene) return;
      frame++;
      render(frame);
    },
  });

  return g;
}

export function drawPillar(scene, x, y) {
  const g = scene.add.graphics();

  g.fillStyle(0x1a1208);
  g.fillRect(-48, -48, 96, 96);
  g.fillStyle(0x3a2a14);
  g.fillRect(-46, -46, 92, 92);
  g.fillStyle(0x7a6040);
  g.fillRect(-44, -44, 88, 88);
  g.fillStyle(0xa08050);
  g.fillRect(-44, -44, 88, 6);
  g.fillRect(-44, -44, 6, 88);

  g.fillStyle(0x1a1208);
  g.fillRect(-48, -48, 96, 10);
  g.fillStyle(0x3a2a14);
  g.fillRect(-46, -46, 92, 8);
  g.fillStyle(0x8a7050);
  g.fillRect(-44, -44, 88, 6);
  g.fillStyle(0xb09060);
  g.fillRect(-44, -44, 88, 2);

  g.fillStyle(0x1a1208);
  g.fillRect(-48, 38, 96, 10);
  g.fillStyle(0x3a2a14);
  g.fillRect(-46, 40, 92, 8);
  g.fillStyle(0x8a7050);
  g.fillRect(-44, 42, 88, 6);

  g.fillStyle(0x2a1e0c);
  g.fillRect(-18, -34, 4, 68);
  g.fillStyle(0x5a4428);
  g.fillRect(-17, -34, 2, 68);
  g.fillStyle(0x2a1e0c);
  g.fillRect(14, -34, 4, 68);
  g.fillStyle(0x5a4428);
  g.fillRect(15, -34, 2, 68);
  g.fillStyle(0x5a4428);
  g.fillRect(-2, -34, 2, 68);

  g.fillStyle(0x2a1e0c);
  g.fillRect(4, -20, 1, 12);
  g.fillRect(4, -8, 8, 1);
  g.fillRect(12, -8, 1, 6);

  g.x = x;
  g.y = y;
  return g;
}

const RUNE_COLORS = [0x00ffff, 0xff00ff, 0xff2030, 0x39ff14];

const RUNE_GLYPHS = [
  (g, cx, cy) => { g.lineBetween(cx, cy - 6, cx, cy + 6); },
  (g, cx, cy) => { g.lineBetween(cx - 5, cy - 6, cx + 5, cy + 6); g.lineBetween(cx + 5, cy - 6, cx - 5, cy + 6); },
  (g, cx, cy) => { g.lineBetween(cx - 4, cy - 6, cx - 4, cy + 6); g.lineBetween(cx + 4, cy - 6, cx + 4, cy + 6); g.lineBetween(cx - 4, cy - 2, cx + 4, cy + 2); },
  (g, cx, cy) => { g.lineBetween(cx + 3, cy - 6, cx - 3, cy); g.lineBetween(cx - 3, cy, cx + 3, cy + 6); },
  (g, cx, cy) => { g.lineBetween(cx, cy - 6, cx, cy + 6); g.lineBetween(cx, cy - 6, cx - 4, cy - 2); g.lineBetween(cx, cy - 6, cx + 4, cy - 2); },
  (g, cx, cy) => { g.lineBetween(cx - 5, cy + 6, cx - 5, cy - 6); g.lineBetween(cx + 5, cy + 6, cx + 5, cy - 6); g.lineBetween(cx - 5, cy - 6, cx, cy + 2); g.lineBetween(cx + 5, cy - 6, cx, cy + 2); },
  (g, cx, cy) => { g.lineBetween(cx - 4, cy - 6, cx - 4, cy + 6); g.lineBetween(cx - 4, cy - 6, cx + 3, cy - 3); g.lineBetween(cx + 3, cy - 3, cx - 4, cy); g.lineBetween(cx - 4, cy, cx + 4, cy + 6); },
  (g, cx, cy) => { g.lineBetween(cx, cy - 6, cx, cy + 6); g.lineBetween(cx, cy - 3, cx + 5, cy - 6); g.lineBetween(cx, cy + 1, cx + 5, cy - 2); },
];

export function drawPillarRunes(scene, x, y, seed) {
  const rng = mulberry32((seed >>> 0) || 0xDEADBEEF);
  const g = scene.add.graphics();

  const count = 2 + Math.floor(rng() * 3);
  const topY = -28;
  const botY = 28;
  const step = (botY - topY) / count;

  for (let i = 0; i < count; i++) {
    const cy = topY + step * (i + 0.5);
    const side = rng() < 0.5 ? -1 : 1;
    const cx = side * 28 + Math.floor((rng() - 0.5) * 4);
    const color = RUNE_COLORS[Math.floor(rng() * RUNE_COLORS.length)];
    const glyph = RUNE_GLYPHS[Math.floor(rng() * RUNE_GLYPHS.length)];

    g.fillStyle(color, 0.10);
    g.fillCircle(cx, cy, 11);
    g.fillStyle(color, 0.18);
    g.fillCircle(cx, cy, 8);
    g.fillStyle(color, 0.30);
    g.fillCircle(cx, cy, 5);

    g.lineStyle(2, color, 1);
    glyph(g, cx, cy);
  }

  g.x = x;
  g.y = y;

  scene.tweens.add({
    targets: g,
    alpha: { from: 0.55, to: 1 },
    duration: 900 + Math.floor(rng() * 500),
    delay: Math.floor(rng() * 600),
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return g;
}
