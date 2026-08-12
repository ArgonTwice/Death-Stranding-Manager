// systems/PorterLeague.js (V0.5.0) — progression méta en 4 échelons (Bronze/Argent/Or/Élite Chirale)
// basée sur réputation + livraisons totales, débloquant les sponsors de prestige (Constants.js
// SPONSORS.vip) et des contrats VIP à hautes récompenses (réutilise la file sideQuests existante —
// même flux ACCEPT via DeliveryEngine.assignQuest, pas de nouvelle UI nécessaire).
import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent, runtime } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, MAP_HEIGHT, MAP_WIDTH, RANKS } from '../data/Balance.js';
import { LEAGUE_TIERS, ORDER_CONTEXTS, ORDER_SUBJECTS } from '../data/Constants.js';

export function porterLeagueTier() {
      const thresholds = BALANCE.league.tierThresholds;
      for (let i = thresholds.length - 1; i >= 0; i--) {
        if (game.reputation >= thresholds[i].minReputation && game.completed >= thresholds[i].minCompleted) return i;
      }
      return 0;
    }

export function porterLeagueLabel() {
      return LEAGUE_TIERS[porterLeagueTier()];
    }

// Appelée une fois par jour (DeliveryEngine.advanceDay) — n'annonce QUE les nouvelles promotions,
// jamais celles déjà atteintes au chargement (même garde-fou que checkRankUp()/runtime.announcedRank).
export function checkLeaguePromotion() {
      const tier = porterLeagueTier();
      if (tier > (runtime.announcedLeagueTier || 0)) {
        runtime.announcedLeagueTier = tier;
        const label = LEAGUE_TIERS[tier];
        logEvent(`${label.icon} Promotion Ligue Porteurs → ${label.name} !`, 'good');
        eventBus.emit('league:promoted', { tier, label: label.name });
      }
    }

// Contrat VIP: même forme qu'une quête annexe classique (d.sideQuests), avec une récompense
// nettement supérieure et un flavor "sponsor de prestige" — débloqué seulement en Ligue Or+.
export function generateVipContract() {
      const B = BALANCE.league;
      if (porterLeagueTier() < B.vipContractMinTier) return;
      const d = game.mapsData[game.currentMap];
      if (!d.sideQuests) d.sideQuests = [];
      if (d.sideQuests.some(q => q.vip)) return; // un seul contrat VIP actif à la fois
      if (RNG.next() > B.vipContractSpawnChance) return;
      const x = Math.floor(RNG.next() * MAP_WIDTH), y = Math.floor(RNG.next() * MAP_HEIGHT);
      const subj = ORDER_SUBJECTS[Math.floor(RNG.next() * ORDER_SUBJECTS.length)];
      const ctx = ORDER_CONTEXTS[Math.floor(RNG.next() * ORDER_CONTEXTS.length)];
      const sponsorName = (game.sponsor && game.sponsor.name) || 'un sponsor de prestige';
      const baseReward = Math.ceil(BALANCE.delivery.sideQuestRewardBase * B.vipContractRewardMult * RANKS[currentRankIndex()].questMult);
      d.sideQuests.push({
        id: `vip-${game.month}-${Math.floor(RNG.next() * 9999)}`,
        x, y, reward: baseReward, vip: true,
        flavor: `${subj} — contrat VIP ${sponsorName} ${ctx}`,
        expiresMonth: game.month + BALANCE.delivery.specialOrderExpiryMonths
      });
      logEvent(`💠 Contrat VIP disponible — ${sponsorName} (Ligue ${LEAGUE_TIERS[porterLeagueTier()].name})`, 'good');
    }
