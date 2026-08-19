// systems/raid/ChiralNetworkSystem.js (V0.9.0) — condition l'accès aux Raids Tactiques à la
// couverture réelle du Réseau Chiral (règle 1): une route n'est jamais sélectionnable tant que son
// territoire n'a pas assez de réseau construit par les porteurs/convois en simulation (game.routes),
// et les routes les plus dures exigent en plus un Super-Relais actif (RegionalNetwork.js).
import { game } from '../../core/GameState.js';
import { activeSuperRelayCount } from '../RegionalNetwork.js';

export const ROUTE_STATUS = { LOCKED: 'LOCKED', NETWORKED: 'NETWORKED', ACTIVE_RAID: 'ACTIVE_RAID' };

function routeCoverage(mapKey) {
      const d = game.mapsData[mapKey];
      return d && d.routes ? d.routes.size : 0;
    }

// Statut d'une route: LOCKED (réseau insuffisant), ACTIVE_RAID (un raid est DÉJÀ en cours sur cette
// route précise), ou NETWORKED (déverrouillée, "RAID DISPONIBLE").
export function routeStatus(route) {
      if (!route) return ROUTE_STATUS.LOCKED;
      if (routeCoverage(route.mapKey) < route.minRouteCoverage) return ROUTE_STATUS.LOCKED;
      if (route.requireSuperRelay && activeSuperRelayCount() < 1) return ROUTE_STATUS.LOCKED;
      if (game.activeRaid && game.activeRaid.status === 'active' && game.activeRaid.routeId === route.id) return ROUTE_STATUS.ACTIVE_RAID;
      return ROUTE_STATUS.NETWORKED;
    }

export function isRouteAvailable(route) {
      return routeStatus(route) === ROUTE_STATUS.NETWORKED;
    }

// V1.4.0 — "Brumes de guerre": filtre de RENDU pur (jamais de mutation, jamais de nouvel état
// persisté) réutilisé par tous les menus qui listent des routes (ui/BridgesMap.js,
// ui/RaidSelectionModal.js). Un territoire garde TOUJOURS ses routes NETWORKED/ACTIVE_RAID visibles
// (déjà débloquées, rien à cacher) + EXACTEMENT UNE route LOCKED révélée: celle dont
// minRouteCoverage est le plus proche d'être atteint (la "prochaine" sur le chemin de progression),
// jamais toutes les LOCKED en même temps. Entièrement dérivé de `routes` (déjà filtré par
// data/Routes.js#routesForMap): aucun champ "revealed" à sérialiser, donc aucun changement de
// SaveManager.js/serializeGame — la visibilité se recalcule à l'identique à chaque rendu.
export function revealedRoutes(routes) {
      const locked = routes.filter(r => routeStatus(r) === ROUTE_STATUS.LOCKED);
      if (!locked.length) return routes;
      const next = locked.reduce((a, b) => (a.minRouteCoverage <= b.minRouteCoverage ? a : b));
      return routes.filter(r => routeStatus(r) !== ROUTE_STATUS.LOCKED || r.id === next.id);
    }
