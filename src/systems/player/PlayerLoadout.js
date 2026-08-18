// systems/player/PlayerLoadout.js (V0.9.5) — inventaire équipé du joueur IRL (Bottes, Corps,
// Véhicule, Kit PCC) et calcul des modificateurs qu'il transmet. Ce module ne fait QUE lire/écrire
// game.playerLoadout et calculer des multiplicateurs PURS — il n'applique jamais rien lui-même à un
// Raid en cours (règle 1): c'est RaidSystem.js/ExpeditionSystem.js qui lisent ces modificateurs et
// les appliquent. Jamais d'accès à RNG.js ici, jamais importé par RealWalkSystem.js/WalkSession.js.
import { game, logEvent } from '../../core/GameState.js';
import { eventBus } from '../../core/EventBus.js';
import { BALANCE } from '../../data/Balance.js';
import { equipmentTableFor } from '../../data/EquipmentData.js';
import { VEHICLES_DATA } from '../../data/VehicleData.js';

function state() {
      game.playerLoadout = game.playerLoadout || { boots: 'none', body: 'none', vehicle: 'none', pcc: 'none' };
      return game.playerLoadout;
    }

export function playerLoadoutState() { return state(); }

function itemFor(slot, id) {
      const table = slot === 'vehicle' ? VEHICLES_DATA : equipmentTableFor(slot);
      return (table && table[id]) || null;
    }
export function itemForSlot(slot, id) { return itemFor(slot, id); }

// Poids porté (sac à dos) — le véhicule (weightKg toujours 0) n'y contribue jamais: on le conduit,
// on ne le porte pas.
export function loadoutWeightUsed() {
      const s = state();
      return ['boots', 'body', 'pcc'].reduce((sum, slot) => sum + ((itemFor(slot, s[slot]) || {}).weightKg || 0), 0);
    }
export function loadoutWeightCap() { return BALANCE.loadout.maxWeightKg; }

// Tente d'équiper un objet dans un slot — refuse si le poids projeté dépasse la capacité (le
// véhicule ne compte jamais dans ce calcul). Retourne false sans rien muter en cas de refus.
export function equipItem(slot, itemId) {
      const item = itemFor(slot, itemId);
      if (!item) return false;
      const s = state();
      if (slot !== 'vehicle') {
        const projected = loadoutWeightUsed() - ((itemFor(slot, s[slot]) || {}).weightKg || 0) + (item.weightKg || 0);
        if (projected > loadoutWeightCap()) {
          logEvent(`❌ Trop lourd pour le sac à dos (${projected}/${loadoutWeightCap()}kg) — retirez un objet d'abord.`, 'warn');
          return false;
        }
      }
      s[slot] = itemId;
      logEvent(`🎒 ${item.icon || ''} ${item.name} équipé (${slot}).`, 'good');
      eventBus.emit('loadout:changed', { slot, itemId });
      return true;
    }

export function unequipItem(slot) { return equipItem(slot, 'none'); }

// Multiplicateur combiné de distance chirale couverte par pas IRL — consommé exclusivement par
// RaidSystem.js au lancement d'un raid, jamais par RealWalkSystem.js/WalkSession.js (règle 1).
export function loadoutStepEfficiencyMult() {
      const s = state();
      const raw = ['boots', 'body', 'vehicle'].reduce((mult, slot) => mult * ((itemFor(slot, s[slot]) || {}).stepEfficiencyMult || 1), 1);
      return Math.min(BALANCE.vehicles.maxStepEfficiencyMult, raw);
    }

// Réduction des dégâts cargo aux checkpoints d'événement — consommée exclusivement par
// RaidSystem.js.applyCheckpointEvent(), jamais par RaidEventResolver.js (qui reste pur/déterministe).
export function loadoutCargoDamageReduction() {
      const item = itemFor('body', state().body);
      return Math.min(BALANCE.loadout.cargoDamageReductionCap, (item && item.cargoDamageReduction) || 0);
    }

export function loadoutCargoCapacityBonusKg() {
      const item = itemFor('vehicle', state().vehicle);
      return (item && item.cargoCapacityBonusKg) || 0;
    }

export function hasPccKitEquipped() {
      const item = itemFor('pcc', state().pcc);
      return !!(item && item.enablesBuild);
    }
