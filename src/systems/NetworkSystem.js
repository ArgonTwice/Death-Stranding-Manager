// AUTO-EXTRACTED MODULE: systems/NetworkSystem.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent, runtime } from '../core/GameState.js';
import { GRID_SIZE, HQ, MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';
import { GHOST_NAMES, PCC_TYPES } from '../data/Constants.js';
import { render } from '../ui/HUD.js';
import { markMapDirty } from '../ui/MapRenderer.js';

export function startPlacingPCC(type) {
      runtime.placingPCC = type;
      logEvent(`🏗️ Mode placement: ${PCC_TYPES[type].name} — cliquez sur la carte (Annuler pour sortir)`);
      eventBus.emit('render:request');
    }

export function cancelPlacingPCC() {
      runtime.placingPCC = null;
      eventBus.emit('render:request');
    }

export function canvasClickToCell(evt) {
      const canvas = document.getElementById('gameMap');
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (evt.clientX - rect.left) * scaleX;
      const py = (evt.clientY - rect.top) * scaleY;
      return { x: Math.floor(px / GRID_SIZE), y: Math.floor(py / GRID_SIZE) };
    }

export function placePCCAt(x, y) {
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return;
      const type = runtime.placingPCC;
      if (!type) return;
      const d = game.mapsData[game.currentMap];
      if (!d.pccInstalls) d.pccInstalls = [];
      if (x === HQ.x && y === HQ.y) { logEvent('❌ Case du QG occupée'); return; }
      if (d.pccInstalls.some(p => p.x === x && p.y === y)) { logEvent('❌ Case déjà occupée par un PCC'); return; }
      const nearRoute = Array.from(game.routes).some(k => { const [rx, ry] = k.split(',').map(Number); return Math.hypot(rx - x, ry - y) <= 1.5; });
      if (!nearRoute) { logEvent('❌ Doit être posé sur ou près d\'une route existante'); return; }
      const count = d.pccInstalls.filter(p => p.type === type).length;
      const cost = Math.ceil(PCC_TYPES[type].cost * (1 + count * 0.4));
      if (game.money < cost) { logEvent(`❌ Budget PCC ($${cost})`); return; }
      game.money -= cost;
      d.pccInstalls.push({ type, x, y, durability: 100 });
      game.pccInstalls = d.pccInstalls;
      markMapDirty();
      logEvent(`🏗️ ${PCC_TYPES[type].name} posé en (${x},${y}) (-$${cost})`, 'good');
      runtime.placingPCC = null;
      eventBus.emit('render:request');
    }

export function repairPCC(x, y) {
      const d = game.mapsData[game.currentMap];
      const pcc = (d.pccInstalls || []).find(p => p.x === x && p.y === y);
      if (!pcc) return;
      const missing = 100 - pcc.durability;
      if (missing <= 0) { logEvent('❌ PCC déjà en parfait état'); return; }
      const cost = Math.ceil(missing * 4);
      if (game.money < cost) { logEvent(`❌ Budget réparation PCC ($${cost})`); return; }
      game.money -= cost;
      pcc.durability = 100;
      logEvent(`🔧 ${PCC_TYPES[pcc.type].name} (${x},${y}) réparé (-$${cost})`, 'good');
      eventBus.emit('render:request');
    }

export function degradePCCOnMap(mapKey, amount) {
      const d = game.mapsData[mapKey];
      if (!d || !d.pccInstalls || !d.pccInstalls.length) return;
      const collapsed = [];
      d.pccInstalls.forEach(p => { p.durability = Math.max(0, (p.durability ?? 100) - amount); });
      d.pccInstalls = d.pccInstalls.filter(p => {
        if (p.durability <= 0) { collapsed.push(p); return false; }
        return true;
      });
      if (collapsed.length) {
        if (mapKey === game.currentMap) { game.pccInstalls = d.pccInstalls; markMapDirty(); }
        for (const p of collapsed) logEvent(`💥 ${PCC_TYPES[p.type].name} (${p.x},${p.y}) s'est effondré (corrosion)`, 'warn');
      }
    }

export function isNearPCC(x, y, type) {
      return (game.pccInstalls || []).some(p => p.type === type && Math.hypot(p.x - x, p.y - y) <= 1.5);
    }

export function checkAsyncNetwork() {
      const d = game.mapsData[game.currentMap];
      if (!d.pccInstalls) d.pccInstalls = [];
      if (!d.lostCargo) d.lostCargo = [];
      let mapChanged = false;

      // Structure fantôme: un autre porteur a laissé un pont/tyrolienne — un seul fantôme actif à la fois
      if (currentRankIndex() >= 1 && !d.pccInstalls.some(p => p.ghost) && Math.random() < 0.1) {
        const routeArr = Array.from(game.routes);
        if (routeArr.length) {
          const [rx, ry] = routeArr[Math.floor(Math.random() * routeArr.length)].split(',').map(Number);
          const dx = Math.max(0, Math.min(MAP_WIDTH - 1, rx + (Math.random() < 0.5 ? -1 : 1)));
          const dy = Math.max(0, Math.min(MAP_HEIGHT - 1, ry + (Math.random() < 0.5 ? -1 : 1)));
          if (!d.pccInstalls.some(p => p.x === dx && p.y === dy) && !(dx === HQ.x && dy === HQ.y)) {
            const ghostType = Math.random() < 0.5 ? 'bridge' : 'zipline';
            const name = GHOST_NAMES[Math.floor(Math.random() * GHOST_NAMES.length)];
            d.pccInstalls.push({ type: ghostType, x: dx, y: dy, durability: 100, ghost: true, ghostName: name, expiresMonth: game.month + 2 + Math.floor(Math.random() * 3) });
            mapChanged = true;
            logEvent(`👻 ${PCC_TYPES[ghostType].name} fantôme repéré (${dx},${dy}) — laissé par ${name}`, 'good');
          }
        }
      }
      // Expiration des fantômes (les autres porteurs ne maintiennent pas indéfiniment)
      const beforeCount = d.pccInstalls.length;
      d.pccInstalls = d.pccInstalls.filter(p => !p.ghost || game.month < p.expiresMonth);
      if (d.pccInstalls.length !== beforeCount) mapChanged = true;

      // Cargaison perdue: à récupérer lors d'un prochain trajet passant à proximité
      if (!d.lostCargo.length && Math.random() < 0.12) {
        const x = Math.floor(Math.random() * MAP_WIDTH), y = Math.floor(Math.random() * MAP_HEIGHT);
        if (!(x === HQ.x && y === HQ.y)) {
          d.lostCargo.push({ x, y, reward: 150 + Math.floor(Math.random() * 250), expiresMonth: game.month + 3 });
          mapChanged = true;
          logEvent(`📦 Cargaison perdue signalée (${x},${y}) — récupérable lors d'un trajet à proximité`, 'good');
        }
      }
      const beforeCargo = d.lostCargo.length;
      d.lostCargo = d.lostCargo.filter(c => game.month < c.expiresMonth);
      if (d.lostCargo.length !== beforeCargo) mapChanged = true;

      if (mapChanged && d === game.mapsData[game.currentMap]) {
        game.pccInstalls = d.pccInstalls;
        game.lostCargo = d.lostCargo;
        markMapDirty();
      }

      // Dons communautaires: le réseau alimente les relais logistiques du joueur
      const relays = (d.muleCamps || []).filter(c => c.status === 'relay').length;
      if (relays > 0 && Math.random() < 0.25) {
        game.materials.chiral_crystal += relays;
        logEvent(`🤝 Le réseau a fait don de ${relays} cristal(aux) chiral(aux) à vos relais`, 'good');
      }

      // Likes asynchrones: un porteur inconnu a emprunté une de vos PCC
      const ownPCC = d.pccInstalls.filter(p => !p.ghost);
      if (ownPCC.length > 0 && Math.random() < 0.3) {
        const active = game.porters.filter(p => p.status !== 'dead' && p.status !== 'left');
        if (active.length) {
          const beneficiary = active[Math.floor(Math.random() * active.length)];
          const likesGain = 3 + Math.floor(Math.random() * 8);
          beneficiary.likes += likesGain;
          game.reputation = Math.min(100, game.reputation + 1);
          logEvent(`🌐 Un porteur inconnu a emprunté votre ${PCC_TYPES[ownPCC[0].type].name} — +${likesGain}❤️ pour ${beneficiary.name}`, 'good');
        }
      }
    }

export function collectNearbyLostCargo(x, y) {
      const d = game.mapsData[game.currentMap];
      if (!d.lostCargo || !d.lostCargo.length) return 0;
      const idx = d.lostCargo.findIndex(c => Math.hypot(c.x - x, c.y - y) <= 1.5);
      if (idx === -1) return 0;
      const cargo = d.lostCargo.splice(idx, 1)[0];
      game.lostCargo = d.lostCargo;
      markMapDirty();
      return cargo.reward;
    }
