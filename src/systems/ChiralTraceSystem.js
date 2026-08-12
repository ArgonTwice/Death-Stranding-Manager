// systems/ChiralTraceSystem.js (V0.6.0) — économie de la gratitude: chaque structure PCC posée
// (pont, abri, zip-line...) simule l'usage "hors-ligne" du réseau fantôme d'autres porteurs, comme
// les Likes asynchrones de Death Stranding. Ces Traces de Gratitude alimentent la Mémoire Chirale
// et, passé un seuil, font apparaître un Pèlerin: un contrat unique offert en remerciement du réseau.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent, currentRankIndex } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, RANKS } from '../data/Balance.js';
import { ORDER_SUBJECTS, ORDER_CONTEXTS } from '../data/Constants.js';

function activePccInstallCount() {
      let count = 0;
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        if (!d || !d.pccInstalls) continue;
        count += d.pccInstalls.filter(p => (p.durability ?? 100) > 0).length;
      }
      return count;
    }

// Un Pèlerin: contrat unique à haute récompense narrative, offert en remerciement du réseau
// (même forme qu'un contrat VIP — réutilise la file sideQuests existante).
function spawnPilgrim() {
      const d = game.mapsData[game.currentMap];
      if (!d) return;
      if (!d.sideQuests) d.sideQuests = [];
      if (d.sideQuests.some(q => q.pilgrim)) return; // un seul Pèlerin actif à la fois
      const B = BALANCE.chiralTrace;
      const x = Math.floor(RNG.next() * 40), y = Math.floor(RNG.next() * 20);
      const subj = ORDER_SUBJECTS[Math.floor(RNG.next() * ORDER_SUBJECTS.length)];
      const ctx = ORDER_CONTEXTS[Math.floor(RNG.next() * ORDER_CONTEXTS.length)];
      const baseReward = Math.ceil(BALANCE.delivery.sideQuestRewardBase * B.pilgrimRewardMult * RANKS[currentRankIndex()].questMult);
      d.sideQuests.push({
        id: `pilgrim-${game.month}-${Math.floor(RNG.next() * 9999)}`,
        x, y, reward: baseReward, pilgrim: true,
        flavor: `${subj} — un Pèlerin du réseau chiral ${ctx}, en remerciement`,
        expiresMonth: game.month + BALANCE.delivery.specialOrderExpiryMonths
      });
      logEvent('🙏 Un Pèlerin approche — le réseau se souvient de votre générosité.', 'good');
      eventBus.emit('chiralTrace:pilgrimArrived', { reward: baseReward });
    }

// Tick quotidien: chaque structure active génère passivement des Likes (réseau fantôme), qui
// nourrissent la Mémoire Chirale et la Trace de Gratitude cumulée. Purement additif — ne pénalise
// jamais l'absence de structures. Appelé depuis DeliveryEngine.advanceDay().
export function tickChiralTraceDaily() {
      const B = BALANCE.chiralTrace;
      const structures = activePccInstallCount();
      if (structures <= 0) return;
      const likesEarned = structures * B.offlineLikesPerShelterPerDay;
      game.gratitudeTrace = (game.gratitudeTrace || 0) + likesEarned;
      const chiralGain = Math.floor(likesEarned / B.gratitudeToChiralMemoryDivisor);
      if (chiralGain > 0) game.chiralMemory = (game.chiralMemory || 0) + chiralGain;

      if (game.gratitudeTrace >= B.pilgrimGratitudeThreshold) {
        if (RNG.next() < B.pilgrimSpawnChance) {
          game.gratitudeTrace -= B.pilgrimGratitudeThreshold;
          spawnPilgrim();
        }
      }
    }
