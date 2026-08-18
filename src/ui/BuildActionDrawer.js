// ui/BuildActionDrawer.js (V0.9.5) — tiroir d'action rapide accessible PENDANT le Raid IRL sans
// changer de page (règle 5): construire une structure de terrain (Abri/Relais/Générateur) via le kit
// PCC équipé. Même pattern nav-aware (NavigationManager/DrawerManager) que RaidTrackingDrawer.js, qui
// l'ouvre par-dessus lui (empilement LIFO déjà éprouvé depuis V0.7.0).
import { game } from '../core/GameState.js';
import { eventBus } from '../core/EventBus.js';
import { FIELD_STRUCTURE_TYPES, requestFieldBuild, structuresForMap } from '../systems/player/PlayerBuildSystem.js';
import { hasPccKitEquipped } from '../systems/player/PlayerLoadout.js';
import { routeById } from '../data/Routes.js';
import { closePanel, isPanelOpen, pushPanel } from '../core/NavigationManager.js';
import { collapseDrawer, openDrawer } from './DrawerManager.js';
import { terminalCardHtml } from './components/TerminalCard.js';
import { statusBadgeHtml } from './components/StatusBadge.js';

function applyCloseBuildActionDrawer() {
      collapseDrawer('buildActionDrawer');
    }

export function openBuildActionDrawer() {
      pushPanel('buildActionDrawer', applyCloseBuildActionDrawer);
      openDrawer('buildActionDrawer', 'peek');
      renderBuildActionDrawer();
    }

export function closeBuildActionDrawer() { closePanel('buildActionDrawer'); }

export function toggleBuildActionDrawer() {
      if (isPanelOpen('buildActionDrawer')) closeBuildActionDrawer(); else openBuildActionDrawer();
    }

export function requestFieldBuildUI(structureType) {
      requestFieldBuild(structureType);
      renderBuildActionDrawer();
    }

function structureOptionCardHtml(def) {
      const cost = def.cost();
      const costLabel = Object.entries(cost).map(([mat, qty]) => `${qty} ${mat}`).join(', ');
      const canPay = Object.entries(cost).every(([mat, qty]) => (game.materials[mat] || 0) >= qty);
      return terminalCardHtml({
        title: `${def.icon} ${def.name}`,
        subtitle: `Coût: ${costLabel} · Durabilité ${def.durability()}`,
        rarity: 'epic',
        actionsHtml: `<button class="term-card-action success" ${canPay ? '' : 'disabled'} onclick="requestFieldBuildUI('${def.id}')">🏗️ Construire</button>`
      });
    }

export function renderBuildActionDrawer() {
      const el = document.getElementById('buildActionDrawer');
      if (!el) return;
      const bodyEl = document.getElementById('buildActionDrawerBody');
      if (!bodyEl) return;

      const raid = game.activeRaid;
      if (!raid || raid.status !== 'active') {
        bodyEl.innerHTML = '<div class="qp-empty">Aucun Raid IRL en cours — la construction de terrain n\'est possible qu\'en chemin.</div>';
        return;
      }
      if (!hasPccKitEquipped()) {
        bodyEl.innerHTML = '<div class="qp-empty">Aucun kit PCC équipé. Ouvrez le Loadout avant de repartir.</div>';
        return;
      }
      const route = routeById(raid.routeId);
      const existing = structuresForMap(route ? route.mapKey : null).filter(s => s.routeId === raid.routeId);
      const existingHtml = existing.length
        ? existing.map(s => terminalCardHtml({
            title: `${FIELD_STRUCTURE_TYPES[s.type].icon} ${FIELD_STRUCTURE_TYPES[s.type].name}`,
            subtitle: `Construit mois ${s.builtMonth}`,
            rarity: 'rare',
            gauges: [{ label: 'Durabilité', value: s.durability, valueLabel: `${Math.round(s.durability)}%` }]
          })).join('')
        : '<div class="qp-empty">Aucune structure posée sur cette route pour l\'instant.</div>';

      bodyEl.innerHTML = `<div style="margin-bottom:6px;">${statusBadgeHtml(`${existing.length}/3 structures sur cette route`, 'rare')}</div>`
        + Object.values(FIELD_STRUCTURE_TYPES).map(structureOptionCardHtml).join('')
        + `<h3 style="margin-top:12px;">🗺️ Structures posées ici</h3>${existingHtml}`;
    }

export function refreshBuildActionDrawerIfOpen() {
      const el = document.getElementById('buildActionDrawer');
      if (el && !el.classList.contains('state-collapsed')) renderBuildActionDrawer();
    }

eventBus.on('build:fieldStructurePlaced', () => refreshBuildActionDrawerIfOpen());
eventBus.on('raid:started', () => refreshBuildActionDrawerIfOpen());
eventBus.on('raid:completed', () => refreshBuildActionDrawerIfOpen());
eventBus.on('raid:abandoned', () => refreshBuildActionDrawerIfOpen());
eventBus.on('loadout:changed', () => refreshBuildActionDrawerIfOpen());
