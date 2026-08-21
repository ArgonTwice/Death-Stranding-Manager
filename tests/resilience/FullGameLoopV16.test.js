// tests/resilience/FullGameLoopV16.test.js — suite globale V1.6.0 (Reconnaissance, Brumes DS2 & aléas
// de terrain): garanties vérifiées empiriquement. Même style zéro-dépendance que le reste de
// tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { routesForMap } = await import('../../src/data/Routes.js');
const { routeStatus, ROUTE_STATUS, revealedRoutes, silhouetteRoutes } = await import('../../src/systems/raid/ChiralNetworkSystem.js');
const { dispatchPioneer, checkTerrainHazards, extendNetworkDeterministic } = await import('../../src/systems/ReconnaissanceSystem.js');
const { advanceDay } = await import('../../src/engine/DeliveryEngine.js');
const { recordSteps } = await import('../../src/systems/RealWalkSystem.js');
const { DAYS_PER_MONTH } = await import('../../src/data/Balance.js');

// ============================================================
// 1) Silhouettes — routes/preppers non révélés visibles en position, jamais en détail.
// ============================================================
RNG.setSeed(101);
newGame(false);

await test('Silhouettes: revealedRoutes + silhouetteRoutes partition the full route list with no overlap', async () => {
  const routes = routesForMap('mexico');
  assertEqual(routes.length, 2, 'sanity: mexico must have 2 raid routes for this test to be meaningful');
  const revealed = revealedRoutes(routes);
  const silhouettes = silhouetteRoutes(routes);
  assertEqual(revealed.length + silhouettes.length, routes.length, 'every route must be either revealed or a silhouette, never both, never neither');
  assertEqual(revealed.some(r => silhouettes.includes(r)), false, 'no route may appear in both sets');
});

await test('Silhouettes: the silhouette route is still LOCKED (never accidentally made available)', async () => {
  const routes = routesForMap('mexico');
  for (const r of silhouetteRoutes(routes)) {
    assertEqual(routeStatus(r), ROUTE_STATUS.LOCKED, 'a silhouette route must remain LOCKED — it is a visual-only concept, never a gameplay shortcut');
  }
});

// ============================================================
// 2) Dispatch Pionnier — mobilise un porteur, résout après N jours, étend le réseau gratuitement.
// ============================================================
RNG.setSeed(202);
newGame(false);
hireRaw('scout');
const pioneer = game.porters[0];

await test('Pioneer Dispatch: launching mobilizes the porter (idle -> en route) and costs zero money', async () => {
  const moneyBefore = game.money;
  const launched = dispatchPioneer(pioneer.id);
  assertEqual(launched, true, 'dispatchPioneer must succeed for an idle, healthy porter with network room to expand');
  assertEqual(pioneer.status, 'en route', 'the porter must be mobilized for the duration of the mission');
  assertEqual(game.money, moneyBefore, 'Dispatch Pionnier is free in money — the cost is the porter\'s time, not currency');
});

await test('Pioneer Dispatch: resolving after the mission duration frees the porter and expands the network by exactly one cell', async () => {
  const coverageBefore = game.mapsData.mexico.routes.size;
  const { BALANCE } = await import('../../src/data/Balance.js');
  for (let i = 0; i < BALANCE.reconnaissance.pioneerMissionDays; i++) advanceDay();
  assertEqual(pioneer.status, 'idle', 'the porter must be freed once the mission resolves');
  assertEqual(game.mapsData.mexico.routes.size, coverageBefore + 1, 'the network must have grown by exactly one cell — the mission target');
  assertEqual((game.pioneerMissions || []).length, 0, 'the resolved mission must be removed from the active list');
});

// ============================================================
// 3) Progression RealWalk — extension réseau déterministe, zéro décalage RNG.js.
// ============================================================
function setupRealWalkTest() {
  RNG.setSeed(303);
  newGame(false);
}

setupRealWalkTest();
const realWalkAnchorNext = RNG.next(); // Run A: juste le setup, aucun pas enregistré

setupRealWalkTest(); // Run B: même setup rejoué, puis des pas qui franchissent le seuil réseau

await test('RealWalk network progression: recordSteps() past the threshold expands the network deterministically, without touching RNG.js', async () => {
  const { BALANCE } = await import('../../src/data/Balance.js');
  const coverageBefore = game.mapsData.mexico.routes.size;
  recordSteps(BALANCE.reconnaissance.realWalkNetworkStepInterval); // franchit exactement un seuil
  const rngAfter = RNG.next();
  assertEqual(game.mapsData.mexico.routes.size, coverageBefore + 1, 'crossing the step threshold must have expanded the network by one cell');
  assertEqual(rngAfter, realWalkAnchorNext, 'RealWalkSystem.js#recordSteps must never touch the shared RNG.js stream, even when it triggers a network expansion');
});

await test('RealWalk network progression: extendNetworkDeterministic() run twice from the same state produces the same target cell', async () => {
  setupRealWalkTest();
  extendNetworkDeterministic('mexico');
  const stateA = Array.from(game.mapsData.mexico.routes).sort().join(',');

  setupRealWalkTest();
  extendNetworkDeterministic('mexico');
  const stateB = Array.from(game.mapsData.mexico.routes).sort().join(',');

  assertEqual(stateB, stateA, 'the same starting network state must always expand to the same cell — deterministic, not the RNG-based buildRoute() choice');
});

// ============================================================
// 4) Aléas de terrain DS2 — bloquent temporairement une route NETWORKED, jamais LOCKED/ACTIVE_RAID.
// ============================================================
RNG.setSeed(404);
newGame(false);
for (let i = 0; i < 8; i++) game.mapsData.mexico.routes.add(`${i},${i}`); // couvre les 2 routes (NETWORKED)

await test('Terrain hazards: checkTerrainHazards() only ever blocks NETWORKED routes, never LOCKED ones', async () => {
  for (let i = 0; i < 60; i++) checkTerrainHazards(); // force plusieurs tentatives de spawn (chance/appel)
  const routes = routesForMap('mexico');
  for (const r of routes) {
    if (game.terrainHazards[r.id]) {
      // Un aléa n'a de sens QUE sur une route déjà déverrouillée — vérifie via la couverture brute
      // (routeStatus() lirait déjà BLOCKED ici, donc on vérifie directement la donnée de couverture).
      assert(game.mapsData.mexico.routes.size >= r.minRouteCoverage, `hazard on ${r.id} must only occur on an already-unlocked route`);
    }
  }
});

// V1.37.0 — field renamed untilMonth->untilDay (bug fix: an untilMonth-based expiration made a
// "~2-5 day" hazard last 30-60 real days, cf. systems/ReconnaissanceSystem.js#checkTerrainHazards
// for the full explanation). totalDaysElapsed() mirrors the helper duplicated in
// ReconnaissanceSystem.js/ChiralNetworkSystem.js (same established pattern as MemoryStormCycle.js).
await test('Terrain hazards: a blocked route reports ROUTE_STATUS.BLOCKED and expires after its untilDay', async () => {
  const totalDaysElapsed = () => (game.month - 1) * DAYS_PER_MONTH + game.dayInMonth;
  const route = routesForMap('mexico')[0];
  game.terrainHazards = { [route.id]: { type: 'rockslide', untilDay: totalDaysElapsed() + 3 } };
  assertEqual(routeStatus(route), ROUTE_STATUS.BLOCKED, 'a route with an active hazard must report BLOCKED, not NETWORKED');
  game.dayInMonth += 3; // dépasse untilDay (le vrai grain de l'aléa, jamais un mois entier)
  assertEqual(routeStatus(route), ROUTE_STATUS.NETWORKED, 'once untilDay has passed, the route must report NETWORKED again (hazard cleanup happens on the next checkTerrainHazards() call, but routeStatus() itself already ignores an expired hazard)');
});

summary('FullGameLoopV16.test.js');
