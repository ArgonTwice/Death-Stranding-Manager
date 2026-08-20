// AUTO-EXTRACTED MODULE: ui/CanvasInspector.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { game } from '../core/GameState.js';
import { MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';
import { PCC_TYPES, SKILLS, TRAITS, cellKey } from '../data/Constants.js';
import { assaultCamp, convertCampToRelay, defendRelay, engageCatcher, fortifyRelay, reconCatcher, sendToIncinerator } from '../engine/CombatEngine.js';
import { sendDelivery } from '../engine/DeliveryEngine.js';
import { isBTZone, isOnRoute, setActiveBranch } from '../engine/MapEngine.js';
import { pccLogbookLines } from '../systems/NarrativeLogEngine.js';
import { repairPCC } from '../systems/NetworkSystem.js';
import { equipSlots, equippedCount, forceRest, porterTitle, repairGear } from '../systems/PorterSystem.js';
import { prepperCardHtml } from './HUD.js';
import { closePanel, pushPanel } from '../core/NavigationManager.js';

let inspectorRefresh = null;

function applyCloseInspector() {
      const modal = document.getElementById('inspectorModal');
      if (modal) modal.classList.remove('open');
      inspectorRefresh = null;
    }

export function openInspector(html, refreshFn) {
      const content = document.getElementById('inspectorContent');
      const modal = document.getElementById('inspectorModal');
      if (!content || !modal) return;
      content.innerHTML = html;
      modal.classList.add('open');
      inspectorRefresh = refreshFn || null;
      pushPanel('inspectorModal', applyCloseInspector); // idempotent: changer de case inspectée ne repousse pas l'historique
    }

export function closeInspector() {
      closePanel('inspectorModal');
    }

export function refreshInspectorIfOpen() {
      const modal = document.getElementById('inspectorModal');
      if (modal && modal.classList.contains('open') && inspectorRefresh) inspectorRefresh();
    }

export function inspectorPorterHtml(p) {
      const statusLabel = { idle: '🟢 Disponible', 'en route': '🟠 En mission', dead: '💀 Décédé', left: '👋 Parti' }[p.status] || p.status;
      const title = porterTitle(p);
      return `<h2>◆ ${p.name}</h2>
        <div style="font-size:11px;">
          Lv${p.level} · ${SKILLS[p.skill].name} · ${TRAITS[p.trait].name}<br>
          Statut: ${statusLabel}${title ? ` · "${title}"` : ''}<br>
          ❤️ ${p.likes} likes · 🎒 ${equippedCount(p)}/${equipSlots(p)}
        </div>
        <div class="gauge-row" style="margin-top:8px;">
          <div class="gauge"><div class="gauge-label"><span>HP</span><span>${Math.ceil(p.health)}/100</span></div><div class="gauge-track"><div class="gauge-fill hp" style="width:${p.health}%;"></div></div></div>
          <div class="gauge"><div class="gauge-label"><span>Stress</span><span>${p.stress}</span></div><div class="gauge-track"><div class="gauge-fill stress" style="width:${p.stress}%;"></div></div></div>
        </div>
        ${(p.gearWear || 0) > 0 ? `<div style="font-size:10px; margin-top:6px; color:${p.gearWear >= 50 ? 'var(--blood)' : 'var(--amber-dim)'};">🔧 Usure équip. ${p.gearWear}%</div>` : ''}
        <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <button onclick="forceRest(${p.id}); refreshInspectorIfOpen();" ${p.status !== 'idle' || p.health <= 0 ? 'disabled' : ''}>😴 Repos forcé</button>
          <button onclick="sendDelivery(${p.id}); closeInspector();" ${p.status !== 'idle' || p.health <= 0 ? 'disabled' : ''}>🚚 Envoyer en livraison</button>
          ${(p.gearWear || 0) > 0 ? `<button style="grid-column:1/-1;" onclick="repairGear(${p.id}); refreshInspectorIfOpen();">🔧 Réparer équipement ($${Math.ceil(p.gearWear * 5)})</button>` : ''}
        </div>`;
    }

export function inspectorPccHtml(pcc) {
      const dur = pcc.durability ?? 100;
      return `<h2>◆ ${PCC_TYPES[pcc.type].icon} ${PCC_TYPES[pcc.type].name}</h2>
        <div style="font-size:11px;">Position (${pcc.x},${pcc.y})${pcc.ghost ? `<br>👻 Structure fantôme laissée par ${pcc.ghostName}` : ''}</div>
        ${!pcc.ghost ? `<div class="gauge" style="margin-top:8px;"><div class="gauge-label"><span>Durabilité</span><span>${dur}%</span></div><div class="gauge-track"><div class="gauge-fill hp" style="width:${dur}%;"></div></div></div>
          <button style="margin-top:8px;" onclick="repairPCC(${pcc.x},${pcc.y}); refreshInspectorIfOpen();" ${dur >= 100 ? 'disabled' : ''}>🔧 Réparation rapide ($${Math.ceil((100 - dur) * 4)})</button>`
          : '<div style="font-size:9px; color:var(--text-dim); margin-top:6px;">Structure laissée par un autre porteur — non réparable.</div>'}
        ${(pcc.type === 'timefallShelter' || pcc.type === 'advancedChiralShelter') ? `<div style="margin-top:10px;"><h3 style="margin-top:0;">📓 Carnet de bord</h3>${pccLogbookLines(pcc).map(l => `<div style="font-size:9px; color:var(--text-dim); font-style:italic; margin:3px 0;">"${l}"</div>`).join('')}</div>` : ''}`;
    }

export function inspectorCampHtml(camp) {
      const strengthTag = '⚠️'.repeat(camp.strength);
      let body;
      if (camp.status === 'hostile') {
        body = `<button onclick="assaultCamp('${camp.id}','infiltration'); closeInspector();">🥷 Infiltration (discret)</button>
          <button onclick="assaultCamp('${camp.id}','assault'); closeInspector();">💥 Assaut létal</button>`;
      } else if (camp.status === 'pacified') {
        body = camp.needsIncineration
          ? `<button onclick="sendToIncinerator('${camp.id}'); refreshInspectorIfOpen();">🔥 Incinérer ($300)</button>`
          : `<button onclick="convertCampToRelay('${camp.id}'); closeInspector();">🏭 Convertir en relais ($1500)</button>`;
      } else if (camp.status === 'under_attack') {
        body = `<button onclick="defendRelay('${camp.id}'); closeInspector();">🛡️ Défendre le relais</button>`;
      } else {
        body = camp.fortified
          ? `<div style="font-size:10px; color:var(--chiral);">🏰 Fortifié — +$${camp.strength * 40}/mois</div>`
          : `<button onclick="fortifyRelay('${camp.id}'); refreshInspectorIfOpen();">🏰 Fortifier ($600)</button>`;
      }
      return `<h2>◆ CAMP (${camp.x},${camp.y})</h2>
        <div style="font-size:11px;">Statut: ${camp.status} ${strengthTag}</div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">${body}</div>`;
    }

export function inspectorCatcherHtml(c) {
      const reconBtn = c.reconDone
        ? `<div style="font-size:10px; color:var(--chiral);">🔭 Reconnaissance déjà effectuée</div>`
        : `<button style="margin-top:8px;" onclick="reconCatcher('${c.id}'); refreshInspectorIfOpen();">🔭 Reconnaissance ($200-500)</button>`;
      return `<h2>◆ 👹 CATCHER MAJEUR</h2>
        <div style="font-size:11px;">Position (${c.x},${c.y})<br>Force ${'⚠️'.repeat(c.strength)}<br>Stock: 🩸${game.materials.blood_grenades || 0} 💉${game.materials.blood_bags || 0}</div>
        ${reconBtn}
        <button style="margin-top:8px;" onclick="engageCatcher('${c.id}'); closeInspector();">⚔️ Engager le combat (2-4 porteurs)</button>`;
    }

export function inspectorBranchHtml(d, idx) {
      const b = d.branches[idx];
      return `<h2>◆ ${idx === 0 ? 'QG BRIDGES' : 'ANTENNE ' + (idx + 1)}</h2>
        <div style="font-size:11px;">Position (${b.x},${b.y})${d.activeBranch === idx ? '<br>★ Antenne active' : ''}</div>
        ${d.activeBranch !== idx ? `<button style="margin-top:8px;" onclick="setActiveBranch(${idx}); closeInspector();">Activer comme point de spawn</button>` : ''}`;
    }

export function inspectorEmptyCellHtml(x, y) {
      const terrain = game.terrain[cellKey(x, y)];
      const terrainLabel = terrain === 'mountain' ? '▲ Montagne (ralentit)' : terrain === 'river' ? '〜 Rivière (ralentit sans pont)' : '— Terrain dégagé';
      const btFlag = isBTZone(x, y) ? '👹 Zone BT active' : '✅ Aucune activité BT détectée';
      const routeFlag = isOnRoute(x, y) ? '🛣️ Sur le réseau chiral' : '— Hors réseau';
      return `<h2>◆ CASE (${x},${y})</h2>
        <div style="font-size:11px; line-height:2;">${terrainLabel}<br>${btFlag}<br>${routeFlag}</div>`;
    }

export function inspectMapCell(x, y) {
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return;
      const d = game.mapsData[game.currentMap];
      if (!d) return;

      const porter = game.porters.find(p => p.map === game.currentMap && p.status !== 'dead' && p.status !== 'left' && p.x === x && p.y === y);
      if (porter) {
        const pid = porter.id;
        openInspector(inspectorPorterHtml(porter), () => {
          const pp = game.porters.find(pt => pt.id === pid);
          if (!pp || pp.status === 'dead') { closeInspector(); return; }
          document.getElementById('inspectorContent').innerHTML = inspectorPorterHtml(pp);
        });
        return;
      }

      const pcc = (d.pccInstalls || []).find(p => p.x === x && p.y === y);
      if (pcc) {
        openInspector(inspectorPccHtml(pcc), () => {
          const pp2 = (game.mapsData[game.currentMap].pccInstalls || []).find(p => p.x === x && p.y === y);
          if (!pp2) { closeInspector(); return; }
          document.getElementById('inspectorContent').innerHTML = inspectorPccHtml(pp2);
        });
        return;
      }

      const camp = (d.muleCamps || []).find(c => c.x === x && c.y === y);
      if (camp) {
        const cid = camp.id;
        openInspector(inspectorCampHtml(camp), () => {
          const cc = (game.mapsData[game.currentMap].muleCamps || []).find(c => c.id === cid);
          if (!cc) { closeInspector(); return; }
          document.getElementById('inspectorContent').innerHTML = inspectorCampHtml(cc);
        });
        return;
      }

      const catcher = (d.catchers || []).find(c => c.x === x && c.y === y);
      if (catcher) {
        const catId = catcher.id;
        openInspector(inspectorCatcherHtml(catcher), () => {
          const cc = (game.mapsData[game.currentMap].catchers || []).find(c => c.id === catId);
          if (!cc) { closeInspector(); return; }
          document.getElementById('inspectorContent').innerHTML = inspectorCatcherHtml(cc);
        });
        return;
      }

      const knotIdx = (d.mainKnots || []).findIndex(k => k.x === x && k.y === y);
      if (knotIdx !== -1) {
        const idlePorters = () => game.porters.filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100);
        const renderKnot = () => `<h2>◆ PREPPER</h2>` + prepperCardHtml(game.mapsData[game.currentMap], game.mapsData[game.currentMap].mainKnots[knotIdx], knotIdx, idlePorters());
        openInspector(renderKnot(), () => { document.getElementById('inspectorContent').innerHTML = renderKnot(); });
        return;
      }

      const branchIdx = (d.branches || []).findIndex(b => b.x === x && b.y === y);
      if (branchIdx !== -1) { openInspector(inspectorBranchHtml(d, branchIdx), null); return; }

      const cargo = (d.lostCargo || []).find(c => c.x === x && c.y === y);
      if (cargo) {
        openInspector(`<h2>◆ CARGAISON PERDUE</h2>
          <div style="font-size:11px;">Position (${x},${y})<br>Récompense: $${cargo.reward}<br>Expire mois ${cargo.expiresMonth}<br><br>
          <span style="color:var(--text-dim); font-size:9px;">Récupérée automatiquement par le premier porteur qui livre à proximité.</span></div>`, null);
        return;
      }

      openInspector(inspectorEmptyCellHtml(x, y), null);
    }
