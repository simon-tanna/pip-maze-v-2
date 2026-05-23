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

// Difficulty config for each of the 9 levels (index 0–8)
export const LEVEL_CONFIGS = [
  {
    loopFactor: 0.36,
    trapCount: 12,
    trapTypes: ["flame", "blade"],
    patrolRange: [3, 4],
  },
  {
    loopFactor: 0.29,
    trapCount: 15,
    trapTypes: ["flame", "blade"],
    patrolRange: [3, 4],
  },
  {
    loopFactor: 0.23,
    trapCount: 18,
    trapTypes: ["flame", "blade", "spike"],
    patrolRange: [3, 4],
  },
  {
    loopFactor: 0.18,
    trapCount: 18,
    trapTypes: ["flame", "blade", "spike"],
    patrolRange: [3, 4],
  },
  {
    loopFactor: 0.14,
    trapCount: 21,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [3, 4],
  },
  {
    loopFactor: 0.11,
    trapCount: 24,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [3, 4],
  },
  {
    loopFactor: 0.09,
    trapCount: 27,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [3, 4],
  },
  {
    loopFactor: 0.06,
    trapCount: 30,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [5, 6],
  },
  {
    loopFactor: 0.05,
    trapCount: 33,
    trapTypes: ["flame", "blade", "spike", "mummy"],
    patrolRange: [5, 6],
  },
];

// BFS from (startCol, startRow) to (endCol, endRow) on map.
export function bfsPath(map, startCol, startRow, endCol, endRow, blocked = null) {
  const ROWS = map.length,
    COLS = map[0].length;
  const parent = new Map();
  parent.set(`${startCol},${startRow}`, null);
  const queue = [[startCol, startRow]];
  while (queue.length) {
    const [col, row] = queue.shift();
    if (col === endCol && row === endRow) {
      const path = [];
      let key = `${endCol},${endRow}`;
      while (key !== null) {
        const [c, r] = key.split(",").map(Number);
        path.unshift([c, r]);
        key = parent.get(key);
      }
      return path;
    }
    for (const [dc, dr] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nc = col + dc,
        nr = row + dr;
      const k = `${nc},${nr}`;
      if (parent.has(k)) continue;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (map[nr][nc] === 1) continue;
      if (blocked && blocked.has(k) && !(nc === endCol && nr === endRow))
        continue;
      parent.set(k, `${col},${row}`);
      queue.push([nc, nr]);
    }
  }
  return null;
}

function hasHorizontalCorridor(map, col, row) {
  const left = col > 0 && map[row][col - 1] === 0;
  const right = col < map[0].length - 1 && map[row][col + 1] === 0;
  return left || right;
}

function reachableFloors(map, blocked) {
  const ROWS = map.length,
    COLS = map[0].length;
  const visited = new Set();
  const queue = [[1, 1]];
  visited.add("1,1");
  const floors = [];
  while (queue.length) {
    const [col, row] = queue.shift();
    if (!blocked.has(`${col},${row}`)) floors.push([col, row]);
    for (const [dc, dr] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nc = col + dc,
        nr = row + dr;
      const k = `${nc},${nr}`;
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

function _generateOnce(levelIndex, seed, configOverride = null) {
  const config = configOverride || LEVEL_CONFIGS[levelIndex];
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
  let key2Idx = -1;
  if (levelIndex >= 3) {
    key2Idx = Math.floor(path.length * 0.7);
    const [key2Col, key2Row] = path[key2Idx];
    key2 = { col: key2Col, row: key2Row };
  }

  const traps = [];
  const occupied = new Set([
    `${keyCol},${keyRow}`,
    `${exitCol},${exitRow}`,
    "1,1",
    ...(key2 ? [`${key2.col},${key2.row}`] : []),
  ]);

  const nonMummyTypes = config.trapTypes.filter((t) => t !== "mummy");
  const hasMummy = config.trapTypes.includes("mummy");

  const mummyCount = hasMummy ? Math.floor(config.trapCount * 0.3) : 0;
  const regularCount = config.trapCount - mummyCount;

  const onPathCount = Math.round(regularCount * 0.6);
  const offPathCount = regularCount - onPathCount;

  const pathSet = new Set(path.map(([c, r]) => `${c},${r}`));
  const skipZone = new Set();
  let placed = 0;

  const pathIndices = path
    .map((_, i) => i)
    .filter(
      (i) => i !== 0 && i !== path.length - 1 && i !== keyIdx && i !== key2Idx,
    );
  shuffle(rng, pathIndices);

  for (const i of pathIndices) {
    if (placed >= onPathCount) break;
    const [c, r] = path[i];
    const k = `${c},${r}`;
    if (occupied.has(k) || skipZone.has(k)) continue;
    let type = nonMummyTypes[Math.floor(rng() * nonMummyTypes.length)];
    if (type === "blade" && !hasHorizontalCorridor(map, c, r)) type = "flame";
    traps.push({ type, col: c, row: r });
    occupied.add(k);
    for (let gap = -2; gap <= 2; gap++) {
      if (i + gap >= 0 && i + gap < path.length) {
        skipZone.add(`${path[i + gap][0]},${path[i + gap][1]}`);
      }
    }
    placed++;
  }

  const offPathFloors = reachableFloors(
    map,
    new Set([...occupied, ...pathSet]),
  ).filter(([c, r]) => map[r][c] !== 2);
  shuffle(rng, offPathFloors);
  for (let i = 0; i < offPathCount && i < offPathFloors.length; i++) {
    const [c, r] = offPathFloors[i];
    const k = `${c},${r}`;
    if (occupied.has(k)) continue;
    let type = nonMummyTypes[Math.floor(rng() * nonMummyTypes.length)];
    if (type === "blade" && !hasHorizontalCorridor(map, c, r)) type = "flame";
    traps.push({ type, col: c, row: r });
    occupied.add(k);
  }

  const [minPatrol, maxPatrol] = config.patrolRange;

  function longestFloorRun(rowIdx) {
    const row = map[rowIdx];
    let best = null,
      cur = null;
    for (let c = 1; c < row.length - 1; c++) {
      if (row[c] !== 1) {
        if (!cur) cur = { start: c, end: c };
        else cur.end = c;
        if (!best || cur.end - cur.start > best.end - best.start)
          best = { ...cur };
      } else {
        cur = null;
      }
    }
    return best;
  }

  const candidateRows = [];
  for (let r = 2; r <= ROWS - 3; r++) candidateRows.push(r);
  shuffle(rng, candidateRows);

  let mummiesPlaced = 0;
  for (const rowIdx of candidateRows) {
    if (mummiesPlaced >= mummyCount) break;
    const run = longestFloorRun(rowIdx);
    if (!run) continue;
    const runLen = run.end - run.start + 1;
    if (runLen < 2) continue;

    const span = Math.min(runLen, randInt(rng, minPatrol, maxPatrol));
    const maxStart = run.end - span + 1;
    if (maxStart < run.start) continue;
    const patrolStart = randInt(rng, run.start, maxStart);
    const patrolEnd = patrolStart + span - 1;

    const mummyCol = randInt(rng, patrolStart, patrolEnd);
    const k = `${mummyCol},${rowIdx}`;
    if (occupied.has(k)) continue;

    let valid = true;
    for (let c = patrolStart; c <= patrolEnd; c++) {
      if (map[rowIdx][c] === 1 || occupied.has(`${c},${rowIdx}`)) {
        valid = false;
        break;
      }
    }
    if (!valid) continue;

    traps.push({
      type: "mummy",
      col: mummyCol,
      row: rowIdx,
      patrolCols: [patrolStart, patrolEnd],
    });
    for (let c = patrolStart; c <= patrolEnd; c++)
      occupied.add(`${c},${rowIdx}`);
    mummiesPlaced++;
  }

  for (let i = mummiesPlaced; i < mummyCount; i++) {
    const floors = reachableFloors(map, occupied).filter(
      ([c, r]) => map[r][c] !== 2,
    );
    shuffle(rng, floors);
    if (floors.length === 0) break;
    const [c, r] = floors[0];
    traps.push({ type: "flame", col: c, row: r });
    occupied.add(`${c},${r}`);
  }

  const placedTypes = new Set(
    traps.filter((t) => t.type !== "mummy").map((t) => t.type),
  );
  for (const requiredType of nonMummyTypes) {
    if (placedTypes.has(requiredType)) continue;
    const candidates = reachableFloors(map, occupied).filter(([c, r]) => {
      if (map[r][c] === 2) return false;
      if (requiredType === "blade" && !hasHorizontalCorridor(map, c, r))
        return false;
      return true;
    });
    shuffle(rng, candidates);
    if (candidates.length === 0) continue;
    const [c, r] = candidates[0];
    traps.push({ type: requiredType, col: c, row: r });
    occupied.add(`${c},${r}`);
    placedTypes.add(requiredType);
  }

  return { map, key, key2, traps, exitCol, exitRow };
}

export function generateLevel(levelIndex, seed) {
  const maxRetries = levelIndex >= 3 ? 35 : 20;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = _generateOnce(levelIndex, seed + attempt);
    if (!result) continue;

    const { map, key, key2, traps, exitCol, exitRow } = result;

    const blocked = new Set();
    traps.forEach((t) => {
      if (t.type === "mummy") {
        for (let c = t.patrolCols[0]; c <= t.patrolCols[1]; c++)
          blocked.add(`${c},${t.row}`);
      } else {
        blocked.add(`${t.col},${t.row}`);
      }
    });

    const solvable =
      levelIndex >= 3
        ? bfsPath(map, 1, 1, key.col, key.row, blocked) &&
          bfsPath(map, key.col, key.row, key2.col, key2.row, blocked) &&
          bfsPath(map, key2.col, key2.row, exitCol, exitRow, blocked)
        : bfsPath(map, 1, 1, key.col, key.row, blocked) &&
          bfsPath(map, key.col, key.row, exitCol, exitRow, blocked);

    if (solvable) return result;
  }

  const baseConfig = LEVEL_CONFIGS[levelIndex];
  const widerConfig = {
    ...baseConfig,
    loopFactor: Math.min(baseConfig.loopFactor * 2, 0.5),
  };
  return (
    _generateOnce(levelIndex, seed + maxRetries, widerConfig) ||
    _generateOnce(0, seed)
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
