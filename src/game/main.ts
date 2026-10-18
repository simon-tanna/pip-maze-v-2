import { Game, Scale, WEBGL } from 'phaser';
import { BootScene } from './scenes/Boot.js';
import { PlayerScene } from './scenes/Player.js';
import { TitleScene } from './scenes/Title.js';
import { GameScene } from './scenes/Game.js';
import { WinScene } from './scenes/Win.js';
import { TutorialScene } from './scenes/Tutorial.js';
import { BossScene } from './scenes/Boss.js';
import { ArtLabScene } from './scenes/ArtLab.js';
import { HudScene } from './scenes/Hud.js';

const config: Phaser.Types.Core.GameConfig = {
    type: WEBGL,
    parent: 'game-container',
    backgroundColor: '#0e0a0c',
    pixelArt: true,
    dom: { createContainer: true },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: 960,
        height: 720,
    },
    scene: [
        BootScene,
        PlayerScene,
        TitleScene,
        GameScene,
        WinScene,
        TutorialScene,
        BossScene,
        // Dev-only art-direction lab (screenshots / palette iteration).
        ...(import.meta.env.DEV ? [ArtLabScene] : []),
        // Parallel overlay; listed last so it renders above gameplay scenes.
        HudScene,
    ],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
