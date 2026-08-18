// AUTO-EXTRACTED MODULE: engine/DeliveryEngine.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent, runtime } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, DAYS_PER_MONTH, DIFFICULTIES, HQ, MAP_HEIGHT, MAP_WIDTH, RANKS, VEHICLE_MAINTENANCE_COST } from '../data/Balance.js';
import { CARGO_TYPES, CRISIS_FLAVORS, EVENTS, ORDER_ACTIONS, ORDER_CONTEXTS, ORDER_SUBJECTS, QUEST_OBJECTS, QUEST_REASONS, QUEST_SUBJECTS, QUEST_VERBS, RECIPES, ROUTE_TYPES, SKILLS, SQUAD_SYNERGIES, TITLES, TRAITS, VEHICLE_SPEED, cellKey, gradeLevel, pickCargoType } from '../data/Constants.js';
import { checkMuleCamps, generateCatcherEncounter } from './CombatEngine.js';
import { dominantStructure, isBTZone, isNearHostileMuleCamp, isOnRoute, loadMapData } from './MapEngine.js';
import { weatherRiskMod } from './WeatherEngine.js';
import { checkGameEnd, saveGame } from '../persistence/SaveManager.js';
import { runAutomation } from '../systems/AutomationManager.js';
import { checkSponsor, checkSubsidiaries } from '../systems/EconomySystem.js';
import { checkAsyncNetwork, collectNearbyLostCargo, isNearPCC } from '../systems/NetworkSystem.js';
import { gearEffectiveness, porterCapacity, porterResist, recordHallOfFame, rollRelic, targetPorter } from '../systems/PorterSystem.js';
import { applyHermitGifts, applyPrepperDeliveryOutcome, generatePrepperContracts, prepperPerkBonus, updatePrepperNeeds } from '../systems/PrepperSystem.js';
import { applyUrgentQuestOutcome, clearExpiredUrgentQuests, tickUrgentQuestSpawns } from '../systems/QuestSystem.js';
import { reportConvoyMemberOutcome } from '../systems/ConvoySystem.js';
import { checkBBPodProximityWarning, tickBBPodDaily } from '../systems/BBPodSystem.js';
import { maybeLogTelemetryLine } from '../systems/NarrativeLogEngine.js';
import { triggerBeachSequence } from '../systems/TheBeachEngine.js';
import { tickChiralTraceDaily } from '../systems/ChiralTraceSystem.js';
import { historicRouteMuleAttentionAdd, historicRouteRewardMult, recordRouteUsage, tickWorldAgingMonthly } from '../systems/WorldAgingSystem.js';
import { tickMemoryStormCycle } from '../systems/MemoryStormCycle.js';
import { checkLeaguePromotion, generateVipContract } from '../systems/PorterLeague.js';
import { acquiredTraitStressMult, applyPsychologyDailyEffects, doomsDetectionMult, recordJournalEntry } from '../systems/PorterStorySystem.js';
import { regionalNetworkRewardMult, regionalNetworkRiskCut } from '../systems/RegionalNetwork.js';
import { realWalkSpeedBonusMult } from '../systems/RealWalkSystem.js';
import { applyAdvancedShelterRepairs } from '../systems/ShelterSystem.js';
import { timefallSpeedMult } from '../systems/TimefallSystem.js';
import { tickWeatherSystem } from '../systems/WeatherSystem.js';
import { markMapDirty } from '../ui/MapRenderer.js';

export function overloadRatio(p, cargo) {
      return cargo.mass / porterCapacity(p);
    }

export function deliveryRating(condition) {
      const B = BALANCE.delivery;
      if (condition >= B.ratingSGradeThreshold) return { grade: 'S', likes: B.ratingSLikes };
      if (condition >= B.ratingAGradeThreshold) return { grade: 'A', likes: B.ratingALikes };
      if (condition >= B.ratingBGradeThreshold) return { grade: 'B', likes: B.ratingBLikes };
      return { grade: 'C', likes: B.ratingCLikes };
    }

export function triggerVoidout(x, y) {
      eventBus.emit('sfx:drum', 'heavy'); // néantisation: impact lourd
      const key = cellKey(x, y);
      game.voidouts.push({ x, y, start: performance.now() });

      // La carte se modifie durablement: cratère permanent
      game.craters.add(key);
      markMapDirty();

      // Le réseau chiral est détruit à cet endroit (sauf HQ, protégé)
      if (key !== cellKey(HQ.x, HQ.y) && game.routes.has(key)) {
        game.routes.delete(key);
        logEvent(`🕳️ Réseau chiral rompu en (${x},${y})`);
      }

      // La zone devient durablement corrompue (BT permanent)
      if (!game.btZones.includes(key)) game.btZones.push(key);

      // Canon: chiralium libéré par la néantisation cristallise sur site — récupérable
      const crystalBonus = BALANCE.delivery.voidoutCrystalBonusBase + Math.floor(game.reputation * BALANCE.delivery.voidoutCrystalBonusRepMult);
      game.money += crystalBonus;
      logEvent(`💎 Chiral Crystals récupérés sur site: +$${crystalBonus}`);

      eventBus.emit('voidout:banner');
    }

export function sampleBTExposure(x0, y0, x1, y1) {
      let count = 0;
      const samples = 5;
      for (let i = 1; i <= samples; i++) {
        const t = i / (samples + 1);
        const sx = Math.round(x0 + (x1 - x0) * t);
        const sy = Math.round(y0 + (y1 - y0) * t);
        if (isBTZone(sx, sy)) count++;
      }
      return count;
    }

export function buildRoute() {
      const cost = Math.ceil(BALANCE.delivery.buildRouteBaseCost * (1 + game.routes.size * BALANCE.delivery.buildRouteCostPerRouteCell)); // scale avec taille réseau
      if (game.money < cost) { logEvent(`❌ Budget ($${cost})`); return; }
      // Étend depuis une cellule déjà connectée vers une voisine non connectée
      // Les cratères sont infranchissables: le réseau doit les contourner
      const connected = Array.from(game.routes);
      const candidates = [];
      let blockedByCrater = 0;
      for (let key of connected) {
        const [cx, cy] = key.split(',').map(Number);
        for (let [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
          const nkey = cellKey(nx, ny);
          if (game.routes.has(nkey)) continue;
          if (game.craters.has(nkey)) { blockedByCrater++; continue; }
          candidates.push(nkey);
        }
      }
      if (candidates.length === 0) {
        logEvent(blockedByCrater > 0 ? "❌ Cratères bloquent l'extension — réseau encerclé" : "❌ Réseau complet");
        return;
      }
      game.money -= cost;
      const pick = candidates[Math.floor(RNG.next() * candidates.length)];
      game.routes.add(pick);
      logEvent(`🛣️ Route → (${pick}) (-$${cost})`);
      eventBus.emit('render:request');
    }

export function generateQuestFlavor() {
      const subj = QUEST_SUBJECTS[Math.floor(RNG.next() * QUEST_SUBJECTS.length)];
      const verb = QUEST_VERBS[Math.floor(RNG.next() * QUEST_VERBS.length)];
      const obj = QUEST_OBJECTS[Math.floor(RNG.next() * QUEST_OBJECTS.length)];
      const reason = QUEST_REASONS[Math.floor(RNG.next() * QUEST_REASONS.length)];
      return `${subj} ${verb} ${obj}${reason ? ' ' + reason : ''}`;
    }

export function generateSpecialOrderFlavor() {
      const subj = ORDER_SUBJECTS[Math.floor(RNG.next() * ORDER_SUBJECTS.length)];
      const action = ORDER_ACTIONS[Math.floor(RNG.next() * ORDER_ACTIONS.length)];
      const ctx = ORDER_CONTEXTS[Math.floor(RNG.next() * ORDER_CONTEXTS.length)];
      return `${subj} ${action} ${ctx}`;
    }

export function generateSpecialOrder() {
      const B = BALANCE.delivery;
      const d = game.mapsData[game.currentMap];
      if (!d.sideQuests) d.sideQuests = [];
      if (d.sideQuests.some(q => q.special)) return; // un seul ordre spécial actif à la fois
      if (currentRankIndex() < B.specialOrderMinRank || RNG.next() > B.specialOrderSpawnChance) return;
      const x = Math.floor(RNG.next() * MAP_WIDTH), y = Math.floor(RNG.next() * MAP_HEIGHT);
      const reward = Math.ceil((B.specialOrderRewardBase + RNG.next() * B.specialOrderRewardRandRange) * RANKS[currentRankIndex()].questMult * (festivalValue('questMult') || 1));
      d.sideQuests.push({
        id: 'special-' + game.month + '-' + Math.floor(RNG.next() * 9999),
        flavor: generateSpecialOrderFlavor(),
        x, y, reward, expiresMonth: game.month + B.specialOrderExpiryMonths, special: true, minSquad: B.specialOrderMinSquad
      });
      logEvent(`⭐ ORDRE SPÉCIAL disponible (min. ${B.specialOrderMinSquad} porteurs, expire mois ${game.month + B.specialOrderExpiryMonths})`, 'good');
    }

export function generateSideQuests() {
      const B = BALANCE.delivery;
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        if (!d.sideQuests) d.sideQuests = [];
        d.sideQuests = d.sideQuests.filter(q => {
          if (game.month > q.expiresMonth) {
            if (key === game.currentMap) logEvent(`⌛ Quête annexe expirée: ${q.flavor}`, 'warn');
            return false;
          }
          return true;
        });
        const maxQuests = B.sideQuestBaseMaxQuests + Math.floor(currentRankIndex() / B.sideQuestMaxQuestsRankDivisor); // Élite+: 3 quêtes simultanées possibles
        if (d.sideQuests.length < maxQuests && RNG.next() < B.sideQuestSpawnChance) {
          const x = Math.floor(RNG.next() * MAP_WIDTH);
          const y = Math.floor(RNG.next() * MAP_HEIGHT);
          const reward = Math.ceil((B.sideQuestRewardBase + RNG.next() * B.sideQuestRewardRandRange) * (1 + game.reputation / B.sideQuestReputationDivisor) * RANKS[currentRankIndex()].questMult * (festivalValue('questMult') || 1));
          const flavor = generateQuestFlavor();
          d.sideQuests.push({
            id: `sq-${key}-${game.month}-${Math.floor(RNG.next() * 9999)}`,
            x, y, reward, flavor, expiresMonth: game.month + B.sideQuestExpiryBaseMonths + Math.floor(RNG.next() * B.sideQuestExpiryRandRangeMonths)
          });
        }
      }
    }

export function launchQuestFromUI(questId) {
      const routeEl = document.getElementById(`route-${questId}`);
      const route = routeEl ? routeEl.value : null;
      const checked = Array.from(document.querySelectorAll(`input[data-quest-squad="${questId}"]:checked`)).map(el => parseInt(el.value));
      assignQuest(questId, route, checked);
    }

export function assignQuest(questId, route, manualSquad) {
      const B = BALANCE.delivery;
      const d = game.mapsData[game.currentMap];
      const qIdx = (d.sideQuests || []).findIndex(q => q.id === questId);
      if (qIdx === -1) return;
      const quest = d.sideQuests[qIdx];
      const validIdle = p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100;
      let squad;
      if (Array.isArray(manualSquad) && manualSquad.length) {
        squad = manualSquad
          .map(id => game.porters.find(p => p.id === id))
          .filter(p => p && validIdle(p))
          .map(p => p.id);
      }
      if (!squad || !squad.length) {
        squad = game.porters.filter(validIdle).slice(0, 3).map(p => p.id);
      }
      if (squad.length === 0) { logEvent('❌ Aucun porteur disponible ici'); return; }
      if ((quest.special || quest.crisis) && squad.length < (quest.minSquad || 2)) {
        logEvent(`❌ Ordre spécial: minimum ${quest.minSquad || 2} porteurs requis`);
        return;
      }
      d.sideQuests.splice(qIdx, 1);
      if (quest.crisis && quest.chiralBonus) {
        game.materials.chiral_crystal += quest.chiralBonus;
        logEvent(`💎 Prime d'engagement: +${quest.chiralBonus} cristaux chiraux`, 'good');
      }
      const bondBonus = squadBondBonus(squad); // basé sur l'historique de raids AVANT celui-ci
      const duo = squadDuoBonus(squad);
      const synergies = activeSynergies(squad); // synergies émergentes de la composition de CETTE escouade (#Phase2)
      const synergyReward = synergies.reduce((s, syn) => s + (syn.rewardMult || 0), 0);
      const synergyRisk = synergies.reduce((s, syn) => s + (syn.riskCut || 0), 0);
      const synergyTime = synergies.reduce((s, syn) => s * (syn.timeMult || 1), 1);
      const squadBonus = 1 + (squad.length - 1) * B.squadBonusPerMember + bondBonus + duo.reward + synergyReward;
      const riskCut = Math.min(B.squadRiskCutCap, (squad.length - 1) * B.squadRiskCutPerMember) + duo.riskCut + synergyRisk; // sécurité en nombre + partenariat + synergie
      const raidId = `raid-${game.month}-${quest.id}`;
      const perPorterReward = Math.ceil((quest.reward * squadBonus) / squad.length);
      for (const pid of squad) {
        createDelivery(pid, quest.x, quest.y, { reward: perPorterReward, flavor: quest.flavor, riskCut, raidId, route, extraTimeMult: synergyTime });
      }
      recordBonds(squad);
      checkDuoFormation(squad);
      const routeTag = route && ROUTE_TYPES[route] ? ` via ${ROUTE_TYPES[route].icon} ${ROUTE_TYPES[route].name}` : '';
      const synergyTag = synergies.length ? ` — ${synergies.map(s => s.name).join(', ')}` : '';
      logEvent(`🚛 ${quest.special ? 'ORDRE SPÉCIAL' : 'RAID'} lancé (${squad.length} porteur${squad.length > 1 ? 's' : ''}${bondBonus > 0 ? `, synergie bond +${Math.round(bondBonus * 100)}%` : ''}${duo.reward > 0 ? ', 💞 duo actif' : ''})${synergyTag}${routeTag} → ${quest.flavor}`, 'good');
    }

export function generateNarrativeSummary(d, p, rating) {
      const parts = [];
      if (d.destTerrain === 'mountain') parts.push(`${p.name} a forcé l'allure à travers un relief montagneux`);
      else if (d.destTerrain === 'river') parts.push(`${p.name} a traversé une rivière à gué`);
      else parts.push(`${p.name} a rejoint la zone cible`);
      if (d.ghostName) parts.push(`une structure fantôme laissée par ${d.ghostName} lui a fait gagner du temps`);
      if (d.event && d.event.dmg) parts.push(`a dû composer avec ${d.event.name.replace(/^\S+\s/, '')}`);
      if (d.lostCargoBonus > 0) parts.push('a récupéré une cargaison perdue en chemin');
      const outcome = rating.grade === 'S' ? 'Livraison exemplaire.'
        : rating.grade === 'A' ? 'Cargaison livrée en bon état.'
        : rating.grade === 'B' ? 'Cargaison livrée, quelques dommages.'
        : 'Cargaison arrivée très abîmée.';
      return parts.join('. ') + '. ' + outcome;
    }

export function generateCrisisContract() {
      const B = BALANCE.delivery;
      const d = game.mapsData[game.currentMap];
      if (!d.sideQuests) d.sideQuests = [];
      if (d.sideQuests.some(q => q.crisis)) return; // un seul contrat de crise actif à la fois
      if (currentRankIndex() < B.crisisMinRank || RNG.next() > B.crisisSpawnChance) return;
      const x = Math.floor(RNG.next() * MAP_WIDTH), y = Math.floor(RNG.next() * MAP_HEIGHT);
      const reward = Math.ceil((B.crisisRewardBase + RNG.next() * B.crisisRewardRandRange) * RANKS[currentRankIndex()].questMult * (festivalValue('questMult') || 1));
      const chiralBonus = B.crisisChiralBonusBase + Math.floor(RNG.next() * B.crisisChiralBonusRandRange);
      d.sideQuests.push({
        id: 'crisis-' + game.month + '-' + Math.floor(RNG.next() * 9999),
        flavor: CRISIS_FLAVORS[Math.floor(RNG.next() * CRISIS_FLAVORS.length)],
        x, y, reward, expiresMonth: game.month + B.crisisExpiryMonths, crisis: true, minSquad: B.crisisMinSquad, chiralBonus
      });
      logEvent(`🌌 CONTRAT HAUTE MENACE disponible — fenêtre 1 mois, min. ${B.crisisMinSquad} porteurs, +${chiralBonus} cristaux à l'engagement`, 'warn');
    }

export function craft(recipeId) {
      if (!game.structures.cauldron) { logEvent('❌ Construisez le Chaudron chiral'); return; }
      const r = RECIPES.find(x => x.id === recipeId);
      for (const mat in r.cost) {
        if ((game.materials[mat] || 0) < r.cost[mat]) { logEvent('❌ Matériaux insuffisants'); return; }
      }
      const target = r.needsPorter ? targetPorter() : null;
      if (r.needsPorter && !target) { logEvent('❌ Aucun porteur actif'); return; }
      for (const mat in r.cost) game.materials[mat] -= r.cost[mat];
      r.effect(target);
      logEvent(`⚗️ ${r.name} synthétisé${target ? ' pour ' + target.name : ''}`, 'good');
      eventBus.emit('render:request');
    }

export function checkQuarterlyReport() {
      if (game.month % 3 !== 0) return;
      const deliveries = game.completed - game.quarterSnapshot.completed;
      const deaths = game.deaths - game.quarterSnapshot.deaths;
      const income = game.money - game.quarterSnapshot.money;
      const bestPorter = game.porters.reduce((best, p) => (!best || p.likes > best.likes) ? p : best, null);
      let report = `📰 GAZETTE BRIDGES T${Math.floor(game.month / 3)} — ${deliveries} livraisons, ${deaths} pertes, ${income >= 0 ? '+' : ''}$${income}`;
      if (bestPorter) report += ` | Porteur du trimestre: ${bestPorter.name} (❤️${bestPorter.likes})`;
      logEvent(report, 'good');
      game.quarterSnapshot = { completed: game.completed, deaths: game.deaths, money: game.money };
      for (const t of TITLES) {
        if (!game.titles.includes(t.id) && t.cond(game)) {
          game.titles.push(t.id);
          game.money += t.reward;
          logEvent(`🏆 TITRE OBTENU: ${t.name} — ${t.desc} (+$${t.reward})`, 'good');
        }
      }
    }

export function checkFestival() {
      const B = BALANCE.delivery;
      if (game.activeFestival && game.month > game.activeFestival.endMonth) {
        logEvent(`🎊 Fin: ${game.activeFestival.name}`);
        game.activeFestival = null;
      }
      if (!game.activeFestival && game.month % B.festivalMonthInterval === 0 && RNG.next() < B.festivalSpawnChance) {
        const f = runtime.activeFestivalsPool[Math.floor(RNG.next() * runtime.activeFestivalsPool.length)];
        const duration = B.festivalDurationBase + Math.floor(RNG.next() * B.festivalDurationRandRange);
        game.activeFestival = { ...f, endMonth: game.month + duration };
        logEvent(`🎉 ${f.name} démarre ! ${f.desc} (${duration} mois)`, 'good');
        if (f.effect === 'repBoost') game.reputation = Math.min(100, game.reputation + f.value);
      }
    }

export function festivalValue(effect) {
      return (game.activeFestival && game.activeFestival.effect === effect) ? game.activeFestival.value : 0;
    }

export function checkVisitor() {
      const B = BALANCE.delivery;
      if (game.visitor && game.month > game.visitor.expiresMonth) {
        logEvent(`🚶 ${game.visitor.name} est reparti (offre expirée)`);
        game.visitor = null;
      }
      if (!game.visitor && RNG.next() < B.visitorSpawnChance) {
        const o = runtime.activeVisitorOffers[Math.floor(RNG.next() * runtime.activeVisitorOffers.length)];
        game.visitor = { ...o, expiresMonth: game.month + B.visitorExpiryMonths };
        logEvent(`🧳 Un visiteur arrive au camp: ${o.name} — ${o.desc}`, 'good');
      }
    }

export function acceptVisitorOffer() {
      const v = game.visitor;
      if (!v) return;
      if (game.money < v.cost) { logEvent('❌ Budget insuffisant pour cette offre'); return; }
      game.money -= v.cost;
      v.effect();
      logEvent(`🧳 Offre acceptée: ${v.name}`, 'good');
      game.visitor = null;
      eventBus.emit('render:request');
    }

export function dismissVisitor() { game.visitor = null; eventBus.emit('render:request'); }

export function bondKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

export function squadBondBonus(squad) {
      if (squad.length < 2) return 0;
      let total = 0, pairs = 0;
      for (let i = 0; i < squad.length; i++) for (let j = i + 1; j < squad.length; j++) {
        total += Math.min(game.bonds[bondKey(squad[i], squad[j])] || 0, BALANCE.delivery.bondBonusCap) * BALANCE.delivery.bondPerRaidBonus; // +2%/raid ensemble, plafond 10
        pairs++;
      }
      return pairs ? total / pairs : 0;
    }

export function recordBonds(squad) {
      for (let i = 0; i < squad.length; i++) for (let j = i + 1; j < squad.length; j++) {
        const key = bondKey(squad[i], squad[j]);
        game.bonds[key] = (game.bonds[key] || 0) + 1;
      }
    }

export function isDuo(a, b) { return game.duos.includes(bondKey(a, b)); }

export function squadDuoBonus(squad) {
      for (let i = 0; i < squad.length; i++) for (let j = i + 1; j < squad.length; j++) {
        if (isDuo(squad[i], squad[j])) return { reward: BALANCE.delivery.duoRewardBonus, riskCut: BALANCE.delivery.duoRiskCutBonus };
      }
      return { reward: 0, riskCut: 0 };
    }

export function checkDuoFormation(squad) {
      for (let i = 0; i < squad.length; i++) for (let j = i + 1; j < squad.length; j++) {
        const key = bondKey(squad[i], squad[j]);
        if (game.bonds[key] === BALANCE.delivery.duoFormationThreshold && !game.duos.includes(key)) {
          game.duos.push(key);
          const pa = game.porters.find(p => p.id === squad[i]), pb = game.porters.find(p => p.id === squad[j]);
          logEvent(`💞 Partenariat officiel formé: ${pa ? pa.name : '?'} & ${pb ? pb.name : '?'} (+10% reward, -5% risque en duo)`, 'good');
        }
      }
    }

export function activeSynergies(squad) {
      const skills = squad.map(id => { const p = game.porters.find(x => x.id === id); return p ? p.skill : null; }).filter(Boolean);
      return SQUAD_SYNERGIES.filter(s => s.need.every(sk => skills.includes(sk)));
    }

export function checkCampEvent() {
      if (RNG.next() < BALANCE.delivery.campEventSpawnChance) {
        const e = runtime.activeCampEvents[Math.floor(RNG.next() * runtime.activeCampEvents.length)];
        e.effect();
        logEvent(e.name, 'event');
      }
    }

export function generateEvent(porter, distance, destX, destY, riskMod = 0) {
      const B = BALANCE.delivery;
      let risk = B.riskBase + (distance / B.riskDistanceDivisor) * B.riskDistanceMult + riskMod; // distance + cargo augmentent risque

      // Équipement réduit risque
      risk -= porter.equipment.scanner * B.scannerRiskMult * gearEffectiveness(porter);
      risk -= porter.equipment.exo * B.exoRiskMult;
      risk -= gradeLevel(porter, 'discretion') * B.discretionGradeRiskMult; // Porter Grade Discrétion

      // Compétence réduit risque
      risk -= (SKILLS[porter.skill].dmg || 0) * B.skillDmgRiskMult;
      risk -= (SKILLS[porter.skill].sense || 0); // DOOMS: sensibilité BT, gros bonus
      risk -= porter.equipment.cryptobiote * B.cryptobioteRiskMult;

      // Bâtiments
      risk -= (game.structures.shelter || 0) * B.shelterRiskMultPerLevel; // par niveau (paliers 1-3)

      // Zone BT double le risque, route réduit -15%
      if (isBTZone(destX, destY)) risk += B.btZoneRiskAdd;
      if (isNearHostileMuleCamp(destX, destY)) risk += B.muleCampRiskAdd; // interception par un camp MULE actif
      if (isOnRoute(destX, destY)) risk -= B.onRouteRiskCut;
      risk += historicRouteMuleAttentionAdd(porter.map, destX, destY); // V0.6.0: Route Historique — plus fréquentée, plus surveillée
      risk += weatherRiskMod(); // Timefall/Duststorm persistants: visibilité réduite (#Phase5)

      risk *= DIFFICULTIES[game.difficulty || 'normal'].riskMult;
      risk = Math.max(B.riskFloor, Math.min(B.riskCeil, risk)); // plancher 8%: jamais 100% safe

      // Tirage événement: `risk` détermine DIRECTEMENT la probabilité d'un événement négatif
      // (avant: un simple seuil à 0.3 plafonnait à 50% de bad event même au plancher — toute réduction
      // de risque au-delà de ce seuil était gaspillée. Corrigé pour que le risque compte vraiment.)
      const badEvents = EVENTS.filter(e => e.risk >= 0);
      const goodEvents = EVENTS.filter(e => e.risk < 0);
      const pool = RNG.next() < risk ? badEvents : goodEvents;
      const event = pool[Math.floor(RNG.next() * pool.length)];

      return event;
    }

export function sendDelivery(porterIdx) {
      const destX = Math.floor(RNG.next() * MAP_WIDTH);
      const destY = Math.floor(RNG.next() * MAP_HEIGHT);
      createDelivery(porterIdx, destX, destY);
    }

export function createDelivery(porterIdx, destX, destY, questOpts) {
      const B = BALANCE.delivery;
      const porter = game.porters[porterIdx];
      if (porter.status !== "idle" || porter.health <= 0) return;

      const distance = Math.hypot(destX - porter.x, destY - porter.y);

      const cargoType = (questOpts && questOpts.forceCargoType) || pickCargoType();
      const cargo = CARGO_TYPES[cargoType];

      // Calcul récompense (fixée par la quête si applicable — le cargo influence le risque/temps, pas le montant)
      let reward = questOpts ? Math.ceil(questOpts.reward * (1 + gradeLevel(porter, 'service') * B.serviceGradeRewardMult)) : Math.ceil(distance * B.rewardDistanceMult * (1 + game.reputation / B.reputationRewardDivisor) * cargo.rewardMult);
      if (porter.equipment.vehicle) reward *= B.vehicleRewardMult;
      reward = Math.ceil(reward * (1 + (game.infraInvestments || 0) * B.infraRewardMultPerInvestment)); // investissements infrastructure, permanent
      reward = Math.ceil(reward * regionalNetworkRewardMult()); // V0.5.0: bonus permanent des Super-Relais régionaux
      reward = Math.ceil(reward * historicRouteRewardMult(porter.map, destX, destY)); // V0.6.0: Route Historique (continuité du monde)

      // Surcharge: ratio masse cargo / capacité porteur — au-delà de 0.9 ça pénalise risque + vitesse (canon: balance/stamina DS)
      const overload = overloadRatio(porter, cargo);
      const overloadRiskMod = overload > B.overloadThreshold ? (overload - B.overloadThreshold) * B.overloadRiskMult : 0;

      const onRoute = isOnRoute(destX, destY);
      const campRiskCut = dominantStructure() === 'shelter' ? B.shelterDominantRiskCut : 0;
      const route = ROUTE_TYPES[(questOpts && questOpts.route)] || null;
      const event = generateEvent(porter, distance, destX, destY, cargo.riskMod + overloadRiskMod - (questOpts && questOpts.riskCut || 0) - festivalValue('riskCut') - campRiskCut + (route ? route.riskMod : 0) - regionalNetworkRiskCut()); // riskCut: raid + festival + spécialité camp + itinéraire + V0.5.0 Super-Relais
      let timeMultiplier = (porter.equipment.vehicle ? VEHICLE_SPEED[porter.equipment.vehicle] : 1) * cargo.timeMult * (route ? route.timeMult : 1) * ((questOpts && questOpts.extraTimeMult) || 1);
      if (onRoute) timeMultiplier *= Math.max(B.onRouteTimeFloor, B.onRouteTimeBase - gradeLevel(porter, 'reseau') * B.onRouteReseauGradeMult) * (1 - (game.structures.zipline || 0) * B.ziplineStructureTimeMultPerLevel) * (dominantStructure() === 'zipline' ? B.ziplineDominantTimeMult : 1) * (isNearPCC(destX, destY, 'zipline') ? B.ziplinePccTimeMult : 1); // -30% temps + Porter Grade Réseau + zipline + spécialité camp + tyrolienne PCC
      // Cargo lourd sans véhicule: pénalité de temps supplémentaire
      if (cargoType === 'heavy' && !porter.equipment.vehicle) timeMultiplier *= B.heavyCargoNoVehicleTimeMult;
      if (overload > B.overloadThreshold) timeMultiplier *= 1 + (overload - B.overloadThreshold) * B.overloadTimeMult; // surcharge ralentit
      timeMultiplier *= TRAITS[porter.trait].time_mult || 1; // trait Lève-tôt etc.
      timeMultiplier *= realWalkSpeedBonusMult(); // V0.8.0: bonus IRL — fonction pure de game.totalSteps, jamais du temps réel

      // Terrain canon: relief accidenté ralentit (véhicule inefficace en montagne/rivière)
      const destTerrain = game.terrain[cellKey(destX, destY)];
      // Ancre chirale (rang 2): atténue de moitié la pénalité de relief accidenté
      const terrainMit = porter.equipment.climbing_anchor ? B.terrainAnchorMitigation : 1;
      if (destTerrain === 'mountain') timeMultiplier *= 1 + B.mountainTimeMult * terrainMit;
      if (destTerrain === 'river' && !isNearPCC(destX, destY, 'bridge')) timeMultiplier *= 1 + B.riverTimeMult * terrainMit;
      timeMultiplier *= timefallSpeedMult(porter.map, destX, destY); // V0.3.0: Timefall ralentit les porteurs non abrités

      // Réseau asynchrone: cargaison perdue récupérée au passage + structure fantôme empruntée (pour le récit)
      const lostCargoBonus = collectNearbyLostCargo(destX, destY);
      reward += lostCargoBonus;
      const ghostPCC = (game.pccInstalls || []).find(p => p.ghost && Math.hypot(p.x - destX, p.y - destY) <= B.ghostPccProximityRadius);

      const delivery = {
        porter: porterIdx,
        map: porter.map,
        destX, destY, distance,
        progress: 0,
        onRoute,
        cargoType,
        condition: 100, // état du cargo à l'arrivée -> note S/A/B/C (#1)
        btExposure: sampleBTExposure(porter.x, porter.y, destX, destY), // 0-5 cellules BT sur le trajet
        detection: 0, spotted: false, // jauge de détection progressive (#B)
        quest: questOpts ? { flavor: questOpts.flavor, prepperIdx: questOpts.prepperIdx, mapKey: questOpts.mapKey, contractId: questOpts.contractId, need: questOpts.need, urgentQuestId: questOpts.urgentQuestId, zeroDamage: questOpts.zeroDamage, icon: questOpts.icon, convoyId: questOpts.convoyId } : null,
        raidId: (questOpts && questOpts.raidId) || null,
        dmgMult: (questOpts && questOpts.dmgMult) || 1, // V0.4.0: stratégie de convoi "Sécurisé" (moins de dégâts)
        gearWearMult: (questOpts && questOpts.gearWearMult) || 1, // V0.4.0: stratégie de convoi "Rapide" (+usure)
        routeType: (questOpts && questOpts.route) || null, // V0.4.0: TelemetrySystem (rendement par type d'itinéraire)
        destTerrain, lostCargoBonus, ghostName: ghostPCC ? ghostPCC.ghostName : null, // contexte pour le récit émergent
        maxSteps: Math.ceil(distance * B.maxStepsDistanceMult * timeMultiplier),
        reward,
        timeRemaining: Math.max(1, Math.ceil(distance * B.maxStepsDistanceMult * timeMultiplier)),
        event,
        started: false
      };

      game.deliveries.push(delivery);
      porter.status = "en route";
      // Raid: un seul log groupé déjà émis par assignQuest(). Vie de camp (livraison routinière): silencieuse en arrière-plan.
      if (questOpts && !questOpts.raidId) {
        logEvent(`🗒️ ${cargo.name} ${porter.name} → quête annexe (${destX},${destY}) +$${reward}`);
      }
      if (lostCargoBonus > 0) logEvent(`📦 ${porter.name} a récupéré une cargaison perdue en chemin (+$${lostCargoBonus})`, 'good');
      eventBus.emit('render:request');
    }

export function tick() {
      const B = BALANCE.delivery;
      for (let d of game.deliveries) {
        // Assure que les mutations (cratères, routes) touchent la carte de CETTE livraison
        if (d.map && game.currentMap !== d.map) loadMapData(d.map);
        d.timeRemaining--;
        if (d.timeRemaining > 0) maybeLogTelemetryLine(game.porters[d.porter], d); // V0.6.0: télémétrie littéraire

        // Événement au premier tick
        if (!d.started) {
          d.started = true;
          const p = game.porters[d.porter];
          const evt = d.event;
          const verbose = !!d.quest; // seuls les raids/quêtes (grosses sorties) détaillent le log — le reste est vie de camp en arrière-plan
          if (verbose) logEvent(`${evt.name} sur ${p.name}`, 'event');

          // Appliquer dégâts
          if (evt.dmg) {
            const dmg = typeof evt.dmg === 'object'
              ? evt.dmg[0] + RNG.next() * (evt.dmg[1] - evt.dmg[0])
              : evt.dmg;
            const resistTotal = porterResist(p);
            let actualDmg = dmg * (1 - resistTotal);
            if (p.equipment.exo) actualDmg *= 1 - 0.3 * gearEffectiveness(p);
            p.gearWear = Math.min(100, (p.gearWear || 0) + (B.tickGearWearBase + Math.floor(RNG.next() * B.tickGearWearRandRange)) * (d.gearWearMult || 1)); // usure normale par livraison (V0.4.0: stratégie de convoi)
            // Bola gun: arme canon anti-BT/MULEs, inefficace contre tempête/corrosion
            if (p.equipment.bolagun && (evt.id === 'bt' || evt.id === 'ambush')) actualDmg *= B.bolagunDmgMult;
            // Cargo lourd: surcharge, dégâts amplifiés sans exo
            if (d.cargoType === 'heavy' && !p.equipment.exo) actualDmg *= B.heavyCargoDmgMult;
            actualDmg *= d.dmgMult || 1; // V0.4.0: stratégie de convoi "Sécurisé"
            p.health -= actualDmg;
            if (verbose) logEvent(`  💔 -${Math.ceil(actualDmg)} HP (${Math.ceil(p.health)}/100)`);
            if (d.quest && d.quest.convoyId && (evt.id === 'bt' || evt.id === 'ambush')) eventBus.emit('convoy:attacked', { convoyId: d.quest.convoyId, porterId: p.id, dmg: actualDmg });

            // Condition du cargo dégradée par l'événement (base de la note de livraison, #1)
            d.condition = Math.max(0, d.condition - Math.ceil(actualDmg * B.conditionDmgMult));

            // Butin pour le Chaudron: survivre à un BT/MULE a une chance de laisser du matériau récupérable
            if (p.health > 0) {
              const lootBonus = (dominantStructure() === 'cauldron' ? 1.1 : 1) * (1 + prepperPerkBonus('materialBonus'));
              if (evt.id === 'bt' && RNG.next() < B.btLootChance * lootBonus) { game.materials.chiral_crystal++; if (verbose) logEvent('  🔮 +1 Cristal chiral récupéré'); }
              if (evt.id === 'ambush' && RNG.next() < B.ambushLootChance * lootBonus) { game.materials.mule_scrap++; if (verbose) logEvent('  🔧 +1 Ferraille MULE récupérée'); }
              if (evt.id === 'bt' || evt.id === 'ambush') rollRelic(); // toujours loggée si trouvée, même en vie de camp
            }

            // Cargo fragile: casse partielle sur mauvais événement (caisse réfrigérée + assurance protègent)
            if (d.cargoType === 'fragile') {
              const insuranceMit = 1 - (game.structures.insurance || 0) * B.fragileInsuranceMitPerLevel; // -15%/niveau de casse en plus
              const shield = (p.equipment.cryobox ? B.fragileCryoboxShield : 1) * insuranceMit;
              const loss = Math.ceil(d.reward * B.fragileLossMult * shield);
              d.reward -= loss;
              d.condition = Math.max(0, d.condition - Math.ceil(B.fragileConditionLoss * shield));
              if (verbose) logEvent(p.equipment.cryobox
                ? `  🧊❄️ caisse réfrigérée a limité la casse (-$${loss})`
                : `  🧊💥 cargo fragile endommagé (-$${loss} sur la prime)`);
            }
            // Cargo urgent: deadline dure — sans assurance, prime annulée; avec, une partie est sauvée (25/50/75%/niveau)
            if (d.cargoType === 'urgent') {
              d.reward = Math.ceil(d.reward * (game.structures.insurance || 0) * B.urgentInsuranceRewardMult);
              d.cargoFailed = true;
              d.condition = 0;
              if (verbose) logEvent(game.structures.insurance
                ? `  ⏱️🛡️ deadline dépassée — assurance a sauvé $${d.reward} de la prime`
                : `  ⏱️❌ DEADLINE DÉPASSÉE — cargo urgent perdu, prime annulée`);
            }
          }

          // Stress (Cryptobiotes canon: atténuent les effets de la Frappe Temporelle; trait Nerveux amplifie)
          p.stress += Math.max(0, evt.stress - p.equipment.cryptobiote * B.cryptobioteStressMitPerUnit) * (TRAITS[p.trait].stress_mult || 1) * acquiredTraitStressMult(p); // V0.5.0: Traits Acquis (journal de bord)
          if (evt.reward) d.reward += evt.reward;
          d.reward = Math.max(0, d.reward);

          // MULEs canon: volent une pièce d'équipement en plus du cargo
          if (evt.id === 'ambush') {
            const stolen = ['boots', 'exo', 'scanner'].find(t => p.equipment[t] > 0);
            if (stolen) {
              p.equipment[stolen]--;
              if (verbose) logEvent(`  🏴 MULEs ont volé: ${stolen}`);
            }
          }
        }

        if (d.btExposure > 0 && d.timeRemaining > 0) checkBBPodProximityWarning(d); // V0.6.0: alerte proactive du BB Pod

        // Détection BT progressive: le scanner ralentit la montée, un repérage déclenche une 2e vague (indépendante de l'event initial)
        if (d.btExposure > 0 && !d.spotted && d.timeRemaining > 0) {
          const p2 = game.porters[d.porter];
          const scannerLvl = p2.equipment.scanner || 0;
          const detectRate = d.btExposure * B.detectionRatePerExposure * (1 - scannerLvl * B.detectionScannerMult - gradeLevel(p2, 'discretion') * B.detectionDiscretionGradeMult) * doomsDetectionMult(p2); // V0.5.0: niveau DOOMS procédural
          d.detection += Math.max(1, detectRate);
          if (d.detection >= B.detectionThreshold && p2.health > 0) {
            d.spotted = true;
            eventBus.emit('combat:btDetected', { porterId: p2.id }); // V0.3.0: SoundEngine bascule en alerte
            const dmg2 = B.detectionDmgBase + RNG.next() * B.detectionDmgRandRange;
            const actualDmg2 = dmg2 * (1 - porterResist(p2)) * (p2.equipment.exo ? B.detectionExoMult : 1);
            p2.health -= actualDmg2;
            d.condition = Math.max(0, d.condition - Math.ceil(actualDmg2 * B.detectionConditionMult));
            if (d.quest) logEvent(`  👁️ ${p2.name} repéré par un BT en approche ! -${Math.ceil(actualDmg2)} HP (${Math.ceil(p2.health)}/100)`, 'warn');
          }
        }

        if (d.timeRemaining <= 0) {
          const p = game.porters[d.porter];

          // Mort check
          if (p.health <= 0) {
            game.deaths++;
            game.reputation = Math.max(0, game.reputation - B.deathReputationLoss);
            logEvent(`💀 NÉANTISATION — ${p.name} a rejoint le rivage`, 'death');
            triggerVoidout(p.x, p.y);
            recordHallOfFame(p, 'néantisé');
            triggerBeachSequence(p, 'néantisé'); // V0.6.0: séquence de la Plage, ne ramène jamais le porteur
            applyPrepperDeliveryOutcome(d.quest, false, null);
            applyUrgentQuestOutcome(d.quest, false, null);
            reportConvoyMemberOutcome(d.quest, false);
            eventBus.emit('delivery:resolved', { reward: 0, onRoute: d.onRoute, routeType: d.routeType, success: false, porterId: p.id, cause: 'death' });
            if (d.btExposure > 0) recordJournalEntry(p, 'bt_encounter'); // V0.5.0
            p.status = "dead";
            continue;
          }

          // Succès
          p.x = d.destX;
          p.y = d.destY;
          p.stress = Math.max(0, p.stress - B.successStressRecover);
          p.health = Math.min(100, p.health + B.successHealthRecover);

          if (d.cargoFailed) {
            // Livraison urgente ratée: le porteur arrive mais rien n'est payé
            p.xp += B.cargoFailedXpGain;
            game.reputation = Math.max(0, game.reputation - B.cargoFailedReputationLoss);
            if (d.quest) logEvent(`❌ ${p.name} arrive — cargo urgent invalidé, aucune prime`, 'warn');
            applyPrepperDeliveryOutcome(d.quest, false, null);
            applyUrgentQuestOutcome(d.quest, false, null);
            reportConvoyMemberOutcome(d.quest, false);
            eventBus.emit('delivery:resolved', { reward: 0, onRoute: d.onRoute, routeType: d.routeType, success: false, porterId: p.id, cause: 'cargoFailed' });
            p.status = "idle";
            continue;
          }

          let xpGain = B.xpGainBase + Math.floor(RNG.next() * B.xpGainRandRange);
          if (game.structures.training) xpGain *= 1 + (game.structures.training || 0) * B.trainingXpMultPerLevel; // par niveau (paliers 1-3)
          if (dominantStructure() === 'training') xpGain *= B.trainingDominantXpMult; // spécialité du camp
          xpGain *= 1 + (game.legacyBonus || 0); // héritage des porteurs retraités
          if (d.onRoute) xpGain *= B.onRouteXpMult;
          if (p.stress > B.highStressThreshold) xpGain *= B.highStressXpMult; // stress élevé = -20% XP
          xpGain *= TRAITS[p.trait].xp_mult || 1;
          p.xp += xpGain;

          // Note de livraison (condition cargo à l'arrivée) → likes, canon DS Porter Grade (#1)
          const rating = deliveryRating(d.condition);
          applyPrepperDeliveryOutcome(d.quest, true, rating);
          // Quête "zéro-dommage" (ex: le Médecin): tout dégât en chemin invalide la réussite côté loyauté,
          // même si la livraison en elle-même est un succès normal (prime/XP/likes inchangés).
          applyUrgentQuestOutcome(d.quest, !(d.quest && d.quest.zeroDamage && d.condition < 100), rating);
          reportConvoyMemberOutcome(d.quest, true);
          eventBus.emit('delivery:resolved', { reward: d.reward, onRoute: d.onRoute, routeType: d.routeType, success: true, porterId: p.id, cause: 'success', grade: rating.grade, destX: d.destX, destY: d.destY, mapKey: d.map });
          if (d.onRoute) recordRouteUsage(d.map, d.destX, d.destY); // V0.6.0: la mémoire du trajet grandit avec l'usage
          // V0.5.0 — Journal de bord: ne retient que les faits marquants (jamais les livraisons routinières)
          if (rating.grade === 'S') recordJournalEntry(p, 'perfect_delivery');
          if (d.raidId || (d.quest && d.quest.convoyId)) recordJournalEntry(p, 'raid_survived');
          if (d.btExposure > 0) recordJournalEntry(p, 'bt_encounter');
          { const wd = game.mapsData[d.map]; if (wd && wd.weather && (wd.weather.type === 'timefall' || wd.weather.type === 'duststorm')) recordJournalEntry(p, 'timefall_survived'); }
          p.likes += rating.likes;
          if (rating.grade === 'S') game.reputation = Math.min(100, game.reputation + B.sRankReputationGain); // bonus S-rank

          // Porter Grade: catégorie déterminée par le contexte de la livraison (canon DS2, 5 catégories)
          let category = 'portage';
          if (d.quest) category = 'service';
          else if (d.event && (d.event.id === 'bt' || d.event.id === 'ambush')) category = 'combat';
          else if (d.event && (d.event.id === 'safe' || d.event.id === 'shelter_found')) category = 'discretion';
          else if (d.onRoute) category = 'reseau';
          p.grades[category] += rating.likes;

          game.money += d.reward;
          game.completed++;
          game.reputation = Math.min(100, game.reputation + B.deliveryReputationGain);

          if (d.quest) {
            if (rating.grade === 'S') eventBus.emit('sfx:brass', 0.5);
            logEvent(`🗒️✅ ${d.quest.flavor} [${rating.grade}] — ${generateNarrativeSummary(d, p, rating)} (+$${d.reward} +${rating.likes}❤️)`, 'good');
          }
          else if (rating.grade === 'S') logEvent(`✅ ${p.name} livraison exemplaire [S]! +$${d.reward} +${rating.likes}❤️`, 'good');
          // sinon: livraison routinière — vie de camp en arrière-plan, pas de log (évite le spam)

          if (p.xp >= p.level * B.levelUpXpPerLevel) {
            p.level++;
            p.salary += B.levelUpSalaryIncrease;
            logEvent(`⭐ ${p.name} → Level ${p.level}`);
          }

          p.status = "idle";
        }
      }
      game.deliveries = game.deliveries.filter(d => d.timeRemaining > 0);
    }

export function startMonthBookkeeping() {
      const B = BALANCE.delivery;
      eventBus.emit('sfx:drum', 'impact'); // marque le passage du mois, façon Woodkid
      game.monthState.viewMap = game.currentMap;
      game.monthState.moneyBeforeOps = game.money;

      // Salaires: licencie les plus chers si impayable, au lieu de freeze le jeu
      let active = game.porters.filter(p => p.status !== "dead" && p.status !== "left");
      active.sort((a, b) => b.salary - a.salary);
      let salary_cost = active.reduce((s, p) => s + p.salary, 0);

      while (game.money < salary_cost && active.length > 0) {
        const fired = active.shift();
        fired.status = "left";
        recordHallOfFame(fired, 'licencié (budget)');
        game.reputation = Math.max(0, game.reputation - B.firingReputationLoss);
        logEvent(`📉 ${fired.name} licencié (budget insuffisant)`);
        salary_cost = active.reduce((s, p) => s + p.salary, 0);
      }
      game.money -= salary_cost;
      if (salary_cost > 0) logEvent(`💸 Salaires -$${salary_cost}`);
      game.monthState.salaryCost = salary_cost;

      // Maintenance véhicules: coût mensuel selon le type possédé (puits économique tardif)
      const vehicleCost = game.porters.reduce((s, p) => {
        if (p.status === 'dead' || p.status === 'left' || !p.equipment.vehicle) return s;
        return s + (VEHICLE_MAINTENANCE_COST[p.equipment.vehicle] || 0);
      }, 0);
      if (vehicleCost > 0) {
        game.money = Math.max(0, game.money - vehicleCost);
        logEvent(`🔧 Maintenance véhicules -$${vehicleCost}`);
      }

      game.month++;
      generateSideQuests();
      generateSpecialOrder();
      generateCatcherEncounter();
      generateCrisisContract();
      checkAsyncNetwork();
    }

export function endMonthBookkeeping() {
      const B = BALANCE.delivery;
      checkQuarterlyReport();
      checkFestival();
      checkVisitor();
      checkCampEvent();
      checkSponsor();
      checkMuleCamps();
      checkSubsidiaries();
      updatePrepperNeeds();
      generatePrepperContracts();
      applyHermitGifts();
      runAutomation();
      tickWorldAgingMonthly(); // V0.6.0: usure écosystémique progressive de toute l'infrastructure posée

      // Récupération santé (réduite: repos forcé devient un vrai outil, pas juste attendre)
      for (let p of game.porters) {
        if (p.status === "idle" && p.health < 100) p.health = Math.min(100, p.health + B.idleHealRate + prepperPerkBonus('fastHeal'));
      }

      // V0.3.0: la météo est désormais gérée quotidiennement par territoire (WeatherSystem.tickWeatherSystem(),
      // appelée depuis advanceDay()) — remplace l'ancien tirage mensuel unique ci-dessus.

      // Bilan de mois: feedback net clair (revenus livraisons vs salaires)
      const netChange = game.money - game.monthState.moneyBeforeOps;
      const income = netChange + game.monthState.salaryCost;
      const netStr = netChange >= 0 ? `+$${netChange}` : `-$${Math.abs(netChange)}`;
      logEvent(`📊 BILAN — revenus +$${Math.max(0, income)} / salaires -$${game.monthState.salaryCost} = ${netStr}`, netChange >= 0 ? 'good' : 'warn');

      if (!game.gameEnded) saveGame(true); // autosave silencieux à chaque mois complété
    }

export function advanceDay() {
      if (game.gameEnded) return;
      const viewMap = game.currentMap; // la carte que le joueur regarde — restaurée à la fin du jour

      if (game.dayInMonth === 0) startMonthBookkeeping();

      // Auto-dispatch façon Dungeon Village 2: un porteur idle en état de partir repart seul
      for (let i = 0; i < game.porters.length; i++) {
        const p = game.porters[i];
        if (p.status === "idle" && p.health > 15 && (p.gearWear || 0) < 100) {
          if (game.currentMap !== p.map) loadMapData(p.map);
          sendDelivery(i);
        }
      }
      tick();
      tickWeatherSystem(); // V0.3.0: météo dynamique par territoire + avance du Chiral Forecast, tous les jours
      tickUrgentQuestSpawns(); // V0.3.0: chance quotidienne de quête urgente indépendante de la météo (réputation)
      clearExpiredUrgentQuests();
      applyAdvancedShelterRepairs(); // V0.4.0: réparation auto véhicules/convois près d'un Abri Chiral Avancé
      applyPsychologyDailyEffects(); // V0.5.0: phobie/joie procédurales (stress quotidien)
      tickBBPodDaily(); // V0.6.0: repos quotidien du BB Pod
      tickChiralTraceDaily(); // V0.6.0: Traces de Gratitude du réseau fantôme → Mémoire Chirale + Pèlerins
      checkLeaguePromotion(); // V0.5.0: promotion de Ligue Porteurs
      generateVipContract(); // V0.5.0: contrat VIP sponsor de prestige (Ligue Or+)

      game.dayInMonth++;
      if (game.dayInMonth >= DAYS_PER_MONTH) {
        game.dayInMonth = 0;
        endMonthBookkeeping();
      }

      loadMapData(viewMap); // reviens à la carte que le joueur regardait
      tickMemoryStormCycle(); // V0.6.0: cycle de 12 jours (avertissement J-3 + résolution), couverture réseau de la carte visualisée
      checkGameEnd();
      eventBus.emit('render:request');
    }
