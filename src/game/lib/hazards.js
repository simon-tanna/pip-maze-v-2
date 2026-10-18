// src/game/lib/hazards.js
// Runtime hazard controllers shared by GameScene and TutorialScene.
// Timing is unchanged from the original scenes; each controller only adds a
// visible telegraph inside the existing "off" window before damage starts.
//
// Returned records keep the shapes the scenes already use:
//   flame/spike → { rect: { active, telegraph }, col, row }
//   blade       → { col, row, active: () => boolean, angle: () => degrees }

import { TILE_SIZE } from './constants.js';
import { LIGHT, P } from './palette.js';
import {
  HAZARD_KEYS,
  SPIKE_STATE,
  NOZZLE_STATE,
  BLADE_PIVOT,
} from './hazard-art.js';

const T = TILE_SIZE;
const centre = (n) => n * T + T / 2;

export const HAZARD_TIMING = {
  telegraph: 500, // flame wind-up / spike armed (was the glow ramp)
  flameOn: 2000,
  flameOff: 2000,
  spikeRise: 150,
  spikeUp: 2000,
  spikeOff: 2000,
  bladeHalfSwing: 1100,
  bladeDangerAngle: 22,
};

// Full cycle lengths, used to spread hazards' start phases across a cycle.
export const HAZARD_CYCLE = {
  flame: HAZARD_TIMING.telegraph + HAZARD_TIMING.flameOn + HAZARD_TIMING.flameOff,
  spike: HAZARD_TIMING.telegraph + 2 * HAZARD_TIMING.spikeRise + HAZARD_TIMING.spikeUp + HAZARD_TIMING.spikeOff,
};

export const DEPTH = {
  base: 2,
  pickup: 3,
  hazard: 4,
  hero: 5,
  fx: 6,
};

// `phase` delays the first cycle (ms) so neighbouring flames don't fire in unison.
export function createFlameTrap(scene, trap, { fx, lit = false, onIgnite = () => {}, phase = 0 }) {
  const x = centre(trap.col);
  const y = centre(trap.row);
  const nozzle = scene.add.image(x, y, HAZARD_KEYS.nozzle(NOZZLE_STATE.IDLE)).setDepth(DEPTH.base);
  const flame = scene.add.sprite(x, y + 8, HAZARD_KEYS.flame(0))
    .setOrigin(0.5, 1).setDepth(DEPTH.hazard).setVisible(false);
  const light = lit ? scene.lights.addLight(x, y - 10, 140, LIGHT.FLAME, 0) : null;
  const rect = { active: false, telegraph: false };
  let flicker = null;

  const fadeLight = (intensity, duration, ease = 'Sine.easeInOut') => {
    if (!light) return;
    scene.tweens.killTweensOf(light);
    scene.tweens.add({ targets: light, intensity, duration, ease });
  };

  const extinguish = () => {
    rect.active = false;
    if (flicker) { flicker.stop(); flicker = null; }
    scene.tweens.add({
      targets: flame, scaleY: 0.2, alpha: 0, duration: 120, ease: 'Cubic.easeIn',
      onComplete: () => { flame.setVisible(false).stop(); },
    });
    nozzle.setTexture(HAZARD_KEYS.nozzle(NOZZLE_STATE.IDLE));
    fadeLight(0, 250);
    scene.time.delayedCall(HAZARD_TIMING.flameOff, cycle);
  };

  const ignite = () => {
    rect.telegraph = false;
    rect.active = true;
    flame.setVisible(true).setAlpha(1).setScale(1, 0.3).play('hz-flame');
    scene.tweens.add({ targets: flame, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
    if (light) {
      scene.tweens.killTweensOf(light);
      light.intensity = 1.6;
      flicker = scene.tweens.add({
        targets: light, intensity: 1.95, duration: 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
    onIgnite();
    scene.time.delayedCall(HAZARD_TIMING.flameOn, extinguish);
  };

  // Telegraph: the grate heats, embers rise and the light ramps up.
  const cycle = () => {
    rect.telegraph = true;
    nozzle.setTexture(HAZARD_KEYS.nozzle(NOZZLE_STATE.HOT));
    fadeLight(0.7, HAZARD_TIMING.telegraph, 'Sine.easeIn');
    if (fx) {
      scene.time.addEvent({
        delay: 80, repeat: 5,
        callback: () => fx.ember.emitParticleAt(x, y + 6, 1),
      });
    }
    scene.time.delayedCall(HAZARD_TIMING.telegraph, ignite);
  };

  if (phase > 0) scene.time.delayedCall(phase, cycle);
  else cycle();
  return { rect, col: trap.col, row: trap.row };
}

export function createSpikeTrap(scene, trap, { fx, onActive = () => {}, phase = 0 }) {
  const x = centre(trap.col);
  const y = centre(trap.row);
  const plate = scene.add.image(x, y, HAZARD_KEYS.spike(SPIKE_STATE.IDLE)).setDepth(DEPTH.base);
  const rect = { active: false, telegraph: false };

  const retract = () => {
    rect.active = false;
    plate.setTexture(HAZARD_KEYS.spike(SPIKE_STATE.ARMED));
    scene.time.delayedCall(HAZARD_TIMING.spikeRise, () => {
      plate.setTexture(HAZARD_KEYS.spike(SPIKE_STATE.IDLE));
      scene.time.delayedCall(HAZARD_TIMING.spikeOff, cycle);
    });
  };

  const rise = () => {
    plate.setX(x).setTexture(HAZARD_KEYS.spike(SPIKE_STATE.UP)).setScale(0.82);
    scene.tweens.add({ targets: plate, scale: 1, duration: 120, ease: 'Back.easeOut' });
    scene.time.delayedCall(HAZARD_TIMING.spikeRise, () => {
      rect.telegraph = false;
      rect.active = true;
      onActive();
      scene.time.delayedCall(HAZARD_TIMING.spikeUp, retract);
    });
  };

  // Telegraph: the frame heats red, the plate rumbles and kicks up dust.
  const cycle = () => {
    rect.telegraph = true;
    plate.setTexture(HAZARD_KEYS.spike(SPIKE_STATE.ARMED));
    scene.tweens.add({
      targets: plate, x: x + 1, duration: 50, yoyo: true, repeat: 4,
      onComplete: () => plate.setX(x),
    });
    if (fx) {
      fx.dust.explode(2, x - 12, y + 14);
      scene.time.delayedCall(250, () => fx.dust.explode(2, x + 12, y + 14));
    }
    scene.time.delayedCall(HAZARD_TIMING.telegraph, rise);
  };

  scene.time.delayedCall(phase, cycle);
  return { rect, col: trap.col, row: trap.row };
}

const TRAIL_LAG = [3, 6];

export function createBladeTrap(scene, trap, { onEnter = () => {} }) {
  const pivotX = centre(trap.col);
  const pivotY = trap.row * T + 2;
  const make = (alpha, depth) => scene.add.image(pivotX, pivotY, HAZARD_KEYS.blade)
    .setOrigin(BLADE_PIVOT.x, BLADE_PIVOT.y).setAngle(-40).setAlpha(alpha).setDepth(depth);
  const ghosts = [make(0.3, DEPTH.hazard - 0.2), make(0.14, DEPTH.hazard - 0.3)];
  const blade = make(1, DEPTH.hazard);
  const history = new Array(8).fill(-40);
  let head = 0;
  let bladeIn = false;

  const tween = scene.tweens.add({
    targets: blade,
    angle: 40,
    duration: HAZARD_TIMING.bladeHalfSwing,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
    onUpdate: () => {
      history[head] = blade.angle;
      head = (head + 1) % history.length;
      ghosts.forEach((gh, i) => {
        gh.setAngle(history[(head - TRAIL_LAG[i] + history.length) % history.length]);
      });
      const next = Math.abs(blade.angle) < HAZARD_TIMING.bladeDangerAngle;
      if (next !== bladeIn) {
        bladeIn = next;
        // Danger tint: the edge glows ember while it sweeps the tile.
        if (bladeIn) {
          blade.setTint(0xffc89a);
          ghosts.forEach((gh) => gh.setTint(P.FIRE));
          onEnter();
        } else {
          blade.clearTint();
          ghosts.forEach((gh) => gh.clearTint());
        }
      }
    },
  });

  return {
    zone: { col: trap.col, row: trap.row, active: () => bladeIn, angle: () => blade.angle },
    tween,
  };
}

// Mummy visual: a container (sprite + contact shadow) so gameplay can keep
// tweening one object. `setMummyAlert` swaps to the glowing-eye chase cycle.
export function createMummyVisual(scene, x, y) {
  const shadow = scene.add.image(0, 18, HAZARD_KEYS.shadow).setAlpha(0.8);
  const sprite = scene.add.sprite(0, 0, HAZARD_KEYS.mummy(0, false)).play('hz-mummy-walk');
  const c = scene.add.container(x, y, [shadow, sprite]).setDepth(DEPTH.hazard);
  c.mummySprite = sprite;
  return c;
}

export function setMummyFacing(c, dCol) {
  if (dCol !== 0) c.mummySprite.flipX = dCol < 0;
}

// `mark` defaults to "!" (alert) or "?" (lost you); pass null for no pop.
export function setMummyAlert(scene, c, alert, { textStyle, mark = alert ? '!' : '?' } = {}) {
  c.mummySprite.play(alert ? 'hz-mummy-chase' : 'hz-mummy-walk', true);
  if (mark === null) return;
  const text = scene.add.text(c.x, c.y - 30, mark, textStyle).setOrigin(0.5).setDepth(DEPTH.fx);
  scene.tweens.add({
    targets: text, y: c.y - 42, alpha: { from: 1, to: 0 }, duration: 600, ease: 'Cubic.easeOut',
    onComplete: () => text.destroy(),
  });
  if (alert) {
    scene.tweens.add({ targets: c.mummySprite, y: -4, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }
}
