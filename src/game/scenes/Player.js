import Phaser from 'phaser';
import { hideDpad } from '../lib/dpad.js';
import { P, LIGHT, css } from '../lib/palette.js';
import { drawTempleBackdrop } from '../lib/environment.js';
import { TEXT, FONT, createButton } from '../lib/ui.js';
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

    drawTempleBackdrop(this, { ambient: LIGHT.AMBIENT });
    this.add.text(480, 98, 'DOOM MAZE', TEXT.logo(84)).setOrigin(0.5);
    this.add.text(480, 160, "PIP'S TEMPLE ADVENTURE", TEXT.label(15, P.SAND)).setOrigin(0.5);

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

    const sub = this.add.text(480, 270, 'ENTER YOUR NAME', TEXT.label(16, P.STONE_LIGHT)).setOrigin(0.5);
    this._stateTexts.push(sub);

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 16;
    input.placeholder = 'Your name…';
    input.style.cssText = [
      `background:${css(P.SHADOW)}`,
      `color:${css(P.CREAM)}`,
      `border:3px solid ${css(P.INK)}`,
      `box-shadow:inset 0 3px 0 ${css(P.STONE_DARK)}, 0 0 0 2px ${css(P.FIRE)}`,
      `font-family:${FONT.body.replace(/"/g, "'")}`,
      'font-size:26px',
      'padding:10px 16px',
      'outline:none',
      'width:300px',
      'text-align:center',
      `caret-color:${css(P.FIRE_HOT)}`,
    ].join(';');

    const domEl = this.add.dom(480, 360, input);
    this._stateTexts.push(this.add.text(480, 412, 'PRESS ENTER TO BEGIN', TEXT.label(13, P.FIRE_HOT)).setOrigin(0.5));
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

    const sub = this.add.text(480, 236, 'SELECT PLAYER', TEXT.label(16, P.STONE_LIGHT)).setOrigin(0.5);
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
      const bg = createButton(this, cx, y, this._optionLabel(opt), {
        width: 420, height: 54, size: 22,
        onClick: () => {
          if (!this.inputReady) return;
          this._selectIndex = i;
          this._confirmSelect();
        },
      });
      bg.on('hover', () => {
        this._selectIndex = i;
        this._refreshSelectList();
      });

      this._listRows.push({ bg });
    });

    this._refreshSelectList();

    this.input.keyboard.on('keydown-ENTER', this._onEnterSelect, this);
  }

  _onEnterSelect() {
    if (!this.inputReady) return;
    this._confirmSelect();
  }

  _optionLabel(opt) {
    if (opt.type === 'new') return '+ NEW PLAYER';
    return `${opt.name.toUpperCase()}   ${opt.coins} GOLD`;
  }

  _refreshSelectList() {
    this._listRows.forEach(({ bg }, i) => bg.setFocused(i === this._selectIndex));
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
    this._listRows.forEach(({ bg }) => bg.destroy());
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
    this._errorText = this.add.text(480, 440, msg, TEXT.body(18, P.FIRE_HOT)).setOrigin(0.5);
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
