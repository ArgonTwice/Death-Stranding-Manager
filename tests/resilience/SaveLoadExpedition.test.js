// tests/resilience/SaveLoadExpedition.test.js — démarre une expédition multi-étapes (3 legs, A->B->C
// en pratique le pipeline ExpeditionSystem.js traite N legs identiquement quel que soit N), sauvegarde
// à mi-parcours de l'étape 2 (~45%), "détruit" le RuntimeState en le réinitialisant via newGame()
// (le seul moyen réaliste de jeter l'état vivant des singletons game/runtime sans redémarrer le
// processus — exactement ce qui se passe en jeu quand on revient au menu puis "Continuer"), recharge
// depuis la sauvegarde et vérifie une reprise BIT-À-BIT exacte de l'expédition/raid en cours.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, saveGame, loadGame, saveKeyFor } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { createMockMotionAdapter } = await import('../../src/sensors/MockMotionAdapter.js');
const { recordSteps } = await import('../../src/systems/RealWalkSystem.js');
await import('../../src/systems/raid/RaidSystem.js'); // abonnement walk:stepDetected (effet de bord)
const { startExpedition } = await import('../../src/systems/expedition/ExpeditionSystem.js'); // abonnement raid:completed (effet de bord)

RNG.setSeed(424242);
newGame(false);
game.money = 20000;
hireRaw('scout');
const porterId = game.porters[0].id;
for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`); // couvre mexico_south (min 5)

const contract = {
  id: 'test-abcd', mapKey: 'mexico', typeId: 'multistop', typeName: 'Test A->B->C',
  icon: '🧭', legRouteIds: ['mexico_south', 'mexico_south', 'mexico_south'], month: game.month
};

// Un checkpoint "mauvais événement" peut faire CROÎTRE targetDistanceSteps en cours de route
// (raid.targetDistanceSteps += event.detourSteps, RaidSystem.js) — une seule injection de
// "targetDistanceSteps + marge" n'est donc pas fiable. On boucle jusqu'à franchissement réel, avec un
// plafond d'itérations pour ne jamais tourner indéfiniment en cas de régression.
function driveUntil(mockAdapter, predicate, maxIterations = 30) {
  for (let i = 0; i < maxIterations; i++) {
    if (predicate()) return true;
    const raid = game.activeRaid;
    if (!raid || raid.status !== 'active') return predicate();
    const remaining = Math.max(1, raid.targetDistanceSteps - raid.traveledSteps);
    mockAdapter.simulateSteps(remaining + 100);
  }
  return predicate();
}

await test('expedition A->B->C starts and leg 1 completes, leg 2 reaches ~45%', async () => {
  const launched = startExpedition(contract, porterId);
  assert(launched, 'startExpedition should return true');
  assert(game.activeExpedition && game.activeExpedition.status === 'active', 'expedition should be active');

  const mockAdapter = createMockMotionAdapter({ onStep: n => recordSteps(n) });

  // Leg 1: pousse jusqu'à complétion totale du raid sous-jacent (résiste aux détours qui font croître
  // targetDistanceSteps en cours de route)
  const advanced = driveUntil(mockAdapter, () => game.activeExpedition.currentLegIndex >= 1);
  assert(advanced, 'leg 1 must complete within the iteration budget');
  assertEqual(game.activeExpedition.currentLegIndex, 1, 'should have advanced to leg index 1 (2nd leg) after leg 1 completes');
  assertEqual(game.activeExpedition.legResults.length, 1, 'leg 1 result should be recorded');
  assert(game.activeRaid && game.activeRaid.status === 'active', 'leg 2 raid should now be active');

  // Leg 2: avance à exactement ~45% (jamais un franchissement de checkpoint qui ferait avancer l'étape)
  const leg2Target = game.activeRaid.targetDistanceSteps;
  const stepsFor45pct = Math.round(leg2Target * 0.45);
  mockAdapter.simulateSteps(stepsFor45pct);
  assert(game.activeRaid.status === 'active', 'still mid-leg-2, raid must still be active');
  assert(game.activeExpedition.currentLegIndex === 1, 'still on leg index 1 (2nd leg)');
});

let preSave;
await test('capture pre-save snapshot', async () => {
  preSave = JSON.parse(JSON.stringify({
    activeExpedition: game.activeExpedition,
    activeRaid: game.activeRaid,
    money: game.money,
    porters: game.porters.map(p => ({ id: p.id, status: p.status }))
  }));
  assert(preSave.activeRaid.traveledSteps > 0, 'sanity: some steps must have been traveled on leg 2');
});

await test('save, destroy RuntimeState (newGame), reload: exact resumption', async () => {
  await saveGame(true);
  // newGame() ends with its own saveGame(true) side effect (persists the fresh blank slate) — capture
  // the mid-expedition save BEFORE destroying the runtime, so we can put it back after, exactly as if
  // slot 1 had never been touched by the "menu -> new game" detour used only to blow away the live
  // singletons below.
  const persistedRaw = localStorage.getItem(saveKeyFor(1));
  assert(persistedRaw, 'sanity: save must have been written to localStorage');

  // "Détruire le RuntimeState": newGame() est le seul mécanisme réel de ce codebase qui réinitialise
  // intégralement les singletons vivants game/runtime à un état vierge (ES modules ne permettent pas
  // de réimporter un module frais sans redémarrer le processus) — exactement ce qui se produit en jeu
  // réel entre "Quitter vers le menu" et "Continuer".
  newGame(false);
  assert(game.activeExpedition === null, 'sanity: newGame() must have wiped the expedition');
  assert(game.activeRaid === null, 'sanity: newGame() must have wiped the raid');

  localStorage.setItem(saveKeyFor(1), persistedRaw); // restore the mid-expedition save newGame() just clobbered
  const loaded = await loadGame(1);
  assert(loaded, 'loadGame() should succeed');

  assertEqual(game.activeExpedition.currentLegIndex, preSave.activeExpedition.currentLegIndex, 'currentLegIndex must survive save/load exactly');
  assertEqual(game.activeExpedition.status, preSave.activeExpedition.status, 'expedition status must survive save/load exactly');
  assertEqual(JSON.stringify(game.activeExpedition.legResults), JSON.stringify(preSave.activeExpedition.legResults), 'legResults must survive save/load exactly');
  assertEqual(game.activeRaid.traveledSteps, preSave.activeRaid.traveledSteps, 'traveledSteps (45% mid-leg-2) must survive save/load exactly');
  assertEqual(game.activeRaid.targetDistanceSteps, preSave.activeRaid.targetDistanceSteps, 'targetDistanceSteps must survive save/load exactly');
  assertEqual(game.activeRaid.cargoState, preSave.activeRaid.cargoState, 'cargoState must survive save/load exactly');
  assertEqual(game.activeRaid.routeId, preSave.activeRaid.routeId, 'routeId must survive save/load exactly');
  assertEqual(game.activeRaid.status, 'active', 'raid must resume as active, not silently dropped');
  assertEqual(game.money, preSave.money, 'money must survive save/load exactly');
});

await test('resumed expedition can still be driven to completion (state is not just frozen, it is live)', async () => {
  const mockAdapter = createMockMotionAdapter({ onStep: n => recordSteps(n) });

  const advancedToLeg3 = driveUntil(mockAdapter, () => game.activeExpedition.currentLegIndex >= 2);
  assert(advancedToLeg3, 'leg 2 must complete within the iteration budget');
  assertEqual(game.activeExpedition.currentLegIndex, 2, 'should have advanced to leg index 2 (3rd/last leg)');

  const completed = driveUntil(mockAdapter, () => game.activeExpedition.status === 'completed');
  assert(completed, 'leg 3 must complete within the iteration budget');
  assertEqual(game.activeExpedition.status, 'completed', 'expedition should complete after all 3 legs');
  assertEqual(game.expeditionHistory.length, 1, 'completed expedition should be recorded in history');
  assertEqual(game.expeditionHistory[0].legCount, 3, 'history should reflect the full 3-leg expedition, not just the resumed portion');
});

summary('SaveLoadExpedition.test.js');
