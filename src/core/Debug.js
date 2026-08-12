// core/Debug.js — logs techniques et assertions pour le développement (distinct du journal de bord
// visible en jeu, qui est `logEvent()` dans core/GameState.js — celui-ci ne touche jamais l'UI).
const DEBUG = typeof location !== 'undefined' && /[?&]debug=1/.test(location.search || '');

export function debugLog(...args) {
  if (DEBUG) console.log('[DS-Manager]', ...args);
}

export function debugWarn(...args) {
  console.warn('[DS-Manager]', ...args);
}

export function assert(condition, message) {
  if (!condition) console.error('[DS-Manager] Assertion échouée:', message);
}
