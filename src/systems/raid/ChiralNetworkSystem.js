// systems/raid/ChiralNetworkSystem.js (V0.9.0) — condition l'accès aux Raids Tactiques à la
// couverture réelle du Réseau Chiral (règle 1): une route n'est jamais sélectionnable tant que son
// territoire n'a pas assez de réseau construit par les porteurs/convois en simulation (game.routes),
// et les routes les plus dures exigent en plus un Super-Relais actif (RegionalNetwork.js).
import { game } from '../../core/GameState.js';
import { DAYS_PER_MONTH } from '../../data/Balance.js';
import { activeSuperRelayCount } from '../RegionalNetwork.js';

// V1.37.0 — même pattern que systems/ReconnaissanceSystem.js#totalDaysElapsed() (qui écrit
// game.terrainHazards[id].untilDay): ce fichier doit lire la MÊME granularité (jours absolus, pas
// des mois entiers) pour que routeStatus() reflète le déblocage réel d'un aléa de terrain.
function totalDaysElapsed() {
      return (game.month - 1) * DAYS_PER_MONTH + game.dayInMonth;
    }

// V1.6.0 — BLOCKED: aléa de terrain DS2 (éboulement/inondation, systems/ReconnaissanceSystem.js)
// bloquant TEMPORAIREMENT une route déjà déverrouillée. État stocké dans game.terrainHazards
// (routeId -> jour de déblocage), JAMAIS sur l'objet route lui-même (data/Routes.js#RAID_ROUTES est
// une donnée STATIQUE partagée par toutes les parties du même process — la muter directement
// affecterait toutes les parties/tous les tests simultanément).
export const ROUTE_STATUS = { LOCKED: 'LOCKED', NETWORKED: 'NETWORKED', ACTIVE_RAID: 'ACTIVE_RAID', BLOCKED: 'BLOCKED' };

function routeCoverage(mapKey) {
      const d = game.mapsData[mapKey];
      return d && d.routes ? d.routes.size : 0;
    }

function isHazardBlocked(route) {
      const hazard = game.terrainHazards && game.terrainHazards[route.id];
      return !!(hazard && totalDaysElapsed() < hazard.untilDay);
    }

// Statut d'une route: LOCKED (réseau insuffisant), BLOCKED (aléa de terrain temporaire, V1.6.0),
// ACTIVE_RAID (un raid est DÉJÀ en cours sur cette route précise), ou NETWORKED (déverrouillée,
// "RAID DISPONIBLE"). BLOCKED est vérifié APRÈS LOCKED (une route jamais déverrouillée reste LOCKED,
// message plus utile pour le joueur) mais AVANT ACTIVE_RAID (un éboulement en cours de route
// interromprait de toute façon la progression — cf. systems/ReconnaissanceSystem.js pour la décision
// de ne jamais déclencher un aléa sur la route d'un raid déjà en transit).
export function routeStatus(route) {
      if (!route) return ROUTE_STATUS.LOCKED;
      if (routeCoverage(route.mapKey) < route.minRouteCoverage) return ROUTE_STATUS.LOCKED;
      if (route.requireSuperRelay && activeSuperRelayCount() < 1) return ROUTE_STATUS.LOCKED;
      if (isHazardBlocked(route)) return ROUTE_STATUS.BLOCKED;
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

// V1.6.0 — le complément de revealedRoutes ci-dessus: les routes LOCKED encore plus lointaines, NI
// masquées entièrement (V1.4.0) NI affichées en détail — dessinées en silhouette holographique
// (ui/BridgesMap.js: position connue, nom/statut masqués, "?"). Toujours purement dérivé, aucun état
// "revealed" persisté — les mêmes garanties que revealedRoutes.
export function silhouetteRoutes(routes) {
      const revealed = new Set(revealedRoutes(routes));
      return routes.filter(r => !revealed.has(r));
    }
