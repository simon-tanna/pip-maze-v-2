import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { LEVEL_CONFIGS } from '../lib/generator.js';
import { CHARACTER_CONFIGS } from '../lib/graphics.js';
import { showFireButton } from '../lib/dpad.js';
import { P, LIGHT } from '../lib/palette.js';
import { drawChamber, bakeBossArenaTextures, PILLAR, LAVA_TILE } from '../lib/environment.js';
import { HAZARD_KEYS } from '../lib/hazard-art.js';
import { createHero } from '../lib/hero.js';
import { createWorldFx, flash, iris, reducedMotion, shake } from '../lib/fx.js';
import { TEXT, createButton } from '../lib/ui.js';

const TINT_RED = P.BLOOD;
// Warm multiply grade that pulls the painted troll toward the temple palette.
const BOSS_GRADE = 0xead2bc;
const ARENA_AMBIENT = 0x9a8890;

export class BossScene extends Phaser.Scene {
  constructor() {
    super({
      key: 'BossScene',
      physics: { default: 'arcade', arcade: { debug: false } },
    });
  }

  create() {
    this._inputEnabled   = false;
    this._victoryActive  = false;
    this._victorySprite  = null;

    this._heroHp         = 3;
    this._bossHp         = 3;
    this._heroInvincible = false;
    this._bossInvincible = false;

    this._bossState      = 'idle';
    this._bossStateTimer = null;
    this._chargeTimeout  = null;
    this._chargeDir      = { x: 0, y: 0 };
    this._chargeCount    = 0;
    this._clubActive     = false;
    this._clubTimer      = null;

    this._projectiles    = [];
    this._lastFired      = 0;
    this._facing         = { x: 0, y: -1 };
    this._heldDirs       = new Set();

    this._heroFlashTimer = null;
    this._bossFlashTimer = null;

    this._allGraphics    = [];
    this._domHandlers    = [];

    this.lights.enable().setAmbientColor(ARENA_AMBIENT);
    this.fx = createWorldFx(this);
    bakeBossArenaTextures(this);
    const arenaMap = Array.from({ length: 15 }, () => Array(20).fill(0));
    drawChamber(this, arenaMap, 0xB055F100, { key: 'env-boss-floor' })
      .setLighting(true).setTint(0xe6cfc4).setDepth(0.1);
    this._lavaStrips = [];

    const PILLAR_POSITIONS = [
      { x: 192, y: 216 },
      { x: 768, y: 216 },
      { x: 192, y: 504 },
      { x: 768, y: 504 },
    ];

    this._pillarGroup = this.physics.add.staticGroup();

    PILLAR_POSITIONS.forEach(({ x, y }, i) => {
      this.add.sprite(x, y + 72, 'env-lava-pool-0').setDepth(0.45).play('env-lava-pool');
      this.add.image(x, y, 'env-pillar').setOrigin(0.5, PILLAR.originY).setDepth(0.4).setLighting(true);
      this._lavaStrips.push(this.add.tileSprite(x, y + 8, 8, 96, 'env-lava').setDepth(0.6));
      const runes = this.add.image(x, y, `env-runes-${i}`).setDepth(0.5);
      this.tweens.add({
        targets: runes, alpha: { from: 0.5, to: 1 }, duration: 900 + i * 130, delay: i * 150,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      const light = this.lights.addLight(x, y + 72, 240, LIGHT.FLAME, 1.6);
      this.tweens.add({ targets: light, intensity: 1.75, duration: 140 + i * 20, yoyo: true, repeat: -1 });

      const pillarBody = this.add.rectangle(x, y, 96, 96, 0x000000, 0);
      this.physics.add.existing(pillarBody, true);
      this._pillarGroup.add(pillarBody);
    });

    [24, 936].forEach((x) => {
      this._lavaStrips.push(this.add.tileSprite(x, 360, LAVA_TILE.w - 4, 660, 'env-lava').setDepth(0.6));
      [220, 500].forEach((y) => this.lights.addLight(x, y, 240, LIGHT.FLAME, 1.4));
    });

    this._heroRig = createHero(this, 480, 620, undefined, { depth: 5, fx: this.fx });
    this._hero = this._heroRig.sprite;
    this._torch = this.lights.addLight(480, 620, 220, LIGHT.TORCH, 1.3);
    this.physics.add.existing(this._hero);
    this._hero.body.setCollideWorldBounds(true);
    this._hero.body.setSize(TILE_SIZE * 0.6, TILE_SIZE * 0.6);
    this._heroSpeed = 180;

    const charKey     = this.game.registry.get('character') || 'pip';
    const animKey     = (CHARACTER_CONFIGS[charKey] || CHARACTER_CONFIGS.pip).animKey;
    this._heroAnimKey = animKey;
    this._hero.play(`${animKey}-idle-up`);

    const BOSS_START_Y = 720 + 96;
    const BOSS_LAND_Y  = 180;
    const BOSS_W = 144, BOSS_H = 192;

    this._bossH = BOSS_H;
    this._bossGfx = this.add.sprite(480, BOSS_START_Y + BOSS_H / 2, 'battle-troll', 'idle-0');
    this._bossGfx.setOrigin(0.5, 1.0);
    this._bossGfx.setDepth(10);

    const TROLL_TARGET_HEIGHT = 220;
    const sizeToTarget = () => {
      const f = this._bossGfx.frame;
      this._bossGfx.displayHeight = TROLL_TARGET_HEIGHT;
      this._bossGfx.displayWidth  = f.width * (TROLL_TARGET_HEIGHT / f.height);
    };
    this._bossGfx.on('animationupdate', sizeToTarget);
    sizeToTarget();

    this._bossGfx.play('troll-idle');
    this._gradeBoss();
    this._bossGfx.enableFilters();
    this._bossGfx.filters.internal.addColorMatrix().colorMatrix.saturate(-0.25);
    this._bossGfx.filters.internal.addGlow(P.INK, 3, 0, 1, false, 10, 3);
    this._allGraphics.push(this._bossGfx);
    this._aimMarks = Array.from({ length: 6 }, () => this.add.image(0, 0, HAZARD_KEYS.arrow)
      .setScale(1.5).setTint(P.FIRE_HOT).setDepth(4).setVisible(false));
    this._aiming = false;

    this._bossBody = this.add.rectangle(480, BOSS_START_Y, BOSS_W, BOSS_H, 0x000000, 0);
    this.physics.add.existing(this._bossBody);
    this._bossBody.body.setCollideWorldBounds(false);
    this._bossBody.body.allowGravity = false;

    this._crackGfx = this.add.graphics().setDepth(0.8);
    this._allGraphics.push(this._crackGfx);

    this.physics.world.on('worldbounds', (body) => {
      const proj = this._projectiles.find(p => p.body === body);
      if (proj) {
        proj.body.enable = false;
        proj.setActive(false).setVisible(false);
      }
    });

    this.scene.launch('HudScene', { mode: 'boss', source: 'BossScene', heroHp: 3, bossMax: 3 });
    this.cameras.main.filters.external.addVignette(0.5, 0.5, 1.0, 0.25, P.INK);
    iris(this, 480, 620, 'open', 420);

    this.physics.add.overlap(
      this._hero,
      this._bossBody,
      () => { this._onHeroHitBoss(); },
      null, this,
    );

    this.physics.add.collider(
      this._bossBody,
      this._pillarGroup,
      () => { this._onBossHitPillar(); },
      null, this,
    );

    this.physics.add.collider(this._hero, this._pillarGroup);

    this.setupInput();

    this.events.once('shutdown', () => {
      this.time.removeAllEvents();
      this._allGraphics.forEach(g => { if (g && g.destroy) g.destroy(); });
      this._projectiles.forEach(p => { if (p && p.destroy) p.destroy(); });

      this._domHandlers.forEach(({ el, type, fn }) => {
        el.removeEventListener(type, fn);
      });
      this._domHandlers = [];

      showFireButton(false);
    });

    this._playBossEntrance(BOSS_LAND_Y);
  }

  hud(msg) {
    this.events.emit('hud', msg);
  }

  _gradeBoss() {
    this._bossGfx.setTint(BOSS_GRADE).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  _playBossEntrance(landY) {
    this._inputEnabled = false;

    this.tweens.add({
      targets: this._crackGfx,
      duration: 600,
      delay: 400,
      onUpdate: (tween) => {
        const t = tween.progress;
        this._crackGfx.clear();
        this._crackGfx.fillStyle(P.INK, 1);
        this._crackGfx.fillEllipse(480, landY + 90, 60 * t, 16);
      },
    });

    this.tweens.add({
      targets: this._bossBody,
      y: landY,
      duration: 1200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        shake(this, 300, 0.012);
        this.fx.puff.explode(16, this._bossBody.x, landY + 90);

        const toast = this.add.text(480, 280, 'GRAARGH!', TEXT.logo(56)).setOrigin(0.5).setDepth(100);

        this.tweens.add({
          targets: toast,
          alpha: { from: 1, to: 0 },
          duration: 800,
          delay: 400,
          onComplete: () => toast.destroy(),
        });

        this.time.delayedCall(600, () => {
          this._inputEnabled = true;
          this._startBossIdle();
        });
      },
    });
  }

  _startBossIdle() {
    this._bossState = 'idle';
    this._setBossVelocity(0, 0);
    this._bossGfx.play('troll-idle', true);
    // Telegraph inside the existing 1500ms idle: the last 500ms shows the aim.
    this.time.delayedCall(1000, () => {
      if (this._bossState === 'idle') this._setAiming(true);
    });
    this._bossStateTimer = this.time.delayedCall(1500, () => {
      if (this._bossState !== 'idle') return;
      this._startBossCharge();
    });
  }

  _startBossCharge() {
    if (this._bossState === 'dead') return;
    if (this._clubTimer) { this._clubTimer.remove(false); this._clubTimer = null; }
    this._clubActive = false;
    this._bossState = 'charging';
    this._setAiming(false);

    const dx = this._hero.x - this._bossBody.x;
    const dy = this._hero.y - this._bossBody.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this._chargeDir = { x: dx / len, y: dy / len };

    const CHARGE_SPEED = 320;
    this._setBossVelocity(this._chargeDir.x * CHARGE_SPEED, this._chargeDir.y * CHARGE_SPEED);
    this._bossGfx.play('troll-walk', true);

    this._chargeTimeout = this.time.delayedCall(2000, () => {
      if (this._bossState === 'charging') this._startBossRecovering();
    });
  }

  _startBossRecovering() {
    if (this._bossState === 'dead') return;
    this._bossState = 'recovering';
    this._chargeCount++;

    if (this._chargeTimeout) { this._chargeTimeout.remove(false); this._chargeTimeout = null; }

    const RECOVER_SPEED = 60;
    const dx = this._hero.x - this._bossBody.x;
    const dy = this._hero.y - this._bossBody.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this._setBossVelocity((dx / len) * RECOVER_SPEED, (dy / len) * RECOVER_SPEED);
    this._bossGfx.play('troll-idle', true);

    if (this._chargeCount % 4 === 0) this._doStomp();

    this._bossStateTimer = this.time.delayedCall(800, () => {
      if (this._bossState === 'recovering') this._startBossIdle();
    });
  }

  _startBossHitReaction() {
    if (this._bossState === 'dead') return;
    this._bossInvincible = true;

    this._bossGfx.setTint(TINT_RED).setTintMode(Phaser.TintModes.FILL);
    let bossFlashOn = true;
    this._bossFlashTimer = this.time.addEvent({
      delay: 200,
      repeat: 14,
      callback: () => {
        bossFlashOn = !bossFlashOn;
        if (bossFlashOn) this._bossGfx.setTint(TINT_RED).setTintMode(Phaser.TintModes.FILL);
        else             this._gradeBoss();
      },
    });

    this.time.delayedCall(3000, () => {
      this._bossInvincible = false;
      this._gradeBoss();
      if (this._bossFlashTimer) { this._bossFlashTimer.remove(false); this._bossFlashTimer = null; }
    });
  }

  _onBossHitPillar() {
    if (this._bossState === 'charging') this._startBossRecovering();
  }

  _setBossVelocity(vx, vy) {
    if (this._bossBody && this._bossBody.body) {
      this._bossBody.body.setVelocity(vx, vy);
    }
  }

  // Stomp: a 350ms warning ring at the feet, then the shockwave. Both fit
  // inside the 800ms recovery window.
  _doStomp() {
    const BOSS_H = 192;
    const feetX = this._bossBody.x;
    const feetY = this._bossBody.y + BOSS_H * 0.5;
    const ring = this.add.ellipse(feetX, feetY, 240, 60).setStrokeStyle(4, P.FIRE_HOT, 1).setDepth(4).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: { from: 1, to: 0.4 }, duration: 350, ease: 'Cubic.easeOut' });
    this.time.delayedCall(350, () => {
      ring.destroy();
      if (this._bossState === 'dead') return;
      shake(this, 160, 0.006);
      this.fx.puff.explode(14, feetX, feetY);
      const wave = this.add.rectangle(feetX, feetY, 0, 14, P.FIRE, 0.75);
      wave.setDepth(5);

      this.tweens.add({
        targets: wave,
        width: 960,
        alpha: { from: 0.75, to: 0 },
        duration: 400,
        ease: 'Linear',
        onUpdate: () => {
          const heroB = this._hero.getBounds();
          const waveB = wave.getBounds();
          if (Phaser.Geom.Intersects.RectangleToRectangle(heroB, waveB)) {
            this._damageHero();
          }
        },
        onComplete: () => wave.destroy(),
      });
    });
  }

  _setAiming(on) {
    this._aiming = on;
    this._aimMarks.forEach((m) => m.setVisible(on));
    if (on) {
      this._bossGfx.setTint(P.FIRE_HOT).setTintMode(Phaser.TintModes.ADD);
      this.time.delayedCall(120, () => { if (this._bossState === 'idle' && !this._bossInvincible) this._gradeBoss(); });
    }
  }

  _updateAim() {
    if (!this._aiming) return;
    const dx = this._hero.x - this._bossBody.x;
    const dy = this._hero.y - this._bossBody.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    const pulse = (this.time.now % 300) / 300;
    this._aimMarks.forEach((m, i) => {
      const t = (i + 1 + pulse) / (this._aimMarks.length + 1);
      m.setPosition(this._bossBody.x + dx * t, this._bossBody.y + dy * t)
        .setAngle(angle).setAlpha(Math.min(1, len / 200) * (0.4 + 0.6 * (1 - t)));
    });
  }

  fireProjectile() {
    if (!this._inputEnabled || this._victoryActive) return;
    const now = this.time.now;
    if (now - this._lastFired < 400) return;
    this._lastFired = now;

    const charKey = this.game.registry.get('character') || 'pip';
    const PROJ_STATS = {
      pip:   { speed: 420, w: 6,  h: 18, color: P.GOLD_LIGHT },
      john:  { speed: 600, w: 5,  h: 5,  color: P.CREAM },
      ellen: { speed: 280, w: 8,  h: 28, color: P.STONE_LIGHT },
    };
    const stats = PROJ_STATS[charKey] || PROJ_STATS.pip;

    const proj = this.add.rectangle(
      this._hero.x + this._facing.x * 20,
      this._hero.y + this._facing.y * 20,
      stats.w, stats.h, stats.color,
    );
    proj.setDepth(10).setStrokeStyle(1, P.INK);

    this.physics.add.existing(proj);
    proj.body.setCollideWorldBounds(true);
    proj.body.onWorldBounds = true;
    proj.body.allowGravity = false;
    proj.body.setVelocity(this._facing.x * stats.speed, this._facing.y * stats.speed);

    this._projectiles.push(proj);
  }

  _onProjectileHitBoss(projGO) {
    if (!projGO || !projGO.active) return;
    projGO.body.enable = false;
    projGO.setActive(false).setVisible(false);
    this._registerEyeHit();
  }

  _onHeroHitBoss() {
    if (!this._inputEnabled || this._victoryActive) return;
    if (this._bossState === 'dead') return;
    if (!this._clubActive && this._bossState !== 'charging') return;
    this._damageHero();
  }

  _damageHero() {
    if (this._heroInvincible || this._victoryActive) return;
    if (this._heroHp <= 0) return;
    this._heroHp = Math.max(0, this._heroHp - 1);
    this._heroInvincible = true;
    this.hud({ type: 'hero-hp', hp: this._heroHp });
    flash(this, P.BLOOD, 0.18, 200);
    shake(this, 120, 0.004);

    this._hero.setTint(TINT_RED).setTintMode(Phaser.TintModes.FILL);
    let heroFlashOn = true;
    this._heroFlashTimer = this.time.addEvent({
      delay: 100,
      repeat: 9,
      callback: () => {
        heroFlashOn = !heroFlashOn;
        if (heroFlashOn) this._hero.setTint(TINT_RED).setTintMode(Phaser.TintModes.FILL);
        else this._hero.clearTint();
      },
    });

    this.time.delayedCall(1000, () => {
      this._heroInvincible = false;
      this._hero.clearTint();
      if (this._heroFlashTimer) { this._heroFlashTimer.remove(false); this._heroFlashTimer = null; }
    });

    if (this._heroHp <= 0) this._triggerHeroDeath();
  }

  _registerEyeHit() {
    if (this._bossInvincible || this._bossState === 'dead') return;

    this._bossHp = Math.max(0, this._bossHp - 1);

    this.hud({ type: 'boss-hp', hp: this._bossHp, max: 3 });
    this.fx.sparkle.explode(10, this._bossBody.x, this._bossBody.y - 40);
    shake(this, 100, 0.004);

    if (this._bossHp <= 0) { this._triggerVictory(); return; }

    this._startBossHitReaction();
  }

  _triggerHeroDeath() {
    this._bossState      = 'dead';
    this._bossInvincible = false;
    this._inputEnabled   = false;
    this._setBossVelocity(0, 0);

    if (this._heroFlashTimer) { this._heroFlashTimer.remove(false); this._heroFlashTimer = null; }
    this._hero.clearTint();

    this.tweens.add({
      targets: this._hero,
      rotation: Math.PI * 2, alpha: 0,
      duration: 600, ease: 'Linear',
      onComplete: () => {
        iris(this, this._hero.x, this._hero.y, 'close', 420, () => {
          this.game.registry.set('levelSeeds', Array(LEVEL_CONFIGS.length).fill(null));
          this.scene.start('GameScene', { level: 0 });
        });
      },
    });
  }

  _triggerVictory() {
    this._bossState      = 'dead';
    this._bossInvincible = false;
    this._inputEnabled   = false;
    this._setBossVelocity(0, 0);

    if (this._bossStateTimer) { this._bossStateTimer.remove(false); this._bossStateTimer = null; }
    if (this._chargeTimeout)  { this._chargeTimeout.remove(false);  this._chargeTimeout  = null; }
    if (this._clubTimer)      { this._clubTimer.remove(false);      this._clubTimer = null; }
    if (this._bossFlashTimer) { this._bossFlashTimer.remove(false); this._bossFlashTimer = null; }
    this._setAiming(false);
    this._gradeBoss();
    this._bossGfx.play('troll-death', true);
    this._clubActive = false;

    this.tweens.add({
      targets: this._bossGfx,
      alpha: { from: 1, to: 0.2 },
      duration: 100, yoyo: true, repeat: 5,
      onComplete: () => {
        const xText = this.add.text(
          this._bossBody.x, this._bossBody.y - 60, '✕', TEXT.heading(48, P.BLOOD),
        ).setOrigin(0.5).setDepth(30);
        this._allGraphics.push(xText);

        this.tweens.add({
          targets: this._bossBody,
          y: 720 + 200,
          duration: 1200, ease: 'Cubic.easeIn',
        });
        this.tweens.add({
          targets: this._bossGfx,
          alpha: 0,
          duration: 1200, ease: 'Cubic.easeIn',
          onComplete: () => {
            xText.destroy();
            if (reducedMotion()) { this._showVictoryScreen(); return; }
            const whiteout = this.add.rectangle(480, 360, 960, 720, P.CREAM, 1);
            whiteout.setDepth(200);
            this.tweens.add({
              targets: whiteout, alpha: 0, duration: 600,
              onComplete: () => { whiteout.destroy(); this._showVictoryScreen(); },
            });
          },
        });
      },
    });
  }

  _showVictoryScreen() {
    this.add.image(480, 420, HAZARD_KEYS.rays).setScale(4.5).setTint(P.GOLD).setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(40);
    this.add.text(480, 150, 'THE TEMPLE IS YOURS', TEXT.heading(46, P.GOLD_LIGHT)).setOrigin(0.5).setDepth(50);

    const charKey = this.game.registry.get('character') || 'pip';
    const cfg     = CHARACTER_CONFIGS[charKey] || CHARACTER_CONFIGS.pip;
    this._victorySprite = this.add.image(480, 480, `${cfg.animKey}-win`);
    this._victorySprite.setScale((TILE_SIZE * 3) / this._victorySprite.height);
    this._victorySprite.setDepth(45);
    this.fx.sparkle.setDepth(46);
    this.time.addEvent({ delay: 200, repeat: 15, callback: () => this.fx.sparkle.explode(6, 480, 400) });

    this._victoryActive = true;

    const restart = () => {
      this.game.registry.set('levelSeeds', Array(LEVEL_CONFIGS.length).fill(null));
      this.scene.start('TitleScene');
    };
    createButton(this, 480, 640, 'PLAY AGAIN', { width: 240, onClick: restart }).setFocused(true).setDepth(50);
    this.input.keyboard.once('keydown', restart);
  }

  setupInput() {
    this._cursors  = this.input.keyboard.createCursorKeys();
    this._spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const dirIds = ['btn-up', 'btn-down', 'btn-left', 'btn-right'];
    dirIds.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const down  = (e) => { e.preventDefault(); this._heldDirs.add(id); };
      const up    = () => this._heldDirs.delete(id);
      const leave = () => this._heldDirs.delete(id);
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup',   up);
      btn.addEventListener('pointerleave', leave);
      this._domHandlers.push({ el: btn, type: 'pointerdown', fn: down });
      this._domHandlers.push({ el: btn, type: 'pointerup',   fn: up });
      this._domHandlers.push({ el: btn, type: 'pointerleave', fn: leave });
    });

    const fireBtn = document.getElementById('btn-fire');
    showFireButton(true);
    if (fireBtn) {
      const fireDown = (e) => { e.preventDefault(); this.fireProjectile(); };
      fireBtn.addEventListener('pointerdown', fireDown);
      this._domHandlers.push({ el: fireBtn, type: 'pointerdown', fn: fireDown });
    }

    this._spaceKey.on('down', () => { this.fireProjectile(); });
  }

  update(time, delta) {
    if (this._heroRig) {
      this._heroRig.sync();
      this._torch.x = this._hero.x;
      this._torch.y = this._hero.y;
    }
    this._lavaStrips.forEach((strip) => { strip.tilePositionY -= delta * 0.03; });
    this._updateAim();
    if (this._bossGfx && this._bossBody) {
      this._bossGfx.x = this._bossBody.x;
      this._bossGfx.y = this._bossBody.y + this._bossH / 2;
    }

    if (!this._inputEnabled || this._victoryActive) {
      if (this._hero && this._hero.body) this._hero.body.setVelocity(0, 0);
      return;
    }

    let vx = 0, vy = 0;
    if (this._cursors.left.isDown  || this._heldDirs.has('btn-left'))  vx = -this._heroSpeed;
    if (this._cursors.right.isDown || this._heldDirs.has('btn-right')) vx =  this._heroSpeed;
    if (this._cursors.up.isDown    || this._heldDirs.has('btn-up'))    vy = -this._heroSpeed;
    if (this._cursors.down.isDown  || this._heldDirs.has('btn-down'))  vy =  this._heroSpeed;

    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }

    this._hero.body.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      const prevFacingKey = this._facing.x !== 0 ? (this._facing.x < 0 ? 'left' : 'right')
                                                   : (this._facing.y < 0 ? 'up' : 'down');

      if (Math.abs(vx) >= Math.abs(vy)) {
        this._facing = { x: Math.sign(vx), y: 0 };
      } else {
        this._facing = { x: 0, y: Math.sign(vy) };
      }

      const dir = this._facing.x < 0 ? 'left'
                : this._facing.x > 0 ? 'right'
                : this._facing.y < 0 ? 'up' : 'down';

      if (dir !== prevFacingKey || !this._hero.anims.isPlaying) {
        this._hero.play(`${this._heroAnimKey}-walk-${dir}`, true);
      }
    } else {
      const dir = this._facing.x < 0 ? 'left'
                : this._facing.x > 0 ? 'right'
                : this._facing.y < 0 ? 'up' : 'down';
      if (this._hero.anims.currentAnim?.key !== `${this._heroAnimKey}-idle-${dir}`) {
        this._hero.play(`${this._heroAnimKey}-idle-${dir}`, true);
      }
    }

    if (this._bossState === 'charging' && this._bossBody) {
      const dx = this._hero.x - this._bossBody.x;
      const dy = this._hero.y - this._bossBody.y;
      if (Math.sqrt(dx * dx + dy * dy) < 60) this._startBossRecovering();
    }

    if (
      (this._bossState === 'idle' || this._bossState === 'recovering') &&
      !this._clubActive && this._bossBody
    ) {
      const dx = this._hero.x - this._bossBody.x;
      const dy = this._hero.y - this._bossBody.y;
      if (Math.sqrt(dx * dx + dy * dy) < 80) {
        this._clubActive = true;
        this._bossGfx.play('troll-attack', true);
        this.fx.dust.explode(6, this._bossBody.x + Math.sign(dx) * 40, this._bossBody.y + 80);
        this._clubTimer  = this.time.delayedCall(400, () => {
          this._clubActive = false;
          this._clubTimer  = null;
          if (this._bossState === 'idle' || this._bossState === 'recovering') {
            this._bossGfx.play('troll-idle', true);
          }
        });
      }
    }

    if (this._projectiles.length > 0) {
      this.physics.overlap(this._projectiles, this._bossBody, (projGO) => {
        this._onProjectileHitBoss(projGO);
      });
      this.physics.collide(this._projectiles, this._pillarGroup, (projGO) => {
        if (!projGO || !projGO.active) return;
        projGO.body.enable = false;
        projGO.setActive(false).setVisible(false);
      });
      this._projectiles = this._projectiles.filter(p => {
        if (!p.active) {
          p.destroy();
          return false;
        }
        return true;
      });
    }
  }
}
