// tests/resilience/PorterDrawerStacking.test.js — V1.25.4: bug réel trouvé en jouant une vraie
// partie (audit "de fond en comble" demandé par l'utilisateur), reproduit via un clic RÉEL en
// navigateur avant d'être corrigé (ui/PorterDrawer.js). Le seul point d'entrée de la fiche détaillée
// ("🪪 Fiche du porteur", ui/HUD.js) vit À L'INTÉRIEUR du tiroir Porteurs déjà ouvert (#portersDrawer,
// state-full) — sans collapseDrawer() avant d'ouvrir la fiche, les DEUX tiroirs plein écran se
// retrouvaient simultanément "state-full", et #portersDrawer (plus loin dans le DOM) peignait
// PAR-DESSUS #porterDrawer: le joueur tapait "Fiche du porteur" et ne voyait STRICTEMENT AUCUN
// changement à l'écran — confirmé visuellement via document.elementFromPoint() en conditions réelles
// avant ce fix. Ce test vérifie la mécanique CSS (classList state-full/state-collapsed), pas le rendu
// visuel réel (hors de portée de _stubEnv.mjs — aucun CSSOM) : le rendu pixel a été validé séparément
// via un script Playwright jetable (mandat du projet), supprimé avant ce commit.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv({ withHistory: true });

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { initNavigation } = await import('../../src/core/NavigationManager.js');
const { registerDrawer } = await import('../../src/ui/DrawerManager.js');
const { openPortersDrawer, closePortersDrawer } = await import('../../src/ui/HUD.js');
const { openPorterDrawer, closePorterDrawer } = await import('../../src/ui/PorterDrawer.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
  hireRaw(); // renderPorters()/openPortersDrawer() exigent un porteur pleinement valide (trait/skill réels, etc.) — hireRaw() les remplit tous correctement, contrairement à un objet poussé à la main.
}

initNavigation();
registerDrawer('portersDrawer', { onCloseRequest: closePortersDrawer });
registerDrawer('porterDrawer', { onCloseRequest: closePorterDrawer });

await test('opening the individual fiche from the roster collapses the roster (only one .ds-drawer visually "full" at a time)', async () => {
  freshFixture(910);
  openPortersDrawer();
  assert(document.getElementById('portersDrawer').classList.contains('state-full'), 'sanity: roster opens full');

  openPorterDrawer(game.porters[0].id); // exactly what "🪪 Fiche du porteur" does — called FROM the still-open roster
  assert(document.getElementById('porterDrawer').classList.contains('state-full'), 'the fiche must be visually open');
  assert(!document.getElementById('portersDrawer').classList.contains('state-full'), 'the roster must be collapsed while the fiche is showing — never both "state-full" at once, or the later one in the DOM (portersDrawer) paints over the fiche and hides it entirely');
});

await test('closing the fiche restores the roster to full (drill-down back-navigation, not a jump straight to the map)', async () => {
  freshFixture(911);
  openPortersDrawer();
  openPorterDrawer(game.porters[0].id);

  closePorterDrawer(); // the ✕ button inside the fiche
  assert(document.getElementById('porterDrawer').classList.contains('state-collapsed'), 'the fiche must close');
  assert(document.getElementById('portersDrawer').classList.contains('state-full'), 'closing the fiche must bring back the roster full — the player was browsing the roster and expects to land back on it, not silently lose their place');
});

await test('closing the roster while the fiche is on top (physical back / backdrop tap from the top) closes both cleanly', async () => {
  freshFixture(912);
  openPortersDrawer();
  openPorterDrawer(game.porters[0].id);

  closePortersDrawer(); // NavigationManager.closePanel('mainNavSub'-like stepsBack pops BOTH porterDrawer and portersDrawer, since portersDrawer sits lower in the stack
  assert(document.getElementById('porterDrawer').classList.contains('state-collapsed'), 'the fiche must also close (it was stacked above the roster in the navigation history)');
  assert(document.getElementById('portersDrawer').classList.contains('state-collapsed'), 'the roster must close');
});

summary('PorterDrawerStacking.test.js');
