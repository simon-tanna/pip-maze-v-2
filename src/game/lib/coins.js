// src/game/lib/coins.js
// Chamber coin pickups: key-style glow, bob and gold light, a seeded shine
// sweep with a star glint, and a flight to the HUD coin panel on pickup.
// Coins bank in onCollect the moment they're touched; the flight is only juice.
import Phaser from 'phaser';
import { TILE_SIZE } from './constants.js';
import { P, LIGHT } from './palette.js';
import { DEPTH } from './hazards.js';
import { HAZARD_KEYS, COIN_FRAMES } from './hazard-art.js';
import { tileRng } from './generator.js';
import { reducedMotion } from './fx.js';

const centre = (n) => n * TILE_SIZE + TILE_SIZE / 2;
const SHINE_REPEAT_DELAY = 1100;
const SHINE_PHASE_MS = 1500;
const FLY_MS = 450;

// coins: [{ col, row }]. target() → HUD screen point or null (no flight).
// onCollect() runs on pickup; its return value is handed to onLand(value).
export function createCoins(scene, coins, { fx, seed, target, onCollect, onLand }) {
  const calm = reducedMotion();
  const flyers = new Set();
  let dead = false;

  const records = coins.map(({ col, row }) => {
    const x = centre(col);
    const y = centre(row);
    const sprite = scene.add.sprite(x, y, HAZARD_KEYS.coin(0)).setDepth(DEPTH.pickup);
    sprite.enableFilters();
    sprite.filters.internal.addGlow(P.GOLD_LIGHT, 2, 0, 1);
    const light = scene.lights.addLight(x, y, 40, LIGHT.GOLD, 0.4);
    const rec = { col, row, sprite, light, glint: null, collected: false };
    if (calm) return rec;

    scene.tweens.add({
      targets: sprite, y: y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    sprite.play({
      key: 'pk-coin-shine',
      repeat: -1,
      repeatDelay: SHINE_REPEAT_DELAY,
      delay: Math.floor(tileRng(seed, col, row)() * SHINE_PHASE_MS),
    });
    rec.glint = scene.add.image(0, 0, HAZARD_KEYS.sparkle)
      .setDepth(DEPTH.pickup + 0.1).setScale(0).setVisible(false);
    const lastSweep = HAZARD_KEYS.coin(COIN_FRAMES - 1);
    sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_anim, frame) => {
      if (frame.textureKey !== lastSweep) return;
      rec.glint.setPosition(sprite.x - 7, sprite.y - 7).setVisible(true).setScale(0);
      scene.tweens.add({
        targets: rec.glint, scale: 1.5, duration: 120, yoyo: true,
        onComplete: () => rec.glint?.setVisible(false),
      });
    });
    return rec;
  });

  function clear(rec) {
    scene.tweens.killTweensOf(rec.sprite);
    rec.sprite.destroy();
    if (rec.glint) {
      scene.tweens.killTweensOf(rec.glint);
      rec.glint.destroy();
      rec.glint = null;
    }
    scene.lights.removeLight(rec.light);
  }

  function tryCollect(col, row) {
    if (dead) return false;
    const rec = records.find((r) => !r.collected && r.col === col && r.row === row);
    if (!rec) return false;
    rec.collected = true;

    const cam = scene.cameras.main;
    const wx = rec.sprite.x;
    const wy = rec.sprite.y;
    if (!calm) fx.sparkle.explode(8, wx, wy);
    clear(rec);
    const value = onCollect();

    const to = target();
    if (!to) {
      onLand(value);
      return true;
    }
    const flyer = scene.add.image(wx - cam.scrollX, wy - cam.scrollY, HAZARD_KEYS.coin(0))
      .setScrollFactor(0).setDepth(900);
    flyers.add(flyer);
    scene.tweens.add({
      targets: flyer, x: to.x, y: to.y, scale: 0.85, duration: FLY_MS, ease: 'Cubic.easeInOut',
      onComplete: () => {
        flyers.delete(flyer);
        flyer.destroy();
        if (!dead) onLand(value);
      },
    });
    return true;
  }

  function destroy() {
    dead = true;
    records.filter((r) => !r.collected).forEach(clear);
    flyers.forEach((f) => {
      scene.tweens.killTweensOf(f);
      f.destroy();
    });
    flyers.clear();
  }

  return { tryCollect, destroy };
}
