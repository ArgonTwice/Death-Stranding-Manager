// AUTO-EXTRACTED MODULE: persistence/SaveManager.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { debugLog } from '../core/Debug.js';
import { currentRankIndex, game, logEvent, runtime } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { DIFFICULTIES, GAME_LENGTH_MONTHS, HQ, RANKS } from '../data/Balance.js';
import { CAMP_EVENTS, FESTIVALS, RELICS, VISITOR_OFFERS, pickN, rollTrait } from '../data/Constants.js';
import { generateBTZones, generateMainKnots, generateMuleCamps, generateTerrain, loadMapData } from '../engine/MapEngine.js';
import { render } from '../ui/HUD.js';

export function computeScore() {
      const totalRoutes = Object.values(game.mapsData).reduce((s, d) => s + d.routes.size, 0);
      const unlockedCountries = Object.keys(game.mapsData).length;
      const totalLikes = game.porters.reduce((s, p) => s + (p.likes || 0), 0);
      return Math.max(0, Math.round(
        game.money / 10 + game.completed * 25 + game.reputation * 15
        - game.deaths * 80 + totalRoutes * 5 + unlockedCountries * 400 + totalLikes * 2 + currentRankIndex() * 300 + (game.infraInvestments || 0) * 50
      ));
    }

export const SCORES_KEY = 'ds-manager-scores';

export async function loadScores() {
      try {
        let raw = null;
        if (window.storage) { const r = await window.storage.get(SCORES_KEY); raw = r ? r.value : null; }
        else raw = localStorage.getItem(SCORES_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }

export async function saveScores(list) {
      const data = JSON.stringify(list);
      try { if (window.storage) await window.storage.set(SCORES_KEY, data); else localStorage.setItem(SCORES_KEY, data); }
      catch (e) { try { localStorage.setItem(SCORES_KEY, data); } catch (e2) {} }
    }

export async function recordScore(score) {
      let list = await loadScores();
      list.push({ score, money: game.money, completed: game.completed, deaths: game.deaths, date: new Date().toISOString().slice(0, 10) });
      list.sort((a, b) => b.score - a.score);
      list = list.slice(0, 10);
      await saveScores(list);
      return list;
    }

export function startNewGamePlus() {
      const carryLegacy = Math.round((game.legacyBonus || 0) * 50) / 100; // 50% de l'héritage XP reporté
      const carryCollection = [...game.collection];
      const carryTitles = [...game.titles];
      const bonusCash = Math.min(5000, Math.round(computeScore() / 10));
      newGame(false);
      game.ngPlus = true; // débloque le x2 pour cette run
      game.legacyBonus = carryLegacy;
      game.collection = carryCollection;
      game.titles = carryTitles;
      game.money += bonusCash;
      logEvent(`✨ NOUVELLE PARTIE+ — héritage conservé: +${Math.round(carryLegacy * 100)}% XP, ${carryCollection.length} reliques, ${carryTitles.length} titres, +$${bonusCash} de départ`, 'good');
      eventBus.emit('render:request');
      saveGame(true);
    }

export async function checkGameEnd() {
      if (game.gameEnded || game.month <= GAME_LENGTH_MONTHS) return;
      game.gameEnded = true;
      const score = computeScore();
      logEvent(`🏁 CONTRAT BRIDGES TERMINÉ — Score final: ${score}`, 'good');
      const list = await recordScore(score);
      eventBus.emit('game:ended', { score, list });
      saveGame(true); // persiste game.gameEnded immédiatement (sinon: rechargement = 1 jour de drift + score ré-enregistré)
    }

export const SAVE_KEY_LEGACY = 'ds-manager-save';

export const SAVE_KEY_PREFIX = 'ds-manager-save-slot';

export function saveKeyFor(slot) { return SAVE_KEY_PREFIX + slot; }

export async function storageGet(key) {
      try {
        if (window.storage) { const r = await window.storage.get(key); return r ? r.value : null; }
        return localStorage.getItem(key);
      } catch (e) { try { return localStorage.getItem(key); } catch (e2) { return null; } }
    }

export async function storageSet(key, value) {
      try { if (window.storage) await window.storage.set(key, value); else localStorage.setItem(key, value); }
      catch (e) { try { localStorage.setItem(key, value); } catch (e2) { throw e2; } }
    }

export async function storageDelete(key) {
      try { if (window.storage) await window.storage.delete(key); } catch (e) {}
      try { localStorage.removeItem(key); } catch (e) {}
    }

export async function peekSlot(slot) {
      let raw = await storageGet(saveKeyFor(slot));
      if (!raw && slot === 1) raw = await storageGet(SAVE_KEY_LEGACY); // migration douce de l'ancienne save unique
      if (!raw) return null;
      try {
        const s = JSON.parse(raw);
        const rankNames = ['Freelance', 'Porteur Bridges', 'Porteur Certifié', 'Porteur d\'Élite', 'Légende du Rivage'];
        let rankIdx = 0;
        for (let i = RANKS.length - 1; i >= 0; i--) if (s.completed >= RANKS[i].minCompleted && s.reputation >= RANKS[i].minRep) { rankIdx = i; break; }
        return { month: s.month, money: s.money, rank: RANKS[rankIdx] ? RANKS[rankIdx].name : rankNames[0], gameEnded: !!s.gameEnded, difficulty: s.difficulty || 'normal' };
      } catch (e) { return null; }
    }

export function serializeGame() {
      const mapsOut = {};
      for (const k in game.mapsData) {
        const d = game.mapsData[k];
        mapsOut[k] = { btZones: d.btZones, terrain: d.terrain, routes: Array.from(d.routes), craters: Array.from(d.craters), branches: d.branches, activeBranch: d.activeBranch, mainKnots: d.mainKnots || [], sideQuests: d.sideQuests || [], muleCamps: d.muleCamps || [], catchers: d.catchers || [], pccInstalls: d.pccInstalls || [], lostCargo: d.lostCargo || [], weather: d.weather || null, forecast: d.forecast || null };
      }
      return {
        v: 3, money: game.money, month: game.month, reputation: game.reputation,
        completed: game.completed, deaths: game.deaths, porters: game.porters,
        structures: game.structures, currentMap: game.currentMap, mapsData: mapsOut,
        log: game.log.slice(0, 30), equipBought: game.equipBought, gameEnded: game.gameEnded,
        materials: game.materials, titles: game.titles, quarterSnapshot: game.quarterSnapshot,
        activeFestival: game.activeFestival, hallOfFame: game.hallOfFame, visitor: game.visitor,
        bonds: game.bonds, legacyBonus: game.legacyBonus, collection: game.collection,
        duos: game.duos, sponsor: game.sponsor, automation: game.automation, difficulty: game.difficulty, dayInMonth: game.dayInMonth, monthState: game.monthState, ngPlus: game.ngPlus, infraInvestments: game.infraInvestments, subsidiaries: game.subsidiaries || [],
        activeRelicIds: game.activeRelicIds, activeCampEventIds: runtime.activeCampEvents.map(e => e.id), activeVisitorOfferIds: runtime.activeVisitorOffers.map(o => o.id), activeFestivalIds: runtime.activeFestivalsPool.map(f => f.id),
        loyalty: game.loyalty, urgentQuests: game.urgentQuests || []
      };
    }

export function deserializeGame(s) {
      game.money = s.money; game.month = s.month; game.reputation = s.reputation;
      game.completed = s.completed; game.deaths = s.deaths;
      // Livraisons en cours non persistées (simplification): les porteurs "en route" repartent idle
      game.porters = s.porters.map(p => ({
        ...p,
        trait: p.trait || rollTrait(),
        likes: p.likes || 0,
        grades: p.grades || { portage: 0, combat: 0, discretion: 0, service: 0, reseau: 0 },
        gearWear: p.gearWear || 0,
        equipment: { harness: 0, climbing_anchor: 0, ...p.equipment },
        status: p.status === 'en route' ? 'idle' : p.status
      }));
      game.deliveries = [];
      game.structures = s.structures || {};
      game.voidouts = [];
      game.mapsData = {};
      for (const k in s.mapsData) {
        const d = s.mapsData[k];
        game.mapsData[k] = { btZones: d.btZones, terrain: d.terrain, routes: new Set(d.routes), craters: new Set(d.craters), branches: d.branches, activeBranch: d.activeBranch, mainKnots: d.mainKnots || [], sideQuests: d.sideQuests || [], muleCamps: d.muleCamps || [], catchers: d.catchers || [], pccInstalls: d.pccInstalls || [], lostCargo: d.lostCargo || [], weather: d.weather || null, forecast: d.forecast || null };
      }
      loadMapData(s.currentMap);
      game.log = s.log || [];
      Object.keys(game.equipBought).forEach(k => game.equipBought[k] = (s.equipBought && s.equipBought[k]) || 0);
      game.gameEnded = !!s.gameEnded;
      game.materials = s.materials || { chiral_crystal: 0, mule_scrap: 0 };
      game.titles = s.titles || [];
      game.quarterSnapshot = s.quarterSnapshot || { completed: game.completed, deaths: game.deaths, money: game.money };
      game.activeFestival = s.activeFestival || null;
      game.hallOfFame = s.hallOfFame || [];
      game.visitor = s.visitor || null;
      game.bonds = s.bonds || {};
      game.legacyBonus = s.legacyBonus || 0;
      game.collection = s.collection || [];
      game.duos = s.duos || [];
      game.sponsor = s.sponsor || null;
      game.automation = s.automation || { autoRest: false, autoRestThreshold: 70, autoRepair: false, autoRepairThreshold: 60, autoReturn: false };
      game.difficulty = s.difficulty || 'normal';
      game.dayInMonth = s.dayInMonth || 0;
      game.monthState = s.monthState || { viewMap: game.currentMap, moneyBeforeOps: game.money, salaryCost: 0 };
      game.ngPlus = !!s.ngPlus;
      game.infraInvestments = s.infraInvestments || 0;
      game.subsidiaries = s.subsidiaries || [];
      game.activeRelicIds = s.activeRelicIds || RELICS.map(r => r.id);
      game.loyalty = (typeof s.loyalty === 'number') ? s.loyalty : 50;
      game.urgentQuests = s.urgentQuests || [];
      runtime.activeCampEvents = s.activeCampEventIds ? CAMP_EVENTS.filter(e => s.activeCampEventIds.includes(e.id)) : CAMP_EVENTS;
      runtime.activeVisitorOffers = s.activeVisitorOfferIds ? VISITOR_OFFERS.filter(o => s.activeVisitorOfferIds.includes(o.id)) : VISITOR_OFFERS;
      runtime.activeFestivalsPool = s.activeFestivalIds ? FESTIVALS.filter(f => s.activeFestivalIds.includes(f.id)) : FESTIVALS;
      runtime.gameSpeed = game.ngPlus ? Math.min(runtime.gameSpeed || 1, 2) : 1;
      const diffEl = document.getElementById('difficultySelect');
      if (diffEl) diffEl.value = game.difficulty;
      runtime.announcedRank = currentRankIndex();
    }

export async function saveGame(silent = false) {
      const data = JSON.stringify(serializeGame());
      try {
        await storageSet(saveKeyFor(runtime.currentSlot), data);
        if (!silent) logEvent(`💾 Partie sauvegardée (emplacement ${runtime.currentSlot})`);
      } catch (e) {
        logEvent('❌ Échec sauvegarde', 'warn');
      }
    }

export async function loadGame(slot) {
      if (slot) runtime.currentSlot = slot;
      let raw = await storageGet(saveKeyFor(runtime.currentSlot));
      if (!raw && runtime.currentSlot === 1) raw = await storageGet(SAVE_KEY_LEGACY); // migration douce
      if (!raw) return false;
      try { deserializeGame(JSON.parse(raw)); return true; }
      catch (e) { logEvent('❌ Sauvegarde corrompue, nouvelle partie', 'warn'); return false; }
    }

export function initFreshMap() {
      game.mapsData.mexico = { btZones: [], terrain: {}, routes: new Set(["5,5"]), craters: new Set(), branches: [{ x: HQ.x, y: HQ.y }], activeBranch: 0, mainKnots: [], sideQuests: [], muleCamps: [], catchers: [], pccInstalls: [] };
      loadMapData('mexico');
      generateBTZones();
      generateTerrain();
      game.mapsData.mexico.mainKnots = generateMainKnots();
      game.mapsData.mexico.muleCamps = generateMuleCamps();
      game.muleCamps = game.mapsData.mexico.muleCamps;
    }

export function newGame(confirmFirst, slot) {
      if (confirmFirst && !confirm('Nouvelle partie ? La sauvegarde actuelle sera écrasée.')) return;
      if (slot) runtime.currentSlot = slot;
      const diffEl = document.getElementById('difficultySelect');
      const difficulty = (diffEl && diffEl.value) || 'normal';
      const startMoney = DIFFICULTIES[difficulty].startMoney;
      Object.assign(game, { money: startMoney, month: 1, reputation: 50, completed: 0, deaths: 0, porters: [], deliveries: [], structures: {}, currentMap: 'mexico', mapsData: {}, voidouts: [], log: [], materials: { chiral_crystal: 0, mule_scrap: 0, blood_grenades: 0, blood_bags: 0 }, titles: [], activeFestival: null, hallOfFame: [], visitor: null, bonds: {}, legacyBonus: 0, collection: [], duos: [], sponsor: null, automation: { autoRest: false, autoRestThreshold: 70, autoRepair: false, autoRepairThreshold: 60, autoReturn: false }, difficulty, ngPlus: false, infraInvestments: 0, subsidiaries: [], loyalty: 50, urgentQuests: [] });
      Object.keys(game.equipBought).forEach(k => game.equipBought[k] = 0);
      game.gameEnded = false;
      runtime.announcedRank = 0;
      game.dayInMonth = 0;
      runtime.gameSpeed = 1;
      runtime.paused = false;
      runtime.placingPCC = null;
      game.monthState = { viewMap: 'mexico', moneyBeforeOps: startMoney, salaryCost: 0 };
      game.quarterSnapshot = { completed: 0, deaths: 0, money: startMoney };
      // Rotation de contenu: chaque partie ne voit qu'un sous-ensemble aléatoire (variété entre parties)
      game.activeRelicIds = pickN(RELICS.map(r => r.id), 5);
      runtime.activeCampEvents = pickN(CAMP_EVENTS, 6);
      runtime.activeVisitorOffers = pickN(VISITOR_OFFERS, 5);
      runtime.activeFestivalsPool = pickN(FESTIVALS, 4);
      initFreshMap();
      debugLog(`RNG seed pour cette partie: ${RNG.getSeed()}`);
      logEvent(`🎮 Nouvelle partie [${DIFFICULTIES[difficulty].label}] — Chiral Network ONLINE`);
      eventBus.emit('screen:hideEndScreen');
      eventBus.emit('render:request');
      saveGame(true);
    }
