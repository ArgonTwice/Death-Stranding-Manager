// tests/resilience/FullGameLoopV110.test.js — suite globale V1.10.0 (Bâtiments de Camp additionnels
// & Festivals du Réseau): garanties vérifiées empiriquement. Même style zéro-dépendance que le reste
// de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { STRUCTURES, FESTIVALS } = await import('../../src/data/Constants.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw, forceRest, restCostMult } = await import('../../src/systems/PorterSystem.js');
const { buildStructure } = await import('../../src/systems/EconomySystem.js');
const { dominantStructure } = await import('../../src/engine/MapEngine.js');
const { festivalValue } = await import('../../src/engine/DeliveryEngine.js');

// ============================================================
// 1) Bâtiments de Camp additionnels — construits via le système générique existant.
// ============================================================
RNG.setSeed(110110);
newGame(false);
game.money = 100000;
hireRaw('scout');
const p = game.porters[0];

await test('Camp Buildings: the 3 new building types exist in the generic STRUCTURES table', async () => {
  assert('privateRoom' in STRUCTURES, 'Chambre Privée must be registered');
  assert('canteen' in STRUCTURES, 'Cantine must be registered');
  assert('magellanBase' in STRUCTURES, 'Base Mobile Magellan must be registered');
});

await test('Camp Buildings: Chambre Privée dominant reduces forceRest() cost', async () => {
  p.stress = 50;
  const costBefore = Math.ceil((p.salary / 2) * (1 + p.stress / 100));
  buildStructure('privateRoom');
  assertEqual(dominantStructure(), 'privateRoom', 'sanity: privateRoom must be the only (and therefore dominant) structure built');
  assertEqual(restCostMult(), BALANCE.campBuildings.privateRoomRestCostMult, 'restCostMult() must reflect the dominant Chambre Privée discount');
  const moneyBefore = game.money;
  forceRest(0);
  const actualCost = moneyBefore - game.money;
  assertEqual(actualCost, Math.ceil(costBefore * BALANCE.campBuildings.privateRoomRestCostMult), 'forceRest() must actually charge the discounted cost, not the base one');
});

await test('Camp Buildings: only the single dominant structure applies its bonus (never cumulative)', async () => {
  RNG.setSeed(110111);
  newGame(false);
  game.money = 100000;
  hireRaw('scout');
  buildStructure('privateRoom');
  buildStructure('privateRoom'); // niveau 2
  buildStructure('canteen'); // niveau 1, encore inférieur à privateRoom niveau 2
  assertEqual(dominantStructure(), 'privateRoom', 'privateRoom (level 2) must remain dominant over canteen (level 1)');
  assertEqual(restCostMult(), BALANCE.campBuildings.privateRoomRestCostMult, 'the Chambre Privée discount must still apply — canteen has no rest-cost effect anyway, but dominance must be respected');
});

// ============================================================
// 2) Festival du Réseau — déjà entièrement implémenté (data/Constants.js#FESTIVALS 'chiral_fest'),
// vérifié plutôt que dupliqué dans un second système parallèle.
// ============================================================
await test('Network Festival: "Festival du Réseau Chiral" already exists in FESTIVALS and boosts questMult temporarily', async () => {
  const chiralFest = FESTIVALS.find(f => f.id === 'chiral_fest');
  assert(chiralFest, 'chiral_fest must exist in the FESTIVALS pool — the "Festival du Réseau" requested by the brief');
  assertEqual(chiralFest.effect, 'questMult', 'sanity: this festival boosts quest/raid rewards, matching "booster temporairement les performances de la base"');

  RNG.setSeed(110112);
  newGame(false);
  assertEqual(festivalValue('questMult'), 0, 'sanity: no festival active on a fresh game');
  game.activeFestival = chiralFest;
  assertEqual(festivalValue('questMult'), chiralFest.value, 'festivalValue() must reflect the active festival\'s boost while it lasts');
  game.activeFestival = null;
  assertEqual(festivalValue('questMult'), 0, 'the boost must be gone once the festival ends');
});

summary('FullGameLoopV110.test.js');
