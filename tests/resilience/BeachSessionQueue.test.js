// tests/resilience/BeachSessionQueue.test.js — V1.29.0: bug réel trouvé en jouant une vraie partie
// (audit libre, pas de brief). game.beachSession (systems/TheBeachEngine.js) était un slot unique —
// DeliveryEngine.tick() itère TOUTES les livraisons dans la même passe, donc si 2 porteurs meurent
// dans le MÊME tick (avant que le joueur résolve la 1re séquence, asynchrone côté UI), le 2e
// triggerBeachSequence() écrasait silencieusement la session du 1er: pas de relique possible, pas de
// message de mémoire, aucune trace de sa mort dans "Le Rivage". Fix: game.beachQueue met en attente
// toute session déclenchée pendant qu'une autre est déjà active et non résolue.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { triggerBeachSequence, resolveBeachChoice } = await import('../../src/systems/TheBeachEngine.js');

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
}

function fakePorter(id, name) {
  return { id, name };
}

await test('a 2nd death in the same tick queues instead of overwriting the 1st unresolved session', () => {
  freshFixture(500);
  triggerBeachSequence(fakePorter(0, 'Sam'), 'néantisé');
  const firstPorterName = game.beachSession.porterName;
  assertEqual(firstPorterName, 'Sam', 'sanity: the first session must belong to the first porter');

  triggerBeachSequence(fakePorter(1, 'Fragile'), 'néantisé');
  assertEqual(game.beachSession.porterName, 'Sam', 'the active session must NOT be overwritten by a 2nd death in the same tick');
  assertEqual(game.beachQueue.length, 1, 'the 2nd death must be queued, not lost');
  assertEqual(game.beachQueue[0].porterName, 'Fragile', 'the queued session must belong to the 2nd porter');
});

await test('resolving the current session auto-advances to the queued one, losing neither', () => {
  freshFixture(501);
  triggerBeachSequence(fakePorter(0, 'Sam'), 'néantisé');
  triggerBeachSequence(fakePorter(1, 'Fragile'), 'néantisé');

  resolveBeachChoice('memory'); // resolves Sam's session
  assert(game.beachSession !== null, 'Fragile\'s queued session must automatically become the active one');
  assertEqual(game.beachSession.porterName, 'Fragile', 'the dequeued session must be Fragile\'s, not lost or scrambled');
  assertEqual(game.beachSession.resolved, false, 'the newly-active dequeued session must start unresolved');
  assertEqual(game.beachQueue.length, 0, 'the queue must be empty once its only entry has been dequeued');

  resolveBeachChoice('relic'); // resolves Fragile's session
  assertEqual(game.beachSession, null, 'once both sessions are resolved and the queue is empty, beachSession must clear to null');
});

await test('3 near-simultaneous deaths all get resolved in order, none silently dropped', () => {
  freshFixture(502);
  triggerBeachSequence(fakePorter(0, 'A'), 'néantisé');
  triggerBeachSequence(fakePorter(1, 'B'), 'néantisé');
  triggerBeachSequence(fakePorter(2, 'C'), 'néantisé');
  assertEqual(game.beachQueue.length, 2, 'the 2nd and 3rd deaths must both queue behind the active 1st session');

  const order = [];
  order.push(game.beachSession.porterName);
  resolveBeachChoice('memory');
  order.push(game.beachSession.porterName);
  resolveBeachChoice('memory');
  order.push(game.beachSession.porterName);
  resolveBeachChoice('memory');

  assertEqual(JSON.stringify(order), JSON.stringify(['A', 'B', 'C']), 'all 3 deaths must be presented in FIFO order, none skipped or duplicated');
  assertEqual(game.beachSession, null, 'after resolving all 3, no session should remain active');
  assertEqual(game.beachQueue.length, 0, 'after resolving all 3, the queue must be empty');
});

await test('a single death (the common case) behaves exactly as before — no queue involved', () => {
  freshFixture(503);
  triggerBeachSequence(fakePorter(0, 'Sam'), 'néantisé');
  assertEqual(game.beachQueue.length, 0, 'a single death must never populate the queue');
  resolveBeachChoice('memory');
  assertEqual(game.beachSession, null, 'a single resolved death must clear beachSession to null, exactly as before this fix');
});

await test('a fresh game starts with an empty beachQueue', () => {
  freshFixture(504);
  assert(Array.isArray(game.beachQueue) && game.beachQueue.length === 0, 'newGame() must always reset beachQueue to an empty array');
});

summary('BeachSessionQueue.test.js');
