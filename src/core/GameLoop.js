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

// V1.13.0 — pause automatique le temps de lire un message bloquant (nouvelle réplique Die-Hardman,
// alerte BB Pod...): mémorise l'état de pause manuel AVANT le premier appel (messagePauseActive
// idempotent — un second message pendant que le premier tient déjà la pause ne doit jamais écraser
// pausedBeforeMessage), pour que resumeAfterMessage() restaure exactement cet état plutôt que de
// toujours relancer l'horloge — une pause manuelle déjà active avant le message reste active après.
// PAS d'eventBus.emit('render:request') ici (à la différence de togglePause()): ces deux fonctions
// sont appelées depuis des chemins déjà en plein rendu/reconciliation (TutorialManager.js#reconcile,
// BBPodOverlay.js) — forcer un rendu synchrone ré-entrant depuis là a provoqué un débordement de pile
// (reconcile -> pauseForMessage -> render -> checkTutorialProgress -> reconcile...) et un crash sur
// du GameState partiellement initialisé en test (render() appelé avant la fin de newGame()). Seul
// runtime.paused doit changer ici; le prochain rendu naturel (très fréquent) le reflétera.
export function pauseForMessage() {
  if (!runtime.messagePauseActive) {
    runtime.pausedBeforeMessage = runtime.paused;
    runtime.messagePauseActive = true;
  }
  runtime.paused = true;
}

export function resumeAfterMessage() {
  if (!runtime.messagePauseActive) return;
  runtime.messagePauseActive = false;
  runtime.paused = runtime.pausedBeforeMessage;
}

export function setGameSpeed(mult) {
  const allowed = game.ngPlus ? [1, 2] : [1]; // x2 réservé à la Nouvelle Partie+, x3 supprimé (trop rapide pour être plaisant)
  runtime.gameSpeed = allowed.includes(mult) ? mult : 1;
  eventBus.emit('render:request');
}
