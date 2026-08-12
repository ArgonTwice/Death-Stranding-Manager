// systems/TelemetrySystem.js (V0.4.0) — rapport de performance logistique cumulé: taux de réussite
// des convois, taux d'utilisation des Abris Anti-Timefall, rendement par type d'itinéraire. Purement
// passif: s'abonne aux événements déjà émis par ConvoySystem/WeatherEngine/DeliveryEngine, n'appelle
// jamais rien en retour (même règle de découplage EventBus que le reste de l'app).
import { eventBus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';

function defaultTelemetry() {
      return { convoysLaunched: 0, convoysArrivedFull: 0, convoysArrivedPartial: 0, sheltersProtectedCount: 0, sheltersExposedTotal: 0, deliveriesResolved: 0, deliveriesSucceeded: 0, rewardByRouteType: { express: 0, shortcut: 0, contraband: 0, none: 0 } };
    }

function telemetry() {
      game.telemetry = game.telemetry || defaultTelemetry();
      return game.telemetry;
    }

export function generateTelemetryReport() {
      const t = telemetry();
      const convoySuccessRate = t.convoysLaunched ? Math.round((t.convoysArrivedFull / t.convoysLaunched) * 100) : null;
      const shelterUtilization = t.sheltersExposedTotal ? Math.round((t.sheltersProtectedCount / t.sheltersExposedTotal) * 100) : null;
      const deliverySuccessRate = t.deliveriesResolved ? Math.round((t.deliveriesSucceeded / t.deliveriesResolved) * 100) : null;
      const bestRoute = Object.entries(t.rewardByRouteType).sort((a, b) => b[1] - a[1])[0];
      return {
        convoysLaunched: t.convoysLaunched,
        convoysArrivedFull: t.convoysArrivedFull,
        convoysArrivedPartial: t.convoysArrivedPartial,
        convoySuccessRate, shelterUtilization, deliverySuccessRate,
        rewardByRouteType: { ...t.rewardByRouteType },
        bestRouteType: bestRoute && bestRoute[1] > 0 ? bestRoute[0] : null
      };
    }

// --- Abonnements EventBus — jamais d'appel direct depuis ConvoySystem/WeatherEngine/DeliveryEngine ---
eventBus.on('convoy:departed', () => { telemetry().convoysLaunched++; });
eventBus.on('convoy:arrived', ({ fullSuccess, successCount }) => {
      const t = telemetry();
      if (fullSuccess) t.convoysArrivedFull++;
      else if (successCount > 0) t.convoysArrivedPartial++;
    });
eventBus.on('shelter:protectionApplied', ({ sheltered, exposedTotal }) => {
      const t = telemetry();
      t.sheltersProtectedCount += sheltered;
      t.sheltersExposedTotal += exposedTotal;
    });
eventBus.on('delivery:resolved', ({ reward, routeType, success }) => {
      const t = telemetry();
      t.deliveriesResolved++;
      if (success) t.deliveriesSucceeded++;
      const key = routeType && t.rewardByRouteType[routeType] != null ? routeType : 'none';
      t.rewardByRouteType[key] += reward || 0;
    });
