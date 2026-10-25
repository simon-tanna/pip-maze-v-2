# Chamber Coins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every chamber has 2–5 seeded coins on the route. They're drawn like the key with a shine sweep, and collecting one banks it, flies it to a new HUD coin panel and ticks the balance.

**Architecture:** `generateLevel` returns `coins` (from a separate salted RNG, so existing seeds don't change) and `isFair` rejects coins on hazards. `hazard-art.js` bakes coin frames and a shine animation. A new `lib/coins.js` controller owns coin sprites, pickup and the flight to the HUD. `GameScene` wires it to `checkWin` and `setPlayerCoins`, and `HudScene` gets a coin panel next to the chamber title.

**Tech Stack:** Phaser 4.2 (not 3), Vite, plain ES-module `.js`, Node 22 built-in `node:test` for the generator tests (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-10-25-chamber-coins-design.md`

## Global Constraints

- Every colour comes from `P` / `LIGHT` in `src/game/lib/palette.js`; no hex literals elsewhere.
- No `Math.random` for anything that decides where coins go; coin RNG is `mulberry32((seed ^ COIN_SALT) >>> 0)`.
- `map`, `key`, `key2`, `traps`, `exitCol`, `exitRow` from `generateLevel(i, seed)` must be byte-identical to before this change.
- Coins: count 2–5 inclusive; only on unique route tiles with `map[r][c] === 0` that are not in `occupied` (spawn zone, keys, chest, patrols, traps).
- Coin pickups: no `hitStop`, no `flash`. Sparkle burst `fx.sparkle.explode(8, …)` (the key uses 16).
- Pickups at `DEPTH.pickup` (3), unlit (no `setLighting`). Flyer `setScrollFactor(0)`, depth 900, ~450ms `Cubic.easeInOut`.
- Bob: ±3px, 900ms, `Sine.easeInOut`, yoyo, repeat −1 (matches the key).
- Reduced motion (`reducedMotion()` from `lib/fx.js`): no bob, no shine, no burst, no HUD pop or "+1". Pickup, banking and the count update still happen.
- Bank on pickup: `setPlayerCoins(game, name, 1)` runs before any animation. Death never removes coins.
- Coins only in `GameScene` chambers, not in Tutorial or Boss.
- Run `npx tsc --noEmit` before each commit; it must pass.

## Review Focus

1. **Existing seeds unchanged:** a player mid-run (seeds in the registry) must see the same maze and traps after the update. Pinned by the baseline snapshot test in Task 1.
2. **The scene ends while a coin is in flight** (e.g. the chest is reached within 450ms of a pickup, or the iris transition starts): no error, no HUD emit to a stopped HUD, and the coin is still banked. Covered in Task 4 (manual check, step 6).
3. **No active player** (dev `__game.scene.start('GameScene', { level: 0 })` with an empty registry): coins still render and can be picked up, nothing is saved, nothing throws, no HUD panel. Covered in Tasks 3 and 4.
4. **Stepping back onto a collected coin's tile, or holding a direction across it:** banks exactly once. Covered in Task 4 (manual check).
5. **A large balance** (999+): the coin panel grows to fit and doesn't overlap the title. Covered in Task 3 (manual check).

No browser test harness exists, so items 2–5 are checked by hand in the dev build, with the steps written into their tasks.

---

### Task 1: Coins in the level generator

**Files:**
- Modify: `package.json` (add `"test": "node --test tests/"`)
- Create: `tests/fixtures/generator-baseline.json`, `tests/make-baseline.mjs`, `tests/generator-coins.test.mjs`
- Modify: `src/game/lib/generator.js` (`_generateOnce` ~line 545–586, `isFair` ~line 316)

**Interfaces:**
- Produces: `generateLevel(levelIndex, seed)` returns `{ map, key, key2, traps, coins, exitCol, exitRow }`, where `coins: Array<{ col: number, row: number }>`, length 2–5. Exported constants `COIN_MIN = 2`, `COIN_MAX = 5`, `COIN_SALT = 0x9e3779b9`, `COIN_SPACING = 3`.
- Produces: `isFair(level)` returns `{ fair: false, reason: "coin under a hazard" }` when any coin is on a hazard or patrol tile.

- [ ] **Step 1: Capture the baseline before touching the generator**

`tests/make-baseline.mjs` imports `generateLevel` and `LEVEL_CONFIGS`, and for every level `i` in `LEVEL_CONFIGS` and seeds `[1, 2, 3, 42, 1234, 99999, 2**31 - 1, 4294967295]` writes `{ i, seed, map, key, key2, traps, exitCol, exitRow }` to `tests/fixtures/generator-baseline.json`.

Run: `node tests/make-baseline.mjs && git add tests/fixtures/generator-baseline.json tests/make-baseline.mjs`
Expected: the fixture file exists with `LEVEL_CONFIGS.length * 8` entries. Commit it on its own now, so it's clearly pre-change: `git commit -m "test: generator baseline snapshot"`.

- [ ] **Step 2: Write the failing tests in `tests/generator-coins.test.mjs`**

```js
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: the baseline test PASSES; the coin tests FAIL (`l.coins` is undefined / `COIN_MIN` is undefined).

- [ ] **Step 4: Implement coin placement in `_generateOnce`**

Insert just before `return { map, key, key2, traps, … }`, and return `coins` with it. The candidate seed `_generateOnce` receives is the `seed` to salt. Selection:

```js
const coinRng = mulberry32((seed ^ COIN_SALT) >>> 0);
const firstVisit = (k) => visits.get(k)[0];
const candidates = shuffle(coinRng, [...visits.keys()].filter((k) => {
  const [c, r] = k.split(",").map(Number);
  return map[r][c] === 0 && !occupied.has(k);
}));
if (candidates.length < COIN_MIN) return null;
const count = randInt(coinRng, COIN_MIN, COIN_MAX);
const picked = [];
for (const k of candidates) {   // spaced pass first, then fill
  if (picked.length >= count) break;
  if (picked.every((p) => Math.abs(firstVisit(p) - firstVisit(k)) >= COIN_SPACING)) picked.push(k);
}
for (const k of candidates) {
  if (picked.length >= count) break;
  if (!picked.includes(k)) picked.push(k);
}
const coins = picked.map((k) => { const [col, row] = k.split(",").map(Number); return { col, row }; });
```

`randInt` is inclusive of both ends. Don't draw from `rng` anywhere in this block.

- [ ] **Step 5: Add the coin rule to `isFair`**

After the "key or chest under a hazard" loop: for each `level.coins ?? []`, if `patrol` or `hazards` has its tile, return `{ fair: false, reason: "coin under a hazard" }`. Add a line to the rules comment above `isFair`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: 4 tests PASS. If the baseline test fails, coin code is consuming `rng` or a candidate got rejected by the `< COIN_MIN` guard. Find which with a temporary log; don't loosen the test.

- [ ] **Step 7: Commit**

```bash
npx tsc --noEmit
git add package.json tests/generator-coins.test.mjs src/game/lib/generator.js
git commit -m "feat(gen): seeded coins on the route"
```

---

### Task 2: Coin art and shine animation

**Files:**
- Modify: `src/game/lib/hazard-art.js` (`HAZARD_KEYS`, `bakeHazardTextures`, `registerHazardAnimations`, new `paintCoin`)
- Modify: `src/game/scenes/ArtLab.js` (add a "coin" tile)

**Interfaces:**
- Produces: `export const COIN_FRAMES = 6`, `export const COIN_SIZE = 24`, `HAZARD_KEYS.coin(frame) → 'pk-coin-${frame}'` (frame 0 = plain face, frames 1–5 = sweep), animation `'pk-coin-shine'` with frames `[1,2,3,4,5,0]` at 12fps, `repeat: 0` (the controller sets repeat and delay at play time).

- [ ] **Step 1: Implement `paintCoin(g, frame)`**

The texture is 24×24, built from 12×12 art pixels at 2px each, using the file's existing `rect` helper. Use the same disc maths as the mockup (`.superpowers/brainstorm/9345-1792903600/content/coin-look.html`, the `coin()` function with `w = 1`):
- Outer ring: `P.INK`.
- Rim: `P.GOLD_LIGHT` where `dx + dy < 0` (top-left lit), `P.GOLD_DARK` otherwise.
- Face: `P.GOLD`.
- Emblem: `P.GOLD_DARK` cross at art-pixel `x = 6, y = 4..7` and `y = 5, x = 5..7`.
- Sweep band on frame `f ≥ 1`: `P.CREAM` where `|(x − y) − s| < 1.2`, with `s = -10 + (f − 1) * 5`, so the band crosses from the top-left to the bottom-right over frames 1–5.

- [ ] **Step 2: Bake and register**

In `bakeHazardTextures`: loop `f < COIN_FRAMES` → `bake(HAZARD_KEYS.coin(f), COIN_SIZE, COIN_SIZE, (g) => paintCoin(g, f))`. In `registerHazardAnimations`, call `scene.anims.create` directly, since the local `make` forces `repeat: -1`. Guard it with `scene.anims.exists('pk-coin-shine')`.

- [ ] **Step 3: Add the coin to ArtLab**

Add `['coin', (c) => c.add(this.add.sprite(0, 0, HAZARD_KEYS.coin(0)).play({ key: 'pk-coin-shine', repeat: -1, repeatDelay: 1100 }))]` next to the other entries.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run dev-nolog`. Then, in the browser console at `http://localhost:8080`, run `__game.scene.start('ArtLabScene')`.
Expected: a gold coin with an ink outline, lit top-left; a cream band sweeps across it about every 1.6s; it reads clearly against the floor-coloured background. It should match option C of the mockup.

- [ ] **Step 5: Commit**

```bash
git add src/game/lib/hazard-art.js src/game/scenes/ArtLab.js
git commit -m "feat(art): baked coin with shine sweep"
```

---

### Task 3: HUD coin panel

**Files:**
- Modify: `src/game/scenes/Hud.js` (`buildChamber`, `buildPlayerTag`, `setPlayer`, `onHud`, new `buildCoinPanel` / `setCoins`)

**Interfaces:**
- Consumes: `HAZARD_KEYS.coin(0)`, `COIN_SIZE` from Task 2.
- Produces: the HUD message `{ type: 'coins', coins: number, animate?: boolean }`, and the public property `HudScene#coinIconPos: { x: number, y: number } | null`, the screen-space centre of the coin icon. It's `null` when no panel was built.

- [ ] **Step 1: Build the panel**

`buildChamber` keeps the title panel's x and width (`16`, `title.width + 26`). When `this.mode === 'chamber' && this.initial.player`, call `buildCoinPanel(16 + title.width + 26 + 12, this.initial.player.coins)`. Tutorial mode gets no coin panel.

`buildCoinPanel(x, coins)`:
- The panel is `drawPanel(this, x, TOP - 2, w, SLOT + 4, { accent: P.GOLD_DARK }).setDepth(-1)`.
- Inside it: the icon `this.add.image(x + 10 + COIN_SIZE / 2, TOP + 20, HAZARD_KEYS.coin(0))`, and text `this.add.text(iconRight + 8, TOP + 21, …, TEXT.heading(22, P.GOLD_LIGHT)).setOrigin(0, 0.5)`.
- `w = 10 + COIN_SIZE + 8 + text.width + 12`.
- Set `this.coinIconPos = { x: icon.x, y: icon.y }` and initialise `this.coinIconPos = null` in `init`.

- [ ] **Step 2: Remove the old coin readout**

In `buildPlayerTag` / `setPlayer`, delete `_coinText`, `_coin` and their drawing. The name text stays where it is. `setPlayer(name, coins)` still sets the name, and calls `setCoins(coins, false)` when a panel exists.

- [ ] **Step 3: `setCoins(coins, animate)` and the `'coins'` message**

- Update the text, then redraw the panel when the width changes: destroy the old Graphics and call `drawPanel` again with the new `w`.
- When `animate && !reducedMotion()`:
  - Pop the icon and the text: scale 1.3 → 1 over 200ms, `Back.easeOut`.
  - Float a "+1": `TEXT.heading(16, P.GOLD_LIGHT)`, starting at `(coinIconPos.x + 6, coinIconPos.y + 30)`, moving up 18px while alpha goes 1 → 0 over 800ms, then destroyed.
- Add `case 'coins': this.setCoins(msg.coins, msg.animate); break;` to `onHud`.

- [ ] **Step 4: Verify**

Run `npx tsc --noEmit && npm run dev-nolog`, pick a player, start Chamber 1.
Expected: a gold-accented panel sits 12px right of "CHAMBER 1", showing the coin icon and the player's balance (10 for a new player). The player name is still on the right, and the old 6px dot is gone.

Large balance (Review Focus 5): in the console, run `__game.scene.getScene('GameScene').events.emit('hud', { type: 'coins', coins: 12345, animate: true })`.
Expected: the panel widens, the number pops and "+1" floats. Nothing overlaps the title. Start the Tutorial and confirm there's no coin panel.

- [ ] **Step 5: Commit**

```bash
git add src/game/scenes/Hud.js
git commit -m "feat(hud): coin panel beside the chamber title"
```

---

### Task 4: Coin controller and Game wiring

**Files:**
- Create: `src/game/lib/coins.js`
- Modify: `src/game/scenes/Game.js` (imports, decor `avoid` ~line 106–125, after `createKey()` ~line 190, `checkWin` ~line 474, shutdown handler ~line 178, new `collectCoin`)
- Modify: `CLAUDE.md` (module layout: `lib/coins.js`; the generator line mentions `coins`; HUD message list)

**Interfaces:**
- Consumes: `levelData.coins` (Task 1), `HAZARD_KEYS.coin`, `'pk-coin-shine'`, `COIN_FRAMES` (Task 2), the HUD `'coins'` message and `HudScene#coinIconPos` (Task 3), `setPlayerCoins(game, name, delta)` from `lib/player-db.js`, `tileRng(seed, col, row)` from `lib/generator.js`.
- Produces: `createCoins(scene, coins, { fx, seed, target, onCollect, onLand })` returns `{ tryCollect(col: number, row: number): boolean, destroy(): void }`.
  - `target: () => ({ x, y } | null)`, the screen-space point to fly to.
  - `onCollect(): any` runs immediately on pickup, and its return value is passed to `onLand(value)` when the flyer lands. If `target()` is null, there's no flyer, and `onLand` runs immediately.

- [ ] **Step 1: Placement and idle look in `createCoins`**

For each coin:
- Sprite `scene.add.sprite(centre(col), centre(row), HAZARD_KEYS.coin(0)).setDepth(DEPTH.pickup)`. Use the same tile-centre maths as `Game.js` (`col * TILE_SIZE + TILE_SIZE / 2`).
- `enableFilters()` and `filters.internal.addGlow(P.GOLD_LIGHT, 2, 0, 1)`, softer than the key's `3`.
- `scene.lights.addLight(x, y, 40, LIGHT.GOLD, 0.4)`.

Unless `reducedMotion()`:
- A bob tween per the Global Constraints.
- `sprite.play({ key: 'pk-coin-shine', repeat: -1, repeatDelay: 1100, delay: Math.floor(tileRng(seed, col, row)() * 1500) })`.
- On `Phaser.Animations.Events.ANIMATION_UPDATE`, when the frame's `textureKey === HAZARD_KEYS.coin(COIN_FRAMES - 1)`, flash a glint: one `HAZARD_KEYS.sparkle` image at the sprite's top-left (−7, −7), depth `DEPTH.pickup + 0.1`. It tweens scale 0 → 1.5 and back (yoyo, 120ms), is hidden in between, and is reused per coin.

- [ ] **Step 2: `tryCollect` and the flyer**

`tryCollect(col, row)`: if there's an uncollected coin on the tile, it runs these steps in order:
- Mark it collected.
- Convert the sprite's world position to screen coordinates (subtract `cam.scrollX` / `cam.scrollY`, as `collectKey` does).
- Play `fx.sparkle.explode(8, x, y)` unless `reducedMotion()`.
- Destroy the sprite, glint, light and tweens.
- `const v = onCollect()`.
- If `target()` returns a point, fly an image of `HAZARD_KEYS.coin(0)` at the screen position (`setScrollFactor(0)`, depth 900) to it, scaling 1 → 0.85 over 450ms with `Cubic.easeInOut`. On completion it destroys itself and calls `onLand(v)`. Track the flyers.
- Return `true`.

Otherwise return `false`.

`destroy()` kills and destroys all sprites, glints, lights and flyers, and sets a `dead` flag so no `onLand` runs afterwards.

- [ ] **Step 3: Wire it into `GameScene`**

- Add every `levelData.coins` tile to the decor `avoid` set, next to the key tiles.
- After `this.createKey()`:

  ```js
  this.coins = createCoins(this, levelData.coins ?? [], {
    fx: this.fx,
    seed: this.levelSeed,
    target: () => this.scene.get("HudScene")?.coinIconPos ?? null,
    onCollect: () => this.collectCoin(),
    onLand: (balance) => { if (balance != null) this.hud({ type: "coins", coins: balance, animate: true }); },
  });
  ```
- `collectCoin()`: read `registry.get("activePlayer")`. If there's none, return `null`. Otherwise call `setPlayerCoins(this.game, player.name, 1)` and return `this.game.registry.get("activePlayer").coin_balance`.
- First line of `checkWin()` (before the `_winTriggered` guard is fine too): `this.coins?.tryCollect(this.pipCol, this.pipRow);`
- In the existing `shutdown` handler: `this.coins?.destroy(); this.coins = null;`

- [ ] **Step 4: Update `CLAUDE.md`**

- Add `lib/coins.js` to the module layout: "`createCoins`: seeded coin pickups (bob, shine, glint), bank on pickup, fly to the HUD coin panel".
- Note `coins` in the generator bullet and the "Game logic notes" generator rules ("2–5 coins on route tiles, own salted RNG so seeds don't shift").
- Add the coin panel to the HudScene description.

- [ ] **Step 5: Run the automated checks**

Run: `npx tsc --noEmit && npm test`
Expected: both pass.

- [ ] **Step 6: Manual verification in `npm run dev-nolog`**

1. Pick a new player (balance 10) → Chamber 1. You should see 2–5 coins on the walkable route, none on a trap, each bobbing and sweeping at a different moment, with a glint after each sweep.
2. Walk over a coin. Expect a small sparkle, the coin flying to the panel, the count going 10 → 11 with a pop and "+1". There's no freeze and no screen flash.
3. Step off and back onto that tile, and hold a direction across another coin. Each coin is banked exactly once (Review Focus 4).
4. Die to a trap after collecting coins. The count doesn't drop and collected coins don't reappear.
5. Pick up a coin, then reach the chest within half a second (or pick one up just before winning). There should be no console errors, and on the Player screen after a reload the balance includes that coin (Review Focus 2).
6. Reload the page and open the Player screen. The new balance is shown.
7. In devtools, turn on "Emulate CSS prefers-reduced-motion: reduce" and reload. The coins are static, pickup still flies and counts, and there's no pop or "+1".
8. With an empty registry, run `__game.scene.start('GameScene', { level: 0 })` from the console (skip it if the scene redirects without a player). Coins can be picked up, nothing throws, and there's no coin panel (Review Focus 3).
9. Check that the Tutorial and the Boss arena have no coins.

- [ ] **Step 7: Commit**

```bash
git add src/game/lib/coins.js src/game/scenes/Game.js CLAUDE.md
git commit -m "feat(coins): collectable chamber coins that bank on pickup"
```
