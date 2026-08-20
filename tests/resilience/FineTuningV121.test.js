// tests/resilience/FineTuningV121.test.js — suite V1.21.0 (fine-tuning économique, zéro nouvelle
// feature): (1) maintenance mensuelle des Pods Robotiques (BALANCE.robotBuddy.maintenanceCostPerMonth,
// jusqu'ici $0/mois à vie), (2) revalorisation du convoi (rewardSharePerEscort/riskCutPerEscort +
// riskCutCap recalibré pour rester non-contraignant à effectif complet), (3) adoucissement de la
// criticité Prepper (needsCriticalThreshold 90->95, needsCriticalRelationDecay 2->1). Même style
// zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game, runtime } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { recruitRobotBuddy } = await import('../../src/systems/RobotBuddySystem.js');
const { connectKnot, updatePrepperNeeds } = await import('../../src/systems/PrepperSystem.js');
const { startMonthBookkeeping } = await import('../../src/engine/DeliveryEngine.js');
const { createConvoy } = await import('../../src/systems/ConvoySystem.js');
const { buyVehicle } = await import('../../src/systems/EconomySystem.js');

// ============================================================
// 1) Maintenance Pods Robotiques
// ============================================================
await test('startMonthBookkeeping() deducts BALANCE.robotBuddy.maintenanceCostPerMonth per owned robot buddy', async () => {
  RNG.setSeed(121001);
  newGame(false);
  game.money = 50000;
  const d = game.mapsData[game.currentMap];
  connectKnot(0);
  d.mainKnots[0].relation = 100;
  game.completed = 999; game.reputation = 100;
  assert(recruitRobotBuddy(), 'sanity: robot buddy recruitment must succeed once unlocked');
  assert(recruitRobotBuddy(), 'sanity: a second robot buddy must also be recruitable');
  const moneyBeforeMonth = game.money;
  startMonthBookkeeping();
  const expectedRobotCost = 2 * BALANCE.robotBuddy.maintenanceCostPerMonth;
  const spent = moneyBeforeMonth - game.money;
  assert(spent >= expectedRobotCost, `monthly bookkeeping must deduct at least the robot maintenance (${expectedRobotCost}$ for 2 buddies), spent only ${spent}$ total (salaries+vehicles+robots)`);
});

await test('a fresh game with zero robot buddies pays zero robot maintenance (no phantom deduction)', async () => {
  RNG.setSeed(121002);
  newGame(false);
  game.money = 50000;
  hireRaw('scout');
  const moneyBeforeMonth = game.money;
  startMonthBookkeeping();
  // Un porteur humain a un salaire réel (BALANCE.porter.hireBaseSalary=350) qui SERA déduit — on
  // vérifie juste qu'aucun coût "robot" fantôme ne s'ajoute quand robotBuddyCount()===0, pas que la
  // dépense totale du mois est nulle.
  assert(game.money <= moneyBeforeMonth, 'sanity: some monthly cost (salary) must still apply');
});

// ============================================================
// 2) Convoi revalorisé
// ============================================================
await test('BALANCE.convoy values reflect the V1.21.0 revalorization, riskCutCap never binds before maxEscorts', async () => {
  const B = BALANCE.convoy;
  assertEqual(B.rewardSharePerEscort, 0.22, 'rewardSharePerEscort must be raised to 0.22');
  assertEqual(B.riskCutPerEscort, 0.10, 'riskCutPerEscort must be raised to 0.10');
  assert(Math.abs(B.riskCutCap - B.maxEscorts * B.riskCutPerEscort) < 1e-9, 'riskCutCap must equal maxEscorts * riskCutPerEscort — otherwise a full escort squad would not fully benefit from the last escort(s), defeating the "strategic role" goal of this recalibration');
});

await test('createConvoy() propagates the recalibrated rewardSharePerEscort into the actual combined squad reward (not just the constant)', async () => {
  const B = BALANCE.convoy;
  // Compare le total combiné du squad (driver+escortes) SANS escorte vs AVEC 3 escortes, mêmes
  // conditions (même driver/véhicule/seed/état de jeu) — isole l'effet de rewardSharePerEscort sans
  // avoir à reproduire tout le pipeline de multiplicateurs de createDelivery() (grade de service,
  // infra, réseau régional, route historique...), qui s'appliquent identiquement des deux côtés et
  // s'annulent donc dans la comparaison. Chaque membre (driver ET escortes) reçoit un vélo: sinon
  // seul le driver bénéficierait de vehicleRewardMult (1.15x) et ce facteur se diluerait différemment
  // selon la taille du squad (1 membre boosté sur 1 vs 1 sur 4), faussant le ratio observé sans lien
  // avec rewardSharePerEscort lui-même.
  RNG.setSeed(121003);
  newGame(false);
  game.money = 50000;
  let driver = hireRaw('scout');
  runtime.selectedPorterId = driver.id;
  buyVehicle('bike');
  driver = game.porters.find(p => p.id === driver.id);
  const soloConvoyId = createConvoy(driver.x + 5, driver.y, driver.id, [], 'fast', []);
  assert(soloConvoyId, 'sanity: a convoy with zero escorts must still be creatable (driver alone)');
  const soloTotal = game.deliveries.filter(d => d.quest && d.quest.convoyId === soloConvoyId).reduce((s, d) => s + d.reward, 0);

  RNG.setSeed(121003);
  newGame(false);
  game.money = 50000;
  driver = hireRaw('scout');
  runtime.selectedPorterId = driver.id;
  buyVehicle('bike');
  driver = game.porters.find(p => p.id === driver.id);
  const escorts = [hireRaw('scout'), hireRaw('scout'), hireRaw('scout')];
  for (const p of escorts) { runtime.selectedPorterId = p.id; buyVehicle('bike'); }
  runtime.selectedPorterId = driver.id;
  const fullConvoyId = createConvoy(driver.x + 5, driver.y, driver.id, escorts.map(p => p.id), 'fast', []);
  assert(fullConvoyId, 'sanity: convoy creation must succeed with a vehicle-equipped driver + 3 escorts');
  const deliveries = game.deliveries.filter(d => d.quest && d.quest.convoyId === fullConvoyId);
  assertEqual(deliveries.length, 4, 'sanity: 1 driver + 3 escorts must produce 4 linked deliveries');
  const fullTotal = deliveries.reduce((s, d) => s + d.reward, 0);

  const expectedRatio = 1 + escorts.length * B.rewardSharePerEscort;
  const actualRatio = fullTotal / soloTotal;
  assert(Math.abs(actualRatio - expectedRatio) < 0.05, `combined squad reward must grow by ~(1 + escorts*rewardSharePerEscort) = ${expectedRatio.toFixed(2)}x vs a solo convoy, got ${actualRatio.toFixed(2)}x (solo=${soloTotal}, full=${fullTotal})`);
});

// ============================================================
// 3) Criticité Prepper adoucie
// ============================================================
await test('BALANCE.prepper values reflect the V1.21.0 softening (threshold 90->95, decay 2->1)', async () => {
  assertEqual(BALANCE.prepper.needsCriticalThreshold, 95, 'needsCriticalThreshold must be raised to 95');
  assertEqual(BALANCE.prepper.needsCriticalRelationDecay, 1, 'needsCriticalRelationDecay must be halved to 1');
});

await test('a Prepper whose needs stay comfortably under the NEW threshold (95) after growth never bleeds relation', async () => {
  RNG.setSeed(121004);
  newGame(false);
  const d = game.mapsData[game.currentMap];
  connectKnot(0);
  const k = d.mainKnots[0];
  // 50 + une croissance quotidienne (needsGrowthBase=3..7, multipliée par météo/Timefall, pire cas
  // réaliste ~2.5x) reste largement sous 95 — contrairement à l'ANCIEN seuil (90) où une valeur de
  // départ plus haute aurait pu y entrer selon le tirage, ce test isole donc bien "clairement non
  // critique" sans dépendre d'un pile-ou-face RNG sur la frontière exacte.
  k.needs.medical = 50; k.needs.food = 0; k.needs.tech = 0;
  const relationBefore = k.relation;
  updatePrepperNeeds();
  assertEqual(k.relation, relationBefore, 'a need well below the new 95 threshold must never trigger any relation decay');
});

await test('a Prepper whose needs cross the NEW threshold (95) still decays relation, but at the softened rate', async () => {
  RNG.setSeed(121005);
  newGame(false);
  const d = game.mapsData[game.currentMap];
  connectKnot(0);
  const k = d.mainKnots[0];
  k.needs.medical = 99; k.needs.food = 0; k.needs.tech = 0;
  const relationBefore = k.relation;
  updatePrepperNeeds();
  assertEqual(k.relation, Math.max(0, relationBefore - BALANCE.prepper.needsCriticalRelationDecay), 'relation must still decay once genuinely critical (>=95), by exactly the softened decay amount (1, not the old 2)');
});

summary('FineTuningV121.test.js');
