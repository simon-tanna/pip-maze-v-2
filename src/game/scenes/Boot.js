import Phaser from 'phaser';
import { CHARACTER_CONFIGS } from '../lib/graphics.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
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
    });
    const loadedAnimKeys = new Set();
    Object.values(CHARACTER_CONFIGS).forEach((cfg) => {
      if (loadedAnimKeys.has(cfg.animKey)) return;
      loadedAnimKeys.add(cfg.animKey);
      this.load.image(
        `${cfg.animKey}-win`,
        `assets/sprites/${cfg.animKey}-win.png`,
      );
    });

    this.load.image("chest", "assets/sprites/chest.png");
    this.load.image("key", "assets/sprites/key.png");
  }

  create() {
    const DIRECTIONS = ["down", "right", "left", "up"];
    const registeredKeys = new Set();

    Object.values(CHARACTER_CONFIGS).forEach((cfg) => {
      if (registeredKeys.has(cfg.animKey)) return;
      registeredKeys.add(cfg.animKey);

      DIRECTIONS.forEach((dir, i) => {
        this.anims.create({
          key: `${cfg.animKey}-idle-${dir}`,
          frames: this.anims.generateFrameNumbers(cfg.animKey, { frames: [i] }),
          frameRate: 1,
          repeat: 0,
        });
        this.anims.create({
          key: `${cfg.animKey}-walk-${dir}`,
          frames: this.anims.generateFrameNumbers(cfg.animKey, {
            frames: [i, i + 4],
          }),
          frameRate: 8,
          repeat: -1,
        });
      });
    });

    const start = () => this.scene.start("TitleScene");

    // WebFont is loaded via <script> tag in index.html. If it loaded, wait for
    // the font; otherwise fall through immediately so the game still starts.
    const WebFont = window.WebFont;
    if (WebFont && typeof WebFont.load === 'function') {
      WebFont.load({
        google: { families: ["Black Ops One"] },
        active: start,
        inactive: start,
      });
    } else {
      start();
    }
  }
}
