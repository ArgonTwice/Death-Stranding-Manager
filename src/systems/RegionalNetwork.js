// systems/RegionalNetwork.js (V0.5.0) — Super-Relais: nouveau type de PCC (data/Constants.js
// PCC_TYPES.superRelay) qui interconnecte les territoires. Contrairement aux autres PCC (effet
// local), chaque Super-Relais actif applique un petit bonus PERMANENT et GLOBAL (toutes cartes),
// cumulatif jusqu'à un plafond — pas de state dédié: on scanne simplement les pccInstalls existants.
import { game } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';

export function activeSuperRelayCount() {
      let count = 0;
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        count += (d.pccInstalls || []).filter(p => p.type === 'superRelay' && (p.durability ?? 100) > 0).length;
      }
      return count;
    }

function countedRelays() {
      return Math.min(activeSuperRelayCount(), BALANCE.regionalNetwork.maxRelaysCounted);
    }

export function regionalNetworkRewardMult() {
      return 1 + countedRelays() * BALANCE.regionalNetwork.bonusRewardMultPerRelay;
    }

export function regionalNetworkRiskCut() {
      return countedRelays() * BALANCE.regionalNetwork.bonusRiskCutPerRelay;
    }
