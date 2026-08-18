// ui/BridgesMap.js (V1.0.0) — Carte Holographique Bridges: rendu Canvas des nœuds de Relais du
// territoire actif (data/Routes.js), reliés au QG par des connexions néon dont la couleur reflète le
// statut réseau réel (ChiralNetworkSystem.js — LOCKED/NETWORKED/ACTIVE_RAID), avec une icône mobile
// interpolée le long de la connexion pour matérialiser un Raid/Expédition IRL en cours. Remplace la
// grille abstraite 10x10 comme support visuel de l'onglet [Missions].
//
// RÈGLE D'ISOLATION (V1.0.0 règle 1): module PUREMENT présentationnel — lecture seule de game.*,
// aucun RNG.next(), aucune mutation d'état. Le clic sur un nœud ne fait qu'OUVRIR une modale UI
// existante (RaidSelectionModal.js/ContractBoardModal.js) — jamais d'appel direct à launchRaid()/
// startExpedition() depuis ce fichier.
import { game } from '../core/GameState.js';
import { routesForMap, DIFFICULTY_COLORS } from '../data/Routes.js';
import { routeStatus, ROUTE_STATUS } from '../systems/raid/ChiralNetworkSystem.js';
import { openRaidSelectionModal } from './RaidSelectionModal.js';
import { openContractBoardModal } from './ContractBoardModal.js';

const STATUS_COLOR = {
      [ROUTE_STATUS.LOCKED]: 'rgba(140, 140, 140, 0.35)',
      [ROUTE_STATUS.NETWORKED]: '255, 159, 28', // Bridges Orange — connexion active mais aucun raid en cours
      [ROUTE_STATUS.ACTIVE_RAID]: '43, 177, 230' // Chiral Blue — raid IRL en transit sur cette route
    };

// Nœuds hit-testés au dernier rendu (recalculés à chaque frame, consommés par le clic) — pas d'état
// métier, uniquement les coordonnées écran nécessaires à l'interaction tactile.
let hitNodes = []; // [{ x, y, r, kind: 'hq'|'relay', route? }]
let boundCanvasId = null;

function layoutPoint(w, h, gx, gy) {
      return { x: w * 0.12 + (gx / 9) * (w * 0.76), y: h * 0.18 + (gy / 9) * (h * 0.64) };
    }

export function renderBridgesMap(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width, h = canvas.height;
      const now = performance.now();

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(10, 10, 10, 0.92)';
      ctx.fillRect(0, 0, w, h);

      // Grille de points holographique — texture discrète, jamais de grille pleine (V1.0.0 règle 3:
      // ce n'est plus une grille de jeu, purement décoratif pour l'ambiance "hologramme").
      ctx.fillStyle = 'rgba(43, 177, 230, 0.08)';
      for (let gx = 0; gx <= 9; gx += 1) {
        for (let gy = 0; gy <= 9; gy += 1) {
          const p = layoutPoint(w, h, gx, gy);
          ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }

      const mapKey = game.currentMap;
      const mapD = game.mapsData[mapKey];
      const branch = mapD.branches[mapD.activeBranch] || mapD.branches[0];
      const hq = layoutPoint(w, h, branch.x, branch.y);
      const routes = routesForMap(mapKey);
      const newHitNodes = [{ x: hq.x, y: hq.y, r: 14, kind: 'hq' }];

      const activeRaid = game.activeRaid && game.activeRaid.status === 'active' ? game.activeRaid : null;

      for (const route of routes) {
        const status = routeStatus(route);
        const target = layoutPoint(w, h, route.toX, route.toY);
        const rgb = STATUS_COLOR[status] || STATUS_COLOR[ROUTE_STATUS.LOCKED];
        const isRgbTriplet = /^\d/.test(rgb);
        const pulse = status === ROUTE_STATUS.LOCKED ? 0 : 0.35 + Math.sin(now / 500 + route.toX) * 0.25;

        // Connexion néon HQ -> Relais
        ctx.strokeStyle = isRgbTriplet ? `rgba(${rgb}, ${0.35 + pulse * 0.4})` : rgb;
        ctx.lineWidth = status === ROUTE_STATUS.ACTIVE_RAID ? 3 : status === ROUTE_STATUS.LOCKED ? 1 : 2;
        if (status === ROUTE_STATUS.LOCKED) ctx.setLineDash([3, 5]); else ctx.setLineDash([]);
        if (isRgbTriplet) { ctx.shadowColor = `rgba(${rgb}, 0.7)`; ctx.shadowBlur = status === ROUTE_STATUS.LOCKED ? 0 : 8; }
        ctx.beginPath();
        ctx.moveTo(hq.x, hq.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);

        // Icône mobile: Raid/Expédition IRL en transit sur CETTE route précise (interpolation linéaire
        // HQ->Relais selon la progression réelle des pas, purement une lecture de game.activeRaid).
        if (activeRaid && activeRaid.routeId === route.id) {
          const frac = Math.max(0, Math.min(1, activeRaid.traveledSteps / activeRaid.targetDistanceSteps));
          const mx = hq.x + (target.x - hq.x) * frac;
          const my = hq.y + (target.y - hq.y) * frac;
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#2BB1E6';
          ctx.shadowColor = 'rgba(43, 177, 230, 0.8)'; ctx.shadowBlur = 8;
          ctx.fillText('🚚', mx, my + 5);
          ctx.shadowBlur = 0;
        }

        // Nœud de Relais — losange biseauté, plein si NETWORKED/ACTIVE_RAID
        const nodeColor = isRgbTriplet ? `rgba(${rgb}, ${status === ROUTE_STATUS.LOCKED ? 0.5 : 0.95})` : rgb;
        ctx.strokeStyle = nodeColor;
        ctx.fillStyle = status === ROUTE_STATUS.LOCKED ? 'rgba(30,30,30,0.6)' : nodeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(target.x, target.y - 9); ctx.lineTo(target.x + 9, target.y);
        ctx.lineTo(target.x, target.y + 9); ctx.lineTo(target.x - 9, target.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.font = '9px monospace';
        ctx.fillStyle = DIFFICULTY_COLORS[route.difficulty] || '#d8d2c4';
        ctx.textAlign = 'center';
        ctx.fillText(route.name, target.x, target.y + (route.toY > 5 ? -14 : 22));

        newHitNodes.push({ x: target.x, y: target.y, r: 14, kind: 'relay', route });
      }

      // QG — losange ambre, toujours au centre du réseau logique
      ctx.fillStyle = '#FF9F1C';
      ctx.strokeStyle = '#FF9F1C';
      ctx.shadowColor = 'rgba(255, 159, 28, 0.6)'; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(hq.x, hq.y - 10); ctx.lineTo(hq.x + 10, hq.y);
      ctx.lineTo(hq.x, hq.y + 10); ctx.lineTo(hq.x - 10, hq.y);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#FF9F1C';
      ctx.fillText('QG', hq.x, hq.y - 16);

      hitNodes = newHitNodes;
      bindInteraction(canvasId);
    }

function handleCanvasClick(evt) {
      const canvas = evt.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
      const cx = (evt.clientX - rect.left) * scaleX, cy = (evt.clientY - rect.top) * scaleY;
      for (const node of hitNodes) {
        const d = Math.hypot(cx - node.x, cy - node.y);
        if (d <= node.r) {
          if (node.kind === 'hq') openContractBoardModal(game.currentMap);
          else openRaidSelectionModal();
          return;
        }
      }
    }

// Idempotent: un seul écouteur par canvas, jamais réattaché à chaque frame (renderBridgesMap tourne
// à chaque ouverture/mise à jour de l'onglet Missions).
function bindInteraction(canvasId) {
      if (boundCanvasId === canvasId) return;
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      canvas.addEventListener('click', handleCanvasClick);
      boundCanvasId = canvasId;
    }
