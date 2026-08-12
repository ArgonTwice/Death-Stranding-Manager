// ui/ConvoyPanel.js (V0.4.0) — tiroir glissant de planification de Convois Lourds (même langage
// visuel que QuestPanel.js: glisse depuis le bord, ne bloque jamais le Canvas). Composition
// d'escouade (1 porteur-véhicule + jusqu'à 3 escortes), choix de stratégie, prévisualisation du
// risque (Signature Chirale) et du gain avant de lancer — cibles tactiles ≥48x48px.
import { game } from '../core/GameState.js';
import { BALANCE, MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';
import { CARGO_TYPES, CONVOY_STRATEGIES, ROUTE_TYPES } from '../data/Constants.js';
import { convoySignature, signatureToRiskMod } from '../engine/RiskEngine.js';
import { createConvoy } from '../systems/ConvoySystem.js';

let panelOpen = false;

export function openConvoyPanel() {
      panelOpen = true;
      const el = document.getElementById('convoyDrawer');
      if (el) el.classList.add('open');
      renderConvoyPanel();
    }

export function closeConvoyPanel() {
      panelOpen = false;
      const el = document.getElementById('convoyDrawer');
      if (el) el.classList.remove('open');
    }

export function toggleConvoyPanel() {
      if (panelOpen) closeConvoyPanel(); else openConvoyPanel();
    }

function eligibleVehiclePorters() {
      return game.porters.filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100 && p.equipment.vehicle);
    }

function eligibleEscorts(vehiclePorterId) {
      return game.porters.filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100 && p.id !== vehiclePorterId);
    }

export function renderConvoyPanel() {
      const el = document.getElementById('convoyDrawer');
      if (!el) return;
      const bodyEl = document.getElementById('convoyDrawerBody');
      if (!bodyEl) return;

      const vehiclePorters = eligibleVehiclePorters();
      if (!vehiclePorters.length) {
        bodyEl.innerHTML = '<div class="qp-empty">Aucun porteur équipé d\'un véhicule disponible sur ce territoire — achetez/équipez un véhicule (onglet Gestion).</div>';
        return;
      }
      const vehicleOptions = vehiclePorters.map(p => `<option value="${p.id}">${p.name} (${p.equipment.vehicle})</option>`).join('');
      const firstVehicleId = vehiclePorters[0].id;
      const escorts = eligibleEscorts(firstVehicleId);

      bodyEl.innerHTML = `
        <div class="qp-card">
          <div class="qp-card-head">🚛 Porteur-véhicule</div>
          <select id="convoyVehicleSelect" class="qp-select" onchange="renderConvoyEscortList(); updateConvoyPreview();">${vehicleOptions}</select>

          <div class="qp-card-head" style="margin-top:8px;">🧑‍🤝‍🧑 Escortes (jusqu'à ${BALANCE.convoy.maxEscorts})</div>
          <div id="convoyEscortList" class="convoy-escort-list"></div>

          <div class="qp-card-head" style="margin-top:8px;">📍 Destination</div>
          <div class="convoy-dest-row">
            <input id="convoyDestX" type="number" min="0" max="${MAP_WIDTH - 1}" value="5" class="qp-select" oninput="updateConvoyPreview()">
            <input id="convoyDestY" type="number" min="0" max="${MAP_HEIGHT - 1}" value="5" class="qp-select" oninput="updateConvoyPreview()">
          </div>

          <div class="qp-card-head" style="margin-top:8px;">🗺️ Itinéraire</div>
          <select id="convoyRouteSelect" class="qp-select">
            ${Object.entries(ROUTE_TYPES).map(([k, r]) => `<option value="${k}">${r.icon} ${r.name}</option>`).join('')}
          </select>

          <div class="qp-card-head" style="margin-top:8px;">📋 Stratégie</div>
          <select id="convoyStrategySelect" class="qp-select" onchange="updateConvoyPreview()">
            ${Object.entries(CONVOY_STRATEGIES).map(([k, s]) => `<option value="${k}">${s.icon} ${s.name} — ${s.desc}</option>`).join('')}
          </select>

          <div id="convoyPreview" class="convoy-preview"></div>

          <button class="qp-action-btn success convoy-launch-btn" onclick="launchConvoyFromUI()">🚛 Lancer le convoi</button>
        </div>`;

      renderConvoyEscortList();
      updateConvoyPreview();
    }

export function renderConvoyEscortList() {
      const listEl = document.getElementById('convoyEscortList');
      const vehicleSel = document.getElementById('convoyVehicleSelect');
      if (!listEl || !vehicleSel) return;
      const vehicleId = parseInt(vehicleSel.value);
      const escorts = eligibleEscorts(vehicleId);
      listEl.innerHTML = escorts.length
        ? escorts.map(p => `
          <label class="convoy-escort-item">
            <input type="checkbox" class="convoy-escort-check" value="${p.id}" onchange="updateConvoyPreview()">
            ${p.name} (Lv${p.level})
          </label>`).join('')
        : '<div class="qp-empty">Aucune escorte disponible.</div>';
    }

function checkedEscortIds() {
      return Array.from(document.querySelectorAll('.convoy-escort-check:checked')).map(el => parseInt(el.value)).slice(0, BALANCE.convoy.maxEscorts);
    }

// Prévisualisation pure (aucun RNG consommé) — recalculée à chaque changement de sélection, jamais
// pendant la simulation elle-même (sinon ça romprait le déterminisme du seed).
export function updateConvoyPreview() {
      const previewEl = document.getElementById('convoyPreview');
      const vehicleSel = document.getElementById('convoyVehicleSelect');
      const strategySel = document.getElementById('convoyStrategySelect');
      if (!previewEl || !vehicleSel || !strategySel) return;
      const vehicleId = parseInt(vehicleSel.value);
      const vehiclePorter = game.porters.find(p => p.id === vehicleId);
      if (!vehiclePorter) return;
      const escortIds = checkedEscortIds();
      const escorts = escortIds.map(id => game.porters.find(p => p.id === id)).filter(Boolean);
      const squad = [vehiclePorter, ...escorts];
      const strategy = strategySel.value;
      const strat = BALANCE.convoy.strategies[strategy] || {};

      const signature = convoySignature(squad, CARGO_TYPES.heavy.mass, strategy);
      const signatureRisk = signatureToRiskMod(signature);
      const escortRiskCut = Math.min(BALANCE.convoy.riskCutCap, escorts.length * BALANCE.convoy.riskCutPerEscort);
      const netRiskMod = signatureRisk - escortRiskCut - (strat.riskCut || 0);
      const rewardMult = (1 + escorts.length * BALANCE.convoy.rewardSharePerEscort) * (strat.rewardMult || 1);

      previewEl.innerHTML = `
        <div class="convoy-preview-row"><span>👥 Membres</span><span>${squad.length}</span></div>
        <div class="convoy-preview-row"><span>📡 Signature chirale</span><span class="${signature > 0.3 ? 'convoy-risk-high' : ''}">${Math.round(signature * 100)}%</span></div>
        <div class="convoy-preview-row"><span>⚠️ Risque net</span><span class="${netRiskMod > 0 ? 'convoy-risk-high' : 'convoy-risk-low'}">${netRiskMod > 0 ? '+' : ''}${Math.round(netRiskMod * 100)}%</span></div>
        <div class="convoy-preview-row"><span>💰 Multiplicateur gain</span><span>x${rewardMult.toFixed(2)}</span></div>`;
    }

// Pont UI: lit les <select>/inputs de la carte, délègue à ConvoySystem.createConvoy.
export function launchConvoyFromUI() {
      const vehicleSel = document.getElementById('convoyVehicleSelect');
      const routeSel = document.getElementById('convoyRouteSelect');
      const strategySel = document.getElementById('convoyStrategySelect');
      const destXEl = document.getElementById('convoyDestX');
      const destYEl = document.getElementById('convoyDestY');
      if (!vehicleSel || !strategySel || !destXEl || !destYEl) return;
      const vehicleId = parseInt(vehicleSel.value);
      const escortIds = checkedEscortIds();
      const destX = Math.max(0, Math.min(MAP_WIDTH - 1, parseInt(destXEl.value) || 0));
      const destY = Math.max(0, Math.min(MAP_HEIGHT - 1, parseInt(destYEl.value) || 0));
      createConvoy(destX, destY, vehicleId, escortIds, strategySel.value, routeSel ? routeSel.value : null);
      renderConvoyPanel();
    }
