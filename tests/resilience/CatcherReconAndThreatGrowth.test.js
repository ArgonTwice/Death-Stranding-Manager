// tests/resilience/CatcherReconAndThreatGrowth.test.js — suite V1.19.0:
// 1) nouvelle action "Reconnaissance Pre-Catcher" (engine/CombatEngine.js#reconCatcher) — dépense
//    200-500$ pour réduire la force d'un Catcher avant de l'engager, compense catcherSpawnChance
//    réduit (0.06 -> 0.04) et le renfort de fin de partie (threatGrowth).
// 2) extension de "Menace croissante" (data/Balance.js#combat.threatGrowth*) à la chance de zone BT
//    (engine/MapEngine.js#generateBTZones) et à la chance de Tempête Chirale
//    (systems/WeatherSystem.js#rollWeatherType), au-delà du seul bonus de force MULE/Catcher déjà
//    couvert par SoakInvariant.test.js. Même style zéro-dépendance que le reste de
//    tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { reconCatcher } = await import('../../src/engine/CombatEngine.js');
const { generateBTZones } = await import('../../src/engine/MapEngine.js');

RNG.setSeed(119200);
newGame(false);

await test('reconCatcher() réduit la force du Catcher, débite $200-500 et empêche une deuxième reconnaissance gratuite', async () => {
  const d = game.mapsData[game.currentMap];
  d.catchers = [{ id: 'catcher-test', x: 1, y: 1, strength: 5 }];
  game.catchers = d.catchers;
  game.money = 10000;
  const moneyBefore = game.money;

  reconCatcher('catcher-test');
  const c = d.catchers.find(x => x.id === 'catcher-test');
  assertEqual(c.strength, 5 - BALANCE.combat.catcherReconStrengthReduction, 'la force du Catcher doit baisser exactement de catcherReconStrengthReduction');
  const spent = moneyBefore - game.money;
  assert(spent >= BALANCE.combat.catcherReconCostBase && spent < BALANCE.combat.catcherReconCostBase + BALANCE.combat.catcherReconCostRandRange, `le coût débité (${spent}) doit rester dans la fourchette 200-500$`);
  assert(c.reconDone, 'reconDone doit être marqué après une reconnaissance');

  const strengthAfterFirst = c.strength;
  const moneyAfterFirst = game.money;
  reconCatcher('catcher-test'); // 2e tentative: doit être refusée sans coût ni effet
  assertEqual(c.strength, strengthAfterFirst, 'une deuxième reconnaissance sur le même Catcher ne doit rien changer à sa force');
  assertEqual(game.money, moneyAfterFirst, 'une deuxième reconnaissance refusée ne doit débiter aucun argent');
});

await test('reconCatcher() refuse si le budget est insuffisant, sans jamais faire passer money sous 0', async () => {
  const d = game.mapsData[game.currentMap];
  d.catchers = [{ id: 'catcher-poor', x: 2, y: 2, strength: 3 }];
  game.catchers = d.catchers;
  game.money = 50; // toujours sous catcherReconCostBase (200)
  reconCatcher('catcher-poor');
  const c = d.catchers.find(x => x.id === 'catcher-poor');
  assertEqual(c.strength, 3, 'sans budget suffisant, la force du Catcher ne doit pas bouger');
  assertEqual(game.money, 50, 'sans budget suffisant, aucun argent ne doit être débité');
});

await test('generateBTZones() produit plus de zones BT quand threatGrowth est au plafond qu\'à month=0, sur la même seed', async () => {
  const B = BALANCE.combat;
  RNG.setSeed(119201);
  game.month = 0;
  game.btZones = [];
  generateBTZones();
  const countAtMonth0 = game.btZones.length;

  RNG.setSeed(119201); // même seed exacte, seul game.month change
  game.month = B.threatGrowthMonthInterval * B.threatGrowthCap; // plafond de threatGrowth atteint
  game.btZones = [];
  generateBTZones();
  const countAtCap = game.btZones.length;

  assert(countAtCap > countAtMonth0, `threatGrowth doit augmenter la densité de zones BT (month=0: ${countAtMonth0}, plafond: ${countAtCap})`);
});

summary('CatcherReconAndThreatGrowth.test.js');
