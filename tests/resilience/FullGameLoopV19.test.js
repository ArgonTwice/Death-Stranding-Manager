// tests/resilience/FullGameLoopV19.test.js — suite globale V1.9.0 (Portefeuille individuel des
// porteurs / Porter Credits): garanties vérifiées empiriquement. Même style zéro-dépendance que le
// reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { buyEquip } = await import('../../src/systems/EconomySystem.js');
const { gainPorterCredits } = await import('../../src/systems/PorterEconomy.js');
const { autoBuyEquipForIdlePorters } = await import('../../src/systems/PorterAiEngine.js');
const { eventBus } = await import('../../src/core/EventBus.js');

RNG.setSeed(1919);
newGame(false);
hireRaw('scout');
const p = game.porters[0];

await test('Porter Economy: a fresh porter starts with zero credits', async () => {
  assertEqual(p.credits, 0, 'a brand new porter must start with zero personal credits');
});

await test('Porter Economy: delivery:resolved(success) grants credits proportional to the reward, capped', async () => {
  eventBus.emit('delivery:resolved', { success: true, porterId: p.id, reward: 1000 });
  assertEqual(p.credits, Math.ceil(1000 * BALANCE.porterEconomy.creditsGainRate), 'credits gained must equal reward * creditsGainRate');
  eventBus.emit('delivery:resolved', { success: false, porterId: p.id, reward: 1000 });
  assertEqual(p.credits, Math.ceil(1000 * BALANCE.porterEconomy.creditsGainRate), 'a FAILED delivery must never grant credits — no penalty either, but no gain');
  gainPorterCredits(p.id, 1000000);
  assertEqual(p.credits, BALANCE.porterEconomy.creditsCap, 'credits must never exceed the configured cap, regardless of how much is granted');
});

await test('Porter Economy: buyEquip(payFrom="credits") spends the porter\'s own wallet, never game.money', async () => {
  const moneyBefore = game.money;
  p.credits = 5000;
  const bought = buyEquip('boots', p.id, false, 'credits');
  assertEqual(bought, true, 'purchase must succeed with sufficient personal credits');
  assertEqual(game.money, moneyBefore, 'game.money (base budget) must be completely untouched when paying from credits');
  assert(p.credits < 5000, 'the porter\'s personal credits must have been spent');
});

await test('Porter Economy: buyEquip(payFrom="credits") fails cleanly with insufficient personal credits, without touching game.money', async () => {
  p.credits = 1;
  const moneyBefore = game.money;
  const bought = buyEquip('exo', p.id, true, 'credits'); // exo est plus cher que 1 credit
  assertEqual(bought, false, 'purchase must fail with insufficient personal credits');
  assertEqual(game.money, moneyBefore, 'a failed credits purchase must never fall back to game.money silently — the caller decides the fallback');
});

await test('Porter Economy: autoBuyEquipForIdlePorters() prefers personal credits, falling back to game.money only when insufficient', async () => {
  RNG.setSeed(1919);
  newGame(false);
  hireRaw('scout');
  hireRaw('hauler');
  game.money = 50000;
  const porters = game.porters;
  porters[0].credits = 5000; // largement assez pour un achat
  porters[1].credits = 0; // devra retomber sur game.money
  const moneyBefore = game.money;
  autoBuyEquipForIdlePorters();
  assert(porters[0].credits < 5000, 'the porter with enough personal credits must have spent from their own wallet');
  assert(game.money < moneyBefore, 'the porter with zero credits must have been paid for from the base budget instead');
});

summary('FullGameLoopV19.test.js');
