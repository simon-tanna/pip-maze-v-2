import { test } from 'node:test';
import assert from 'node:assert/strict';
import baseline from './fixtures/generator-baseline.json' with { type: 'json' };
import { generateLevel, isFair, LEVEL_CONFIGS, tilesWithin, SPAWN_SAFE_RADIUS, COIN_MIN, COIN_MAX } from '../src/game/lib/generator.js';

const SEEDS = Array.from({ length: 60 }, (_, n) => n * 7919 + 1);

test('existing seeds keep their maze, keys and traps', () => {
  for (const b of baseline) {
    const l = generateLevel(b.i, b.seed);
    assert.deepEqual(
      { map: l.map, key: l.key, key2: l.key2, traps: l.traps, exitCol: l.exitCol, exitRow: l.exitRow },
      { map: b.map, key: b.key, key2: b.key2, traps: b.traps, exitCol: b.exitCol, exitRow: b.exitRow });
  }
});

test('every level has 2-5 coins on safe, distinct route floor tiles', () => {
  for (let i = 0; i < LEVEL_CONFIGS.length; i++) for (const seed of SEEDS) {
    const l = generateLevel(i, seed);
    assert.ok(l.coins.length >= COIN_MIN && l.coins.length <= COIN_MAX, `level ${i} seed ${seed}: ${l.coins.length}`);
    const keys = l.coins.map((c) => `${c.col},${c.row}`);
    assert.equal(new Set(keys).size, keys.length);
    const fair = isFair(l);
    assert.ok(fair.fair, fair.reason);
    const route = new Set(fair.route.map(([c, r]) => `${c},${r}`));
    const spawn = tilesWithin(l.map, { col: 1, row: 1 }, SPAWN_SAFE_RADIUS);
    const blocked = new Set([
      `${l.key.col},${l.key.row}`, ...(l.key2 ? [`${l.key2.col},${l.key2.row}`] : []), `${l.exitCol},${l.exitRow}`,
      ...l.traps.flatMap((t) => t.type === 'mummy'
        ? Array.from({ length: t.patrolCols[1] - t.patrolCols[0] + 1 }, (_, d) => `${t.patrolCols[0] + d},${t.row}`)
        : [`${t.col},${t.row}`]),
    ]);
    for (const c of l.coins) {
      assert.equal(l.map[c.row][c.col], 0);
      assert.ok(route.has(`${c.col},${c.row}`), 'coin off the route');
      assert.ok(!blocked.has(`${c.col},${c.row}`), 'coin on key/chest/trap');
      assert.ok(!spawn.has(`${c.col},${c.row}`), 'coin in spawn zone');
    }
  }
});

test('coins are deterministic per seed', () => {
  assert.deepEqual(generateLevel(4, 777).coins, generateLevel(4, 777).coins);
});

test('isFair rejects a coin on a trap', () => {
  const l = generateLevel(2, 5);
  const t = l.traps.find((x) => x.type !== 'mummy');
  assert.equal(isFair({ ...l, coins: [{ col: t.col, row: t.row }] }).reason, 'coin under a hazard');
});
