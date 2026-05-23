import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { LEVEL_CONFIGS } from '../lib/generator.js';
import { CHARACTER_CONFIGS } from '../lib/graphics.js';

const BALL_X = 480;
const BALL_Y = 70;
const BALL_R = 60;
const BEAM_HUES = [0, 60, 120, 200, 280, 320];
const SPARK_HUES = [0, 45, 120, 180, 270, 320];
const LIGHTNESS_STEPS = 16;

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

// Pre-bake [hueIdx][lightnessStep] colour tables once at module load.
const BEAM_COLORS = BEAM_HUES.map(h => hslToHex(h, 100, 65));
const FACET_LUT = BEAM_HUES.map(h => {
  const row = [];
  for (let i = 0; i < LIGHTNESS_STEPS; i++) {
    const lightness = 40 + (i / (LIGHTNESS_STEPS - 1)) * 30;
    row.push(hslToHex(h, 100, lightness));
  }
  return row;
});
const SPARK_COLORS = SPARK_HUES.map(h => hslToHex(h, 100, 65));

export class WinScene extends Phaser.Scene {
  constructor() { super('WinScene'); }

  init() {
    this._started = false;
    this._inputReady = false;
  }

  create(data = {}) {
    const charKey = this.game.registry.get('character') || 'pip';
    const winAnimKey = (CHARACTER_CONFIGS[charKey] && CHARACTER_CONFIGS[charKey].animKey) || 'pip';
    this.pipWinSprite = this.add.image(480, 540, `${winAnimKey}-win`);
    this.pipWinSprite.setScale((TILE_SIZE * 3) / this.pipWinSprite.height);

    // Static rope + ball: draw once, never clear.
    const staticGfx = this.add.graphics();
    staticGfx.fillStyle(0x888888, 1);
    staticGfx.fillRect(479, 0, 2, BALL_Y - BALL_R);
    staticGfx.fillStyle(0xcccccc, 1);
    staticGfx.fillCircle(BALL_X, BALL_Y, BALL_R);

    // Dynamic beams + facets only.
    this.discoGfx = this.add.graphics();

    // Sparkle particle texture (cross shape, 6×6).
    if (!this.textures.exists('win-sparkle')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 2, 6, 2);
      g.fillRect(2, 0, 2, 6);
      g.generateTexture('win-sparkle', 6, 6);
      g.destroy();
    }

    this.sparkleEmitter = this.add.particles(
      this.pipWinSprite.x,
      this.pipWinSprite.y - this.pipWinSprite.displayHeight * 0.25,
      'win-sparkle',
      {
        speed: { min: 30, max: 150 },
        angle: { min: 240, max: 300 },
        gravityY: 180,
        lifespan: 1000,
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: SPARK_COLORS,
        frequency: 80,
        quantity: 1,
      },
    );

    this.events.once('shutdown', () => {
      this.time.removeAllEvents();
      this.pipWinSprite.destroy();
      staticGfx.destroy();
      this.discoGfx.destroy();
      this.sparkleEmitter.destroy();
    });

    const { level = 0 } = data;
    const gameComplete = (level + 1) >= LEVEL_CONFIGS.length;
    this.time.delayedCall(200, () => { this._inputReady = true; });

    if (gameComplete) {
      this.add.text(480, 280, 'You completed the whole temple! 🏆', {
        fontSize: '38px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#4a2800', strokeThickness: 6,
        wordWrap: { width: 800 }, align: 'center'
      }).setOrigin(0.5);

      this.add.text(480, 400, 'Play again', {
        fontSize: '32px', color: '#fff9e6',
        stroke: '#4a2800', strokeThickness: 4
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const restart = () => {
        if (!this._inputReady || this._started) return;
        this._started = true;
        this.scene.start('TitleScene');
      };
      this.input.once('pointerdown', restart);
      this.input.keyboard.once('keydown', restart);
    } else {
      this.add.text(480, 300, 'You found the treasure!', {
        fontSize: '48px', color: '#ffd700', fontStyle: 'bold',
        stroke: '#4a2800', strokeThickness: 6
      }).setOrigin(0.5);

      this.add.text(480, 400, 'Tap to continue', {
        fontSize: '28px', color: '#fff9e6'
      }).setOrigin(0.5);

      const advance = () => {
        if (!this._inputReady || this._started) return;
        this._started = true;
        this.scene.start('GameScene', { level: level + 1 });
      };
      this.input.once('pointerdown', advance);
      this.input.keyboard.once('keydown', advance);
    }
  }

  update(time) {
    this.discoGfx.clear();

    // Coloured beams from the ball.
    for (let i = 0; i < 5; i++) {
      const angle = time * 0.0015 + (i * Math.PI * 2 / 5);
      const bx = BALL_X + Math.cos(angle) * 280;
      this.discoGfx.fillStyle(BEAM_COLORS[i % BEAM_COLORS.length], 0.08);
      this.discoGfx.fillTriangle(BALL_X, BALL_Y, bx - 40, 720, bx + 40, 720);
    }

    // Facet grid on the ball.
    const ROWS = 4, COLS = 6;
    for (let ri = 0; ri < ROWS; ri++) {
      for (let ci = 0; ci < COLS; ci++) {
        const facetIdx = ri * COLS + ci;
        const phase = (time * 0.001 + ci / COLS) % 1;
        const bright = (Math.sin(phase * Math.PI) + 1) / 2;
        const alpha = 0.4 + bright * 0.5;
        const lStep = (bright * (LIGHTNESS_STEPS - 1)) | 0;
        const fx = BALL_X + Math.cos((ci / COLS) * Math.PI * 2 + time * 0.002) * BALL_R * 0.65;
        const fy = BALL_Y + (ri - ROWS / 2 + 0.5) * (BALL_R / ROWS) * 1.4;
        this.discoGfx.fillStyle(FACET_LUT[facetIdx % BEAM_HUES.length][lStep], alpha);
        this.discoGfx.fillRect(fx - 4, fy - 4, 8, 8);
      }
    }
  }
}
