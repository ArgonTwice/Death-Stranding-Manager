// tests/resilience/RaidBuildDrawerStacking.test.js — V1.25.4: même famille de bug que
// PorterDrawerStacking.test.js, trouvée en auditant systématiquement tout onclick="open*/toggle*" du
// projet après la découverte du cas Porteurs/Fiche (audit "de fond en comble" demandé par
// l'utilisateur). Le seul point d'entrée de la Construction de Terrain ("🏗️ Construire",
// RaidTrackingDrawer.js) vit À L'INTÉRIEUR du tiroir Raid Tactique déjà ouvert
// (#raidTrackingDrawer, state-peek) — sans collapseDrawer() avant d'ouvrir la construction, les deux
// tiroirs restaient simultanément "state-peek", et #raidTrackingDrawer (plus loin dans le DOM)
// peignait PAR-DESSUS #buildActionDrawer — confirmé visuellement via Playwright (getComputedStyle du
// transform réel, après avoir laissé la transition CSS se stabiliser) avant ce fix.
import { installStubEnv, test, assert, summary } from './_stubEnv.mjs';

installStubEnv({ withHistory: true });

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { initNavigation } = await import('../../src/core/NavigationManager.js');
const { registerDrawer } = await import('../../src/ui/DrawerManager.js');
const { openRaidTrackingDrawer, closeRaidTrackingDrawer } = await import('../../src/ui/RaidTrackingDrawer.js');
const { openBuildActionDrawer, closeBuildActionDrawer } = await import('../../src/ui/BuildActionDrawer.js');

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
}

initNavigation();
registerDrawer('raidTrackingDrawer', { onCloseRequest: closeRaidTrackingDrawer });
registerDrawer('buildActionDrawer', { onCloseRequest: closeBuildActionDrawer });

await test('opening Build Action from Raid Tracking collapses the raid drawer (only one .ds-drawer visible at a time)', async () => {
  freshFixture(920);
  openRaidTrackingDrawer();
  assert(document.getElementById('raidTrackingDrawer').classList.contains('state-peek'), 'sanity: raid tracking opens peek');

  openBuildActionDrawer(); // exactly what "🏗️ Construire" does — called FROM the still-open raid drawer
  assert(document.getElementById('buildActionDrawer').classList.contains('state-peek'), 'build action must be visually open');
  assert(!document.getElementById('raidTrackingDrawer').classList.contains('state-peek'), 'raid tracking must be collapsed while build action is showing — never both visible at once, or the later one in the DOM (raidTrackingDrawer) paints over build action and hides it entirely');
});

await test('closing Build Action restores Raid Tracking to peek (drill-down back-navigation)', async () => {
  freshFixture(921);
  openRaidTrackingDrawer();
  openBuildActionDrawer();

  closeBuildActionDrawer();
  assert(document.getElementById('buildActionDrawer').classList.contains('state-collapsed'), 'build action must close');
  assert(document.getElementById('raidTrackingDrawer').classList.contains('state-peek'), 'closing build action must bring back raid tracking — the player was watching the raid and expects to land back on it');
});

summary('RaidBuildDrawerStacking.test.js');
