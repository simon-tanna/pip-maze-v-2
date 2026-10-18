import Phaser from 'phaser';
import { LEVEL_CONFIGS } from '../lib/generator.js';
import { CHARACTER_CONFIGS, createPlayer } from '../lib/graphics.js';
import { hideDpad, showDpad } from '../lib/dpad.js';
import { P, LIGHT } from '../lib/palette.js';
import { drawTempleBackdrop } from '../lib/environment.js';
import { HAZARD_KEYS } from '../lib/hazard-art.js';
import { TEXT, createButton } from '../lib/ui.js';
import { reducedMotion } from '../lib/fx.js';

// Carousel slots by offset from the selected character.
const SLOTS = {
  [-1]: { x: 236, y: 380, height: 112, alpha: 0.45, tint: 0x8a7a80 },
  0: { x: 480, y: 360, height: 176, alpha: 1, tint: 0xffffff },
  1: { x: 724, y: 380, height: 112, alpha: 0.45, tint: 0x8a7a80 },
};

export class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  init() {
    this.inputReady = false;
    this._selectedIndex = 0;
    this._focus = 'carousel';
    this._cards = [];
  }

  create() {
    this.game.registry.set('levelSeeds', Array(LEVEL_CONFIGS.length).fill(null));
    this.game.registry.set('character', 'pip');

    hideDpad();
    this.events.once('shutdown', () => {
      this.time.removeAllEvents();
      showDpad();
    });

    this.time.delayedCall(200, () => { this.inputReady = true; });

    drawTempleBackdrop(this, { ambient: LIGHT.AMBIENT });
    this.lights.addLight(480, 330, 220, P.CREAM, 1.1);

    this.add.text(480, 98, 'DOOM MAZE', TEXT.logo(84)).setOrigin(0.5);
    this.add.text(480, 160, "PIP'S TEMPLE ADVENTURE", TEXT.label(15, P.SAND)).setOrigin(0.5);

    this._characters = [
      { key: 'pip', name: 'PIP', bio: 'Adventurer.\nDriven by the potential\nto get rich.' },
      { key: 'john', name: 'JOHN', bio: 'Former special ops officer.\nFights for whoever\npays him most.' },
      { key: 'ellen', name: 'ELLEN', bio: 'Veteran archaeologist.\nDriven to understand\nand preserve the past.' },
    ];

    this._characters.forEach((char, i) => this._cards.push(this._makeCard(char, i)));

    this._nameText = this.add.text(480, 474, '', TEXT.heading(30, P.CREAM)).setOrigin(0.5);
    this._bioText = this.add.text(480, 532, '', { ...TEXT.body(16, P.STONE_LIGHT), align: 'center' }).setOrigin(0.5);

    this._arrows = [-1, 1].map((dir) => {
      const a = this.add.image(480 + dir * 120, 360, HAZARD_KEYS.arrow).setScale(2).setAngle(dir * 90)
        .setInteractive({ useHandCursor: true });
      a.on('pointerdown', () => this._step(dir));
      if (!reducedMotion()) {
        this.tweens.add({ targets: a, x: a.x + dir * 6, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      return a;
    });

    this._prompt = this.add.text(480, 600, 'ENTER TO DESCEND', TEXT.label(14, P.FIRE_HOT)).setOrigin(0.5);
    this.tweens.add({ targets: this._prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    this._tutorialBtn = createButton(this, 384, 660, 'TUTORIAL', {
      width: 180, height: 44, size: 18,
      onClick: () => { if (this.inputReady) this.scene.start('TutorialScene', { phase: 0 }); },
    });
    this._bossBtn = createButton(this, 576, 660, 'BOSS FIGHT', {
      width: 180, height: 44, size: 18,
      onClick: () => { if (this.inputReady) this.scene.start('BossScene'); },
    });
    this._tutorialBtn.on('hover', () => this._setFocus('tutorial'));
    this._bossBtn.on('hover', () => this._setFocus('boss'));

    this._layout(false);
    this._refreshFocus();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-ENTER', () => { if (this.inputReady) this._confirm(); });
    this.input.keyboard.on('keydown-SPACE', () => { if (this.inputReady) this._confirm(); });
  }

  _makeCard(char, index) {
    const cfg = CHARACTER_CONFIGS[char.key] || CHARACTER_CONFIGS.pip;
    const plinth = this.add.graphics();
    plinth.fillStyle(P.INK, 1).fillRect(-46, -4, 92, 30);
    plinth.fillStyle(P.STONE, 1).fillRect(-44, -2, 88, 12);
    plinth.fillStyle(P.STONE_LIGHT, 1).fillRect(-44, -2, 88, 2);
    plinth.fillStyle(P.STONE_SIDE, 1).fillRect(-44, 10, 88, 14);
    plinth.fillStyle(P.STONE_DARK, 1).fillRect(-44, 16, 88, 1);
    const shadow = this.add.image(0, -6, HAZARD_KEYS.shadow).setScale(2, 1.5);
    const sprite = createPlayer(this, 0, 0, char.key).setOrigin(0.5, 1);
    sprite.play(`${cfg.animKey}-idle-down`);
    const card = this.add.container(0, 0, [plinth, shadow, sprite]);
    card.setSize(150, 220).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-75, -200, 150, 220), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    card.on('pointerdown', () => {
      if (!this.inputReady) return;
      const offset = this._offsetOf(index);
      if (offset === 0) this._confirm();
      else this._step(offset);
    });
    card.on('pointerover', () => this._setFocus('carousel'));
    return { char, cfg, card, sprite };
  }

  _offsetOf(index) {
    const n = this._characters.length;
    let off = (index - this._selectedIndex + n) % n;
    if (off > n / 2) off -= n;
    return off;
  }

  _layout(animate) {
    this._cards.forEach(({ card, sprite, cfg }, i) => {
      const slot = SLOTS[this._offsetOf(i)];
      const scale = slot.height / cfg.frameHeight;
      const props = { x: slot.x, y: slot.y + 40, alpha: slot.alpha };
      sprite.setTint(slot.tint);
      card.setDepth(slot.height);
      if (animate && !reducedMotion()) {
        this.tweens.add({ targets: card, ...props, duration: 240, ease: 'Cubic.easeOut' });
        this.tweens.add({ targets: sprite, scale, duration: 240, ease: 'Cubic.easeOut' });
      } else {
        card.setPosition(props.x, props.y).setAlpha(props.alpha);
        sprite.setScale(scale);
      }
      const selected = this._offsetOf(i) === 0;
      sprite.play(`${cfg.animKey}-${selected ? 'walk' : 'idle'}-down`, true);
    });
    const char = this._characters[this._selectedIndex];
    this._nameText.setText(char.name);
    this._bioText.setText(char.bio);
  }

  _step(dir) {
    const n = this._characters.length;
    this._selectedIndex = (this._selectedIndex + dir + n) % n;
    this._setFocus('carousel');
    this._layout(true);
  }

  _setFocus(focus) {
    this._focus = focus;
    this._refreshFocus();
  }

  _refreshFocus() {
    this._tutorialBtn.setFocused(this._focus === 'tutorial');
    this._bossBtn.setFocused(this._focus === 'boss');
    const onCarousel = this._focus === 'carousel';
    this._prompt.setVisible(onCarousel);
    this._arrows.forEach((a) => a.setAlpha(onCarousel ? 1 : 0.35));
  }

  update() {
    if (!this.inputReady) return;
    const J = Phaser.Input.Keyboard.JustDown;
    if (this._focus === 'carousel') {
      if (J(this.cursors.left)) this._step(-1);
      if (J(this.cursors.right)) this._step(1);
      if (J(this.cursors.down)) this._setFocus('tutorial');
    } else {
      if (J(this.cursors.left) || J(this.cursors.right)) {
        this._setFocus(this._focus === 'tutorial' ? 'boss' : 'tutorial');
      }
      if (J(this.cursors.up)) this._setFocus('carousel');
    }
  }

  _confirm() {
    if (this._focus === 'tutorial') {
      this.scene.start('TutorialScene', { phase: 0 });
      return;
    }
    if (this._focus === 'boss') {
      this.scene.start('BossScene');
      return;
    }
    const char = this._characters[this._selectedIndex];
    this.game.registry.set('character', char.key);
    this.scene.start('GameScene', { level: 0 });
  }
}

