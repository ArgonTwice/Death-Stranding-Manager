// systems/ShelterSystem.js (V0.3.0) — Abris Anti-Timefall posés via le réseau PCC. Système
// volontairement minimal : il ne fait qu'une chose, savoir si une position du réseau est protégée,
// et laisse NetworkSystem.placePCCAt gérer la pose/le coût/la durabilité (même infra que les autres PCC).
import { game } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';

// Retourne la liste des Abris Anti-Timefall actifs (durabilité > 0) sur une carte donnée.
export function sheltersOnMap(mapKey) {
      const d = game.mapsData[mapKey];
      if (!d || !d.pccInstalls) return [];
      return d.pccInstalls.filter(p => p.type === 'timefallShelter' && (p.durability ?? 100) > 0);
    }

// Une position (x,y) est "abritée" si elle se trouve dans le rayon de protection d'au moins un
// Abri Anti-Timefall fonctionnel sur cette carte.
export function isPositionSheltered(mapKey, x, y) {
      const shelters = sheltersOnMap(mapKey);
      if (!shelters.length) return false;
      const radius = BALANCE.shelter.protectionRadius;
      return shelters.some(s => Math.hypot(s.x - x, s.y - y) <= radius);
    }

// Un porteur est abrité s'il se trouve à la position d'un abri sur sa carte actuelle — utilisé par
// WeatherEngine.triggerTimefall() pour épargner l'usure d'équipement des porteurs protégés.
export function isPorterSheltered(porter) {
      if (!porter || porter.x == null || porter.y == null) return false;
      return isPositionSheltered(porter.map || game.currentMap, porter.x, porter.y);
    }
