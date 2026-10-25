// src/game/lib/generator.js
// Procedural level generator — all randomness via mulberry32 PRNG (never Math.random)

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns a random integer in [min, max] inclusive using the provided rng
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Shuffles array in-place using Fisher-Yates, driven by rng
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Difficulty config for each of the 9 levels (index 0–8). Index ≥ 3 adds a
// second key, so level 4 eases off slightly to absorb the longer route.
//   trapCount     — flames, blades and spikes (60% on the critical route)
//   mummies       — mummy patrols, placed in addition to trapCount
//   rooms         — open 3×3 / 5×3 chambers merged into the maze
//   targetCrit    — preferred critical-route length in tiles (rejection sampling)
//   targetDensity — preferred hazards per 10 critical-route tiles
export const LEVEL_CONFIGS = [
  {
    loopFactor: 0.30,
    trapCount: 10,
    mummies: 0,
    rooms: 2,
    trapTypes: ["flame", "blade"],
    patrolRange: [3, 4],
    targetCrit: 50,
    targetDensity: 1.3,
  },
  {
    loopFactor: 0.26,
    trapCount: 13,
    mummies: 0,
    rooms: 2,
    trapTypes: ["flame", "blade"],
    patrolRange: [3, 4],
    targetCrit: 54,
    targetDensity: 1.38,
  },
  {
    loopFactor: 0.22,
    trapCount: 15,
    mummies: 0,
    rooms: 3,
    trapTypes: ["flame", "blade", "spike"],
    patrolRange: [3, 4],
    targetCrit: 59,
    targetDensity: 1.45,
  },
  {
    loopFactor: 0.20,
    trapCount: 16,
    mummies: 0,
    rooms: 3,
    trapTypes: ["flame", "blade", "spike"],
    patrolRange: [3, 4],
    targetCrit: 63,
    targetDensity: 1.53,
  },
  {
    loopFactor: 0.17,
    trapCount: 17,
    mummies: 1,
    rooms: 3,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [3, 4],
    targetCrit: 68,
    targetDensity: 1.6,
  },
  {
    loopFactor: 0.15,
    trapCount: 19,
    mummies: 2,
    rooms: 3,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [3, 4],
    targetCrit: 72,
    targetDensity: 1.68,
  },
  {
    loopFactor: 0.13,
    trapCount: 21,
    mummies: 3,
    rooms: 4,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [3, 4],
    targetCrit: 76,
    targetDensity: 1.75,
  },
  {
    loopFactor: 0.11,
    trapCount: 23,
    mummies: 4,
    rooms: 4,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [4, 5],
    targetCrit: 81,
    targetDensity: 1.83,
  },
  {
    loopFactor: 0.10,
    trapCount: 25,
    mummies: 5,
    rooms: 4,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [5, 6],
    targetCrit: 85,
    targetDensity: 1.9,
  },
];

// No trap or patrol within this BFS distance of the start tile.
export const SPAWN_SAFE_RADIUS = 2;
// Minimum hazard-free tiles between two different hazards on the critical route.
export const REST_GAP = 2;
// Coins per chamber (inclusive), drawn from their own salted RNG so adding
// them never shifts the maze/trap stream of an existing seed.
export const COIN_MIN = 2;
export const COIN_MAX = 5;
export const COIN_SALT = 0x9e3779b9;
// Preferred minimum route-index gap between two coins.
export const COIN_SPACING = 3;

const DIRS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

const tileKey = (c, r) => `${c},${r}`;

// BFS from (startCol, startRow) to (endCol, endRow) on map. Flat typed arrays
// and a head index instead of string keys and queue.shift(); visiting order
// (and so the returned path) is unchanged.
export function bfsPath(map, startCol, startRow, endCol, endRow, blocked = null) {
  const ROWS = map.length,
    COLS = map[0].length;
  const parent = new Int32Array(ROWS * COLS).fill(-2);
  const queue = new Int32Array(ROWS * COLS);
  const start = startRow * COLS + startCol;
  const goal = endRow * COLS + endCol;
  let head = 0,
    tail = 0;
  parent[start] = -1;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++];
    if (cur === goal) {
      const path = [];
      for (let i = cur; i !== -1; i = parent[i]) path.push([i % COLS, (i / COLS) | 0]);
      return path.reverse();
    }
    const col = cur % COLS,
      row = (cur / COLS) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = col + dc,
        nr = row + dr;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const next = nr * COLS + nc;
      if (parent[next] !== -2) continue;
      if (map[nr][nc] === 1) continue;
      if (blocked && next !== goal && blocked.has(tileKey(nc, nr))) continue;
      parent[next] = cur;
      queue[tail++] = next;
    }
  }
  return null;
}

// Floor tiles within `radius` BFS steps of `from`, as "c,r" strings.
export function tilesWithin(map, from, radius) {
  const seen = new Set([tileKey(from.col, from.row)]);
  let frontier = [[from.col, from.row]];
  for (let d = 0; d < radius; d++) {
    const next = [];
    for (const [c, r] of frontier) {
      for (const [dc, dr] of DIRS) {
        const nc = c + dc,
          nr = r + dr;
        const k = tileKey(nc, nr);
        if (seen.has(k) || !map[nr] || map[nr][nc] === undefined || map[nr][nc] === 1) continue;
        seen.add(k);
        next.push([nc, nr]);
      }
    }
    frontier = next;
  }
  return seen;
}

// A true east-west corridor: walls above and below, floor to one side.
function isHorizontalCorridor(map, col, row) {
  const walled = map[row - 1][col] === 1 && map[row + 1][col] === 1;
  const left = col > 0 && map[row][col - 1] !== 1;
  const right = col < map[0].length - 1 && map[row][col + 1] !== 1;
  return walled && (left || right);
}

function reachableFloors(map, blocked) {
  const ROWS = map.length,
    COLS = map[0].length;
  const visited = new Set();
  const queue = [[1, 1]];
  visited.add("1,1");
  const floors = [];
  for (let head = 0; head < queue.length; head++) {
    const [col, row] = queue[head];
    if (!blocked.has(tileKey(col, row))) floors.push([col, row]);
    for (const [dc, dr] of DIRS) {
      const nc = col + dc,
        nr = row + dr;
      const k = tileKey(nc, nr);
      if (visited.has(k)) continue;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (map[nr][nc] === 1) continue;
      visited.add(k);
      queue.push([nc, nr]);
    }
  }
  return floors;
}

function floorNeighbourCount(map, r, c) {
  let count = 0;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < map.length && nc >= 0 && nc < map[0].length && map[nr][nc] !== 1)
      count++;
  }
  return count;
}

// Maximal horizontal floor runs of at least minLen tiles: mummy patrol candidates.
function horizontalRuns(map, minLen) {
  const runs = [];
  for (let r = 1; r < map.length - 1; r++) {
    let start = -1;
    for (let c = 1; c < map[0].length; c++) {
      const open = c < map[0].length - 1 && map[r][c] !== 1;
      if (open && start < 0) start = c;
      if (!open && start >= 0) {
        if (c - start >= minLen) runs.push({ row: r, start, end: c - 1 });
        start = -1;
      }
    }
  }
  return runs;
}

function patrolTiles(traps) {
  const tiles = new Set();
  traps.forEach((t) => {
    if (t.type !== "mummy") return;
    for (let c = t.patrolCols[0]; c <= t.patrolCols[1]; c++) tiles.add(tileKey(c, t.row));
  });
  return tiles;
}

function hazardTiles(traps) {
  return new Set(traps.filter((t) => t.type !== "mummy").map((t) => tileKey(t.col, t.row)));
}

function levelStops(level) {
  return [
    { col: 1, row: 1 },
    level.key,
    ...(level.key2 ? [level.key2] : []),
    { col: level.exitCol, row: level.exitRow },
  ];
}

// Ordered start → key (→ key2) → exit walk that avoids `blocked`, or null
// when a leg is cut off. Dead-end detours appear twice (in and back out).
export function safeRoute(map, stops, blocked = null) {
  const route = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i],
      b = stops[i + 1];
    const leg = bfsPath(map, a.col, a.row, b.col, b.row, blocked);
    if (!leg) return null;
    route.push(...(i === 0 ? leg : leg.slice(1)));
  }
  return route;
}

// Fewest hazard-free tiles between two different hazards along the route
// (Infinity with fewer than two). Re-crossing the same trap doesn't count.
function minRestGap(route, hazards) {
  let min = Infinity;
  let last = -1;
  route.forEach(([c, r], i) => {
    const k = tileKey(c, r);
    if (!hazards.has(k)) return;
    if (last >= 0 && tileKey(...route[last]) !== k) min = Math.min(min, i - last - 1);
    last = i;
  });
  return min;
}

// Fairness rules every shipped level must pass:
//  - a start → key (→ key2) → chest route exists around every mummy patrol
//    (flames, spikes and blades are timed, so they count as passable)
//  - nothing dangerous within SPAWN_SAFE_RADIUS of the start
//  - keys, coins and the chest never sit under a hazard
//  - at least REST_GAP safe tiles between hazards on that route
export function isFair(level) {
  const { map, traps } = level;
  const stops = levelStops(level);
  const patrol = patrolTiles(traps);
  const hazards = hazardTiles(traps);
  for (const k of tilesWithin(map, stops[0], SPAWN_SAFE_RADIUS)) {
    if (patrol.has(k) || hazards.has(k)) return { fair: false, reason: "hazard in the spawn zone" };
  }
  for (const s of stops.slice(1)) {
    const k = tileKey(s.col, s.row);
    if (patrol.has(k) || hazards.has(k)) return { fair: false, reason: "key or chest under a hazard" };
  }
  for (const c of level.coins ?? []) {
    const k = tileKey(c.col, c.row);
    if (patrol.has(k) || hazards.has(k)) return { fair: false, reason: "coin under a hazard" };
  }
  const route = safeRoute(map, stops, patrol);
  if (!route) return { fair: false, reason: "route cut off by a mummy patrol" };
  const gap = minRestGap(route, hazards);
  if (gap < REST_GAP) return { fair: false, reason: `only ${gap} rest tile(s) between hazards` };
  return { fair: true, route };
}

// Quality metrics used for rejection sampling (and the dev audit).
export function measureLevel(level) {
  const { map, traps } = level;
  const ROWS = map.length,
    COLS = map[0].length;
  const hazards = hazardTiles(traps);
  const route = safeRoute(map, levelStops(level), patrolTiles(traps)) || [];
  const routeSet = new Set(route.map(([c, r]) => tileKey(c, r)));
  const open = (r, c) => map[r][c] !== 1;
  let floors = 0,
    deadEnds = 0,
    junctions = 0;
  const roomTiles = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!open(r, c)) continue;
      floors++;
      const n = floorNeighbourCount(map, r, c);
      if (n === 1) deadEnds++;
      if (n >= 3) junctions++;
      if (r + 1 < ROWS && c + 1 < COLS && open(r, c + 1) && open(r + 1, c) && open(r + 1, c + 1)) {
        [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]].forEach(([x, y]) => roomTiles.add(tileKey(x, y)));
      }
    }
  }
  const hazardsOnCrit = [...routeSet].filter((k) => hazards.has(k)).length;
  return {
    critLen: routeSet.size,
    deadEndRatio: deadEnds / floors,
    junctionRatio: junctions / floors,
    roomTiles: roomTiles.size,
    hazardsOnCrit,
    hazardDensity: routeSet.size ? (hazardsOnCrit * 10) / routeSet.size : 0,
    minRestGap: minRestGap(route, hazards),
    mummies: traps.filter((t) => t.type === "mummy").length,
  };
}

// Lower is better: distance from the level's targets; a missing mummy
// outweighs any length or density miss.
function scoreLevel(m, config) {
  const crit = (m.critLen - config.targetCrit) / config.targetCrit;
  const density = (m.hazardDensity - config.targetDensity) / config.targetDensity;
  const short = config.mummies - m.mummies;
  return crit * crit + density * density + 4 * short * short;
}

function _generateOnce(levelIndex, seed, config) {
  const rng = mulberry32(seed);

  const COLS = 40,
    ROWS = 15;

  const map = Array.from({ length: ROWS }, () => Array(COLS).fill(1));

  map[1][1] = 2;

  const CELL_COLS = 19,
    CELL_ROWS = 7;
  const visited = Array.from({ length: CELL_ROWS }, () =>
    Array(CELL_COLS).fill(false),
  );

  function carveDFS(cx, cr) {
    visited[cr][cx] = true;
    const col = 1 + 2 * cx;
    const row = 1 + 2 * cr;
    map[row][col] = col === 1 && row === 1 ? 2 : 0;

    const dirs = shuffle(rng, [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]);
    for (const [dcx, dcr] of dirs) {
      const nx = cx + dcx,
        nr = cr + dcr;
      if (nx < 0 || nx >= CELL_COLS || nr < 0 || nr >= CELL_ROWS) continue;
      if (visited[nr][nx]) continue;
      map[row + dcr][col + dcx] = 0;
      carveDFS(nx, nr);
    }
  }

  carveDFS(0, 0);

  // Rooms: open up 2×2 or 3×2 blocks of cells (3×3 / 5×3 tiles) after the
  // carve, so connectivity is already guaranteed. A one-cell gap keeps rooms
  // apart and the spawn stays a corridor.
  const rooms = [];
  for (let tries = 0; rooms.length < config.rooms && tries < 40; tries++) {
    const w = rng() < 0.5 ? 2 : 3;
    const h = 2;
    const cx = randInt(rng, 0, CELL_COLS - w);
    const cr = randInt(rng, 0, CELL_ROWS - h);
    if (cx < 2 && cr < 2) continue;
    if (rooms.some((o) => cx <= o.cx + o.w && o.cx <= cx + w && cr <= o.cr + o.h && o.cr <= cr + h)) continue;
    rooms.push({ cx, cr, w, h });
    for (let r = 1 + 2 * cr; r <= 1 + 2 * (cr + h - 1); r++) {
      for (let c = 1 + 2 * cx; c <= 1 + 2 * (cx + w - 1); c++) map[r][c] = 0;
    }
  }

  function selectExit(map, rng) {
    const candidates = [];
    for (let r = 1; r <= 13; r++) {
      for (let c = 35; c <= 37; c++) {
        if (map[r][c] === 0) candidates.push([c, r]);
      }
    }
    shuffle(rng, candidates);
    for (const [c, r] of candidates) {
      if (bfsPath(map, 1, 1, c, r)) return [c, r];
    }
    return null;
  }
  const exitResult = selectExit(map, rng);
  if (!exitResult) return null;
  const [exitCol, exitRow] = exitResult;
  map[exitRow][exitCol] = 3;

  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (map[r][c] !== 1) continue;
      if ((r % 2 === 0) === (c % 2 === 0)) continue;
      const isHoriz = r % 2 === 1;
      const n1r = r + (isHoriz ? 0 : -1),
        n1c = c + (isHoriz ? -1 : 0);
      const n2r = r + (isHoriz ? 0 : 1),
        n2c = c + (isHoriz ? 1 : 0);
      if (n1r < 0 || n2r >= ROWS || n1c < 0 || n2c >= COLS) continue;
      if (map[n1r][n1c] !== 1 && map[n2r][n2c] !== 1) {
        const isDead = floorNeighbourCount(map, n1r, n1c) === 1 ||
                       floorNeighbourCount(map, n2r, n2c) === 1;
        if (isDead) { rng(); continue; }
        if (rng() < config.loopFactor) map[r][c] = 0;
      }
    }
  }

  const path = bfsPath(map, 1, 1, exitCol, exitRow);
  if (!path) return null;

  const keyIdx = Math.floor(path.length * 0.4);
  const [keyCol, keyRow] = path[keyIdx];
  const key = { col: keyCol, row: keyRow };

  let key2 = null;
  if (levelIndex >= 3) {
    const [key2Col, key2Row] = path[Math.floor(path.length * 0.7)];
    key2 = { col: key2Col, row: key2Row };
  }

  const stops = [{ col: 1, row: 1 }, key, ...(key2 ? [key2] : []), { col: exitCol, row: exitRow }];
  const traps = [];
  // Tiles no trap may use: the spawn zone, keys and the chest.
  const occupied = new Set([
    ...tilesWithin(map, stops[0], SPAWN_SAFE_RADIUS),
    ...stops.map((s) => tileKey(s.col, s.row)),
  ]);

  // Mummies first: they need open runs, and each patrol must leave a way round.
  const patrol = new Set();
  const patrolMargin = new Set();
  const [minPatrol, maxPatrol] = config.patrolRange;
  const runs = shuffle(rng, horizontalRuns(map, 3));
  for (const run of runs) {
    if (traps.length >= config.mummies) break;
    const span = Math.min(run.end - run.start + 1, randInt(rng, minPatrol, maxPatrol));
    const patrolStart = randInt(rng, run.start, run.end - span + 1);
    const patrolEnd = patrolStart + span - 1;
    const tiles = [];
    for (let c = patrolStart; c <= patrolEnd; c++) tiles.push(tileKey(c, run.row));
    if (tiles.some((k) => occupied.has(k) || patrolMargin.has(k))) continue;
    if (!safeRoute(map, stops, new Set([...patrol, ...tiles]))) continue;
    traps.push({
      type: "mummy",
      col: randInt(rng, patrolStart, patrolEnd),
      row: run.row,
      patrolCols: [patrolStart, patrolEnd],
    });
    tiles.forEach((k) => { patrol.add(k); occupied.add(k); });
    for (let r = run.row - 1; r <= run.row + 1; r++) {
      for (let c = patrolStart - 1; c <= patrolEnd + 1; c++) patrolMargin.add(tileKey(c, r));
    }
  }

  // Static traps go along the route the player will actually walk.
  const route = safeRoute(map, stops, patrol);
  if (!route) return null;
  const routeSet = new Set(route.map(([c, r]) => tileKey(c, r)));
  const visits = new Map();
  route.forEach(([c, r], i) => {
    const k = tileKey(c, r);
    if (!visits.has(k)) visits.set(k, []);
    visits.get(k).push(i);
  });

  const nonMummyTypes = config.trapTypes.filter((t) => t !== "mummy");
  const pickType = (c, r) => {
    const type = nonMummyTypes[Math.floor(rng() * nonMummyTypes.length)];
    return type === "blade" && !isHorizontalCorridor(map, c, r) ? "flame" : type;
  };
  const hazards = new Set();
  const addTrap = (c, r) => {
    const k = tileKey(c, r);
    traps.push({ type: pickType(c, r), col: c, row: r });
    occupied.add(k);
    hazards.add(k);
  };
  // Every visit to tile k keeps REST_GAP clear tiles to the next hazard.
  const hasRest = (k) => visits.get(k).every((i) => {
    for (let g = -REST_GAP; g <= REST_GAP; g++) {
      const j = i + g;
      if (g === 0 || j < 0 || j >= route.length) continue;
      const nk = tileKey(...route[j]);
      if (nk !== k && hazards.has(nk)) return false;
    }
    return true;
  });

  const regularCount = config.trapCount;
  const onPathCount = Math.round(regularCount * 0.6);
  const offPathCount = regularCount - onPathCount;

  const onPath = shuffle(rng, [...visits.keys()].filter((k) => !occupied.has(k)));
  let placed = 0;
  for (const k of onPath) {
    if (placed >= onPathCount) break;
    if (!hasRest(k)) continue;
    addTrap(...k.split(",").map(Number));
    placed++;
  }

  const offPath = shuffle(rng, reachableFloors(map, new Set([...occupied, ...routeSet]))
    .filter(([c, r]) => map[r][c] === 0));
  offPath.slice(0, offPathCount).forEach(([c, r]) => addTrap(c, r));

  const placedTypes = new Set(traps.filter((t) => t.type !== "mummy").map((t) => t.type));
  for (const requiredType of nonMummyTypes) {
    if (placedTypes.has(requiredType)) continue;
    const spots = reachableFloors(map, new Set([...occupied, ...routeSet])).filter(([c, r]) =>
      map[r][c] === 0 && (requiredType !== "blade" || isHorizontalCorridor(map, c, r)));
    if (spots.length === 0) continue;
    const [c, r] = spots[Math.floor(rng() * spots.length)];
    traps.push({ type: requiredType, col: c, row: r });
    occupied.add(tileKey(c, r));
    placedTypes.add(requiredType);
  }

  // Coins sit on free route tiles, spread out first, then topped up.
  const coinRng = mulberry32((seed ^ COIN_SALT) >>> 0);
  const firstVisit = (k) => visits.get(k)[0];
  const coinSpots = shuffle(coinRng, [...visits.keys()].filter((k) => {
    const [c, r] = k.split(",").map(Number);
    return map[r][c] === 0 && !occupied.has(k);
  }));
  if (coinSpots.length < COIN_MIN) return null;
  const coinCount = randInt(coinRng, COIN_MIN, COIN_MAX);
  const picked = [];
  for (const k of coinSpots) {
    if (picked.length >= coinCount) break;
    if (picked.every((p) => Math.abs(firstVisit(p) - firstVisit(k)) >= COIN_SPACING)) picked.push(k);
  }
  for (const k of coinSpots) {
    if (picked.length >= coinCount) break;
    if (!picked.includes(k)) picked.push(k);
  }
  const coins = picked.map((k) => {
    const [col, row] = k.split(",").map(Number);
    return { col, row };
  });

  return { map, key, key2, traps, coins, exitCol, exitRow };
}

const CANDIDATES = 6;
const MAX_ATTEMPTS = 30;

// Rejection sampling: build several fair candidates from consecutive seeds
// and keep the one closest to the level's targets. Deterministic per seed.
export function generateLevel(levelIndex, seed) {
  const config = LEVEL_CONFIGS[levelIndex];
  let best = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (best && attempt >= CANDIDATES) break;
    const level = _generateOnce(levelIndex, seed + attempt, config);
    if (!level || !isFair(level).fair) continue;
    const score = scoreLevel(measureLevel(level), config);
    if (score < bestScore) {
      best = level;
      bestScore = score;
    }
  }
  if (best) return best;

  const widerConfig = { ...config, loopFactor: Math.min(config.loopFactor * 2, 0.5) };
  return (
    _generateOnce(levelIndex, seed + MAX_ATTEMPTS, widerConfig) ||
    _generateOnce(0, seed, LEVEL_CONFIGS[0])
  );
}

// tileRng — lightweight multiplicative hash RNG for tile variation.
export function tileRng(seed, col, row) {
  let h = (seed ^ (col * 2654435761) ^ (row * 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    return h / 0x100000000;
  };
}

// Tiles on the start → key (→ key2) → exit route, as "c,r" strings.
// Used to keep decor and other clutter off the path the player must read.
export function criticalPath(map, start, key, key2, exit) {
  const stops = [start, key, ...(key2 ? [key2] : []), exit];
  const tiles = new Set();
  for (let i = 0; i < stops.length - 1; i++) {
    const leg = bfsPath(map, stops[i].col, stops[i].row, stops[i + 1].col, stops[i + 1].row);
    if (leg) leg.forEach(([c, r]) => tiles.add(`${c},${r}`));
  }
  return tiles;
}
