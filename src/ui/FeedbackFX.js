// ui/FeedbackFX.js (V1.2.0) — Polish Cyber-Bridges 2.0: applique les 4 classes CSS néon
// (success-glow/star-animate/timefall-alert/neon-pulse, cf. css/theme.css) sur des bandeaux DOM déjà
// existants, en réaction à des events eventBus déjà émis par la simulation.
//
// RÈGLE D'ISOLATION (même garde que HUD.js/NavigationManager.js/BridgesMap.js): AUCUN import de
// RNG.js, AUCUN accès à game.*, AUCUNE mutation d'état — uniquement classList.add/remove sur des
// éléments DOM déjà rendus ailleurs. Ce module n'écrit jamais game.*/ne consomme jamais RNG.next().
// Import à effet de bord uniquement (comme systems/raid/RaidSystem.js pour walk:stepDetected):
// main.js l'importe pour son seul enregistrement d'abonnements, aucune fonction exportée à appeler.
import { eventBus } from '../core/EventBus.js';

const ONE_SHOT_MS = { success: 900, star: 700, pulse: 1000 };

function flashOnce(elementId, className, ms) {
      const el = document.getElementById(elementId);
      if (!el || !el.classList) return;
      el.classList.remove(className); // relance l'animation même si déjà en cours (retrigger)
      el.classList.add(className);
      setTimeout(() => el.classList.remove(className), ms);
    }

eventBus.on('delivery:resolved', ({ success }) => {
      if (success) flashOnce('dashboardSynthesisStrip', 'success-glow', ONE_SHOT_MS.success);
    });
eventBus.on('prepper:starReached', () => {
      flashOnce('mainKnots', 'star-animate', ONE_SHOT_MS.star);
    });
eventBus.on('network:nodeConnected', () => {
      flashOnce('dashboardSynthesisStrip', 'neon-pulse', ONE_SHOT_MS.pulse);
    });
// .timefall-alert clignote en continu (keyframes infinite) tant que le Timefall/Tempête Chirale reste
// actif — retirée explicitement à weather:cleared, jamais par timeout.
function onWeatherAlert() {
      const el = document.getElementById('weatherForecastStrip');
      if (el && el.classList) el.classList.add('timefall-alert');
    }
eventBus.on('weather:timefallStarted', onWeatherAlert);
eventBus.on('weather:chiralStormStarted', onWeatherAlert);
eventBus.on('weather:cleared', () => {
      const el = document.getElementById('weatherForecastStrip');
      if (el && el.classList) el.classList.remove('timefall-alert');
    });
