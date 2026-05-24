import { AUTO, Game, Scale } from 'phaser';
import { BootScene } from './scenes/Boot.js';
import { TitleScene } from './scenes/Title.js';
import { GameScene } from './scenes/Game.js';
import { WinScene } from './scenes/Win.js';
import { TutorialScene } from './scenes/Tutorial.js';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#2c1810',
    pixelArt: true,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: 960,
        height: 720,
    },
    scene: [
        BootScene,
        TitleScene,
        GameScene,
        WinScene,
        TutorialScene,
    ],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
