// tests/resilience/FullGameLoopV13.test.js — suite globale V1.3.0 (WebAudio, End-Game Procédural &
// Layout Duo Z Fold): 3 garanties demandées par la mission, vérifiées empiriquement. Même style
// zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, serializeGame, deserializeGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { contractsForRelay } = await import('../../src/systems/contracts/ContractGenerator.js');
const { CONTRACT_TYPES } = await import('../../src/data/ContractTemplates.js');
const { createMockMotionAdapter } = await import('../../src/sensors/MockMotionAdapter.js');
const { recordSteps } = await import('../../src/systems/RealWalkSystem.js');
await import('../../src/systems/raid/RaidSystem.js'); // abonnement walk:stepDetected (effet de bord)
const { startExpedition } = await import('../../src/systems/expedition/ExpeditionSystem.js'); // abonnement raid:completed (effet de bord)
const soundEngine = await import('../../src/audio/SoundEngine.js');
const { eventBus } = await import('../../src/core/EventBus.js');

function snapshotWithoutWallClock() {
  const s = serializeGame();
  delete s.terminalLastSeen;
  return JSON.stringify(s);
}

// ============================================================
// 1) WebAudio isolation — aucune des 4 nouvelles fonctions ne doit toucher game.*/RNG.js, même
// lorsque l'environnement (stub headless, comme un navigateur sans WebAudio) ne fournit pas
// window.AudioContext du tout: initAudio() doit rester silencieux (try/catch existant), jamais
// planter, jamais faire avancer le flux RNG.js partagé ni muter le GameState.
//
// Piège évité: newGame()/hireRaw() consomment DÉJÀ le flux RNG.js partagé en interne (pickN pour les
// reliques/événements, génération procédurale du porteur) — RNG.setSeed(RNG.getSeed()) après coup ne
// "revient" donc PAS au point courant, il repart de la toute première valeur de la seed. Le pattern
// fiable (identique à RngUiOrthogonality.test.js/V1.2 RNG Isolation) est de REJOUER le même setup
// complet deux fois plutôt que d'essayer de "rembobiner" un flux déjà avancé.
function setupAudioTest() {
  RNG.setSeed(909090);
  newGame(false);
  game.money = 12000;
  hireRaw('scout');
}

setupAudioTest();
const audioAnchorNext = RNG.next(); // Run A: juste le setup, aucune action audio
const audioAnchorSnapshot = snapshotWithoutWallClock();

setupAudioTest(); // Run B: même setup rejoué depuis la même seed, PUIS les actions à vérifier

await test('WebAudio isolation: playClick/playSuccess/playAlert/playChiralConnect never touch RNG.js or game.* (works even with no AudioContext at all)', async () => {
  assert(typeof window.AudioContext === 'undefined' && typeof window.webkitAudioContext === 'undefined', 'sanity: this stub environment must have no AudioContext, exactly like a hostile/unsupported browser');

  // Appels DIRECTS aux 4 fonctions uniquement — pas de eventBus.emit ici: delivery:resolved/
  // prepper:starReached/network:nodeConnected ont aussi des abonnés LÉGITIMES sans rapport avec
  // l'audio (TelemetrySystem.js, BBPodSystem.js, TutorialManager.js), qui font AVANCER game.* par
  // conception — un test qui les émettrait mesurerait leur effet, pas celui de SoundEngine.js.
  soundEngine.playClick();
  soundEngine.playSuccess();
  soundEngine.playAlert();
  soundEngine.playChiralConnect();
  const rngAfter = RNG.next();

  // Dans CET environnement headless (aucun window.AudioContext du tout, contrairement à un vrai
  // navigateur), initAudio() échoue et journalise un avertissement (logEvent) à CHAQUE appel — game.log
  // grossit donc légitimement, ce n'est pas une fuite vers le reste du GameState. On l'exclut de la
  // comparaison exactement comme terminalLastSeen (non-déterministe par nature), et on la vérifie
  // séparément: seuls des logs "Audio indisponible" doivent apparaître, rien d'autre.
  const afterSnapshot = JSON.parse(snapshotWithoutWallClock());
  const anchorParsed = JSON.parse(audioAnchorSnapshot);
  const newLogEntries = afterSnapshot.log.slice(0, afterSnapshot.log.length - anchorParsed.log.length);
  assert(newLogEntries.length > 0 && newLogEntries.every(l => l.text.includes('Audio indisponible')), 'any new log entry caused by the audio calls must only be the expected "Audio indisponible" warning, nothing gameplay-related');
  delete afterSnapshot.log; delete anchorParsed.log;
  assertEqual(JSON.stringify(afterSnapshot), JSON.stringify(anchorParsed), 'GameState (minus game.log, see above) must be byte-identical whether or not the 4 audio calls happened');
  assertEqual(rngAfter, audioAnchorNext, 'RNG.js stream position must be unaffected by any WebAudio call — no AudioContext means initAudio() silently no-ops, by design (SoundEngine.js catch block)');
});

// ============================================================
// 2) Déterminisme des contrats secondaires — contractsForRelay() ne consomme jamais le flux RNG.js
// partagé (seed dérivée de mapKey+month) et produit un résultat identique à répétition tant que le
// mois ne change pas, y compris pour les 2 nouveaux types end-game (express/highrisk, routeBias).
function setupContractsTest() {
  RNG.setSeed(424242);
  newGame(false);
  for (let i = 0; i < 8; i++) game.mapsData.mexico.routes.add(`${i},${i}`); // couvre plusieurs routes pour un pool routeBias non-trivial
}

setupContractsTest();

await test('Procedural contracts: contractsForRelay(mapKey) is deterministic (same mapKey+month -> byte-identical result)', async () => {
  const runA = contractsForRelay('mexico');
  const runB = contractsForRelay('mexico');
  assertEqual(JSON.stringify(runB), JSON.stringify(runA), 'contractsForRelay must be a pure function of (mapKey, game.month): calling it twice must yield byte-identical contracts');
  assert(runA.length > 0, 'sanity: at least one contract must have been generated');
});

setupContractsTest();
const contractsAnchorNext = RNG.next(); // Run A: juste le setup, aucune génération de contrat

setupContractsTest(); // Run B: même setup rejoué depuis la même seed, PUIS la génération à vérifier

await test('Procedural contracts: the shared RNG.js stream is untouched by contract generation', async () => {
  contractsForRelay('mexico');
  contractsForRelay('mexico');
  contractsForRelay('mexico');
  const afterNext = RNG.next();
  assertEqual(afterNext, contractsAnchorNext, 'generating contracts 3 times in a row must not have advanced the shared RNG.js stream by even one draw');
});

await test('Procedural contracts: express/highrisk types exist and their route pool is deterministically biased', async () => {
  assert(CONTRACT_TYPES.express && CONTRACT_TYPES.express.routeBias === 'low', 'express type must exist with a low-difficulty route bias');
  assert(CONTRACT_TYPES.highrisk && CONTRACT_TYPES.highrisk.routeBias === 'high', 'highrisk type must exist with a high-difficulty route bias');
  const runA = contractsForRelay('mexico');
  const runB = contractsForRelay('mexico');
  for (let i = 0; i < runA.length; i++) {
    assertEqual(runA[i].typeId, runB[i].typeId, `contract ${i} type must be identical across identical calls`);
    assertEqual(JSON.stringify(runA[i].legRouteIds), JSON.stringify(runB[i].legRouteIds), `contract ${i} route selection must be identical across identical calls, including for routeBias-restricted pools`);
  }
});

// ============================================================
// 3) Save/Load invariance incluant l'historique des performances end-game (expeditionHistory), pour
// un contrat "highrisk" (nouveau type V1.3.0) mené jusqu'à complétion.
RNG.setSeed(13579);
newGame(false);
game.money = 20000;
hireRaw('scout');
const porterId = game.porters[0].id;
for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);

function driveUntil(mockAdapter, predicate, maxIterations = 30) {
  for (let i = 0; i < maxIterations; i++) {
    if (predicate()) return true;
    const raid = game.activeRaid;
    if (!raid || raid.status !== 'active') return predicate();
    const remaining = Math.max(1, raid.targetDistanceSteps - raid.traveledSteps);
    mockAdapter.simulateSteps(remaining + 100);
  }
  return predicate();
}

await test('End-game history: a highrisk contract completes, records into expeditionHistory, and survives a save/load round-trip', async () => {
  const contract = { id: 'v13-highrisk', mapKey: 'mexico', typeId: 'highrisk', typeName: 'Cargaison Sensible', icon: '🔥', legRouteIds: ['mexico_south'], month: game.month };
  const launched = startExpedition(contract, porterId);
  assert(launched, 'startExpedition must accept the highrisk contract exactly like any other type');

  const mockAdapter = createMockMotionAdapter({ onStep: n => recordSteps(n) });
  const completed = driveUntil(mockAdapter, () => game.activeExpedition && game.activeExpedition.status === 'completed');
  assert(completed, 'the single-leg highrisk expedition must complete within the iteration budget');
  assertEqual(game.expeditionHistory.length, 1, 'completed expedition must be recorded in the persisted history');
  assert(['LEGENDARY', 'S', 'A', 'B', 'C', 'D'].includes(game.expeditionHistory[0].legResults[0].rank), 'the recorded leg must carry a valid S/A/B/C/D/LEGENDARY performance rank');

  const before = snapshotWithoutWallClock();
  deserializeGame(JSON.parse(JSON.stringify(serializeGame())));
  const after = snapshotWithoutWallClock();
  assertEqual(after, before, 'a save/load round-trip must not alter expeditionHistory (or anything else) by even one byte');
  assertEqual(game.expeditionHistory.length, 1, 'expeditionHistory must survive the round-trip with the same entry count');
});

summary('FullGameLoopV13.test.js');
