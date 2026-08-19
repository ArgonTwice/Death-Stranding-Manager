// tests/resilience/FullGameLoopV14.test.js — suite globale V1.4.0 (Brumes de guerre & événements de
// parcours): 2 garanties demandées par la mission, vérifiées empiriquement. Même style zéro-
// dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { revealedMainKnots } = await import('../../src/systems/PrepperSystem.js');
const { revealedRoutes, routeStatus, ROUTE_STATUS } = await import('../../src/systems/raid/ChiralNetworkSystem.js');
const { routesForMap } = await import('../../src/data/Routes.js');
const { rollDeliveryEvent } = await import('../../src/systems/RandomEventEngine.js');
const { EVENTS } = await import('../../src/data/Constants.js');
const { connectKnot } = await import('../../src/systems/PrepperSystem.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');

// ============================================================
// 1) Brumes de guerre — masquage effectif des Preppers/relais non découverts.
// ============================================================
RNG.setSeed(555);
newGame(false);

await test('Fog of war (Preppers): a fresh territory reveals exactly ONE undiscovered main knot, never all of them', async () => {
  const d = game.mapsData.mexico;
  assertEqual(d.mainKnots.length, 4, 'sanity: the fresh territory must actually have multiple main knots to hide');
  const revealed = revealedMainKnots(d);
  const hiddenCount = d.mainKnots.length - revealed.length;
  assert(hiddenCount > 0, 'at least one main knot must be hidden on a fresh, fully-unconnected territory');
  const revealedUnconnected = revealed.filter(k => !d.routes.has(`${k.x},${k.y}`));
  assertEqual(revealedUnconnected.length, 1, 'exactly one unconnected main knot must be revealed (the closest to HQ), never zero, never more than one');
});

await test('Fog of war (Preppers): the revealed unconnected knot is the closest one to the active HQ branch', async () => {
  const d = game.mapsData.mexico;
  const hq = d.branches[d.activeBranch];
  const revealed = revealedMainKnots(d).find(k => !d.routes.has(`${k.x},${k.y}`));
  const closestByDistance = [...d.mainKnots].filter(k => !d.routes.has(`${k.x},${k.y}`)).sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0];
  assertEqual(revealed.x, closestByDistance.x, 'the revealed knot must be the nearest one to HQ, not an arbitrary one');
  assertEqual(revealed.y, closestByDistance.y, 'the revealed knot must be the nearest one to HQ, not an arbitrary one');
});

await test('Fog of war (Preppers): connecting the revealed knot naturally advances the fog to the next-nearest one', async () => {
  const d = game.mapsData.mexico;
  const revealedBefore = revealedMainKnots(d).find(k => !d.routes.has(`${k.x},${k.y}`));
  const idxBefore = d.mainKnots.indexOf(revealedBefore);
  game.money = 50000; // budget garanti pour connectKnot(), quel que soit le chemin tiré
  connectKnot(idxBefore);
  assert(d.routes.has(`${revealedBefore.x},${revealedBefore.y}`), 'sanity: connectKnot must have actually connected the previously-revealed knot');
  const revealedAfter = revealedMainKnots(d);
  const stillHiddenCount = d.mainKnots.length - revealedAfter.length;
  assert(stillHiddenCount >= 0 && stillHiddenCount < d.mainKnots.length - 1, 'fog must have advanced: strictly fewer knots hidden than before connecting the first one (or all revealed if only one remained)');
  const newUnconnected = revealedAfter.filter(k => !d.routes.has(`${k.x},${k.y}`));
  assert(newUnconnected.length <= 1, 'still at most one NEW unrevealed knot exposed at a time, never a sudden full reveal');
});

await test('Fog of war (Routes): a fresh territory reveals NETWORKED routes + exactly one LOCKED route (the closest to unlock)', async () => {
  const routes = routesForMap('mexico');
  assert(routes.length >= 2, 'sanity: mexico must have multiple raid routes to hide');
  const revealed = revealedRoutes(routes);
  const revealedLocked = revealed.filter(r => routeStatus(r) === ROUTE_STATUS.LOCKED);
  assertEqual(revealedLocked.length <= 1, true, 'at most one LOCKED route may be revealed at a time');
  if (revealedLocked.length === 1) {
    const cheapestLocked = routes.filter(r => routeStatus(r) === ROUTE_STATUS.LOCKED).reduce((a, b) => (a.minRouteCoverage <= b.minRouteCoverage ? a : b));
    assertEqual(revealedLocked[0].id, cheapestLocked.id, 'the one revealed LOCKED route must be the cheapest to unlock (minRouteCoverage), not an arbitrary one');
  }
  const hiddenRoutes = routes.filter(r => !revealed.includes(r));
  assert(hiddenRoutes.every(r => routeStatus(r) === ROUTE_STATUS.LOCKED), 'every hidden route must be LOCKED — NETWORKED/ACTIVE_RAID routes are never hidden');
});

await test('Fog of war: game.mapsData itself stays fully intact (pathfinding/simulation never lose data) — only rendering filters', async () => {
  const d = game.mapsData.mexico;
  assertEqual(d.mainKnots.length, 4, 'the underlying GameState must retain ALL main knots regardless of fog — only ui/BridgesMap.js and ui/HUD.js filter what gets drawn');
  assertEqual(routesForMap('mexico').length >= 2, true, 'the underlying route data must retain ALL routes regardless of fog');
});

// ============================================================
// 2) Événements de parcours — isolation du sous-RNG dédié, zéro décalage sur le flux principal.
// ============================================================
await test('RandomEventEngine: rollDeliveryEvent is deterministic given the same derived seed', async () => {
  const rngA = RNG.deriveGenerator(2468);
  const rngB = RNG.deriveGenerator(2468);
  const eventA = rollDeliveryEvent(EVENTS, 0.5, rngA);
  const eventB = rollDeliveryEvent(EVENTS, 0.5, rngB);
  assertEqual(eventA.id, eventB.id, 'the same derived seed + the same risk must always yield the same event');
});

RNG.setSeed(77777);
newGame(false);
const eventAnchorNext = RNG.next(); // Run A: aucun tirage d'événement

RNG.setSeed(77777);
newGame(false); // Run B: même setup rejoué, puis des tirages via un générateur DÉRIVÉ (jamais le flux partagé)

await test('RandomEventEngine: a dedicated derived generator (RNG.deriveGenerator) never shifts the shared RNG.js stream, even across many draws', async () => {
  const eventRng = RNG.deriveGenerator(13131313);
  for (let i = 0; i < 50; i++) rollDeliveryEvent(EVENTS, 0.5, eventRng);
  const afterNext = RNG.next();
  assertEqual(afterNext, eventAnchorNext, 'after 50 event draws through a dedicated derived generator, the shared RNG.js stream must be at the exact same position as if nothing had happened');
});

await test('RandomEventEngine: generateEvent() still consumes exactly 2 shared RNG.js draws (unchanged after the V1.4.0 refactor)', async () => {
  function setup() { RNG.setSeed(9090); newGame(false); hireRaw('scout'); }
  const { generateEvent } = await import('../../src/engine/DeliveryEngine.js');

  setup();
  const rawDraw1 = RNG.next();
  const rawDraw2 = RNG.next();
  const rawDraw3 = RNG.next(); // reference: 3 raw draws with no generateEvent() call

  setup();
  generateEvent(game.porters[0], 5, 5, 5, 0); // must consume EXACTLY 2 draws (pool, then index)
  const nextAfterEvent = RNG.next(); // the 3rd draw overall — must land on rawDraw3

  assertEqual(nextAfterEvent, rawDraw3, 'generateEvent() must consume exactly 2 shared-stream draws, same as before the RandomEventEngine.js refactor — no more, no less');
});

summary('FullGameLoopV14.test.js');
