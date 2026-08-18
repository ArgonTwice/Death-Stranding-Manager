// ui/TutorialOverlay.js (V1.0.1) — bannière tactile holographique Die-Hardman: réplique de l'étape
// courante + bouton [SKIP] (≥48px, toujours présent — règle 2). Purement présentationnel: ne décide
// jamais elle-même de la progression (TutorialManager.js), ne touche jamais game.* au-delà de ce que
// window.skipTutorialUI() délègue.
import { game } from '../core/GameState.js';
import { tutorialStepByIndex } from '../data/TutorialScript.js';

let nudgeTimeout = null;

export function renderTutorialOverlay() {
      const el = document.getElementById('tutorialOverlay');
      if (!el) return;
      if (game.tutorial.completed) { el.classList.remove('open'); return; }
      const step = tutorialStepByIndex(game.tutorial.step);
      if (!step) { el.classList.remove('open'); return; }
      el.classList.add('open');
      el.classList.remove('nudge');
      const lineEl = document.getElementById('tutorialLine');
      if (lineEl) lineEl.textContent = step.dieHardman;
    }

// Relance verbale temporaire (règle 4) — remplace la réplique quelques secondes puis restaure celle
// de l'étape en cours. Jamais de blocage: purement un changement de texte + un léger surlignage du
// cadre de la bannière (CSS .nudge), aucune interaction utilisateur n'est empêchée pendant ce temps.
export function showTutorialNudge(text) {
      if (!text) return;
      const el = document.getElementById('tutorialOverlay');
      const lineEl = document.getElementById('tutorialLine');
      if (!el || !lineEl) return;
      el.classList.add('nudge');
      lineEl.textContent = text;
      if (nudgeTimeout) clearTimeout(nudgeTimeout);
      nudgeTimeout = setTimeout(() => { renderTutorialOverlay(); }, 2600);
    }
