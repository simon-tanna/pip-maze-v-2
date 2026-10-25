# Chamber Coins — Design

Date: 2026-10-25 · Branch: `coin-feature`

## Intent

Players have a gold balance (`lib/player-db.js`, shown on the Player screen and in the HUD) but nothing in the game ever adds to it: no coin has ever been placed in a chamber, and `setPlayerCoins` has no callers. The HUD's coin readout is a 6px circle with floating text and no panel, so it's hard to see.

This feature puts collectable coins in every chamber so walking the route rewards the player, makes them look like a pickup that belongs next to the key, and gives the balance a counter that's easy to read and visibly ticks up.

## Goals

- 2–5 coins per chamber, chosen at random **from the level seed**.
- Coins sit on the start → key (→ key 2) → chest route and **never on a trap**.
- Coins are drawn like the key: unlit, glowing, bobbing, with a small gold light. Look **C, "shine sweep"**: a flat coin face, a bright diagonal band sweeping across it every ~1.5s, then one star glint at the top-left.
- Pickup: a sparkle burst, then the coin flies to the HUD counter, the counter pops, and a "+1" floats up.
- Coins are banked on pickup (`setPlayerCoins(game, name, +1)`). Dying never removes them.
- HUD layout **A**: a coin counter panel just right of the "CHAMBER N" title panel, with the baked coin icon and the count in the display font.

## Non-goals

- Spending coins, shops, or any change to the Player screen.
- Coins in the Tutorial or the Boss arena.
- Changing level difficulty, trap counts, or the layout of existing seeds.

## Anti-goals (failure even if it "works")

- Adding coins changes the maze, traps or keys produced by an existing seed.
- A coin sits on a trap, a mummy patrol, the spawn zone, a key or the chest.
- Coin pickups feel as heavy as the key: no hit-stop and no screen flash.
- Colours written outside `palette.js`, or Graphics redrawn every frame.
- `Math.random` used for anything that decides where coins go.

## Constraints (from the codebase)

- Phaser 4.1 (not 3). Follow the existing `paint*` / `bake*` / `draw*` split and depth bands (pickups = `DEPTH.pickup`, 3).
- Levels are deterministic per seed (`game.registry.levelSeeds`), and `generateLevel` keeps the best of 6 candidates. Coin selection must not consume the generator's main `rng`, otherwise every later draw shifts and existing seeds change.
- Pickup checks happen when a step lands (`checkWin` from the step tween's `onComplete`), not by polling.
- `prefers-reduced-motion` is honoured through `reducedMotion()` in `lib/fx.js`.
- A player is always selected before play (`PlayerScene`), so `registry.activePlayer` exists in chambers.

## Approaches considered

1. **Generator places coins + `lib/coins.js` controller + baked art (chosen).** `generateLevel` returns a `coins` list next to `key` and `key2`, `hazard-art.js` bakes the coin frames, and a small controller owns placing, animating and collecting coins. *Trade-off:* more files to touch. In return, coins are level data: they're covered by the seed and checked by the generator's fairness rules, and `Game.js` (~600 lines) only calls the controller.
2. **Everything inside `GameScene`.** Pick coin tiles at setup from `criticalPath` minus the traps, inline next to the key code. *Trade-off:* fewer files, but the fairness checks never see coins and `Game.js` grows.
3. *(Dropped)* **A PNG coin like the key.** The shine sweep needs several frames, and the palette rule forbids colours outside `palette.js`.

Picked: **1**, so coins get the same seeding and fairness guarantees as keys.

## Design

### 1. Placement — `lib/generator.js`

- In `_generateOnce`, after traps are placed (when `route`, `occupied` and `hazards` are final), choose coins:
  - Candidates are the unique tiles of `route` that are floor (`map[r][c] === 0`) and not in `occupied`. `occupied` already covers the spawn zone, keys, chest, mummy patrols and every trap.
  - Use a **separate** RNG: `mulberry32((seed ^ COIN_SALT) >>> 0)`, where `seed` is the candidate seed passed to `_generateOnce`. Draw `count = randInt(coinRng, 2, 5)`, shuffle the candidates with `coinRng`, and take the first `count`.
  - My call: space coins out so they don't clump. Prefer candidates at least 3 route steps apart, and fall back to any candidate if that leaves fewer than `count`.
  - If fewer than 2 candidates exist, return `null` (rejects the candidate). In practice routes are 40+ tiles, so this should never trigger. My call: the 2-coin minimum wins over seed stability in this edge case. The verification script below reports any seed where it fires.
- Return `{ map, key, key2, traps, coins, exitCol, exitRow }`, where `coins` is `[{ col, row }]`.
- `isFair`: add a check that no coin is on a hazard or patrol tile (`reason: "coin under a hazard"`), so the rule is enforced in the same place as the others.
- `measureLevel`: no scoring change (coins don't affect difficulty).

### 2. Art — `lib/hazard-art.js`

- `HAZARD_KEYS.coin: (frame) => \`pk-coin-${frame}\``, with `COIN_FRAMES` (my call: 6, made of 1 plain face + 5 sweep positions).
- `paintCoin(g, frame)`: a 24×24 texture (12×12 art pixels at 2px), pixel-aligned rects only. INK outline; lit rim GOLD_LIGHT top-left and GOLD_DARK bottom-right; GOLD face; small GOLD_DARK emblem; on sweep frames a CREAM diagonal band at increasing offsets. Use the mockup in `.superpowers/brainstorm/…/coin-look.html` (option C) as the visual reference.
- `registerHazardAnimations`: `pk-coin-shine` plays the sweep frames once, then holds on frame 0. The ~1.5s cadence comes from the controller (a repeat delay or a timer), so the face is plain most of the time.
- The star glint reuses the existing `fx-sparkle` texture as a single image that scales up and back down, rather than a new texture.

### 3. Controller — new `lib/coins.js`

`createCoins(scene, coins, { fx, onCollect })` returns `{ tryCollect(col, row), destroy() }`.

- **Place:** for each coin, an image at the tile centre (`DEPTH.pickup`), unlit, `enableFilters()` + `filters.internal.addGlow(P.GOLD_LIGHT, …)` (softer than the key's), a `lights.addLight(…, LIGHT.GOLD, …)` smaller and dimmer than the key's, a bob tween (±3px, 900ms, Sine yoyo, matching the key), and the shine animation repeating every ~1.5s with a per-coin phase offset (seeded from tile position via `tileRng`, so the coins don't flash in unison).
- **Lights budget:** Phaser culls to 10 lights per camera. Up to 5 coin lights plus the hero torch, key, flames and chest can exceed that. My call: coin lights are small (radius ~40) and are removed on pickup. If culling becomes visible, drop coin lights before anything else; the glow filter carries the look on its own.
- **tryCollect(col, row):** if an uncollected coin is there, play a sparkle burst (`fx.sparkle.explode(8, …)`, about half the key's), clear the sprite, light and tweens, then spawn a screen-space flyer (`setScrollFactor(0)`, depth 900) that tweens to the HUD coin icon position (`hudCoinPos()` exported from `Hud.js`, mirroring `hudKeySlotPos`) in ~450ms with `Cubic.easeInOut`, shrinking slightly. Call `onCollect()` **immediately on pickup**, so the balance is saved even if the scene ends mid-flight. The HUD's visual tick happens when the flyer lands.
- **Reduced motion:** no bob and no sweep (static frame 0); the pickup still flies but without the burst. My call, matching how `fx.js` reduces juice.
- Coins aren't affected by death or respawn.

### 4. Game wiring — `scenes/Game.js`

- After `createKey()`: `this.coins = createCoins(this, levelData.coins, { fx: this.fx, onCollect: () => this.collectCoin() })`.
- At the top of `checkWin()` (before the key checks, which `return` early): `this.coins.tryCollect(this.pipCol, this.pipRow)`. A coin and a key never share a tile, so the order between them doesn't matter.
- `collectCoin()`: `setPlayerCoins(this.game, name, 1)`, then emit `hud { type: 'coins', coins: newBalance, animate: true }` when the flyer lands (the controller passes a landing callback, or `onCollect` returns the delay; the builder can pick either).
- Add coin tiles to the decor `avoid` set so a pot or bones never sits under a coin.
- Destroy the controller on `shutdown`.

### 5. HUD — `scenes/Hud.js`

- `buildChamber` (chamber mode only, when a player is set): a coin panel `drawPanel(…, { accent: P.GOLD_DARK })` at the title panel's right edge + 12px, ~SLOT+4 tall to match the title panel. Inside: the baked coin icon (frame 0, ~24px) and the balance in `TEXT.heading(22, P.GOLD_LIGHT)`. The panel width grows with the digit count.
- Export `hudCoinPos()` returning the icon's screen-space centre (it depends on the title width, so compute it in `buildChamber` and store it, or measure the title text the same way).
- `buildPlayerTag` keeps the name on the right but drops the old coin graphics/text.
- New message `case 'coins': this.setCoins(msg.coins, msg.animate)`: update the text, and when `animate` is set, pop the icon and text (scale 1.3 → 1, ~200ms, Back.easeOut) and float a "+1" (`TEXT.heading(16, P.GOLD_LIGHT)`) up ~18px while fading out over ~800ms. Skip the pop and the float under reduced motion.
- Keep the existing `'player'` message working (it sets the name and the initial balance).

## Left to the builder

- The exact sweep band shape and frame count, as long as it reads like option C.
- Exact glow strength, light radius and intensity values, tuned against the key so the key stays the stronger pickup.
- How the flyer's landing triggers the HUD update (a callback vs. a returned delay).
- Whether coin spacing uses route-index distance or tile distance.

## Verification

- `npx tsc --noEmit` passes.
- A quick script over `generateLevel(i, seed)` for all 9 levels × many seeds: every level has 2–5 coins, none on a trap, patrol, spawn zone, key or chest, all on the route. The `map`, `key`, `key2` and `traps` for a fixed seed match the output before the change.
- In the browser: coins visible in Chamber 1, the shine sweep is visible, pickup flies to the panel, the count ticks up, the balance persists after a reload (Player screen shows the new total), and dying keeps collected coins.
