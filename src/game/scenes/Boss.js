import Phaser from 'phaser';
import { TILE_SIZE } from '../lib/constants.js';
import { LEVEL_CONFIGS, mulberry32 } from '../lib/generator.js';
import {
  CHARACTER_CONFIGS,
  createPlayer,
  drawPillar,
  drawPillarRunes,
  drawLavaGlow,
  drawLavaChannel,
  drawLavaPool,
  bakeBossFloorTextures,
  drawBossFloorTile,
} from '../lib/graphics.js';
import { showFireButton } from '../lib/dpad.js';

const TINT_RED = 0xff0000;

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

    this._heartIcons     = [];
    this._eyeIcons       = [];
    this._allGraphics    = [];
    this._domHandlers    = [];

    this.add.rectangle(480, 360, 960, 720, 0x1a1208);

    bakeBossFloorTextures(this);
    const floorRng = mulberry32(0xB055F100);
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 20; col++) {
        const r = floorRng();
        const variant = r < 0.80 ? 0
                      : r < 0.90 ? 1
                      : r < 0.97 ? 2
                      : 3;
        const tile = drawBossFloorTile(
          this,
          col * TILE_SIZE + TILE_SIZE / 2,
          row * TILE_SIZE + TILE_SIZE / 2,
          variant,
        );
        tile.setDepth(0.1);
        this._allGraphics.push(tile);
      }
    }

    const PILLAR_POSITIONS = [
      { x: 192, y: 216 },
      { x: 768, y: 216 },
      { x: 192, y: 504 },
      { x: 768, y: 504 },
    ];

    this._pillarGroup = this.physics.add.staticGroup();

    PILLAR_POSITIONS.forEach(({ x, y }) => {
      const glow = drawLavaGlow(this, x, y, 140, 160);
      glow.setDepth(0.3);
      this._allGraphics.push(glow);

      const pg = drawPillar(this, x, y);
      pg.setDepth(0.4);
      this._allGraphics.push(pg);

      const runes = drawPillarRunes(this, x, y, 0x90FF0000 ^ (x * 31 + y));
      runes.setDepth(0.5);
      this._allGraphics.push(runes);

      const channel = drawLavaChannel(this, x, y, 96, { width: 8, midCrack: true });
      channel.setDepth(0.6);
      this._allGraphics.push(channel);

      const pool = drawLavaPool(this, x, y + 48 + 4, 96, 22);
      pool.setDepth(0.6);
      this._allGraphics.push(pool);

      const pillarBody = this.add.rectangle(x, y, 96, 96, 0x000000, 0);
      this.physics.add.existing(pillarBody, true);
      this._pillarGroup.add(pillarBody);
    });

    const wallChannels = [
      { x: 24,  y: 360, height: 660 },
      { x: 936, y: 360, height: 660 },
    ];
    wallChannels.forEach(({ x, y, height }) => {
      const wGlow = drawLavaGlow(this, x, y, 80, height + 40);
      wGlow.setDepth(0.3);
      this._allGraphics.push(wGlow);
      const wCh = drawLavaChannel(this, x, y, height, { width: 10, midCrack: false });
      wCh.setDepth(0.6);
      this._allGraphics.push(wCh);
    });

    this._hero = createPlayer(this, 480, 620);
    this._hero.setDepth(5);
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
    this._allGraphics.push(this._bossGfx);

    this._bossBody = this.add.rectangle(480, BOSS_START_Y, BOSS_W, BOSS_H, 0x000000, 0);
    this.physics.add.existing(this._bossBody);
    this._bossBody.body.setCollideWorldBounds(false);
    this._bossBody.body.allowGravity = false;

    this._crackGfx = this.add.graphics();
    this._allGraphics.push(this._crackGfx);

    this.physics.world.on('worldbounds', (body) => {
      const proj = this._projectiles.find(p => p.body === body);
      if (proj) {
        proj.body.enable = false;
        proj.setActive(false).setVisible(false);
      }
    });

    this._buildHUD();

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
      this._heartIcons.forEach(h => { if (h && h.destroy) h.destroy(); });
      this._eyeIcons.forEach(e => { if (e && e.destroy) e.destroy(); });

      this._domHandlers.forEach(({ el, type, fn }) => {
        el.removeEventListener(type, fn);
      });
      this._domHandlers = [];

      showFireButton(false);
    });

    this._playBossEntrance(BOSS_LAND_Y);
  }

  _buildHUD() {
    for (let i = 0; i < 3; i++) {
      const heart = this.add.graphics();
      heart.fillStyle(0xcc0000, 1);
      heart.fillCircle(0, 0, 10);
      heart.x = 28 + i * 30;
      heart.y = 24;
      heart.setDepth(50).setScrollFactor(0);
      this._heartIcons.push(heart);
      this._allGraphics.push(heart);
    }

    for (let i = 0; i < 3; i++) {
      const eye = this.add.graphics();
      eye.fillStyle(0xffe000, 1);
      eye.fillCircle(0, 0, 10);
      eye.fillStyle(0x000000, 1);
      eye.fillRect(-2, -8, 4, 16);
      eye.x = 960 - 28 - (2 - i) * 30;
      eye.y = 24;
      eye.setDepth(50).setScrollFactor(0);
      this._eyeIcons.push(eye);
      this._allGraphics.push(eye);
    }
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
        this._crackGfx.fillStyle(0x0a0604, 1);
        this._crackGfx.fillEllipse(480, landY + 90, 60 * t, 16);
      },
    });

    this.tweens.add({
      targets: this._bossBody,
      y: landY,
      duration: 1200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cameras.main.shake(300, 0.018);

        const toast = this.add.text(480, 280, 'GRAARGH!', {
          fontSize: '52px', color: '#cc0000', fontStyle: 'bold',
          stroke: '#440000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(100);

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
        else             this._bossGfx.clearTint();
      },
    });

    this.time.delayedCall(3000, () => {
      this._bossInvincible = false;
      this._bossGfx.clearTint();
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

  _doStomp() {
    const BOSS_H = 192;
    const feetY  = this._bossBody.y + BOSS_H * 0.5;
    const wave   = this.add.rectangle(this._bossBody.x, feetY, 0, 14, 0xcc6600, 0.7);
    wave.setDepth(5);

    this.tweens.add({
      targets: wave,
      width: 960,
      alpha: { from: 0.7, to: 0 },
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
  }

  fireProjectile() {
    if (!this._inputEnabled || this._victoryActive) return;
    const now = this.time.now;
    if (now - this._lastFired < 400) return;
    this._lastFired = now;

    const charKey = this.game.registry.get('character') || 'pip';
    const PROJ_STATS = {
      pip:   { speed: 420, w: 6,  h: 18, color: 0xffdd00 },
      john:  { speed: 600, w: 5,  h: 5,  color: 0xffffff },
      ellen: { speed: 280, w: 8,  h: 28, color: 0x8B5E3C },
    };
    const stats = PROJ_STATS[charKey] || PROJ_STATS.pip;

    const proj = this.add.rectangle(
      this._hero.x + this._facing.x * 20,
      this._hero.y + this._facing.y * 20,
      stats.w, stats.h, stats.color,
    );
    proj.setDepth(10);

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
    this._updateHeartHUD();

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

  _updateHeartHUD() {
    this._heartIcons.forEach((heart, i) => {
      heart.clear();
      if (i < this._heroHp) {
        heart.fillStyle(0xcc0000, 1);
      } else {
        heart.fillStyle(0x440000, 1);
      }
      heart.fillCircle(0, 0, 10);
    });
  }

  _registerEyeHit() {
    if (this._bossInvincible || this._bossState === 'dead') return;

    this._bossHp = Math.max(0, this._bossHp - 1);

    if (this._eyeIcons[this._bossHp]) {
      const eye = this._eyeIcons[this._bossHp];
      eye.clear();
      eye.fillStyle(0x555500, 1);
      eye.fillCircle(0, 0, 10);
      eye.fillStyle(0x222200, 1);
      eye.fillRect(-2, -8, 4, 16);
    }

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
        this.cameras.main.fade(400, 0, 0, 0);
        this.time.delayedCall(450, () => {
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
    this._bossGfx.clearTint();
    this._bossGfx.play('troll-death', true);
    this._clubActive = false;

    this.tweens.add({
      targets: this._bossGfx,
      alpha: { from: 1, to: 0.2 },
      duration: 100, yoyo: true, repeat: 5,
      onComplete: () => {
        this._eyeIcons.forEach(eye => {
          eye.clear();
          eye.fillStyle(0x333300, 1);
          eye.fillCircle(0, 0, 10);
        });

        const xText = this.add.text(
          this._bossBody.x, this._bossBody.y - 60, '✕',
          { fontSize: '48px', color: '#cc0000', fontStyle: 'bold' },
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
            const flash = this.add.rectangle(480, 360, 960, 720, 0xffffff, 1);
            flash.setDepth(200);
            this.tweens.add({
              targets: flash, alpha: 0, duration: 600,
              onComplete: () => { flash.destroy(); this._showVictoryScreen(); },
            });
          },
        });
      },
    });
  }

  _showVictoryScreen() {
    this.add.text(480, 160, 'THE TEMPLE IS YOURS', {
      fontSize: '42px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#4a2800', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(50);

    const charKey = this.game.registry.get('character') || 'pip';
    const cfg     = CHARACTER_CONFIGS[charKey] || CHARACTER_CONFIGS.pip;
    this._victorySprite = this.add.image(480, 480, `${cfg.animKey}-win`);
    this._victorySprite.setScale((TILE_SIZE * 3) / this._victorySprite.height);
    this._victorySprite.setDepth(10);

    this._victoryActive = true;

    const playAgain = this.add.text(480, 640, 'Play Again', {
      fontSize: '32px', color: '#fff9e6',
      stroke: '#4a2800', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true });

    playAgain.on('pointerdown', () => {
      this.game.registry.set('levelSeeds', Array(LEVEL_CONFIGS.length).fill(null));
      this.scene.start('TitleScene');
    });
    this.input.keyboard.once('keydown', () => {
      this.game.registry.set('levelSeeds', Array(LEVEL_CONFIGS.length).fill(null));
      this.scene.start('TitleScene');
    });
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

  update() {
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
