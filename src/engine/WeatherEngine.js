// AUTO-EXTRACTED MODULE: engine/WeatherEngine.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { game, logEvent, runtime } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE } from '../data/Balance.js';
import { degradePCCOnMap } from '../systems/NetworkSystem.js';
import { isPorterSheltered } from '../systems/ShelterSystem.js';

export function setMapWeather(mapKey, type) {
      const d = game.mapsData[mapKey];
      if (!d) return;
      d.weather = { type, untilMonth: game.month + BALANCE.weather.weatherDurationMonths };
      if (mapKey === game.currentMap) game.weather = d.weather;
    }

export function clearExpiredWeather() {
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        if (d.weather && game.month > d.weather.untilMonth) {
          d.weather = null;
          if (key === game.currentMap) game.weather = null;
        }
      }
    }

export function weatherRiskMod() {
      const w = (game.mapsData[game.currentMap] || {}).weather;
      if (!w) return 0;
      return w.type === 'timefall' ? BALANCE.weather.riskModTimefall : BALANCE.weather.riskModDuststorm;
    }

export function triggerTimefall() {
      runtime.timefallUntil = performance.now() + BALANCE.weather.timefallDurationMs;
      setMapWeather(game.currentMap, 'timefall');
      const dropCount = BALANCE.weather.timefallDropCount;
      runtime.rainDrops = [];
      for (let i = 0; i < dropCount; i++) {
        runtime.rainDrops.push({
          x: RNG.next() * 800, y: RNG.next() * 400 - 400,
          speed: 4 + RNG.next() * 5, len: 8 + RNG.next() * 12
        });
      }
      // Corrosion: la Frappe Temporelle use l'équipement de tous les porteurs actifs sur la carte
      let corroded = 0, sheltered = 0;
      for (const p of game.porters) {
        if (p.status === 'dead' || p.status === 'left') continue;
        if (isPorterSheltered(p)) { sheltered++; continue; } // V0.3.0: Abri Anti-Timefall protège de l'usure
        p.gearWear = Math.min(100, (p.gearWear || 0) + BALANCE.weather.timefallGearWearBase + Math.floor(RNG.next() * BALANCE.weather.timefallGearWearRandRange));
        if (p.gearWear >= 100) corroded++;
      }
      if (sheltered > 0) logEvent(`⛺ ${sheltered} porteur(s) protégé(s) de la corrosion par un Abri Anti-Timefall`, 'good');
      if (corroded > 0) logEvent(`⚠️ Corrosion timefall: ${corroded} porteur(s) avec équipement critique — réparation recommandée`, 'warn');
      degradePCCOnMap(game.currentMap, BALANCE.weather.timefallPccDegradeBase + Math.floor(RNG.next() * BALANCE.weather.timefallPccDegradeRandRange));
      emboldenMuleCamps();
      logEvent('☔ Frappe Temporelle sur la zone — le chiral se déforme, l\'équipement s\'use');
    }

export function triggerDuststorm() {
      // Canon DS2: Duststorm, tempête de poussière du désert australien
      runtime.duststormUntil = performance.now() + BALANCE.weather.duststormDurationMs;
      setMapWeather(game.currentMap, 'duststorm');
      runtime.dustParticles = [];
      for (let i = 0; i < BALANCE.weather.duststormParticleCount; i++) {
        runtime.dustParticles.push({
          x: RNG.next() * 800, y: RNG.next() * 400,
          vx: 3 + RNG.next() * 6, vy: (RNG.next() - 0.5) * 1.5, r: 1 + RNG.next() * 2.5
        });
      }
      degradePCCOnMap(game.currentMap, BALANCE.weather.duststormPccDegradeBase + Math.floor(RNG.next() * BALANCE.weather.duststormPccDegradeRandRange));
      emboldenMuleCamps();
      logEvent('🌪️ Duststorm balaie la zone — visibilité nulle, les MULEs profitent du chaos');
    }

export function emboldenMuleCamps() {
      const camps = game.muleCamps || [];
      for (const c of camps) {
        if (c.status === 'hostile' && c.strength < BALANCE.weather.muleCampEmboldenStrengthCap && RNG.next() < BALANCE.weather.muleCampEmboldenChance) c.strength++;
      }
    }

export function prepperWeatherNeedMult(weather, need) {
      if (!weather) return 1;
      if (weather.type === 'timefall' && need === 'medical') return BALANCE.weather.needMultTimefallMedical;
      if (weather.type === 'timefall') return BALANCE.weather.needMultTimefallOther;
      if (weather.type === 'duststorm' && need === 'tech') return BALANCE.weather.needMultDuststormTech;
      if (weather.type === 'duststorm') return BALANCE.weather.needMultDuststormOther;
      return 1;
    }
