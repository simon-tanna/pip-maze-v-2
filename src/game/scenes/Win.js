import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { LEVEL_CONFIGS } from '../lib/generator.js';
import { CHARACTER_CONFIGS } from '../lib/graphics.js';
import { P } from '../lib/palette.js';
import { HAZARD_KEYS } from '../lib/hazard-art.js';
import { TEXT } from '../lib/ui.js';
import { iris, reducedMotion } from '../lib/fx.js';

const HERO_X = 480;
const HERO_Y = 470;

export class WinScene extends Phaser.Scene {
  constructor() { super('WinScene'); }

  init() {
    this._started = false;
    this._inputReady = false;
  }

  create(data = {}) {
    const { level = 0 } = data;
    const gameComplete = (level + 1) >= LEVEL_CONFIGS.length;

    this.add.rectangle(480, 360, 960, 720, P.SHADOW);

    // Slowly turning gold rays behind the hero (one image, no per-frame redraw).
    const rays = this.add.image(HERO_X, HERO_Y - 40, HAZARD_KEYS.rays)
      .setScale(4.5).setTint(gameComplete ? P.FIRE : P.GOLD).setAlpha(0.32)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (!reducedMotion()) this.tweens.add({ targets: rays, angle: 360, duration: 40000, repeat: -1 });
    this.add.image(HERO_X, HERO_Y - 40, HAZARD_KEYS.glow).setScale(6).setTint(P.GOLD_LIGHT)
      .setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD);

    // Plinth.
    const plinth = this.add.graphics();
    plinth.fillStyle(P.INK, 1).fillRect(HERO_X - 92, HERO_Y + 62, 184, 44);
    plinth.fillStyle(P.STONE, 1).fillRect(HERO_X - 90, HERO_Y + 64, 180, 16);
    plinth.fillStyle(P.SAND, 1).fillRect(HERO_X - 90, HERO_Y + 64, 180, 2);
    plinth.fillStyle(P.STONE_SIDE, 1).fillRect(HERO_X - 90, HERO_Y + 80, 180, 24);
    plinth.fillStyle(P.STONE_DARK, 1).fillRect(HERO_X - 90, HERO_Y + 90, 180, 1);
    this.add.image(HERO_X, HERO_Y + 60, HAZARD_KEYS.shadow).setScale(3.5, 2);

    const charKey = this.game.registry.get('character') || 'pip';
    const winAnimKey = (CHARACTER_CONFIGS[charKey] && CHARACTER_CONFIGS[charKey].animKey) || 'pip';
    const hero = this.add.image(HERO_X, HERO_Y + 64, `${winAnimKey}-win`).setOrigin(0.5, 1);
    hero.setScale((TILE_SIZE * 3) / hero.height);
    if (!reducedMotion()) {
      this.tweens.add({
        targets: hero, scaleY: hero.scaleY * 1.03, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    this.add.particles(HERO_X, HERO_Y - 70, HAZARD_KEYS.sparkle, {
      speed: { min: 60, max: 170 },
      angle: { min: 235, max: 305 },
      gravityY: 220,
      lifespan: 1300,
      scale: { start: 1.6, end: 0.2 },
      alpha: { start: 1, end: 0 },
      frequency: reducedMotion() ? 400 : 70,
      reserve: 40,
    });

    this.time.delayedCall(200, () => { this._inputReady = true; });

    const headline = gameComplete ? 'THE FINAL CHAMBER AWAITS' : `CHAMBER ${level + 1} CLEARED`;
    this.add.text(480, 120, headline, TEXT.heading(gameComplete ? 40 : 48, gameComplete ? P.FIRE_HOT : P.GOLD_LIGHT))
      .setOrigin(0.5);
    this.add.text(480, 182, gameComplete ? 'Something stirs beneath the temple…' : 'You found the treasure!',
      TEXT.body(22, P.CREAM)).setOrigin(0.5);

    const prompt = this.add.text(480, 640, gameComplete ? 'TAP TO DESCEND' : 'TAP TO CONTINUE', TEXT.label(16, P.FIRE_HOT))
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    if (gameComplete) {
      prompt.setInteractive({ useHandCursor: true });
      const descend = () => {
        if (!this._inputReady || this._started) return;
        this._started = true;
        this.scene.start('BossScene');
      };
      this.input.once('pointerdown', descend);
      this.input.keyboard.once('keydown', descend);
    } else {
      const advance = () => {
        if (!this._inputReady || this._started) return;
        this._started = true;
        this.scene.start('GameScene', { level: level + 1 });
      };
      this.input.once('pointerdown', advance);
      this.input.keyboard.once('keydown', advance);
    }

    this.events.once('shutdown', () => this.time.removeAllEvents());
    iris(this, HERO_X, HERO_Y, 'open', 420);
  }
}
