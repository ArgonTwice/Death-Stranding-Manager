// systems/QuestSystem.js (V0.3.0) — quêtes narratives urgentes, à temps limité, déclenchées par la
// météo (EventBus, jamais d'appel direct depuis WeatherSystem) ou par la réputation. Choix du joueur:
// ACCEPT / NEGOTIATE / REFUSE, avec conséquences sur game.loyalty (0-100), séparée de reputation.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, DAYS_PER_MONTH } from '../data/Balance.js';
import { COUNTRIES, QUEST_ARCHETYPE_TEMPLATES } from '../data/Constants.js';
import { createDelivery } from '../engine/DeliveryEngine.js';

function absoluteDay() { return game.month * DAYS_PER_MONTH + game.dayInMonth; }

function pushHistory(quest, outcome) {
      game.urgentQuestHistory = game.urgentQuestHistory || [];
      game.urgentQuestHistory.unshift({ flavor: quest.flavor, icon: quest.icon, outcome, day: absoluteDay() });
      if (game.urgentQuestHistory.length > 20) game.urgentQuestHistory.length = 20;
    }

function pickQuestGiver(mapKey) {
      const d = game.mapsData[mapKey];
      const knots = (d && d.mainKnots) || [];
      if (!knots.length) return -1;
      return Math.floor(RNG.next() * knots.length);
    }

// Génère une quête urgente sur un territoire donné (appelée par les abonnements EventBus plus bas,
// ou directement par tickUrgentQuestSpawns()). `trigger` est purement informatif (flavor/analytics).
export function generateUrgentQuest(mapKey, trigger) {
      game.urgentQuests = game.urgentQuests || [];
      if (game.urgentQuests.filter(q => q.mapKey === mapKey).length >= BALANCE.quest.maxActiveUrgent) return null;
      const d = game.mapsData[mapKey];
      if (!d) return null;
      const idx = pickQuestGiver(mapKey);
      if (idx === -1) return null;
      const knot = d.mainKnots[idx];
      const tmpl = QUEST_ARCHETYPE_TEMPLATES[knot.archetype] || QUEST_ARCHETYPE_TEMPLATES.engineer;
      const reward = Math.ceil((BALANCE.quest.rewardBase + RNG.next() * BALANCE.quest.rewardRandRange) * (1 + game.reputation / BALANCE.quest.rewardReputationDivisor));
      const quest = {
        id: `uq-${mapKey}-${idx}-${absoluteDay()}-${Math.floor(RNG.next() * 9999)}`,
        mapKey, prepperIdx: idx, archetype: knot.archetype, icon: tmpl.icon, knotName: knot.name,
        flavor: `${knot.name} ${tmpl.zeroDamage ? 'exige' : 'réclame'} ${tmpl.object}`,
        zeroDamage: tmpl.zeroDamage, reward, trigger: trigger || 'reputation',
        expiresDay: absoluteDay() + BALANCE.quest.expiryDaysBase + Math.floor(RNG.next() * BALANCE.quest.expiryDaysRandRange),
        negotiated: false, extraTimeMult: 1, riskCut: 0
      };
      game.urgentQuests.push(quest);
      // V1.25.2 — journalisé quel que soit le territoire (avant cette mission: gardé UNIQUEMENT si
      // mapKey===game.currentMap, ce qui rendait une quête générée sur un territoire non consulté
      // totalement invisible — ni log, ni badge — avant d'expirer silencieusement quelques secondes
      // réelles plus tard, cf. clearExpiredUrgentQuests(). Le nom du territoire est ajouté seulement
      // hors carte active, pour ne jamais alourdir le message le plus courant (quête sur la carte déjà
      // affichée, où le territoire est implicite).
      const country = COUNTRIES.find(c => c.key === mapKey);
      const whereSuffix = mapKey === game.currentMap ? '' : ` — ${country ? `${country.flag} ${country.name}` : mapKey}`;
      logEvent(`🎯 ${tmpl.icon} ${quest.flavor} — quête urgente (${knot.name})${whereSuffix}`, 'good');
      eventBus.emit('quest:urgent', { quest });
      return quest;
    }

export function clearExpiredUrgentQuests() {
      const today = absoluteDay();
      game.urgentQuests = (game.urgentQuests || []).filter(q => {
        if (today > q.expiresDay) {
          if (q.mapKey === game.currentMap) logEvent(`⌛ Quête urgente expirée: ${q.flavor}`, 'warn');
          pushHistory(q, 'expired');
          eventBus.emit('quest:expired', { quest: q });
          return false;
        }
        return true;
      });
    }

// Chance quotidienne indépendante de la météo — augmente avec la réputation Bridges (loyauté du réseau).
export function tickUrgentQuestSpawns() {
      const B = BALANCE.quest;
      const chance = B.reputationSpawnChanceBase + (game.reputation >= B.reputationSpawnThreshold ? B.reputationSpawnBonusChance : 0);
      if (RNG.next() < chance) generateUrgentQuest(game.currentMap, 'reputation');
    }

export function negotiateUrgentQuest(questId) {
      const q = (game.urgentQuests || []).find(x => x.id === questId);
      if (!q || q.negotiated) return;
      q.negotiated = true;
      const B = BALANCE.quest;
      const bonus = B.negotiateRewardBonusBase + RNG.next() * B.negotiateRewardBonusRandRange;
      const oldReward = q.reward;
      q.reward = Math.ceil(q.reward * (1 + bonus));
      const timeCut = B.negotiateTimeCutBase + RNG.next() * B.negotiateTimeCutRandRange;
      q.extraTimeMult = Math.max(0.5, 1 - timeCut); // délai réduit: la livraison devra aller plus vite
      q.riskCut = -(B.negotiateRiskAddBase + RNG.next() * B.negotiateRiskAddRandRange); // riskCut négatif = risque accru
      logEvent(`🗣️ Négociation acceptée avec ${q.knotName}: +$${q.reward - oldReward} contre un délai réduit et un risque accru`, 'good');
      eventBus.emit('quest:negotiated', { quest: q });
      eventBus.emit('render:request');
    }

export function acceptUrgentQuest(questId, porterId, route) {
      const q = (game.urgentQuests || []).find(x => x.id === questId);
      if (!q) { logEvent('❌ Quête urgente introuvable ou expirée'); return; }
      const d = game.mapsData[q.mapKey];
      const knot = d && d.mainKnots && d.mainKnots[q.prepperIdx];
      if (!knot) { logEvent('❌ Donneur de quête introuvable'); return; }
      const porterIdx = game.porters.findIndex(x => x.id === porterId);
      const p = game.porters[porterIdx];
      if (!p || p.map !== q.mapKey || p.status !== 'idle' || p.health <= 0) { logEvent('❌ Porteur indisponible'); return; }
      createDelivery(porterIdx, knot.x, knot.y, {
        reward: q.reward, flavor: q.flavor, riskCut: q.riskCut || 0, extraTimeMult: q.extraTimeMult || 1, route,
        urgentQuestId: q.id, zeroDamage: q.zeroDamage, icon: q.icon
      });
      game.loyalty = Math.min(100, (game.loyalty ?? 50) + BALANCE.quest.acceptLoyaltyGain);
      game.urgentQuests = (game.urgentQuests || []).filter(x => x.id !== questId);
      logEvent(`🚚 ${p.name} part pour une quête urgente — ${q.flavor}`, 'good');
      eventBus.emit('quest:accepted', { quest: q, porterId });
      eventBus.emit('render:request');
    }

export function refuseUrgentQuest(questId) {
      const q = (game.urgentQuests || []).find(x => x.id === questId);
      if (!q) return;
      const loss = q.zeroDamage ? BALANCE.quest.refuseUrgentMedicalLoyaltyLoss : BALANCE.quest.refuseLoyaltyLoss;
      game.loyalty = Math.max(0, (game.loyalty ?? 50) - loss);
      game.urgentQuests = (game.urgentQuests || []).filter(x => x.id !== questId);
      pushHistory(q, 'refused');
      logEvent(`🚫 Quête urgente refusée: ${q.flavor} (loyauté -${loss})`, 'warn');
      eventBus.emit('quest:refused', { quest: q });
      eventBus.emit('render:request');
    }

// Résolution d'une livraison liée à une quête urgente (appelée par DeliveryEngine.tick() aux 3 points
// de résolution: mort, cargo urgent invalidé, succès). Distincte de applyPrepperDeliveryOutcome —
// gère la loyauté (0-100), pas la relation prepper.
export function applyUrgentQuestOutcome(quest, success) {
      if (!quest || !quest.urgentQuestId) return;
      const B = BALANCE.quest;
      if (success) {
        game.loyalty = Math.min(100, (game.loyalty ?? 50) + B.successLoyaltyGain);
        logEvent(`🤝 Loyauté +${B.successLoyaltyGain} — quête urgente accomplie`, 'good');
      } else {
        game.loyalty = Math.max(0, (game.loyalty ?? 50) - B.failLoyaltyLoss);
        logEvent(`📉 Loyauté -${B.failLoyaltyLoss} — quête urgente échouée`, 'warn');
      }
      pushHistory(quest, success ? 'success' : 'fail');
      if (game.loyalty >= B.loyaltySchemaUnlockThreshold) eventBus.emit('quest:loyaltyUnlock', { loyalty: game.loyalty });
    }

// --- Déclenchement météo — QuestSystem s'abonne, WeatherSystem ne connaît jamais QuestSystem ---
eventBus.on('weather:timefallStarted', ({ mapKey }) => {
      if (RNG.next() < BALANCE.quest.weatherSpawnChance) generateUrgentQuest(mapKey, 'timefall');
    });
eventBus.on('weather:chiralStormStarted', ({ mapKey }) => {
      if (RNG.next() < BALANCE.quest.weatherSpawnChance) generateUrgentQuest(mapKey, 'chiralStorm');
    });
