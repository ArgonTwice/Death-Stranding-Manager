// tests/resilience/FullGameLoopV111.test.js — suite globale V1.11.0 (Masquage Total des Territoires
// Verrouillés & PWA Fullscreen Z Fold): garanties vérifiées empiriquement. Même style zéro-dépendance
// que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

const stub = installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { COUNTRIES } = await import('../../src/data/Constants.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { renderMapToggle } = await import('../../src/ui/HUD.js');

// ============================================================
// Masquage total des territoires verrouillés (Dashboard #mapToggle) — secret total de progression:
// seuls les territoires déjà débloqués (game.mapsData[key] existant) doivent apparaître dans le DOM,
// aucun bouton désactivé/indice pour les autres.
// ============================================================
RNG.setSeed(111111);
newGame(false);

await test('Territory masking: only Mexico (the starting territory) is rendered on a fresh game', async () => {
  renderMapToggle();
  const html = stub.cache['mapToggle'].innerHTML;
  assert(html.includes('Mexique'), 'the unlocked starting territory must be rendered');
  for (const c of COUNTRIES) {
    if (c.key === 'mexico') continue;
    assert(!html.includes(c.name), `locked territory "${c.name}" must NOT be injected into the DOM at all`);
  }
  assert(!html.includes('scellé'), 'no "Territoire scellé" placeholder must remain in the DOM');
  assert(!html.includes('inconnu'), 'no "Territoire inconnu" hint must remain in the DOM');
  assert(!html.includes('🔒'), 'no lock icon must appear on the Dashboard territory selector');
});

await test('Territory masking: a newly unlocked territory appears, later ones stay fully hidden', async () => {
  // Simule buildExpansion() sans dépendre du raccordement complet des mainKnots frontaliers (déjà
  // couvert ailleurs) — seule la structure de game.mapsData['australia'] importe ici.
  game.mapsData.australia = {
    btZones: [], terrain: {}, routes: new Set(['5,5']), craters: new Set(),
    branches: [{ x: 5, y: 5 }], activeBranch: 0, mainKnots: [], sideQuests: [],
    muleCamps: [], catchers: [], pccInstalls: [], lostCargo: []
  };
  renderMapToggle();
  const html = stub.cache['mapToggle'].innerHTML;
  assert(html.includes('Mexique'), 'the previously unlocked territory must still be rendered');
  assert(html.includes('Australie'), 'the newly unlocked territory must now be rendered');
  assert(!html.includes('France'), 'France (still locked) must remain fully absent from the DOM');
  assert(!html.includes('Japon'), 'Japon (still locked) must remain fully absent from the DOM');
  assert(!html.includes('🔒'), 'no lock icon must appear anywhere once a new territory unlocks');
});

summary('FullGameLoopV111.test.js');
