// src/game/lib/grid-path.js
// Grid pathfinding and sight for actors on the tile map. Flat typed arrays and
// a head index instead of string keys and queue.shift(); buffers are reused.

// Same-row neighbours first, so patrollers prefer to stay on their row.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function createGridPathfinder(map) {
  const ROWS = map.length;
  const COLS = map[0].length;
  const N = ROWS * COLS;
  const parent = new Int32Array(N);
  const queue = new Int32Array(N);

  const index = (c, r) => r * COLS + c;

  // Tiles from `from` (exclusive) to `to` (inclusive), or null. `isBlocked(c, r)`
  // vetoes tiles other than the goal.
  function path(from, to, isBlocked = null) {
    const start = index(from.col, from.row);
    const goal = index(to.col, to.row);
    if (start === goal) return [];
    parent.fill(-2);
    parent[start] = -1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    while (head < tail) {
      const cur = queue[head++];
      if (cur === goal) {
        const out = [];
        for (let i = cur; i !== start; i = parent[i]) out.push({ col: i % COLS, row: (i / COLS) | 0 });
        return out.reverse();
      }
      const c = cur % COLS;
      const r = (cur / COLS) | 0;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const next = index(nc, nr);
        if (parent[next] !== -2 || map[nr][nc] === 1) continue;
        if (next !== goal && isBlocked && isBlocked(nc, nr)) continue;
        parent[next] = cur;
        queue[tail++] = next;
      }
    }
    return null;
  }

  // BFS step counts from `from` to every reachable tile (-1 = unreachable).
  function distanceField(from) {
    const dist = new Int16Array(N).fill(-1);
    const start = index(from.col, from.row);
    dist[start] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    while (head < tail) {
      const cur = queue[head++];
      const c = cur % COLS;
      const r = (cur / COLS) | 0;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const next = index(nc, nr);
        if (dist[next] !== -1 || map[nr][nc] === 1) continue;
        dist[next] = dist[cur] + 1;
        queue[tail++] = next;
      }
    }
    return { at: (c, r) => dist[index(c, r)] };
  }

  return { path, distanceField, index };
}

// Bresenham sight line within `range` tiles (Euclidean). Walls block, and so
// does squeezing diagonally between two wall corners.
export function hasLineOfSight(map, a, b, range) {
  let x = a.col;
  let y = a.row;
  const dx = Math.abs(b.col - x);
  const dy = Math.abs(b.row - y);
  if (dx === 0 && dy === 0) return false;
  if (dx * dx + dy * dy > range * range) return false;
  const sx = x < b.col ? 1 : -1;
  const sy = y < b.row ? 1 : -1;
  let err = dx - dy;
  while (x !== b.col || y !== b.row) {
    const e2 = 2 * err;
    const stepX = e2 > -dy;
    const stepY = e2 < dx;
    if (stepX && stepY && map[y][x + sx] === 1 && map[y + sy][x] === 1) return false;
    if (stepX) { err -= dy; x += sx; }
    if (stepY) { err += dx; y += sy; }
    if ((x !== b.col || y !== b.row) && map[y][x] === 1) return false;
  }
  return true;
}
