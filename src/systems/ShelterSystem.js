// systems/ShelterSystem.js (V0.3.0, étendu V0.4.0) — Abris Anti-Timefall posés via le réseau PCC.
// V0.4.0 ajoute le tier "Abri Chiral Avancé": même protection Timefall que l'abri de base (rayon
// plus large), + réparation automatique quotidienne de l'usure des porteurs/véhicules à proximité —
// utile en particulier aux convois lourds (ConvoySystem.js) qui accumulent vite de l'usure.
import { game } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';

const BASIC_SHELTER_TYPES = ['timefallShelter', 'advancedChiralShelter']; // les deux protègent du Timefall
const ADVANCED_SHELTER_TYPES = ['advancedChiralShelter'];

function sheltersOfTypesOnMap(mapKey, types) {
      const d = game.mapsData[mapKey];
      if (!d || !d.pccInstalls) return [];
      return d.pccInstalls.filter(p => types.includes(p.type) && (p.durability ?? 100) > 0);
    }

// Retourne la liste des Abris Anti-Timefall actifs (durabilité > 0) sur une carte donnée — tous
// tiers confondus (base + avancé, qui protège aussi contre le Timefall).
export function sheltersOnMap(mapKey) {
      return sheltersOfTypesOnMap(mapKey, BASIC_SHELTER_TYPES);
    }

export function advancedSheltersOnMap(mapKey) {
      return sheltersOfTypesOnMap(mapKey, ADVANCED_SHELTER_TYPES);
    }

// Une position (x,y) est "abritée" (protection Timefall) si elle se trouve dans le rayon d'au moins
// un abri fonctionnel — le rayon dépend du tier de l'abri le plus proche qui la couvre.
export function isPositionSheltered(mapKey, x, y) {
      return sheltersOnMap(mapKey).some(s => {
        const radius = s.type === 'advancedChiralShelter' ? BALANCE.shelter.advancedProtectionRadius : BALANCE.shelter.protectionRadius;
        return Math.hypot(s.x - x, s.y - y) <= radius;
      });
    }

// V0.4.0 — position couverte par la réparation automatique (Abri Chiral Avancé uniquement).
export function isPositionAdvancedSheltered(mapKey, x, y) {
      const radius = BALANCE.shelter.advancedProtectionRadius;
      return advancedSheltersOnMap(mapKey).some(s => Math.hypot(s.x - x, s.y - y) <= radius);
    }

// Un porteur est abrité s'il se trouve à la position d'un abri sur sa carte actuelle — utilisé par
// WeatherEngine.triggerTimefall() pour épargner l'usure d'équipement des porteurs protégés.
export function isPorterSheltered(porter) {
      if (!porter || porter.x == null || porter.y == null) return false;
      return isPositionSheltered(porter.map || game.currentMap, porter.x, porter.y);
    }

// V0.4.0 — tick quotidien: réduit l'usure (gearWear, y compris véhicule) des porteurs stationnés
// dans le rayon d'un Abri Chiral Avancé. Appelé depuis DeliveryEngine.advanceDay().
export function applyAdvancedShelterRepairs() {
      for (const p of game.porters) {
        if (p.status === 'dead' || p.status === 'left') continue;
        if (!(p.gearWear > 0)) continue;
        if (isPositionAdvancedSheltered(p.map || game.currentMap, p.x, p.y)) {
          p.gearWear = Math.max(0, (p.gearWear || 0) - BALANCE.shelter.advancedRepairPerDay);
        }
      }
    }
