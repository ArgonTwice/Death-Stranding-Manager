// systems/raid/RaidRewardResolver.js (V0.9.0) — calcul PUR de la récompense finale d'un raid achevé.
// Formule (règle 3): Distance Initiale x Multiplicateur Région/Difficulté x Bonus Détours (plafonné
// à +25%) x État du Cargo (0.25 à 1.0). Aucun accès RNG.js ici: uniquement de l'arithmétique sur le
// RaidState déjà résolu par RaidEventResolver.js.
import { BALANCE } from '../../data/Balance.js';

// Bonus de détours: plus le porteur a essuyé de détours (donc d'adversité), plus la récompense
// grimpe — plafonné pour empêcher un exploit consistant à multiplier les événements défavorables.
export function detourBonusMult(route, totalDetourSteps) {
      const B = BALANCE.raid;
      const ratio = route.baseDistanceSteps > 0 ? totalDetourSteps / route.baseDistanceSteps : 0;
      return 1 + Math.min(B.detourBonusCap, ratio);
    }

export function raidRank(performanceRatio) {
      const t = BALANCE.raid.rankThresholds;
      if (performanceRatio >= t.LEGENDARY) return 'LEGENDARY';
      if (performanceRatio >= t.S) return 'S';
      if (performanceRatio >= t.A) return 'A';
      if (performanceRatio >= t.B) return 'B';
      if (performanceRatio >= t.C) return 'C';
      return 'D';
    }

// Retourne le détail complet de la récompense — jamais appliqué directement ici (RaidSystem.js
// applique le résultat à game.*/porter, cette fonction reste un pur calcul testable isolément).
export function resolveRaidReward(route, raidState) {
      const B = BALANCE.raid;
      const detourMult = detourBonusMult(route, raidState.totalDetourSteps || 0);
      const cargoMult = Math.max(B.cargoStateFloor, raidState.cargoState);
      const performanceRatio = detourMult * cargoMult;
      const rank = raidRank(performanceRatio);
      const rawScore = route.baseDistanceSteps * route.regionMult * detourMult * cargoMult;

      return {
        rank,
        performanceRatio,
        rawScore,
        likes: Math.ceil(rawScore * B.likesPerScorePoint),
        chiralium: Math.ceil(rawScore * B.chiraliumPerScorePoint),
        muleScrap: Math.ceil(rawScore * B.muleScrapPerScorePoint),
        reputation: Math.round(rawScore * B.reputationPerScorePoint * 10) / 10,
        xp: Math.ceil(rawScore * B.xpPerScorePoint)
      };
    }
