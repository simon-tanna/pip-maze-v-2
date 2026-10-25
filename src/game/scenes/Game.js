import Phaser from "phaser";
import { TILE_SIZE } from "../lib/constants.js";
import {
  LEVEL_CONFIGS,
  SPAWN_SAFE_RADIUS,
  generateLevel,
  criticalPath,
  isFair,
  tileRng,
  tilesWithin,
} from "../lib/generator.js";
import { CHARACTER_CONFIGS, drawChest, drawKey } from "../lib/graphics.js";
import { P, LIGHT } from "../lib/palette.js";
import { drawChamber, planDecor } from "../lib/environment.js";
import {
  DEPTH,
  HAZARD_CYCLE,
  createFlameTrap,
  createSpikeTrap,
  createBladeTrap,
} from "../lib/hazards.js";
import { createGridPathfinder } from "../lib/grid-path.js";
import { createMummyController } from "../lib/mummy-ai.js";
import { createHero } from "../lib/hero.js";
import { createWorldFx, flash, hitStop, iris, shake } from "../lib/fx.js";
import { TEXT } from "../lib/ui.js";
import { hudKeySlotPos } from "./Hud.js";
import { showDpad } from "../lib/dpad.js";
import { createGridInput } from "../lib/grid-input.js";
import { createCoins } from "../lib/coins.js";
import { setPlayerCoins } from "../lib/player-db.js";

const T = TILE_SIZE;
const centre = (n) => n * T + T / 2;
// Hazards ignore the hero this long after a respawn.
const RESPAWN_GRACE_MS = 1000;

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  init(data) {
    this.levelIndex = data && data.level !== undefined ? data.level : 0;
    this.flameRects = [];
    this.bladeZones = [];
    this.mummyList = [];
    // Phaser reuses this instance across levels; drop the previous map's pathfinder.
    this.pathfinder = null;
    this.spawnZone = null;
    this._bladeTweens = [];
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
    this.levelSeed = levelSeed;
    this.currentLevel = generateLevel(this.levelIndex, levelSeed);
    const levelData = this.currentLevel;
    this.map = levelData.map;
    this.requiredKeys = levelData.key2 ? 2 : 1;
    this.keyState = [
      levelData.key,
      ...(levelData.key2 ? [levelData.key2] : []),
    ].map((k) => ({
      col: k.col,
      row: k.row,
      sprite: null,
      pulseTween: null,
      light: null,
      collected: false,
    }));

    this.startCol = 0;
    this.startRow = 0;
    let exit = null;
    this.map.forEach((row, r) =>
      row.forEach((tile, c) => {
        if (tile === 2) {
          this.startCol = c;
          this.startRow = r;
        }
        if (tile === 3) exit = { col: c, row: r };
      }),
    );
    if (this.startCol === 0 && this.startRow === 0 && this.map[0][0] !== 2) {
      console.warn(
        `Level ${this.levelIndex}: no start tile (2) found in map — defaulting to [0,0]`,
      );
    }

    this.lights.enable().setAmbientColor(LIGHT.AMBIENT);
    this.fx = createWorldFx(this);

    // Static layer: walls, floor, AO and decor baked into one lit image.
    const avoid = criticalPath(
      this.map,
      { col: this.startCol, row: this.startRow },
      levelData.key,
      levelData.key2,
      exit || levelData.key,
    );
    (levelData.traps || []).forEach((t) => {
      if (t.type === "mummy") {
        for (let c = t.patrolCols[0]; c <= t.patrolCols[1]; c++)
          avoid.add(`${c},${t.row}`);
      } else avoid.add(`${t.col},${t.row}`);
    });
    this.keyState.forEach((k) => avoid.add(`${k.col},${k.row}`));
    (levelData.coins || []).forEach((c) => avoid.add(`${c.col},${c.row}`));
    drawChamber(this, this.map, levelSeed, {
      decor: planDecor(this.map, levelSeed, avoid),
    })
      .setLighting(true)
      .setDepth(0);

    if (exit) this.createChest(exit);

    this.pipCol = this.startCol;
    this.pipRow = this.startRow;
    this.pipMoving = false;
    this.pipFacing = "down";
    this.playerKey = this.game.registry.get("character") || "pip";
    this.playerAnimKey = (
      CHARACTER_CONFIGS[this.playerKey] || CHARACTER_CONFIGS.pip
    ).animKey;

    this.hero = createHero(
      this,
      centre(this.startCol),
      centre(this.startRow),
      undefined,
      { depth: DEPTH.hero, fx: this.fx },
    );
    this.pip = this.hero.sprite;
    this.pip.play(`${this.playerAnimKey}-idle-down`);
    this.torch = this.lights.addLight(
      this.pip.x,
      this.pip.y,
      230,
      LIGHT.TORCH,
      1.5,
    );

    const cam = this.cameras.main;
    cam.setBounds(0, 0, 40 * T, 15 * T);
    cam.startFollow(this.pip, true, 1, 1);
    cam.filters.external.addVignette(0.5, 0.5, 1.0, 0.25, P.INK);

    const activePlayer = this.game.registry.get("activePlayer");
    this.scene.launch("HudScene", {
      mode: "chamber",
      source: "GameScene",
      title: `CHAMBER ${this.levelIndex + 1}`,
      requiredKeys: this.requiredKeys,
      collected: 0,
      player: activePlayer
        ? { name: activePlayer.name, coins: activePlayer.coin_balance }
        : null,
    });

    this.events.once("shutdown", () => {
      this.time.removeAllEvents();
      this.tweens.timeScale = 1;
      this.time.timeScale = 1;
      this.mummyList.forEach((m) => m.stop());
      this.coins?.destroy();
      this.coins = null;
    });

    showDpad();

    this.validatePaths();
    this.setupInput();
    this.createTraps();
    this.createKey();
    this.coins = createCoins(this, this.currentLevel.coins || [], {
      fx: this.fx,
      seed: this.levelSeed,
      target: () => this.scene.get("HudScene")?.coinIconPos ?? null,
      onCollect: () => this.collectCoin(),
      onLand: (balance) => {
        if (balance != null) this.hud({ type: "coins", coins: balance, animate: true });
      },
    });
    iris(this, this.pip.x, this.pip.y, "open", 420);
  }

  createChest({ col, row }) {
    const x = centre(col);
    const y = centre(row);
    this.chest = drawChest(this, x, y).setDepth(DEPTH.pickup);
    this.chest.enableFilters();
    const glow = this.chest.filters.internal.addGlow(P.GOLD_LIGHT, 2, 0, 1);
    this._exitPulseTween = this.tweens.add({
      targets: glow,
      outerStrength: 4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.chestLight = this.lights.addLight(x, y, 90, LIGHT.GOLD, 0.6);
  }

  // Seeded start phase per tile, so hazards ripple instead of firing in unison
  // and the same seed replays the same timing.
  hazardPhase(trap, cycle) {
    return Math.floor(tileRng(this.levelSeed, trap.col + 1000, trap.row + 1000)() * cycle);
  }

  createTraps() {
    const traps = this.currentLevel.traps || [];
    traps.forEach((trap) => {
      if (trap.type === "flame")
        this.flameRects.push(
          createFlameTrap(this, trap, {
            fx: this.fx,
            lit: true,
            phase: this.hazardPhase(trap, HAZARD_CYCLE.flame),
            onIgnite: () => this.onHazardLive(trap),
          }),
        );
      if (trap.type === "blade") {
        const { zone, tween } = createBladeTrap(this, trap, {
          onEnter: () => this.onHazardLive(trap),
        });
        this.bladeZones.push(zone);
        this._bladeTweens.push(tween);
      }
      if (trap.type === "mummy") this.createMummy(trap);
      if (trap.type === "spike") {
        this.spikeRects.push(
          createSpikeTrap(this, trap, {
            fx: this.fx,
            onActive: () => this.onHazardLive(trap),
            phase: this.hazardPhase(trap, HAZARD_CYCLE.spike),
          }),
        );
      }
    });
  }

  // A hazard just turned dangerous: whoever is standing on its tile dies.
  // Landing/step checks alone miss anyone who was already there.
  onHazardLive({ col, row }) {
    this.mummyList
      .filter((m) => m.col === col && m.row === row)
      .forEach((m) => this._killMummy(m));
    this.checkHazards();
    this.checkBladeHazards();
    this.checkSpikeHazards();
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
        targets: k.sprite,
        y: y - 3,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    };
    if (fadeIn) {
      k.sprite.setAlpha(0).setScale(k.sprite.scaleX * 0.4);
      this.fx.sparkle.explode(10, x, y);
      this.tweens.add({
        targets: k.sprite,
        alpha: 1,
        scaleX: k.sprite.scaleX / 0.4,
        scaleY: k.sprite.scaleY / 0.4,
        duration: 500,
        ease: "Back.easeOut",
        onComplete: bob,
      });
    } else bob();
  }

  clearKey(k) {
    if (k.pulseTween) {
      k.pulseTween.stop();
      k.pulseTween = null;
    }
    if (k.sprite) {
      this.tweens.killTweensOf(k.sprite);
      k.sprite.destroy();
      k.sprite = null;
    }
    if (k.light) {
      this.lights.removeLight(k.light);
      k.light = null;
    }
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
    if (!this.pathfinder) {
      this.pathfinder = createGridPathfinder(this.map);
      this.spawnZone = tilesWithin(
        this.map,
        { col: this.startCol, row: this.startRow },
        SPAWN_SAFE_RADIUS,
      );
    }
    const mummy = createMummyController(this, trap, {
      map: this.map,
      pathfinder: this.pathfinder,
      hero: () =>
        this._dying || this._winTriggered
          ? null
          : { col: this.pipCol, row: this.pipRow },
      isLethal: (c, r) => this._isTileLethalForMummy(c, r),
      safeZone: this.spawnZone,
      onStep: (m) => {
        if (this._isTileLethalForMummy(m.col, m.row)) this._killMummy(m);
        else this.checkHazards();
      },
      textStyle: TEXT.heading(20, P.CURSE),
    });
    this.mummyList.push(mummy);
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

  _killMummy(mummy) {
    if (mummy.dead) return;
    mummy.kill();
    this.fx.puff.explode(12, centre(mummy.col), centre(mummy.row));
    const idx = this.mummyList.indexOf(mummy);
    if (idx !== -1) this.mummyList.splice(idx, 1);
  }

  // Dev guard: generateLevel only ships fair levels, so this should never fire.
  validatePaths() {
    const { fair, reason } = isFair(this.currentLevel);
    if (!fair)
      console.warn(`⚠ Level ${this.levelIndex + 1}: unfair layout (${reason})`);
  }

  setupInput() {
    this.gridInput = createGridInput(this, { move: (dCol, dRow) => this.tryMove(dCol, dRow), dpad: true });
  }

  // Starts one 120ms step; returns false when the hero can't move that way.
  tryMove(dCol, dRow) {
    if (this.pipMoving || this._winTriggered || this._dying) return false;
    const newCol = this.pipCol + dCol;
    const newRow = this.pipRow + dRow;

    if (newRow < 0 || newRow >= this.map.length) return false;
    if (newCol < 0 || newCol >= this.map[newRow].length) return false;

    if (this.map[newRow][newCol] === 1) return false;

    if (dCol === -1) this.pipFacing = "left";
    else if (dCol === 1) this.pipFacing = "right";
    else if (dRow === -1) this.pipFacing = "up";
    else this.pipFacing = "down";

    // ignoreIfPlaying keeps the walk cycle smooth across consecutive steps.
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
      ease: "Linear",
      onComplete: () => {
        this.hero.land();
        this.pipMoving = false;
        this.checkHazards();
        this.checkBladeHazards();
        this.checkSpikeHazards();
        this.checkWin();
        // Chain straight into the next held/buffered step, else go idle.
        if (!this.gridInput.update() && !this._dying) {
          this.pip.play(`${this.playerAnimKey}-idle-${this.pipFacing}`);
        }
      },
    });
    return true;
  }

  hud(msg) {
    this.events.emit("hud", msg);
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
    const flyer = this.add
      .image(sx, sy, "key")
      .setDisplaySize(46, 43)
      .setScrollFactor(0)
      .setDepth(900);
    const collected = this.keysCollected;
    this.tweens.add({
      targets: flyer,
      x: slot.x,
      y: slot.y,
      displayWidth: 26,
      displayHeight: 24,
      duration: 450,
      ease: "Cubic.easeInOut",
      onComplete: () => {
        flyer.destroy();
        this.hud({
          type: "keys",
          collected: Math.min(collected, this.keysCollected),
          required: this.requiredKeys,
        });
      },
    });

    if (index === 0 && this.requiredKeys === 2) {
      this._revealKey2();
    }
  }

  showToast(message) {
    this.hud({ type: "toast", text: message });
  }

  // Banks the coin straight away; returns the new balance (null if no player).
  collectCoin() {
    const player = this.game.registry.get("activePlayer");
    if (!player) return null;
    setPlayerCoins(this.game, player.name, 1);
    return this.game.registry.get("activePlayer").coin_balance;
  }

  checkWin() {
    if (this._winTriggered) return;
    this.coins?.tryCollect(this.pipCol, this.pipRow);

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
          {
            scaleX: sx * 1.2,
            scaleY: sy * 0.8,
            duration: 80,
            ease: "Quad.easeOut",
          },
          {
            scaleX: sx * 0.9,
            scaleY: sy * 1.2,
            duration: 140,
            ease: "Back.easeOut",
          },
          { scaleX: sx, scaleY: sy, duration: 120 },
        ],
      });
    }
    this.fx.sparkle.explode(28, x, y - 8);
    if (this.chestLight)
      this.tweens.add({
        targets: this.chestLight,
        intensity: 3,
        radius: 200,
        duration: 300,
      });
    shake(this, 160, 0.004);
    this.time.delayedCall(350, () => {
      iris(this, x, y, "close", 420, () =>
        this.scene.start("WinScene", { level: this.levelIndex }),
      );
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
      this.hero.setInvulnerable(RESPAWN_GRACE_MS);
      this.time.delayedCall(260, () => {
        this._dying = false;
      });
    });

    if (this.keysCollected === 0) return;

    const lostIndex = this.keysCollected - 1;

    if (lostIndex === 0 && this.keyState.length > 1) {
      const k2 = this.keyState[1];
      if (k2.sprite && !k2.collected) this.clearKey(k2);
    }

    this.respawnKey(lostIndex);
    this.keysCollected--;
    this.hud({
      type: "keys",
      collected: this.keysCollected,
      required: this.requiredKeys,
    });
  }

  checkHazards() {
    if (this._winTriggered || this._dying || this.hero.invulnerable) return;
    for (const { rect, col, row } of this.flameRects) {
      if (rect.active && this.pipCol === col && this.pipRow === row) {
        this.resetPip();
        return;
      }
    }
    for (const mummy of this.mummyList) {
      if (
        !mummy.dead &&
        this.pipCol === mummy.col &&
        this.pipRow === mummy.row
      ) {
        this.resetPip();
        return;
      }
    }
  }

  checkBladeHazards() {
    if (this._winTriggered || this._dying || this.hero.invulnerable) return;
    for (const { col, row, active } of this.bladeZones) {
      if (active() && this.pipCol === col && this.pipRow === row) {
        this.resetPip();
        return;
      }
    }
  }

  checkSpikeHazards() {
    if (this._winTriggered || this._dying || this.hero.invulnerable) return;
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
    // Picks up held keys after a respawn or hit-stop; steps chain on landing.
    if (!this.pipMoving) this.gridInput.update();
  }
}
