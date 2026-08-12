// systems/TheBeachEngine.js (V0.6.0) — séquence textuelle poétique déclenchée par la perte d'un
// porteur: repêcher un SOUVENIR (libre, rejoint la Mémoire Chirale) ou une RELIQUE (scellée dans le
// Musée des Absences, si une place reste). Ne ramène JAMAIS le porteur — la mort reste définitive,
// cette séquence n'est qu'un dernier geste.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BEACH_RELIC_OBJECTS, BEACH_SEQUENCE_LINES } from '../data/Constants.js';
import { sealRelic } from './AbsenceMuseum.js';

function pickLines(n) {
      const pool = [...BEACH_SEQUENCE_LINES];
      const out = [];
      for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(RNG.next() * pool.length), 1)[0]);
      return out;
    }

// Appelée depuis DeliveryEngine.tick() au moment de la mort d'un porteur. Construit une session
// éphémère (game.beachSession — jamais persistée, comme game.deliveries) et notifie l'UI.
export function triggerBeachSequence(porter, cause) {
      const distanceKm = 10 + Math.floor(RNG.next() * 90);
      const relicObject = BEACH_RELIC_OBJECTS[Math.floor(RNG.next() * BEACH_RELIC_OBJECTS.length)];
      game.beachSession = {
        porterId: porter.id, porterName: porter.name, cause,
        lines: pickLines(4),
        relicDescription: `${relicObject} du km ${distanceKm}`,
        resolved: false
      };
      eventBus.emit('beach:triggered', { ...game.beachSession });
    }

// choice: 'memory' (libre, MemoryEngine s'en charge via l'event beach:resolved) ou 'relic' (scellée
// dans le Musée si une place reste — action mécanique directe, pas une simple observation).
export function resolveBeachChoice(choice) {
      const session = game.beachSession;
      if (!session || session.resolved) return;
      session.resolved = true;
      if (choice === 'relic') {
        const sealed = sealRelic(session.porterName, session.relicDescription, session.cause);
        if (!sealed) logEvent('🏛️ Le musée est plein (5/5) — ce souvenir reste hors des murs, mais jamais oublié.', 'warn');
      } else {
        logEvent(`🌊 Un souvenir de ${session.porterName} rejoint la mémoire du réseau, libre.`, 'good');
      }
      eventBus.emit('beach:resolved', { choice, porterId: session.porterId, porterName: session.porterName });
      game.beachSession = null;
    }
