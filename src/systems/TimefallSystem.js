// systems/TimefallSystem.js (V0.3.0) — effets gameplay du Timefall actif: ralentit les livraisons
// non abritées et fait grimper la demande de certains preppers (médical/botaniste). Sépare les
// EFFETS (ce fichier) de la GESTION D'ÉTAT météo (WeatherSystem.js/WeatherEngine.js).
import { game } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';
import { isPositionSheltered } from './ShelterSystem.js';

function isTimefallActive(mapKey) {
      const d = game.mapsData[mapKey];
      return !!(d && d.weather && d.weather.type === 'timefall');
    }

// Multiplicateur de temps à appliquer à une livraison: pénalise le trajet si le Timefall est actif
// sur la carte ET que la destination n'est couverte par aucun Abri Anti-Timefall.
export function timefallSpeedMult(mapKey, destX, destY) {
      if (!isTimefallActive(mapKey)) return 1;
      if (isPositionSheltered(mapKey, destX, destY)) return 1;
      return 1 + BALANCE.timefall.speedPenaltyUnsheltered;
    }

// Multiplicateur de croissance de besoin prepper pendant le Timefall — vient s'ajouter (pas
// remplacer) au multiplicateur générique déjà géré par WeatherEngine.prepperWeatherNeedMult().
export function timefallPrepperDemandMult(mapKey, archetype, need) {
      if (!isTimefallActive(mapKey)) return 1;
      if (archetype === 'medic' && need === 'medical') return BALANCE.timefall.medicalDemandMult;
      if (archetype === 'botanist' && need === 'food') return BALANCE.timefall.botanistDemandMult;
      return 1;
    }
