// tests/resilience/RaidReputationRounding.test.js — V1.25.8: bug réel trouvé en jouant un Raid
// Tactique jusqu'au bout (audit "vraie partie"). RaidRewardResolver.js arrondit reward.reputation à 1
// décimale (ex: 16.7) pour un message de log précis — mais RaidSystem.js#completeRaid l'ajoutait TEL
// QUEL à game.reputation, le rendant fractionnaire (ex: 66.7/100) alors que TOUTES les autres sources
// de réputation du projet (CombatEngine.js/DeliveryEngine.js/NetworkSystem.js/AbsenceMuseum.js/
// Constants.js) n'utilisent que des constantes entières, et que game.reputation est affiché brut
// partout (ui/HUD.js: sbRep/rep/rank, jamais arrondi à l'affichage) — un "66.7/100" incohérent serait
// apparu dans le bandeau de stats après le tout premier Raid Tactique complété.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { recordSteps } = await import('../../src/systems/RealWalkSystem.js');
const { launchRaid } = await import('../../src/systems/raid/RaidSystem.js'); // abonnement walk:stepDetected (effet de bord) inclus

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
  const p = hireRaw();
  p.status = 'idle';
  // mexico_south (data/Routes.js): minRouteCoverage 5
  for (let i = 0; i < 6; i++) game.mapsData.mexico.routes.add(`${i},0`);
  return p;
}

for (const seed of [930, 931, 932, 933, 934]) {
  await test(`completing a Raid Tactique (seed ${seed}) always leaves game.reputation as a whole number`, async () => {
    const p = freshFixture(seed);
    const repBefore = game.reputation;
    assert(Number.isInteger(repBefore), 'sanity: reputation starts as a whole number (newGame default)');

    const launched = launchRaid('mexico_south', p.id);
    assert(launched, 'sanity: raid must launch successfully with a valid idle porter + covered route');

    recordSteps(20000); // largement assez pour couvrir tout détour possible et compléter le raid en un seul appel

    assertEqual(game.activeRaid.status, 'completed', 'sanity: the raid must have actually resolved to completed');
    assert(Number.isInteger(game.reputation), `reputation must stay a whole number after a raid reward — got ${game.reputation}`);
  });
}

summary('RaidReputationRounding.test.js');
