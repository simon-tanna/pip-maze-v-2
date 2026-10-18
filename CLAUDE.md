# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Pip's Temple Adventure** — a pixel-art maze game where Pip (or John or Ellen) collects keys and a chest while dodging flames, blades, mummies, and spikes across procedurally-generated 40×15 chambers. Migrated from a Phaser 3 source repo at `../pip-maze` to Phaser 4.1 + Vite + TypeScript.

## Commands

- `npm install` — install dependencies
- `npm run dev` — dev server with hot reload at `http://localhost:8080`
- `npm run build` — production build to `dist/`
- `npm run dev-nolog` / `npm run build-nolog` — same as above but skip `log.js`

No test, lint, or typecheck scripts are configured. Run `npx tsc --noEmit` to type-check explicitly. Vite configs are split: `vite/config.dev.mjs` and `vite/config.prod.mjs`.

## Architecture

Phaser 4.1 game using Vite + TypeScript. Note: this is **Phaser 4**, not Phaser 3 — most Phaser examples and training-data recall target v3 and some APIs differ.

Entry chain:
- `index.html` loads `/src/main.ts` and includes the on-screen d-pad markup that `GameScene`/`TutorialScene` reference via `document.getElementById('dpad' | 'btn-up' | …)`. The WebFont loader is also pulled in from CDN here.
- `src/main.ts` waits for DOMContentLoaded then calls `StartGame('game-container')`.
- `src/game/main.ts` defines the `GameConfig` (960×720 FIT-scaled, WEBGL renderer, `pixelArt: true`, `#0e0a0c` ink background so iris transitions close to black) and registers the scene list.

Scenes live in `src/game/scenes/` as `Boot.js`, `Player.js`, `Title.js`, `Game.js`, `Win.js`, `Tutorial.js`, `Boss.js`, `Hud.js` (and dev-only `ArtLab.js`), each exporting a `…Scene` class. Run order:

1. **BootScene** — loads sprite sheets and key/chest images, registers idle+walk animations per character, bakes every procedural texture (`bakeEnvironmentTextures`, `bakeHazardTextures`) and hazard animations, loads Black Ops One + Pixelify Sans via WebFont.
2. **PlayerScene** — player-name entry / selection (`lib/player-db.js`, localStorage).
3. **TitleScene** — DOOM MAZE logotype with a "Pip's Temple Adventure" subtitle, lit temple backdrop, three-plinth character carousel (left/right; down/up moves focus to Tutorial / Boss buttons). Resets per-level seeds on entry.
4. **GameScene** — main gameplay. 40×15 tile world; camera follows the hero. Reads procedural level from `lib/generator.js`, validates start→key→chest BFS path, bakes the chamber, spawns hazards from `lib/hazards.js`, launches `HudScene`.
5. **WinScene** — rays + plinth victory screen; "Tap to continue" advances level (`GameScene` with `level+1`). After level 9 (final `LEVEL_CONFIGS` entry) it routes to `BossScene` instead.
6. **TutorialScene** — 3 phases (blade, flame, spike), each with an auto-demo then player practice; uses the same chamber/hazard/hero code as GameScene and `HudScene` in tutorial mode.
7. **BossScene** — boss arena (pillars + lava). Entered from `WinScene` after final level or directly from Title. Hero HP and boss HP both 3; uses i-frame `_heroInvincible`/`_bossInvincible` flags. Charge and stomp have telegraphs inside their existing idle/recovery windows.
8. **HudScene** — parallel overlay launched by Game/Tutorial/Boss (`mode: 'chamber' | 'tutorial' | 'boss'`). Listed last in `main.ts` so it renders on top. The source scene drives it with `this.events.emit('hud', { type, ... })`; the HUD stops itself when its source shuts down. Keeping the HUD in its own scene means camera filters (vignette, iris) never touch it.

## Module layout

- `src/game/lib/constants.js` — `TILE_SIZE = 48`
- `src/game/lib/palette.js` — **every colour**: `P` (30 named colours, "Torchlit Sandstone"), `LIGHT` (light colours), `css()` for Text/CSS strings. Never write a hex colour elsewhere.
- `src/game/lib/environment.js` — 4-bit autotiled walls (front face when the tile below is open), flagstone floors, stepped AO, `planDecor` (sparse, wall-hugging, avoids hazards and the critical path), `drawChamber` (bakes a whole chamber into one DynamicTexture image), `drawTempleBackdrop` (menus), boss-arena textures
- `src/game/lib/hazard-art.js` — baked hazard/FX/UI textures (`HAZARD_KEYS`): spike idle/armed/up, nozzle idle/hot, 4-frame flame, axe blade, 4-frame mummy (+ alert eyes), dust/ember/sparkle/glow/rays, hearts, arrow, decor; `registerHazardAnimations`
- `src/game/lib/hazards.js` — runtime hazard controllers shared by Game and Tutorial (`createFlameTrap`, `createSpikeTrap`, `createBladeTrap`, mummy visuals), `HAZARD_TIMING`, `DEPTH`
- `src/game/lib/hero.js` — `createHero`: outline (4 FILL-tinted copies), contact shadow, step squash, dust, idle breathing, hit flash, die/respawn. Call `rig.sync()` every frame.
- `src/game/lib/fx.js` — `shake`, `hitStop`, `flash`, `iris` transition, pooled particle bursts (`createWorldFx`); all honour `prefers-reduced-motion`
- `src/game/lib/ui.js` — `FONT`, `TEXT` styles (Black Ops One display, Pixelify Sans body), `drawPanel`, `createButton`
- `src/game/lib/dpad.js` — `hideDpad`/`showDpad`/`showFireButton` (touch devices only) and `wireDpad`/`unwireDpad`; all `#dpad` DOM access goes through here
- `src/game/lib/animation-registry.js` — `registerCharacterAnimations(scene)`; called from `BootScene`
- `src/game/lib/generator.js` — `mulberry32`, `randInt`, `shuffle`, `bfsPath`, `tileRng`, `criticalPath`, `LEVEL_CONFIGS`, `generateLevel`
- `src/game/lib/graphics.js` — `CHARACTER_CONFIGS`, `createPlayer`, `drawChest`, `drawKey` (image-backed only)
- `src/game/lib/player-db.js` — player names + coins in localStorage
- `src/game/lib/tutorial-config.js` — the three `TUTORIAL_CONFIGS` maps

Helper modules and scenes are `.js`. Vite + the template's `tsconfig.json` (with `allowImportingTsExtensions` and bundler module resolution) handles both `.ts` and `.js` side-by-side.

## Rendering conventions

- **Paint, bake, draw.** `paint*(g, …)` fills a Graphics with pixel-aligned rects (top-left coords, no anti-aliased paths); `bake*Textures(scene)` turns paints into textures once (idempotent); `draw*`/`create*` place objects. No per-frame Graphics redraws.
- **Lighting:** the chamber/arena image gets `setLighting(true)`; hazards, pickups and the hero stay unlit so they read at full brightness. Lights: hero torch, flames (only while telegraphing/firing), pickups, lava. Phaser culls to 10 lights per camera.
- **Light comes from the top-left**; never rotate a texture with baked lighting (vary by pattern instead).
- **Telegraphs live inside the original hazard timings** (`HAZARD_TIMING`), so difficulty is unchanged. Flame/spike records expose `rect.active` and `rect.telegraph`.
- **Depth bands:** chamber 0, hazard bases 2, pickups 3, hazards 4, hero 5, world FX 6.
- **Dev tooling:** in dev builds `window.__game` is the Phaser.Game and `ArtLabScene` shows every baked asset (`__game.scene.start('ArtLabScene')`). Neither ships in production builds.
- Scene gotcha: don't `stop()` a scene and `start()` it again in the same tick from outside Phaser; use `scene.restart()`.

## Game logic notes

- **Levels** are procedurally generated by `generateLevel(levelIndex, seed)`. Seeds are stored in `game.registry` under `levelSeeds` so the same level replays deterministically until the player resets via the Title screen.
- **Map tile values:** `0` = floor, `1` = wall, `2` = start, `3` = chest exit.
- **Dual-key levels** (index ≥ 3): pick up Key 1 → Key 2 reveals → grab Key 2 → reach chest. Losing a key on hazard contact respawns it.
- **Movement** is grid-snap via tweens (120ms per tile); not physics-based.
- **D-pad markup in `index.html`** is required — `GameScene` wires the buttons via `lib/dpad.js` (`wireDpad`), Boss wires its own hold handlers, and Title/Tutorial call `hideDpad`/`showDpad`. The pad is styled in `public/style.css` and only shown on touch devices.

## Assets

Static assets live in `public/assets/sprites/` (served at the URL `assets/sprites/...`). Sprite sheets: `pip.png`, `john.png`, `ellen.png`. Static images: `chest.png`, `key.png`, plus `*-win.png` victory poses.

Global page styling (including the d-pad and fire button, using the palette as CSS variables) lives in `public/style.css`. Black Ops One and Pixelify Sans are loaded from Google Fonts in `index.html`.
