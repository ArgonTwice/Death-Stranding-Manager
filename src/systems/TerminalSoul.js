// systems/TerminalSoul.js (V0.6.0) — le Terminal comme interlocuteur. Toute logique d'ici qui dépend
// de Date.now() (temps réel, PAS le temps de jeu simulé) ne touche jamais game.* au-delà de
// game.terminalLastSeen (un simple horodatage jamais lu par tests/run-once.mjs) — elle ne modifie que
// runtime.* (jamais persisté, jamais comparé par le check de déterminisme). C'est ce qui permet à ce
// module de rester "vivant" sans jamais menacer la reproductibilité bit-à-bit de la simulation.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent, runtime } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE } from '../data/Balance.js';
import { NARRATIVE_LOG_LINES, TERMINAL_MOOD_LINES } from '../data/Constants.js';
import { logAbsenceJournalEntry } from './NarrativeLogEngine.js';
import { generateNightlyDream } from './AbsenceMuseum.js';
import { recordSteps, totalChiralKm } from './RealWalkSystem.js';

function pick(arr) { return arr[Math.floor(RNG.next() * arr.length)]; }

// Appelée uniquement au CHARGEMENT d'une sauvegarde existante (SaveManager.loadGame) — jamais à la
// création d'une nouvelle partie, donc jamais exercée par tests/run-once.mjs (qui n'appelle que
// newGame()). game.terminalLastSeen porte l'horodatage de la DERNIÈRE SAUVEGARDE ÉCRITE (mis à jour
// dans serializeGame()); la comparer à Date.now() ici donne le temps d'absence réel du joueur.
export function greetOnLoad() {
      const now = Date.now();
      const last = game.terminalLastSeen;
      if (last != null) {
        const absenceMs = now - last;
        if (absenceMs >= BALANCE.terminal.longAbsenceMs) {
          const hours = Math.max(1, Math.round(absenceMs / 3600000));
          logEvent(`💬 Terminal: "Tu es revenu après ${hours}h. J'ai gardé le réseau allumé."`, 'good');
        } else {
          logEvent(`💬 Terminal: "${pick(TERMINAL_MOOD_LINES.welcoming_short)}"`, 'good');
        }
        logAbsenceJournalEntry();
      }
      runtime.sessionStartTime = now;
      runtime.terminalSlowdownWarned = false;
    }

// Vérifiée périodiquement côté UI (jamais dans la boucle de simulation testée) — ne plafonne que
// runtime.gameSpeed, jamais game.*.
export function checkTerminalSlowdown() {
      if (!runtime.sessionStartTime) { runtime.sessionStartTime = Date.now(); return; }
      const elapsed = Date.now() - runtime.sessionStartTime;
      if (elapsed >= BALANCE.terminal.slowdownAfterMs && !runtime.terminalSlowdownWarned) {
        runtime.terminalSlowdownWarned = true;
        runtime.gameSpeed = Math.min(runtime.gameSpeed || 1, BALANCE.terminal.slowdownSpeedCap);
        logEvent(`💬 Terminal: "${pick(TERMINAL_MOOD_LINES.tired)}"`, 'warn');
        eventBus.emit('terminal:slowdown', {});
      }
    }

const COMMANDS = {
      SING: () => { eventBus.emit('terminal:sing', {}); return '♪ Une mélodie chirale résonne un instant à travers le réseau.'; },
      STAY: () => 'Le Terminal attend avec toi, en silence.',
      LISTEN: () => {
        const candidates = game.porters.filter(p => p.status !== 'dead' && p.status !== 'left');
        if (!candidates.length) return 'Aucun porteur à écouter pour l\'instant.';
        const lonely = [...candidates].sort((a, b) => (a.connection || 0) - (b.connection || 0))[0];
        return `${lonely.name}: "${pick(NARRATIVE_LOG_LINES)}"`;
      },
      REMEMBER: () => {
        const mem = (game.majorMemories || [])[0];
        return mem ? `Souvenir: ${mem.text}` : 'Aucun souvenir majeur pour l\'instant.';
      },
      FORGET: () => {
        if (!(game.majorMemories || []).length) return 'Il n\'y a rien à oublier.';
        game.majorMemories.shift();
        return 'Un souvenir s\'efface, doucement.';
      },
      DREAM: () => generateNightlyDream() || 'Le Musée est vide — rien à rêver, pour l\'instant.',
      // V0.8.0 — saisie manuelle des pas IRL (règle 4: opt-in total, aucun capteur requis pour
      // progresser). Délègue à RealWalkSystem.recordSteps(), point d'entrée unique et déterministe.
      STEPS: (args) => {
        const n = parseInt(args[0], 10);
        if (!Number.isFinite(n) || n <= 0) return 'Usage: STEPS <nombre positif>. Ex: STEPS 500';
        recordSteps(n);
        return `👟 ${n.toLocaleString('fr-FR')} pas enregistrés — ${totalChiralKm()} km chiraux parcourus au total.`;
      }
    };

export const TERMINAL_COMMAND_LIST = Object.keys(COMMANDS);

// Traite une commande textuelle tapée dans TerminalConsole.js — retourne toujours une réponse
// affichable (jamais d'erreur non gérée). Le premier mot est la commande, le reste ses arguments
// (ex: "STEPS 500" -> cmd="STEPS", args=["500"]).
export function processTerminalCommand(raw) {
      const parts = (raw || '').trim().split(/\s+/).filter(Boolean);
      const cmd = (parts[0] || '').toUpperCase();
      const args = parts.slice(1);
      const handler = COMMANDS[cmd];
      if (!handler) return `Commande inconnue: "${raw}". Essaie: ${TERMINAL_COMMAND_LIST.join(', ')}.`;
      return handler(args);
    }
