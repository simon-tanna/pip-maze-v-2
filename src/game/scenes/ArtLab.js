// Dev-only art-direction lab. Renders before/after asset sheets and a
// re-lit chamber so palette and lighting changes can be screenshotted.
// Start with: __game.scene.start('ArtLabScene', { mode: 'sheet' | 'chamber' })
import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { generateLevel } from '../lib/generator.js';
import { P, LIGHT, css } from '../lib/palette.js';
import { drawChamber } from '../lib/environment.js';
import {
  bakeHazardTextures,
  HAZARD_KEYS,
  SPIKE_STATE,
  NOZZLE_STATE,
  FLAME_FRAMES,
} from '../lib/hazard-art.js';
import {
  createPlayer,
  wallTileKey,
  floorTileKey,
  drawSpikeBase,
  drawSpike,
  drawFlameNozzle,
  createFlame,
  drawBlade,
  drawKey,
  drawChest,
} from '../lib/graphics.js';
import { tileRng } from '../lib/generator.js';
import { hideDpad } from '../lib/dpad.js';

const FRAGMENT = [
  [1, 1, 1, 1],
  [0, 0, 0, 1],
  [1, 0, 1, 1],
];

const HEADING = {
  fontFamily: '"Black Ops One", sans-serif',
  fontSize: '22px',
  color: css(P.CREAM),
};
const LABEL = { fontFamily: 'monospace', fontSize: '12px', color: css(P.STONE_LIGHT) };

export class ArtLabScene extends Phaser.Scene {
  constructor() { super('ArtLabScene'); }

  create(data = {}) {
    hideDpad();
    bakeHazardTextures(this);
    if (!this.anims.exists('hz-flame')) {
      this.anims.create({
        key: 'hz-flame',
        frames: Array.from({ length: FLAME_FRAMES }, (_, f) => ({ key: HAZARD_KEYS.flame(f) })),
        frameRate: 10,
        repeat: -1,
      });
    }
    if (data.mode === 'chamber') this._chamber();
    else this._sheet();
  }

  _sheet() {
    this.add.rectangle(480, 360, 960, 720, P.SHADOW);
    this.add.text(480, 26, 'TORCHLIT SANDSTONE', { ...HEADING, fontSize: '28px' }).setOrigin(0.5);

    // ── Environment fragment, 2× ──────────────────────────
    const T = TILE_SIZE;
    const before = this.textures.addDynamicTexture('lab-before', 4 * T, 3 * T);
    FRAGMENT.forEach((row, r) => row.forEach((tile, c) => {
      const v = tileRng(7, c, r)();
      before.stamp(tile === 1 ? wallTileKey(v) : floorTileKey(v), null, c * T, r * T, { originX: 0, originY: 0 });
    }));
    before.render();
    this.add.image(48, 80, 'lab-before').setOrigin(0).setScale(2);
    drawChamber(this, FRAGMENT, 7, 'lab-after').setPosition(528, 80).setScale(2);
    this.add.text(240, 62, 'BEFORE', LABEL).setOrigin(0.5);
    this.add.text(720, 62, 'AFTER — autotiled walls, flagstones, AO', LABEL).setOrigin(0.5);

    // ── Hazards + hero, 2× ────────────────────────────────
    const cell = (i) => 96 + i * 120;
    const rowA = 470;
    const rowB = 640;
    this.add.text(24, rowA - 70, 'BEFORE', HEADING);
    this.add.text(24, rowB - 70, 'AFTER', HEADING);

    const oldCells = [
      ['spike idle', () => drawSpikeBase(this, 0, 0)],
      ['spike up', () => { drawSpikeBase(this, 0, 0); return drawSpike(this, 0, 0); }],
      ['flame idle', () => drawFlameNozzle(this, 0, 0)],
      ['flame on', () => { drawFlameNozzle(this, 0, 0); return createFlame(this, 0, 0); }],
      ['hero', () => createPlayer(this, 0, 0, 'pip')],
    ];
    oldCells.forEach(([label, make], i) => this._cell(cell(i), rowA, label, make));

    const newCells = [
      ['spike idle', () => this.add.image(0, 0, HAZARD_KEYS.spike(SPIKE_STATE.IDLE))],
      ['spike ARMED', () => this.add.image(0, 0, HAZARD_KEYS.spike(SPIKE_STATE.ARMED))],
      ['spike up', () => this.add.image(0, 0, HAZARD_KEYS.spike(SPIKE_STATE.UP))],
      ['flame idle', () => this.add.image(0, 0, HAZARD_KEYS.nozzle(NOZZLE_STATE.IDLE))],
      ['flame WIND-UP', () => {
        this.add.image(0, 0, HAZARD_KEYS.nozzle(NOZZLE_STATE.HOT));
        [[-6, -4], [3, -10], [8, -2], [-2, -15]].forEach(([x, y]) => this.add.image(x, y, HAZARD_KEYS.ember));
      }],
      ['flame on', () => {
        this.add.image(0, 0, HAZARD_KEYS.nozzle(NOZZLE_STATE.HOT));
        this.add.sprite(0, 8, HAZARD_KEYS.flame(1)).setOrigin(0.5, 1).play('hz-flame');
      }],
      ['hero step', () => {
        const hero = createPlayer(this, 0, 0, 'pip');
        hero.setScale(hero.scaleX * 1.12, hero.scaleY * 0.88);
        [[-12, 18, 1], [-18, 15, 0.7], [-7, 20, 0.5]].forEach(([x, y, a]) =>
          this.add.image(x, y, HAZARD_KEYS.dust).setAlpha(a));
      }],
    ];
    newCells.forEach(([label, make], i) => this._cell(cell(i), rowB, label, make));
  }

  // Builds a cell's objects in a 2× container so each asset is readable.
  _cell(x, y, label, make) {
    const before = this.children.list.length;
    make();
    const created = this.children.list.slice(before);
    const box = this.add.container(x, y).setScale(2);
    created.forEach((o) => { this.children.remove(o); box.add(o); });
    this.add.text(x, y + 62, label, LABEL).setOrigin(0.5);
  }

  _chamber() {
    const seed = 44444;
    const level = generateLevel(3, seed);
    const T = TILE_SIZE;
    const centre = (c) => c * T + T / 2;

    this.lights.enable().setAmbientColor(LIGHT.AMBIENT);
    drawChamber(this, level.map, seed).setLighting(true);

    let spikeI = 0;
    let flameI = 0;
    level.traps.forEach((trap) => {
      const x = centre(trap.col);
      const y = centre(trap.row);
      if (trap.type === 'spike') {
        this.add.image(x, y, HAZARD_KEYS.spike(spikeI++ % 3));
      } else if (trap.type === 'flame') {
        const state = flameI++ % 3;
        this.add.image(x, y, HAZARD_KEYS.nozzle(state === 0 ? NOZZLE_STATE.IDLE : NOZZLE_STATE.HOT));
        if (state === 1) {
          this.lights.addLight(x, y, 90, LIGHT.FLAME, 0.8);
          this.add.particles(x, y + 8, HAZARD_KEYS.ember, {
            x: { min: -10, max: 10 }, speedY: { min: -40, max: -20 }, speedX: { min: -6, max: 6 },
            lifespan: 700, alpha: { start: 1, end: 0 }, frequency: 90,
          });
        } else if (state === 2) {
          this.lights.addLight(x, y - 12, 140, LIGHT.FLAME, 1.8);
          this.add.sprite(x, y + 8, HAZARD_KEYS.flame(0)).setOrigin(0.5, 1).play('hz-flame');
        }
      } else if (trap.type === 'blade') {
        drawBlade(this, x, trap.row * T + 2);
      }
    });

    const key = drawKey(this, centre(level.key.col), centre(level.key.row));
    key.enableFilters();
    key.filters.internal.addGlow(P.GOLD_LIGHT, 3, 0, 1);
    this.lights.addLight(key.x, key.y, 70, LIGHT.GOLD, 0.7);
    level.map.forEach((row, r) => row.forEach((tile, c) => {
      if (tile === 3) drawChest(this, centre(c), centre(r));
    }));

    const hx = centre(1);
    const hy = centre(1);
    const hero = createPlayer(this, hx, hy, 'pip').play('pip-idle-down');
    this.lights.addLight(hx, hy, 230, LIGHT.TORCH, 1.5);
    [[-10, 18, 1], [-16, 15, 0.7]].forEach(([x, y, a]) =>
      this.add.image(hx + x, hy + y, HAZARD_KEYS.dust).setAlpha(a));

    const cam = this.cameras.main;
    cam.setBounds(0, 0, 40 * T, 15 * T);
    cam.startFollow(hero, true, 1, 1);
    cam.filters.external.addVignette(0.5, 0.5, 1.0, 0.25, P.INK);

    // HUD lives on its own camera so the world vignette never darkens it.
    const hud = this.add.text(16, 10, 'CHAMBER 4', {
      ...HEADING,
      fontSize: '24px',
      stroke: css(P.INK),
      strokeThickness: 5,
    });
    const uiCam = this.cameras.add(0, 0, 960, 720);
    uiCam.ignore(this.children.list.filter((o) => o !== hud));
    cam.ignore(hud);
  }
}
