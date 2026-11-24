// Bootstraps the 3D game once the player clicks "Start".
import { Game3D } from './game3d.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');

  let game = null;

  startBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    if (!game) {
      game = new Game3D(canvas);
      game.start();
      window.__game = game;
    }
    canvas.focus();
  });
});
