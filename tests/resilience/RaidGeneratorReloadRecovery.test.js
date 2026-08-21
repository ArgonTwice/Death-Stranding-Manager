// tests/resilience/RaidGeneratorReloadRecovery.test.js — V1.30.0: bug réel trouvé par revue de code
// (audit libre, pas de brief) puis confirmé empiriquement. systems/raid/RaidEventResolver.js gardait
// le générateur RNG dérivé par raid dans un Map EN MÉMOIRE (generatorCache), jamais persisté —
// contrairement à game.activeRaid lui-même, qui SURVIT explicitement à un rechargement ("peut s'étaler
// sur plusieurs sessions IRL" par design, cf. RaidSystem.js). Recharger une sauvegarde en cours de
// raid perdait donc ce cache: au prochain checkpoint, un générateur FRAIS était recréé depuis
// raidSeed, repartant de la position 0 du flux — reproduisant bit-à-bit le MÊME événement (même id,
// même detourSteps) que le tout premier checkpoint déjà résolu avant le rechargement, au lieu de
// continuer la séquence narrative. Fix: generatorFor() rattrape le flux en rejouant les tirages déjà
// consommés par raid.events (persisté) avant de servir le prochain checkpoint.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { recordSteps } = await import('../../src/systems/RealWalkSystem.js');
const { launchRaid } = await import('../../src/systems/raid/RaidSystem.js');
const { releaseRaidGenerator } = await import('../../src/systems/raid/RaidEventResolver.js');

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
  const p = hireRaw();
  p.status = 'idle';
  for (let i = 0; i < 6; i++) game.mapsData.mexico.routes.add(`${i},0`);
  return p;
}

function stepUntilNEvents(n) {
  let guard = 0;
  while (game.activeRaid.events.length < n && guard < 100) { recordSteps(200); guard++; }
  assert(game.activeRaid.events.length >= n, `sanity: expected at least ${n} checkpoint event(s) to have resolved`);
}

for (const seed of [930, 931, 932]) {
  await test(`reloading mid-raid (seed ${seed}) must NOT alter the checkpoint-event sequence vs an uninterrupted session`, () => {
    // Reference: a fully continuous session, generator cache never touched mid-raid.
    const pRef = freshFixture(seed);
    launchRaid('mexico_south', pRef.id);
    stepUntilNEvents(3);
    const referenceEvents = JSON.parse(JSON.stringify(game.activeRaid.events));
    const raidSeed = game.activeRaid.raidSeed;
    releaseRaidGenerator(raidSeed); // isolate from the next run before it (deterministically) reuses the same raidSeed

    // Interrupted: same seed -> same raidSeed -> same events IF the fix works, with a simulated
    // reload (generatorCache wipe, exactly what a real page reload does since it's never persisted)
    // injected between EVERY checkpoint.
    const pInt = freshFixture(seed);
    launchRaid('mexico_south', pInt.id);
    assertEqual(game.activeRaid.raidSeed, raidSeed, 'sanity: identical fixture setup must reproduce the identical raidSeed');
    stepUntilNEvents(1);
    releaseRaidGenerator(game.activeRaid.raidSeed); // simulate reload after checkpoint 1
    stepUntilNEvents(2);
    releaseRaidGenerator(game.activeRaid.raidSeed); // simulate reload after checkpoint 2
    stepUntilNEvents(3);
    const interruptedEvents = JSON.parse(JSON.stringify(game.activeRaid.events));

    assertEqual(JSON.stringify(interruptedEvents), JSON.stringify(referenceEvents),
      'a raid interrupted by reloads between every checkpoint must produce the EXACT same event sequence as an uninterrupted session, never a repeat of an earlier checkpoint');
  });
}

await test('a fresh (never-before-seen) raidSeed with empty priorEvents behaves exactly as before this fix — no regression on the common single-session case', () => {
  const p = freshFixture(940);
  launchRaid('mexico_south', p.id);
  stepUntilNEvents(1);
  assert(game.activeRaid.events.length === 1 && typeof game.activeRaid.events[0].id === 'string', 'the very first checkpoint of a raid must resolve normally with no prior history to replay');
});

summary('RaidGeneratorReloadRecovery.test.js');
