// data/Routes.js (V0.9.0) — définitions STATIQUES des routes de Raid Tactique A->B (QG Bridges ->
// point cible), une par territoire au minimum. Purement des données: aucune logique ici. La distance
// (baseDistanceSteps) est en pas IRL (même unité que RealWalkSystem.js/game.totalSteps).
// minRouteCoverage: nombre de cases du réseau routier (game.mapsData[mapKey].routes.size) requis pour
// déverrouiller la route — cf. ChiralNetworkSystem.js pour la logique de statut.
export const RAID_ROUTES = [
      { id: 'mexico_south', mapKey: 'mexico', name: 'Route du Sud — Capital Knot City', toX: 8, toY: 8, baseDistanceSteps: 3000, difficulty: 'D', regionMult: 1.0, minRouteCoverage: 5, requireSuperRelay: false },
      { id: 'mexico_ridge', mapKey: 'mexico', name: 'Crête Chirale — Waystation Nord', toX: 9, toY: 1, baseDistanceSteps: 5000, difficulty: 'C', regionMult: 1.1, minRouteCoverage: 10, requireSuperRelay: false },
      { id: 'australia_outback', mapKey: 'australia', name: "Traversée de l'Outback", toX: 8, toY: 8, baseDistanceSteps: 6000, difficulty: 'B', regionMult: 1.2, minRouteCoverage: 6, requireSuperRelay: false },
      { id: 'australia_reef', mapKey: 'australia', name: 'Piste du Récif Fossile', toX: 1, toY: 9, baseDistanceSteps: 8000, difficulty: 'A', regionMult: 1.3, minRouteCoverage: 12, requireSuperRelay: true },
      { id: 'france_ardennes', mapKey: 'france', name: 'Forêt des Ardennes Chirales', toX: 8, toY: 2, baseDistanceSteps: 7000, difficulty: 'B', regionMult: 1.35, minRouteCoverage: 6, requireSuperRelay: false },
      { id: 'france_capital', mapKey: 'france', name: 'Ligne de la Capitale Engloutie', toX: 2, toY: 8, baseDistanceSteps: 10000, difficulty: 'S', regionMult: 1.5, minRouteCoverage: 14, requireSuperRelay: true },
      { id: 'japon_ridge', mapKey: 'japon', name: 'Crête du Mont Chiral', toX: 9, toY: 9, baseDistanceSteps: 9000, difficulty: 'A', regionMult: 1.6, minRouteCoverage: 8, requireSuperRelay: false },
      { id: 'japon_summit', mapKey: 'japon', name: 'Sommet Légendaire — Rivage Ultime', toX: 0, toY: 0, baseDistanceSteps: 15000, difficulty: 'LEGENDARY', regionMult: 2.0, minRouteCoverage: 18, requireSuperRelay: true }
    ];

export function routeById(id) {
      return RAID_ROUTES.find(r => r.id === id) || null;
    }

export function routesForMap(mapKey) {
      return RAID_ROUTES.filter(r => r.mapKey === mapKey);
    }

export const DIFFICULTY_COLORS = {
      D: '#8a8474', C: '#4ad9e0', B: '#7fd9ff', A: '#a855f7', S: '#c9a227', LEGENDARY: '#ff8c2b'
    };
