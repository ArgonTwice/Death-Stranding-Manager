// AUTO-EXTRACTED MODULE: systems/PrepperSystem.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent } from '../core/GameState.js';
import { RANKS } from '../data/Balance.js';
import { NEED_LABELS, PREPPER_ARCHETYPES, cellKey } from '../data/Constants.js';
import { createDelivery } from '../engine/DeliveryEngine.js';
import { findPathToKnot } from '../engine/MapEngine.js';
import { prepperWeatherNeedMult } from '../engine/WeatherEngine.js';
import { migratePrepperKnot } from '../persistence/SaveMigrations.js';
import { render } from '../ui/HUD.js';
import { markMapDirty } from '../ui/MapRenderer.js';

export function pickPrepperArchetype() {
      const keys = Object.keys(PREPPER_ARCHETYPES);
      return keys[Math.floor(Math.random() * keys.length)];
    }

export function prepperStars(relation) { return Math.max(1, Math.min(5, Math.ceil((relation || 0) / 20))); }

export function prepperStarsLabel(relation) { return '⭐'.repeat(prepperStars(relation)) + '☆'.repeat(5 - prepperStars(relation)); }

export function makePrepper(x, y, name) {
      const archetype = pickPrepperArchetype();
      return {
        x, y, name, archetype,
        relation: 25 + Math.floor(Math.random() * 15), // 25-40 au départ, façon relation naissante
        needs: { medical: 20 + Math.floor(Math.random() * 30), food: 20 + Math.floor(Math.random() * 30), tech: 20 + Math.floor(Math.random() * 30) },
        contracts: []
      };
    }

export function updatePrepperNeeds() {
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        for (const k of (d.mainKnots || [])) {
          migratePrepperKnot(k);
          for (const need of ['medical', 'food', 'tech']) {
            const mult = prepperWeatherNeedMult(d.weather, need);
            k.needs[need] = Math.min(100, k.needs[need] + (3 + Math.random() * 4) * mult);
          }
          if (k.needs.medical >= 90 || k.needs.food >= 90 || k.needs.tech >= 90) {
            k.relation = Math.max(0, k.relation - 2);
          }
        }
      }
    }

export function generatePrepperContracts() {
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        for (let i = 0; i < (d.mainKnots || []).length; i++) {
          const k = d.mainKnots[i];
          migratePrepperKnot(k);
          if (!k.contracts) k.contracts = [];
          k.contracts = k.contracts.filter(c => {
            if (game.month > c.expiresMonth) {
              if (key === game.currentMap) logEvent(`⌛ Requête de ${k.name} expirée: ${c.flavor}`, 'warn');
              return false;
            }
            return true;
          });
          if (k.contracts.length >= 2) continue; // max 2 requêtes simultanées par prepper
          const chance = 0.2 + (k.relation >= 60 ? 0.1 : 0); // relation forte = préppers plus loquaces
          if (Math.random() > chance) continue;
          const arch = PREPPER_ARCHETYPES[k.archetype];
          const needKeys = Object.keys(k.needs).sort((a, b) => k.needs[b] - k.needs[a]);
          const urgentNeed = needKeys[0];
          const baseReward = Math.ceil((250 + Math.random() * 350) * (1 + k.relation / 150) * RANKS[currentRankIndex()].questMult);
          k.contracts.push({
            id: `pc-${key}-${i}-${game.month}-${Math.floor(Math.random() * 9999)}`,
            prepperIdx: i, mapKey: key, need: urgentNeed,
            flavor: `${k.name} réclame ${NEED_LABELS[urgentNeed]} d'urgence`,
            reward: baseReward, expiresMonth: game.month + 2 + Math.floor(Math.random() * 2),
            negotiable: Math.random() < 0.4, negotiated: false
          });
          if (key === game.currentMap) logEvent(`🗣️ ${arch.icon} ${k.name} (${arch.name}) a une requête — relation ${prepperStarsLabel(k.relation)}`, 'good');
        }
      }
    }

export function applyHermitGifts() {
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        for (const k of (d.mainKnots || [])) {
          if (k.archetype === 'hermit' && k.relation >= 80 && d.routes.has(cellKey(k.x, k.y))) {
            game.materials.chiral_crystal += PREPPER_ARCHETYPES.hermit.perkValue;
            if (key === game.currentMap) logEvent(`🥾 ${k.name} (Ermite) fait don d'un cristal chiral rare`, 'good');
          }
        }
      }
    }

export function prepperPerkBonus(perkType) {
      const d = game.mapsData[game.currentMap];
      if (!d) return 0;
      let total = 0;
      for (const k of (d.mainKnots || [])) {
        if (!d.routes.has(cellKey(k.x, k.y))) continue;
        const arch = PREPPER_ARCHETYPES[k.archetype];
        if (arch.perk === perkType && k.relation >= 60) total += arch.perkValue;
      }
      return total;
    }

export function applyPrepperDeliveryOutcome(quest, success, rating) {
      if (!quest || quest.prepperIdx == null) return;
      const d = game.mapsData[quest.mapKey];
      if (!d) return;
      const k = d.mainKnots && d.mainKnots[quest.prepperIdx];
      if (!k) return;
      const isCurrent = quest.mapKey === game.currentMap;
      if (success) {
        const gain = rating ? Math.max(2, Math.round(rating.likes * 0.6)) : 4;
        k.relation = Math.min(100, k.relation + gain);
        if (quest.contractId && quest.need) {
          k.needs[quest.need] = Math.max(0, k.needs[quest.need] - (50 + Math.random() * 20));
          k.contracts = (k.contracts || []).filter(c => c.id !== quest.contractId);
          if (isCurrent) logEvent(`🤝 ${k.name}: relation +${gain} (${prepperStarsLabel(k.relation)}), besoin comblé`, 'good');
        } else if (isCurrent) {
          logEvent(`🤝 ${k.name}: relation +${gain} (${prepperStarsLabel(k.relation)})`, 'good');
        }
      } else {
        k.relation = Math.max(0, k.relation - 8);
        if (isCurrent) logEvent(`📉 ${k.name}: relation -8 (${prepperStarsLabel(k.relation)}) — livraison ratée`, 'warn');
      }
    }

export function assignPrepperContract(knotIdx, contractId, porterId, route) {
      const d = game.mapsData[game.currentMap];
      const k = d.mainKnots && d.mainKnots[knotIdx];
      if (!k) return;
      const contract = (k.contracts || []).find(c => c.id === contractId);
      if (!contract) { logEvent('❌ Requête expirée ou déjà traitée'); return; }
      const p = game.porters.find(x => x.id === porterId);
      if (!p || p.map !== game.currentMap || p.status !== 'idle' || p.health <= 0) { logEvent('❌ Porteur indisponible'); return; }
      createDelivery(p.id, k.x, k.y, {
        reward: contract.reward, flavor: contract.flavor, riskCut: 0.05, route,
        prepperIdx: knotIdx, mapKey: game.currentMap, contractId: contract.id, need: contract.need
      });
      logEvent(`🚚 ${p.name} part livrer ${k.name} — ${contract.flavor}`, 'good');
      eventBus.emit('render:request');
    }

export function negotiatePrepperContract(knotIdx, contractId) {
      const d = game.mapsData[game.currentMap];
      const k = d.mainKnots && d.mainKnots[knotIdx];
      if (!k) return;
      const c = (k.contracts || []).find(x => x.id === contractId);
      if (!c || !c.negotiable || c.negotiated) return;
      c.negotiated = true;
      const successChance = 0.4 + k.relation / 200;
      if (Math.random() < successChance) {
        const bonus = Math.ceil(c.reward * (0.15 + Math.random() * 0.15));
        c.reward += bonus;
        logEvent(`🗣️ Négociation réussie avec ${k.name}: +$${bonus} sur la requête`, 'good');
      } else {
        k.relation = Math.max(0, k.relation - 3);
        logEvent(`🗣️ ${k.name} n'apprécie pas la négociation (relation -3)`, 'warn');
      }
      eventBus.emit('render:request');
    }

export function connectKnot(idx) {
      const d = game.mapsData[game.currentMap];
      const knot = d.mainKnots && d.mainKnots[idx];
      if (!knot) return;
      if (game.routes.has(cellKey(knot.x, knot.y))) { logEvent('✅ Déjà raccordé'); return; }
      const path = findPathToKnot(knot.x, knot.y);
      if (!path) { logEvent(`❌ Aucun chemin possible vers ${knot.name} — cratères bloquent tout accès`); return; }
      const newCells = path.filter(k => !game.routes.has(k));
      const cost = Math.ceil(300 * Math.max(1, newCells.length));
      if (game.money < cost) { logEvent(`❌ Budget raccordement ($${cost})`); return; }
      game.money -= cost;
      for (const k of newCells) game.routes.add(k);
      markMapDirty();
      logEvent(`🔧 Raccordement chiral achevé → ${knot.name} (-$${cost}, ${newCells.length} cases)`);
      eventBus.emit('render:request');
    }
