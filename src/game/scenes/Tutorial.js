import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { tileRng } from '../lib/generator.js';
import {
  CHARACTER_CONFIGS,
  createPlayer,
  drawWallTile,
  drawFloorTile,
  drawChest,
  drawKey,
  drawFlameNozzle,
  createFlame,
  drawBlade,
  drawMummy,
  drawSpike,
  drawSpikeBase,
} from '../lib/graphics.js';
import { TUTORIAL_CONFIGS } from '../lib/tutorial-config.js';
import { hideDpad, showDpad, wireDpad, unwireDpad } from '../lib/dpad.js';

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
    this._mummyGraphics = [];
    this.spikeRects = [];
    this._spikeGraphics = [];
    this._spikeGlows = [];
    this._winTriggered = false;
    this.keysCollected = 0;
    this._keyHudSlots = [null, null];
    this._keyHudIcons = [null, null];
    this._starEmitter = null;
    this._key2RevealEmitter = null;
    this._demoRunning = false;
    this._allowPlayerInput = false;
    this.pipMoving = false;
    this._cycleTimers = [];
  }

  create(data) {
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
    this.walls = this.add.group();
    this.flameRects = [];
    this.bladeZones = [];
    this.mummyList = [];
    this._bladeTweens = [];
    this._mummyGraphics = [];
    this.spikeRects = [];
    this._spikeGraphics = [];
    this._spikeGlows = [];
    this._winTriggered = false;
    this.keysCollected = 0;
    this.requiredKeys = 1;
    this.keyState = [
      {
        col: tutorialConfig.keyCol,
        row: tutorialConfig.keyRow,
        sprite: null,
        pulseTween: null,
        collected: false,
      },
    ];
    this._keyHudSlots = [null, null];
    this._keyHudIcons = [null, null];
    this._starEmitter = null;
    this._key2RevealEmitter = null;

    this._tutorialInstruction = tutorialConfig.instruction;
    this._instructionText = null;
    this._instructionBox = null;
    this._arrow = null;
    this._hintText = null;
    this._demoRunning = false;
    this._allowPlayerInput = false;
    this._seed = 12345;

    tutorialConfig.map.forEach((row, rowIdx) => {
      row.forEach((tile, colIdx) => {
        const x = colIdx * TILE_SIZE + TILE_SIZE / 2;
        const y = rowIdx * TILE_SIZE + TILE_SIZE / 2;

        if (tile === 1) {
          const wallG = drawWallTile(this, x, y, tileRng(this._seed, colIdx, rowIdx));
          this.walls.add(wallG);
        } else if (tile === 2) {
          drawFloorTile(this, x, y, tileRng(this._seed, colIdx, rowIdx));
        } else if (tile === 3) {
          drawFloorTile(this, x, y, tileRng(this._seed, colIdx, rowIdx));
          const chest = drawChest(this, x, y);
          this._exitPulseTween = this.tweens.add({
            targets: chest,
            alpha: { from: 1, to: 0.75 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        } else {
          drawFloorTile(this, x, y, tileRng(this._seed, colIdx, rowIdx));
        }
      });
    });

    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this.pipMoving = false;
    this.pipFacing = 'down';
    this.playerKey = 'pip';
    this.playerAnimKey = CHARACTER_CONFIGS.pip.animKey;

    this.pip = createPlayer(
      this,
      this.startCol * TILE_SIZE + TILE_SIZE / 2,
      this.startRow * TILE_SIZE + TILE_SIZE / 2,
    );
    this.pip.play(`${this.playerAnimKey}-idle-down`);

    this.add.text(12, 8, `Tutorial: ${tutorialConfig.name}`, {
      fontSize: '22px',
      color: '#ffd700',
      stroke: '#4a2800',
      strokeThickness: 4,
      fontStyle: 'bold',
    });

    hideDpad();
    this.events.once('shutdown', () => {
      this.time.removeAllEvents();
      showDpad();
      unwireDpad(this);
      if (this.pip) this.pip.destroy();
      if (this._exitPulseTween) this._exitPulseTween.stop();
      if (this._instructionBox) this._instructionBox.destroy();
      if (this._instructionText) this._instructionText.destroy();
      if (this._arrow) {
        this.tweens.killTweensOf(this._arrow);
        this._arrow.destroy();
      }
      if (this._hintText) this._hintText.destroy();
      this._keyHudIcons.forEach((icon) => {
        if (icon) icon.destroy();
      });
      this._keyHudSlots.forEach((slot) => {
        if (slot) slot.destroy();
      });
      this.keyState.forEach((k) => {
        if (k.pulseTween) k.pulseTween.stop();
      });
      this._bladeTweens.forEach((t) => t.stop());
      this._mummyGraphics.forEach((g) => this.tweens.killTweensOf(g));
      this._spikeGraphics.forEach((g) => { this.tweens.killTweensOf(g); g.destroy(); });
      this._spikeGlows.forEach((g) => { this.tweens.killTweensOf(g); g.destroy(); });
    });

    this.setupInput();
    this.createTraps();
    this.createKey();
    this.createInstructionBox();
    this.runAutoDemo();
  }

  createTraps() {
    const tutorialConfig = TUTORIAL_CONFIGS[this.currentPhase];
    const traps = tutorialConfig.traps || [];
    traps.forEach((trap) => {
      if (trap.type === 'flame') this.createFlame(trap);
      if (trap.type === 'blade') this.createBlade(trap);
      if (trap.type === 'mummy') this.createMummy(trap);
      if (trap.type === 'spike') this.createSpike(trap);
    });
  }

  createKey() {
    const k = this.keyState[0];
    const x = k.col * TILE_SIZE + TILE_SIZE / 2;
    const y = k.row * TILE_SIZE + TILE_SIZE / 2;
    k.sprite = drawKey(this, x, y);
    k.pulseTween = this.tweens.add({
      targets: k.sprite,
      alpha: { from: 1, to: 0.65 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  createFlame(trap) {
    const x = trap.col * TILE_SIZE + TILE_SIZE / 2;
    const y = trap.row * TILE_SIZE + TILE_SIZE / 2;

    drawFlameNozzle(this, x, y);
    const glow = this.add.circle(x, y - 4, TILE_SIZE * 0.36, 0xff6600, 0.2);
    const flame = createFlame(this, x, y);

    const flameRef = { active: false };
    this.flameRects.push({ rect: flameRef, col: trap.col, row: trap.row });

    let flickerTween = null;

    const cycle = () => {
      this.tweens.add({
        targets: glow,
        alpha: 0.65,
        duration: 500,
        onComplete: () => {
          flameRef.active = true;
          flame.alpha = 1;
          flickerTween = this.tweens.add({
            targets: flame,
            alpha: { from: 0.85, to: 1 },
            duration: 90,
            yoyo: true,
            repeat: -1,
          });
          this.time.delayedCall(2000, () => {
            if (flickerTween) {
              flickerTween.stop();
              flickerTween = null;
            }
            flameRef.active = false;
            flame.alpha = 0;
            glow.alpha = 0.2;
            this.time.delayedCall(2000, cycle);
          });
        },
      });
    };
    cycle();
  }

  createBlade(trap) {
    const pivotX = trap.col * TILE_SIZE + TILE_SIZE / 2;
    const pivotY = trap.row * TILE_SIZE + 2;

    const axe = drawBlade(this, pivotX, pivotY);

    let bladeIn = false;
    this.bladeZones.push({
      col: trap.col,
      row: trap.row,
      active: () => bladeIn,
    });

    const bladeTween = this.tweens.add({
      targets: axe,
      angle: 40,
      duration: 1100,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        const next = Math.abs(axe.angle) < 22;
        if (next && !bladeIn) {
          bladeIn = true;
          this.checkBladeHazards();
        } else if (!next && bladeIn) {
          bladeIn = false;
        }
      },
    });

    this._bladeTweens.push(bladeTween);
  }

  createMummy(trap) {
    const startX = trap.col * TILE_SIZE + TILE_SIZE / 2;
    const startY = trap.row * TILE_SIZE + TILE_SIZE / 2;

    const g = drawMummy(this, startX, startY);
    this._mummyGraphics.push(g);

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

      const targetX = mummyObj.col * TILE_SIZE + TILE_SIZE / 2;
      this.tweens.add({
        targets: g,
        x: targetX,
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

  createSpike(trap) {
    const x = trap.col * TILE_SIZE + TILE_SIZE / 2;
    const y = trap.row * TILE_SIZE + TILE_SIZE / 2;

    const base = drawSpikeBase(this, x, y);
    this._spikeGraphics.push(base);

    const glow = this.add.circle(x, y, TILE_SIZE * 0.36, 0xcc2200, 0.15);
    this._spikeGlows.push(glow);

    const spike = drawSpike(this, x, y + 10);
    spike.alpha = 0;
    this._spikeGraphics.push(spike);

    const rect = { active: false };
    this.spikeRects.push({ rect, col: trap.col, row: trap.row });

    const cycle = () => {
      this.tweens.add({
        targets: glow,
        alpha: 0.5,
        duration: 500,
        onComplete: () => {
          spike.alpha = 1;
          this.tweens.add({
            targets: spike,
            y: y,
            duration: 150,
            ease: 'Linear',
            onComplete: () => {
              rect.active = true;
              this.checkSpikeHazards();
              this.time.delayedCall(2000, () => {
                rect.active = false;
                this.tweens.add({
                  targets: spike,
                  y: y + 10,
                  duration: 150,
                  ease: 'Linear',
                  onComplete: () => {
                    spike.alpha = 0;
                    spike.y = y + 10;
                    this.tweens.add({
                      targets: glow,
                      alpha: 0.15,
                      duration: 200,
                    });
                    this.time.delayedCall(2000, cycle);
                  },
                });
              });
            },
          });
        },
      });
    };

    this.time.delayedCall(Math.floor(Math.random() * 3000), cycle);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.input.keyboard.on('keydown-ZERO', () => this.handlePrevPhase());
    this.input.keyboard.on('keydown-ONE', () => this.handleNextPhase());
    this.input.keyboard.on('keydown-X', () => this.exitTutorial());
  }

  tryMove(dCol, dRow, onMoveDone = null) {
    if (this.pipMoving || this._winTriggered) return;
    const newCol = this.pipCol + dCol;
    const newRow = this.pipRow + dRow;

    if (newRow < 0 || newRow >= this.map.length) return;
    if (newCol < 0 || newCol >= this.map[newRow].length) return;
    if (this.map[newRow][newCol] === 1) return;

    if (dCol === -1) this.pipFacing = 'left';
    else if (dCol === 1) this.pipFacing = 'right';
    else if (dRow === -1) this.pipFacing = 'up';
    else this.pipFacing = 'down';

    this.pip.play(`${this.playerAnimKey}-walk-${this.pipFacing}`);
    this.pipCol = newCol;
    this.pipRow = newRow;
    this.pipMoving = true;

    const targetX = newCol * TILE_SIZE + TILE_SIZE / 2;
    const targetY = newRow * TILE_SIZE + TILE_SIZE / 2;

    this.tweens.add({
      targets: this.pip,
      x: targetX,
      y: targetY,
      duration: 120,
      ease: 'Linear',
      onComplete: () => {
        this.pip.play(`${this.playerAnimKey}-idle-${this.pipFacing}`);
        this.pipMoving = false;
        this.checkHazards();
        this.checkBladeHazards();
        this.checkSpikeHazards();
        this.checkWin();
        if (onMoveDone) onMoveDone();
      },
    });
  }

  checkHazards() {
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
    for (const { col, row, active } of this.bladeZones) {
      if (active() && this.pipCol === col && this.pipRow === row) {
        this.showHint('The blade was still swinging. Wait longer!');
        this.resetPip();
        return;
      }
    }
  }

  checkSpikeHazards() {
    for (const { rect, col, row } of this.spikeRects) {
      if (rect.active && this.pipCol === col && this.pipRow === row) {
        this.showHint('The spikes are still up. Wait for them to retract.');
        this.resetPip();
        return;
      }
    }
  }

  resetPip() {
    this.pip.stop();
    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this.pipMoving = false;
    this.pipFacing = 'down';

    const x = this.startCol * TILE_SIZE + TILE_SIZE / 2;
    const y = this.startRow * TILE_SIZE + TILE_SIZE / 2;

    this.pip.setPosition(x, y);
    this.pip.play(`${this.playerAnimKey}-idle-down`);

    this.showFlash(0xff0000, 0.25, 300);
  }

  showFlash(color, alpha, duration) {
    const flash = this.add.rectangle(480, 360, 960, 720, color, alpha);
    flash.setDepth(1000);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: duration,
      onComplete: () => flash.destroy(),
    });
  }

  checkWin() {
    if (!this.keyState[0].collected && this.pipCol === this.keyState[0].col && this.pipRow === this.keyState[0].row) {
      this.collectKey(0);
    }

    const tutorialConfig = TUTORIAL_CONFIGS[this.currentPhase];
    if (this.keysCollected >= this.requiredKeys && this.pipCol === tutorialConfig.chestCol && this.pipRow === tutorialConfig.chestRow) {
      this._winTriggered = true;
      this.fadeInstruction();
      this.time.delayedCall(600, () => {
        this.scene.start('TutorialScene', { phase: this.currentPhase + 1 });
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
      k.sprite.destroy();
      k.sprite = null;
    }

    this.showFlash(0xffffff, 0.35, 250);
  }

  update() {
    if (this.currentPhase >= TUTORIAL_CONFIGS.length) return;

    if (this._demoRunning) {
      this.updateArrow();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.tryMove(0, -1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.tryMove(0, 1);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.tryMove(-1, 0);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.tryMove(1, 0);
    if (Phaser.Input.Keyboard.JustDown(this.wasd.up)) this.tryMove(0, -1);
    if (Phaser.Input.Keyboard.JustDown(this.wasd.down)) this.tryMove(0, 1);
    if (Phaser.Input.Keyboard.JustDown(this.wasd.left)) this.tryMove(-1, 0);
    if (Phaser.Input.Keyboard.JustDown(this.wasd.right)) this.tryMove(1, 0);

    this.updateArrow();
  }

  createInstructionBox() {
    const boxX = 480;
    const boxY = 680;
    const boxWidth = 700;
    const boxHeight = 60;

    this._instructionBox = this.add.rectangle(
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      0xffffff,
      0.9,
    );
    this._instructionBox.setDepth(500);

    this._instructionText = this.add.text(boxX, boxY, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#cc0000',
      align: 'center',
      wordWrap: { width: boxWidth - 20 },
    }).setOrigin(0.5).setDepth(501);
  }

  showInstruction(text) {
    this._instructionText.setText(text);
    this._instructionBox.setAlpha(0.9);
    this._instructionText.setAlpha(1);
  }

  fadeInstruction() {
    if (!this._instructionBox || !this._instructionText) return;
    this.tweens.add({
      targets: [this._instructionBox, this._instructionText],
      alpha: 0,
      duration: 400,
      ease: 'Sine.easeOut',
    });
  }

  showHint(text) {
    if (this._hintText) this._hintText.destroy();

    this._hintText = this.add.text(480, 100, text, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
      backgroundColor: '#1a1a1a',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(600);

    this.tweens.add({
      targets: this._hintText,
      alpha: { from: 1, to: 0 },
      duration: 3000,
      delay: 1000,
      onComplete: () => {
        if (this._hintText) {
          this._hintText.destroy();
          this._hintText = null;
        }
      },
    });
  }

  createArrow() {
    if (this._arrow) this._arrow.destroy();

    const g = this.add.graphics();
    g.fillStyle(0xffff00, 1);
    g.fillTriangleShape(new Phaser.Geom.Triangle(0, -12, -8, 4, 8, 4));
    g.setDepth(600);
    g.setAlpha(0);

    this._arrow = g;
  }

  showArrow(x, y) {
    if (!this._arrow) this.createArrow();

    this._arrow.setPosition(x, y);
    if (this._arrow.alpha < 1) {
      this.tweens.add({
        targets: this._arrow,
        alpha: 1,
        duration: 200,
        overwrite: 'auto',
      });
    }

    this.tweens.add({
      targets: this._arrow,
      y: y - 8,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      overwrite: 'auto',
    });
  }

  hideArrow() {
    if (!this._arrow) return;
    this.tweens.add({
      targets: this._arrow,
      alpha: 0,
      duration: 200,
      overwrite: 'auto',
    });
  }

  updateArrow() {
    const tutorialConfig = TUTORIAL_CONFIGS[this.currentPhase];
    const trap = tutorialConfig.traps[0];

    if (!trap) return;

    const adjacentPositions = [
      { col: trap.col - 1, row: trap.row, moveCol: 1, moveRow: 0 },
      { col: trap.col + 1, row: trap.row, moveCol: -1, moveRow: 0 },
      { col: trap.col, row: trap.row - 1, moveCol: 0, moveRow: 1 },
      { col: trap.col, row: trap.row + 1, moveCol: 0, moveRow: -1 },
    ];

    for (const pos of adjacentPositions) {
      if (this.pipCol === pos.col && this.pipRow === pos.row) {
        const isSafe = this.isSafeToMove(trap);

        if (isSafe) {
          const arrowX = this.pip.x + pos.moveCol * TILE_SIZE;
          const arrowY = this.pip.y + pos.moveRow * TILE_SIZE;
          this.showArrow(arrowX, arrowY);
        } else {
          this.hideArrow();
        }
        return;
      }
    }

    this.hideArrow();
  }

  isSafeToMove(trap) {
    if (trap.type === 'blade') {
      for (const zone of this.bladeZones) {
        if (zone.col === trap.col && zone.row === trap.row) {
          return !zone.active();
        }
      }
      return true;
    }

    if (trap.type === 'flame') {
      for (const flameRef of this.flameRects) {
        if (flameRef.col === trap.col && flameRef.row === trap.row) {
          return !flameRef.rect.active;
        }
      }
      return true;
    }

    if (trap.type === 'spike') {
      for (const spikeRef of this.spikeRects) {
        if (spikeRef.col === trap.col && spikeRef.row === trap.row) {
          return !spikeRef.rect.active;
        }
      }
      return true;
    }

    return true;
  }

  runAutoDemo() {
    this._demoRunning = true;

    const tutorialConfig = TUTORIAL_CONFIGS[this.currentPhase];
    const trap = tutorialConfig.traps[0];

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

    const approachDCol = (trapRow !== startRow) ? 0 : (trapCol > startCol ? 1 : -1);
    const approachDRow = (trapRow !== startRow) ? (trapRow > startRow ? 1 : -1) : 0;

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
    if (this.pip) this.pip.destroy();
    if (this._instructionBox) this._instructionBox.destroy();
    if (this._instructionText) this._instructionText.destroy();
    if (this._arrow) this._arrow.destroy();

    this.add.rectangle(480, 360, 960, 720, 0x0d0d0d);

    this.add.text(480, 200, 'Tutorial Complete!', {
      fontFamily: '"Black Ops One", sans-serif',
      fontSize: '60px',
      color: '#cc0000',
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      shadowColor: '#440000',
      shadowFill: true,
    }).setOrigin(0.5);

    this.add.text(480, 300, 'You\'re ready to explore the temple.', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#888888',
    }).setOrigin(0.5);

    const buttonY1 = 420;
    const buttonY2 = 520;

    const backBtn = this.add.text(480, buttonY1, 'BACK TO MAIN', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#cc0000',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => this.scene.start('TitleScene'));

    const startBtn = this.add.text(480, buttonY2, 'START GAME', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#cc0000',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerdown', () => {
      this.game.registry.set('character', 'pip');
      this.scene.start('GameScene', { level: 0 });
    });

    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('GameScene', { level: 0 }));
    this.input.keyboard.on('keydown-SPACE', () => this.scene.start('TitleScene'));
  }
}
