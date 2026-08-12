// ui/QuestPanel.js (V0.3.0) — tiroir glissant (drawer) des quêtes urgentes, ne bloque jamais le
// Canvas (contrairement aux modales .left plein écran existantes: il se glisse depuis le bord,
// la carte reste visible et jouable derrière). Onglets: Urgences / En cours / Terminées.
// Cibles tactiles ≥48x48px (ergonomie mobile, cf. .qp-tab / .qp-action-btn dans css/style.css).
import { game } from '../core/GameState.js';
import { ROUTE_TYPES } from '../data/Constants.js';
import { acceptUrgentQuest, negotiateUrgentQuest, refuseUrgentQuest } from '../systems/QuestSystem.js';

let activeTab = 'urgences';
let panelOpen = false;

export function openQuestPanel() {
      panelOpen = true;
      const el = document.getElementById('questDrawer');
      if (el) el.classList.add('open');
      renderQuestPanel();
    }

export function closeQuestPanel() {
      panelOpen = false;
      const el = document.getElementById('questDrawer');
      if (el) el.classList.remove('open');
    }

export function toggleQuestPanel() {
      if (panelOpen) closeQuestPanel(); else openQuestPanel();
    }

export function setQuestPanelTab(tab) {
      activeTab = tab;
      renderQuestPanel();
    }

function urgentCardHtml(q) {
      const idlePorters = game.porters.filter(p => p.map === q.mapKey && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100);
      const porterOptions = idlePorters.length
        ? idlePorters.map(p => `<option value="${p.id}">${p.name} (Lv${p.level})</option>`).join('')
        : '<option value="">— aucun porteur disponible —</option>';
      return `
        <div class="qp-card ${q.zeroDamage ? 'qp-card-zerodamage' : ''}">
          <div class="qp-card-head">${q.icon} ${q.flavor}</div>
          <div class="qp-card-meta">💰 $${q.reward} · expire J${q.expiresDay}${q.zeroDamage ? ' · ⚕️ zéro-dommage requis' : ''}${q.negotiated ? ' · 🗣️ négociée' : ''}</div>
          <select id="uq-porter-${q.id}" class="qp-select">${porterOptions}</select>
          <select id="uq-route-${q.id}" class="qp-select">
            ${Object.entries(ROUTE_TYPES).map(([k, r]) => `<option value="${k}">${r.icon} ${r.name}</option>`).join('')}
          </select>
          <div class="qp-actions">
            <button class="qp-action-btn success" ${idlePorters.length ? '' : 'disabled'} onclick="acceptUrgentQuestFromUI('${q.id}')">✅ Accepter</button>
            <button class="qp-action-btn" ${q.negotiated ? 'disabled' : ''} onclick="negotiateUrgentQuest('${q.id}')">🗣️ Négocier</button>
            <button class="qp-action-btn danger" onclick="refuseUrgentQuest('${q.id}')">🚫 Refuser</button>
          </div>
        </div>`;
    }

function inProgressCardHtml(d) {
      const p = game.porters[d.porter];
      return `
        <div class="qp-card">
          <div class="qp-card-head">${(d.quest && d.quest.icon) || '🚚'} ${d.quest ? d.quest.flavor : ''}</div>
          <div class="qp-card-meta">${p ? p.name : '?'} en route · ${d.timeRemaining}j restant(s) · +$${d.reward}</div>
        </div>`;
    }

const OUTCOME_LABELS = { success: '✅ Réussie', fail: '💥 Échouée', refused: '🚫 Refusée', expired: '⌛ Expirée' };

function historyCardHtml(h) {
      return `
        <div class="qp-card qp-card-history">
          <div class="qp-card-head">${h.icon || '🎯'} ${h.flavor}</div>
          <div class="qp-card-meta">${OUTCOME_LABELS[h.outcome] || h.outcome} · jour ${h.day}</div>
        </div>`;
    }

export function renderQuestPanel() {
      const el = document.getElementById('questDrawer');
      if (!el) return;

      const urgent = (game.urgentQuests || []).filter(q => q.mapKey === game.currentMap);
      const inProgress = game.deliveries.filter(d => d.quest && d.quest.urgentQuestId);
      const history = game.urgentQuestHistory || [];

      const badgeEl = document.getElementById('questDrawerBadge');
      if (badgeEl) badgeEl.textContent = urgent.length > 0 ? String(urgent.length) : '';
      if (badgeEl) badgeEl.style.display = urgent.length > 0 ? 'flex' : 'none';

      document.querySelectorAll('.qp-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.qpTab === activeTab));

      const bodyEl = document.getElementById('questDrawerBody');
      if (!bodyEl) return;
      if (activeTab === 'urgences') {
        bodyEl.innerHTML = urgent.length ? urgent.map(urgentCardHtml).join('') : '<div class="qp-empty">Aucune urgence en attente sur ce territoire.</div>';
      } else if (activeTab === 'encours') {
        bodyEl.innerHTML = inProgress.length ? inProgress.map(inProgressCardHtml).join('') : '<div class="qp-empty">Aucune quête en cours.</div>';
      } else {
        bodyEl.innerHTML = history.length ? history.map(historyCardHtml).join('') : '<div class="qp-empty">Aucune quête résolue pour l\'instant.</div>';
      }
    }

// Pont UI: lit le porteur/itinéraire choisis dans les <select> de la carte, puis délègue à QuestSystem.
export function acceptUrgentQuestFromUI(questId) {
      const porterSel = document.getElementById(`uq-porter-${questId}`);
      const routeSel = document.getElementById(`uq-route-${questId}`);
      const porterId = porterSel && porterSel.value !== '' ? parseInt(porterSel.value) : null;
      if (porterId == null) return;
      acceptUrgentQuest(questId, porterId, routeSel ? routeSel.value : null);
    }
