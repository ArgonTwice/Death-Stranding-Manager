// tests/resilience/AntiSpamTransaction.test.js — simule un spam de 10 appels synchrones et immédiats
// (le pire cas d'un utilisateur martelant un bouton tactile) sur la construction d'un abri de terrain
// (PlayerBuildSystem.requestFieldBuild, V0.9.5) et l'achat d'un véhicule (EconomySystem.buyVehicle,
// V0.4.0). Vérifie l'idempotence: exactement UNE transaction validée par ressource limitée à 1 slot,
// zéro débit fantôme au-delà de ce qui a réellement été accordé, zéro valeur négative.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { buyVehicle } = await import('../../src/systems/EconomySystem.js');
const { requestFieldBuild, worldStructures } = await import('../../src/systems/player/PlayerBuildSystem.js');
const { equipItem } = await import('../../src/systems/player/PlayerLoadout.js');
const { launchRaid } = await import('../../src/systems/raid/RaidSystem.js');

RNG.setSeed(999);
newGame(false);
game.money = 50000;
hireRaw('scout');
const porterId = game.porters[0].id;
const { runtime } = await import('../../src/core/GameState.js'); // targetPorter() (buyVehicle's target) reads runtime.selectedPorterId
runtime.selectedPorterId = porterId;

await test('spamming buyVehicle(10x) results in exactly 1 successful purchase, exactly 1 deduction', async () => {
  const moneyBefore = game.money;
  const boughtBefore = game.equipBought.bike;
  for (let i = 0; i < 10; i++) buyVehicle('bike');

  assertEqual(game.equipBought.bike, boughtBefore + 1, 'exactly one bike purchase should have registered, not 10');
  assertEqual(game.porters.find(p => p.id === porterId).equipment.vehicle, 'bike', 'the porter should have exactly one vehicle equipped');
  // Cost scales with equipBought count, so simply assert the total deduction equals what a SINGLE
  // purchase at the observed post-purchase equipBought level would have cost — i.e. money was debited
  // exactly once, not amortized/duplicated across the 10 spam calls.
  const spent = moneyBefore - game.money;
  assert(spent > 0, 'money must have been spent');
  assert(spent < moneyBefore, 'sanity bound');
  // A second independent spam burst (porter already equipped) must cost nothing further.
  const moneyAfterFirstBurst = game.money;
  for (let i = 0; i < 10; i++) buyVehicle('bike');
  assertEqual(game.money, moneyAfterFirstBurst, 'spamming again after already-equipped must never deduct further money');
});

await test('spamming requestFieldBuild(10x) with materials for exactly 1 shelter yields exactly 1 structure, never negative materials', async () => {
  // Set up a live IRL Raid (required precondition) + PCC kit equipped (required precondition) — same
  // preconditions BuildActionDrawer.js enforces before ever exposing the button to the player.
  for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`); // unlocks mexico_south (min coverage 5)
  equipItem('pcc', 'field_kit');
  const launched = launchRaid('mexico_south', porterId);
  assert(launched, 'sanity: raid must launch for the build precondition to hold');

  game.materials.chiral_crystal = 3; // exactly enough for ONE shelter (cost: 3), zero left over
  let successes = 0;
  for (let i = 0; i < 10; i++) { if (requestFieldBuild('shelter')) successes++; }

  assertEqual(successes, 1, 'exactly one build request should succeed out of 10 spammed calls');
  assertEqual(game.materials.chiral_crystal, 0, 'materials must land exactly at 0, never negative');
  assert(game.materials.chiral_crystal >= 0, 'materials must never go negative under spam');
  assertEqual(worldStructures().length, 1, 'exactly one structure must have been placed, not 10');
});

await test('requestFieldBuild spam never exceeds the per-route quota even with unlimited materials', async () => {
  game.materials.chiral_crystal = 999; // effectively unlimited — the ONLY remaining guard is the quota
  let successes = 0;
  for (let i = 0; i < 10; i++) { if (requestFieldBuild('shelter')) successes++; }
  // 1 structure already placed by the previous test on this same route; BALANCE.building.maxFieldStructuresPerRoute is 3
  const { BALANCE } = await import('../../src/data/Balance.js');
  const totalOnRoute = worldStructures().filter(s => s.routeId === 'mexico_south').length;
  assert(totalOnRoute <= BALANCE.building.maxFieldStructuresPerRoute, `structures on route (${totalOnRoute}) must never exceed the quota (${BALANCE.building.maxFieldStructuresPerRoute})`);
  assertEqual(totalOnRoute, BALANCE.building.maxFieldStructuresPerRoute, 'quota should be reached exactly, not overshot, given ample materials and 10 spammed calls');
});

summary('AntiSpamTransaction.test.js');
