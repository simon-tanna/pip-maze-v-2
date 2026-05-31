// src/game/lib/graphics.js
// Pure pixel-art drawing functions. Each accepts a Phaser Scene, a position,
// and returns the created Graphics object. No game logic here — only fillRect calls.

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

export function drawKeyIcon(scene, x, y) {
  const img = scene.add.image(x, y, 'key');
  img.setDisplaySize(26, 24);
  return img;
}

export function drawFlameNozzle(scene, x, y) {
  const g = scene.add.graphics();
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

  g.x = x;
  g.y = y;
  return g;
}

export function drawSpikeBase(scene, x, y) {
  const g = scene.add.graphics();
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
  g.x = x;
  g.y = y;
  return g;
}

export function drawSpike(scene, x, y) {
  const g = scene.add.graphics();
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
  g.x = x;
  g.y = y;
  return g;
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

export function drawMummy(scene, x, y) {
  const g = scene.add.graphics();

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

  g.x = x;
  g.y = y;
  return g;
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
  g.fillStyle(0x8a6c42);
  g.fillRect(-21, -21, 18, 3);
  g.fillRect(-21, -21, 3, 18);

  if (variantIdx === 1) {
    g.fillStyle(0x3a2810);
    g.fillRect(-8, -6, 1, 14);
    g.fillRect(-8, -6, 8, 1);
    g.fillRect(-8, 4, 6, 1);
    g.fillRect(0, -6, 1, 7);
  } else if (variantIdx === 2) {
    g.fillStyle(0x3d5c18);
    g.fillRect(-9, -7, 18, 14);
    g.fillStyle(0x4a6820);
    g.fillRect(-7, -5, 14, 10);
    g.fillStyle(0x3a2810);
    g.fillRect(-6, -4, 12, 1);
  }
}

export function wallTileKey(variantValue) {
  if (variantValue < 0.5) return 'wall-tile-0';
  if (variantValue < 0.8) return 'wall-tile-1';
  return 'wall-tile-2';
}

export function floorTileKey(variantValue) {
  if (variantValue < 0.4) return 'floor-tile-0';
  if (variantValue < 0.75) return 'floor-tile-1';
  return 'floor-tile-2';
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
  for (let i = 0; i < 3; i++) bake(`floor-tile-${i}`, paintFloorTile, i);
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
  const idx = v < 0.4 ? 0 : v < 0.75 ? 1 : 2;
  paintFloorTile(g, idx);
  g.x = x;
  g.y = y;
  return g;
}

export function drawVineTuft(scene, x, y) {
  const g = scene.add.graphics();

  const strands = [
    { sx: -10, len: 14 },
    { sx: -4, len: 19 },
    { sx: 3, len: 12 },
    { sx: 9, len: 17 },
  ];

  strands.forEach(({ sx, len }) => {
    g.fillStyle(0x2a3d10);
    g.fillRect(sx, -24, 2, len);
    const lA = Math.floor(len * 0.4);
    g.fillStyle(0x3d5c18);
    g.fillRect(sx - 3, -24 + lA, 6, 3);
    g.fillStyle(0x5a8020);
    g.fillRect(sx - 2, -24 + lA, 4, 2);
    g.fillStyle(0x7ab030);
    g.fillRect(sx - 2, -24 + lA, 2, 1);
    const lB = Math.floor(len * 0.8);
    g.fillStyle(0x3d5c18);
    g.fillRect(sx - 2, -24 + lB, 5, 3);
    g.fillStyle(0x5a8020);
    g.fillRect(sx - 1, -24 + lB, 3, 2);
  });

  g.x = x;
  g.y = y;
  return g;
}

export function drawGroundPlant(scene, x, y) {
  const g = scene.add.graphics();

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

  g.x = x;
  g.y = y;
  return g;
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
