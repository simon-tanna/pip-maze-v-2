import Phaser from 'phaser';
import { LEVEL_CONFIGS } from '../lib/generator.js';
import { CHARACTER_CONFIGS, createPlayer } from '../lib/graphics.js';
import { hideDpad, showDpad } from '../lib/dpad.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  init() {
    this.inputReady = false;
    this._selectedIndex = 0;
    this._listRows = [];
    this.previewSprite = null;
    this.previewNameText = null;
    this.previewBioText = null;
  }

  create() {
    this.game.registry.set('levelSeeds', Array(LEVEL_CONFIGS.length).fill(null));
    this.game.registry.set('character', 'pip');

    hideDpad();
    this.events.once('shutdown', () => {
      this.time.removeAllEvents();
      showDpad();
      if (this.previewSprite)   this.previewSprite.destroy();
      if (this.previewNameText) this.previewNameText.destroy();
      if (this.previewBioText)  this.previewBioText.destroy();
    });

    this.time.delayedCall(200, () => { this.inputReady = true; });



    this.add.rectangle(480, 360, 960, 720, 0x0d0d0d);

    this.add.text(480, 140, 'DOOM MAZE', {
      fontFamily: '"Black Ops One", sans-serif',
      fontSize: '80px',
      color: '#cc0000',
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      shadowColor: '#440000',
      shadowFill: true,
    }).setOrigin(0.5);

    this.add.text(480, 215, 'SELECT YOUR CHARACTER', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#555555',
      letterSpacing: 3,
    }).setOrigin(0.5);

    this._characters = [
      {
        key:  'pip',
        name: 'PIP',
        bio:  'Adventurer.\nDriven by the potential\nto get rich.',
      },
      {
        key:  'john',
        name: 'JOHN',
        bio:  'Former special ops officer.\nFights for whoever\npays him most.',
      },
      {
        key:  'ellen',
        name: 'ELLEN',
        bio:  'Veteran archaeologist.\nDriven to understand\nand preserve the past.',
      },
    ];

    this._selectedIndex = 0;

    this._listRows = [];
    const listCX  = 240;
    const listTopY = 360;
    const rowH    = 80;

    this._characters.forEach((char, i) => {
      const y  = listTopY + i * rowH;
      const bg = this.add.rectangle(listCX, y, 320, 60, 0x1a1a1a).setOrigin(0.5);
      const label = this.add.text(listCX, y, char.name, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#555555',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this._listRows.push({ bg, label });
    });

    this.add.rectangle(430, 430, 2, 320, 0x333333).setOrigin(0.5);

    this.previewSprite    = null;
    this.previewNameText = null;
    this.previewBioText  = null;

    this._refreshPanel();
    this._refreshList();

    this.cursors = this.input.keyboard.createCursorKeys();

    this.input.keyboard.on('keydown-ENTER', () => {
      if (!this.inputReady) return;
      this._confirm();
    });
    this.input.keyboard.on('keydown-SPACE', () => {
      if (!this.inputReady) return;
      this._confirm();
    });

    this._tutorialBtn = this.add.text(480, 650, 'TUTORIAL', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#4a2800',
      padding: { x: 15, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this._tutorialBtn.on('pointerdown', () => {
      if (!this.inputReady) return;
      this.scene.start('TutorialScene', { phase: 0 });
    });

    this._bossBtn = this.add.text(480, 695, 'BOSS FIGHT', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ff4444',
      backgroundColor: '#330000',
      padding: { x: 15, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this._bossBtn.on('pointerdown', () => {
      if (!this.inputReady) return;
      this.scene.start('BossScene');
    });
  }

  update() {
    if (!this.inputReady) return;

    const maxIndex = this._characters.length;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this._selectedIndex = (this._selectedIndex - 1 + maxIndex + 1) % (maxIndex + 1);
      this._refreshPanel();
      this._refreshList();
      this._refreshTutorialBtn();
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this._selectedIndex = (this._selectedIndex + 1) % (maxIndex + 1);
      this._refreshPanel();
      this._refreshList();
      this._refreshTutorialBtn();
    }
  }

  _refreshList() {
    this._listRows.forEach(({ bg, label }, i) => {
      const active = (i === this._selectedIndex);
      bg.setFillStyle(active ? 0xcc0000 : 0x1a1a1a);
      label.setColor(active ? '#ffffff' : '#555555');
      label.setText((active ? '▶  ' : '     ') + this._characters[i].name);
    });
  }

  _refreshPanel() {
    if (this.previewSprite)   { this.previewSprite.destroy();   this.previewSprite = null; }
    if (this.previewNameText) { this.previewNameText.destroy(); this.previewNameText = null; }
    if (this.previewBioText)  { this.previewBioText.destroy();  this.previewBioText = null; }

    if (this._selectedIndex >= this._characters.length) return;

    const char    = this._characters[this._selectedIndex];
    const panelCX = 670;

    this.previewSprite = createPlayer(this, panelCX, 370, char.key);
    const previewCfg = CHARACTER_CONFIGS[char.key] || CHARACTER_CONFIGS.pip;
    this.previewSprite.setScale(176 / previewCfg.frameHeight);
    this.previewSprite.anims.stop();
    this.previewSprite.setFrame(0);

    this.previewNameText = this.add.text(panelCX, 460, char.name, {
      fontFamily: 'monospace',
      fontSize:   '28px',
      color:      '#ffffff',
      fontStyle:  'bold',
    }).setOrigin(0.5);

    this.previewBioText = this.add.text(panelCX, 530, char.bio, {
      fontFamily: 'monospace',
      fontSize:   '15px',
      color:      '#888888',
      align:      'center',
    }).setOrigin(0.5);
  }

  _confirm() {
    if (this._selectedIndex === this._characters.length) {
      this.scene.start('TutorialScene', { phase: 0 });
      return;
    }
    const char = this._characters[this._selectedIndex];
    this.game.registry.set('character', char.key);
    this.scene.start('GameScene', { level: 0 });
  }

  _refreshTutorialBtn() {
    if (!this._tutorialBtn) return;
    const active = (this._selectedIndex === this._characters.length);
    this._tutorialBtn.setBackgroundColor(active ? '#cc0000' : '#4a2800');
  }
}
