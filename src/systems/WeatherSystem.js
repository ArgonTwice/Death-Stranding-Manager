// systems/WeatherSystem.js (V0.3.0) — météo dynamique PAR TERRITOIRE + Chiral Forecast (prévision à
// N jours, toujours exacte — canon DS). Prend le relais de l'ancien tirage météo mensuel unique
// (DeliveryEngine.endMonthBookkeeping) : chaque territoire a désormais son propre cycle météo, tiré
// au sort un jour à l'avance et révélé au joueur avant qu'il ne se produise.
//
// Conception: le "futur" météo de chaque carte est une file (d.forecast) de N entrées déjà tirées au
// sort. Chaque jour, tickWeatherSystem() fait avancer la file d'une case (le front devient la météo
// du jour) et tire une nouvelle entrée à l'autre bout — ce qui donne une prévision toujours fiable
// sans avoir à "prédire" quoi que ce soit dynamiquement.
import { eventBus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE } from '../data/Balance.js';
import { WEATHER_LABELS } from '../data/Constants.js';
import { setMapWeather, triggerDuststorm, triggerTimefall } from '../engine/WeatherEngine.js';

function rollWeatherType() {
      const B = BALANCE.weatherSystem;
      const hardcoreMult = game.hardcoreTimefall ? BALANCE.legacy.hardcoreTimefallWeightMult : 1; // V0.5.0 NG+
      const timefallWeight = B.timefallWeight * hardcoreMult;
      // V1.19.0 — extension "Menace croissante" (BALANCE.combat.threatGrowth*): la Tempête Chirale
      // devient un cran plus fréquente tous les threatGrowthMonthInterval mois, jusqu'au même palier
      // que le reste de la menace (threatGrowthCap), pour garder la tension en fin de partie.
      const C = BALANCE.combat;
      const threatGrowth = Math.min(C.threatGrowthCap, Math.floor(game.month / C.threatGrowthMonthInterval));
      const baseTotal = B.calmWeight + timefallWeight + B.chiralStormWeight;
      const chiralStormWeight = B.chiralStormWeight * hardcoreMult + threatGrowth * C.threatGrowthStormChanceAddPerStep * baseTotal;
      const total = B.calmWeight + timefallWeight + chiralStormWeight;
      const r = RNG.next() * total;
      if (r < B.calmWeight) return 'calm';
      if (r < B.calmWeight + timefallWeight) return 'timefall';
      return 'duststorm';
    }

function ensureForecast(d) {
      if (!Array.isArray(d.forecast) || !d.forecast.length) {
        d.forecast = [];
        for (let i = 0; i < BALANCE.weatherSystem.forecastDays; i++) d.forecast.push(rollWeatherType());
      }
    }

// Prévision lisible par l'UI: [{type, name, icon}, ...] du lendemain jusqu'à J+forecastDays.
export function forecastFor(mapKey) {
      const d = game.mapsData[mapKey];
      if (!d) return [];
      ensureForecast(d);
      return d.forecast.map(type => ({ type, ...WEATHER_LABELS[type] }));
    }

export function currentWeatherLabel(mapKey) {
      const d = game.mapsData[mapKey];
      const type = (d && d.weather && d.weather.type) || 'calm';
      return { type, ...WEATHER_LABELS[type] };
    }

function applyWeatherArrival(mapKey, type) {
      const d = game.mapsData[mapKey];
      const wasType = (d.weather && d.weather.type) || 'calm';
      if (type === wasType) return; // pas de changement d'état ce jour-là

      if (type === 'calm') {
        d.weather = null;
        if (mapKey === game.currentMap) game.weather = null;
        eventBus.emit('weather:cleared', { mapKey });
        return;
      }

      if (mapKey === game.currentMap) {
        // Réutilise la chaîne existante inchangée: usure équipement (avec protection abri, cf.
        // WeatherEngine.js), dégradation PCC, raindrops visuels, embolden MULEs, log.
        if (type === 'timefall') triggerTimefall(); else triggerDuststorm();
      } else {
        setMapWeather(mapKey, type); // territoire non actif: état posé, sans les effets de simulation active
      }
      eventBus.emit(type === 'timefall' ? 'weather:timefallStarted' : 'weather:chiralStormStarted', { mapKey });
    }

// Appelé une fois par jour (DeliveryEngine.advanceDay), pour TOUS les territoires connus.
export function tickWeatherSystem() {
      for (const mapKey in game.mapsData) {
        const d = game.mapsData[mapKey];
        ensureForecast(d);
        const todayType = d.forecast.shift();
        d.forecast.push(rollWeatherType());
        applyWeatherArrival(mapKey, todayType);
      }
      const cur = game.mapsData[game.currentMap];
      if (cur) eventBus.emit('weather:forecastUpdated', { mapKey: game.currentMap, forecast: forecastFor(game.currentMap), current: currentWeatherLabel(game.currentMap) });
    }
