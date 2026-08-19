// AUTO-EXTRACTED MODULE: systems/PrepperSystem.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, RANKS } from '../data/Balance.js';
import { NEED_LABELS, PREPPER_ARCHETYPES, cellKey } from '../data/Constants.js';
import { createDelivery } from '../engine/DeliveryEngine.js';
import { findPathToKnot } from '../engine/MapEngine.js';
import { prepperWeatherNeedMult } from '../engine/WeatherEngine.js';
import { migratePrepperKnot } from '../persistence/SaveMigrations.js';
import { markMapDirty } from '../ui/MapRenderer.js';
import { timefallPrepperDemandMult } from './TimefallSystem.js';

export function pickPrepperArchetype() {
      const keys = Object.keys(PREPPER_ARCHETYPES);
      return keys[Math.floor(RNG.next() * keys.length)];
    }

export function prepperStars(relation) { return Math.max(1, Math.min(BALANCE.prepper.starsMax, Math.ceil((relation || 0) / BALANCE.prepper.starsRelationDivisor))); }

export function prepperStarsLabel(relation) { return '⭐'.repeat(prepperStars(relation)) + '☆'.repeat(BALANCE.prepper.starsMax - prepperStars(relation)); }

// V1.1 — "trust" est déjà porté par k.relation (0-100, existant depuis V0.x): il n'y a jamais eu
// besoin d'un second champ trustPoints qui pourrait diverger de la valeur réelle. k.stars n'est pas
// non plus dupliqué en état persisté — TOUJOURS dérivé à la volée via prepperStars(k.relation), la
// SEULE source de vérité, exactement comme l'UI (prepperStarsLabel) le fait déjà partout. Cette
// fonction détecte juste les FRANCHISSEMENTS de palier (jamais les régressions) autour d'une mutation
// de relation, sur le même modèle que RealWalkSystem.js#crossedThresholds() — appelée par chaque site
// qui modifie k.relation, avant ET après la mutation.
export function checkPrepperStarMilestone(k, relationBefore) {
      const before = prepperStars(relationBefore);
      const after = prepperStars(k.relation);
      if (after > before) {
        eventBus.emit('prepper:starReached', { name: k.name, archetype: k.archetype, stars: after, relation: k.relation });
        logEvent(`🌟 ${k.name} atteint ${after} étoile${after > 1 ? 's' : ''} de confiance !`, 'good');
      }
    }

export function makePrepper(x, y, name) {
      const archetype = pickPrepperArchetype();
      return {
        x, y, name, archetype,
        relation: BALANCE.prepper.startRelationBase + Math.floor(RNG.next() * BALANCE.prepper.startRelationRandRange), // 25-40 au départ, façon relation naissante
        needs: { medical: BALANCE.prepper.startNeedBase + Math.floor(RNG.next() * BALANCE.prepper.startNeedRandRange), food: BALANCE.prepper.startNeedBase + Math.floor(RNG.next() * BALANCE.prepper.startNeedRandRange), tech: BALANCE.prepper.startNeedBase + Math.floor(RNG.next() * BALANCE.prepper.startNeedRandRange) },
        contracts: []
      };
    }

export function updatePrepperNeeds() {
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        for (const k of (d.mainKnots || [])) {
          migratePrepperKnot(k);
          for (const need of ['medical', 'food', 'tech']) {
            const mult = prepperWeatherNeedMult(d.weather, need) * timefallPrepperDemandMult(key, k.archetype, need); // V0.3.0: pic médecin/botaniste additionnel pendant le Timefall
            k.needs[need] = Math.min(100, k.needs[need] + (BALANCE.prepper.needsGrowthBase + RNG.next() * BALANCE.prepper.needsGrowthRandRange) * mult);
          }
          if (k.needs.medical >= BALANCE.prepper.needsCriticalThreshold || k.needs.food >= BALANCE.prepper.needsCriticalThreshold || k.needs.tech >= BALANCE.prepper.needsCriticalThreshold) {
            k.relation = Math.max(0, k.relation - BALANCE.prepper.needsCriticalRelationDecay);
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
          if (k.contracts.length >= BALANCE.prepper.contractMaxSimultaneous) continue; // max requêtes simultanées par prepper
          const chance = BALANCE.prepper.contractBaseChance + (k.relation >= BALANCE.prepper.contractHighRelationThreshold ? BALANCE.prepper.contractHighRelationBonusChance : 0); // relation forte = préppers plus loquaces
          if (RNG.next() > chance) continue;
          const arch = PREPPER_ARCHETYPES[k.archetype];
          const needKeys = Object.keys(k.needs).sort((a, b) => k.needs[b] - k.needs[a]);
          const urgentNeed = needKeys[0];
          const baseReward = Math.ceil((BALANCE.prepper.contractRewardBase + RNG.next() * BALANCE.prepper.contractRewardRandRange) * (1 + k.relation / BALANCE.prepper.contractRewardRelationDivisor) * RANKS[currentRankIndex()].questMult);
          k.contracts.push({
            id: `pc-${key}-${i}-${game.month}-${Math.floor(RNG.next() * 9999)}`,
            prepperIdx: i, mapKey: key, need: urgentNeed,
            flavor: `${k.name} réclame ${NEED_LABELS[urgentNeed]} d'urgence`,
            reward: baseReward, expiresMonth: game.month + BALANCE.prepper.contractExpiryBaseMonths + Math.floor(RNG.next() * BALANCE.prepper.contractExpiryRandRangeMonths),
            negotiable: RNG.next() < BALANCE.prepper.contractNegotiableChance, negotiated: false
          });
          if (key === game.currentMap) logEvent(`🗣️ ${arch.icon} ${k.name} (${arch.name}) a une requête — relation ${prepperStarsLabel(k.relation)}`, 'good');
        }
      }
    }

export function applyHermitGifts() {
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        for (const k of (d.mainKnots || [])) {
          if (k.archetype === 'hermit' && k.relation >= BALANCE.prepper.hermitGiftRelationThreshold && d.routes.has(cellKey(k.x, k.y))) {
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
        if (arch.perk === perkType && k.relation >= BALANCE.prepper.perkRelationThreshold) total += arch.perkValue;
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
        const gain = rating ? Math.max(BALANCE.prepper.relationGainMin, Math.round(rating.likes * BALANCE.prepper.relationGainLikesMult)) : BALANCE.prepper.relationGainNoRating;
        const relationBefore = k.relation;
        k.relation = Math.min(100, k.relation + gain);
        checkPrepperStarMilestone(k, relationBefore); // V1.1 — seul site où k.relation augmente dans tout le codebase (grep vérifié)
        if (quest.contractId && quest.need) {
          k.needs[quest.need] = Math.max(0, k.needs[quest.need] - (BALANCE.prepper.contractNeedFulfillBase + RNG.next() * BALANCE.prepper.contractNeedFulfillRandRange));
          k.contracts = (k.contracts || []).filter(c => c.id !== quest.contractId);
          if (isCurrent) logEvent(`🤝 ${k.name}: relation +${gain} (${prepperStarsLabel(k.relation)}), besoin comblé`, 'good');
        } else if (isCurrent) {
          logEvent(`🤝 ${k.name}: relation +${gain} (${prepperStarsLabel(k.relation)})`, 'good');
        }
      } else {
        k.relation = Math.max(0, k.relation - BALANCE.prepper.relationLossOnFailure);
        if (isCurrent) logEvent(`📉 ${k.name}: relation -${BALANCE.prepper.relationLossOnFailure} (${prepperStarsLabel(k.relation)}) — livraison ratée`, 'warn');
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
        reward: contract.reward, flavor: contract.flavor, riskCut: BALANCE.prepper.assignContractRiskCut, route,
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
      const successChance = BALANCE.prepper.negotiateBaseChance + k.relation / BALANCE.prepper.negotiateRelationDivisor;
      if (RNG.next() < successChance) {
        const bonus = Math.ceil(c.reward * (BALANCE.prepper.negotiateBonusBase + RNG.next() * BALANCE.prepper.negotiateBonusRandRange));
        c.reward += bonus;
        logEvent(`🗣️ Négociation réussie avec ${k.name}: +$${bonus} sur la requête`, 'good');
      } else {
        k.relation = Math.max(0, k.relation - BALANCE.prepper.negotiateFailRelationLoss);
        logEvent(`🗣️ ${k.name} n'apprécie pas la négociation (relation -${BALANCE.prepper.negotiateFailRelationLoss})`, 'warn');
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
      const cost = Math.ceil(BALANCE.prepper.connectKnotCostPerCell * Math.max(1, newCells.length));
      if (game.money < cost) { logEvent(`❌ Budget raccordement ($${cost})`); return; }
      game.money -= cost;
      for (const k of newCells) game.routes.add(k);
      markMapDirty();
      logEvent(`🔧 Raccordement chiral achevé → ${knot.name} (-$${cost}, ${newCells.length} cases)`);
      eventBus.emit('network:nodeConnected', { name: knot.name, mapKey: game.currentMap });
      // V1.1 — débloque RealWalk (systems/WalkSession.js#activateRealWalk) au tout premier
      // raccordement réseau réussi de la partie, jamais retiré ensuite. connectKnot() est le SEUL
      // site du codebase qui raccorde un nœud (grep vérifié) — pas besoin d'un flag "premier appel"
      // séparé, le garde `!unlocked` suffit et reste idempotent pour tous les raccordements suivants.
      if (game.progression && game.progression.realWalk && !game.progression.realWalk.unlocked) {
        game.progression.realWalk.unlocked = true;
        logEvent('👟 Mode Porteur IRL débloqué — le Réseau Chiral reconnaît vos premiers pas.', 'good');
      }
      eventBus.emit('render:request');
    }
