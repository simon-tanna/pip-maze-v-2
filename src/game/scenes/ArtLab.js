// Dev-only asset sheet: every baked texture at 2× on one screen, for quick
// palette/readability checks. Start with: __game.scene.start('ArtLabScene')
import Phaser from 'phaser';
import { P } from '../lib/palette.js';
import { drawChamber } from '../lib/environment.js';
import {
  HAZARD_KEYS,
  SPIKE_STATE,
  NOZZLE_STATE,
  BLADE_PIVOT,
  DECOR_KINDS,
} from '../lib/hazard-art.js';
import { createHero } from '../lib/hero.js';
import { TEXT } from '../lib/ui.js';
import { hideDpad } from '../lib/dpad.js';

const FRAGMENT = [
  [1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1],
];

export class ArtLabScene extends Phaser.Scene {
  constructor() { super('ArtLabScene'); }

  create() {
    hideDpad();
    this.add.rectangle(480, 360, 960, 720, P.SHADOW);
    this.add.text(480, 24, 'TORCHLIT SANDSTONE · ASSET SHEET', TEXT.heading(22)).setOrigin(0.5);

    drawChamber(this, FRAGMENT, 7, { key: 'lab-fragment' }).setPosition(192, 52).setScale(2);

    const row = (y, label, items) => {
      this.add.text(24, y - 8, label, TEXT.label(12));
      items.forEach(([text, make], i) => {
        const x = 140 + i * 102;
        const c = this.add.container(x, y).setScale(2);
        make(c);
        this.add.text(x, y + 56, text, TEXT.label(10)).setOrigin(0.5);
      });
    };
    const img = (key) => (c) => c.add(this.add.image(0, 0, key));

    row(400, 'HAZARDS', [
      ['spike idle', img(HAZARD_KEYS.spike(SPIKE_STATE.IDLE))],
      ['spike armed', img(HAZARD_KEYS.spike(SPIKE_STATE.ARMED))],
      ['spike up', img(HAZARD_KEYS.spike(SPIKE_STATE.UP))],
      ['flame idle', img(HAZARD_KEYS.nozzle(NOZZLE_STATE.IDLE))],
      ['flame on', (c) => {
        c.add(this.add.image(0, 0, HAZARD_KEYS.nozzle(NOZZLE_STATE.HOT)));
        c.add(this.add.sprite(0, 8, HAZARD_KEYS.flame(0)).setOrigin(0.5, 1).play('hz-flame'));
      }],
      ['blade', (c) => c.add(this.add.image(0, -22, HAZARD_KEYS.blade)
        .setOrigin(BLADE_PIVOT.x, BLADE_PIVOT.y).setAngle(-20))],
      ['mummy', (c) => c.add(this.add.sprite(0, 0, HAZARD_KEYS.mummy(0, false)).play('hz-mummy-walk'))],
    ]);

    row(560, 'CHARACTERS · FX · DECOR', [
      ['mummy alert', (c) => c.add(this.add.sprite(0, 0, HAZARD_KEYS.mummy(0, true)).play('hz-mummy-chase'))],
      ['hero', (c) => {
        const rig = createHero(this, 0, 0, 'pip');
        [rig.shadow, ...rig.outlines, rig.sprite].forEach((o) => { this.children.remove(o); c.add(o); });
        this.events.on('update', rig.sync);
        this.events.once('shutdown', () => this.events.off('update', rig.sync));
      }],
      ['hearts', (c) => {
        c.add(this.add.image(-8, 0, HAZARD_KEYS.heart(true)));
        c.add(this.add.image(8, 0, HAZARD_KEYS.heart(false)));
      }],
      ['sparkle · dust', (c) => {
        c.add(this.add.image(-8, 0, HAZARD_KEYS.sparkle));
        c.add(this.add.image(8, 0, HAZARD_KEYS.dust));
      }],
      ...DECOR_KINDS.map((k) => [k, img(HAZARD_KEYS.decor(k))]),
    ]);
  }
}
