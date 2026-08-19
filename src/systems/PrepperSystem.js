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

// V1.4.0 — "Brumes de guerre": filtre de RENDU pur (jamais de mutation, aucun nouvel état persisté —
// même principe que systems/raid/ChiralNetworkSystem.js#revealedRoutes), réutilisé par tous les menus
// qui listent des Preppers/villes principales (ui/HUD.js#renderMainKnots/renderDashboardSynthesis,
// ui/DeliveryPlanningPanel.js). Un territoire garde ses mainKnots déjà raccordés visibles + EXACTEMENT
// LE PLUS PROCHE mainKnot non raccordé (distance euclidienne au QG actif) — jamais tous les non-
// raccordés en même temps. Entièrement dérivé de d.mainKnots/d.routes/d.branches: aucun champ
// "revealed" à sérialiser.
export function revealedMainKnots(d) {
      const knots = d.mainKnots || [];
      const connected = knots.filter(k => d.routes.has(cellKey(k.x, k.y)));
      const hidden = knots.filter(k => !d.routes.has(cellKey(k.x, k.y)));
      if (!hidden.length) return knots;
      const hq = d.branches[d.activeBranch] || d.branches[0];
      const next = hidden.reduce((a, b) => (Math.hypot(a.x - hq.x, a.y - hq.y) <= Math.hypot(b.x - hq.x, b.y - hq.y) ? a : b));
      return knots.filter(k => d.routes.has(cellKey(k.x, k.y)) || k === next);
    }

export function pickPrepperArchetype() {
      const keys = Object.keys(PREPPER_ARCHETYPES);
      return keys[Math.floor(RNG.next() * keys.length)];
    }

export function prepperStars(relation) { return Math.max(1, Math.min(BALANCE.prepper.starsMax, Math.ceil((relation || 0) / BALANCE.prepper.starsRelationDivisor))); }

// V1.5.0 — "state.world.preppers[id].stars" du brief n'existe pas (aucun namespace game.world.preppers
// dans ce codebase — game.world est un système SÉPARÉ de structures de terrain pour le Raid IRL, cf.
// systems/expedition/*). Le vrai concept d'étoiles est PAR PREPPER (prepperStars(k.relation) ci-
// dessus), jamais stocké. data/UnlockTree.js gate sur le MEILLEUR lien social atteint: le MAX des
// étoiles parmi les Preppers déjà RACCORDÉS du territoire actif — un seul ami de confiance suffit à
// vous introduire à l'atelier, pas besoin d'avoir choyé tout le monde. 0 si aucun Prepper raccordé
// (comportement de tout début de partie, avant le premier connectKnot()).
export function maxPrepperStars(mapKey) {
      const d = game.mapsData[mapKey];
      if (!d) return 0;
      const connected = (d.mainKnots || []).filter(k => d.routes.has(cellKey(k.x, k.y)));
      if (!connected.length) return 0;
      return Math.max(...connected.map(k => prepperStars(k.relation)));
    }

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
        // V1.5.0 — data/UnlockTree.js gate sur le MAX global des Preppers raccordés (maxPrepperStars
        // ci-dessus), jamais un prepper individuel: ne recalcule/émet que si CE franchissement fait
        // réellement progresser le meilleur lien social du territoire (sinon un prepper déjà en retrait
        // sur les autres franchirait un palier "pour lui" sans jamais rien débloquer de nouveau).
        const mapKey = Object.keys(game.mapsData).find(key => (game.mapsData[key].mainKnots || []).includes(k));
        if (mapKey) {
          const d = game.mapsData[mapKey];
          const connected = (d.mainKnots || []).filter(kn => d.routes.has(cellKey(kn.x, kn.y)));
          const othersMax = connected.filter(kn => kn !== k).reduce((m, kn) => Math.max(m, prepperStars(kn.relation)), 0);
          const wasConnected = d.routes.has(cellKey(k.x, k.y)); // toujours vrai ici en pratique (relation ne monte que via un contrat, qui exige déjà un raccordement), gardé explicite par prudence
          const maxBefore = wasConnected ? Math.max(othersMax, before) : othersMax;
          const maxAfter = Math.max(othersMax, after);
          if (maxAfter > maxBefore) {
            eventBus.emit('tech:planUnlocked', { stars: maxAfter, mapKey });
            logEvent(`🔬 Nouveaux plans débloqués à l'Atelier — confiance du réseau: ${maxAfter}⭐`, 'good');
          }
        }
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
