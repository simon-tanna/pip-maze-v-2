import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
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
} from '../lib/hazards.js';
import { HAZARD_KEYS } from '../lib/hazard-art.js';
import { createHero } from '../lib/hero.js';
import { createWorldFx, flash, hitStop, iris } from '../lib/fx.js';
import { TEXT, createButton } from '../lib/ui.js';
import { TUTORIAL_CONFIGS } from '../lib/tutorial-config.js';
import { hideDpad, showDpad, unwireDpad } from '../lib/dpad.js';
import { createGridInput } from '../lib/grid-input.js';

const T = TILE_SIZE;
const centre = (n) => n * T + T / 2;
const TUTORIAL_SEED = 12345;

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super('TutorialScene');
  }

  init(data) {
    this.currentPhase = (data && data.phase) || 0;
    this.flameRects = [];
    this.bladeZones = [];
    this.mummyList = [];
    this._bladeTweens = [];
    this.spikeRects = [];
    this._winTriggered = false;
    this._dying = false;
    this.keysCollected = 0;
    this._demoRunning = false;
    this.pipMoving = false;
    this._arrow = null;
  }

  create() {
    if (this.currentPhase >= TUTORIAL_CONFIGS.length) {
      hideDpad();
      this.events.once('shutdown', () => {
        this.time.removeAllEvents();
        showDpad();
      });
      this.showOptionsScreen();
      return;
    }

    const tutorialConfig = TUTORIAL_CONFIGS[this.currentPhase];

    this.map = tutorialConfig.map;
    this.startCol = tutorialConfig.startCol;
    this.startRow = tutorialConfig.startRow;
    this.requiredKeys = 1;
    this.keyState = [{
      col: tutorialConfig.keyCol,
      row: tutorialConfig.keyRow,
      sprite: null,
      pulseTween: null,
      collected: false,
    }];
    this._tutorialInstruction = tutorialConfig.instruction;

    this.lights.enable().setAmbientColor(LIGHT.AMBIENT);
    this.fx = createWorldFx(this);

    const avoid = new Set([
      `${this.startCol},${this.startRow}`,
      `${tutorialConfig.keyCol},${tutorialConfig.keyRow}`,
      `${tutorialConfig.chestCol},${tutorialConfig.chestRow}`,
      ...tutorialConfig.traps.map((t) => `${t.col},${t.row}`),
    ]);
    drawChamber(this, this.map, TUTORIAL_SEED, {
      key: 'env-tutorial',
      decor: planDecor(this.map, TUTORIAL_SEED, avoid),
    }).setLighting(true).setDepth(0);

    const chest = drawChest(this, centre(tutorialConfig.chestCol), centre(tutorialConfig.chestRow))
      .setDepth(DEPTH.pickup);
    chest.enableFilters();
    chest.filters.internal.addGlow(P.GOLD_LIGHT, 3, 0, 1);
    this.lights.addLight(chest.x, chest.y, 90, LIGHT.GOLD, 0.6);

    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this.pipMoving = false;
    this.pipFacing = 'down';
    this.playerAnimKey = CHARACTER_CONFIGS.pip.animKey;

    this.hero = createHero(this, centre(this.startCol), centre(this.startRow), 'pip',
      { depth: DEPTH.hero, fx: this.fx });
    this.pip = this.hero.sprite;
    this.pip.play(`${this.playerAnimKey}-idle-down`);
    this.torch = this.lights.addLight(this.pip.x, this.pip.y, 230, LIGHT.TORCH, 1.5);
    this.cameras.main.filters.external.addVignette(0.5, 0.5, 1.0, 0.25, P.INK);

    this.scene.launch('HudScene', {
      mode: 'tutorial',
      source: 'TutorialScene',
      title: `TUTORIAL · ${tutorialConfig.name.toUpperCase()}`,
      requiredKeys: 1,
      collected: 0,
      instruction: this._tutorialInstruction,
    });

    hideDpad();
    this.events.once('shutdown', () => {
      this.time.removeAllEvents();
      this.tweens.timeScale = 1;
      this.time.timeScale = 1;
      showDpad();
      unwireDpad(this);
    });

    this.setupInput();
    this.createTraps();
    this.createKey();
    iris(this, this.pip.x, this.pip.y, 'open', 360);
    this.runAutoDemo();
  }

  hud(msg) {
    this.events.emit('hud', msg);
  }

  createTraps() {
    const traps = TUTORIAL_CONFIGS[this.currentPhase].traps || [];
    traps.forEach((trap) => {
      if (trap.type === 'flame') this.flameRects.push(createFlameTrap(this, trap, { fx: this.fx, lit: true }));
      if (trap.type === 'blade') {
        const { zone, tween } = createBladeTrap(this, trap, { onEnter: () => this.checkBladeHazards() });
        this.bladeZones.push(zone);
        this._bladeTweens.push(tween);
      }
      if (trap.type === 'mummy') this.createMummy(trap);
      if (trap.type === 'spike') {
        this.spikeRects.push(createSpikeTrap(this, trap, { fx: this.fx, onActive: () => this.checkSpikeHazards() }));
      }
    });
  }

  createKey() {
    const k = this.keyState[0];
    const x = centre(k.col);
    const y = centre(k.row);
    k.sprite = drawKey(this, x, y).setDepth(DEPTH.pickup);
    k.sprite.enableFilters();
    k.sprite.filters.internal.addGlow(P.GOLD_LIGHT, 3, 0, 1);
    k.light = this.lights.addLight(x, y, 70, LIGHT.GOLD, 0.7);
    k.pulseTween = this.tweens.add({
      targets: k.sprite, y: y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  createMummy(trap) {
    const g = createMummyVisual(this, centre(trap.col), centre(trap.row));
    const mummyObj = { col: trap.col, row: trap.row, visuals: [g] };
    this.mummyList.push(mummyObj);

    const [minCol, maxCol] = trap.patrolCols;
    let direction = 1;
    let mummyMoving = false;

    const stepMummy = () => {
      if (mummyMoving) return;
      const nextCol = mummyObj.col + direction;

      if (
        nextCol < minCol ||
        nextCol > maxCol ||
        this.map[mummyObj.row][nextCol] === 1
      ) {
        direction *= -1;
        return;
      }

      mummyObj.col = nextCol;
      mummyMoving = true;
      setMummyFacing(g, direction);

      this.tweens.add({
        targets: g,
        x: centre(mummyObj.col),
        duration: 400,
        ease: 'Linear',
        onComplete: () => {
          mummyMoving = false;
          this.checkHazards();
        },
      });
    };

    mummyObj.timer = this.time.addEvent({
      delay: 600,
      callback: stepMummy,
      loop: true,
    });
  }

  setupInput() {
    // The auto-demo drives tryMove directly; player input waits for it to end.
    this.gridInput = createGridInput(this, {
      move: (dCol, dRow) => !this._demoRunning && this.tryMove(dCol, dRow),
    });

    this.input.keyboard.on('keydown-ZERO', () => this.handlePrevPhase());
    this.input.keyboard.on('keydown-ONE', () => this.handleNextPhase());
    this.input.keyboard.on('keydown-X', () => this.exitTutorial());
  }

  tryMove(dCol, dRow, onMoveDone = null) {
    if (this.pipMoving || this._winTriggered || this._dying) return false;
    const newCol = this.pipCol + dCol;
    const newRow = this.pipRow + dRow;

    if (newRow < 0 || newRow >= this.map.length) return false;
    if (newCol < 0 || newCol >= this.map[newRow].length) return false;
    if (this.map[newRow][newCol] === 1) return false;

    if (dCol === -1) this.pipFacing = 'left';
    else if (dCol === 1) this.pipFacing = 'right';
    else if (dRow === -1) this.pipFacing = 'up';
    else this.pipFacing = 'down';

    this.pip.play(`${this.playerAnimKey}-walk-${this.pipFacing}`, true);
    this.hero.step();
    this.pipCol = newCol;
    this.pipRow = newRow;
    this.pipMoving = true;

    this.tweens.add({
      targets: this.pip,
      x: centre(newCol),
      y: centre(newRow),
      duration: 120,
      ease: 'Linear',
      onComplete: () => {
        this.hero.land();
        this.pipMoving = false;
        this.checkHazards();
        this.checkBladeHazards();
        this.checkSpikeHazards();
        this.checkWin();
        const chained = !onMoveDone && this.gridInput.update();
        if (!chained && !this._dying) this.pip.play(`${this.playerAnimKey}-idle-${this.pipFacing}`);
        if (onMoveDone) onMoveDone();
      },
    });
    return true;
  }

  checkHazards() {
    if (this._dying || this.hero.invulnerable) return;
    for (const { rect, col, row } of this.flameRects) {
      if (rect.active && this.pipCol === col && this.pipRow === row) {
        this.showHint('The flame is active. Wait for it to cool down.');
        this.resetPip();
        return;
      }
    }

    for (const mummy of this.mummyList) {
      if (this.pipCol === mummy.col && this.pipRow === mummy.row) {
        this.showHint('Avoid the mummy!');
        this.resetPip();
        return;
      }
    }
  }

  checkBladeHazards() {
    if (this._dying || this.hero.invulnerable) return;
    for (const { col, row, active } of this.bladeZones) {
      if (active() && this.pipCol === col && this.pipRow === row) {
        this.showHint('The blade was still swinging. Wait longer!');
        this.resetPip();
        return;
      }
    }
  }

  checkSpikeHazards() {
    if (this._dying || this.hero.invulnerable) return;
    for (const { rect, col, row } of this.spikeRects) {
      if (rect.active && this.pipCol === col && this.pipRow === row) {
        this.showHint('The spikes are still up. Wait for them to retract.');
        this.resetPip();
        return;
      }
    }
  }

  resetPip() {
    this.tweens.killTweensOf(this.pip);
    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this.pipMoving = false;
    const facing = this.pipFacing;
    this.pipFacing = 'down';
    this._dying = true;
    flash(this, P.BLOOD, 0.22, 300);

    this.hero.die(facing, () => {
      this.pip.play(`${this.playerAnimKey}-idle-down`);
      this.hero.respawn(centre(this.startCol), centre(this.startRow));
      this.hero.setInvulnerable(1000);
      this.time.delayedCall(260, () => { this._dying = false; });
    });
  }

  checkWin() {
    const k = this.keyState[0];
    if (!k.collected && this.pipCol === k.col && this.pipRow === k.row) {
      this.collectKey(0);
    }

    const tutorialConfig = TUTORIAL_CONFIGS[this.currentPhase];
    if (this.keysCollected >= this.requiredKeys && this.pipCol === tutorialConfig.chestCol && this.pipRow === tutorialConfig.chestRow) {
      this._winTriggered = true;
      this.hud({ type: 'instruction-fade' });
      this.fx.sparkle.explode(24, this.pip.x, this.pip.y - 8);
      this.time.delayedCall(250, () => {
        iris(this, this.pip.x, this.pip.y, 'close', 360, () => {
          this.scene.start('TutorialScene', { phase: this.currentPhase + 1 });
        });
      });
    }
  }

  collectKey(index) {
    const k = this.keyState[index];
    k.collected = true;
    this.keysCollected++;

    if (k.pulseTween) {
      k.pulseTween.stop();
      k.pulseTween = null;
    }
    if (k.sprite) {
      this.fx.sparkle.explode(16, k.sprite.x, k.sprite.y);
      k.sprite.destroy();
      k.sprite = null;
    }
    if (k.light) { this.lights.removeLight(k.light); k.light = null; }
    hitStop(this, 60);
    flash(this, P.CREAM, 0.2, 200);
    this.hud({ type: 'keys', collected: this.keysCollected, required: this.requiredKeys });
  }

  update() {
    if (this.currentPhase >= TUTORIAL_CONFIGS.length || !this.hero) return;
    this.hero.sync();
    this.torch.x = this.pip.x;
    this.torch.y = this.pip.y;

    if (this._demoRunning) {
      this.updateArrow();
      return;
    }

    if (!this.pipMoving) this.gridInput.update();

    this.updateArrow();
  }

  showInstruction(text) {
    this.hud({ type: 'instruction', text });
  }

  showHint(text) {
    this.hud({ type: 'hint', text });
  }

  showArrow(x, y, angle) {
    if (!this._arrow) {
      this._arrow = this.add.image(x, y, HAZARD_KEYS.arrow).setScale(2).setDepth(DEPTH.fx).setAlpha(0);
      this._arrowBase = { x, y };
      this._arrowBob = this.tweens.add({
        targets: this._arrow, scale: 2.4, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    this._arrow.setPosition(x, y).setAngle(angle);
    if (this._arrow.alpha < 1 && !this._arrowFading) {
      this._arrowFading = true;
      this.tweens.add({
        targets: this._arrow, alpha: 1, duration: 150,
        onComplete: () => { this._arrowFading = false; },
      });
    }
  }

  hideArrow() {
    if (this._arrow && this._arrow.alpha > 0) {
      this.tweens.killTweensOf(this._arrow);
      this._arrow.setAlpha(0);
      this._arrowFading = false;
      this._arrowBob = this.tweens.add({
        targets: this._arrow, scale: 2.4, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  // Only guide the player across the trap toward the goal, never back.
  approachDirection(trap) {
    const { startCol, startRow } = TUTORIAL_CONFIGS[this.currentPhase];
    if (trap.row !== startRow) return [0, trap.row > startRow ? 1 : -1];
    return [trap.col > startCol ? 1 : -1, 0];
  }

  updateArrow() {
    const trap = TUTORIAL_CONFIGS[this.currentPhase].traps[0];
    if (!trap) return;
    const [appCol, appRow] = this.approachDirection(trap);

    const adjacentPositions = [
      { col: trap.col - 1, row: trap.row, moveCol: 1, moveRow: 0, angle: 90 },
      { col: trap.col + 1, row: trap.row, moveCol: -1, moveRow: 0, angle: -90 },
      { col: trap.col, row: trap.row - 1, moveCol: 0, moveRow: 1, angle: 180 },
      { col: trap.col, row: trap.row + 1, moveCol: 0, moveRow: -1, angle: 0 },
    ];

    for (const pos of adjacentPositions) {
      if (pos.moveCol !== appCol || pos.moveRow !== appRow) continue;
      if (this.pipCol === pos.col && this.pipRow === pos.row) {
        if (this.isSafeToMove(trap) && !this.pipMoving) {
          this.showArrow(this.pip.x + pos.moveCol * T, this.pip.y + pos.moveRow * T, pos.angle);
        } else {
          this.hideArrow();
        }
        return;
      }
    }

    this.hideArrow();
  }

  // Safe means neither firing nor winding up — the telegraph counts as danger.
  isSafeToMove(trap) {
    if (trap.type === 'blade') {
      const zone = this.bladeZones.find((z) => z.col === trap.col && z.row === trap.row);
      return zone ? !zone.active() : true;
    }
    const list = trap.type === 'flame' ? this.flameRects : trap.type === 'spike' ? this.spikeRects : null;
    if (!list) return true;
    const ref = list.find((h) => h.col === trap.col && h.row === trap.row);
    return ref ? !ref.rect.active && !ref.rect.telegraph : true;
  }

  runAutoDemo() {
    this._demoRunning = true;

    const trap = TUTORIAL_CONFIGS[this.currentPhase].traps[0];

    this.showInstruction(this._tutorialInstruction);

    const demoMoves = this.generateDemoSequence(trap);

    let moveIndex = 0;

    const executeNextMove = () => {
      if (moveIndex >= demoMoves.length) {
        this._demoRunning = false;
        this.resetPip();
        return;
      }

      const move = demoMoves[moveIndex];
      moveIndex++;

      if (move.waitUntilSafe) {
        const checkSafe = () => {
          if (this.isSafeToMove(trap)) {
            executeNextMove();
          } else {
            this.time.delayedCall(100, checkSafe);
          }
        };
        checkSafe();
      } else if (move.wait) {
        this.time.delayedCall(move.wait, executeNextMove);
      } else if (move.fast) {
        this.tryMove(move.dCol, move.dRow, executeNextMove);
      } else {
        this.tryMove(move.dCol, move.dRow);
        this.time.delayedCall(250, executeNextMove);
      }
    };

    this.time.delayedCall(1000, executeNextMove);
  }

  generateDemoSequence(trap) {
    const tutorialConfig = TUTORIAL_CONFIGS[this.currentPhase];
    const sequence = [];

    const { startCol, startRow } = tutorialConfig;
    const { col: trapCol, row: trapRow } = trap;
    let currentCol = startCol;
    let currentRow = startRow;

    const [approachDCol, approachDRow] = this.approachDirection(trap);

    const targetCol = approachDCol !== 0 ? trapCol - approachDCol : trapCol;
    while (currentCol !== targetCol) {
      const dc = targetCol > currentCol ? 1 : -1;
      sequence.push({ dCol: dc, dRow: 0 });
      currentCol += dc;
    }

    const targetRow = approachDRow !== 0 ? trapRow - approachDRow : trapRow;
    while (currentRow !== targetRow) {
      const dr = targetRow > currentRow ? 1 : -1;
      sequence.push({ dCol: 0, dRow: dr });
      currentRow += dr;
    }

    sequence.push({ waitUntilSafe: true });

    sequence.push({ dCol: approachDCol, dRow: approachDRow, fast: true });
    sequence.push({ dCol: approachDCol, dRow: approachDRow, fast: true });

    sequence.push({ wait: 2000 });

    return sequence;
  }

  handlePrevPhase() {
    if (this.currentPhase > 0) {
      this.scene.start('TutorialScene', { phase: this.currentPhase - 1 });
    }
  }

  handleNextPhase() {
    this.scene.start('TutorialScene', { phase: this.currentPhase + 1 });
  }

  exitTutorial() {
    this.scene.start('TitleScene');
  }

  showOptionsScreen() {
    this.add.rectangle(480, 360, 960, 720, P.SHADOW);
    const rays = this.add.image(480, 250, HAZARD_KEYS.rays).setScale(4).setTint(P.GOLD).setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });

    this.add.text(480, 200, 'TUTORIAL COMPLETE', TEXT.logo(54)).setOrigin(0.5);
    this.add.text(480, 270, "You're ready to explore the temple.", TEXT.body(22, P.STONE_LIGHT)).setOrigin(0.5);

    const toTitle = () => this.scene.start('TitleScene');
    const toGame = () => {
      this.game.registry.set('character', 'pip');
      this.scene.start('GameScene', { level: 0 });
    };
    const back = createButton(this, 480, 420, 'BACK TO MAIN', { width: 300, onClick: toTitle });
    const start = createButton(this, 480, 500, 'START GAME', { width: 300, onClick: toGame });
    start.setFocused(true);
    back.on('hover', () => { back.setFocused(true); start.setFocused(false); });
    start.on('hover', () => { start.setFocused(true); back.setFocused(false); });
    this.add.text(480, 580, 'ENTER  START GAME     SPACE  MAIN MENU', TEXT.label(13)).setOrigin(0.5);

    this.input.keyboard.on('keydown-ENTER', toGame);
    this.input.keyboard.on('keydown-SPACE', toTitle);
  }
}
