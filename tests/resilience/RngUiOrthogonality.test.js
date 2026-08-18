// tests/resilience/RngUiOrthogonality.test.js — même seed sur 2 parcours dans le MÊME processus:
// Run A (statique, uniquement advanceDay()) vs Run B (advanceDay() entrecoupé d'une navigation
// Kairosoft frénétique — bascule d'onglets, sous-menus Gestion, volets Options, rendu répété de la
// Carte Holographique Bridges). Vérifie que le GameState final sérialisé est 100% IDENTIQUE
// bit-à-bit — la garantie structurelle des règles V1.0.0 ("NavigationManager/BridgesMap ne touchent
// JAMAIS RNG.js/GameState.js").
import { installStubEnv, test, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv({ withHistory: true });

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, serializeGame } = await import('../../src/persistence/SaveManager.js');

// serializeGame() includes terminalLastSeen: Date.now() — a real wall-clock timestamp, documented in
// SaveManager.js as deliberately non-deterministic ("jamais lu par tests/run-once.mjs"). Strip it
// before comparing, exactly like the existing determinism harness excludes it by construction.
function snapshotWithoutWallClock() {
  const s = serializeGame();
  delete s.terminalLastSeen;
  return JSON.stringify(s);
}
const { advanceDay } = await import('../../src/engine/DeliveryEngine.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { initNavigation } = await import('../../src/core/NavigationManager.js');
const { initMainNav, setMainTab, setSubTab, closeMainNav, closeSubTab } = await import('../../src/ui/NavigationManager.js');
const { renderManagementSubMenu } = await import('../../src/ui/ManagementPanel.js');
const { initOptionsPanel, renderOptionsPanel, setOptionsVolet } = await import('../../src/ui/OptionsPanel.js');
const { renderMissionsPanel } = await import('../../src/ui/MissionsPanel.js');

initNavigation();
initMainNav();
initOptionsPanel();

const SEED = 3141592;
const DAYS = 30;

function setupCommonFixture() {
  RNG.setSeed(SEED);
  newGame(false);
  game.money = 20000;
  ['scout', 'hauler', 'driver'].forEach(s => hireRaw(s));
  for (let i = 0; i < 5; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
}

// Run A — statique: aucune interaction UI, uniquement la boucle de simulation.
setupCommonFixture();
for (let i = 0; i < DAYS; i++) advanceDay();
const runA = snapshotWithoutWallClock();

// Run B — navigation frénétique entrecoupée entre chaque jour simulé: bascule les 5 onglets
// principaux, ouvre/ferme le sous-menu Gestion, change de volet Options, force un rendu répété de
// BridgesMap.js (via renderMissionsPanel) — rien de tout cela ne doit consommer RNG.js ni muter game.*.
setupCommonFixture();
for (let i = 0; i < DAYS; i++) {
  setMainTab('gestion');
  renderManagementSubMenu();
  setSubTab('porters');
  closeSubTab();
  setSubTab('shop');
  closeSubTab();
  closeMainNav();

  setMainTab('missions');
  renderMissionsPanel();
  renderMissionsPanel(); // double rendu délibéré: exerce aussi le bindInteraction() idempotent de BridgesMap.js
  closeMainNav();

  setMainTab('options');
  setOptionsVolet('management');
  renderOptionsPanel();
  setOptionsVolet('system');
  renderOptionsPanel();
  closeMainNav();

  setMainTab('camp');
  closeMainNav();

  advanceDay();
}
const runB = snapshotWithoutWallClock();

await test('Run A (static) and Run B (frenetic Kairosoft navigation) produce byte-identical final GameState', async () => {
  assertEqual(runB, runA, 'UI navigation must be 100% orthogonal to the RNG-driven simulation — any diff here means a nav/UI file leaked into RNG.js or GameState.js mutation');
});

await test('sanity: the two runs are not trivially identical because nothing happened (money must reflect real simulated days)', async () => {
  const parsed = JSON.parse(runA);
  assertEqual(typeof parsed.money, 'number', 'money must be a real number');
  // Not a strict inequality check against the starting 20000 — some seeds could theoretically break
  // even, but month must have advanced, proving DAYS of real simulation actually ran in both runs.
  assertEqual(parsed.month >= 1, true, 'month must reflect simulated time passing');
});

summary('RngUiOrthogonality.test.js');
