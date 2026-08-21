// tests/resilience/TerminalRngIsolation.test.js — V1.31.0: bug réel trouvé par revue de code (audit
// libre, pas de brief) puis confirmé empiriquement. systems/TerminalSoul.js#pick() (flavor text du
// Terminal: LISTEN, SING, greeting au chargement, avertissement de ralentissement) piochait via
// RNG.next() — le flux PARTAGÉ que toute la simulation utilise pour rester bit-à-bit reproductible.
// Mais ce module dépend explicitement de facteurs NON déterministes (Date.now(), saisie libre du
// joueur au Terminal) — exactement ce que core/RNG.js interdit dans son propre en-tête ("volontairement
// PAS utilisé pour les effets purement cosmétiques... dont le nombre d'appels dépend [de facteurs] non
// déterministes"). Confirmé: avec la même seed, taper UNE SEULE fois "LISTEN" avant de simuler 30
// jours suffisait à faire diverger tout l'état de partie (argent, réputation, etc.) par rapport à une
// run identique sans cette commande. Fix: Math.random(), même pattern déjà établi pour tout le
// contenu purement cosmétique du projet (audio/SoundEngine.js, pluie du canvas).
import { installStubEnv, test, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, serializeGame } = await import('../../src/persistence/SaveManager.js');
const { advanceDay } = await import('../../src/engine/DeliveryEngine.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { processTerminalCommand } = await import('../../src/systems/TerminalSoul.js');

function setup(seed) {
  RNG.setSeed(seed);
  newGame(false);
  game.money = 20000;
  ['scout', 'hauler', 'driver'].forEach(s => hireRaw(s));
  for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
}

// terminalLastSeen is a real Date.now() wall-clock timestamp, deliberately non-deterministic and
// already excluded by RngUiOrthogonality.test.js's own snapshot helper — same exclusion here.
function snapshotWithoutWallClock() {
  const s = serializeGame();
  delete s.terminalLastSeen;
  return JSON.stringify(s);
}

await test('typing Terminal commands (LISTEN/SING/STAY) must NEVER shift the deterministic simulation, same seed', () => {
  setup(9001);
  for (let i = 0; i < 20; i++) advanceDay();
  const reference = snapshotWithoutWallClock();

  setup(9001);
  processTerminalCommand('LISTEN');
  processTerminalCommand('SING');
  processTerminalCommand('STAY');
  processTerminalCommand('LISTEN');
  for (let i = 0; i < 20; i++) advanceDay();
  const withCommands = snapshotWithoutWallClock();

  assertEqual(withCommands, reference, 'RNG.next() (the shared deterministic stream) must never be consumed by Terminal flavor text — any diff here means pick() leaked back into RNG.js');
});

await test('the number of Terminal commands typed (0 vs many) must produce the identical subsequent trajectory', () => {
  setup(9002);
  const noCommands = (() => { for (let i = 0; i < 10; i++) advanceDay(); return snapshotWithoutWallClock(); })();

  setup(9002);
  for (let i = 0; i < 15; i++) processTerminalCommand('LISTEN'); // a chatty player, same seed
  const manyCommands = (() => { for (let i = 0; i < 10; i++) advanceDay(); return snapshotWithoutWallClock(); })();

  assertEqual(manyCommands, noCommands, 'a chattier player (more Terminal interaction) must never alter the simulation outcome for an identical seed');
});

summary('TerminalRngIsolation.test.js');
