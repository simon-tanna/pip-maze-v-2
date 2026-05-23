import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { LEVEL_CONFIGS } from '../lib/generator.js';
import { CHARACTER_CONFIGS } from '../lib/graphics.js';

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

export class WinScene extends Phaser.Scene {
  constructor() { super('WinScene'); }

  create(data = {}) {
    const charKey = this.game.registry.get('character') || 'pip';
    const winAnimKey = (CHARACTER_CONFIGS[charKey] && CHARACTER_CONFIGS[charKey].animKey) || 'pip';
    this.pipWinSprite = this.add.image(480, 540, `${winAnimKey}-win`);
    this.pipWinSprite.setScale((TILE_SIZE * 3) / this.pipWinSprite.height);

    this.discoGfx    = this.add.graphics();
    this.particles   = [];
    this.lastSparkle = 0;

    this.events.once('shutdown', () => {
      this.time.removeAllEvents();
      this.pipWinSprite.destroy();
      this.discoGfx.destroy();
      this.particles = [];
    });

    const { level = 0 } = data;
    const gameComplete = (level + 1) >= LEVEL_CONFIGS.length;
    let started = false;
    let inputReady = false;
    this.time.delayedCall(200, () => { inputReady = true; });

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
        if (!inputReady) return;
        if (started) return;
        started = true;
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
        if (!inputReady) return;
        if (started) return;
        started = true;
        this.scene.start('GameScene', { level: level + 1 });
      };
      this.input.once('pointerdown', advance);
      this.input.keyboard.once('keydown', advance);
    }
  }

  update(time) {
    const BALL_X = 480;
    const BALL_Y = 70;
    const BALL_R = 60;
    const BEAM_HUES = [0, 60, 120, 200, 280, 320];

    this.discoGfx.clear();

    for (let i = 0; i < 5; i++) {
      const angle = time * 0.0015 + (i * Math.PI * 2 / 5);
      const bx    = BALL_X + Math.cos(angle) * 280;
      const hue   = BEAM_HUES[i % BEAM_HUES.length];
      this.discoGfx.fillStyle(hslToHex(hue, 100, 65), 0.08);
      this.discoGfx.fillTriangle(BALL_X, BALL_Y, bx - 40, 720, bx + 40, 720);
    }

    this.discoGfx.fillStyle(0x888888, 1);
    this.discoGfx.fillRect(479, 0, 2, BALL_Y - BALL_R);

    this.discoGfx.fillStyle(0xcccccc, 1);
    this.discoGfx.fillCircle(BALL_X, BALL_Y, BALL_R);

    const ROWS = 4, COLS = 6;
    for (let ri = 0; ri < ROWS; ri++) {
      for (let ci = 0; ci < COLS; ci++) {
        const facetIdx = ri * COLS + ci;
        const phase    = (time * 0.001 + ci / COLS) % 1;
        const bright   = (Math.sin(phase * Math.PI) + 1) / 2;
        const hue      = BEAM_HUES[facetIdx % BEAM_HUES.length];
        const alpha    = 0.4 + bright * 0.5;
        const lightness = 40 + bright * 30;
        const fx = BALL_X + Math.cos((ci / COLS) * Math.PI * 2 + time * 0.002) * BALL_R * 0.65;
        const fy = BALL_Y + (ri - ROWS / 2 + 0.5) * (BALL_R / ROWS) * 1.4;
        this.discoGfx.fillStyle(hslToHex(hue, 100, lightness), alpha);
        this.discoGfx.fillRect(fx - 4, fy - 4, 8, 8);
      }
    }

    const SPARK_HUES = [0, 45, 120, 180, 270, 320];

    if (time - this.lastSparkle > 80) {
      this.lastSparkle = time;

      const sparkX = this.pipWinSprite.x;
      const sparkY = this.pipWinSprite.y - this.pipWinSprite.displayHeight * 0.25;

      const spawn = (x, y) => {
        this.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 2 - 0.5,
          life: 1.0,
          hue: SPARK_HUES[Math.floor(Math.random() * SPARK_HUES.length)],
        });
      };
      spawn(sparkX, sparkY);
    }

    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.particles) {
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.05;
      p.life -= 0.025;

      this.discoGfx.fillStyle(hslToHex(p.hue, 100, 65), p.life);
      this.discoGfx.fillRect(p.x - 3, p.y - 1, 6, 2);
      this.discoGfx.fillRect(p.x - 1, p.y - 3, 2, 6);
    }
  }
}
