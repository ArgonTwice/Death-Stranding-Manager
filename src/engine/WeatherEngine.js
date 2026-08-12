// AUTO-EXTRACTED MODULE: engine/WeatherEngine.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { game, logEvent, runtime } from '../core/GameState.js';
import { degradePCCOnMap } from '../systems/NetworkSystem.js';

export function setMapWeather(mapKey, type) {
      const d = game.mapsData[mapKey];
      if (!d) return;
      d.weather = { type, untilMonth: game.month + 1 };
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
      return w.type === 'timefall' ? 0.12 : 0.08;
    }

export function triggerTimefall() {
      runtime.timefallUntil = performance.now() + 4000;
      setMapWeather(game.currentMap, 'timefall');
      const dropCount = 120;
      runtime.rainDrops = [];
      for (let i = 0; i < dropCount; i++) {
        runtime.rainDrops.push({
          x: Math.random() * 800, y: Math.random() * 400 - 400,
          speed: 4 + Math.random() * 5, len: 8 + Math.random() * 12
        });
      }
      // Corrosion: la Frappe Temporelle use l'équipement de tous les porteurs actifs sur la carte
      let corroded = 0;
      for (const p of game.porters) {
        if (p.status === 'dead' || p.status === 'left') continue;
        p.gearWear = Math.min(100, (p.gearWear || 0) + 6 + Math.floor(Math.random() * 6));
        if (p.gearWear >= 100) corroded++;
      }
      if (corroded > 0) logEvent(`⚠️ Corrosion timefall: ${corroded} porteur(s) avec équipement critique — réparation recommandée`, 'warn');
      degradePCCOnMap(game.currentMap, 8 + Math.floor(Math.random() * 8));
      emboldenMuleCamps();
      logEvent('☔ Frappe Temporelle sur la zone — le chiral se déforme, l\'équipement s\'use');
    }

export function triggerDuststorm() {
      // Canon DS2: Duststorm, tempête de poussière du désert australien
      runtime.duststormUntil = performance.now() + 4000;
      setMapWeather(game.currentMap, 'duststorm');
      runtime.dustParticles = [];
      for (let i = 0; i < 90; i++) {
        runtime.dustParticles.push({
          x: Math.random() * 800, y: Math.random() * 400,
          vx: 3 + Math.random() * 6, vy: (Math.random() - 0.5) * 1.5, r: 1 + Math.random() * 2.5
        });
      }
      degradePCCOnMap(game.currentMap, 5 + Math.floor(Math.random() * 6));
      emboldenMuleCamps();
      logEvent('🌪️ Duststorm balaie la zone — visibilité nulle, les MULEs profitent du chaos');
    }

export function emboldenMuleCamps() {
      const camps = game.muleCamps || [];
      for (const c of camps) {
        if (c.status === 'hostile' && c.strength < 3 && Math.random() < 0.3) c.strength++;
      }
    }

export function prepperWeatherNeedMult(weather, need) {
      if (!weather) return 1;
      if (weather.type === 'timefall' && need === 'medical') return 2.5;
      if (weather.type === 'timefall') return 1.3;
      if (weather.type === 'duststorm' && need === 'tech') return 1.8;
      if (weather.type === 'duststorm') return 1.2;
      return 1;
    }
