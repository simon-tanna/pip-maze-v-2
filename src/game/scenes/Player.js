import Phaser from 'phaser';
import { hideDpad } from '../lib/dpad.js';
import {
  getAllPlayers,
  addPlayer,
  getPlayer,
  setActivePlayerName,
} from '../lib/player-db.js';

export class PlayerScene extends Phaser.Scene {
  constructor() { super('PlayerScene'); }

  init() {
    this.inputReady   = false;
    this._domEls      = [];
    this._stateTexts  = [];
    this._listRows    = [];
    this._playerOptions = [];
    this._selectIndex = 0;
    this._errorText   = null;
    this._mode        = null;
  }

  create() {
    hideDpad();
    this.time.delayedCall(200, () => { this.inputReady = true; });

    this.add.rectangle(480, 360, 960, 720, 0x0d0d0d);

    this.add.text(480, 100, 'DOOM MAZE', {
      fontFamily: '"Black Ops One", sans-serif',
      fontSize: '80px',
      color: '#cc0000',
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      shadowColor: '#440000',
      shadowFill: true,
    }).setOrigin(0.5);

    this.cursors = this.input.keyboard.createCursorKeys();

    this.events.once('shutdown', () => {
      this._clearDomEls();
      this._clearStateTexts();
      this._clearSelectList();
      if (this._errorText) { this._errorText.destroy(); this._errorText = null; }
      this.time.removeAllEvents();
    });

    const players = getAllPlayers();
    if (players.length === 0) {
      this._showNameEntry();
    } else {
      this._showPlayerSelect(players);
    }
  }

  update() {
    if (!this.inputReady || this._mode !== 'select') return;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this._selectIndex = (this._selectIndex - 1 + this._playerOptions.length) % this._playerOptions.length;
      this._refreshSelectList();
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this._selectIndex = (this._selectIndex + 1) % this._playerOptions.length;
      this._refreshSelectList();
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
      this._confirmSelect();
    }
  }

  _showNameEntry() {
    this._clearSelectList();
    this._clearDomEls();
    this._clearStateTexts();
    this._mode = 'entry';

    const sub = this.add.text(480, 215, 'ENTER YOUR NAME', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#555555',
      letterSpacing: 3,
    }).setOrigin(0.5);
    this._stateTexts.push(sub);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 16;
    input.placeholder = 'Your name…';
    input.style.cssText = [
      'background:#1a1a1a',
      'color:#fff',
      'border:2px solid #cc0000',
      'font-family:monospace',
      'font-size:24px',
      'padding:10px 16px',
      'outline:none',
      'width:280px',
      'text-align:center',
    ].join(';');

    const domEl = this.add.dom(480, 360, input);
    this._domEls.push(domEl);
    this.time.delayedCall(50, () => input.focus());

    const onKey = (e) => {
      if (e.key !== 'Enter') return;
      if (!this.inputReady) return;
      const name = input.value.trim();
      if (!name) { this._showError('Enter a name'); return; }
      if (getAllPlayers().find(p => p.name === name)) {
        this._showError('Name already taken');
        return;
      }
      addPlayer(name);
      this._confirmPlayer(name);
    };
    input.addEventListener('keydown', onKey);
    domEl.once('destroy', () => input.removeEventListener('keydown', onKey));
  }

  _showPlayerSelect(players) {
    this._clearSelectList();
    this._clearDomEls();
    this._clearStateTexts();
    this._mode = 'select';

    const sub = this.add.text(480, 215, 'SELECT PLAYER', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#555555',
      letterSpacing: 3,
    }).setOrigin(0.5);
    this._stateTexts.push(sub);

    this._playerOptions = [
      ...players.map(p => ({ type: 'player', name: p.name, coins: p.coin_balance })),
      { type: 'new' },
    ];
    this._selectIndex = 0;

    const cx   = 480;
    const topY = 310;
    const rowH = 70;

    this._playerOptions.forEach((opt, i) => {
      const y  = topY + i * rowH;
      const bg = this.add.rectangle(cx, y, 420, 54, 0x1a1a1a)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(cx, y, this._optionLabel(opt, false), {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#555555',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      bg.on('pointerover', () => {
        this._selectIndex = i;
        this._refreshSelectList();
      });
      bg.on('pointerdown', () => {
        if (!this.inputReady) return;
        this._selectIndex = i;
        this._confirmSelect();
      });

      this._listRows.push({ bg, label });
    });

    this._refreshSelectList();

    this.input.keyboard.on('keydown-ENTER', this._onEnterSelect, this);
  }

  _onEnterSelect() {
    if (!this.inputReady) return;
    this._confirmSelect();
  }

  _optionLabel(opt, active) {
    const prefix = active ? '▶  ' : '     ';
    if (opt.type === 'new') return `${prefix}NEW PLAYER`;
    return `${prefix}${opt.name}  ◉${opt.coins}`;
  }

  _refreshSelectList() {
    this._listRows.forEach(({ bg, label }, i) => {
      const active = i === this._selectIndex;
      bg.setFillStyle(active ? 0xcc0000 : 0x1a1a1a);
      label.setColor(active ? '#ffffff' : '#555555');
      label.setText(this._optionLabel(this._playerOptions[i], active));
    });
  }

  _confirmSelect() {
    const opt = this._playerOptions[this._selectIndex];
    if (opt.type === 'new') {
      this.input.keyboard.off('keydown-ENTER', this._onEnterSelect, this);
      this._showNameEntry();
    } else {
      this._confirmPlayer(opt.name);
    }
  }

  _clearSelectList() {
    this._listRows.forEach(({ bg, label }) => { bg.destroy(); label.destroy(); });
    this._listRows = [];
    this._playerOptions = [];
    this.input.keyboard.off('keydown-ENTER', this._onEnterSelect, this);
  }

  _clearDomEls() {
    this._domEls.forEach(el => el.destroy());
    this._domEls = [];
  }

  _clearStateTexts() {
    this._stateTexts.forEach(t => t.destroy());
    this._stateTexts = [];
  }

  _showError(msg) {
    if (this._errorText) this._errorText.destroy();
    this._errorText = this.add.text(480, 440, msg, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff4444',
    }).setOrigin(0.5);
    this.time.delayedCall(1500, () => {
      if (this._errorText) { this._errorText.destroy(); this._errorText = null; }
    });
  }

  _confirmPlayer(name) {
    setActivePlayerName(name);
    const player = getPlayer(name);
    this.game.registry.set('activePlayer', { name, coin_balance: player.coin_balance });
    this.scene.start('TitleScene');
  }
}
