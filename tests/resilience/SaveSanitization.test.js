// tests/resilience/SaveSanitization.test.js — suite V1.16.0: SaveManager.js#sanitizeGame() (filet de
// sécurité post-désérialisation, reclampe les champs numériques dans des bornes valides) + la
// ré-hydratation de game.visitor depuis le pool canonique VISITOR_OFFERS (un visiteur en attente ne
// doit jamais planter au chargement, closure d'effet perdue par la sérialisation JSON ou non). Même
// style zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, assertDeepEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { VISITOR_OFFERS } = await import('../../src/data/Constants.js');
const { newGame, loadGame, saveKeyFor, sanitizeGame } = await import('../../src/persistence/SaveManager.js');
const { acceptVisitorOffer } = await import('../../src/engine/DeliveryEngine.js');

RNG.setSeed(116116);
newGame(false);
game.money = 10000;

// ============================================================
// 1) sanitizeGame() en unité — valeurs aberrantes injectées DIRECTEMENT sur game.*, sans passer par
// une sauvegarde, pour isoler le comportement de la fonction elle-même.
// ============================================================
await test('sanitizeGame(): clamps out-of-range top-level numeric fields into their valid ranges', async () => {
  game.money = -50000;
  game.reputation = 99999;
  game.loyalty = -400;
  game.chiralMemory = -12;
  game.gratitudeTrace = -3;
  game.totalSteps = -1;
  game.completed = -9;
  game.deaths = -1;
  sanitizeGame();
  assertEqual(game.money, 0, 'money must never end up negative after sanitization');
  assertEqual(game.reputation, 100, 'reputation must be clamped to [0,100]');
  assertEqual(game.loyalty, 0, 'loyalty must be clamped to [0,100]');
  assertEqual(game.chiralMemory, 0, 'chiralMemory must never end up negative');
  assertEqual(game.gratitudeTrace, 0, 'gratitudeTrace must never end up negative');
  assertEqual(game.totalSteps, 0, 'totalSteps must never end up negative');
  assertEqual(game.completed, 0, 'completed must never end up negative');
  assertEqual(game.deaths, 0, 'deaths must never end up negative');
});

await test('sanitizeGame(): clamps corrupted materials to zero-or-above', async () => {
  game.materials.chiral_crystal = -7;
  game.materials.mule_scrap = -1;
  sanitizeGame();
  assert(game.materials.chiral_crystal >= 0, 'chiral_crystal must never end up negative');
  assert(game.materials.mule_scrap >= 0, 'mule_scrap must never end up negative');
});

await test('sanitizeGame(): clamps corrupted porter fields (health/stress/gearWear/credits/xp/level)', async () => {
  const { hireRaw } = await import('../../src/systems/PorterSystem.js');
  hireRaw('scout');
  const p = game.porters[game.porters.length - 1];
  p.health = -500; p.stress = 250; p.gearWear = 999; p.credits = 999999; p.xp = -20; p.level = 0; p.likes = -5;
  sanitizeGame();
  assert(p.health >= 0 && p.health <= 100, `health must be in [0,100], got ${p.health}`);
  assert(p.stress >= 0 && p.stress <= 100, `stress must be in [0,100], got ${p.stress}`);
  assert(p.gearWear >= 0 && p.gearWear <= 100, `gearWear must be in [0,100], got ${p.gearWear}`);
  assertEqual(p.credits, BALANCE.porterEconomy.creditsCap, 'credits must be clamped to the anti-exploit cap');
  assertEqual(p.xp, 0, 'xp must never end up negative');
  assertEqual(p.level, 1, 'level must never end up below 1');
  assertEqual(p.likes, 0, 'likes must never end up negative');
});

await test('sanitizeGame(): a NaN/non-number value falls back to a sane default instead of propagating', async () => {
  game.money = NaN;
  game.reputation = 'not-a-number';
  sanitizeGame();
  assert(!Number.isNaN(game.money), 'money must never remain NaN after sanitization');
  assertEqual(typeof game.reputation, 'number', 'reputation must be coerced back to a number');
});

await test('sanitizeGame(): idempotent — running it again on an already-sane state changes nothing', async () => {
  sanitizeGame();
  const before = JSON.stringify({ money: game.money, reputation: game.reputation, porters: game.porters.map(p => ({ health: p.health, stress: p.stress, gearWear: p.gearWear })) });
  sanitizeGame();
  const after = JSON.stringify({ money: game.money, reputation: game.reputation, porters: game.porters.map(p => ({ health: p.health, stress: p.stress, gearWear: p.gearWear })) });
  assertEqual(after, before, 'a second call on already-valid data must be a no-op');
});

await test('sanitizeGame(): reassigns duplicate/corrupted porter ids to a clean id=index sequence, deterministically', async () => {
  const { hireRaw } = await import('../../src/systems/PorterSystem.js');
  RNG.setSeed(120001);
  newGame(false);
  hireRaw('scout'); hireRaw('scout'); hireRaw('scout');
  // Simule une sauvegarde corrompue/éditée à la main: ids dupliqués/incohérents (jamais produit par
  // le jeu réel — hireRaw() assigne toujours id=game.porters.length, jamais modifié ailleurs, cf.
  // grep exhaustif documenté dans le commit V1.19.0). sanitizeGame() doit tout de même reconstituer
  // une séquence d'ids propre et unique plutôt que de laisser des doublons se propager en aval
  // (game.bonds/game.duos, DeliveryEngine.js#bondKey, sont keyed sur ces ids).
  game.porters[0].id = 7;
  game.porters[1].id = 7;
  game.porters[2].id = 7;
  sanitizeGame();
  const ids = game.porters.map(p => p.id);
  assertEqual(new Set(ids).size, ids.length, `porter ids must all be unique after sanitizeGame(), got [${ids.join(',')}]`);
  assertDeepEqual(ids, [0, 1, 2], 'sanitizeGame() must reindex to a clean 0..N-1 sequence matching array order, exactly like hireRaw() does on a real hire');
});

await test('sanitizeGame(): a legitimate save (ids already matching array index) is left untouched — the reindex is a no-op for real gameplay', async () => {
  const { hireRaw } = await import('../../src/systems/PorterSystem.js');
  RNG.setSeed(120002);
  newGame(false);
  hireRaw('scout'); hireRaw('scout');
  const idsBefore = game.porters.map(p => p.id);
  sanitizeGame();
  const idsAfter = game.porters.map(p => p.id);
  assertDeepEqual(idsAfter, idsBefore, 'a save produced by real gameplay (id already == index) must never have its ids changed by sanitizeGame()');
});

// ============================================================
// 2) Intégration — save() STRUCTURELLEMENT valide mais avec des VALEURS corrompues (distinct de
// SaveCorruption.test.js, qui couvre le JSON invalide menant au fallback newGame()) : loadGame() doit
// automatiquement appeler sanitizeGame() et livrer un état jouable.
// ============================================================
await test('loadGame() on a structurally valid save with semantically corrupted values yields sane game.* afterward', async () => {
  RNG.setSeed(116117);
  newGame(false);
  const corrupted = {
    v: 3, money: -999999, month: 2, reputation: 5000, completed: 3, deaths: 0,
    porters: [{ id: 0, name: 'Test', skill: 'scout', trait: 'early_riser', health: -80, stress: 400, gearWear: 250, credits: 50000, xp: -5, level: 0, equipment: {}, grades: {}, status: 'idle', map: 'mexico', x: 5, y: 5 }],
    structures: {}, currentMap: 'mexico', mapsData: { mexico: { branches: [{ x: 5, y: 5 }], activeBranch: 0, routes: ['5,5'], craters: [], btZones: [], terrain: {} } },
    materials: { chiral_crystal: -10, mule_scrap: -3 }, equipBought: {}, loyalty: -9999
  };
  localStorage.setItem(saveKeyFor(1), JSON.stringify(corrupted));
  const loaded = await loadGame(1);
  assert(loaded, 'a structurally valid save (even with bad values) must still load successfully');
  assert(game.money >= 0, `money must be sanitized to >= 0 after load, got ${game.money}`);
  assert(game.reputation >= 0 && game.reputation <= 100, `reputation must be sanitized to [0,100] after load, got ${game.reputation}`);
  assert(game.loyalty >= 0 && game.loyalty <= 100, `loyalty must be sanitized to [0,100] after load, got ${game.loyalty}`);
  const p = game.porters[0];
  assert(p.health >= 0 && p.health <= 100, `loaded porter health must be sanitized to [0,100], got ${p.health}`);
  assert(p.stress >= 0 && p.stress <= 100, `loaded porter stress must be sanitized to [0,100], got ${p.stress}`);
  assert(p.gearWear >= 0 && p.gearWear <= 100, `loaded porter gearWear must be sanitized to [0,100], got ${p.gearWear}`);
  assert(p.credits <= BALANCE.porterEconomy.creditsCap, `loaded porter credits must respect the cap, got ${p.credits}`);
  assert(game.materials.chiral_crystal >= 0, 'loaded materials must never be negative');
});

// ============================================================
// 3) game.visitor — ré-hydratation depuis le pool canonique (fixe la perte de closure d'effet à la
// sérialisation JSON) pour TOUTE offre, pas seulement 'mercenary' (désormais une clé symbolique).
// ============================================================
await test('a pending visitor offer survives a save/load round-trip and can still be accepted without throwing', async () => {
  RNG.setSeed(116118);
  newGame(false);
  game.money = 10000;
  const offer = VISITOR_OFFERS.find(o => o.id === 'medic'); // une offre à effet FONCTION (closure), le cas général
  assert(offer, 'sanity: the medic offer must exist in the canonical pool');
  game.visitor = { ...offer, expiresMonth: game.month + 2 };
  const { saveGame } = await import('../../src/persistence/SaveManager.js');
  await saveGame(true);
  // Blanchit l'état EN MÉMOIRE sans re-sauvegarder: newGame() autosave en fin d'appel (dernière ligne
  // de sa propre définition) écraserait le slot 1 qu'on vient juste de sauvegarder avec le visiteur —
  // exactement le piège qui a fait échouer ce test la première fois qu'il a été écrit.
  game.visitor = null;
  const loaded = await loadGame(1);
  assert(loaded, 'sanity: the save must load successfully');
  assert(game.visitor, 'the pending visitor offer must survive the round-trip');
  assertEqual(game.visitor.id, 'medic', 'the reloaded visitor must be the same offer');
  assertEqual(typeof game.visitor.effect, 'function', 're-hydrated from the canonical pool, the effect function must be intact (never lost to JSON serialization)');
  let threw = false;
  game.money = 10000;
  try { acceptVisitorOffer(); } catch (e) { threw = true; }
  assert(!threw, 'accepting a reloaded visitor offer must never throw (this was the actual bug: v.effect() on a JSON-stripped function)');
  assertEqual(game.visitor, null, 'accepting the offer must clear it as usual');
});

await test('the "mercenary" offer (symbolic effect key, not a closure) hires a porter when accepted', async () => {
  RNG.setSeed(116119);
  newGame(false);
  game.money = 10000;
  const before = game.porters.length;
  const offer = VISITOR_OFFERS.find(o => o.id === 'mercenary');
  assertEqual(offer.effect, 'hirePorter', 'sanity: mercenary must use the symbolic key, not a closure (that closure is what forced data/Constants.js to import systems/PorterSystem.js)');
  game.visitor = { ...offer, expiresMonth: game.month + 2 };
  acceptVisitorOffer();
  assertEqual(game.porters.length, before + 1, 'accepting the mercenary offer must still actually hire a porter, via engine/DeliveryEngine.js#acceptVisitorOffer resolving the symbolic key');
});

summary('SaveSanitization.test.js');
