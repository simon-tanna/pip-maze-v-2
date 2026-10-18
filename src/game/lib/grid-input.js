// src/game/lib/grid-input.js
// Event-driven grid movement input shared by GameScene and TutorialScene.
//
// - Presses come from keydown events, so a tap shorter than a frame still counts
//   (polling Key.JustDown drops those).
// - Hold to walk: while a direction is held, each landing steps again.
// - Buffer: a press during the 120ms step fires on landing if it's under
//   BUFFER_MS old.
// - Corner assist: a buffered turn into a wall stays queued until it expires,
//   so pressing "up" a tile before a junction turns at the junction.
// - With two directions held, the newest wins and the older one is the
//   fallback, so holding up + right slides along walls.

import { wireDpad, unwireDpad } from './dpad.js';

export const BUFFER_MS = 180;

const KEY_DIRS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

// move(dCol, dRow) must return true only when a step actually starts.
export function createGridInput(scene, { move, dpad = false }) {
  const held = []; // [dCol, dRow] pairs, newest last
  let buffered = null; // { dir, at }

  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const drop = (dir) => {
    const i = held.findIndex((d) => same(d, dir));
    if (i !== -1) held.splice(i, 1);
  };

  // Try the buffered press, then held directions newest-first.
  // Returns true when a step started.
  const update = () => {
    if (buffered) {
      if (performance.now() - buffered.at > BUFFER_MS) buffered = null;
      else if (move(...buffered.dir)) {
        buffered = null;
        return true;
      }
    }
    for (let i = held.length - 1; i >= 0; i--) {
      if (move(...held[i])) return true;
    }
    return false;
  };

  const press = (dir) => {
    drop(dir);
    held.push(dir);
    buffered = { dir, at: performance.now() };
    update();
  };

  const release = (dir) => drop(dir);

  const clear = () => {
    held.length = 0;
    buffered = null;
  };

  const onKeyDown = (event) => {
    const dir = KEY_DIRS[event.code];
    if (dir && !event.repeat) press(dir);
  };
  const onKeyUp = (event) => {
    const dir = KEY_DIRS[event.code];
    if (dir) release(dir);
  };

  const kb = scene.input.keyboard;
  // Key objects keep the existing arrow/WASD captures (no page scrolling).
  kb.createCursorKeys();
  kb.addKeys('W,A,S,D');
  kb.on('keydown', onKeyDown);
  kb.on('keyup', onKeyUp);
  scene.game.events.on('blur', clear);
  if (dpad) wireDpad(scene, (dCol, dRow) => press([dCol, dRow]), (dCol, dRow) => release([dCol, dRow]));

  const destroy = () => {
    kb.off('keydown', onKeyDown);
    kb.off('keyup', onKeyUp);
    scene.game.events.off('blur', clear);
    if (dpad) unwireDpad(scene);
    clear();
  };
  scene.events.once('shutdown', destroy);

  return { update, clear, destroy };
}
