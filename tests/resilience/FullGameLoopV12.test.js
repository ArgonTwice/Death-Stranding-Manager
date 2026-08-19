// tests/resilience/FullGameLoopV12.test.js — suite globale V1.2.0 (Version Finale Intégrale &
// Polish): 4 garanties transverses demandées par la mission, chacune vérifiée empiriquement plutôt
// que supposée. Même style zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs),
// auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv({ withHistory: true });

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame, serializeGame, deserializeGame } = await import('../../src/persistence/SaveManager.js');
const { advanceDay } = await import('../../src/engine/DeliveryEngine.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { engageCatcher, buyConsumable } = await import('../../src/engine/CombatEngine.js');
const { resolveCatcherEncounter } = await import('../../src/systems/raid/CombatResolver.js');
const { initNavigation } = await import('../../src/core/NavigationManager.js');
const { initMainNav, setMainTab, closeMainNav } = await import('../../src/ui/NavigationManager.js');
const { renderMissionsPanel } = await import('../../src/ui/MissionsPanel.js');
const { renderBridgesMap } = await import('../../src/ui/BridgesMap.js');

initNavigation();
initMainNav();

function snapshotWithoutWallClock() {
  const s = serializeGame();
  delete s.terminalLastSeen;
  return JSON.stringify(s);
}

// ============================================================
// 1) Determinism Replay Test — même seed + même suite de commandes = même GameState final bit-à-bit.
// ============================================================
function playScript() {
  newGame(false);
  game.money = 25000;
  hireRaw('scout'); hireRaw('hauler'); hireRaw('driver');
  for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
  for (let i = 0; i < 20; i++) advanceDay();
}

RNG.setSeed(555111);
playScript();
const replayA = snapshotWithoutWallClock();

RNG.setSeed(555111);
playScript();
const replayB = snapshotWithoutWallClock();

await test('Determinism Replay: same seed + same command script produces bit-identical final GameState', async () => {
  assertEqual(replayB, replayA, 'two runs with the same seed and the same command sequence must diverge by zero bytes');
});

// ============================================================
// 2) Save/Load Round-Trip — serialize -> deserialize -> serialize doit être idempotent.
// ============================================================
await test('Save/Load Round-Trip: serialize(deserialize(serialize(x))) === serialize(deserialize(x)) — idempotent once loaded', async () => {
  // Le GameState VIVANT peut contenir des porteurs "en route" (livraison en cours, jamais persistée
  // par design — cf. deserializeGame: "Livraisons en cours non persistées: les porteurs en route
  // repartent idle"). Un premier deserialize() normalise donc déjà ce champ AVANT toute comparaison,
  // exactement comme un vrai chargement le ferait: la propriété testée ici est que le résultat d'UN
  // chargement reste ensuite parfaitement stable à travers des cycles save/load répétés — pas que
  // l'état vivant en pleine simulation égale un save (ce qu'aucun jeu à sauvegarde ne garantit).
  deserializeGame(JSON.parse(JSON.stringify(serializeGame())));
  const loadedOnce = serializeGame();
  const loadedOnceStripped = { ...loadedOnce }; delete loadedOnceStripped.terminalLastSeen;
  deserializeGame(JSON.parse(JSON.stringify(loadedOnce)));
  const loadedTwice = serializeGame();
  const loadedTwiceStripped = { ...loadedTwice }; delete loadedTwiceStripped.terminalLastSeen;
  assertEqual(JSON.stringify(loadedTwiceStripped), JSON.stringify(loadedOnceStripped), 'once a save has been loaded, repeating save/load must not drift, even by one field');
});

await test('Save/Load Round-Trip: a pre-V1.1 save (no progression field) is grandfathered, not corrupted', async () => {
  const legacy = serializeGame();
  delete legacy.progression; // simule une sauvegarde antérieure à V1.1 (champ inexistant)
  deserializeGame(legacy);
  assertEqual(game.progression.realWalk.unlocked, true, 'a save with no progression field at all must grandfather RealWalk as unlocked (V1.1 rule, deserializeGame comment)');
});

// ============================================================
// 3) Headless Combat Test — résolution Catcher BT sans DOM ni UI, calcul pur ET intégration moteur.
// ============================================================
await test('Headless Combat: resolveCatcherEncounter is a pure function (no game/DOM access, deterministic per rng)', async () => {
  const B = BALANCE.combat;
  const context = { B, squadSize: 2, campStrength: 2, bloodBagsUsed: 1, successChance: 1.0 }; // 100%: force la branche succès, sans dépendre d'un tirage
  const rngA = RNG.deriveGenerator(99);
  const rngB = RNG.deriveGenerator(99);
  const resultA = resolveCatcherEncounter(context, rngA);
  const resultB = resolveCatcherEncounter(context, rngB);
  assertEqual(resultA.success, true, 'successChance=1.0 must always resolve to success');
  assertEqual(JSON.stringify(resultA), JSON.stringify(resultB), 'same seed into the pure resolver must yield the exact same outcome, independent of any game/DOM state');
});

RNG.setSeed(2024);
newGame(false);
game.money = 10000;
hireRaw('scout'); hireRaw('hauler');
for (const p of game.porters) p.health = 100;
game.materials.blood_grenades = 10;
game.materials.blood_bags = 10;
game.mapsData[game.currentMap].catchers = [{ id: 'test-catcher', x: 1, y: 1, strength: 1 }];
game.catchers = game.mapsData[game.currentMap].catchers;

await test('Headless Combat: engageCatcher() resolves fully through pure engine calls, zero DOM required', async () => {
  const moneyBefore = game.money;
  buyConsumable('blood_grenades'); // le stub localStorage/document suffit; aucun canvas/DOM réel touché
  assert(game.money < moneyBefore, 'buyConsumable must have spent money — proves the engine call chain actually ran headless');
  engageCatcher('test-catcher');
  assert((game.mapsData[game.currentMap].catchers || []).find(c => c.id === 'test-catcher') === undefined, 'the engaged catcher must be removed from the map regardless of outcome');
});

// ============================================================
// 4) RNG Isolation Test — 100 navigations + 100 resizes = 0 RNG consommé.
// ============================================================
RNG.setSeed(31337);
newGame(false);
game.money = 15000;
hireRaw('scout');
for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
for (let i = 0; i < 10; i++) advanceDay();
const preIsolationSnapshot = snapshotWithoutWallClock();
const referenceNextValue = RNG.next(); // ancre: tout tirage RNG ultérieur non-attendu ferait diverger cette valeur

RNG.setSeed(31337); // rejoue le MÊME point de départ pour comparer avec/sans les 200 interactions UI
newGame(false);
game.money = 15000;
hireRaw('scout');
for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
for (let i = 0; i < 10; i++) advanceDay();
assertEqual(snapshotWithoutWallClock(), preIsolationSnapshot, 'sanity: replaying the setup script alone must match the anchor run before any UI interaction is injected');

await test('RNG Isolation: 100 navigations (5 onglets) consume zero RNG', async () => {
  for (let i = 0; i < 100; i++) {
    setMainTab(['dashboard', 'livraisons', 'reseau', 'logistique', 'options'][i % 5]);
    closeMainNav();
  }
  assertEqual(RNG.next(), referenceNextValue, 'after 100 tab navigations, the RNG stream must be at the exact same position as if nothing had happened');
});

RNG.setSeed(31337);
newGame(false);
game.money = 15000;
hireRaw('scout');
for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
for (let i = 0; i < 10; i++) advanceDay();

await test('RNG Isolation: 100 canvas resizes + re-renders (BridgesMap.js) consume zero RNG', async () => {
  const canvas = document.getElementById('missionsMapCanvas');
  for (let i = 0; i < 100; i++) {
    canvas.width = 800 + (i % 5) * 10; // simule un redimensionnement fenêtre/rotation réel
    canvas.height = 420 + (i % 5) * 5;
    renderMissionsPanel();
    renderBridgesMap('missionsMapCanvas');
  }
  assertEqual(RNG.next(), referenceNextValue, 'after 100 resize+re-render cycles, the RNG stream must be at the exact same position as if nothing had happened');
});

summary('FullGameLoopV12.test.js');
