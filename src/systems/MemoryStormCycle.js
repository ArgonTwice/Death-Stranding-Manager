// systems/MemoryStormCycle.js (V0.6.0) — cycle de 12 jours de la Tempête Mémoire du Catcher: un
// avertissement narratif à J-3, puis résolution où l'usure infligée est atténuée par la couverture du
// réseau de routes construit et le nombre de reliques scellées au Musée des Absences — la continuité
// du monde (ce qui a été bâti et gardé en mémoire) protège, jamais l'automatisation en tant que telle.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { BALANCE, DAYS_PER_MONTH, MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';

function totalDaysElapsed() {
      return (game.month - 1) * DAYS_PER_MONTH + game.dayInMonth;
    }

// Indexé à partir de 1 pour ne jamais déclencher de tempête au tout premier jour de partie.
function dayInCycle() {
      return (totalDaysElapsed() + 1) % BALANCE.memoryStorm.cycleDays;
    }

export function daysUntilNextMemoryStorm() {
      const B = BALANCE.memoryStorm;
      const dic = dayInCycle();
      return dic === 0 ? 0 : B.cycleDays - dic;
    }

function stormProtectionFactor() {
      const coverage = (game.routes ? game.routes.size : 0) / (MAP_WIDTH * MAP_HEIGHT);
      const relicBonus = (game.absenceMuseum ? game.absenceMuseum.length : 0) * 0.04;
      return Math.min(0.85, coverage * 2 + relicBonus); // plafonné: jamais une protection totale
    }

function applyStormDamage() {
      const B = BALANCE.memoryStorm;
      const protection = stormProtectionFactor();
      const dmg = B.durabilityDamageBase * (1 - protection);
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        if (!d || !d.pccInstalls) continue;
        for (const p of d.pccInstalls) p.durability = Math.max(0, (p.durability ?? 100) - dmg);
      }
      logEvent(`⛈️ Tempête Mémoire — le réseau encaisse (protection ${Math.round(protection * 100)}%)`, protection > 0.4 ? 'good' : 'warn');
      eventBus.emit('memoryStorm:resolved', { damage: dmg, protection });
    }

// Tick quotidien, appelé depuis DeliveryEngine.advanceDay(). J-3: avertissement. Jour du cycle: résolution.
export function tickMemoryStormCycle() {
      const B = BALANCE.memoryStorm;
      const dic = dayInCycle();
      if (dic === 0) {
        applyStormDamage();
      } else if (dic === B.cycleDays - B.warningDaysBefore) {
        logEvent(`🌩️ Une Tempête Mémoire approche — J-${B.warningDaysBefore}`, 'warn');
        eventBus.emit('memoryStorm:warning', { daysUntil: B.warningDaysBefore });
      }
    }
