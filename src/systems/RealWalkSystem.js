// systems/RealWalkSystem.js (V0.8.0) — conversion déterministe des pas IRL validés en ressources de
// jeu. Ne connaît RIEN du capteur (jamais DeviceMotionEvent, jamais StepDetector directement) — reçoit
// uniquement un compte de pas déjà validés (via WalkSession.js ou la commande Terminal STEPS) et
// applique des ratios FIXES de Balance.js par franchissement de seuil sur game.totalSteps.
//
// RÈGLE 2 (déterminisme absolu): AUCUN appel à RNG.js ici, AUCUNE dépendance à Date.now() dans le
// calcul des effets — uniquement de l'arithmétique pure sur des compteurs persistés. Deux exécutions
// recevant la même séquence de recordSteps(n) produisent un état strictement identique.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';
import { bbPodState } from './BBPodSystem.js';
import { saveGame } from '../persistence/SaveManager.js';

// Nombre de multiples de `interval` franchis entre `before` (exclu) et `after` (inclus) — gère
// correctement les injections en rafale (ex: STEPS 10000 d'un coup) comme les pas un par un.
function crossedThresholds(before, after, interval) {
      if (!interval || interval <= 0) return 0;
      return Math.floor(after / interval) - Math.floor(before / interval);
    }

// Point d'entrée UNIQUE de conversion pas -> ressources. Appelé par WalkSession.js (pipeline
// capteur) et par TerminalSoul.js (commande STEPS <nombre>, saisie manuelle — règle 4: opt-in total,
// jamais besoin d'un capteur pour progresser).
export function recordSteps(n) {
      const steps = Math.floor(n);
      if (!Number.isFinite(steps) || steps <= 0) return;
      const B = BALANCE.realWalk;
      const before = game.totalSteps || 0;
      const after = before + steps;
      game.totalSteps = after;

      const stressCrossings = crossedThresholds(before, after, B.stressReductionStepInterval);
      if (stressCrossings > 0) {
        const pod = bbPodState();
        pod.stress = Math.max(0, pod.stress - stressCrossings * B.stressReductionPct);
      }

      const chiraliumCrossings = crossedThresholds(before, after, B.chiraliumStepInterval);
      if (chiraliumCrossings > 0) {
        game.materials.chiral_crystal = (game.materials.chiral_crystal || 0) + chiraliumCrossings * B.chiraliumPerInterval;
      }

      const gratitudeCrossings = crossedThresholds(before, after, B.gratitudeStepInterval);
      if (gratitudeCrossings > 0) {
        game.gratitudeTrace = (game.gratitudeTrace || 0) + gratitudeCrossings * B.gratitudePerInterval;
      }

      const milestoneCrossings = crossedThresholds(before, after, B.milestoneStepInterval);
      if (milestoneCrossings > 0) {
        logEvent(`👟 ${after.toLocaleString('fr-FR')} pas parcourus IRL — le réseau chiral s'en souvient.`, 'good');
        eventBus.emit('walk:milestone', { totalSteps: after, chiralKm: totalChiralKm() });
      }

      // Checkpoint silencieux (règle 3): jamais à chaque pas, seulement tous les
      // checkpointSaveStepInterval pas franchis — même mécanisme que l'autosave de fin de mois.
      const checkpointCrossings = crossedThresholds(before, after, B.checkpointSaveStepInterval);
      if (checkpointCrossings > 0) saveGame(true);

      eventBus.emit('walk:stepDetected', { totalSteps: after, added: steps });
    }

export function totalChiralKm() {
      return Math.floor((game.totalSteps || 0) / BALANCE.realWalk.stepsPerChiralKm);
    }

// Bonus de vitesse de livraison — fonction PURE de game.totalSteps (persisté), jamais du temps réel
// ni d'un tirage RNG. Consommé par DeliveryEngine.createDelivery() comme les autres multiplicateurs
// de temps déjà en place (Porter Grade Réseau, tyrolienne, etc.).
export function realWalkSpeedBonusMult() {
      const B = BALANCE.realWalk;
      const bonus = Math.min(B.speedBonusCap, totalChiralKm() * B.speedBonusPerChiralKm);
      return 1 - bonus;
    }
