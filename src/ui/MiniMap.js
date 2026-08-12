// ui/MiniMap.js (V0.3.0) — vue synthétique du réseau (HQ, routes, preppers, camps MULEs, PCC/abris),
// toujours visible en incrustation sur la carte principale, avec un bouton d'agrandissement tactique
// plein écran (réutilise le langage visuel des modales .left existantes: overlay + panneau centré).
import { game } from '../core/GameState.js';
import { MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';
import { PREPPER_ARCHETYPES } from '../data/Constants.js';
import { cellKey } from '../data/Constants.js';

let fullscreenOpen = false;

function drawNetwork(canvas, opts = {}) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(6,5,4,0.9)';
      ctx.fillRect(0, 0, w, h);

      const d = game.mapsData[game.currentMap];
      if (!d) return;
      const cellW = w / MAP_WIDTH, cellH = h / MAP_HEIGHT;
      const toPx = (x, y) => [x * cellW + cellW / 2, y * cellH + cellH / 2];

      // Routes chirales
      ctx.fillStyle = 'rgba(74,217,224,0.5)';
      for (const key of game.routes || []) {
        const [rx, ry] = key.split(',').map(Number);
        const [px, py] = toPx(rx, ry);
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }

      // Camps MULEs
      for (const c of (d.muleCamps || [])) {
        const [px, py] = toPx(c.x, c.y);
        ctx.fillStyle = c.status === 'relay' ? '#4ad9e0' : (c.status === 'hostile' ? '#c93838' : '#6b6459');
        ctx.beginPath(); ctx.arc(px, py, opts.big ? 4 : 2, 0, Math.PI * 2); ctx.fill();
      }

      // PCC (générateur/pont/tyrolienne/abri anti-timefall)
      for (const p of (d.pccInstalls || [])) {
        const [px, py] = toPx(p.x, p.y);
        ctx.fillStyle = p.type === 'timefallShelter' ? '#e8c789' : '#ff8c2b';
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }

      // Preppers (villes principales) — couleur par archétype, connectés en cyan sinon en gris
      for (const k of (d.mainKnots || [])) {
        const [px, py] = toPx(k.x, k.y);
        const connected = (game.routes || new Set()).has(cellKey(k.x, k.y));
        ctx.fillStyle = connected ? '#4ad9e0' : '#8a8474';
        ctx.beginPath(); ctx.arc(px, py, opts.big ? 5 : 2.5, 0, Math.PI * 2); ctx.fill();
        if (opts.big) {
          ctx.fillStyle = '#d8d2c4';
          ctx.font = '9px monospace';
          ctx.fillText(`${PREPPER_ARCHETYPES[k.archetype]?.icon || ''} ${k.name}`, px + 7, py + 3);
        }
      }

      // HQ
      const [hqx, hqy] = toPx(5, 5);
      ctx.strokeStyle = '#ff8c2b';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hqx, hqy, opts.big ? 6 : 3, 0, Math.PI * 2); ctx.stroke();
    }

export function renderMiniMap() {
      const canvas = document.getElementById('miniMapCanvas');
      if (canvas) drawNetwork(canvas, { big: false });
      if (fullscreenOpen) {
        const big = document.getElementById('miniMapCanvasFull');
        if (big) drawNetwork(big, { big: true });
      }
    }

export function toggleMiniMapFullscreen() {
      const modal = document.getElementById('miniMapModal');
      if (!modal) return;
      fullscreenOpen = !fullscreenOpen;
      modal.classList.toggle('open', fullscreenOpen);
      if (fullscreenOpen) renderMiniMap();
    }

export function closeMiniMapFullscreen() {
      const modal = document.getElementById('miniMapModal');
      if (!modal) return;
      fullscreenOpen = false;
      modal.classList.remove('open');
    }
