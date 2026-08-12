// systems/NarrativeLogEngine.js (V0.6.0) — télémétrie littéraire: courtes lignes poétiques en cours
// de trajet, entrées de journal au retour de session, carnets de bord des Abris PCC. Purement
// cosmétique (jamais lu par la logique de jeu), mais déterministe: les tirages "en direct" utilisent
// le flux RNG partagé (comme le reste de tick()), les carnets de bord des PCC utilisent un flux
// dérivé de leur position (RNG.deriveGenerator) — stables d'un rendu à l'autre, jamais persistés.
import { logEvent, game } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE } from '../data/Balance.js';
import { ABSENCE_JOURNAL_TEMPLATES, NARRATIVE_LOG_LINES, PCC_LOGBOOK_LINES } from '../data/Constants.js';

// Appelée depuis DeliveryEngine.tick() pour une livraison en cours — petite chance de "vivre" le
// trajet à voix haute (jamais pour les livraisons de convoi/raid, déjà verbeuses par ailleurs).
export function maybeLogTelemetryLine(porter, delivery) {
      if (delivery.quest) return; // raids/quêtes ont déjà leur propre log dédié — pas de doublon
      if (RNG.next() > BALANCE.narrativeLog.telemetryChancePerTick) return;
      const line = NARRATIVE_LOG_LINES[Math.floor(RNG.next() * NARRATIVE_LOG_LINES.length)];
      logEvent(`📻 ${porter.name}: "${line}"`);
    }

// Appelée au retour de session (TerminalSoul.greetOnLoad) — une ligne poétique sur ce qui s'est
// passé "sans toi". Purement textuel: aucune conséquence mécanique.
export function logAbsenceJournalEntry() {
      const candidates = game.porters.filter(p => p.status !== 'dead' && p.status !== 'left');
      if (!candidates.length) return;
      const p = candidates[Math.floor(RNG.next() * candidates.length)];
      const template = ABSENCE_JOURNAL_TEMPLATES[Math.floor(RNG.next() * ABSENCE_JOURNAL_TEMPLATES.length)];
      logEvent(`📖 ${template(p.name)}`, 'good');
    }

// Carnet de bord d'un Abri PCC — déterministe par position, jamais stocké (recalculé à la volée par
// CanvasInspector.js). Deux abris à la même position produiraient le même carnet, ce qui est le
// comportement voulu: c'est le LIEU qui porte la mémoire, pas l'instance.
export function pccLogbookLines(pcc) {
      const seed = ((pcc.x * 97 + pcc.y * 31 + 1) * 2654435761) >>> 0;
      const gen = RNG.deriveGenerator(seed);
      const count = 2 + gen.nextInt(2);
      const lines = [];
      for (let i = 0; i < count; i++) lines.push(PCC_LOGBOOK_LINES[gen.nextInt(PCC_LOGBOOK_LINES.length)]);
      return lines;
    }
