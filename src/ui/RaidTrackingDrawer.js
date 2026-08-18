// ui/RaidTrackingDrawer.js (V0.9.0) — tiroir tactile Cyber-Bridges de suivi en direct du Raid IRL:
// jauge de pas en temps réel, événements/détours, état du cargo, bouton d'abandon (≥48px). Même
// pattern nav-aware que les autres tiroirs (QuestPanel.js/WalkDrawer.js). Purement présentationnel:
// délègue toute la logique à RaidSystem.js, jamais d'accès direct à RNG.js ici.
import { game } from '../core/GameState.js';
import { eventBus } from '../core/EventBus.js';
import { routeById, DIFFICULTY_COLORS } from '../data/Routes.js';
import { closePanel, isPanelOpen, pushPanel } from '../core/NavigationManager.js';
import { collapseDrawer, openDrawer } from './DrawerManager.js';
import { abandonRaid } from '../systems/raid/RaidSystem.js';
import { terminalCardHtml } from './components/TerminalCard.js';
import { statusBadgeHtml } from './components/StatusBadge.js';
import { openRaidSelectionModal } from './RaidSelectionModal.js';

function applyCloseRaidTrackingDrawer() {
      collapseDrawer('raidTrackingDrawer');
    }

export function openRaidTrackingDrawer() {
      pushPanel('raidTrackingDrawer', applyCloseRaidTrackingDrawer);
      openDrawer('raidTrackingDrawer', 'peek');
      renderRaidTrackingDrawer();
    }

export function closeRaidTrackingDrawer() { closePanel('raidTrackingDrawer'); }

export function toggleRaidTrackingDrawer() {
      if (isPanelOpen('raidTrackingDrawer')) closeRaidTrackingDrawer(); else openRaidTrackingDrawer();
    }

export function abandonRaidUI() {
      abandonRaid();
      renderRaidTrackingDrawer();
    }

export function openRaidSelectionModalUI() { openRaidSelectionModal(); }

const RANK_TONE = { LEGENDARY: 'legendary', S: 'legendary', A: 'epic', B: 'rare', C: 'rare', D: 'common' };

function activeRaidCardHtml(raid) {
      const route = routeById(raid.routeId);
      const porter = game.porters.find(p => p.id === raid.porterId);
      const progressPct = Math.min(100, Math.round((raid.traveledSteps / raid.targetDistanceSteps) * 100));
      const eventsHtml = raid.events.length
        ? raid.events.map(e => `<div class="qp-card qp-card-history"><div class="qp-card-head">${e.label}</div><div class="qp-card-meta">${Math.round(e.checkpointFraction * 100)}% · ${e.detourSteps > 0 ? `+${e.detourSteps} pas` : 'aucun détour'}</div></div>`).join('')
        : '<div class="qp-empty">Aucun événement pour l\'instant — la route est calme.</div>';

      return terminalCardHtml({
        title: `🚩 ${route ? route.name : raid.routeId}`,
        subtitle: `${porter ? porter.name : '?'} · ${raid.traveledSteps.toLocaleString('fr-FR')} / ${raid.targetDistanceSteps.toLocaleString('fr-FR')} pas`,
        rarity: route ? (RANK_TONE[route.difficulty] || 'common') : 'common',
        badgesHtml: statusBadgeHtml('Raid en cours', 'legendary', '👟'),
        gauges: [
          { label: 'Progression', value: progressPct, valueLabel: `${progressPct}%` },
          { label: 'État du cargo', value: Math.round(raid.cargoState * 100), valueLabel: `${Math.round(raid.cargoState * 100)}%` }
        ],
        bodyHtml: `<h3 style="margin-top:8px;">📋 Journal du Raid</h3>${eventsHtml}`,
        actionsHtml: `<button class="term-card-action danger" onclick="abandonRaidUI()">🚫 Abandonner le Raid</button>`
      });
    }

function historyCardHtml(h) {
      return terminalCardHtml({
        title: `${h.rank} — ${h.routeName}`,
        subtitle: `${h.porterName} · mois ${h.month}`,
        rarity: RANK_TONE[h.rank] || 'common',
        badgesHtml: statusBadgeHtml(h.rank, RANK_TONE[h.rank] || 'common'),
        bodyHtml: `+${h.likes} likes · +${h.chiralium} chiralium`
      });
    }

export function renderRaidTrackingDrawer() {
      const el = document.getElementById('raidTrackingDrawer');
      if (!el) return;
      const bodyEl = document.getElementById('raidTrackingDrawerBody');
      if (!bodyEl) return;

      const raid = game.activeRaid;
      const history = game.raidHistory || [];
      const historyHtml = history.length ? history.map(historyCardHtml).join('') : '<div class="qp-empty">Aucun Raid Tactique achevé pour l\'instant.</div>';

      if (raid && raid.status === 'active') {
        bodyEl.innerHTML = activeRaidCardHtml(raid) + `<h3 style="margin-top:12px;">🏆 Historique</h3>` + historyHtml;
      } else {
        bodyEl.innerHTML = `
          <div class="qp-empty" style="margin-bottom:8px;">Aucun Raid Tactique en cours.</div>
          <button class="qp-action-btn success" style="min-height:48px;" onclick="openRaidSelectionModalUI()">🗺️ Choisir une route</button>
          <h3 style="margin-top:12px;">🏆 Historique</h3>${historyHtml}`;
      }
    }

export function refreshRaidTrackingDrawerIfOpen() {
      const el = document.getElementById('raidTrackingDrawer');
      if (el && !el.classList.contains('state-collapsed')) renderRaidTrackingDrawer();
    }

// Throttlage (règle 3): raid:progress est déjà émis au rythme des pas validés (donc déjà loin d'un
// flot 60Hz), mais on ne re-render que si le tiroir est effectivement ouvert.
eventBus.on('raid:progress', () => refreshRaidTrackingDrawerIfOpen());
eventBus.on('raid:event', () => refreshRaidTrackingDrawerIfOpen());
eventBus.on('raid:started', () => refreshRaidTrackingDrawerIfOpen());
eventBus.on('raid:completed', () => refreshRaidTrackingDrawerIfOpen());
eventBus.on('raid:abandoned', () => refreshRaidTrackingDrawerIfOpen());
