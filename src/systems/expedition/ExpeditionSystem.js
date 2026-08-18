// systems/expedition/ExpeditionSystem.js (V0.9.5) — machine à états orchestrant les expéditions
// multi-étapes (Leg_1 -> Leg_2 -> Leg_3). N'importe QUE l'API publique de RaidSystem.js
// (launchRaid) et observe ses événements EventBus — RaidSystem.js reste totalement agnostique d'une
// expédition en cours (règle 1: isolation), il ne sait résoudre qu'UN raid à la fois, comme avant
// V0.9.5. Chaque étape est mécaniquement un Raid Tactique complet et indépendant (raidSeed propre,
// checkpoints propres); l'orchestrateur ne fait qu'enchaîner les lancements et cumuler les résultats.
import { eventBus } from '../../core/EventBus.js';
import { game, logEvent } from '../../core/GameState.js';
import { BALANCE } from '../../data/Balance.js';
import { routeById } from '../../data/Routes.js';
import { launchRaid } from '../raid/RaidSystem.js';

export function activeExpedition() { return game.activeExpedition; }

export function startExpedition(contract, porterId) {
      if (game.activeExpedition && game.activeExpedition.status === 'active') {
        logEvent('❌ Une expédition est déjà en cours.', 'warn');
        return false;
      }
      if (!contract || !contract.legRouteIds || !contract.legRouteIds.length) return false;
      const ok = launchRaid(contract.legRouteIds[0], porterId);
      if (!ok) return false; // launchRaid a déjà loggé la raison (réseau verrouillé, porteur indisponible...)
      game.activeExpedition = {
        contractId: contract.id, contractType: contract.typeId,
        legs: [...contract.legRouteIds], currentLegIndex: 0,
        porterId, status: 'active', legResults: [], startedMonth: game.month
      };
      logEvent(`🧭 Expédition lancée — ${contract.legRouteIds.length} étape(s).`, 'good');
      eventBus.emit('expedition:started', { contractId: contract.id, legs: contract.legRouteIds });
      return true;
    }

export function abandonExpedition() {
      const exp = game.activeExpedition;
      if (!exp || exp.status !== 'active') return;
      exp.status = 'abandoned';
      logEvent('🚫 Expédition abandonnée — l\'étape en cours reste, elle, à terminer ou à abandonner séparément.', 'warn');
      eventBus.emit('expedition:abandoned', { contractId: exp.contractId });
    }

function completeExpedition(exp) {
      exp.status = 'completed';
      const totalLikes = exp.legResults.reduce((s, r) => s + r.likes, 0);
      const totalChiralium = exp.legResults.reduce((s, r) => s + r.chiralium, 0);
      // Bonus multi-étapes: cumulatif par étape AU-DELÀ de la première, plafonné par construction
      // (borné au nombre de legs réellement effectué — pas d'exploit possible en gonflant artificiellement).
      const bonusMult = 1 + Math.max(0, exp.legs.length - 1) * BALANCE.multiStop.rewardMultPerExtraLeg;
      const bonusLikes = Math.max(0, Math.ceil(totalLikes * (bonusMult - 1)));
      const bonusChiralium = Math.max(0, Math.ceil(totalChiralium * (bonusMult - 1)));

      const porter = game.porters.find(p => p.id === exp.porterId);
      if (porter) porter.likes = (porter.likes || 0) + bonusLikes;
      game.materials.chiral_crystal = (game.materials.chiral_crystal || 0) + bonusChiralium;

      game.expeditionHistory = game.expeditionHistory || [];
      game.expeditionHistory.unshift({
        contractId: exp.contractId, legCount: exp.legs.length,
        legResults: exp.legResults, bonusLikes, bonusChiralium, month: game.month
      });
      game.expeditionHistory = game.expeditionHistory.slice(0, 20);

      logEvent(`🏁 Expédition terminée — ${exp.legs.length} étapes bouclées ! Bonus multi-étapes: +${bonusLikes} likes, +${bonusChiralium} chiralium.`, 'good');
      eventBus.emit('expedition:completed', { legResults: exp.legResults, bonusLikes, bonusChiralium });
    }

// Observateur pur des événements de RaidSystem.js — n'agit que si le raid concerné appartient
// effectivement à l'étape courante de l'expédition active (un Raid isolé, hors expédition, ne
// déclenche jamais rien ici).
eventBus.on('raid:completed', ({ routeId, reward }) => {
      const exp = game.activeExpedition;
      if (!exp || exp.status !== 'active') return;
      if (exp.legs[exp.currentLegIndex] !== routeId) return;

      exp.legResults.push({ routeId, routeName: (routeById(routeId) || {}).name || routeId, rank: reward.rank, likes: reward.likes, chiralium: reward.chiralium });
      exp.currentLegIndex++;

      if (exp.currentLegIndex >= exp.legs.length) {
        completeExpedition(exp);
      } else {
        const nextRouteId = exp.legs[exp.currentLegIndex];
        const nextRoute = routeById(nextRouteId);
        logEvent(`➡️ Étape ${exp.currentLegIndex + 1}/${exp.legs.length} — direction ${nextRoute ? nextRoute.name : nextRouteId}.`, 'good');
        launchRaid(nextRouteId, exp.porterId);
        eventBus.emit('expedition:legAdvanced', { legIndex: exp.currentLegIndex, routeId: nextRouteId });
      }
    });

eventBus.on('raid:abandoned', ({ routeId }) => {
      const exp = game.activeExpedition;
      if (!exp || exp.status !== 'active') return;
      if (exp.legs[exp.currentLegIndex] !== routeId) return;
      exp.status = 'abandoned';
      logEvent('🚫 Expédition interrompue — l\'étape en cours a été abandonnée.', 'warn');
      eventBus.emit('expedition:abandoned', { contractId: exp.contractId });
    });
