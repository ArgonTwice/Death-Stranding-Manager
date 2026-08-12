// systems/LegacySystem.js (V0.5.0) — Hall of Fame interactif (mémoire ENTRE les parties, stockage
// séparé des slots de sauvegarde — comme les meilleurs scores) + modificateurs New Game+ (transfert
// partiel de schémas d'installations, modificateur Hardcore Timefall).
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';
import { storageGet, storageSet } from '../persistence/SaveManager.js';

const LEGENDS_KEY = 'ds-manager-legends';

export async function loadLegends() {
      const raw = await storageGet(LEGENDS_KEY);
      try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
    }

export async function saveLegends(list) {
      await storageSet(LEGENDS_KEY, JSON.stringify(list));
    }

// Appelée depuis PorterSystem.recordHallOfFame() — ne persiste entre les parties que les porteurs
// qui ont vraiment marqué la run (niveau ou popularité au-dessus du seuil), pas chaque porteur mort
// au niveau 1. Fire-and-forget (comme saveGame(true) ailleurs dans le code): l'I/O storage ne doit
// jamais bloquer la boucle de jeu.
export function recordLegendIfEligible(porter, cause) {
      const B = BALANCE.legacy;
      if (porter.level < B.legendMinLevel && (porter.likes || 0) < B.legendMinLikes) return;
      (async () => {
        const legends = await loadLegends();
        legends.unshift({
          name: porter.name, background: porter.background, phobia: porter.phobia, joy: porter.joy,
          level: porter.level, likes: porter.likes || 0, acquiredTraitIds: porter.acquiredTraitIds || [],
          cause, month: game.month, date: new Date().toISOString().slice(0, 10)
        });
        await saveLegends(legends.slice(0, B.hallOfFameCap));
        eventBus.emit('legacy:legendRecorded', { name: porter.name, cause, porterId: porter.id });
      })();
    }

// New Game+ — transfert partiel de "schémas" (niveaux d'installations reportés à une fraction de
// leur niveau précédent) + active le modificateur Hardcore Timefall pour la nouvelle run. Appelée
// par SaveManager.startNewGamePlus() APRÈS newGame() (qui a déjà remis game.structures à {}), avec
// un instantané des structures de la run précédente pris AVANT le reset.
export function applyLegacyCarryOver(previousStructures) {
      const frac = BALANCE.legacy.structureCarryOverFraction;
      let carriedCount = 0;
      for (const type in (previousStructures || {})) {
        const carried = Math.floor((previousStructures[type] || 0) * frac);
        if (carried > 0) { game.structures[type] = carried; carriedCount++; }
      }
      game.hardcoreTimefall = true;
      if (carriedCount > 0) logEvent(`🏗️ Schémas hérités: ${carriedCount} installation(s) reportée(s) à ${Math.round(frac * 100)}% de leur niveau`, 'good');
      logEvent('⛈️ Modificateur HARDCORE TIMEFALL actif pour cette run', 'warn');
    }
