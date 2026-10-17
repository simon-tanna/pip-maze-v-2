import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', () => {

    const game = StartGame('game-container');

    // Dev-only handle for screenshot / perf scripts (stripped from prod builds).
    if (import.meta.env.DEV) (window as unknown as { __game: typeof game }).__game = game;

});
