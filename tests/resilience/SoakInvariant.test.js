// tests/resilience/SoakInvariant.test.js — soak test 10 seeds x 365 jours simulés (≈1 partie complète
// chacune). Vérifie à intervalles réguliers (tous les 30 jours) ET en fin de run qu'aucune valeur
// numérique ne devient NaN, qu'aucune ressource ne passe négative, et qu'aucun ID n'est dupliqué dans
// les collections identifiées (porteurs, structures de terrain). Ne vérifie PAS la déterminisme
// bit-à-bit (déjà couvert par tests/determinism-check.mjs) — uniquement l'intégrité structurelle de
// l'état sur la durée.
import { installStubEnv, test, assert, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { advanceDay } = await import('../../src/engine/DeliveryEngine.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');

const SEEDS = [1, 2, 3, 42, 777001, 999999, 123456, 654321, 8675309, 271828];
const DAYS = 365;
const CHECK_EVERY = 30;

function findNaN(obj, path, out) {
  if (obj == null) return;
  if (typeof obj === 'number') { if (Number.isNaN(obj)) out.push(path); return; }
  if (typeof obj !== 'object') return;
  if (obj instanceof Set) return;
  for (const k of Object.keys(obj)) {
    try { findNaN(obj[k], `${path}.${k}`, out); } catch (e) { /* getters that throw are not this test's concern */ }
  }
}

function findNegativeResources() {
  const out = [];
  for (const [mat, qty] of Object.entries(game.materials || {})) {
    if (typeof qty === 'number' && qty < 0) out.push(`materials.${mat}=${qty}`);
  }
  if (typeof game.chiralMemory === 'number' && game.chiralMemory < 0) out.push(`chiralMemory=${game.chiralMemory}`);
  if (typeof game.gratitudeTrace === 'number' && game.gratitudeTrace < 0) out.push(`gratitudeTrace=${game.gratitudeTrace}`);
  return out;
}

function findDuplicateIds() {
  const out = [];
  const porterIds = game.porters.map(p => p.id);
  const dupPorters = porterIds.filter((id, i) => porterIds.indexOf(id) !== i);
  if (dupPorters.length) out.push(`duplicate porter ids: ${[...new Set(dupPorters)].join(',')}`);

  const structIds = ((game.world && game.world.structures) || []).map(s => s.id);
  const dupStructs = structIds.filter((id, i) => structIds.indexOf(id) !== i);
  if (dupStructs.length) out.push(`duplicate world.structures ids: ${[...new Set(dupStructs)].join(',')}`);

  return out;
}

function checkInvariants(seed, day) {
  const nanPaths = [];
  findNaN(game.money, 'money', nanPaths);
  findNaN(game.reputation, 'reputation', nanPaths);
  findNaN(game.materials, 'materials', nanPaths);
  game.porters.forEach((p, i) => findNaN(p, `porters[${i}]`, nanPaths));
  ((game.world && game.world.structures) || []).forEach((s, i) => findNaN(s, `world.structures[${i}]`, nanPaths));
  if (game.activeRaid) findNaN(game.activeRaid, 'activeRaid', nanPaths);

  assert(nanPaths.length === 0, `seed ${seed} day ${day}: NaN found at ${nanPaths.join(', ')}`);

  const negatives = findNegativeResources();
  assert(negatives.length === 0, `seed ${seed} day ${day}: negative resources: ${negatives.join(', ')}`);

  const dupes = findDuplicateIds();
  assert(dupes.length === 0, `seed ${seed} day ${day}: ${dupes.join(', ')}`);
}

for (const seed of SEEDS) {
  await test(`seed ${seed}: 365 simulated days, zero NaN / negative resources / duplicate ids (checked every ${CHECK_EVERY} days)`, async () => {
    RNG.setSeed(seed);
    newGame(false);
    game.money = 20000;
    ['scout', 'hauler', 'driver', 'dooms'].forEach(s => hireRaw(s));
    for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);

    checkInvariants(seed, 0);
    for (let day = 1; day <= DAYS; day++) {
      advanceDay();
      if (day % CHECK_EVERY === 0 || day === DAYS) checkInvariants(seed, day);
    }
  });
}

summary('SoakInvariant.test.js');
