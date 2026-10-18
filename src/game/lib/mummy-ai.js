// src/game/lib/mummy-ai.js
// Mummy behaviour for GameScene. Each mummy runs a small state machine:
//
//   PATROL ──sees hero──▶ ALERT ──350ms──▶ CHASE ──lost sight at last-seen──▶ SEARCH
//     ▲                     ▲                │ leash / no path                  │ 1.2s
//     │                     └──sees hero─────┼──────────────────────────────────┤
//     └───────at home─────── RETURN ◀────────┴──────────────────────────────────┘
//
// CHASE repaths only when its target tile changes (or the cached next step
// turns lethal). Mummies never enter the spawn safe zone, and RETURN walks
// back to the original patrol so they don't drift onto the route.

import { TILE_SIZE } from './constants.js';
import { createMummyVisual, setMummyAlert, setMummyFacing } from './hazards.js';
import { hasLineOfSight } from './grid-path.js';

const T = TILE_SIZE;
const centre = (n) => n * T + T / 2;

export const MUMMY_TIMING = {
  patrolTick: 600,
  patrolStep: 400,
  alert: 350,
  chaseTick: 450,
  chaseStep: 300,
  searchTick: 150,
  search: 1200,
};

export const MUMMY_SIGHT = 5; // tiles, Bresenham line of sight
export const MUMMY_LEASH = 10; // BFS tiles from home before giving up

export const MUMMY_STATE = {
  PATROL: 'patrol',
  ALERT: 'alert',
  CHASE: 'chase',
  SEARCH: 'search',
  RETURN: 'return',
};

// ctx:
//   map, pathfinder — the level grid and a createGridPathfinder(map)
//   hero()          — { col, row } of a targetable hero, or null
//   isLethal(c, r)  — an active hazard occupies the tile
//   safeZone        — Set of "c,r" tiles mummies may not enter (spawn)
//   onStep(m)       — called after every completed step
//   textStyle       — style for the "!" / "?" pops
export function createMummyController(scene, trap, ctx) {
  const { map, pathfinder, hero, isLethal, safeZone, onStep, textStyle } = ctx;
  const S = MUMMY_STATE;
  const visual = createMummyVisual(scene, centre(trap.col), centre(trap.row));
  const home = { col: trap.col, row: trap.row };
  const homeDist = pathfinder.distanceField(home);
  const avoid = (c, r) => safeZone.has(`${c},${r}`) || isLethal(c, r);

  const m = {
    col: trap.col,
    row: trap.row,
    dead: false,
    moving: false,
    state: S.PATROL,
    direction: 1,
    lastSeen: { ...home },
    visuals: [visual],
    timer: null,
  };
  let route = [];
  let routeGoal = -1;
  let searchLeft = 0;

  const sees = () => {
    const h = hero();
    return h && hasLineOfSight(map, m, h, MUMMY_SIGHT) ? h : null;
  };

  const startTimer = (delay, loop) => {
    if (m.timer) m.timer.remove();
    m.timer = scene.time.addEvent({ delay, loop, callback: loop ? tick : () => enter(S.CHASE) });
  };

  const enter = (state) => {
    m.state = state;
    route = [];
    routeGoal = -1;
    if (state === S.PATROL) startTimer(MUMMY_TIMING.patrolTick, true);
    if (state === S.ALERT) {
      setMummyAlert(scene, visual, true, { textStyle });
      startTimer(MUMMY_TIMING.alert, false);
    }
    if (state === S.CHASE) startTimer(MUMMY_TIMING.chaseTick, true);
    if (state === S.SEARCH) {
      setMummyAlert(scene, visual, false, { textStyle });
      searchLeft = MUMMY_TIMING.search;
      startTimer(MUMMY_TIMING.searchTick, true);
    }
    if (state === S.RETURN) startTimer(MUMMY_TIMING.patrolTick, true);
  };

  const step = (to, duration) => {
    const dCol = to.col - m.col;
    m.col = to.col;
    m.row = to.row;
    m.moving = true;
    setMummyFacing(visual, dCol);
    scene.tweens.add({
      targets: visual,
      x: centre(m.col),
      y: centre(m.row),
      duration,
      ease: 'Linear',
      onComplete: () => {
        m.moving = false;
        onStep(m);
      },
    });
  };

  // Follow a cached BFS route to `goal`; repath when the goal changed or the
  // next step became unsafe. Returns false when there's no way through.
  const walkTowards = (goal, duration) => {
    const goalIdx = pathfinder.index(goal.col, goal.row);
    const next = route[0];
    if (goalIdx !== routeGoal || !next || (avoid(next.col, next.row) && route.length > 1)) {
      route = pathfinder.path(m, goal, avoid) || [];
      routeGoal = goalIdx;
    }
    if (!route.length) return false;
    step(route.shift(), duration);
    return true;
  };

  const inLeash = () => homeDist.at(m.col, m.row) <= MUMMY_LEASH;

  const spot = (h) => {
    m.lastSeen = { col: h.col, row: h.row };
    enter(S.ALERT);
  };

  function tick() {
    if (m.dead || m.moving) return;
    const seen = sees();

    if (m.state === S.PATROL) {
      if (seen) { spot(seen); return; }
      const nextCol = m.col + m.direction;
      if (nextCol < trap.patrolCols[0] || nextCol > trap.patrolCols[1] || map[m.row][nextCol] === 1) {
        m.direction *= -1;
        return;
      }
      step({ col: nextCol, row: m.row }, MUMMY_TIMING.patrolStep);
      return;
    }

    if (m.state === S.CHASE) {
      if (seen) m.lastSeen = { col: seen.col, row: seen.row };
      const goal = m.lastSeen;
      const atGoal = m.col === goal.col && m.row === goal.row;
      if (!inLeash() || safeZone.has(`${goal.col},${goal.row}`) || (atGoal && !seen)) {
        enter(S.SEARCH);
        return;
      }
      if (!atGoal && !walkTowards(goal, MUMMY_TIMING.chaseStep)) enter(S.SEARCH);
      return;
    }

    if (m.state === S.SEARCH) {
      if (seen && inLeash()) { spot(seen); return; }
      searchLeft -= MUMMY_TIMING.searchTick;
      if (searchLeft <= 0) enter(S.RETURN);
      return;
    }

    if (m.state === S.RETURN) {
      if (seen && inLeash()) { spot(seen); return; }
      if (m.col === home.col && m.row === home.row) {
        m.direction = 1;
        enter(S.PATROL);
        return;
      }
      walkTowards(home, MUMMY_TIMING.patrolStep);
    }
  }

  m.stop = () => {
    if (m.timer) m.timer.remove();
    m.timer = null;
  };

  // Crumble away; the scene handles the puff and list bookkeeping.
  m.kill = () => {
    if (m.dead) return;
    m.dead = true;
    m.stop();
    scene.tweens.killTweensOf(visual);
    scene.tweens.add({
      targets: visual,
      alpha: 0,
      scaleY: 0.4,
      duration: 300,
      onComplete: () => visual.destroy(),
    });
  };

  enter(S.PATROL);
  return m;
}
