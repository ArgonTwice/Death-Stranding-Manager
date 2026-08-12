// systems/AbsenceMuseum.js (V0.6.0) — Musée des Absences: EXACTEMENT 5 emplacements, scellés pour
// toujours (jamais de retrait/remplacement une fois posé — game.absenceMuseum ne fait QUE grandir,
// jamais rétrécir, jusqu'à son plafond). Impact volontairement mineur côté mécanique (petit bonus de
// réputation par relique) — l'essentiel est narratif: rêves nocturnes du Terminal autour des reliques.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE } from '../data/Balance.js';
import { MUSEUM_DREAM_TEMPLATES } from '../data/Constants.js';

export function museumSlots() {
      game.absenceMuseum = game.absenceMuseum || [];
      return game.absenceMuseum;
    }

export function isMuseumFull() {
      return museumSlots().length >= BALANCE.museum.slotCount;
    }

// Scelle une relique — irréversible. Retourne false si le musée est déjà plein (5/5): le souvenir
// reste alors "hors des murs", jamais forcé, jamais remplacé.
export function sealRelic(porterName, description, cause) {
      if (isMuseumFull()) return false;
      museumSlots().push({ relicName: description, porterName, cause, sealedMonth: game.month });
      game.reputation = Math.min(100, game.reputation + BALANCE.museum.reputationBonusPerRelic); // impact mécanique minime, volontaire
      logEvent(`🏛️ Musée des Absences: "${description}" — ${porterName} scellé pour toujours (${museumSlots().length}/${BALANCE.museum.slotCount})`, 'good');
      eventBus.emit('museum:relicSealed', { description, porterName });
      return true;
    }

// Rêve nocturne autour d'une relique scellée — purement textuel, invoqué par TerminalSoul/HUD à
// l'occasion (jamais dans la boucle de simulation testée par tests/run-once.mjs). Utilise un flux RNG
// dérivé (jamais RNG.next() du flux partagé): un déclenchement UI ne doit jamais perturber la
// simulation déterministe, comme les carnets de bord PCC (NarrativeLogEngine.pccLogbookLines).
export function generateNightlyDream() {
      const slots = museumSlots();
      if (!slots.length) return null;
      const gen = RNG.deriveGenerator(((game.month * 2654435761) ^ slots.length) >>> 0);
      const relic = slots[gen.nextInt(slots.length)];
      const template = MUSEUM_DREAM_TEMPLATES[gen.nextInt(MUSEUM_DREAM_TEMPLATES.length)];
      return template(`"${relic.relicName}" (${relic.porterName})`);
    }
