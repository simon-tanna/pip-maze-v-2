import Phaser from 'phaser';
import { CHARACTER_CONFIGS } from '../lib/graphics.js';
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

    this.load.script(
      'webfont',
      'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js',
    );
  }

  create() {
    registerCharacterAnimations(this);

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
}
