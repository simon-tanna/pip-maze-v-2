import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { LEVEL_CONFIGS, generateLevel, bfsPath, tileRng } from '../lib/generator.js';
import {
  CHARACTER_CONFIGS,
  createPlayer,
  bakeTileTextures,
  wallTileKey,
  floorTileKey,
  drawChest,
  drawKey,
  drawKeyIcon,
  drawFlameNozzle,
  createFlame,
  drawBlade,
  drawMummy,
  drawSpike,
  drawSpikeBase,
  drawVineTuft,
  drawGroundPlant,
  drawBones,
  drawBrokenPot,
  drawSandPile,
  drawScarab,
  drawGlyphChip,
  pickDecor,
} from '../lib/graphics.js';
import { showDpad, wireDpad, unwireDpad } from '../lib/dpad.js';

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
    this._spikeGraphics = [];
    this._spikeGlows = [];
    this._winTriggered = false;
    this.keysCollected = 0;
    this._keyHudSlots = [null, null];
    this._keyHudIcons = [null, null];
    this._starEmitter = null;
    this._key2RevealEmitter = null;
    this.pipMoving = false;
  }

  create(data) {
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

    this.currentLevel = generateLevel(
      this.levelIndex,
      levelSeeds[this.levelIndex],
    );
    const levelData = this.currentLevel;

    this.map = levelData.map;
    this.startCol = 0;
    this.startRow = 0;
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
    this.requiredKeys = levelData.key2 ? 2 : 1;
    this.keyState = [
      {
        col: levelData.key.col,
        row: levelData.key.row,
        sprite: null,
        pulseTween: null,
        collected: false,
      },
    ];
    if (levelData.key2) {
      this.keyState.push({
        col: levelData.key2.col,
        row: levelData.key2.row,
        sprite: null,
        pulseTween: null,
        collected: false,
      });
    }
    this._keyHudSlots = [null, null];
    this._keyHudIcons = [null, null];
    this._starEmitter = null;
    this._key2RevealEmitter = null;

    bakeTileTextures(this);

    const levelSeed = levelSeeds[this.levelIndex];
    const halfT = TILE_SIZE / 2;
    const shadowG = this.add.graphics().setDepth(0.5);
    const tileAt = (c, r) => {
      if (r < 0 || r >= levelData.map.length) return 0;
      if (c < 0 || c >= levelData.map[r].length) return 0;
      return levelData.map[r][c];
    };

    levelData.map.forEach((row, rowIdx) => {
      row.forEach((tile, colIdx) => {
        const x = colIdx * TILE_SIZE + TILE_SIZE / 2;
        const y = rowIdx * TILE_SIZE + TILE_SIZE / 2;
        const variant = tileRng(levelSeed, colIdx, rowIdx)();

        if (tile === 1) {
          const wallImg = this.add.image(x, y, wallTileKey(variant));
          this.walls.add(wallImg);
        } else {
          const floorImg = this.add.image(x, y, floorTileKey(variant));

          const jitterRng = tileRng(levelSeed, colIdx + 1000, rowIdx + 1000);
          const jr = 0xf0 + Math.floor(jitterRng() * 16);
          const jg = 0xf0 + Math.floor(jitterRng() * 16);
          const jb = 0xf0 + Math.floor(jitterRng() * 16);
          floorImg.setTint((jr << 16) | (jg << 8) | jb);

          const orient = tileRng(levelSeed, colIdx + 2000, rowIdx + 2000)();
          floorImg.setAngle(Math.floor(orient * 4) * 90);
          if (orient > 0.5) floorImg.setFlipX(true);

          if (tileAt(colIdx, rowIdx - 1) === 1) {
            shadowG.fillStyle(0x000000, 0.40);
            shadowG.fillRect(x - halfT, y - halfT, TILE_SIZE, 4);
            shadowG.fillStyle(0x000000, 0.20);
            shadowG.fillRect(x - halfT, y - halfT + 4, TILE_SIZE, 2);
          }
          if (tileAt(colIdx - 1, rowIdx) === 1) {
            shadowG.fillStyle(0x000000, 0.30);
            shadowG.fillRect(x - halfT, y - halfT, 4, TILE_SIZE);
            shadowG.fillStyle(0x000000, 0.15);
            shadowG.fillRect(x - halfT + 4, y - halfT, 2, TILE_SIZE);
          }
          if (tileAt(colIdx + 1, rowIdx) === 1) {
            shadowG.fillStyle(0x000000, 0.30);
            shadowG.fillRect(x + halfT - 4, y - halfT, 4, TILE_SIZE);
            shadowG.fillStyle(0x000000, 0.15);
            shadowG.fillRect(x + halfT - 6, y - halfT, 2, TILE_SIZE);
          }
          if (tileAt(colIdx, rowIdx + 1) === 1) {
            shadowG.fillStyle(0x000000, 0.22);
            shadowG.fillRect(x - halfT, y + halfT - 3, TILE_SIZE, 3);
          }

          if (tile === 2) {
            this.startCol = colIdx;
            this.startRow = rowIdx;
          } else if (tile === 3) {
            const chest = drawChest(this, x, y);
            this._exitPulseTween = this.tweens.add({
              targets: chest,
              alpha: { from: 1, to: 0.75 },
              duration: 700,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut",
            });
          }
        }
      });
    });

    levelData.map.forEach((row, rowIdx) => {
      row.forEach((tile, colIdx) => {
        if (tile !== 0) return;

        const x = colIdx * TILE_SIZE + TILE_SIZE / 2;
        const y = rowIdx * TILE_SIZE + TILE_SIZE / 2;

        const neighbours = [
          { wallAbove: true, dr: -1, dc: 0, valid: rowIdx - 1 >= 0 },
          { wallAbove: false, dr: 0, dc: -1, valid: colIdx - 1 >= 0 },
          { wallAbove: false, dr: 0, dc: 1, valid: colIdx + 1 < row.length },
        ];

        for (const { wallAbove, dr, dc, valid } of neighbours) {
          if (!valid) continue;
          if (levelData.map[rowIdx + dr][colIdx + dc] !== 1) continue;

          const decRng = tileRng(levelSeed, colIdx + 500, rowIdx + 500);
          if (decRng() < 0.35) {
            const pick = pickDecor(decRng(), wallAbove);
            const vineRng = tileRng(levelSeed, colIdx + 3000, rowIdx + 3000);
            switch (pick) {
              case 'vine': drawVineTuft(this, x, y, vineRng); break;
              case 'plant': drawGroundPlant(this, x, y); break;
              case 'bones': drawBones(this, x, y); break;
              case 'pot': drawBrokenPot(this, x, y); break;
              case 'sandPile': drawSandPile(this, x, y); break;
              case 'scarab': drawScarab(this, x, y); break;
              case 'glyph': drawGlyphChip(this, x, y); break;
            }
          }
          break;
        }
      });
    });

    if (
      this.startCol === 0 &&
      this.startRow === 0 &&
      levelData.map[0][0] !== 2
    ) {
      console.warn(
        `Level ${this.levelIndex}: no start tile (2) found in map — defaulting to [0,0]`,
      );
    }

    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this.pipMoving = false;
    this.pipFacing = "down";
    this.playerKey = this.game.registry.get("character") || "pip";
    this.playerAnimKey = (
      CHARACTER_CONFIGS[this.playerKey] || CHARACTER_CONFIGS.pip
    ).animKey;

    this.pip = createPlayer(
      this,
      this.startCol * TILE_SIZE + TILE_SIZE / 2,
      this.startRow * TILE_SIZE + TILE_SIZE / 2,
    );
    this.pip.play(`${this.playerAnimKey}-idle-down`);

    this.cameras.main.setBounds(0, 0, 40 * TILE_SIZE, 15 * TILE_SIZE);
    this.cameras.main.startFollow(this.pip, true, 1, 1);

    this._chamberText = this.add.text(12, 8, `Chamber ${this.levelIndex + 1}`, {
      fontSize: "22px",
      color: "#ffd700",
      stroke: "#4a2800",
      strokeThickness: 4,
      fontStyle: "bold",
    }).setScrollFactor(0);

    this.events.once("shutdown", () => {
      this.pip.destroy();
      this.time.removeAllEvents();
      if (this._winParticles) this._winParticles.destroy();
      if (this._exitPulseTween) this._exitPulseTween.stop();
      if (this._starEmitter) this._starEmitter.destroy();
      if (this._key2RevealEmitter) this._key2RevealEmitter.destroy();
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
      this.mummyList.forEach((m) => { if (m.timer) m.timer.remove(); });
      this._mummyGraphics.forEach((g) => this.tweens.killTweensOf(g));
      this._spikeGraphics.forEach((g) => { this.tweens.killTweensOf(g); g.destroy(); });
      this._spikeGlows.forEach((g) => { this.tweens.killTweensOf(g); g.destroy(); });
      unwireDpad(this);
    });

    showDpad();

    this.validatePaths();
    this.setupInput();
    this.createTraps();
    this.createKey();
  }

  createTraps() {
    const traps = this.currentLevel.traps || [];
    traps.forEach((trap) => {
      if (trap.type === "flame") this.createFlame(trap);
      if (trap.type === "blade") this.createBlade(trap);
      if (trap.type === "mummy") this.createMummy(trap);
      if (trap.type === "spike") this.createSpike(trap);
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
      ease: "Sine.easeInOut",
    });

    if (this.requiredKeys === 2) {
      const { width } = this.scale;
      this._keyHudSlots[0] = drawKeyIcon(this, width - 72, 24);
      this._keyHudSlots[0].setAlpha(0.25).setDepth(50).setScrollFactor(0);
      this._keyHudSlots[1] = drawKeyIcon(this, width - 32, 24);
      this._keyHudSlots[1].setAlpha(0.25).setDepth(50).setScrollFactor(0);
    }
  }

  respawnKey(index) {
    const k = this.keyState[index];
    const x = k.col * TILE_SIZE + TILE_SIZE / 2;
    const y = k.row * TILE_SIZE + TILE_SIZE / 2;
    k.sprite = drawKey(this, x, y);
    k.pulseTween = this.tweens.add({
      targets: k.sprite,
      alpha: { from: 1, to: 0.65 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    k.collected = false;
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
      ease: "Sine.easeInOut",
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
      const duration = mummyObj.mode === 'chase' ? 300 : 400;
      const targetX = mummyObj.col * TILE_SIZE + TILE_SIZE / 2;
      const targetY = mummyObj.row * TILE_SIZE + TILE_SIZE / 2;
      this.tweens.add({
        targets: g,
        x: targetX,
        y: targetY,
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
      duration: 300,
      onComplete: () => g.destroy(),
    });
    const px = mummy.col * TILE_SIZE + TILE_SIZE / 2;
    const py = mummy.row * TILE_SIZE + TILE_SIZE / 2;
    const puff = this.add.particles(px, py, '__DEFAULT', {
      speed: { min: 40, max: 90 },
      angle: { min: 0, max: 360 },
      lifespan: 400,
      scale: { start: 0.5, end: 0 },
      tint: [0xc8a878, 0x8a7050, 0x6a4828],
      alpha: { start: 0.8, end: 0 },
      quantity: 10,
      emitting: false,
    });
    puff.explode(10);
    this.time.delayedCall(500, () => { if (puff.scene) puff.destroy(); });
    const idx = this.mummyList.indexOf(mummy);
    if (idx !== -1) this.mummyList.splice(idx, 1);
    const gIdx = this._mummyGraphics.indexOf(g);
    if (gIdx !== -1) this._mummyGraphics.splice(gIdx, 1);
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
            ease: "Linear",
            onComplete: () => {
              rect.active = true;
              this.checkSpikeHazards();
              this.time.delayedCall(2000, () => {
                rect.active = false;
                this.tweens.add({
                  targets: spike,
                  y: y + 10,
                  duration: 150,
                  ease: "Linear",
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

  validatePaths() {
    const levelData = this.currentLevel;
    if (!levelData.key) return;

    const blocked = new Set();
    (levelData.traps || []).forEach((trap) => {
      if (trap.type === "mummy") {
        for (let c = trap.patrolCols[0]; c <= trap.patrolCols[1]; c++)
          blocked.add(`${c},${trap.row}`);
      } else {
        blocked.add(`${trap.col},${trap.row}`);
      }
    });

    const { col: keyCol, row: keyRow } = levelData.key;
    const key2 = levelData.key2 || null;
    let exitCol = -1,
      exitRow = -1;
    this.map.forEach((row, ri) =>
      row.forEach((tile, ci) => {
        if (tile === 3) {
          exitCol = ci;
          exitRow = ri;
        }
      }),
    );

    if (
      !bfsPath(this.map, this.startCol, this.startRow, keyCol, keyRow, blocked)
    )
      console.warn(
        `⚠ Level ${this.levelIndex + 1}: No safe path from START to KEY — check trap placement`,
      );

    if (key2) {
      if (!bfsPath(this.map, keyCol, keyRow, key2.col, key2.row, blocked))
        console.warn(
          `⚠ Level ${this.levelIndex + 1}: No safe path from KEY1 to KEY2 — check trap placement`,
        );
      if (!bfsPath(this.map, key2.col, key2.row, exitCol, exitRow, blocked))
        console.warn(
          `⚠ Level ${this.levelIndex + 1}: No safe path from KEY2 to CHEST — check trap placement`,
        );
    } else {
      if (!bfsPath(this.map, keyCol, keyRow, exitCol, exitRow, blocked))
        console.warn(
          `⚠ Level ${this.levelIndex + 1}: No safe path from KEY to CHEST — check trap placement`,
        );
    }
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
    if (this.pipMoving || this._winTriggered) return;
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
      ease: "Linear",
      onComplete: () => {
        this.pip.play(`${this.playerAnimKey}-idle-${this.pipFacing}`);
        this.pipMoving = false;
        this.checkHazards();
        this.checkBladeHazards();
        this.checkSpikeHazards();
        this.checkWin();
      },
    });
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

    const hudX =
      index === 0
        ? this.requiredKeys === 2
          ? this.scale.width - 72
          : this.scale.width - 32
        : this.scale.width - 32;
    if (this._keyHudSlots[index]) {
      this._keyHudSlots[index].destroy();
      this._keyHudSlots[index] = null;
    }
    const icon = drawKeyIcon(this, hudX, 24);
    icon.setDepth(50).setScrollFactor(0);
    this._keyHudIcons[index] = icon;

    this._fireStarEmitter();

    if (index === 0 && this.requiredKeys === 2) {
      this._revealKey2();
    }
  }

  showFlash(color, alpha, duration) {
    const { width, height } = this.scale;
    const flash = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      color,
      alpha,
    );
    flash.setDepth(100).setScrollFactor(0);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration,
      onComplete: () => flash.destroy(),
    });
  }

  showToast(message) {
    const { width, height } = this.scale;
    const toast = this.add
      .text(width / 2, height / 2 - 60, message, {
        fontSize: "24px",
        color: "#ffd700",
        stroke: "#4a2800",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setScrollFactor(0);

    this.tweens.add({
      targets: toast,
      alpha: { from: 0, to: 1 },
      duration: 200,
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            duration: 300,
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
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
      const exitX = this.pipCol * TILE_SIZE + TILE_SIZE / 2;
      const exitY = this.pipRow * TILE_SIZE + TILE_SIZE / 2;
      const particles = this.add.particles(exitX, exitY, "__DEFAULT", {
        speed: { min: 80, max: 250 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6, end: 0 },
        tint: [0xffd700, 0xff8800, 0xffffff],
        lifespan: 900,
        quantity: 25,
        emitting: false,
      });
      particles.explode(25);
      this._winParticles = particles;
      this.time.delayedCall(600, () => {
        this.scene.start("WinScene", { level: this.levelIndex });
      });
    }
  }

  _fireStarEmitter() {
    // Particle effect stubbed out — to be implemented later.
  }

  _revealKey2() {
    const k = this.keyState[1];
    const x = k.col * TILE_SIZE + TILE_SIZE / 2;
    const y = k.row * TILE_SIZE + TILE_SIZE / 2;

    k.sprite = drawKey(this, x, y);
    k.sprite.setAlpha(0);

    this.tweens.add({
      targets: k.sprite,
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: "Sine.easeOut",
      onComplete: () => {
        k.pulseTween = this.tweens.add({
          targets: k.sprite,
          alpha: { from: 1, to: 0.65 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      },
    });
  }

  resetPip() {
    this.tweens.killTweensOf(this.pip);
    this.showFlash(0xff0000, 0.25, 300);
    this.pipMoving = false;
    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this.pip.setPosition(
      this.startCol * TILE_SIZE + TILE_SIZE / 2,
      this.startRow * TILE_SIZE + TILE_SIZE / 2,
    );
    this.pipFacing = "down";
    this.pip.play(`${this.playerAnimKey}-idle-down`);
    this.tweens.add({
      targets: this.pip,
      alpha: { from: 0.3, to: 1 },
      duration: 400,
      ease: "Linear",
    });

    if (this.keysCollected === 0) return;

    const lostIndex = this.keysCollected - 1;

    if (this._keyHudIcons[lostIndex]) {
      this._keyHudIcons[lostIndex].destroy();
      this._keyHudIcons[lostIndex] = null;
    }
    if (this.requiredKeys === 2 && !this._keyHudSlots[lostIndex]) {
      const hudX =
        lostIndex === 0 ? this.scale.width - 72 : this.scale.width - 32;
      this._keyHudSlots[lostIndex] = drawKeyIcon(this, hudX, 24);
      this._keyHudSlots[lostIndex].setAlpha(0.25).setDepth(50).setScrollFactor(0);
    }

    if (lostIndex === 0 && this.keyState.length > 1) {
      const k2 = this.keyState[1];
      if (k2.sprite && !k2.collected) {
        this.tweens.killTweensOf(k2.sprite);
        if (k2.pulseTween) {
          k2.pulseTween.stop();
          k2.pulseTween = null;
        }
        k2.sprite.destroy();
        k2.sprite = null;
        if (this._key2RevealEmitter) {
          this._key2RevealEmitter.stop();
          this._key2RevealEmitter.destroy();
          this._key2RevealEmitter = null;
        }
        if (!this._keyHudSlots[1]) {
          this._keyHudSlots[1] = drawKeyIcon(this, this.scale.width - 32, 24);
          this._keyHudSlots[1].setAlpha(0.25).setDepth(50).setScrollFactor(0);
        }
      }
    }

    this.respawnKey(lostIndex);
    this.keysCollected--;
  }

  checkHazards() {
    if (this._winTriggered) return;
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
    if (this._winTriggered) return;
    for (const { col, row, active } of this.bladeZones) {
      if (active() && this.pipCol === col && this.pipRow === row) {
        this.resetPip();
        return;
      }
    }
  }

  checkSpikeHazards() {
    if (this._winTriggered) return;
    for (const { rect, col, row } of this.spikeRects) {
      if (rect.active && this.pipCol === col && this.pipRow === row) {
        this.resetPip();
        return;
      }
    }
  }

  update() {
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
