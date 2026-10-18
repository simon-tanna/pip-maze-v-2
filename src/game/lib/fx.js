// src/game/lib/fx.js
// Shared "juice": shake, hit-stop, flashes, iris transitions and pooled
// particle bursts. Everything motion-heavy honours prefers-reduced-motion.

import { P } from './palette.js';
import { HAZARD_KEYS } from './hazard-art.js';

export function reducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function shake(scene, duration = 140, intensity = 0.004) {
  if (reducedMotion()) return;
  scene.cameras.main.shake(duration, intensity);
}

// Freezes the scene clock and tweens for a beat. Uses real time to resume
// because the scene clock itself is stopped. Always restores, even if the
// scene shut down meanwhile: plugin timeScales survive scene restarts.
export function hitStop(scene, ms = 60) {
  const duration = reducedMotion() ? Math.min(ms, 20) : ms;
  scene.tweens.timeScale = 0;
  scene.time.timeScale = 0;
  window.setTimeout(() => {
    scene.tweens.timeScale = 1;
    scene.time.timeScale = 1;
  }, duration);
}

// Full-screen colour flash. Skipped entirely for reduced motion.
export function flash(scene, color = P.CREAM, alpha = 0.3, duration = 220) {
  if (reducedMotion()) return;
  const { width, height } = scene.scale;
  const r = scene.add.rectangle(width / 2, height / 2, width, height, color, alpha)
    .setScrollFactor(0).setDepth(1000);
  scene.tweens.add({ targets: r, alpha: 0, duration, onComplete: () => r.destroy() });
}

// Circular iris on the main camera, centred on a world point.
// mode 'close' shrinks the view to black; 'open' grows it from black.
export function iris(scene, x, y, mode, duration = 420, onComplete = null) {
  const cam = scene.cameras.main;
  const maxR = Math.hypot(scene.scale.width, scene.scale.height);
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const state = { r: mode === 'close' ? maxR : 1 };
  let alive = true;
  const dispose = () => { if (alive) { alive = false; g.destroy(); } };
  const draw = () => {
    // Step the radius in 8px increments so the edge reads as pixel art.
    const r = Math.max(1, Math.round(state.r / 8) * 8);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x, y, r);
  };
  draw();
  const mask = cam.filters.external.addMask(g);
  scene.tweens.add({
    targets: state,
    r: mode === 'close' ? 1 : maxR,
    duration: reducedMotion() ? 1 : duration,
    ease: mode === 'close' ? 'Cubic.easeIn' : 'Cubic.easeOut',
    onUpdate: draw,
    onComplete: () => {
      if (mode === 'open') {
        cam.filters.external.remove(mask);
        dispose();
      }
      if (onComplete) onComplete();
    },
  });
  scene.events.once('shutdown', dispose);
}

// One pooled emitter per scene per texture; callers burst at positions.
export function createBurstPool(scene, texture, config, depth = 6) {
  return scene.add.particles(0, 0, texture, { emitting: false, ...config }).setDepth(depth);
}

export function createWorldFx(scene) {
  return {
    dust: createBurstPool(scene, HAZARD_KEYS.dust, {
      speed: { min: 12, max: 40 },
      angle: { min: 200, max: 340 },
      lifespan: 360,
      alpha: { start: 0.9, end: 0 },
      scale: { start: 1, end: 0.4 },
      reserve: 24,
    }),
    sparkle: createBurstPool(scene, HAZARD_KEYS.sparkle, {
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      lifespan: 520,
      alpha: { start: 1, end: 0 },
      scale: { start: 1.2, end: 0.2 },
      gravityY: 120,
      reserve: 32,
    }, 7),
    ember: createBurstPool(scene, HAZARD_KEYS.ember, {
      speedY: { min: -46, max: -22 },
      speedX: { min: -8, max: 8 },
      x: { min: -10, max: 10 },
      lifespan: 650,
      alpha: { start: 1, end: 0 },
      reserve: 48,
    }, 5),
    puff: createBurstPool(scene, HAZARD_KEYS.dust, {
      speed: { min: 30, max: 90 },
      angle: { min: 0, max: 360 },
      lifespan: 420,
      alpha: { start: 0.9, end: 0 },
      scale: { start: 1.6, end: 0.3 },
      reserve: 24,
    }),
  };
}
