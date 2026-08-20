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
import { pauseForMessage, resumeAfterMessage } from '../core/GameLoop.js';
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
      if (game.tutorial.completed) { clearHighlight(); return; }
      const step = tutorialStepByIndex(game.tutorial.step);
      if (!step || !step.targetSelector) { clearHighlight(); return; }
      const el = document.querySelector(step.targetSelector);
      // V1.0.7 — la cible déjà correctement surlignée n'a rien à regagner d'un
      // classList.remove()+add(): ce cycle relance l'animation CSS tutorial-halo-pulse à chaque appel,
      // et cette fonction est réappelée par le MutationObserver ci-dessous sur CHAQUE mutation DOM du
      // <body> (donc potentiellement des dizaines de fois par render()). Ne toucher le DOM que quand la
      // cible a réellement changé (nouvelle étape, ou l'élément a été recréé ailleurs par un innerHTML)
      // supprime ce clignotement sans perdre la capacité de re-détecter une cible recréée.
      if (el === currentHighlightEl && el && el.classList.contains('tutorial-highlight')) return;
      clearHighlight();
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
      resumeAfterMessage(); // V1.13.0 — filet de sécurité: couvre SKIP autant que la fin naturelle, même
      // si le clic qui déclenche l'un ou l'autre a déjà mis game.tutorial.completed à true avant que
      // handleDocumentClick() ci-dessous ne s'exécute (son garde-fou l'aurait sinon fait sortir tôt
      // sans jamais relancer l'horloge).
      eventBus.emit('tutorial:completed');
    }

// Bouton [SKIP] — présent à TOUTES les étapes (règle 2). Masque l'overlay immédiatement, libère
// l'UI (retire tout highlight), et n'accorde le bonus qu'une fois.
export function skipTutorial() {
      if (game.tutorial.completed) return;
      game.tutorial.skipped = true;
      finishTutorial();
    }

// V1.0.7 règle 1 — reconcile(state) est désormais STRICTEMENT clampée à UNE SEULE transition
// d'étape par appel (plus de boucle while): un jalon franchi doit toujours rester un événement isolé
// et visible pour le joueur (réplique de Die-Hardman, halo) — jamais plusieurs étapes "avalées" d'un
// coup sur un même tick de rendu, ce qui pouvait faire disparaître un message avant que le joueur ne
// l'ait vu. Une sauvegarde qui restaure plusieurs jalons déjà réunis d'un coup (vieille save migrée)
// rattrape désormais sa progression sur plusieurs appels successifs (un par render(), soit jusqu'à 1
// par seconde en jeu réel) plutôt qu'en une seule passe — délai imperceptible, jamais un saut visible.
// RÈGLE D'ISOLATION (V1.0.1 règle 1, inchangée): aucun accès à RNG.js, ne mute que state.tutorial.*.
let lastPaintedStep = -1;
let lastPaintedCompleted = false;
// V1.13.0 — identité de l'objet state.tutorial actuellement suivi par lastPaintedStep/lastPaintedCompleted.
let lastPaintedTutorialRef = null;

export function reconcile(state) {
      if (state.tutorial !== lastPaintedTutorialRef) {
        // V1.13.0 — newGame()/loadGame() remplacent game.tutorial par un TOUT NOUVEL objet (persistence/
        // SaveManager.js) sans jamais appeler reconcile() lui-même: render() (ui/HUD.js), lui, tourne
        // dès le rendu de démarrage AVANT même que le joueur choisisse un emplacement (contre un
        // game.tutorial "placeholder" par défaut) — ce qui "consommait" à tort la toute première
        // étape/pause pour une session qui n'a pas encore commencé, laissant la vraie session démarrée
        // ensuite sans highlight ni pause-message pour SON étape 0 (déjà considérée "peinte"). Détecter
        // le changement d'identité de l'objet tutorial réarme le suivi pour CETTE session, quelle que
        // soit la raison du rendu précédent.
        lastPaintedStep = -1;
        lastPaintedCompleted = false;
        lastPaintedTutorialRef = state.tutorial;
      }
      if (state.tutorial.completed) {
        // V1.0.7 règle 2 — dirty-check: ne repeint (halo + bannière) que lors de la TRANSITION vers
        // l'état terminé, jamais à chaque tick de simulation qui ne fait que reconfirmer un état déjà
        // peint (économise un classList.remove/add + un reflow forcé — cf. TutorialOverlay.js — à
        // chaque render(), jusqu'à 1x/seconde en jeu réel).
        if (!lastPaintedCompleted) { applyHighlightForCurrentStep(); renderTutorialOverlay(); lastPaintedCompleted = true; }
        return;
      }
      const step = tutorialStepByIndex(state.tutorial.step);
      if (!step) { finishTutorial(); return; } // index hors-limites (état corrompu/migré) — clôture défensive
      if (step.isStepSatisfied(state)) {
        state.tutorial.step++;
        if (state.tutorial.step >= TUTORIAL_STEP_COUNT) { finishTutorial(); return; }
      }
      if (state.tutorial.step !== lastPaintedStep || lastPaintedCompleted) {
        lastPaintedStep = state.tutorial.step; // posé AVANT tout appel pouvant redéclencher reconcile()
        applyHighlightForCurrentStep();
        renderTutorialOverlay();
        // V1.13.0 — pauseForMessage() est différé d'un tick (setTimeout 0) plutôt qu'appelé ici en
        // synchrone: cette nouvelle étape est le plus souvent PEINTE en réaction au clic même qui vient
        // de la satisfaire (ex: cliquer "Recruter porteur" avance le tutoriel ET peint la réplique
        // suivante dans le même événement). handleDocumentClick ci-dessous appelle resumeAfterMessage()
        // sur CE MÊME clic pendant sa phase de bulle vers document — sans ce report, la pause posée en
        // phase cible serait donc annulée avant même que l'événement ne se termine (vérifié
        // empiriquement via Playwright: paused restait à false après le tout premier message). Différer
        // pousse pauseForMessage() après la fin de l'événement en cours, pour qu'elle ne soit levée que
        // par le PROCHAIN clic du joueur, comme voulu.
        setTimeout(pauseForMessage, 0);
        // V1.25.1 — fix bug réel signalé ("la bannière ne disparaît jamais après avoir fini toutes les
        // étapes normalement"): contrairement à toutes les étapes précédentes, la dernière ('closing',
        // isStepSatisfied toujours vrai) n'attend plus AUCUNE action réelle du joueur — sa consommation
        // exige simplement un second passage dans reconcile(). Or l'étape juste avant lui dit
        // explicitement de NE RIEN cliquer ("Patience... laissez le temps s'écouler"), et pendant la
        // pause-message ci-dessus, aucun tick/render naturel ne se reproduit tant que le joueur n'a pas
        // cliqué quelque part — un joueur qui obéit à la consigne et attend passivement reste donc
        // bloqué indéfiniment face à la réplique de clôture. Fermeture automatique après un délai de
        // lecture, sans dépendre d'un clic ni d'un tick — idempotent via le garde complete déjà en place.
        if (state.tutorial.step >= TUTORIAL_STEP_COUNT - 1) {
          // V1.25.7 — trouvé par revue de code (fork automatisé): le timer capturait `game.tutorial`
          // (le SINGLETON, lu au moment où le timer FIRE) au lieu de LA session pour laquelle il a été
          // programmé — newGame()/loadGame() (persistence/SaveManager.js) remplacent game.tutorial par
          // un TOUT NOUVEL objet, jamais le même que celui capturé ici 4,2s plus tôt. Un joueur qui
          // démarre une nouvelle partie (ou charge une sauvegarde) dans cette fenêtre de 4,2s voyait le
          // timer de l'ANCIENNE session terminer silencieusement la NOUVELLE (tutoriel jamais affiché,
          // bonus de départ accordé sans jamais avoir joué le tutoriel) — même piège d'identité d'objet
          // déjà documenté ci-dessus pour lastPaintedTutorialRef (V1.13.0), reproduit ici car ce garde
          // ne s'applique qu'à reconcile() lui-même, jamais à un setTimeout différé.
          const scheduledForTutorial = state.tutorial;
          setTimeout(() => { if (game.tutorial === scheduledForTutorial && !game.tutorial.completed) finishTutorial(); }, 4200);
        }
      }
      lastPaintedCompleted = false;
    }

// Ré-évaluée à chaque render() (HUD.js) — coût négligeable (une poignée de comparaisons sur des
// champs déjà en mémoire), et c'est exactement ce qui permet la reprise automatique après reload: au
// premier appel suivant un chargement de sauvegarde, une étape déjà accomplie dans une session
// précédente est aussitôt détectée comme satisfaite et l'étape suivante s'affiche sans redemander au
// joueur une action déjà faite. Délègue à reconcile() (UNE seule transition par appel — V1.0.7).
export function checkTutorialProgress() {
      reconcile(game);
    }

// Relance verbale non-bloquante (règle 4): un clic hors de la cible en surbrillance ne fait JAMAIS
// preventDefault()/stopPropagation() — le jeu réagit normalement au clic, Die-Hardman se contente de
// glisser un mot au passage.
function handleDocumentClick(evt) {
      // V1.14.0 — DOIT s'exécuter avant le early-return "tutoriel terminé" ci-dessous: ce même clic
      // relance l'horloge pour N'IMPORTE QUEL message bloquant en cours (tutoriel, mais aussi V1.14.0
      // quête urgente / attaque de relais MULE, cf. ui/HUD.js), et l'immense majorité du jeu réel se
      // joue tutoriel déjà terminé — un retour anticipé ici aurait rendu resumeAfterMessage()
      // inatteignable par un clic générique pour toute la partie une fois le tutoriel clos.
      resumeAfterMessage();
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
