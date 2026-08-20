// systems/BBPodSystem.js (V0.6.0) — copilote BB Pod: un seul compagnon pour tout le réseau (canon:
// un BB par Sam), stats simples (Connexion, Stress, Stade Pod➔Lou). Alerte tôt sur la proximité BT
// (bbpod:btDetected, émis AVANT la détection effective côté BT — un vrai copilote de risque, pas un
// simple journal après-coup) sans jamais bloquer/pénaliser l'automatisation.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { BALANCE, DAYS_PER_MONTH } from '../data/Balance.js';

function pod() {
      game.bbPod = game.bbPod || { connection: 0, stress: 0, stage: 'pod' };
      return game.bbPod;
    }

export function bbPodState() { return pod(); }

// V1.24.0 — même pattern que systems/MemoryStormCycle.js#totalDaysElapsed(): jour absolu depuis le
// début de la partie, pour un cycle de 7 jours cohérent (game.dayInMonth seul repart de 0 tous les 30
// jours, jamais un multiple de 7 — un cycle basé dessus dériverait d'un mois à l'autre).
function totalDaysElapsed() {
      return (game.month - 1) * DAYS_PER_MONTH + game.dayInMonth;
    }

// Tick quotidien (DeliveryEngine.advanceDay) — le stress redescend naturellement les jours calmes.
export function tickBBPodDaily() {
      const p = pod();
      p.stress = Math.max(0, p.stress - BALANCE.bbpod.stressDecayPerDayCalm);
      // V1.24.0 — lissage hebdomadaire: décompression nette supplémentaire tous les 7 jours, backstop
      // pour les périodes chargées où plusieurs expositions BT le même jour dépassent la décroissance
      // quotidienne fixe (cf. commentaire de BALANCE.bbpod.stressWeeklyReset).
      if (totalDaysElapsed() > 0 && totalDaysElapsed() % 7 === 0) {
        p.stress = Math.max(0, p.stress - BALANCE.bbpod.stressWeeklyReset);
      }
    }

function evolveStageIfReady() {
      const p = pod();
      if (p.stage === 'pod' && p.connection >= BALANCE.bbpod.louStageConnectionThreshold) {
        p.stage = 'lou';
        logEvent('👶 Le BB Pod... est devenu Lou. Quelque chose a changé entre vous.', 'good');
        eventBus.emit('bbpod:stageChanged', { stage: 'lou' });
      }
    }

// Appelée depuis DeliveryEngine.tick(), une seule fois par livraison — alerte AVANT que la détection
// BT effective ne se déclenche (le BB "sent" venir le danger plus tôt qu'un scanner classique).
export function checkBBPodProximityWarning(delivery) {
      if (delivery.bbPodWarned) return;
      if ((delivery.btExposure || 0) < BALANCE.bbpod.detectionWarningExposureThreshold) return;
      delivery.bbPodWarned = true;
      const porter = game.porters[delivery.porter];
      eventBus.emit('bbpod:btDetected', { porterId: porter ? porter.id : null, btExposure: delivery.btExposure, destX: delivery.destX, destY: delivery.destY });
    }

// Réponse du joueur à une alerte BB Pod (BBPodOverlay.js): "prudence" réduit les dégâts du prochain
// événement de cette livraison au prix d'un peu de stress pour le BB — vrai choix de risque, sans
// jamais bloquer/retarder la livraison elle-même (l'automatisation continue normalement si ignoré).
export function respondToBBPodAlert(porterId, choice) {
      const delivery = game.deliveries.find(d => d.bbPodWarned && !d.bbPodResponded && game.porters[d.porter] && game.porters[d.porter].id === porterId);
      if (!delivery) return;
      delivery.bbPodResponded = true;
      if (choice === 'caution') {
        delivery.dmgMult = (delivery.dmgMult || 1) * BALANCE.bbpod.cautionDmgMult;
        const p = pod();
        p.stress = Math.min(100, p.stress + BALANCE.bbpod.cautionStressCost);
        logEvent('🎒 Prudence signalée par le BB Pod — moins exposé, un peu plus de stress.', 'good');
      }
      eventBus.emit('render:request');
    }

// --- Abonnements EventBus — observateur pur, jamais d'appel direct depuis DeliveryEngine ---
eventBus.on('delivery:resolved', ({ success }) => {
      const p = pod();
      if (success) p.connection = Math.min(100, p.connection + BALANCE.bbpod.connectionGainPerDelivery);
      evolveStageIfReady();
    });
eventBus.on('memory:majorRecorded', () => {
      const p = pod();
      p.connection = Math.min(100, p.connection + BALANCE.bbpod.connectionGainPerMajorMemory);
      evolveStageIfReady();
    });
eventBus.on('combat:btDetected', () => {
      const p = pod();
      p.stress = Math.min(100, p.stress + BALANCE.bbpod.stressGainPerBtExposure);
    });
