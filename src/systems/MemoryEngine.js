// systems/MemoryEngine.js (V0.6.0) — observateur central, purement passif: s'abonne aux événements
// déjà émis par les autres systèmes (DeliveryEngine, ConvoySystem, QuestSystem, PorterStorySystem,
// LegacySystem) et évalue leur "signification" (0-100). Au-dessus de significanceThreshold (70), un
// Souvenir Majeur est créé, la Mémoire Chirale (game.chiralMemory) grandit et le Lien (connection) du
// porteur concerné augmente. En-dessous, contribution mineure au Lien seulement — JAMAIS de pénalité:
// l'automatisation (auto-dispatch, ordres permanents) n'est jamais punie, conformément à la règle 1.
import { eventBus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';

function gainConnection(porterId, amount) {
      if (porterId == null) return;
      const p = game.porters.find(x => x.id === porterId);
      if (!p) return;
      p.connection = Math.min(BALANCE.memory.connectionCap, (p.connection || 0) + amount);
    }

function pushMajorMemory(text, score, porterId) {
      game.majorMemories = game.majorMemories || [];
      game.majorMemories.unshift({ text, score, month: game.month, porterId: porterId ?? null });
      if (game.majorMemories.length > BALANCE.memory.majorMemoryHistoryCap) game.majorMemories.length = BALANCE.memory.majorMemoryHistoryCap;
      game.chiralMemory = (game.chiralMemory || 0) + BALANCE.memory.chiralMemoryGainMajor;
      eventBus.emit('memory:majorRecorded', { text, score, porterId });
    }

// Point d'entrée unique: évalue un score et applique les conséquences (souvenir majeur si au-dessus
// du seuil, sinon simple contribution mineure au Lien).
export function evaluateSignificance(score, text, porterId) {
      const B = BALANCE.memory;
      if (score >= B.significanceThreshold) {
        pushMajorMemory(text, score, porterId);
        gainConnection(porterId, B.connectionGainMajor);
      } else if (porterId != null && score > 0) {
        gainConnection(porterId, B.connectionGainMinor);
      }
    }

function porterName(porterId) {
      const p = game.porters.find(x => x.id === porterId);
      return p ? p.name : 'un porteur';
    }

// --- Abonnements EventBus — observateur pur, ne modifie jamais rien ailleurs que game.chiralMemory
// et porter.connection, n'émet jamais d'action corrective ---
const B = BALANCE.memory;

eventBus.on('delivery:resolved', ({ success, porterId, cause, grade }) => {
      if (cause === 'death') {
        evaluateSignificance(B.scorePorterDeath, `${porterName(porterId)} n'est jamais arrivé.`, porterId);
      } else if (success && grade === 'S') {
        evaluateSignificance(B.scoreSRank, `${porterName(porterId)} a livré une course parfaite.`, porterId);
      } else if (success) {
        evaluateSignificance(10, '', porterId); // livraison routinière: contribution mineure silencieuse
      }
    });

eventBus.on('porter:milestoneReached', ({ porterId, milestoneType }) => {
      if (milestoneType === 'raid_survived') {
        evaluateSignificance(B.scoreRaidSurvived, `${porterName(porterId)} a survécu à un raid.`, porterId);
      } else {
        evaluateSignificance(15, '', porterId);
      }
    });

eventBus.on('porter:traitAcquired', ({ porterId }) => {
      evaluateSignificance(B.scoreTraitAcquired, `${porterName(porterId)} a forgé un trait de caractère.`, porterId);
    });

eventBus.on('convoy:arrived', ({ fullSuccess, memberCount }) => {
      if (fullSuccess && memberCount > 1) {
        evaluateSignificance(B.scoreConvoyFullSuccess, `Un convoi de ${memberCount} est arrivé au complet.`, null);
      }
    });

eventBus.on('quest:loyaltyUnlock', () => {
      evaluateSignificance(B.scoreLoyaltyUnlock, 'Le réseau a gagné la confiance de ses partenaires.', null);
    });

eventBus.on('legacy:legendRecorded', ({ name, cause, porterId }) => {
      evaluateSignificance(B.scoreLegendRecorded, `${name} restera dans les mémoires — ${cause}.`, porterId);
    });

eventBus.on('beach:resolved', ({ choice, porterName }) => {
      if (choice === 'memory') pushMajorMemory(`Le rivage a rendu un souvenir de ${porterName}.`, B.scorePorterDeath, null);
    });
