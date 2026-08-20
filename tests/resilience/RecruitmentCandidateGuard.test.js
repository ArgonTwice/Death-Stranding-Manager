// tests/resilience/RecruitmentCandidateGuard.test.js — V1.25.3: audit de cohérence demandé par
// l'utilisateur ("missions, popups, recrutement... que tout soit cohérent") suite au fix des quêtes
// urgentes (V1.25.2). Bug trouvé par lecture de systems/PorterSystem.js#scoutCandidate(): un candidat
// déjà scouté et non embauché était silencieusement REMPLACÉ (donc perdu, argent déjà dépensé compris)
// par un second appel à scoutCandidate(), sans le moindre avertissement — aucun test existant ne
// couvrait ce chemin (scoutCandidate importé mais jamais appelé dans FullGameLoopV18.test.js).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { scoutCandidate, dismissCandidate, hire } = await import('../../src/systems/PorterSystem.js');

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
  game.money = 5000;
}

await test('a second scoutCandidate() call while one is already pending is blocked, never silently overwritten', async () => {
  freshFixture(901);
  scoutCandidate();
  const firstCandidate = game.scoutedCandidate;
  assert(firstCandidate, 'sanity: first scout produced a pending candidate');
  const moneyAfterFirst = game.money;

  scoutCandidate(); // doit être un no-op complet (aucun fee prélevé, aucun remplacement)
  assertEqual(game.money, moneyAfterFirst, 'a blocked second scout must never charge the fee');
  assertEqual(game.scoutedCandidate, firstCandidate, 'the pending candidate must be the exact same object — never silently replaced');
});

await test('dismissCandidate() clears the pending candidate WITHOUT refunding the fee, then scouting again works normally', async () => {
  freshFixture(902);
  scoutCandidate();
  assert(game.scoutedCandidate, 'sanity: pending candidate exists');
  const moneyAfterScout = game.money;

  dismissCandidate();
  assertEqual(game.scoutedCandidate, null, 'dismissCandidate() must clear the pending candidate');
  assertEqual(game.money, moneyAfterScout, 'dismissing must never refund the scouting fee — it is a sunk cost, same as everywhere else in the economy');

  scoutCandidate(); // doit maintenant fonctionner (plus bloqué)
  assert(game.scoutedCandidate, 'scouting again after an explicit dismiss must work normally');
});

await test('hiring the scouted candidate clears it the same way dismissCandidate() does, allowing a fresh scout afterwards', async () => {
  freshFixture(903);
  scoutCandidate();
  assert(game.scoutedCandidate, 'sanity: pending candidate exists');
  hire(true);
  assertEqual(game.scoutedCandidate, null, 'hiring the candidate must clear the pending slot');
  scoutCandidate();
  assert(game.scoutedCandidate, 'scouting again after a hire must work normally, exactly like after a dismiss');
});

summary('RecruitmentCandidateGuard.test.js');
