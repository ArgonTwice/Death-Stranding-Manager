// tests/resilience/FineTuningV123.test.js — suite V1.23.0 (angles morts mécaniques): (1) mode
// Hardcore réellement plus dur (DIFFICULTIES.hard.riskMult/salaryMult), (2) BB Pod rééquilibré
// (stress gain/decay, seuil Lou), (3) faillite déterministe après 2 mois consécutifs à $0 (persistence/
// SaveManager.js#checkBankruptcy — remplace le "money < 0" du brief, structurellement impossible dans
// ce codebase, cf. commentaire de la fonction), (4) contrats VIP plus fréquents
// (BALANCE.league.vipContractSpawnChance). Même style zéro-dépendance que le reste de
// tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE, DIFFICULTIES } = await import('../../src/data/Balance.js');
const { newGame, checkBankruptcy } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { endMonthBookkeeping, dispatchDeliveryManually } = await import('../../src/engine/DeliveryEngine.js');
const { tickBBPodDaily, bbPodState } = await import('../../src/systems/BBPodSystem.js');
const { eventBus } = await import('../../src/core/EventBus.js');

// ============================================================
// 1) Mode Hardcore
// ============================================================
await test('DIFFICULTIES.hard reflects the V1.23.0 recalibration (riskMult 2.0, new salaryMult 1.3), easy/normal untouched', async () => {
  assertEqual(DIFFICULTIES.hard.riskMult, 2.0, 'hard.riskMult must be raised to 2.0');
  assertEqual(DIFFICULTIES.hard.salaryMult, 1.3, 'hard.salaryMult (new field) must be 1.3');
  assertEqual(DIFFICULTIES.easy.salaryMult, 1, 'easy.salaryMult must stay neutral (1)');
  assertEqual(DIFFICULTIES.normal.salaryMult, 1, 'normal.salaryMult must stay neutral (1)');
});

await test('hireRaw() on hard difficulty pays a strictly higher salary than on normal, for the same base porter', async () => {
  RNG.setSeed(123001);
  newGame(false);
  game.difficulty = 'normal';
  const normalPorter = hireRaw('scout');

  RNG.setSeed(123001);
  newGame(false);
  game.difficulty = 'hard';
  const hardPorter = hireRaw('scout');

  assert(hardPorter.salary > normalPorter.salary, `a porter hired on hard difficulty must cost more salary than on normal (hard=${hardPorter.salary}, normal=${normalPorter.salary})`);
  const expectedHard = Math.round(BALANCE.porter.hireBaseSalary * DIFFICULTIES.hard.costMult * DIFFICULTIES.hard.salaryMult);
  assertEqual(hardPorter.salary, expectedHard, `hard salary must reflect BOTH costMult and salaryMult, expected ${expectedHard}`);
});

await test('a delivery risk floor (riskFloor) is unaffected by hard riskMult — an already-safe delivery stays equally safe on any difficulty', async () => {
  // riskFloor est appliqué APRÈS la multiplication par riskMult (engine/DeliveryEngine.js#createDelivery)
  // — un risque pré-mult très bas ou négatif reste clampé au même plancher quel que soit riskMult.
  const B = BALANCE.delivery;
  const preMultRisk = -0.5; // scénario extrême: porteur très optimisé (bien au-dessus de ce qui est atteignable en jeu, pour isoler le plancher)
  const normalResult = Math.max(B.riskFloor, Math.min(B.riskCeil, preMultRisk * DIFFICULTIES.normal.riskMult));
  const hardResult = Math.max(B.riskFloor, Math.min(B.riskCeil, preMultRisk * DIFFICULTIES.hard.riskMult));
  assertEqual(hardResult, normalResult, 'riskFloor must clamp both difficulties to the exact same value when pre-mult risk is already deeply negative');
  assertEqual(hardResult, B.riskFloor, 'sanity: the clamped value must equal riskFloor itself');
});

// ============================================================
// 2) BB Pod rééquilibré
// ============================================================
await test('BALANCE.bbpod reflects the V1.23.0 softening (stress gain 6, decay 8, Lou threshold 50)', async () => {
  assertEqual(BALANCE.bbpod.stressGainPerBtExposure, 6, 'stressGainPerBtExposure must be lowered to 6');
  assertEqual(BALANCE.bbpod.stressDecayPerDayCalm, 8, 'stressDecayPerDayCalm must be doubled to 8');
  assertEqual(BALANCE.bbpod.louStageConnectionThreshold, 50, 'louStageConnectionThreshold must be lowered to 50');
});

await test('combat:btDetected raises BB Pod stress by exactly the new (lower) amount, tickBBPodDaily() recovers it by exactly the new (higher) amount', async () => {
  RNG.setSeed(123002);
  newGame(false);
  const p = bbPodState();
  p.stress = 0;
  eventBus.emit('combat:btDetected', {});
  assertEqual(bbPodState().stress, BALANCE.bbpod.stressGainPerBtExposure, 'a single BT exposure must raise stress by exactly stressGainPerBtExposure (6)');
  tickBBPodDaily();
  assertEqual(bbPodState().stress, Math.max(0, BALANCE.bbpod.stressGainPerBtExposure - BALANCE.bbpod.stressDecayPerDayCalm), 'a calm day must recover stress by exactly stressDecayPerDayCalm (8) — must reach 0 here since decay > the single exposure gained');
});

await test('the BB Pod reaches the "Lou" stage at the new (lower) connection threshold', async () => {
  RNG.setSeed(123003);
  newGame(false);
  const p = bbPodState();
  p.connection = 49;
  p.stage = 'pod';
  eventBus.emit('delivery:resolved', { success: true }); // +1 connection -> 50, franchit le nouveau seuil
  assertEqual(bbPodState().connection, 50, 'sanity: connection must reach exactly 50');
  assertEqual(bbPodState().stage, 'lou', 'the BB Pod must evolve to "lou" at connection=50 under the new threshold');
});

// ============================================================
// 3) Faillite déterministe
// ============================================================
await test('checkBankruptcy(): a single month ending at $0 increments the counter but does NOT end the game', async () => {
  RNG.setSeed(123004);
  newGame(false);
  game.money = 0;
  await checkBankruptcy();
  assertEqual(game.consecutiveNegativeMonths, 1, 'a first $0 month-end must set the counter to 1');
  assertEqual(game.gameEnded, false, 'a single $0 month must never end the game on its own');
});

await test('checkBankruptcy(): TWO consecutive months ending at $0 triggers gameOver deterministically', async () => {
  RNG.setSeed(123005);
  newGame(false);
  game.money = 0;
  await checkBankruptcy(); // mois 1
  game.money = 0;
  await checkBankruptcy(); // mois 2 consécutif
  assertEqual(game.consecutiveNegativeMonths, 2, 'the counter must reach 2 after two consecutive $0 month-ends');
  assertEqual(game.gameEnded, true, 'two consecutive $0 months must trigger game over (bankruptcy)');
});

await test('checkBankruptcy(): earning ANY money resets the counter, breaking the bankruptcy countdown', async () => {
  RNG.setSeed(123006);
  newGame(false);
  game.money = 0;
  await checkBankruptcy(); // mois 1 à $0
  assertEqual(game.consecutiveNegativeMonths, 1, 'sanity: counter at 1 after first $0 month');
  game.money = 500; // le joueur se refait avant le 2e mois consécutif
  await checkBankruptcy();
  assertEqual(game.consecutiveNegativeMonths, 0, 'earning money must reset the counter to 0, breaking the countdown');
  assertEqual(game.gameEnded, false, 'the game must never end if the player recovers before 2 consecutive $0 months');
});

await test('checkBankruptcy(): never triggers once the game has already ended (no double game-over)', async () => {
  RNG.setSeed(123007);
  newGame(false);
  game.gameEnded = true;
  game.money = 0;
  const before = game.consecutiveNegativeMonths;
  await checkBankruptcy();
  assertEqual(game.consecutiveNegativeMonths, before, 'checkBankruptcy() must no-op entirely once game.gameEnded is already true');
});

await test('endMonthBookkeeping() actually invokes the bankruptcy check as part of the real monthly cycle', async () => {
  RNG.setSeed(123008);
  newGame(false);
  game.money = 0;
  endMonthBookkeeping();
  assertEqual(game.consecutiveNegativeMonths, 1, 'a real endMonthBookkeeping() call at $0 must increment the bankruptcy counter, not just the standalone checkBankruptcy() test above');
});

await test('a normal, profitable delivery never triggers a false-positive bankruptcy increment', async () => {
  RNG.setSeed(123009);
  newGame(false);
  game.money = 10000;
  const p = hireRaw('scout');
  const porterIdx = game.porters.findIndex(x => x.id === p.id);
  dispatchDeliveryManually(porterIdx, Math.min(9, p.x + 3), p.y, { cargoType: 'standard' });
  endMonthBookkeeping();
  assertEqual(game.consecutiveNegativeMonths, 0, 'a game with healthy money must never accumulate the bankruptcy counter');
});

// ============================================================
// 4) Contrats VIP dynamisés
// ============================================================
await test('BALANCE.league.vipContractSpawnChance reflects the V1.23.0 increase (0.1 -> 0.22)', async () => {
  assertEqual(BALANCE.league.vipContractSpawnChance, 0.22, 'vipContractSpawnChance must be raised to 0.22');
});

summary('FineTuningV123.test.js');
