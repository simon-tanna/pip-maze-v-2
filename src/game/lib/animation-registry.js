import { CHARACTER_CONFIGS } from './graphics.js';

const DIRECTIONS = ['down', 'right', 'left', 'up'];

export function registerCharacterAnimations(scene) {
  const seen = new Set();
  Object.values(CHARACTER_CONFIGS).forEach((cfg) => {
    if (seen.has(cfg.animKey)) return;
    seen.add(cfg.animKey);

    DIRECTIONS.forEach((dir, i) => {
      const idleKey = `${cfg.animKey}-idle-${dir}`;
      if (!scene.anims.exists(idleKey)) {
        scene.anims.create({
          key: idleKey,
          frames: scene.anims.generateFrameNumbers(cfg.animKey, { frames: [i] }),
          frameRate: 1,
          repeat: 0,
        });
      }
      const walkKey = `${cfg.animKey}-walk-${dir}`;
      if (!scene.anims.exists(walkKey)) {
        scene.anims.create({
          key: walkKey,
          frames: scene.anims.generateFrameNumbers(cfg.animKey, {
            frames: [i, i + 4],
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
    });
  });
}
