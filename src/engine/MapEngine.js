// AUTO-EXTRACTED MODULE: engine/MapEngine.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, HQ, MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';
import { COUNTRIES, KNOT_CITY_NAMES, STRUCTURES, cellKey, countryInfo } from '../data/Constants.js';
import { migratePrepperKnot } from '../persistence/SaveMigrations.js';
import { makePrepper } from '../systems/PrepperSystem.js';
import { markMapDirty } from '../ui/MapRenderer.js';

export function dominantStructure() {
      let best = null, bestLevel = 0;
      for (const type in STRUCTURES) {
        const lvl = game.structures[type] || 0;
        if (lvl > bestLevel) { bestLevel = lvl; best = type; }
      }
      return best;
    }

export function loadMapData(mapKey) {
      const d = game.mapsData[mapKey];
      game.btZones = d.btZones;
      game.terrain = d.terrain;
      game.routes = d.routes;
      game.craters = d.craters;
      if (!d.muleCamps) d.muleCamps = []; // compat vieilles saves
      game.muleCamps = d.muleCamps;
      if (!d.catchers) d.catchers = [];
      game.catchers = d.catchers;
      if (!d.pccInstalls) d.pccInstalls = [];
      game.pccInstalls = d.pccInstalls;
      if (!d.lostCargo) d.lostCargo = [];
      game.lostCargo = d.lostCargo;
      game.weather = d.weather || null;
      if (d.mainKnots) d.mainKnots.forEach(migratePrepperKnot); // migration douce des vieilles saves (v<3)
      game.currentMap = mapKey;
    }

export function switchMap(mapKey) {
      if (!game.mapsData[mapKey]) return; // pas encore débloqué
      loadMapData(mapKey);
      markMapDirty();
      eventBus.emit('render:request');
    }

export function nextLockedCountry() {
      return COUNTRIES.find(c => !game.mapsData[c.key]);
    }

export function expansionCost() {
      const unlockedCount = Object.keys(game.mapsData).length; // mexico compte pour 1 dès le départ
      return Math.ceil(BALANCE.map.expansionCostBase * Math.pow(BALANCE.map.expansionCostGrowth, unlockedCount - 1));
    }

export function buildExpansion(mode) {
      // Canon DS2: Plate Gate — portail vers un nouveau territoire, mais il faut d'abord raccorder
      // toutes les villes principales du territoire frontière (comme dans le jeu: points clés du réseau)
      mode = mode || 'standard';
      const next = nextLockedCountry();
      if (!next) { logEvent('❌ Tous les territoires disponibles sont déjà connectés'); return; }
      const frontier = game.mapsData[frontierMapKey()];
      const total = (frontier.mainKnots || []).length;
      const connected = (frontier.mainKnots || []).filter(k => frontier.routes.has(cellKey(k.x, k.y))).length;
      if (connected < total) {
        logEvent(`❌ Raccordez toutes les villes principales avant d'ouvrir la Plate Gate (${connected}/${total})`);
        return;
      }
      // Filiale indépendante: la Maison-Mère prend en charge une partie du coût d'installation
      const cost = mode === 'subsidiary' ? Math.ceil(expansionCost() * BALANCE.map.subsidiaryCostMult) : expansionCost();
      if (game.money < cost) { logEvent(`❌ Budget expansion ($${cost})`); return; }
      game.money -= cost;
      const prevMap = game.currentMap;
      game.mapsData[next.key] = {
        btZones: [], terrain: {}, routes: new Set(["5,5"]), craters: new Set(),
        branches: [{ x: HQ.x, y: HQ.y }], activeBranch: 0, mainKnots: [], sideQuests: [], muleCamps: [], catchers: [], pccInstalls: [], lostCargo: []
      };
      loadMapData(next.key);
      generateBTZones();
      generateTerrain();
      game.mapsData[next.key].mainKnots = generateMainKnots();
      game.mapsData[next.key].muleCamps = generateMuleCamps();
      game.muleCamps = game.mapsData[next.key].muleCamps;
      loadMapData(prevMap);
      if (mode === 'subsidiary') {
        game.subsidiaries = game.subsidiaries || [];
        game.subsidiaries.push({ mapKey: next.key, motherMap: prevMap, foundedMonth: game.month });
        game.legacyBonus = (game.legacyBonus || 0) + BALANCE.map.subsidiaryLegacyBonus; // héritage partagé Maison-Mère/filiale, permanent
        logEvent(`🏢 FILIALE INDÉPENDANTE — ${next.flag} ${next.name} fondée (-$${cost}) — Maison-Mère: ${countryInfo(prevMap).name}, subvention mensuelle activée, +0.5% XP héritage permanent`, 'good');
      } else {
        logEvent(`🌀 PLATE GATE — ${next.flag} ${next.name} connecté au réseau chiral (-$${cost})`);
      }
      eventBus.emit('render:request');
    }

export function foundBranch() {
      // Canon: "plusieurs entreprises par pays" — antennes secondaires de Bridges
      const d = game.mapsData[game.currentMap];
      const cost = Math.ceil(BALANCE.map.branchCostBase * Math.pow(BALANCE.map.branchCostGrowth, d.branches.length - 1));
      if (game.money < cost) { logEvent(`❌ Budget antenne ($${cost})`); return; }
      let bx, by, tries = 0;
      do {
        bx = Math.floor(RNG.next() * MAP_WIDTH);
        by = Math.floor(RNG.next() * MAP_HEIGHT);
        tries++;
      } while (tries < BALANCE.map.branchMaxTries && d.branches.some(b => Math.hypot(b.x - bx, b.y - by) < BALANCE.map.branchMinDistance));
      d.branches.push({ x: bx, y: by });
      d.routes.add(cellKey(bx, by)); // l'antenne démarre connectée au réseau local
      game.money -= cost;
      logEvent(`🏢 Nouvelle antenne fondée en (${bx},${by}) — ${countryInfo(game.currentMap).name} (-$${cost})`);
      eventBus.emit('render:request');
    }

export function setActiveBranch(idx) {
      game.mapsData[game.currentMap].activeBranch = idx;
      eventBus.emit('render:request');
    }

export function generateTerrain() {
      // Canon: montagnes ralentissent, rivières exigent un détour
      for (let x = 0; x < MAP_WIDTH; x++) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
          if (x === HQ.x && y === HQ.y) continue;
          const roll = RNG.next();
          if (roll < BALANCE.map.mountainChanceThreshold) game.terrain[cellKey(x, y)] = 'mountain';
          else if (roll < BALANCE.map.riverChanceThreshold) game.terrain[cellKey(x, y)] = 'river';
        }
      }
    }

const knotCityMap = {};

export function knotCityName(x, y) {
      const key = `${game.currentMap}:${cellKey(x, y)}`;
      if (!knotCityMap[key]) {
        knotCityMap[key] = KNOT_CITY_NAMES[Math.floor(RNG.next() * KNOT_CITY_NAMES.length)];
      }
      return knotCityMap[key];
    }

export function generateBTZones() {
      // 15% des cellules = zone BT, jamais sur HQ
      for (let x = 0; x < MAP_WIDTH; x++) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
          if (x === HQ.x && y === HQ.y) continue;
          if (RNG.next() < BALANCE.map.btZoneChance) game.btZones.push(cellKey(x, y));
        }
      }
    }

// V1.0.3 — le compteur d'ids mule camps vit désormais dans game.meta.counters.muleCampId (persisté par
// SaveManager.js), plus dans une variable module-scope: une variable module-scope repart TOUJOURS de
// zéro au chargement d'une page (nouvel onglet, reload navigateur), y compris lorsqu'une sauvegarde
// existante est CHARGÉE (pas "Nouvelle partie") — un joueur qui débloque un territoire, sauvegarde,
// recharge la page puis débloque un second territoire régénérait alors mule-0/mule-1 en collision avec
// les ids mule-0/mule-1 déjà présents dans le premier territoire (le compteur en mémoire ignorait tout
// de la progression déjà persistée). Isoler ce compteur dans game.* (RuntimeState) le fait survivre au
// save/reload comme n'importe quel autre état de partie, exactement comme game.world.nextStructureId.
function muleCampCounters() {
      game.meta = game.meta || { counters: { muleCampId: 0 } };
      game.meta.counters = game.meta.counters || { muleCampId: 0 };
      return game.meta.counters;
    }

// Doit rester incrémental au sein d'UNE MÊME partie (plusieurs territoires débloqués = plusieurs
// appels à generateMuleCamps(), les ids ne doivent jamais entrer en collision entre eux) — mais doit
// impérativement repartir de zéro à chaque NOUVELLE partie, sinon deux "Nouvelle partie" consécutives
// dans le même onglet navigateur produisent des ids différents (mule-0/1 vs mule-2/3...) pour un état
// par ailleurs strictement identique (même seed): violation silencieuse du déterminisme, détectée par
// tests/resilience/RngUiOrthogonality.test.js. Appelé par SaveManager.js#newGame().
export function resetMuleCampIdCounter() { muleCampCounters().muleCampId = 0; }

export function generateMuleCamps() {
      const counters = muleCampCounters();
      const camps = [];
      let tries = 0;
      while (camps.length < BALANCE.map.muleCampCountBase + Math.floor(RNG.next() * BALANCE.map.muleCampCountRandRange) && tries < BALANCE.map.muleCampMaxTries) { // 2-3 camps
        tries++;
        const x = Math.floor(RNG.next() * MAP_WIDTH);
        const y = Math.floor(RNG.next() * MAP_HEIGHT);
        if (Math.hypot(x - HQ.x, y - HQ.y) < BALANCE.map.muleCampMinDistanceFromHQ) continue; // pas trop près du camp
        if (camps.some(c => Math.hypot(c.x - x, c.y - y) < BALANCE.map.muleCampMinDistanceBetween)) continue; // pas collés entre eux
        camps.push({ id: `mule-${counters.muleCampId++}`, x, y, strength: BALANCE.map.muleCampStrengthBase + Math.floor(RNG.next() * BALANCE.map.muleCampStrengthRandRange), status: 'hostile', safeUntilMonth: null, needsIncineration: false });
      }
      return camps;
    }

export function isNearHostileMuleCamp(x, y) {
      return (game.muleCamps || []).some(c => c.status === 'hostile' && Math.hypot(c.x - x, c.y - y) <= BALANCE.map.hostileCampProximityRadius);
    }

export function isBTZone(x, y) {
      const inZone = game.btZones.includes(cellKey(x, y));
      // Shelter neutralise BT zone dans radius 2 autour HQ
      if (inZone && game.structures.shelter) {
        const dist = Math.hypot(x - HQ.x, y - HQ.y);
        if (dist <= BALANCE.map.shelterBtNeutralizeRadiusMult * (game.structures.shelter)) return false;
      }
      return inZone;
    }

export function isOnRoute(x, y) {
      return game.routes.has(cellKey(x, y));
    }

// V1.6.0 — extrait de engine/DeliveryEngine.js#buildRoute(): les cases adjacentes à une cellule déjà
// connectée, pas encore couvertes, en excluant les cratères (infranchissables). Fonction PURE
// réutilisée par buildRoute() ET systems/ReconnaissanceSystem.js (Dispatch Pionnier + progression
// RealWalk) — vit ici plutôt que dans DeliveryEngine.js pour éviter un cycle d'import
// (ReconnaissanceSystem.js -> DeliveryEngine.js -> ReconnaissanceSystem.js, puisque DeliveryEngine.js
// doit aussi appeler tickPioneerMissions()/checkTerrainHazards() depuis son tick quotidien).
export function networkExpansionCandidates(mapKey) {
      const d = game.mapsData[mapKey];
      if (!d) return { candidates: [], blockedByCrater: 0 };
      const connected = Array.from(d.routes);
      const candidates = [];
      let blockedByCrater = 0;
      for (let key of connected) {
        const [cx, cy] = key.split(',').map(Number);
        for (let [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
          const nkey = cellKey(nx, ny);
          if (d.routes.has(nkey)) continue;
          if (d.craters.has(nkey)) { blockedByCrater++; continue; }
          candidates.push(nkey);
        }
      }
      return { candidates, blockedByCrater };
    }

export function generateMainKnots() {
      const knots = [];
      const usedNames = [];
      let tries = 0;
      while (knots.length < BALANCE.map.mainKnotCount && tries < BALANCE.map.mainKnotMaxTries) {
        tries++;
        const x = Math.floor(RNG.next() * MAP_WIDTH);
        const y = Math.floor(RNG.next() * MAP_HEIGHT);
        if (Math.hypot(x - HQ.x, y - HQ.y) < BALANCE.map.mainKnotMinDistanceFromHQ) continue;
        if (knots.some(k => Math.hypot(k.x - x, k.y - y) < BALANCE.map.mainKnotMinDistanceBetween)) continue;
        const avail = KNOT_CITY_NAMES.filter(n => !usedNames.includes(n));
        const pool = avail.length ? avail : KNOT_CITY_NAMES;
        const name = pool[Math.floor(RNG.next() * pool.length)];
        usedNames.push(name);
        knotCityMap[`${game.currentMap}:${cellKey(x, y)}`] = name; // fige le nom (cohérent avec knotCityName())
        knots.push(makePrepper(x, y, name));
      }
      return knots;
    }

export function nearestRouteInfo(x, y) {
      let best = [HQ.x, HQ.y], bestD = Math.abs(HQ.x - x) + Math.abs(HQ.y - y);
      for (const key of game.routes) {
        const [rx, ry] = key.split(',').map(Number);
        const d = Math.abs(rx - x) + Math.abs(ry - y);
        if (d < bestD) { bestD = d; best = [rx, ry]; }
      }
      return { cell: best, dist: bestD };
    }

export function findPathToKnot(goalX, goalY) {
      const goal = cellKey(goalX, goalY);
      const dist = new Map();
      const prev = new Map();
      const pending = [];
      const sources = game.routes.size ? Array.from(game.routes) : [cellKey(HQ.x, HQ.y)];
      for (const key of sources) { dist.set(key, 0); pending.push(key); }
      while (pending.length) {
        pending.sort((a, b) => dist.get(a) - dist.get(b));
        const cur = pending.shift();
        if (cur === goal) break;
        const [cx, cy] = cur.split(',').map(Number);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
          const nkey = cellKey(nx, ny);
          if (game.craters.has(nkey)) continue; // infranchissable
          const stepCost = isBTZone(nx, ny) ? BALANCE.map.pathfindingBtZoneCostMult : 1; // évitée si possible, jamais bloquante
          const nd = dist.get(cur) + stepCost;
          if (!dist.has(nkey) || nd < dist.get(nkey)) {
            dist.set(nkey, nd);
            prev.set(nkey, cur);
            if (!pending.includes(nkey)) pending.push(nkey);
          }
        }
      }
      if (!dist.has(goal)) return null; // encerclé par des cratères
      const path = [goal];
      let cur = goal;
      while (prev.has(cur)) { cur = prev.get(cur); path.unshift(cur); }
      return path; // inclut la ou les cellules de départ déjà connectées
    }

export function frontierMapKey() {
      // Le dernier pays débloqué dans l'ordre — celui qu'il faut raccorder pour ouvrir la prochaine Plate Gate
      let last = 'mexico';
      for (const c of COUNTRIES) if (game.mapsData[c.key]) last = c.key;
      return last;
    }
