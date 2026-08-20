// tests/resilience/FineTuningV124.test.js — suite V1.24.0: (1) licenciement d'urgence budgétaire
// applique désormais un vrai malus de réputation (firingReputationLoss 2->8, engine/DeliveryEngine.js#
// startMonthBookkeeping), (2) faillite étendue au cas "roster vide + fonds insuffisants pour
// re-recruter" (persistence/SaveManager.js#checkBankruptcy), (3) lissage hebdomadaire du stress BB Pod
// (BALANCE.bbpod.stressWeeklyReset, systems/BBPodSystem.js#tickBBPodDaily), (4) bonus de reward lié à
// chiralMemory (BALANCE.memory.chiralMemoryRewardMult, engine/DeliveryEngine.js#createDelivery). Même
// style zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame, checkBankruptcy } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { startMonthBookkeeping, dispatchDeliveryManually } = await import('../../src/engine/DeliveryEngine.js');
const { tickBBPodDaily, bbPodState } = await import('../../src/systems/BBPodSystem.js');

// ============================================================
// 1) Licenciement d'urgence — vrai malus de réputation
// ============================================================
await test('BALANCE.delivery.firingReputationLoss reflects the V1.24.0 recalibration (2 -> 8, deviated down from the 15-20 requested — see comment)', async () => {
  assertEqual(BALANCE.delivery.firingReputationLoss, 8, 'firingReputationLoss must be raised to 8');
});

await test('startMonthBookkeeping() forced firing (unaffordable salaries) costs a real reputation hit, not the old trivial -2', async () => {
  RNG.setSeed(124001);
  newGame(false);
  game.reputation = 80;
  game.money = 10; // largement insuffisant pour payer qui que ce soit
  hireRaw('scout'); hireRaw('scout');
  const repBefore = game.reputation;
  startMonthBookkeeping();
  assertEqual(game.porters.every(p => p.status === 'left'), true, 'sanity: both porters must have been force-fired (budget=$10, unaffordable)');
  const repLoss = repBefore - game.reputation;
  assert(repLoss >= BALANCE.delivery.firingReputationLoss, `at least one firing must apply firingReputationLoss (8), got a total loss of only ${repLoss}`);
});

// ============================================================
// 2) Faillite étendue: roster vide + fonds insuffisants
// ============================================================
await test('checkBankruptcy(): an empty roster with money below hireBaseCost counts as a distress month, even with money > 0', async () => {
  RNG.setSeed(124002);
  newGame(false);
  game.porters = []; // roster entièrement vide
  game.money = 100; // > 0, mais < BALANCE.porter.hireBaseCost (500 par défaut) -> ne peut même pas recruter
  assert(game.money < BALANCE.porter.hireBaseCost, 'sanity: chosen money must be below the cheapest possible hire');
  await checkBankruptcy();
  assertEqual(game.consecutiveNegativeMonths, 1, 'a stranded roster (0 porters, cannot afford to hire) must count as a distress month even though money > 0');
});

await test('checkBankruptcy(): an empty roster with ENOUGH money to hire again does NOT count as distress', async () => {
  RNG.setSeed(124003);
  newGame(false);
  game.porters = [];
  game.money = BALANCE.porter.hireBaseCost + 500; // largement de quoi recruter
  await checkBankruptcy();
  assertEqual(game.consecutiveNegativeMonths, 0, 'an empty roster is not distress on its own if the player can still afford to hire someone');
});

await test('checkBankruptcy(): two consecutive stranded-roster months trigger real game over', async () => {
  RNG.setSeed(124004);
  newGame(false);
  game.porters = [];
  game.money = 50;
  await checkBankruptcy();
  await checkBankruptcy();
  assertEqual(game.gameEnded, true, 'two consecutive months stranded with no roster and no hiring budget must end the game');
});

// ============================================================
// 3) Lissage hebdomadaire BB Pod
// ============================================================
await test('BALANCE.bbpod.stressWeeklyReset exists and applies an EXTRA decay every 7th day', async () => {
  assertEqual(BALANCE.bbpod.stressWeeklyReset, 25, 'stressWeeklyReset must be 25');
  RNG.setSeed(124005);
  newGame(false);
  const p = bbPodState();
  p.stress = 100;
  game.month = 1; game.dayInMonth = 6; // totalDaysElapsed() = 0*30+6 = 6, pas un multiple de 7
  tickBBPodDaily();
  assertEqual(p.stress, 100 - BALANCE.bbpod.stressDecayPerDayCalm, 'day 6 must apply only the normal daily decay, no weekly bonus yet');

  game.dayInMonth = 7; // totalDaysElapsed() = 7, multiple de 7 -> décompression hebdo en plus
  tickBBPodDaily();
  const expected = Math.max(0, (100 - BALANCE.bbpod.stressDecayPerDayCalm) - BALANCE.bbpod.stressDecayPerDayCalm - BALANCE.bbpod.stressWeeklyReset);
  assertEqual(p.stress, expected, 'day 7 (a multiple of 7) must apply BOTH the daily decay AND the weekly reset bonus');
});

// ============================================================
// 4) chiralMemory lié à l'économie réelle
// ============================================================
await test('BALANCE.memory.chiralMemoryRewardMult exists (0.001) and a game with zero chiralMemory is unaffected', async () => {
  assertEqual(BALANCE.memory.chiralMemoryRewardMult, 0.001, 'chiralMemoryRewardMult must be 0.001');
});

await test('a higher game.chiralMemory yields a strictly higher delivery reward, all else equal', async () => {
  RNG.setSeed(124006);
  newGame(false);
  game.chiralMemory = 0;
  let p = hireRaw('scout');
  let porterIdx = game.porters.findIndex(x => x.id === p.id);
  dispatchDeliveryManually(porterIdx, Math.min(9, p.x + 5), p.y, { cargoType: 'standard' });
  const rewardNoMemory = game.deliveries[0].reward;

  RNG.setSeed(124006);
  newGame(false);
  game.chiralMemory = 500; // valeur élevée mais réaliste sur une longue partie
  p = hireRaw('scout');
  porterIdx = game.porters.findIndex(x => x.id === p.id);
  dispatchDeliveryManually(porterIdx, Math.min(9, p.x + 5), p.y, { cargoType: 'standard' });
  const rewardWithMemory = game.deliveries[0].reward;

  assert(rewardWithMemory > rewardNoMemory, `a delivery with chiralMemory=500 must reward more than the same delivery at chiralMemory=0 (got ${rewardWithMemory} vs ${rewardNoMemory})`);
  const expectedRatio = 1 + 500 * BALANCE.memory.chiralMemoryRewardMult;
  const actualRatio = rewardWithMemory / rewardNoMemory;
  assert(Math.abs(actualRatio - expectedRatio) < 0.01, `reward ratio must match (1 + chiralMemory * chiralMemoryRewardMult) = ${expectedRatio.toFixed(3)}, got ${actualRatio.toFixed(3)}`);
});

summary('FineTuningV124.test.js');
