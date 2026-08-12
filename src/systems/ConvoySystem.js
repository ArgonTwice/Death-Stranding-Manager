// systems/ConvoySystem.js (V0.4.0) — assemble et lance des Convois Lourds: 1 porteur-véhicule +
// jusqu'à 3 escortes + cargo de masse, avec un choix de stratégie (Rapide/Sécurisé/Économique).
// Réutilise le pipeline DeliveryEngine.createDelivery existant (comme un raid multi-porteurs, cf.
// DeliveryEngine.assignQuest) — un convoi n'est qu'un ensemble de livraisons liées par un convoyId
// partagé, dont le sort collectif est agrégé ici et rapporté via EventBus.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, DAYS_PER_MONTH } from '../data/Balance.js';
import { CARGO_TYPES, CONVOY_STRATEGIES } from '../data/Constants.js';
import { createDelivery } from '../engine/DeliveryEngine.js';
import { convoySignature, signatureToRiskMod } from '../engine/RiskEngine.js';

function absoluteDay() { return game.month * DAYS_PER_MONTH + game.dayInMonth; }

// Assemble et lance immédiatement un convoi (pas de phase de planification séparée — cohérent avec
// assignQuest()/negotiatePrepperContract(), aucune autre action du jeu ne "prépare puis attend").
export function createConvoy(destX, destY, vehiclePorterId, escortIds, strategy, route) {
      const B = BALANCE.convoy;
      const strat = B.strategies[strategy] || {};
      const vehiclePorter = game.porters.find(p => p.id === vehiclePorterId);
      if (!vehiclePorter || vehiclePorter.map !== game.currentMap || vehiclePorter.status !== 'idle' || vehiclePorter.health <= 0) {
        logEvent('❌ Porteur-véhicule indisponible'); return null;
      }
      if (!vehiclePorter.equipment.vehicle) { logEvent('❌ Un convoi nécessite un porteur équipé d\'un véhicule'); return null; }

      const escorts = (escortIds || [])
        .filter((id, i, arr) => arr.indexOf(id) === i && id !== vehiclePorterId) // dédoublonne, exclut le véhicule
        .slice(0, B.maxEscorts)
        .map(id => game.porters.find(p => p.id === id))
        .filter(p => p && p.map === game.currentMap && p.status === 'idle' && p.health > 0);

      const squad = [vehiclePorter, ...escorts];
      const cargo = CARGO_TYPES.heavy; // Cargo de masse — toujours du fret lourd
      const distance = Math.hypot(destX - vehiclePorter.x, destY - vehiclePorter.y);

      const signature = convoySignature(squad, cargo.mass, strategy);
      const signatureRisk = signatureToRiskMod(signature);
      const escortRiskCut = Math.min(B.riskCutCap, escorts.length * B.riskCutPerEscort);
      const riskCut = escortRiskCut + (strat.riskCut || 0) - signatureRisk; // peut devenir négatif: risque net accru

      const baseReward = Math.ceil(distance * BALANCE.delivery.rewardDistanceMult * (1 + game.reputation / BALANCE.delivery.reputationRewardDivisor) * cargo.rewardMult);
      const totalReward = Math.ceil(baseReward * (1 + escorts.length * B.rewardSharePerEscort) * (strat.rewardMult || 1));
      const perMemberReward = Math.max(1, Math.ceil(totalReward / squad.length));

      const convoyId = `convoy-${absoluteDay()}-${Math.floor(RNG.next() * 99999)}`;
      const stratLabel = CONVOY_STRATEGIES[strategy] || CONVOY_STRATEGIES.fast;
      const flavor = `Convoi Lourd ${stratLabel.icon} ${stratLabel.name} → (${destX},${destY})`;

      game.convoys = game.convoys || [];
      game.convoys.push({
        id: convoyId, mapKey: game.currentMap, destX, destY, strategy,
        squadIds: squad.map(p => p.id), memberCount: squad.length,
        resolvedCount: 0, successCount: 0, createdDay: absoluteDay(), signature
      });
      eventBus.emit('convoy:created', { convoyId, strategy, memberCount: squad.length, signature });

      for (const p of squad) {
        createDelivery(game.porters.indexOf(p), destX, destY, {
          reward: perMemberReward, flavor, riskCut, route,
          extraTimeMult: strat.timeMult || 1, forceCargoType: 'heavy',
          dmgMult: strat.dmgMult || 1, gearWearMult: strat.gearWearMult || 1,
          convoyId
        });
      }
      logEvent(`🚛 ${flavor} — ${squad.length} membre${squad.length > 1 ? 's' : ''}, signature chirale ${(signature * 100).toFixed(0)}%`, 'good');
      eventBus.emit('convoy:departed', { convoyId, strategy, memberCount: squad.length, destX, destY });
      eventBus.emit('render:request');
      return convoyId;
    }

// Appelée par DeliveryEngine.tick() aux 3 points de résolution d'une livraison (mort, cargo urgent
// invalidé, succès) pour tout membre de convoi — agrège le sort collectif et émet convoy:arrived
// une fois TOUS les membres résolus (succès ou échec).
export function reportConvoyMemberOutcome(quest, success) {
      if (!quest || !quest.convoyId) return;
      game.convoys = game.convoys || [];
      const c = game.convoys.find(x => x.id === quest.convoyId);
      if (!c) return;
      c.resolvedCount++;
      if (success) c.successCount++;
      if (c.resolvedCount >= c.memberCount) {
        const fullSuccess = c.successCount === c.memberCount;
        eventBus.emit('convoy:arrived', { convoyId: c.id, memberCount: c.memberCount, successCount: c.successCount, fullSuccess });
        game.convoys = game.convoys.filter(x => x.id !== c.id);
      }
    }
