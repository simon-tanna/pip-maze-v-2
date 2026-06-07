import Phaser from 'phaser';
import { CHARACTER_CONFIGS, bakeTileTextures, bakeDecorTextures } from '../lib/graphics.js';
import { registerCharacterAnimations } from '../lib/animation-registry.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const loadedKeys = new Set();
    Object.values(CHARACTER_CONFIGS).forEach((cfg) => {
      if (loadedKeys.has(cfg.animKey)) return;
      loadedKeys.add(cfg.animKey);
      this.load.spritesheet(cfg.animKey, `assets/sprites/${cfg.animKey}.png`, {
        frameWidth: cfg.frameWidth,
        frameHeight: cfg.frameHeight,
      });
      this.load.image(
        `${cfg.animKey}-win`,
        `assets/sprites/${cfg.animKey}-win.png`,
      );
    });

    this.load.image('chest', 'assets/sprites/chest.png');
    this.load.image('key', 'assets/sprites/key.png');

    this.load.image('battle-troll', 'assets/sprites/battle-troll-sprites.png');

    this.load.script(
      'webfont',
      'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js',
    );
  }

  create() {
    registerCharacterAnimations(this);
    this._registerTrollFramesAndAnims();
    bakeTileTextures(this);
    bakeDecorTextures(this);

    const start = () => this.scene.start('TitleScene');

    const WebFont = window.WebFont;
    if (WebFont && typeof WebFont.load === 'function') {
      WebFont.load({
        google: { families: ['Black Ops One'] },
        active: start,
        inactive: start,
      });
    } else {
      start();
    }
  }

  _registerTrollFramesAndAnims() {
    const TROLL_FRAMES = [
      ['idle-0',   57,   72, 395, 376], ['idle-1',  491,   72, 392, 378],
      ['idle-2',  898,   72, 395, 376], ['idle-3', 1456,   71, 293, 376],
      ['idle-4', 1825,   70, 260, 370], ['idle-5', 2130,   69, 260, 370],
      ['idle-6', 2432,   70, 328, 370],
      ['walk-0',   60,  545, 353, 388], ['walk-1',  432,  552, 226, 381],
      ['walk-2',  719,  552, 300, 388], ['walk-3', 1018,  553, 319, 380],
      ['attack-0', 1446, 555, 343, 435], ['attack-1', 1890, 570, 398, 417],
      ['attack-2', 2321, 637, 338, 353],
      ['death-0',   54,  983, 353, 504], ['death-1',  482, 1028, 414, 459],
      ['death-2', 1499, 1085, 342, 403], ['death-3',  932, 1193, 385, 294],
      ['death-4', 1890, 1125, 395, 360], ['death-5', 2306, 1327, 408, 155],
    ];
    const trollTex = this.textures.get('battle-troll');
    TROLL_FRAMES.forEach(([name, x, y, w, h]) => {
      if (!trollTex.has(name)) trollTex.add(name, 0, x, y, w, h);
    });

    const TROLL_ANIMS = [
      { key: 'troll-idle',   prefix: 'idle-',   count: 7, rate: 4, repeat: -1 },
      { key: 'troll-walk',   prefix: 'walk-',   count: 4, rate: 8, repeat: -1 },
      { key: 'troll-attack', prefix: 'attack-', count: 3, rate: 8, repeat: -1 },
      { key: 'troll-death',  prefix: 'death-',  count: 6, rate: 8, repeat: 0  },
    ];
    TROLL_ANIMS.forEach(({ key, prefix, count, rate, repeat }) => {
      if (this.anims.exists(key)) return;
      const frames = [];
      for (let i = 0; i < count; i++) {
        frames.push({ key: 'battle-troll', frame: `${prefix}${i}` });
      }
      this.anims.create({ key, frames, frameRate: rate, repeat });
    });
  }
}
