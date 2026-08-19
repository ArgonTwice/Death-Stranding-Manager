// data/TutorialScript.js (V1.0.1) — script du tutoriel guidé Die-Hardman: purement des DONNÉES
// (répliques, sélecteur DOM à mettre en surbrillance, condition d'auto-validation). Aucune logique
// ici — TutorialManager.js est seul responsable d'évaluer/orchestrer ce script.
//
// RÈGLE D'ISOLATION (V1.0.1 règle 1): isStepSatisfied(state) ne fait qu'INSPECTER l'état passé en
// paramètre (jamais d'import de RNG.js, jamais de mutation) — state est `game` (core/GameState.js),
// jamais `runtime` (règle 3: la validation doit survivre à un reload, donc ne dépendre que de ce qui
// est persisté).
export const TUTORIAL_STEPS = [
      {
        id: 'recruit',
        dieHardman: 'Porteur. Bridges a besoin de bras. Recrutez votre premier employé dans l\'onglet Logistique.',
        targetSelector: '.mtab-btn[data-tab="logistique"]',
        nudge: 'Non, Porteur. L\'onglet LOGISTIQUE, en bas de l\'écran — c\'est là que vous recrutez.',
        isStepSatisfied: (state) => state.porters.length >= 1
      },
      {
        id: 'network',
        dieHardman: 'Bien. Maintenant étendez le Réseau Chiral depuis l\'onglet Réseau — sans réseau, pas de raccourcis.',
        targetSelector: '.mtab-btn[data-tab="reseau"]',
        nudge: 'L\'onglet RÉSEAU, Porteur. Le réseau ne s\'étend pas tout seul.',
        isStepSatisfied: (state) => {
          const d = state.mapsData[state.currentMap];
          return !!d && d.routes.size >= 2;
        }
      },
      {
        id: 'first-delivery',
        dieHardman: 'Un porteur, une route. Laissez le réseau travailler — votre première livraison ne devrait pas tarder.',
        targetSelector: '.mtab-btn[data-tab="dashboard"]',
        nudge: 'Patience, Porteur. Revenez au Dashboard et laissez le temps s\'écouler.',
        isStepSatisfied: (state) => state.completed >= 1
      },
      {
        id: 'closing',
        dieHardman: 'Vous avez ce qu\'il faut. Le reste du chemin vous appartient, Porteur. Keep on keeping on.',
        targetSelector: null,
        nudge: '',
        isStepSatisfied: () => true // atteindre cette étape suppose déjà les jalons réels précédents — clôture immédiate
      }
    ];

// Bonus de départ (règle 2) — accordé UNE SEULE FOIS, que le tutoriel soit terminé normalement ou
// via [SKIP], jamais issu de RNG.js (montants fixes).
export const TUTORIAL_REWARDS = { money: 1000, chiral_crystal: 2 };

export function tutorialStepByIndex(i) { return TUTORIAL_STEPS[i] || null; }
export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;
