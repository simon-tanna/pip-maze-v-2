// src/game/lib/hero.js
// Hero presentation layered on top of the existing character sprite sheets:
// a 1px ink outline (four FILL-tinted copies), a contact shadow, step squash,
// idle breathing, hit flash and a death/respawn pop. Gameplay code keeps
// moving `rig.sprite`; call `rig.sync()` once per frame.

import Phaser from 'phaser';
import { P } from './palette.js';
import { HAZARD_KEYS } from './hazard-art.js';
import { createPlayer } from './graphics.js';
import { TILE_SIZE } from './constants.js';
import { reducedMotion } from './fx.js';

const OUTLINE_OFFSETS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const FEET_Y = TILE_SIZE / 2 - 3;

export function createHero(scene, x, y, characterKey, { depth = 5, fx = null } = {}) {
  const sprite = createPlayer(scene, x, y, characterKey).setDepth(depth);
  const base = sprite.scaleX;
  const shadow = scene.add.image(x, y + FEET_Y, HAZARD_KEYS.shadow).setDepth(depth - 0.2);
  const outlines = OUTLINE_OFFSETS.map(() => scene.add.sprite(x, y, sprite.texture.key, sprite.frame.name)
    .setScale(base)
    .setTint(P.INK)
    .setTintMode(Phaser.TintModes.FILL)
    .setDepth(depth - 0.1));

  let breath = null;
  let squashTween = null;

  const rig = { sprite, shadow, outlines, baseScale: base };

  rig.sync = () => {
    shadow.setPosition(sprite.x, sprite.y + FEET_Y)
      .setVisible(sprite.visible)
      .setAlpha(0.85 * sprite.alpha)
      .setScale(sprite.scaleX / base, 1);
    outlines.forEach((o, i) => {
      o.setPosition(sprite.x + OUTLINE_OFFSETS[i][0], sprite.y + OUTLINE_OFFSETS[i][1]);
      if (o.frame.name !== sprite.frame.name) o.setFrame(sprite.frame.name);
      o.setScale(sprite.scaleX, sprite.scaleY);
      o.setRotation(sprite.rotation);
      o.flipX = sprite.flipX;
      o.setVisible(sprite.visible);
      o.setAlpha(sprite.alpha);
    });
  };

  rig.stopBreath = () => {
    if (breath) { breath.stop(); breath = null; }
    sprite.setScale(base);
  };

  rig.startBreath = () => {
    if (breath) return;
    breath = scene.tweens.add({
      targets: sprite,
      scaleY: base * 1.03,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  };

  // Squash on departure, settle with overshoot. Fits inside a 120ms step.
  rig.step = () => {
    rig.stopBreath();
    if (squashTween) squashTween.stop();
    sprite.setScale(base * 1.12, base * 0.88);
    squashTween = scene.tweens.add({
      targets: sprite,
      scaleX: base,
      scaleY: base,
      duration: 110,
      ease: 'Back.easeOut',
    });
  };

  rig.land = () => {
    if (fx) fx.dust.explode(3, sprite.x, sprite.y + FEET_Y);
    rig.startBreath();
  };

  rig.hitFlash = (ms = 80) => {
    sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    scene.time.delayedCall(ms, () => sprite.clearTint());
  };

  // Hit → knockback → poof. Calls onGone when the hero has vanished.
  rig.die = (facing, onGone) => {
    rig.stopBreath();
    scene.tweens.killTweensOf(sprite);
    rig.hitFlash();
    const push = { left: [6, 0], right: [-6, 0], up: [0, 6], down: [0, -6] }[facing] || [0, 0];
    scene.tweens.chain({
      targets: sprite,
      tweens: [
        { x: sprite.x + push[0], y: sprite.y + push[1], duration: 110, ease: 'Cubic.easeOut' },
        { scaleX: 0, scaleY: base * 1.4, alpha: 0, duration: 160, ease: 'Cubic.easeIn' },
      ],
      onComplete: () => {
        if (fx) fx.puff.explode(10, sprite.x, sprite.y);
        onGone();
      },
    });
  };

  rig.respawn = (x, y) => {
    scene.tweens.killTweensOf(sprite);
    sprite.setPosition(x, y).setAlpha(1).setScale(0, base * 0.4).clearTint();
    if (fx) fx.dust.explode(6, x, y + FEET_Y);
    scene.tweens.add({
      targets: sprite,
      scaleX: base,
      scaleY: base,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => rig.startBreath(),
    });
  };

  // Respawn grace: hazards ignore the hero while `rig.invulnerable` is set.
  // The sprite (and so its outline/shadow via sync) flickers; reduced motion
  // holds a steady half-alpha instead.
  let flicker = null;
  rig.invulnerable = false;
  rig.setInvulnerable = (ms) => {
    if (flicker) flicker.remove();
    rig.invulnerable = true;
    const steps = Math.max(1, Math.round(ms / 80));
    const still = reducedMotion();
    let n = 0;
    sprite.setAlpha(still ? 0.55 : 0.35);
    flicker = scene.time.addEvent({
      delay: 80,
      repeat: steps - 1,
      callback: () => {
        n++;
        if (n >= steps) {
          sprite.setAlpha(1);
          rig.invulnerable = false;
          flicker = null;
        } else if (!still) sprite.setAlpha(n % 2 ? 1 : 0.35);
      },
    });
  };

  rig.destroy = () => {
    rig.stopBreath();
    [shadow, ...outlines].forEach((o) => o.destroy());
  };

  rig.sync();
  rig.startBreath();
  return rig;
}
