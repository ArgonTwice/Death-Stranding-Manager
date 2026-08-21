// tests/resilience/DrawerBackdropZIndex.test.js — V1.32.0: 2 bugs réels trouvés en jouant une vraie
// partie (audit libre, pas de brief), tous deux liés au lancement d'un Raid Tactique/Expédition
// depuis une modale (RaidSelectionModal.js/ContractBoardModal.js).
//
// Bug 1 (core/NavigationManager.js): `closeX(); openRaidTrackingDrawer();` — closePanel() est
// ASYNCHRONE (history.back(), popstate différé) en VRAI navigateur; le pushPanel() synchrone juste
// après course contre lui, et le popstate finit par dépiler LES DEUX panneaux d'un coup, refermant
// le tiroir tout juste ouvert quelques centaines de ms plus tard, sans la moindre action du joueur.
// Confirmé empiriquement via Playwright réel (history.state passe de {depth:2} juste après l'appel à
// un unique popstate ciblant {depth:0}) — IRREPRODUCTIBLE dans ce stub DOM minimal (son
// history.back() est délibérément SYNCHRONE, cf. _stubEnv.mjs), donc ce test couvre uniquement la
// correction LOGIQUE de closePanelThenPush (l'état final doit être correct), pas la course
// temporelle elle-même — celle-ci reste validée par vérification Playwright jetable (cf. message de
// commit).
//
// Bug 2 (ui/DrawerManager.js): #drawerBackdrop.active avait un SEUL z-index (205, posé en V1.25.7)
// appliqué à TOUS les tiroirs sans distinction — utile UNIQUEMENT pour Télémétrie/Terminal/Hall of
// Fame (z-index propre 210, seuls tiroirs pouvant peeker par-dessus une modale .left encore ouverte,
// z-index 200), mais 205 > 100 (z-index standard des 8 autres tiroirs) faisait que le fond assombri
// passait PAR-DESSUS le contenu de N'IMPORTE QUEL AUTRE tiroir standard, interceptant tous ses clics
// — confirmé par un clic Playwright RÉEL sur le tiroir Quêtes standard (totalement indépendant de
// tout raid/modale). Ce test-ci EST reproductible dans le stub (pure logique classList).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv({ withHistory: true });

const { initNavigation, pushPanel, closePanelThenPush, isPanelOpen } = await import('../../src/core/NavigationManager.js');
const { registerDrawer, openDrawer, collapseDrawer, closeAllOpenDrawers, drawerState } = await import('../../src/ui/DrawerManager.js');

initNavigation();

function freshDrawer(id, elevatesBackdrop) {
  // onCloseRequest appelle collapseDrawer() directement — opération DOM pure (DrawerManager.js), le
  // même chemin que closeAllOpenDrawers() emprunte réellement en jeu (via NavigationManager). Évite
  // de recâbler tout le pipeline pushPanel/closePanel/popstate ici, hors périmètre de ce test.
  const closeFn = () => collapseDrawer(id);
  registerDrawer(id, { onCloseRequest: closeFn, elevatesBackdrop });
  return closeFn;
}

// ============================================================
// 1. Bug 2 — z-index du backdrop partagé, différencié par tiroir
// ============================================================
await test('opening a STANDARD drawer (no elevatesBackdrop) sets .active but NEVER .above-modal on the shared backdrop', () => {
  freshDrawer('questDrawer-t1', false);
  openDrawer('questDrawer-t1', 'peek');
  const bd = document.getElementById('drawerBackdrop');
  assert(bd.classList.contains('active'), 'backdrop must darken while any drawer is open');
  assert(!bd.classList.contains('above-modal'), 'a standard drawer (z-index 100) must NEVER push the backdrop above its own content (z-index 205 > 100 would intercept every click on the drawer itself — the real bug found V1.32.0)');
});

await test('opening a drawer WITH elevatesBackdrop=true sets BOTH .active and .above-modal', () => {
  freshDrawer('telemetryDrawer-t2', true);
  openDrawer('telemetryDrawer-t2', 'peek');
  const bd = document.getElementById('drawerBackdrop');
  assert(bd.classList.contains('active'), 'backdrop must darken');
  assert(bd.classList.contains('above-modal'), 'Télémétrie/Terminal/Hall of Fame need the elevated z-index to darken/block the modal still visible behind them (V1.25.7 intent, preserved)');
});

await test('closing all drawers removes both .active and .above-modal', () => {
  closeAllOpenDrawers(); // reset: les tiroirs des tests précédents (dont l'élevé) restent enregistrés au niveau module
  freshDrawer('walkDrawer-t3', false);
  openDrawer('walkDrawer-t3', 'peek');
  closeAllOpenDrawers();
  const bd = document.getElementById('drawerBackdrop');
  assert(!bd.classList.contains('active'), 'backdrop must hide once no drawer is open');
  assert(!bd.classList.contains('above-modal'), 'above-modal must clear along with active');
});

await test('a standard drawer open ALONGSIDE an elevated one keeps .above-modal (any elevated drawer open is enough)', () => {
  freshDrawer('questDrawer-t4', false);
  freshDrawer('hallOfFameDrawer-t4', true);
  openDrawer('questDrawer-t4', 'peek');
  openDrawer('hallOfFameDrawer-t4', 'peek');
  const bd = document.getElementById('drawerBackdrop');
  assert(bd.classList.contains('above-modal'), 'above-modal must reflect whether ANY currently-open drawer needs it, not just the most recently opened one');
});

// ============================================================
// 2. Bug 1 — closePanelThenPush: état final correct (fermeture avant ouverture)
// ============================================================
await test('closePanelThenPush closes oldId and opens newId — final stack has newId, never both', () => {
  pushPanel('raidSelectionModal-t5', () => {});
  assert(isPanelOpen('raidSelectionModal-t5'), 'sanity: modal open');

  closePanelThenPush('raidSelectionModal-t5', () => pushPanel('raidTrackingDrawer-t5', () => {}));

  assert(!isPanelOpen('raidSelectionModal-t5'), 'the old panel (modal) must end up closed');
  assert(isPanelOpen('raidTrackingDrawer-t5'), 'the new panel (drawer) must end up open');
});

await test('closePanelThenPush with oldId already closed just opens newId directly (no crash, no stale close)', () => {
  closePanelThenPush('never-opened-t6', () => pushPanel('raidTrackingDrawer-t6', () => {}));
  assert(isPanelOpen('raidTrackingDrawer-t6'), 'newId must open even when oldId was never on the stack');
});

summary('DrawerBackdropZIndex.test.js');
