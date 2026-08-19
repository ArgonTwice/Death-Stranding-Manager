// systems/contracts/ContractGenerator.js (V0.9.5) — génération déterministe du tableau de contrats
// d'un Relais (Ordres Locaux, Long-Courriers, Expéditions Multi-Étapes). Seed dérivée d'un hachage
// STABLE (mapKey, mois) — jamais du flux RNG.js partagé (règle 2): régénérer le tableau du même
// relais au même mois (ex: recharge de sauvegarde) donne TOUJOURS exactement le même résultat, sans
// consommer ni perturber la moindre valeur du flux partagé utilisé par le reste de la simulation.
import { game } from '../../core/GameState.js';
import { RNG } from '../../core/RNG.js';
import { BALANCE } from '../../data/Balance.js';
import { routesForMap } from '../../data/Routes.js';
import { CONTRACT_TYPES, CONTRACT_TYPE_LIST } from '../../data/ContractTemplates.js';
import { routeStatus, ROUTE_STATUS } from '../raid/ChiralNetworkSystem.js';

// FNV-1a 32-bit — hachage simple, stable, sans dépendance: (mapKey, mois) -> seed déterministe.
function stableSeed(str) {
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

function legCountFor(gen, type) {
      if (type.legCount === 'multi') {
        const B = BALANCE.multiStop;
        return B.legCountMultiStopMin + gen.nextInt(B.legCountMultiStopMax - B.legCountMultiStopMin + 1);
      }
      return type.legCount;
    }

// V1.3.0 — pool de routes pour un type donné: 'any' (types historiques, comportement INCHANGÉ —
// tirage uniforme sur `routes` tel quel) vs 'low'/'high' (types end-game additifs) qui restreignent
// le pool à la moitié basse/haute de `routes` triées par regionMult (proxy existant de
// difficulté/risque réel — data/Routes.js — jamais une nouvelle donnée inventée). Retombe sur `routes`
// complet si la moitié ciblée est vide (territoire à une seule route connue: jamais un pool vide).
function routePoolFor(routes, bias) {
      if (bias === 'any' || routes.length < 2) return routes;
      const sorted = [...routes].sort((a, b) => a.regionMult - b.regionMult);
      const mid = Math.ceil(sorted.length / 2);
      const pool = bias === 'high' ? sorted.slice(sorted.length - mid) : sorted.slice(0, mid);
      return pool.length ? pool : routes;
    }

// Tableau de contrats d'un relais pour le mois courant — reflète l'état RÉEL du Réseau Chiral (règle
// 1 de V0.9.0): un contrat référence toujours des routes existantes de ce territoire, LOCKED ou non
// (l'UI affiche le statut, cf. ContractBoardModal.js), jamais une route d'un autre territoire.
export function contractsForRelay(mapKey) {
      const routes = routesForMap(mapKey);
      if (!routes.length) return [];
      const gen = RNG.deriveGenerator(stableSeed(`contract:${mapKey}:${game.month}`));
      const count = BALANCE.multiStop.contractsPerRelay;
      const contracts = [];
      for (let i = 0; i < count; i++) {
        const typeId = CONTRACT_TYPE_LIST[gen.nextInt(CONTRACT_TYPE_LIST.length)];
        const type = CONTRACT_TYPES[typeId];
        const pool = routePoolFor(routes, type.routeBias);
        const legCount = Math.min(pool.length, legCountFor(gen, type));
        const legRouteIds = [];
        for (let j = 0; j < legCount; j++) legRouteIds.push(pool[gen.nextInt(pool.length)].id);
        contracts.push({
          id: `contract-${mapKey}-${game.month}-${i}`,
          mapKey, typeId, typeName: type.name, icon: type.icon,
          rewardMult: type.rewardMult, legRouteIds, month: game.month
        });
      }
      return contracts;
    }

// Un contrat n'est lançable que si TOUTES ses étapes sont déjà connectées au Réseau Chiral (règle 1 —
// une expédition ne saute jamais une étape verrouillée).
export function isContractLaunchable(contract) {
      const routes = routesForMap(contract.mapKey);
      return contract.legRouteIds.every(routeId => {
        const route = routes.find(r => r.id === routeId);
        return route && routeStatus(route) !== ROUTE_STATUS.LOCKED;
      });
    }
