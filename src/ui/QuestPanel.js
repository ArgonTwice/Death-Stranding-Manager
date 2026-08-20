// ui/QuestPanel.js (V0.3.0) — tiroir glissant (drawer) des quêtes urgentes, ne bloque jamais le
// Canvas (contrairement aux modales .left plein écran existantes: il se glisse depuis le bord,
// la carte reste visible et jouable derrière). Onglets: Urgences / En cours / Terminées.
// Cibles tactiles ≥48x48px (ergonomie mobile, cf. .qp-tab / .qp-action-btn dans css/style.css).
import { game } from '../core/GameState.js';
import { ROUTE_TYPES } from '../data/Constants.js';
import { estimateNetMargin } from '../engine/DeliveryEngine.js';
import { acceptUrgentQuest, negotiateUrgentQuest, refuseUrgentQuest } from '../systems/QuestSystem.js';
import { closePanel, isPanelOpen, pushPanel } from '../core/NavigationManager.js';
import { collapseDrawer, openDrawer } from './DrawerManager.js';

let activeTab = 'urgences';

// apply(): fermeture visuelle pure, appelée par NavigationManager (bouton Retour OU closeQuestPanel)
// — ne fait jamais elle-même de pushState/history.back (règle anti-boucle V0.7.0).
function applyCloseQuestPanel() {
      collapseDrawer('questDrawer');
    }

export function openQuestPanel() {
      pushPanel('questDrawer', applyCloseQuestPanel);
      openDrawer('questDrawer', 'peek');
      renderQuestPanel();
    }

export function closeQuestPanel() {
      closePanel('questDrawer');
    }

export function toggleQuestPanel() {
      if (isPanelOpen('questDrawer')) closeQuestPanel(); else openQuestPanel();
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
      // V1.16.0 — Marge Nette: Gains bruts - Salaire - "Carburant" (maintenance véhicule) - Usure,
      // cf. engine/DeliveryEngine.js#estimateNetMargin (estimation d'affichage, prorata sur la durée
      // réelle du trajet — jamais une valeur consommée par la simulation elle-même).
      const margin = estimateNetMargin(d);
      return `
        <div class="qp-card">
          <div class="qp-card-head">${(d.quest && d.quest.icon) || '🚚'} ${d.quest ? d.quest.flavor : ''}</div>
          <div class="qp-card-meta">${p ? p.name : '?'} en route · ${d.timeRemaining}j restant(s) · +$${d.reward}</div>
          <div class="qp-card-meta" style="opacity:0.75;">💰 Marge nette estimée: <b style="color:${margin.net >= 0 ? 'var(--chiral)' : 'var(--blood)'};">${margin.net >= 0 ? '+' : ''}$${margin.net}</b> (brut $${margin.gross} − salaire $${margin.salaryCost}${margin.fuelCost ? ` − carburant $${margin.fuelCost}` : ''} − usure $${margin.wearCost})</div>
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

      const allUrgent = game.urgentQuests || [];
      const urgent = allUrgent.filter(q => q.mapKey === game.currentMap);
      const inProgress = game.deliveries.filter(d => d.quest && d.quest.urgentQuestId);
      const history = game.urgentQuestHistory || [];

      // V1.25.2 — badge compté sur TOUS les territoires (avant: filtré comme la liste ci-dessous, donc
      // une quête urgente générée hors carte active n'allumait jamais le badge — combiné à l'ancienne
      // fenêtre d'expiration très courte (cf. data/Balance.js#quest.expiryDaysBase), elle disparaissait
      // sans que rien ne l'ait jamais signalée. Le badge sert d'alerte globale; la liste ci-dessous
      // reste volontairement filtrée par territoire (onglet Urgences = "ici", pas un fourre-tout).
      const badgeEl = document.getElementById('questDrawerBadge');
      if (badgeEl) badgeEl.textContent = allUrgent.length > 0 ? String(allUrgent.length) : '';
      if (badgeEl) badgeEl.style.display = allUrgent.length > 0 ? 'flex' : 'none';

      document.querySelectorAll('.qp-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.qpTab === activeTab));

      const bodyEl = document.getElementById('questDrawerBody');
      if (!bodyEl) return;
      if (activeTab === 'urgences') {
        const elsewhereCount = allUrgent.length - urgent.length;
        const emptyMsg = elsewhereCount > 0
          ? `Aucune urgence sur ce territoire — ${elsewhereCount} en attente ailleurs (changez de carte pour les voir).`
          : 'Aucune urgence en attente sur ce territoire.';
        bodyEl.innerHTML = urgent.length ? urgent.map(urgentCardHtml).join('') : `<div class="qp-empty">${emptyMsg}</div>`;
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
