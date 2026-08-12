// core/GameLoop.js — horloge générique (1s réelle = 1 jour), volontairement sans dépendance vers
// engine/ ou ui/ : le "tick" à exécuter est injecté par main.js (composition root), et les demandes
// de rafraîchissement passent par l'EventBus plutôt que par un import direct de ui/HUD.js.
import { game, logEvent, runtime } from './GameState.js';
import { eventBus } from './EventBus.js';
import { DAY_MS } from '../data/Balance.js';

let gameTimer = null;
let tickFn = null;

// À appeler une fois au boot avec la fonction qui fait avancer un jour de simulation (advanceDay).
export function setTickFn(fn) {
  tickFn = fn;
}

export function startGameClock() {
  if (gameTimer) clearInterval(gameTimer);
  gameTimer = setInterval(() => {
    if (runtime.paused || game.gameEnded || document.hidden) return; // pas d'avancée hors écran ni en pause
    for (let i = 0; i < runtime.gameSpeed; i++) if (tickFn) tickFn();
  }, DAY_MS);
}

export function togglePause() {
  runtime.paused = !runtime.paused;
  logEvent(runtime.paused ? '⏸️ Horloge en pause' : '▶️ Horloge relancée');
  eventBus.emit('render:request');
}

export function setGameSpeed(mult) {
  const allowed = game.ngPlus ? [1, 2] : [1]; // x2 réservé à la Nouvelle Partie+, x3 supprimé (trop rapide pour être plaisant)
  runtime.gameSpeed = allowed.includes(mult) ? mult : 1;
  eventBus.emit('render:request');
}
