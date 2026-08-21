// tests/resilience/AbsenceJournalRngIsolation.test.js — V1.35.0: bug réel trouvé par revue de code
// (même famille que TerminalSoul.js#pick(), V1.31.0) puis confirmé empiriquement.
// systems/NarrativeLogEngine.js#logAbsenceJournalEntry() piochait via RNG.next() (flux PARTAGÉ) mais
// n'est appelée QUE depuis TerminalSoul.js#greetOnLoad(), déclenché par un vrai loadGame() joueur — un
// événement dont le nombre d'occurrences est NON déterministe (dépend de quand/si le joueur recharge).
// Contrairement à maybeLogTelemetryLine() (même fichier, légitimement rattachée à DeliveryEngine.tick(),
// donc déterministe), cette fonction consommait 2 tirages RNG à chaque rechargement, désynchronisant
// silencieusement toute la trajectoire de simulation suivante. Fix: Math.random(), même pattern que
// TerminalSoul.js (V1.31.0).
import { installStubEnv, test, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, saveGame, loadGame, serializeGame } = await import('../../src/persistence/SaveManager.js');
const { advanceDay } = await import('../../src/engine/DeliveryEngine.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { greetOnLoad } = await import('../../src/systems/TerminalSoul.js');

function setup(seed) {
  RNG.setSeed(seed);
  newGame(false);
  game.money = 20000;
  hireRaw('scout');
  for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
}

// greetOnLoad() itself calls logEvent() (both its own greeting line and
// logAbsenceJournalEntry()'s) — those log ENTRIES will always differ between a run that reloads and
// one that doesn't (text content, not RNG stream position), so `log` is excluded here exactly like
// `terminalLastSeen` (wall-clock, also non-deterministic) — this test is about the RNG STREAM
// position going forward, not about textual log content.
function snapshotWithoutWallClock() {
  const s = serializeGame();
  delete s.terminalLastSeen;
  delete s.log;
  return JSON.stringify(s);
}

await test('a real save/reload cycle mid-run (greetOnLoad -> logAbsenceJournalEntry) must NEVER shift the deterministic simulation, same seed', async () => {
  setup(4242);
  for (let i = 0; i < 10; i++) advanceDay();
  const reference = snapshotWithoutWallClock();

  setup(4242);
  await saveGame(true);
  game.terminalLastSeen = Date.now() - 1000; // simulates real elapsed time -> greetOnLoad's absence branch runs
  await loadGame(1);
  for (let i = 0; i < 10; i++) advanceDay();
  const interrupted = snapshotWithoutWallClock();

  assertEqual(interrupted, reference, 'RNG.next() (the shared deterministic stream) must never be consumed by a real save/reload cycle — any diff here means logAbsenceJournalEntry() leaked back into RNG.js');
});

await test('calling greetOnLoad() directly (with a living porter, terminalLastSeen set) never advances RNG.next()', () => {
  // Same full setup replayed twice from the same seed (per the project's established RNG-isolation
  // test pattern): once WITHOUT greetOnLoad(), once WITH — the RNG.next() immediately after must be
  // bit-for-bit identical if greetOnLoad() never touches the shared stream.
  setup(4243);
  const without = RNG.next();

  setup(4243);
  game.terminalLastSeen = Date.now() - 5000;
  greetOnLoad();
  const withCall = RNG.next();

  assertEqual(withCall, without, 'greetOnLoad() must never consume RNG.next() — the shared stream must land on the exact same next value with or without it running');
});

summary('AbsenceJournalRngIsolation.test.js');
