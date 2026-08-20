// tests/resilience/MuseumReputationPrecision.test.js — V1.25.9: bug réel trouvé en jouant (audit
// "vraie partie"), visible directement dans le bandeau de stats: sceller des reliques au Musée des
// Absences (systems/AbsenceMuseum.js#sealRelic) accumule BALANCE.museum.reputationBonusPerRelic (0.4,
// un binaire flottant non exact) par additions répétées — classique bruit de précision flottante JS
// ("55.99999999999999" au lieu de 56), jamais nettoyé puisque ui/HUD.js affiche game.reputation brut
// partout (sbRep/rep/rank). Reproduit dès 5 reliques scellées (le musée en compte exactement 5).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { sealRelic } = await import('../../src/systems/AbsenceMuseum.js');
const { BALANCE } = await import('../../src/data/Balance.js');

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
}

function hasFloatingPointNoise(n) {
  // Un nombre "propre" à 1 décimale, sérialisé, ne dépasse jamais ~3-4 caractères après le point —
  // le bruit flottant classique produit des chaînes à 15+ chiffres après la virgule.
  const str = String(n);
  const decimalPart = str.split('.')[1];
  return !!decimalPart && decimalPart.length > 2;
}

await test('sealing all 5 museum relics never leaves game.reputation with floating-point noise', async () => {
  freshFixture(950);
  for (let i = 0; i < BALANCE.museum.slotCount; i++) {
    const ok = sealRelic(`Porter${i}`, `Relic ${i}`, 'bt');
    assert(ok, `sanity: sealing relic ${i}/${BALANCE.museum.slotCount} must succeed (museum not full yet)`);
    assert(!hasFloatingPointNoise(game.reputation), `game.reputation must never carry floating-point noise after sealing relic ${i} — got ${game.reputation}`);
  }
  // 5 * 0.4 = 2.0 exactly — the accumulated total must land on a clean whole number here specifically.
  assertEqual(game.reputation, 50 + BALANCE.museum.slotCount * BALANCE.museum.reputationBonusPerRelic, 'the accumulated total must match the intended math exactly, not a rounded-away approximation');
});

await test('a single relic still grants its full fractional bonus (rounding never nullifies the intended gradual accumulation)', async () => {
  freshFixture(951);
  const before = game.reputation;
  sealRelic('Solo Porter', 'Solo Relic', 'bt');
  assertEqual(game.reputation, before + BALANCE.museum.reputationBonusPerRelic, 'the very first relic must still visibly move the needle — rounding to a whole number here would silently discard it');
});

summary('MuseumReputationPrecision.test.js');
