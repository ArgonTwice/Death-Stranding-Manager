// tests/resilience/RewardBalance.test.js — suite V1.18.0 (valeur mise à jour V1.19.0): verrouille la
// valeur recalibrée de BALANCE.delivery.rewardDistanceMult (55) ET vérifie qu'elle se propage
// FIDÈLEMENT dans le calcul réel d'une récompense de livraison (engine/DeliveryEngine.js#createDelivery)
// — pas seulement que la constante vaut 55 dans data/Balance.js, ce qui ne prouverait rien sur son
// utilisation effective.
// Même style zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par
// runAll.mjs. Le recalibrage économique complet (archétypes, plafond 30M$/mois 20) reste couvert par
// tests/balancing-simulation.test.mjs (script séparé, invocation explicite).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE, DIFFICULTIES } = await import('../../src/data/Balance.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { dispatchDeliveryManually } = await import('../../src/engine/DeliveryEngine.js');

await test('BALANCE.delivery.rewardDistanceMult is locked to the recalibrated value (100 -> 50 -> 55)', async () => {
  assertEqual(BALANCE.delivery.rewardDistanceMult, 55, 'rewardDistanceMult must stay at the V1.19.0 recalibrated value — any future change here needs a deliberate, verified balancing pass, not an accidental edit');
});

await test('DIFFICULTIES.normal.startMoney reflects the "départ réaliste" recalibration (10000 -> 3000), easy/hard scaled proportionally', async () => {
  assertEqual(DIFFICULTIES.normal.startMoney, 3000, 'normal starting money must match the recalibrated value');
  assert(DIFFICULTIES.easy.startMoney > DIFFICULTIES.normal.startMoney, 'easy must still start with strictly more money than normal after scaling');
  assert(DIFFICULTIES.hard.startMoney < DIFFICULTIES.normal.startMoney, 'hard must still start with strictly less money than normal after scaling');
});

await test('a standard-cargo delivery reward is computed exactly as distance * rewardDistanceMult * reputation factor (no vehicle/infra/network/historic/field-structure bonus on a fresh game)', async () => {
  RNG.setSeed(118118);
  newGame(false);
  const p = hireRaw('scout');
  const porterIdx = game.porters.findIndex(x => x.id === p.id);
  const destX = Math.min(9, p.x + 5), destY = p.y; // distance connue, reste dans la grille 10x10
  const distance = Math.hypot(destX - p.x, destY - p.y);
  const ok = dispatchDeliveryManually(porterIdx, destX, destY, { cargoType: 'standard' });
  assert(ok, 'sanity: dispatch must succeed for a freshly hired idle porter');
  const d = game.deliveries[0];
  assert(d, 'sanity: a delivery must have been created');
  // cargo 'standard' a rewardMult=1 (data/Constants.js#CARGO_TYPES) — isole donc purement
  // rewardDistanceMult x le facteur de réputation, sans autre multiplicateur à reproduire ici (une
  // partie fraîche n'a ni investissement infra, ni Super-Relais régional, ni Route Historique, ni
  // structure de terrain posée — tous ces facteurs valent exactement 1).
  const expected = Math.ceil(distance * BALANCE.delivery.rewardDistanceMult * (1 + game.reputation / BALANCE.delivery.reputationRewardDivisor));
  assertEqual(d.reward, expected, `reward must be computed from the recalibrated rewardDistanceMult (55), got ${d.reward}, expected ${expected} (distance=${distance}, reputation=${game.reputation})`);
});

summary('RewardBalance.test.js');
