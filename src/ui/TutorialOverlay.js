// ui/TutorialOverlay.js (V1.0.1, bannière compacte V1.0.2) — bannière tactile holographique
// Die-Hardman: réplique de l'étape courante + bouton [SKIP] (≥48px, toujours présent — règle 2) +
// bouton [▼/▲] pour replier la bannière en simple pastille icône (règle 1 de la mission V1.0.2:
// "prend trop de place sur mobile" — SKIP reste accessible même repliée). Purement présentationnel:
// ne décide jamais elle-même de la progression (TutorialManager.js), ne touche jamais game.* au-delà
// de ce que window.skipTutorialUI()/window.toggleTutorialUI() délèguent.
import { game } from '../core/GameState.js';
import { tutorialStepByIndex } from '../data/TutorialScript.js';

let nudgeTimeout = null;
let collapsed = false;
let heightObserver = null;

// V1.0.2 règle 1 ("padding-top dynamique") — expose la hauteur RÉELLE de la bannière (0 si fermée)
// en variable CSS globale, consommée par #app-main (style.css) pour repousser le reste de la page
// exactement de ce qu'il faut, sans jamais deviner une valeur fixe (le texte de chaque étape/la
// largeur d'écran font varier cette hauteur).
function updateOverlayHeightVar(el) {
      // Garde défensive: l'environnement de test (tests/resilience/_stubEnv.mjs) fournit un
      // document.getElementById() minimal SANS document.documentElement — cette fonction ne doit
      // jamais faire planter checkTutorialProgress()/render() dans ce contexte ni dans tout
      // environnement sans CSSStyleDeclaration.setProperty.
      const root = typeof document !== 'undefined' && document.documentElement;
      if (!root || !root.style || typeof root.style.setProperty !== 'function') return;
      const h = el.classList.contains('open') ? el.offsetHeight : 0;
      root.style.setProperty('--tutorial-h', h + 'px');
    }

function ensureHeightObserver(el) {
      if (heightObserver || typeof ResizeObserver !== 'function') return;
      heightObserver = new ResizeObserver(() => updateOverlayHeightVar(el));
      heightObserver.observe(el);
    }

// Bouton [▼ replier / ▲ déplier] — bascule un état purement local d'affichage (pas persisté dans
// GameState: ce n'est pas une donnée de simulation, juste une préférence d'affichage éphémère).
export function toggleTutorialCompact() {
      collapsed = !collapsed;
      const el = document.getElementById('tutorialOverlay');
      const btn = document.getElementById('tutorialToggleBtn');
      if (el) el.classList.toggle('collapsed', collapsed);
      if (btn) btn.textContent = collapsed ? '▲' : '▼';
      if (el) updateOverlayHeightVar(el);
    }

export function renderTutorialOverlay() {
      const el = document.getElementById('tutorialOverlay');
      if (!el) return;
      if (game.tutorial.completed) {
        // V1.0.7 — destruction visuelle complète (SKIP ou parcours complet, même traitement): .hidden
        // verrouille display/height/visibility/pointer-events en plus du transform déjà hors-écran,
        // jamais retirée ensuite (TutorialManager.js bloque tout réengagement une fois completed).
        el.classList.remove('open');
        el.classList.add('hidden');
        updateOverlayHeightVar(el);
        return;
      }
      const step = tutorialStepByIndex(game.tutorial.step);
      if (!step) { el.classList.remove('open'); updateOverlayHeightVar(el); return; }
      el.classList.add('open');
      el.classList.remove('nudge');
      el.classList.toggle('collapsed', collapsed);
      const lineEl = document.getElementById('tutorialLine');
      if (lineEl) lineEl.textContent = step.dieHardman;
      ensureHeightObserver(el);
      updateOverlayHeightVar(el);
    }

// Relance verbale temporaire (règle 4) — remplace la réplique quelques secondes puis restaure celle
// de l'étape en cours. Jamais de blocage: purement un changement de texte + un léger surlignage du
// cadre de la bannière (CSS .nudge), aucune interaction utilisateur n'est empêchée pendant ce temps.
// Se déplie automatiquement si elle était repliée, sinon la relance passerait inaperçue.
export function showTutorialNudge(text) {
      if (!text) return;
      const el = document.getElementById('tutorialOverlay');
      const lineEl = document.getElementById('tutorialLine');
      if (!el || !lineEl) return;
      if (collapsed) toggleTutorialCompact();
      el.classList.add('nudge');
      lineEl.textContent = text;
      if (nudgeTimeout) clearTimeout(nudgeTimeout);
      nudgeTimeout = setTimeout(() => { renderTutorialOverlay(); }, 2600);
    }
