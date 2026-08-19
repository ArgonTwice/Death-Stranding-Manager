// tests/resilience/NavigationInvariance.test.js — V1.1 LOT 2: preuve directe de l'invariant demandé
// ("changer d'onglet ne doit consommer AUCUN RNG, déclencher AUCUN tick de simulation, ni modifier
// AUCUNE donnée persistée du GameState") + validation du contrat de cycle de vue formel
// (core/ViewLifecycle.js): destruction effective des listeners au démontage d'une vue.
//
// Complète (ne duplique pas) RngUiOrthogonality.test.js, qui prouve la même propriété mais avec
// advanceDay() ENTRELACÉ entre les bascules d'onglets (scénario "navigation pendant une partie qui
// tourne"). Ici: 100 cycles de navigation PURE, sans aucune simulation entre les deux relevés — la
// preuve la plus directe possible que la navigation seule, isolée, ne touche à rien.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv({ withHistory: true });

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, serializeGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { initNavigation } = await import('../../src/core/NavigationManager.js');
const {
  initMainNav, setMainTab, setSubTab, closeMainNav, closeSubTab, currentMainTab, currentSubTab, MAIN_TABS
} = await import('../../src/ui/NavigationManager.js');
const { renderManagementSubMenu } = await import('../../src/ui/ManagementPanel.js');
const { initOptionsPanel, renderOptionsPanel, setOptionsVolet } = await import('../../src/ui/OptionsPanel.js');
const { renderMissionsPanel } = await import('../../src/ui/MissionsPanel.js');
const { renderDeliveryPlanningPanel } = await import('../../src/ui/DeliveryPlanningPanel.js');
const { isViewMounted } = await import('../../src/core/ViewLifecycle.js');

initNavigation();
initMainNav();
initOptionsPanel();

function snapshotWithoutWallClock() {
  const s = serializeGame();
  delete s.terminalLastSeen;
  return JSON.stringify(s);
}

function setupFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
  game.money = 15000;
  ['scout', 'hauler'].forEach(s => hireRaw(s));
  for (let i = 0; i < 3; i++) game.mapsData.mexico.routes.add(`${i},${i}`);
  // V1.0.2 (pré-existant, hors périmètre V1.1 LOT 2, ui/TutorialManager.js:136-139): nav:mainTabChanged
  // ré-évalue DÉLIBÉRÉMENT checkTutorialProgress() à chaque bascule d'onglet ("ré-applique le highlight
  // au cas où... et ré-évalue la progression au passage") — game.tutorial.step PEUT donc avancer sur
  // simple navigation, par conception, depuis V1.0.2, indépendamment de ce lot. On neutralise cette
  // variable orthogonale (tutoriel déjà clos) pour isoler ici la SEULE propriété que V1.1 LOT 2
  // introduit et doit garantir: la navigation n'agit JAMAIS sur RNG.js ni sur le reste de GameState.
  game.tutorial.completed = true;
  game.tutorial.skipped = true;
  game.tutorial.rewardsGranted = true;
}

// Un cycle complet: visite les 5 onglets, ouvre le sous-menu Logistique (ses 4 sous-onglets) et les 2
// volets Options — sans jamais appeler advanceDay()/RNG.* entre les deux relevés.
function fullNavigationCycle() {
  setMainTab('livraisons');
  renderMissionsPanel();
  renderDeliveryPlanningPanel();
  closeMainNav();

  setMainTab('reseau');
  closeMainNav();

  setMainTab('logistique');
  renderManagementSubMenu();
  for (const sub of ['porters', 'fleet', 'shop', 'archives']) { setSubTab(sub); closeSubTab(); }
  closeMainNav();

  setMainTab('options');
  setOptionsVolet('system'); renderOptionsPanel();
  setOptionsVolet('management'); renderOptionsPanel();
  closeMainNav();

  setMainTab('dashboard'); // no-op ciblé: dashboard ferme déjà tout, exercé quand même pour la boucle
}

// ============================================================
// 1. Invariance stricte: 100 cycles de navigation PURE (aucune simulation entre les deux relevés)
// ============================================================
await test('MAIN_TABS exposes exactly the 5 Cyber-Bridges 2.0 tabs (Dashboard/Livraisons/Réseau/Logistique/Options)', async () => {
  assertEqual(MAIN_TABS.length, 5, 'exactly 5 top-level tabs');
  assertEqual(MAIN_TABS.join(','), 'dashboard,livraisons,reseau,logistique,options', 'tab ids must match the V1.1 LOT 2 taxonomy exactly');
});

await test('100 full navigation cycles across all 5 tabs leave the serialized GameState 100% byte-identical', async () => {
  setupFixture(555001);
  const before = snapshotWithoutWallClock();
  const seedBefore = RNG.getSeed();

  for (let i = 0; i < 100; i++) fullNavigationCycle();

  const after = snapshotWithoutWallClock();
  const seedAfter = RNG.getSeed();
  assertEqual(after, before, '100 cycles of pure tab navigation must never mutate game.* (any diff means a UI file leaked into GameState.js)');
  assertEqual(seedAfter, seedBefore, 'RNG seed must be untouched by navigation alone');
});

await test('activeTab lives outside GameState: currentMainTab()/currentSubTab() are never part of serializeGame()', async () => {
  setupFixture(555002);
  setMainTab('logistique');
  setSubTab('fleet');
  const s = JSON.parse(snapshotWithoutWallClock());
  assert(!('activeTab' in s) && !('currentMain' in s) && !('currentSub' in s) && !('main' in s) && !('sub' in s),
    'the persisted GameState must never contain the active-tab UI/runtime state (RuntimeUIState separation)');
  assertEqual(currentMainTab(), 'logistique', 'sanity: the tab state is tracked somewhere, just not in GameState');
  assertEqual(currentSubTab(), 'fleet', 'sanity: sub-tab state is tracked too');
  closeMainNav();
});

// ============================================================
// 2. Contrat de cycle de vue (core/ViewLifecycle.js): destruction effective des listeners
// ============================================================
await test('opening the Livraisons tab mounts the deliveryPlanning view; leaving it destroys it', async () => {
  setupFixture(555003);
  assertEqual(isViewMounted('deliveryPlanning'), false, 'sanity: unmounted before any navigation');
  setMainTab('livraisons');
  assertEqual(isViewMounted('deliveryPlanning'), true, 'opening Livraisons must mount deliveryPlanning');
  setMainTab('reseau');
  assertEqual(isViewMounted('deliveryPlanning'), false, 'navigating away must destroy deliveryPlanning');
  closeMainNav();
});

await test('after destroy(), the deliveryPlanning view no longer reacts to render:request — no listener leak', async () => {
  const { eventBus } = await import('../../src/core/EventBus.js');
  setupFixture(555004);
  hireRaw('scout');

  const el = document.getElementById('deliveryPlanningPanel');
  let writeCount = 0;
  let value = el.innerHTML;
  Object.defineProperty(el, 'innerHTML', {
    configurable: true,
    get() { return value; },
    set(v) { value = v; writeCount++; }
  });

  setMainTab('livraisons'); // mount -> premier rendu synchrone (mount() appelle render())
  const afterMount = writeCount;
  assert(afterMount >= 1, 'sanity: mounting must paint the panel at least once');

  eventBus.emit('render:request'); // encore monté: doit re-peindre
  assert(writeCount > afterMount, 'sanity: while mounted, render:request must repaint deliveryPlanningPanel');
  const afterMountedEmit = writeCount;

  setMainTab('reseau'); // destroy() -> désabonne 'render:request'
  eventBus.emit('render:request');
  eventBus.emit('render:request');
  eventBus.emit('render:request');
  assertEqual(writeCount, afterMountedEmit, 'after destroy(), render:request must NEVER touch deliveryPlanningPanel again — proves the listener was truly removed, not just ignored');
  closeMainNav();
});

await test('50 mount/destroy cycles never accumulate duplicate listeners (each render:request repaints exactly once while mounted)', async () => {
  const { eventBus } = await import('../../src/core/EventBus.js');
  setupFixture(555005);
  hireRaw('scout');

  for (let i = 0; i < 50; i++) { setMainTab('livraisons'); setMainTab('reseau'); }
  closeMainNav();

  const el = document.getElementById('deliveryPlanningPanel');
  let writeCount = 0;
  let value = el.innerHTML;
  Object.defineProperty(el, 'innerHTML', {
    configurable: true,
    get() { return value; },
    set(v) { value = v; writeCount++; }
  });

  setMainTab('livraisons');
  const afterMount = writeCount;
  eventBus.emit('render:request');
  // Si les 50 cycles précédents avaient chacun laissé un listener fantôme, un seul emit() déclencherait
  // ~50 écritures ici plutôt qu'une seule (le mount courant + les fantômes non désabonnés).
  assertEqual(writeCount - afterMount, 1, 'exactly ONE repaint per render:request after 50 mount/destroy cycles — any listener leak would multiply this count');
  closeMainNav();
});

summary('NavigationInvariance.test.js');
