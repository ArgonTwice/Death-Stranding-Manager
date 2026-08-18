// ui/LoadoutPanelModal.js (V0.9.5) — écran de préparation du sac à dos IRL: 4 slots (Bottes, Corps,
// Véhicule, Kit PCC), jauge de poids fine, boutons d'équipement ≥48px. Même langage visuel .left que
// RaidSelectionModal.js/ContractBoardModal.js. Purement présentationnel: délègue tout à
// PlayerLoadout.js, jamais d'accès direct à game.playerLoadout ici.
import { BOOTS_DATA, BODY_DATA, PCC_KIT_DATA } from '../data/EquipmentData.js';
import { VEHICLES_DATA } from '../data/VehicleData.js';
import { equipItem, loadoutStepEfficiencyMult, loadoutWeightCap, loadoutWeightUsed, playerLoadoutState } from '../systems/player/PlayerLoadout.js';
import { closePanel, pushPanel } from '../core/NavigationManager.js';
import { terminalCardHtml } from './components/TerminalCard.js';
import { statusBadgeHtml } from './components/StatusBadge.js';

const SLOT_TABLES = { boots: BOOTS_DATA, body: BODY_DATA, vehicle: VEHICLES_DATA, pcc: PCC_KIT_DATA };
const SLOT_LABELS = { boots: '👟 Bottes', body: '🎽 Corps', vehicle: '🚚 Véhicule', pcc: '🏗️ Kit PCC' };

function applyCloseLoadoutPanelModal() {
      const modal = document.getElementById('loadoutPanelModal');
      if (modal) modal.classList.remove('open');
    }

export function openLoadoutPanelModal() {
      const modal = document.getElementById('loadoutPanelModal');
      if (!modal) return;
      modal.classList.add('open');
      pushPanel('loadoutPanelModal', applyCloseLoadoutPanelModal);
      renderLoadoutPanelModal();
    }

export function closeLoadoutPanelModal() { closePanel('loadoutPanelModal'); }

export function equipItemFromUI(slot, itemId) {
      equipItem(slot, itemId);
      renderLoadoutPanelModal();
    }

function slotCardHtml(slot) {
      const table = SLOT_TABLES[slot];
      const equipped = playerLoadoutState()[slot];
      const items = Object.values(table);
      const buttons = items.map(item => `
        <button class="term-card-action ${item.id === equipped ? 'success' : ''}" onclick="equipItemFromUI('${slot}', '${item.id}')">
          ${item.icon || ''} ${item.name}${item.cost ? ` (${item.weightKg ? item.weightKg + 'kg' : ''})` : ''}
        </button>`).join('');

      return terminalCardHtml({
        title: SLOT_LABELS[slot],
        subtitle: `Équipé: ${(table[equipped] || {}).name || 'Aucun'}`,
        rarity: slot === 'vehicle' ? 'epic' : 'rare',
        badgesHtml: statusBadgeHtml((table[equipped] && table[equipped].stepEfficiencyMult > 1) ? `x${table[equipped].stepEfficiencyMult.toFixed(2)} efficacité` : 'Standard', 'rare'),
        actionsHtml: buttons
      });
    }

export function renderLoadoutPanelModal() {
      const el = document.getElementById('loadoutPanelModalBody');
      if (!el) return;
      const used = loadoutWeightUsed();
      const cap = loadoutWeightCap();
      const mult = loadoutStepEfficiencyMult();

      const summary = terminalCardHtml({
        title: '📊 Résumé du Loadout',
        subtitle: `Efficacité combinée: x${mult.toFixed(2)} distance chirale / pas IRL`,
        rarity: 'legendary',
        gauges: [{ label: 'Poids du sac à dos', value: Math.min(100, (used / cap) * 100), valueLabel: `${used}/${cap}kg` }]
      });

      el.innerHTML = summary + Object.keys(SLOT_TABLES).map(slotCardHtml).join('');
    }
