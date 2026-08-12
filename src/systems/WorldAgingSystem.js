// systems/WorldAgingSystem.js (V0.6.0) — continuité écosystémique: l'infrastructure posée s'use avec
// le temps (le monde vit, il ne punit pas), tandis que les Routes Historiques (fortement empruntées)
// gagnent en rendement — au prix d'une attention MULE accrue. Jamais de blocage, jamais de pénalité
// liée à l'automatisation en tant que telle (règle 1).
import { eventBus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';

function cellKey(x, y) { return `${x},${y}`; }

// Appelé à chaque livraison réussie empruntant le réseau de routes construit (d.onRoute) — la mémoire
// du trajet grandit avec l'usage.
export function recordRouteUsage(mapKey, x, y) {
      const d = game.mapsData[mapKey];
      if (!d) return;
      if (!d.routeUsage) d.routeUsage = {};
      const key = cellKey(x, y);
      const count = (d.routeUsage[key] || 0) + 1;
      d.routeUsage[key] = count;
      if (count === BALANCE.worldAging.routeHistoricThreshold) {
        eventBus.emit('worldAging:routeBecameHistoric', { mapKey, x, y });
      }
    }

export function isHistoricRoute(mapKey, x, y) {
      const d = game.mapsData[mapKey];
      if (!d || !d.routeUsage) return false;
      return (d.routeUsage[cellKey(x, y)] || 0) >= BALANCE.worldAging.routeHistoricThreshold;
    }

export function historicRouteRewardMult(mapKey, x, y) {
      return isHistoricRoute(mapKey, x, y) ? BALANCE.worldAging.historicRewardMult : 1;
    }

export function historicRouteMuleAttentionAdd(mapKey, x, y) {
      return isHistoricRoute(mapKey, x, y) ? BALANCE.worldAging.historicMuleAttentionAdd : 0;
    }

// Tick mensuel: usure progressive de toute l'infrastructure posée, tous territoires confondus —
// continuité plutôt que punition. Appelé depuis DeliveryEngine.endMonthBookkeeping().
export function tickWorldAgingMonthly() {
      const B = BALANCE.worldAging;
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        if (!d || !d.pccInstalls) continue;
        for (const p of d.pccInstalls) {
          p.durability = Math.max(0, (p.durability ?? 100) - B.pccDecayPerMonth);
        }
      }
    }
