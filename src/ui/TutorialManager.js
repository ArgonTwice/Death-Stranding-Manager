// ui/TutorialManager.js (V1.0.1) — orchestrateur du tutoriel guidé Die-Hardman: évalue
// isStepSatisfied(game) à chaque render() (auto-validation + reprise après reload, règle 3), pose/
// retire la classe CSS .tutorial-highlight sur l'élément cible (règle 4 — jamais de pointer-events
// bloquant), et gère le bouton [SKIP] toujours disponible (règle 2).
//
// RÈGLE D'ISOLATION (V1.0.1 règle 1): AUCUN import de RNG.js, AUCUN appel à RNG.next() — vérifiable
// par simple lecture des imports ci-dessous. Le seul état muté est `game.tutorial.*` (persisté,
// couvert par le triad SaveManager.js) et, une fois, `game.money`/`game.materials` via le bonus de
// départ (montants fixes, non-RNG — cf. TutorialScript.js).
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { TUTORIAL_REWARDS, TUTORIAL_STEP_COUNT, tutorialStepByIndex } from '../data/TutorialScript.js';
import { renderTutorialOverlay, showTutorialNudge } from './TutorialOverlay.js';

let currentHighlightEl = null;
let documentClickBound = false;
let highlightObserver = null;

function clearHighlight() {
      if (currentHighlightEl) { currentHighlightEl.classList.remove('tutorial-highlight'); currentHighlightEl = null; }
    }

function applyHighlightForCurrentStep() {
      clearHighlight();
      if (game.tutorial.completed) return;
      const step = tutorialStepByIndex(game.tutorial.step);
      if (!step || !step.targetSelector) return;
      const el = document.querySelector(step.targetSelector);
      if (el) { el.classList.add('tutorial-highlight'); currentHighlightEl = el; }
    }

// V1.0.2 fix règle 2 — checkTutorialProgress() ne tourne qu'à chaque render()/navigation, ce qui
// suffisait pour les boutons statiques de la barre d'onglets, mais une cible future vivant dans un
// contenu recréé à l'ouverture d'un tiroir/modale (ex: un bouton "Signer" à l'intérieur d'une carte de
// contrat régénérée en innerHTML) pouvait apparaître APRÈS le dernier appel et ne jamais recevoir le
// halo. Un MutationObserver sur childList/subtree (jamais 'attributes', pour ne pas se redéclencher
// sur son propre classList.add/remove — donc aucun risque de boucle infinie) réapplique le highlight
// dès que le DOM change, quelle que soit son origine.
function ensureHighlightObserver() {
      if (highlightObserver || typeof MutationObserver !== 'function' || typeof document === 'undefined' || !document.body) return;
      highlightObserver = new MutationObserver(() => applyHighlightForCurrentStep());
      highlightObserver.observe(document.body, { childList: true, subtree: true });
    }

// Idempotent (règle 2: jamais de double attribution) — que ce soit via [SKIP] ou une fin de parcours
// normale, le même bonus fixe est accordé UNE SEULE fois, gardé par rewardsGranted.
function grantRewardsOnce() {
      if (game.tutorial.rewardsGranted) return;
      game.money += TUTORIAL_REWARDS.money;
      game.materials.chiral_crystal = (game.materials.chiral_crystal || 0) + TUTORIAL_REWARDS.chiral_crystal;
      game.tutorial.rewardsGranted = true;
      logEvent(`🎁 Kit de départ Bridges reçu — +$${TUTORIAL_REWARDS.money}, +${TUTORIAL_REWARDS.chiral_crystal} chiral crystal`, 'good');
    }

function finishTutorial() {
      game.tutorial.completed = true;
      grantRewardsOnce();
      clearHighlight();
      renderTutorialOverlay();
      eventBus.emit('tutorial:completed');
    }

// Bouton [SKIP] — présent à TOUTES les étapes (règle 2). Masque l'overlay immédiatement, libère
// l'UI (retire tout highlight), et n'accorde le bonus qu'une fois.
export function skipTutorial() {
      if (game.tutorial.completed) return;
      game.tutorial.skipped = true;
      finishTutorial();
    }

// V1.0.3 — reconcile(state) rattrape la progression en UNE SEULE passe: contrairement à
// checkTutorialProgress() (n'avance QUE d'une étape par appel, pensé pour le rythme du render() en
// jeu), reconcile() boucle tant que l'étape courante est déjà satisfaite par l'état RÉEL de la partie
// (state.porters/state.mapsData/state.completed — jamais un id ou une référence qui pourrait avoir
// disparu depuis, toujours une inspection directe des entités qui existent VRAIMENT dans GameState
// au moment de l'appel). Nécessaire pour un reload/import qui restaure d'un coup un état où plusieurs
// jalons sont déjà réunis (vieille save migrée, import externe): sans la boucle, il aurait fallu
// plusieurs render() futurs pour rattraper chaque étape une par une.
// RÈGLE D'ISOLATION (V1.0.1 règle 1, inchangée): aucun accès à RNG.js, ne mute que state.tutorial.*.
export function reconcile(state) {
      if (state.tutorial.completed) return;
      let step = tutorialStepByIndex(state.tutorial.step);
      if (!step) { finishTutorial(); return; } // index hors-limites (état corrompu/migré) — clôture défensive, comme avant V1.0.3
      while (step && step.isStepSatisfied(state)) {
        state.tutorial.step++;
        if (state.tutorial.step >= TUTORIAL_STEP_COUNT) { finishTutorial(); return; }
        step = tutorialStepByIndex(state.tutorial.step);
      }
      applyHighlightForCurrentStep();
      renderTutorialOverlay();
    }

// Ré-évaluée à chaque render() (HUD.js) — coût négligeable (une poignée de comparaisons sur des
// champs déjà en mémoire), et c'est exactement ce qui permet la reprise automatique après reload: au
// premier appel suivant un chargement de sauvegarde, une étape déjà accomplie dans une session
// précédente est aussitôt détectée comme satisfaite et l'étape suivante s'affiche sans redemander au
// joueur une action déjà faite. Délègue à reconcile() (qui ne fait qu'UN tour de boucle la plupart du
// temps — un seul jalon franchi par jour simulé — donc un comportement inchangé pour tous les appels
// existants).
export function checkTutorialProgress() {
      reconcile(game);
    }

// Relance verbale non-bloquante (règle 4): un clic hors de la cible en surbrillance ne fait JAMAIS
// preventDefault()/stopPropagation() — le jeu réagit normalement au clic, Die-Hardman se contente de
// glisser un mot au passage.
function handleDocumentClick(evt) {
      if (game.tutorial.completed) return;
      // V1.0.2 fix — un clic sur la bannière elle-même (ex: [▼/▲]) n'est jamais un "mauvais clic":
      // sans ce garde-fou, showTutorialNudge() se redéployait automatiquement (elle se déplie si elle
      // était repliée) juste après que le joueur vienne de la replier, annulant son clic.
      if (typeof evt.target.closest === 'function' && evt.target.closest('#tutorialOverlay')) return;
      const step = tutorialStepByIndex(game.tutorial.step);
      if (!step || !step.targetSelector || !step.nudge) return;
      const hitTarget = typeof evt.target.closest === 'function' && evt.target.closest(step.targetSelector);
      if (!hitTarget) showTutorialNudge(step.nudge);
    }

// Réagit à la navigation Kairosoft (ui/NavigationManager.js émet nav:mainTabChanged à chaque
// bascule d'onglet/sous-onglet) — ré-applique le highlight au cas où l'élément cible d'une étape
// future vive dans un contenu qui vient d'apparaître, et ré-évalue la progression au passage.
eventBus.on('nav:mainTabChanged', () => checkTutorialProgress());

export function initTutorial() {
      if (!documentClickBound && typeof document.addEventListener === 'function') {
        document.addEventListener('click', handleDocumentClick);
        documentClickBound = true;
      }
      ensureHighlightObserver();
      if (game.tutorial.completed) { renderTutorialOverlay(); return; }
      checkTutorialProgress(); // fast-forward des étapes déjà satisfaites (reprise après reload)
    }
