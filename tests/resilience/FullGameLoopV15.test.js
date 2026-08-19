// tests/resilience/FullGameLoopV15.test.js — suite globale V1.5.0 (Arbre Tech Prepper & Économie de
// Porteurs style DV2): 3 garanties demandées par la mission, vérifiées empiriquement. Même style
// zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { buyEquip, buyVehicle } = await import('../../src/systems/EconomySystem.js');
const { maxPrepperStars, connectKnot, assignPrepperContract } = await import('../../src/systems/PrepperSystem.js');
const { autoBuyEquipForIdlePorters, giftEquipmentToPorter } = await import('../../src/systems/PorterAiEngine.js');
const { EQUIP_MIN_STARS, VEHICLE_MIN_STARS } = await import('../../src/data/UnlockTree.js');
const { runtime } = await import('../../src/core/GameState.js');

// ============================================================
// 1) Déblocage technologique par étoiles — impossible d'acheter avant le seuil, possible après.
// ============================================================
RNG.setSeed(4242);
newGame(false);
game.money = 50000;
hireRaw('scout');
runtime.selectedPorterId = game.porters[0].id;

await test('Star-gated economy: exo cannot be bought with zero Prepper stars (fresh game, no knot connected)', async () => {
  assertEqual(maxPrepperStars(game.currentMap), 0, 'sanity: a fresh game has no connected Prepper, so maxPrepperStars must be 0');
  const before = game.porters[0].equipment.exo;
  const bought = buyEquip('exo');
  assertEqual(bought, false, 'buyEquip must refuse an exosquelette below its star threshold');
  assertEqual(game.porters[0].equipment.exo, before, 'no equipment must have been granted on a refused purchase');
});

await test('Star-gated economy: truck cannot be bought with zero Prepper stars (fresh game)', async () => {
  const bought = buyVehicle('truck');
  assertEqual(bought, false, 'buyVehicle must refuse a truck below its star threshold');
  assertEqual(game.porters[0].equipment.vehicle, null, 'no vehicle must have been granted on a refused purchase');
});

await test('Star-gated economy: bike (light vehicle, not in VEHICLE_MIN_STARS) remains purchasable at zero stars', async () => {
  assert(!('bike' in VEHICLE_MIN_STARS), 'sanity: bike must have no star gate — it is not a "heavy" vehicle per the mission brief');
  const bought = buyVehicle('bike');
  assertEqual(bought, true, 'bike must remain purchasable from the very start, unaffected by the new star gate');
});

await test('Star-gated economy: once a Prepper reaches the required stars, the same purchase succeeds', async () => {
  // Raccorde le premier Prepper, puis force sa relation au seuil requis pour "exo" (1 étoile = relation
  // >= 1, cf. prepperStars) — sans dépendre du RNG de génération de contrats pour rester rapide/robuste.
  game.money = 50000;
  const d = game.mapsData[game.currentMap];
  const idx = 0;
  connectKnot(idx);
  assert(d.routes.has(`${d.mainKnots[idx].x},${d.mainKnots[idx].y}`), 'sanity: connectKnot must have succeeded (budget was set high enough)');
  d.mainKnots[idx].relation = 25; // largement au-dessus du seuil de 1 étoile (starsRelationDivisor=20)
  assert(maxPrepperStars(game.currentMap) >= EQUIP_MIN_STARS.exo, 'sanity: the connected Prepper must now meet the exo star requirement');
  const bought = buyEquip('exo');
  assertEqual(bought, true, 'buyEquip must now succeed once the star requirement is met');
  assertEqual(game.porters[0].equipment.exo, 1, 'the exosquelette must have actually been granted');
});

// ============================================================
// 2) Achat autonome déterministe — zéro décalage du flux RNG.js partagé.
// ============================================================
function setupAutoBuyTest() {
  RNG.setSeed(13579);
  newGame(false);
  game.money = 50000;
  hireRaw('scout');
  hireRaw('hauler');
  const d = game.mapsData[game.currentMap];
  connectKnot(0);
  d.mainKnots[0].relation = 25; // débloque exo pour ce test
}

setupAutoBuyTest();
const autoBuyAnchorNext = RNG.next(); // Run A: juste le setup, aucun achat autonome

setupAutoBuyTest(); // Run B: même setup rejoué depuis la même seed, puis l'achat autonome à vérifier

await test('Porter AI: autoBuyEquipForIdlePorters() is deterministic and never touches the shared RNG.js stream', async () => {
  const moneyBefore = game.money;
  autoBuyEquipForIdlePorters();
  const rngAfter = RNG.next();
  assert(game.money < moneyBefore, 'sanity: at least one autonomous purchase must have actually happened (idle porters, unlocked equipment, ample budget)');
  assertEqual(rngAfter, autoBuyAnchorNext, 'autonomous purchasing must not advance the shared RNG.js stream by even one draw — it is pure deterministic priority logic, never a random pick');
});

await test('Porter AI: autoBuyEquipForIdlePorters() run twice from the same seed produces byte-identical purchases', async () => {
  setupAutoBuyTest();
  autoBuyEquipForIdlePorters();
  const stateA = JSON.stringify(game.porters.map(p => p.equipment));
  const moneyA = game.money;

  setupAutoBuyTest();
  autoBuyEquipForIdlePorters();
  const stateB = JSON.stringify(game.porters.map(p => p.equipment));

  assertEqual(stateB, stateA, 'the same starting state must always produce the exact same autonomous purchases');
  assertEqual(game.money, moneyA, 'the same starting state must always spend the exact same amount');
});

// ============================================================
// 3) Don d'équipement — gain de Likes/Lien suite à un cadeau.
// ============================================================
RNG.setSeed(9999);
newGame(false);
game.money = 50000;
hireRaw('scout');
const giftPorter = game.porters[0];
const d3 = game.mapsData[game.currentMap];
connectKnot(0);
d3.mainKnots[0].relation = 25;

await test('Gift equipment: a successful gift grants the equipment, increases porter connection ("Lien") and likes', async () => {
  const likesBefore = giftPorter.likes || 0;
  const connectionBefore = giftPorter.connection || 0;
  const equipBefore = giftPorter.equipment.exo;
  const result = giftEquipmentToPorter(giftPorter.id, 'exo');
  assertEqual(result, true, 'the gift must succeed (unlocked, affordable, slots available)');
  assertEqual(giftPorter.equipment.exo, equipBefore + 1, 'the gifted equipment must actually be granted to the porter');
  assert(giftPorter.likes > likesBefore, 'likes must increase after a successful gift');
  assert(giftPorter.connection > connectionBefore, 'connection ("Lien") must increase after a successful gift');
});

await test('Gift equipment: a refused gift (budget insufficient) grants nothing and changes nothing', async () => {
  game.money = 0;
  const likesBefore = giftPorter.likes || 0;
  const connectionBefore = giftPorter.connection || 0;
  const result = giftEquipmentToPorter(giftPorter.id, 'scanner');
  assertEqual(result, false, 'the gift must fail with zero budget');
  assertEqual(giftPorter.likes, likesBefore, 'likes must be unchanged on a refused gift');
  assertEqual(giftPorter.connection, connectionBefore, 'connection must be unchanged on a refused gift');
});

summary('FullGameLoopV15.test.js');
