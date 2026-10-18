import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { LEVEL_CONFIGS, generateLevel, criticalPath, isFair } from '../lib/generator.js';
import { CHARACTER_CONFIGS, drawChest, drawKey } from '../lib/graphics.js';
import { P, LIGHT } from '../lib/palette.js';
import { drawChamber, planDecor } from '../lib/environment.js';
import {
  DEPTH,
  createFlameTrap,
  createSpikeTrap,
  createBladeTrap,
  createMummyVisual,
  setMummyFacing,
  setMummyAlert,
} from '../lib/hazards.js';
import { createHero } from '../lib/hero.js';
import { createWorldFx, flash, hitStop, iris, shake } from '../lib/fx.js';
import { TEXT } from '../lib/ui.js';
import { hudKeySlotPos } from './Hud.js';
import { showDpad, wireDpad, unwireDpad } from '../lib/dpad.js';

const T = TILE_SIZE;
const centre = (n) => n * T + T / 2;

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  init(data) {
    this.levelIndex = data && data.level !== undefined ? data.level : 0;
    this.flameRects = [];
    this.bladeZones = [];
    this.mummyList = [];
    this._bladeTweens = [];
    this._mummyGraphics = [];
    this.spikeRects = [];
    this._winTriggered = false;
    this._dying = false;
    this.keysCollected = 0;
    this.pipMoving = false;
  }

  create() {
    if (this.levelIndex >= LEVEL_CONFIGS.length) {
      this.scene.start("WinScene", { level: this.levelIndex - 1 });
      return;
    }

    let levelSeeds = this.game.registry.get("levelSeeds");
    if (!levelSeeds) {
      levelSeeds = Array(LEVEL_CONFIGS.length).fill(null);
      this.game.registry.set("levelSeeds", levelSeeds);
    }
    if (levelSeeds[this.levelIndex] === null) {
      levelSeeds[this.levelIndex] = Math.floor(Math.random() * 2 ** 32);
      this.game.registry.set("levelSeeds", levelSeeds);
    }

    const levelSeed = levelSeeds[this.levelIndex];
    this.currentLevel = generateLevel(this.levelIndex, levelSeed);
    const levelData = this.currentLevel;
    this.map = levelData.map;
    this.requiredKeys = levelData.key2 ? 2 : 1;
    this.keyState = [levelData.key, ...(levelData.key2 ? [levelData.key2] : [])].map((k) => ({
      col: k.col, row: k.row, sprite: null, pulseTween: null, light: null, collected: false,
    }));

    this.startCol = 0;
    this.startRow = 0;
    let exit = null;
    this.map.forEach((row, r) => row.forEach((tile, c) => {
      if (tile === 2) { this.startCol = c; this.startRow = r; }
      if (tile === 3) exit = { col: c, row: r };
    }));
    if (this.startCol === 0 && this.startRow === 0 && this.map[0][0] !== 2) {
      console.warn(`Level ${this.levelIndex}: no start tile (2) found in map — defaulting to [0,0]`);
    }

    this.lights.enable().setAmbientColor(LIGHT.AMBIENT);
    this.fx = createWorldFx(this);

    // Static layer: walls, floor, AO and decor baked into one lit image.
    const avoid = criticalPath(this.map, { col: this.startCol, row: this.startRow },
      levelData.key, levelData.key2, exit || levelData.key);
    (levelData.traps || []).forEach((t) => {
      if (t.type === 'mummy') {
        for (let c = t.patrolCols[0]; c <= t.patrolCols[1]; c++) avoid.add(`${c},${t.row}`);
      } else avoid.add(`${t.col},${t.row}`);
    });
    this.keyState.forEach((k) => avoid.add(`${k.col},${k.row}`));
    drawChamber(this, this.map, levelSeed, { decor: planDecor(this.map, levelSeed, avoid) })
      .setLighting(true).setDepth(0);

    if (exit) this.createChest(exit);

    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this.pipMoving = false;
    this.pipFacing = "down";
    this.playerKey = this.game.registry.get("character") || "pip";
    this.playerAnimKey = (CHARACTER_CONFIGS[this.playerKey] || CHARACTER_CONFIGS.pip).animKey;

    this.hero = createHero(this, centre(this.startCol), centre(this.startRow), undefined,
      { depth: DEPTH.hero, fx: this.fx });
    this.pip = this.hero.sprite;
    this.pip.play(`${this.playerAnimKey}-idle-down`);
    this.torch = this.lights.addLight(this.pip.x, this.pip.y, 230, LIGHT.TORCH, 1.5);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, 40 * T, 15 * T);
    cam.startFollow(this.pip, true, 1, 1);
    cam.filters.external.addVignette(0.5, 0.5, 1.0, 0.25, P.INK);

    const activePlayer = this.game.registry.get('activePlayer');
    this.scene.launch('HudScene', {
      mode: 'chamber',
      source: 'GameScene',
      title: `CHAMBER ${this.levelIndex + 1}`,
      requiredKeys: this.requiredKeys,
      collected: 0,
      player: activePlayer ? { name: activePlayer.name, coins: activePlayer.coin_balance } : null,
    });

    this.events.once("shutdown", () => {
      this.time.removeAllEvents();
      this.tweens.timeScale = 1;
      this.time.timeScale = 1;
      this.mummyList.forEach((m) => { if (m.timer) m.timer.remove(); });
      unwireDpad(this);
    });

    showDpad();

    this.validatePaths();
    this.setupInput();
    this.createTraps();
    this.createKey();
    iris(this, this.pip.x, this.pip.y, 'open', 420);
  }

  createChest({ col, row }) {
    const x = centre(col);
    const y = centre(row);
    this.chest = drawChest(this, x, y).setDepth(DEPTH.pickup);
    this.chest.enableFilters();
    const glow = this.chest.filters.internal.addGlow(P.GOLD_LIGHT, 2, 0, 1);
    this._exitPulseTween = this.tweens.add({
      targets: glow, outerStrength: 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.chestLight = this.lights.addLight(x, y, 90, LIGHT.GOLD, 0.6);
  }

  createTraps() {
    const traps = this.currentLevel.traps || [];
    traps.forEach((trap) => {
      if (trap.type === "flame") this.flameRects.push(createFlameTrap(this, trap, { fx: this.fx, lit: true }));
      if (trap.type === "blade") {
        const { zone, tween } = createBladeTrap(this, trap, { onEnter: () => this.checkBladeHazards() });
        this.bladeZones.push(zone);
        this._bladeTweens.push(tween);
      }
      if (trap.type === "mummy") this.createMummy(trap);
      if (trap.type === "spike") {
        this.spikeRects.push(createSpikeTrap(this, trap, { fx: this.fx, onActive: () => this.checkSpikeHazards() }));
      }
    });
  }

  // Key visuals: glow filter, gentle bob and a small gold light.
  placeKey(k, { fadeIn = false } = {}) {
    const x = centre(k.col);
    const y = centre(k.row);
    k.sprite = drawKey(this, x, y).setDepth(DEPTH.pickup);
    k.sprite.enableFilters();
    k.sprite.filters.internal.addGlow(P.GOLD_LIGHT, 3, 0, 1);
    k.light = this.lights.addLight(x, y, 70, LIGHT.GOLD, 0.7);
    const bob = () => {
      k.pulseTween = this.tweens.add({
        targets: k.sprite, y: y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    };
    if (fadeIn) {
      k.sprite.setAlpha(0).setScale(k.sprite.scaleX * 0.4);
      this.fx.sparkle.explode(10, x, y);
      this.tweens.add({
        targets: k.sprite, alpha: 1, scaleX: k.sprite.scaleX / 0.4, scaleY: k.sprite.scaleY / 0.4,
        duration: 500, ease: 'Back.easeOut', onComplete: bob,
      });
    } else bob();
  }

  clearKey(k) {
    if (k.pulseTween) { k.pulseTween.stop(); k.pulseTween = null; }
    if (k.sprite) { this.tweens.killTweensOf(k.sprite); k.sprite.destroy(); k.sprite = null; }
    if (k.light) { this.lights.removeLight(k.light); k.light = null; }
  }

  createKey() {
    this.placeKey(this.keyState[0]);
  }

  respawnKey(index) {
    const k = this.keyState[index];
    this.placeKey(k, { fadeIn: true });
    k.collected = false;
  }

  createMummy(trap) {
    const startX = centre(trap.col);
    const startY = centre(trap.row);

    const g = createMummyVisual(this, startX, startY);
    this._mummyGraphics.push(g);
    const alertStyle = TEXT.heading(20, P.CURSE);

    const originalSpan = trap.patrolCols[1] - trap.patrolCols[0];

    const mummyObj = {
      col: trap.col,
      row: trap.row,
      visuals: [g],
      dead: false,
      mode: 'patrol',
      direction: 1,
      moving: false,
      patrolMinCol: trap.patrolCols[0],
      patrolMaxCol: trap.patrolCols[1],
      lastSeenCol: trap.col,
      lastSeenRow: trap.row,
      timer: null,
    };
    this.mummyList.push(mummyObj);

    const switchMode = (newMode) => {
      mummyObj.timer.remove();
      mummyObj.mode = newMode;
      setMummyAlert(this, g, newMode === 'chase', { textStyle: alertStyle });
      mummyObj.timer = this.time.addEvent({
        delay: newMode === 'chase' ? 450 : 600,
        callback: tick,
        loop: true,
      });
    };

    const moveMummy = (dCol, dRow) => {
      mummyObj.col += dCol;
      mummyObj.row += dRow;
      mummyObj.moving = true;
      setMummyFacing(g, dCol);
      const duration = mummyObj.mode === 'chase' ? 300 : 400;
      this.tweens.add({
        targets: g,
        x: centre(mummyObj.col),
        y: centre(mummyObj.row),
        duration,
        ease: 'Linear',
        onComplete: () => {
          mummyObj.moving = false;
          if (this._isTileLethalForMummy(mummyObj.col, mummyObj.row)) {
            this._killMummy(mummyObj);
            return;
          }
          this.checkHazards();
        },
      });
    };

    const tick = () => {
      if (mummyObj.dead || mummyObj.moving) return;

      const visible = this._mummyHasLineOfSight(mummyObj);
      if (visible) {
        mummyObj.lastSeenCol = this.pipCol;
        mummyObj.lastSeenRow = this.pipRow;
        if (mummyObj.mode === 'patrol') {
          switchMode('chase');
          return;
        }
      }

      if (mummyObj.mode === 'chase') {
        const atLastSeen = mummyObj.col === mummyObj.lastSeenCol && mummyObj.row === mummyObj.lastSeenRow;
        if (atLastSeen && !visible) {
          // recompute patrol bounds centred on current position
          const r = mummyObj.row;
          let wallLeft = 0;
          for (let c = mummyObj.col - 1; c >= 0; c--) {
            if (this.map[r][c] === 1) { wallLeft = c; break; }
          }
          let wallRight = this.map[r].length - 1;
          for (let c = mummyObj.col + 1; c < this.map[r].length; c++) {
            if (this.map[r][c] === 1) { wallRight = c; break; }
          }
          const half = Math.floor(originalSpan / 2);
          let pMin = Math.max(mummyObj.col - half, wallLeft + 1);
          let pMax = Math.min(pMin + originalSpan, wallRight - 1);
          if (pMax < pMin) pMax = pMin;
          mummyObj.patrolMinCol = pMin;
          mummyObj.patrolMaxCol = pMax;
          switchMode('patrol');
          return;
        }
        const step = this._chaseStepMummy(mummyObj);
        if (step) moveMummy(step[0], step[1]);
      } else {
        const nextCol = mummyObj.col + mummyObj.direction;
        if (
          nextCol < mummyObj.patrolMinCol ||
          nextCol > mummyObj.patrolMaxCol ||
          this.map[mummyObj.row][nextCol] === 1
        ) {
          mummyObj.direction *= -1;
          return;
        }
        moveMummy(mummyObj.direction, 0);
      }
    };

    mummyObj.timer = this.time.addEvent({ delay: 600, callback: tick, loop: true });
  }

  _mummyHasLineOfSight(mummy) {
    const mc = mummy.col, mr = mummy.row;
    const pc = this.pipCol, pr = this.pipRow;
    if (mr !== pr && mc !== pc) return false;
    const dist = Math.abs(mr === pr ? pc - mc : pr - mr);
    if (dist > 5 || dist === 0) return false;
    if (mr === pr) {
      const step = mc < pc ? 1 : -1;
      for (let c = mc + step; c !== pc; c += step) {
        if (this.map[mr][c] === 1) return false;
      }
    } else {
      const step = mr < pr ? 1 : -1;
      for (let r = mr + step; r !== pr; r += step) {
        if (this.map[r][mc] === 1) return false;
      }
    }
    return true;
  }

  _isTileLethalForMummy(col, row) {
    for (const { rect, col: fc, row: fr } of this.flameRects) {
      if (fc === col && fr === row && rect.active) return true;
    }
    for (const { rect, col: sc, row: sr } of this.spikeRects) {
      if (sc === col && sr === row && rect.active) return true;
    }
    for (const { col: bc, row: br, active } of this.bladeZones) {
      if (bc === col && br === row && active()) return true;
    }
    return false;
  }

  _chaseStepMummy(mummy) {
    const start = `${mummy.col},${mummy.row}`;
    const goal = `${mummy.lastSeenCol},${mummy.lastSeenRow}`;
    if (start === goal) return null;
    const parent = new Map([[start, null]]);
    const queue = [[mummy.col, mummy.row]];
    // same-row neighbours first to prefer staying on patrol row when possible
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
      const [c, r] = queue.shift();
      const k = `${c},${r}`;
      if (k === goal) {
        let cur = k;
        while (parent.get(cur) !== start) cur = parent.get(cur);
        const [nc, nr] = cur.split(',').map(Number);
        return [nc - mummy.col, nr - mummy.row];
      }
      for (const [dc, dr] of dirs) {
        const nc = c + dc, nr = r + dr;
        const nk = `${nc},${nr}`;
        if (parent.has(nk)) continue;
        if (nr < 0 || nr >= this.map.length || nc < 0 || nc >= this.map[nr].length) continue;
        if (this.map[nr][nc] === 1) continue;
        if (this._isTileLethalForMummy(nc, nr) && nk !== goal) continue;
        parent.set(nk, k);
        queue.push([nc, nr]);
      }
    }
    return null;
  }

  _killMummy(mummy) {
    if (mummy.dead) return;
    mummy.dead = true;
    mummy.timer.remove();
    const g = mummy.visuals[0];
    this.tweens.killTweensOf(g);
    this.tweens.add({
      targets: g,
      alpha: 0,
      scaleY: 0.4,
      duration: 300,
      onComplete: () => g.destroy(),
    });
    this.fx.puff.explode(12, centre(mummy.col), centre(mummy.row));
    const idx = this.mummyList.indexOf(mummy);
    if (idx !== -1) this.mummyList.splice(idx, 1);
    const gIdx = this._mummyGraphics.indexOf(g);
    if (gIdx !== -1) this._mummyGraphics.splice(gIdx, 1);
  }

  // Dev guard: generateLevel only ships fair levels, so this should never fire.
  validatePaths() {
    const { fair, reason } = isFair(this.currentLevel);
    if (!fair) console.warn(`⚠ Level ${this.levelIndex + 1}: unfair layout (${reason})`);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    wireDpad(this, (dCol, dRow) => this.tryMove(dCol, dRow));
  }

  tryMove(dCol, dRow) {
    if (this.pipMoving || this._winTriggered || this._dying) return;
    const newCol = this.pipCol + dCol;
    const newRow = this.pipRow + dRow;

    if (newRow < 0 || newRow >= this.map.length) return;
    if (newCol < 0 || newCol >= this.map[newRow].length) return;

    if (this.map[newRow][newCol] === 1) return;

    if (dCol === -1) this.pipFacing = "left";
    else if (dCol === 1) this.pipFacing = "right";
    else if (dRow === -1) this.pipFacing = "up";
    else this.pipFacing = "down";

    this.pip.play(`${this.playerAnimKey}-walk-${this.pipFacing}`);
    this.hero.step();

    this.pipCol = newCol;
    this.pipRow = newRow;
    this.pipMoving = true;

    this.tweens.add({
      targets: this.pip,
      x: centre(newCol),
      y: centre(newRow),
      duration: 120,
      ease: "Linear",
      onComplete: () => {
        this.pip.play(`${this.playerAnimKey}-idle-${this.pipFacing}`);
        this.hero.land();
        this.pipMoving = false;
        this.checkHazards();
        this.checkBladeHazards();
        this.checkSpikeHazards();
        this.checkWin();
      },
    });
  }

  hud(msg) {
    this.events.emit('hud', msg);
  }

  collectKey(index) {
    const k = this.keyState[index];
    k.collected = true;
    this.keysCollected++;

    // Juice: hit-stop, sparkle burst, then the key flies to its HUD slot.
    const cam = this.cameras.main;
    const sx = k.sprite.x - cam.scrollX;
    const sy = k.sprite.y - cam.scrollY;
    this.fx.sparkle.explode(16, k.sprite.x, k.sprite.y);
    this.clearKey(k);
    hitStop(this, 60);
    flash(this, P.CREAM, 0.2, 200);

    const slot = hudKeySlotPos(index, this.requiredKeys);
    const flyer = this.add.image(sx, sy, 'key').setDisplaySize(46, 43)
      .setScrollFactor(0).setDepth(900);
    const collected = this.keysCollected;
    this.tweens.add({
      targets: flyer,
      x: slot.x,
      y: slot.y,
      displayWidth: 26,
      displayHeight: 24,
      duration: 450,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        flyer.destroy();
        this.hud({ type: 'keys', collected: Math.min(collected, this.keysCollected), required: this.requiredKeys });
      },
    });

    if (index === 0 && this.requiredKeys === 2) {
      this._revealKey2();
    }
  }

  showToast(message) {
    this.hud({ type: 'toast', text: message });
  }

  checkWin() {
    if (this._winTriggered) return;

    if (
      this.keysCollected === 0 &&
      this.pipCol === this.keyState[0].col &&
      this.pipRow === this.keyState[0].row &&
      !this.keyState[0].collected
    ) {
      this.collectKey(0);
      return;
    }

    if (
      this.requiredKeys === 2 &&
      this.keysCollected === 1 &&
      this.keyState[1] &&
      this.pipCol === this.keyState[1].col &&
      this.pipRow === this.keyState[1].row &&
      !this.keyState[1].collected
    ) {
      this.collectKey(1);
      return;
    }

    if (this.map[this.pipRow][this.pipCol] === 3) {
      if (this.keysCollected < this.requiredKeys) {
        this.showToast("Find the key first!");
        return;
      }
      this._winTriggered = true;
      this.openChest();
    }
  }

  // Chest sequence: squash-pop, gold burst + light flare, then iris out.
  openChest() {
    const x = centre(this.pipCol);
    const y = centre(this.pipRow);
    if (this._exitPulseTween) this._exitPulseTween.stop();
    if (this.chest) {
      const sx = this.chest.scaleX;
      const sy = this.chest.scaleY;
      this.tweens.chain({
        targets: this.chest,
        tweens: [
          { scaleX: sx * 1.2, scaleY: sy * 0.8, duration: 80, ease: 'Quad.easeOut' },
          { scaleX: sx * 0.9, scaleY: sy * 1.2, duration: 140, ease: 'Back.easeOut' },
          { scaleX: sx, scaleY: sy, duration: 120 },
        ],
      });
    }
    this.fx.sparkle.explode(28, x, y - 8);
    if (this.chestLight) this.tweens.add({ targets: this.chestLight, intensity: 3, radius: 200, duration: 300 });
    shake(this, 160, 0.004);
    this.time.delayedCall(350, () => {
      iris(this, x, y, 'close', 420, () => this.scene.start("WinScene", { level: this.levelIndex }));
    });
  }

  _revealKey2() {
    this.placeKey(this.keyState[1], { fadeIn: true });
  }

  resetPip() {
    this.tweens.killTweensOf(this.pip);
    flash(this, P.BLOOD, 0.22, 300);
    shake(this, 120, 0.003);
    this.pipMoving = false;
    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this._dying = true;
    const facing = this.pipFacing;
    this.pipFacing = "down";

    // Visuals catch up with the already-reset state: knockback, poof, pop in.
    this.hero.die(facing, () => {
      this.pip.play(`${this.playerAnimKey}-idle-down`);
      this.hero.respawn(centre(this.startCol), centre(this.startRow));
      this.time.delayedCall(260, () => { this._dying = false; });
    });

    if (this.keysCollected === 0) return;

    const lostIndex = this.keysCollected - 1;

    if (lostIndex === 0 && this.keyState.length > 1) {
      const k2 = this.keyState[1];
      if (k2.sprite && !k2.collected) this.clearKey(k2);
    }

    this.respawnKey(lostIndex);
    this.keysCollected--;
    this.hud({ type: 'keys', collected: this.keysCollected, required: this.requiredKeys });
  }

  checkHazards() {
    if (this._winTriggered || this._dying) return;
    for (const { rect, col, row } of this.flameRects) {
      if (rect.active && this.pipCol === col && this.pipRow === row) {
        this.resetPip();
        return;
      }
    }
    for (const mummy of this.mummyList) {
      if (!mummy.dead && this.pipCol === mummy.col && this.pipRow === mummy.row) {
        this.resetPip();
        return;
      }
    }
  }

  checkBladeHazards() {
    if (this._winTriggered || this._dying) return;
    for (const { col, row, active } of this.bladeZones) {
      if (active() && this.pipCol === col && this.pipRow === row) {
        this.resetPip();
        return;
      }
    }
  }

  checkSpikeHazards() {
    if (this._winTriggered || this._dying) return;
    for (const { rect, col, row } of this.spikeRects) {
      if (rect.active && this.pipCol === col && this.pipRow === row) {
        this.resetPip();
        return;
      }
    }
  }

  update() {
    if (!this.hero) return;
    this.hero.sync();
    this.torch.x = this.pip.x;
    this.torch.y = this.pip.y;

    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.up)
    )
      this.tryMove(0, -1);
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.down) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.down)
    )
      this.tryMove(0, 1);
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.left) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.left)
    )
      this.tryMove(-1, 0);
    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.right) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.right)
    )
      this.tryMove(1, 0);
  }
}
