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

function buildSession(porter, cause) {
      const distanceKm = 10 + Math.floor(RNG.next() * 90);
      const relicObject = BEACH_RELIC_OBJECTS[Math.floor(RNG.next() * BEACH_RELIC_OBJECTS.length)];
      return {
        porterId: porter.id, porterName: porter.name, cause,
        lines: pickLines(4),
        relicDescription: `${relicObject} du km ${distanceKm}`,
        resolved: false
      };
    }

// Appelée depuis DeliveryEngine.tick() au moment de la mort d'un porteur. Construit une session
// éphémère (game.beachSession — jamais persistée, comme game.deliveries) et notifie l'UI.
//
// V1.29.0 — bug réel trouvé en jouant une vraie partie: DeliveryEngine.tick() itère TOUTES les
// livraisons dans la même passe, donc 2 porteurs peuvent mourir dans le MÊME tick avant que le
// joueur ait eu la moindre chance de résoudre la 1re séquence (résolution async, via clic UI). Sans
// file, la 2e mort écrasait purement et simplement game.beachSession — le 1er porteur perdait toute
// clôture (pas de relique possible, pas de message de mémoire), sans le moindre signal. Si une
// session est déjà active et NON résolue, la nouvelle rejoint game.beachQueue au lieu d'écraser —
// resolveBeachChoice() dépile la suivante dès que la courante est résolue.
export function triggerBeachSequence(porter, cause) {
      const session = buildSession(porter, cause);
      if (game.beachSession && !game.beachSession.resolved) {
        game.beachQueue.push(session);
        return;
      }
      game.beachSession = session;
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
      // V1.29.0 — dépile la prochaine séquence en attente (2e porteur mort dans le même tick) plutôt
      // que de la perdre: repêche AUTOMATIQUEMENT la suivante, comme si le joueur venait d'ouvrir une
      // 2e notification déjà en attente — même déclenchement (beach:triggered) que le tout premier cas.
      const next = game.beachQueue.shift();
      if (next) {
        game.beachSession = next;
        eventBus.emit('beach:triggered', { ...game.beachSession });
      } else {
        game.beachSession = null;
      }
    }
