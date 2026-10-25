// Snapshot of generateLevel output before coins were added, so the coin code
// can prove it never shifts an existing seed's maze, keys or traps.
import { writeFileSync } from 'node:fs';
import { generateLevel, LEVEL_CONFIGS } from '../src/game/lib/generator.js';

const SEEDS = [1, 2, 3, 42, 1234, 99999, 2 ** 31 - 1, 4294967295];
const out = [];
for (let i = 0; i < LEVEL_CONFIGS.length; i++) {
  for (const seed of SEEDS) {
    const { map, key, key2, traps, exitCol, exitRow } = generateLevel(i, seed);
    out.push({ i, seed, map, key, key2, traps, exitCol, exitRow });
  }
}
writeFileSync(new URL('./fixtures/generator-baseline.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${out.length} entries`);
