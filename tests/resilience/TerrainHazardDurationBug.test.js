// tests/resilience/TerrainHazardDurationBug.test.js — V1.37.0: bug réel trouvé par revue de code
// (audit libre, pas de brief) puis confirmé empiriquement. systems/ReconnaissanceSystem.js#checkTerrainHazards
// tirait une durée réaliste ("days", 2-5 jours, BALANCE.reconnaissance.hazardBlockDaysMin/Max) mais
// stockait l'expiration en MOIS ENTIERS (untilMonth: game.month + 1) — puisque le nettoyage exige
// game.month > untilMonth (strictement), un aléa déclenché n'importe quand dans le mois M ne se
// nettoyait qu'au DÉBUT du mois M+2 (jamais M+1, où game.month===untilMonth échoue déjà la stricte
// inégalité) — un aléa "~2-5 jours" durait en réalité 30 à 60 jours réels, message trompeur pour le
// joueur ET route bloquée bien plus longtemps que prévu par le design. Confirmé empiriquement avant
// fix: injecté au jour 0 d'un mois -> 31 jours réels avant nettoyage ; injecté au jour 28 -> 33 jours.
// Fix: expiration en JOURS ABSOLUS (totalDaysElapsed(), même pattern que MemoryStormCycle.js/
// BBPodSystem.js) au lieu de mois entiers — untilDay remplace untilMonth, dans
// ReconnaissanceSystem.js#checkTerrainHazards ET ChiralNetworkSystem.js#isHazardBlocked (les deux
// devaient rester cohérents, même champ, même granularité).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { advanceDay } = await import('../../src/engine/DeliveryEngine.js');
const { routeStatus, ROUTE_STATUS } = await import('../../src/systems/raid/ChiralNetworkSystem.js');
const { routesForMap } = await import('../../src/data/Routes.js');

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
  const route = routesForMap('mexico')[0];
  for (const c of route.cells || []) game.mapsData.mexico.routes.add(`${c[0]},${c[1]}`);
  // fallback: ensure enough coverage regardless of route shape
  for (let i = 0; i < 10; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
  return route;
}

await test('a hazard injected on day 0 of a month clears within its designed 2-5 day window, never 30+ days', () => {
  const route = freshFixture(9001);
  assertEqual(game.dayInMonth, 0, 'sanity: fresh game starts at day 0');
  const startMonth = game.month;
  game.terrainHazards[route.id] = { type: 'rockslide', untilDay: (game.month - 1) * 30 + game.dayInMonth + 5 }; // max design duration: 5 days

  let days = 0;
  while (game.terrainHazards[route.id] && days < 40) { advanceDay(); days++; }

  assert(days <= 6, `hazard must clear within ~5 days (+1 grace for the tick timing), took ${days} days instead — the old untilMonth bug made this take 30-60 days`);
  assert(game.month <= startMonth + 1, 'clearing a short hazard must never require crossing 2 whole month boundaries');
});

await test('a hazard injected near the end of a month still clears within its designed window, not 30+ days later', () => {
  const route = freshFixture(9002);
  for (let i = 0; i < 28; i++) advanceDay(); // push to near month-end
  const untilDay = (game.month - 1) * 30 + game.dayInMonth + 4;
  game.terrainHazards[route.id] = { type: 'flood', untilDay };

  let days = 0;
  while (game.terrainHazards[route.id] && days < 40) { advanceDay(); days++; }

  assert(days <= 5, `hazard must clear within ~4 days (+1 grace) regardless of when in the month it was injected, took ${days} days`);
});

await test('routeStatus() reports BLOCKED while the hazard is active and NETWORKED the instant untilDay passes (day granularity, not month)', () => {
  const route = freshFixture(9003);
  const totalDaysElapsed = () => (game.month - 1) * 30 + game.dayInMonth;
  game.terrainHazards[route.id] = { type: 'rockslide', untilDay: totalDaysElapsed() + 2 };
  assertEqual(routeStatus(route), ROUTE_STATUS.BLOCKED, 'an active hazard must report BLOCKED');
  game.dayInMonth += 2;
  assertEqual(routeStatus(route), ROUTE_STATUS.NETWORKED, 'once untilDay has passed (day granularity), the route must be NETWORKED again — not stuck BLOCKED until the next month boundary');
});

summary('TerrainHazardDurationBug.test.js');
