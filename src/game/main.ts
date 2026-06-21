import { Game, Scale, WEBGL } from 'phaser';
import { BootScene } from './scenes/Boot.js';
import { PlayerScene } from './scenes/Player.js';
import { TitleScene } from './scenes/Title.js';
import { GameScene } from './scenes/Game.js';
import { WinScene } from './scenes/Win.js';
import { TutorialScene } from './scenes/Tutorial.js';
import { BossScene } from './scenes/Boss.js';

const config: Phaser.Types.Core.GameConfig = {
    type: WEBGL,
    parent: 'game-container',
    backgroundColor: '#2c1810',
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
    ],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
