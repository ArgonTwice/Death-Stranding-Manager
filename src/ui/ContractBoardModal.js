// ui/ContractBoardModal.js (V0.9.5) — tableau de contrats d'un Relais (Ordres Locaux, Long-Courriers,
// Expéditions Multi-Étapes), filtre par type. Même langage visuel que RaidSelectionModal.js (modale
// .left) — TerminalCard V0.7.5, badges de rareté par type de contrat, boutons ≥48px. Lancer un
// contrat délègue systématiquement à ExpeditionSystem.startExpedition() (même pour 1 seule étape:
// un Raid isolé et une expédition à 1 étape sont mécaniquement identiques).
import { game } from '../core/GameState.js';
import { routeById } from '../data/Routes.js';
import { CONTRACT_TYPES } from '../data/ContractTemplates.js';
import { contractsForRelay, isContractLaunchable } from '../systems/contracts/ContractGenerator.js';
import { startExpedition } from '../systems/expedition/ExpeditionSystem.js';
import { closePanel, closePanelThenPush, pushPanel } from '../core/NavigationManager.js';
import { terminalCardHtml } from './components/TerminalCard.js';
import { statusBadgeHtml } from './components/StatusBadge.js';
import { openRaidTrackingDrawer } from './RaidTrackingDrawer.js';

const TYPE_TONE = { local: 'common', longhaul: 'rare', multistop: 'legendary' };

let activeMapKey = 'mexico';
let activeFilter = 'all';

function applyCloseContractBoardModal() {
      const modal = document.getElementById('contractBoardModal');
      if (modal) modal.classList.remove('open');
    }

export function openContractBoardModal(mapKey) {
      activeMapKey = mapKey || game.currentMap;
      const modal = document.getElementById('contractBoardModal');
      if (!modal) return;
      modal.classList.add('open');
      pushPanel('contractBoardModal', applyCloseContractBoardModal);
      renderContractBoardModal();
    }

export function closeContractBoardModal() { closePanel('contractBoardModal'); }

export function setContractBoardFilter(typeId) {
      activeFilter = typeId;
      renderContractBoardModal();
    }

function legsSummary(contract) {
      return contract.legRouteIds.map(id => (routeById(id) || {}).name || id).join(' → ');
    }

function contractCardHtml(contract) {
      const launchable = isContractLaunchable(contract);
      const idlePorters = game.porters.filter(p => p.map === contract.mapKey && p.status === 'idle' && p.health > 15);
      const porterOptions = idlePorters.length
        ? idlePorters.map(p => `<option value="${p.id}">${p.name} (Lv${p.level})</option>`).join('')
        : '<option value="">— aucun porteur disponible —</option>';

      return terminalCardHtml({
        title: `${contract.icon} ${contract.typeName}`,
        subtitle: legsSummary(contract),
        rarity: TYPE_TONE[contract.typeId] || 'common',
        badgesHtml: statusBadgeHtml(`${contract.legRouteIds.length} étape(s)`, TYPE_TONE[contract.typeId] || 'common')
          + (launchable ? statusBadgeHtml('DISPONIBLE', 'legendary', '🟢') : statusBadgeHtml('LOCKED', 'common', '🔒')),
        bodyHtml: launchable
          ? `<select id="contractPorterSelect-${contract.id}" class="qp-select">${porterOptions}</select>`
          : '<div class="qp-empty">Au moins une étape de ce contrat n\'est pas encore connectée au Réseau Chiral.</div>',
        actionsHtml: launchable ? `<button class="term-card-action success" ${idlePorters.length ? '' : 'disabled'} onclick="launchContractFromUI('${contract.id}')">🚩 Lancer l'expédition</button>` : ''
      });
    }

export function renderContractBoardModal() {
      const el = document.getElementById('contractBoardModalBody');
      if (!el) return;
      const all = contractsForRelay(activeMapKey);
      const contracts = activeFilter === 'all' ? all : all.filter(c => c.typeId === activeFilter);

      const tabsHtml = `<div class="qp-tabs">
        <button class="qp-tab ${activeFilter === 'all' ? 'active' : ''}" onclick="setContractBoardFilter('all')">Tous</button>
        ${Object.values(CONTRACT_TYPES).map(t => `<button class="qp-tab ${activeFilter === t.id ? 'active' : ''}" onclick="setContractBoardFilter('${t.id}')">${t.icon} ${t.name}</button>`).join('')}
      </div>`;

      el.innerHTML = tabsHtml + (contracts.length ? contracts.map(contractCardHtml).join('') : '<div class="qp-empty">Aucun contrat de ce type sur ce relais ce mois-ci.</div>');
    }

// Cache le dernier tableau généré pour retrouver le contrat cliqué sans le régénérer (régénérer est
// déterministe donc sans risque, mais éviter le recalcul redondant reste plus propre).
export function launchContractFromUI(contractId) {
      const contract = contractsForRelay(activeMapKey).find(c => c.id === contractId);
      if (!contract) return;
      const sel = document.getElementById(`contractPorterSelect-${contractId}`);
      const porterId = sel && sel.value !== '' ? parseInt(sel.value) : null;
      if (porterId == null) return;
      const ok = startExpedition(contract, porterId);
      if (ok) {
        // V1.32.0 — même correctif que RaidSelectionModal.js#launchRaidFromUI: closeContractBoardModal()
        // (async) suivi d'un pushPanel synchrone refermait le tiroir de suivi peu après son ouverture —
        // cf. core/NavigationManager.js#closePanelThenPush pour le mécanisme exact.
        closePanelThenPush('contractBoardModal', openRaidTrackingDrawer);
      } else {
        renderContractBoardModal();
      }
    }
