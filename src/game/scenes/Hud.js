// HUD overlay scene, launched in parallel by GameScene, TutorialScene and
// BossScene so camera filters (vignette, iris) never touch the HUD.
// The source scene drives it by emitting 'hud' events on its own emitter:
//   source.events.emit('hud', { type: 'keys', collected, required })
import Phaser from 'phaser';
import { P } from '../lib/palette.js';
import { TEXT, drawPanel } from '../lib/ui.js';
import { HAZARD_KEYS, bakeHazardTextures } from '../lib/hazard-art.js';
import { reducedMotion } from '../lib/fx.js';

const W = 960;
const SLOT = 40;
const SLOT_GAP = 8;
const TOP = 14;

// Screen-space centre of key slot i, so the source scene can fly keys to it.
export function hudKeySlotPos(i, required) {
  const right = W - 16;
  const x = right - (required - i) * (SLOT + SLOT_GAP) + SLOT_GAP + SLOT / 2;
  return { x, y: TOP + SLOT / 2 };
}

export class HudScene extends Phaser.Scene {
  constructor() { super('HudScene'); }

  init(data) {
    this.mode = data.mode || 'chamber';
    this.sourceKey = data.source;
    this.initial = data;
    this._slots = [];
    this._hearts = [];
    this._bossSegments = [];
    this._hint = null;
  }

  create() {
    bakeHazardTextures(this);
    const source = this.scene.get(this.sourceKey);
    source.events.on('hud', this.onHud, this);
    source.events.once('shutdown', () => this.scene.stop());
    this.events.once('shutdown', () => source.events.off('hud', this.onHud, this));

    if (this.mode === 'boss') this.buildBoss();
    else this.buildChamber();
    if (this.mode === 'tutorial') this.buildTutorial();
  }

  onHud(msg) {
    switch (msg.type) {
      case 'keys': this.setKeys(msg.collected, msg.required); break;
      case 'player': this.setPlayer(msg.name, msg.coins); break;
      case 'toast': this.toast(msg.text, msg.color); break;
      case 'instruction': this.setInstruction(msg.text); break;
      case 'instruction-fade': this.fadeInstruction(); break;
      case 'hint': this.hint(msg.text); break;
      case 'hero-hp': this.setHeroHp(msg.hp); break;
      case 'boss-hp': this.setBossHp(msg.hp, msg.max); break;
      default: break;
    }
  }

  // ── Chamber / tutorial ──────────────────────────────────
  buildChamber() {
    const title = this.add.text(28, TOP + 6, this.initial.title || '', TEXT.heading(22, P.CREAM));
    drawPanel(this, 16, TOP - 2, title.width + 26, SLOT + 4).setDepth(-1);

    const required = this.initial.requiredKeys || 0;
    for (let i = 0; i < required; i++) {
      const { x, y } = hudKeySlotPos(i, required);
      drawPanel(this, x - SLOT / 2, y - SLOT / 2, SLOT, SLOT, { accent: P.GOLD_DARK });
      const icon = this.add.image(x, y, 'key').setDisplaySize(26, 24)
        .setTint(P.INK).setTintMode(Phaser.TintModes.FILL).setAlpha(0.75);
      this._slots.push({ icon, filled: false, x, y });
    }
    this.setKeys(this.initial.collected || 0, required);

    if (this.initial.player) this.buildPlayerTag(required);
  }

  buildPlayerTag(required) {
    const right = required ? hudKeySlotPos(0, required).x - SLOT / 2 - 14 : W - 16;
    this._playerName = this.add.text(right, TOP + 2, '', TEXT.body(15, P.CREAM)).setOrigin(1, 0);
    this._coinText = this.add.text(right, TOP + 22, '', TEXT.body(14, P.GOLD_LIGHT)).setOrigin(1, 0);
    this._coin = this.add.graphics();
    this.setPlayer(this.initial.player.name, this.initial.player.coins);
  }

  setPlayer(name, coins) {
    if (!this._playerName) return;
    this._playerName.setText(name);
    this._coinText.setText(String(coins));
    const cx = this._coinText.x - this._coinText.width - 10;
    const cy = this._coinText.y + 9;
    this._coin.clear();
    this._coin.fillStyle(P.INK, 1).fillCircle(cx, cy, 6);
    this._coin.fillStyle(P.GOLD, 1).fillCircle(cx, cy, 5);
    this._coin.fillStyle(P.GOLD_LIGHT, 1).fillRect(cx - 2, cy - 3, 2, 2);
  }

  setKeys(collected, required) {
    this._slots.forEach((slot, i) => {
      const filled = i < collected;
      if (filled === slot.filled) return;
      slot.filled = filled;
      if (filled) {
        slot.icon.clearTint().setAlpha(1);
        if (!reducedMotion()) {
          slot.icon.setDisplaySize(36, 33);
          this.tweens.add({ targets: slot.icon, displayWidth: 26, displayHeight: 24, duration: 260, ease: 'Back.easeOut' });
        }
      } else {
        slot.icon.setTint(P.INK).setTintMode(Phaser.TintModes.FILL).setAlpha(0.75);
      }
    });
    this._required = required;
  }

  toast(text, color = P.GOLD_LIGHT) {
    const t = this.add.text(W / 2, 300, text, TEXT.heading(26, color)).setOrigin(0.5).setAlpha(0);
    this.tweens.chain({
      targets: t,
      tweens: [
        { alpha: 1, y: 290, duration: 180, ease: 'Cubic.easeOut' },
        { alpha: 0, y: 280, duration: 300, delay: 900 },
      ],
      onComplete: () => t.destroy(),
    });
  }

  buildTutorial() {
    this._instrPanel = drawPanel(this, 130, 650, 700, 56, { accent: P.FIRE });
    this._instr = this.add.text(480, 678, this.initial.instruction || '', {
      ...TEXT.body(18, P.CREAM), align: 'center', wordWrap: { width: 680 },
    }).setOrigin(0.5);
    this.add.text(944, 632, '0 / 1  PHASE     X  EXIT', TEXT.label(11, P.STONE_LIGHT)).setOrigin(1, 1);
  }

  setInstruction(text) {
    if (!this._instr) return;
    this._instr.setText(text);
    this._instr.setAlpha(1);
    this._instrPanel.setAlpha(1);
  }

  fadeInstruction() {
    if (!this._instr) return;
    this.tweens.add({ targets: [this._instr, this._instrPanel], alpha: 0, duration: 400, ease: 'Sine.easeOut' });
  }

  hint(text) {
    if (this._hint) { this._hint.forEach((o) => o.destroy()); this._hint = null; }
    const t = this.add.text(480, 96, text, { ...TEXT.body(18, P.FIRE_HOT), align: 'center' }).setOrigin(0.5);
    const panel = drawPanel(this, 480 - t.width / 2 - 14, 96 - t.height / 2 - 8, t.width + 28, t.height + 16, { accent: P.EMBER });
    t.setDepth(1);
    this._hint = [panel, t];
    this.tweens.add({
      targets: this._hint, alpha: 0, duration: 2500, delay: 1500,
      onComplete: () => { if (this._hint) { this._hint.forEach((o) => o.destroy()); this._hint = null; } },
    });
  }

  // ── Boss ────────────────────────────────────────────────
  buildBoss() {
    drawPanel(this, 16, TOP - 2, 132, SLOT + 4);
    for (let i = 0; i < 3; i++) {
      this._hearts.push(this.add.image(42 + i * 40, TOP + SLOT / 2, HAZARD_KEYS.heart(true)).setScale(3));
    }
    const barW = 300;
    const bx = W / 2 - barW / 2;
    this.add.text(W / 2, TOP - 2, 'STONE TROLL', TEXT.heading(16, P.CREAM)).setOrigin(0.5, 0);
    drawPanel(this, bx, TOP + 22, barW, 18, { accent: P.EMBER_DARK });
    const max = this.initial.bossMax || 3;
    const segW = (barW - 8 - (max - 1) * 4) / max;
    for (let i = 0; i < max; i++) {
      const seg = this.add.rectangle(bx + 4 + i * (segW + 4), TOP + 26, segW, 10, P.BLOOD).setOrigin(0, 0);
      this.add.rectangle(seg.x, seg.y, segW, 2, P.FIRE).setOrigin(0, 0);
      this._bossSegments.push(seg);
    }
    this.setHeroHp(this.initial.heroHp ?? 3);
  }

  setHeroHp(hp) {
    this._hearts.forEach((h, i) => {
      const full = i < hp;
      const key = HAZARD_KEYS.heart(full);
      if (h.texture.key === key) return;
      h.setTexture(key);
      if (!full && !reducedMotion()) {
        this.tweens.add({ targets: h, scale: { from: 4.2, to: 3 }, duration: 260, ease: 'Back.easeOut' });
      }
    });
  }

  setBossHp(hp) {
    this._bossSegments.forEach((seg, i) => {
      if (i < hp || seg.getData('drained')) return;
      seg.setData('drained', true);
      seg.setFillStyle(P.CREAM);
      this.tweens.add({
        targets: seg, scaleX: 0, duration: 380, ease: 'Cubic.easeIn',
        onComplete: () => seg.setFillStyle(P.SHADOW).setScale(1, 1),
      });
    });
  }
}

