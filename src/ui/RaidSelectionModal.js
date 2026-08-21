// ui/RaidSelectionModal.js (V0.9.0) — sélection de la route A->B pour un Raid Tactique: Canvas
// miniature par route (liaison néon ambrée QG->cible), badge de difficulté, statut réseau
// (LOCKED/RAID DISPONIBLE), sélection du porteur, bouton "LANCER RAID IRL" (≥48px, V0.7.5).
// Même langage visuel que les autres modales .left (CanvasInspector.js/MiniMap.js).
import { game } from '../core/GameState.js';
import { RAID_ROUTES, DIFFICULTY_COLORS } from '../data/Routes.js';
import { HQ } from '../data/Balance.js';
import { ROUTE_STATUS, isRouteAvailable, routeStatus, revealedRoutes } from '../systems/raid/ChiralNetworkSystem.js';
import { launchRaid } from '../systems/raid/RaidSystem.js';
import { closePanel, closePanelThenPush, pushPanel } from '../core/NavigationManager.js';
import { terminalCardHtml } from './components/TerminalCard.js';
import { statusBadgeHtml } from './components/StatusBadge.js';
import { openRaidTrackingDrawer } from './RaidTrackingDrawer.js';

const DIFFICULTY_TONE = { D: 'common', C: 'rare', B: 'rare', A: 'epic', S: 'legendary', LEGENDARY: 'legendary' };

function applyCloseRaidSelectionModal() {
      const modal = document.getElementById('raidSelectionModal');
      if (modal) modal.classList.remove('open');
    }

export function openRaidSelectionModal() {
      const modal = document.getElementById('raidSelectionModal');
      if (!modal) return;
      modal.classList.add('open');
      pushPanel('raidSelectionModal', applyCloseRaidSelectionModal);
      renderRaidSelectionModal();
    }

export function closeRaidSelectionModal() { closePanel('raidSelectionModal'); }

function drawRouteCanvas(canvas, route, available) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(6,5,4,0.9)';
      ctx.fillRect(0, 0, w, h);
      const fromPx = [w * 0.12, h * 0.5];
      const toPx = [w * 0.15 + (route.toX / 9) * (w * 0.7), h * 0.15 + (route.toY / 9) * (h * 0.7)];
      const color = available ? (DIFFICULTY_COLORS[route.difficulty] || '#ff8c2b') : 'rgba(255,255,255,0.18)';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(available ? [] : [4, 4]);
      ctx.shadowColor = available ? color : 'transparent';
      ctx.shadowBlur = available ? 8 : 0;
      ctx.beginPath();
      ctx.moveTo(fromPx[0], fromPx[1]);
      ctx.lineTo(toPx[0], toPx[1]);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);

      ctx.fillStyle = '#ff8c2b';
      ctx.beginPath(); ctx.arc(fromPx[0], fromPx[1], 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(toPx[0], toPx[1], 4, 0, Math.PI * 2); ctx.fill();
    }

function routeCardHtml(route) {
      const status = routeStatus(route);
      const available = status === ROUTE_STATUS.NETWORKED;
      const idlePorters = game.porters.filter(p => p.map === route.mapKey && p.status === 'idle' && p.health > 15);
      const porterOptions = idlePorters.length
        ? idlePorters.map(p => `<option value="${p.id}">${p.name} (Lv${p.level})</option>`).join('')
        : '<option value="">— aucun porteur disponible sur ce territoire —</option>';
      const statusBadge = status === ROUTE_STATUS.LOCKED ? statusBadgeHtml('LOCKED', 'common', '🔒')
        : status === ROUTE_STATUS.BLOCKED ? statusBadgeHtml('BLOQUÉE', 'common', '⛔')
        : status === ROUTE_STATUS.ACTIVE_RAID ? statusBadgeHtml('RAID EN COURS', 'legendary', '🚩')
        : statusBadgeHtml('RAID DISPONIBLE', 'legendary', '🟢');

      return terminalCardHtml({
        title: route.name,
        subtitle: `${route.baseDistanceSteps.toLocaleString('fr-FR')} pas · ${route.mapKey}`,
        rarity: DIFFICULTY_TONE[route.difficulty],
        badgesHtml: statusBadgeHtml(route.difficulty, DIFFICULTY_TONE[route.difficulty]) + statusBadge,
        bodyHtml: `<canvas id="raidCanvas-${route.id}" width="260" height="90" style="width:100%; height:auto; margin-bottom:6px;"></canvas>`
          + (available ? `<select id="raidPorterSelect-${route.id}" class="qp-select">${porterOptions}</select>`
            : status === ROUTE_STATUS.LOCKED ? `<div class="qp-empty">Réseau insuffisant sur ce territoire${route.requireSuperRelay ? ' (Super-Relais requis)' : ''}.</div>`
            // V1.6.0 — aléa de terrain DS2 temporaire, distinct d'un raid déjà en transit.
            : status === ROUTE_STATUS.BLOCKED ? '<div class="qp-empty">⛔ Route bloquée par un éboulement/une inondation — patientez quelques jours.</div>'
            : '<div class="qp-empty">Un raid est déjà en cours sur cette route.</div>'),
        actionsHtml: available ? `<button class="term-card-action success" ${idlePorters.length ? '' : 'disabled'} onclick="launchRaidFromUI('${route.id}')">🚩 Lancer Raid IRL</button>` : ''
      });
    }

// V1.4.0 — "Brumes de guerre": ne s'applique QU'au territoire actif (game.currentMap) — cette vue
// mondiale des Raids IRL montre délibérément les AUTRES continents pas encore débloqués (LOCKED,
// "Réseau insuffisant sur ce territoire"), une vue d'ensemble volontaire distincte de la Carte
// Holographique locale (ui/BridgesMap.js), pas un territoire à masquer au même titre.
function visibleRaidRoutes() {
      const local = revealedRoutes(RAID_ROUTES.filter(r => r.mapKey === game.currentMap));
      const others = RAID_ROUTES.filter(r => r.mapKey !== game.currentMap);
      return [...local, ...others];
    }

export function renderRaidSelectionModal() {
      const el = document.getElementById('raidSelectionModalBody');
      if (!el) return;
      const routes = visibleRaidRoutes();
      el.innerHTML = routes.map(routeCardHtml).join('');
      for (const route of routes) {
        const canvas = document.getElementById(`raidCanvas-${route.id}`);
        if (canvas) drawRouteCanvas(canvas, route, isRouteAvailable(route));
      }
    }

export function launchRaidFromUI(routeId) {
      const sel = document.getElementById(`raidPorterSelect-${routeId}`);
      const porterId = sel && sel.value !== '' ? parseInt(sel.value) : null;
      if (porterId == null) return;
      const ok = launchRaid(routeId, porterId);
      if (ok) {
        // V1.32.0 — closeRaidSelectionModal(); openRaidTrackingDrawer(); (fermeture async + ouverture
        // synchrone juste après) refermait le tiroir de suivi quelques centaines de ms après son
        // ouverture — cf. core/NavigationManager.js#closePanelThenPush pour le mécanisme exact.
        closePanelThenPush('raidSelectionModal', openRaidTrackingDrawer);
      } else {
        renderRaidSelectionModal();
      }
    }
