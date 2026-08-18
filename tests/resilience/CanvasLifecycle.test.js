// tests/resilience/CanvasLifecycle.test.js — 100 cycles d'ouverture/redimensionnement/fermeture de
// l'onglet [Missions] (BridgesMap.js): vérifie que renderBridgesMap() ne ré-attache JAMAIS un
// deuxième écouteur 'click' sur le même canvas (bindInteraction() est explicitement idempotent —
// `if (boundCanvasId === canvasId) return;`). Une fuite de listener y serait invisible en jeu normal
// (un seul onglet Missions existe) mais deviendrait un vrai bug mémoire/comportement si jamais
// quelqu'un ouvrait/fermait l'onglet frénétiquement (exactement ce que ce test simule).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

const stub = installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { renderBridgesMap } = await import('../../src/ui/BridgesMap.js');

RNG.setSeed(555);
newGame(false);

const CANVAS_ID = 'missionsMapCanvas';

await test('100 open/resize/close cycles never accumulate more than 1 click listener', async () => {
  for (let i = 0; i < 100; i++) {
    // "Ouverture": l'onglet Missions devient visible, renderBridgesMap() est appelé (main.js#setMainTabUI)
    renderBridgesMap(CANVAS_ID);

    // "Redimensionnement": rotation d'écran / bascule de point de rupture responsive — la taille du
    // canvas change, renderBridgesMap() est re-déclenché (comme le ferait un vrai resize handler)
    const canvas = stub.cache[CANVAS_ID];
    canvas.width = 800 + (i % 5) * 40;
    canvas.height = 420 + (i % 3) * 20;
    renderBridgesMap(CANVAS_ID);

    // "Fermeture": l'onglet redevient invisible (display:none côté CSS) — aucune API de "destroy" à
    // appeler côté module, le canvas DOM lui-même persiste (c'est tout le point du test: un module qui
    // n'a rien à nettoyer ne doit jamais accumuler d'écouteurs quand on le rouvre).

    assertEqual(stub.getListenerCount(CANVAS_ID, 'click'), 1, `exactly 1 click listener must be bound after cycle ${i + 1}, never more`);
  }
});

await test('the single bound listener is still live and functional after 100 cycles (not a stale/broken closure)', async () => {
  const canvas = stub.cache[CANVAS_ID];
  // Clic au centre du canvas (aucun nœud garanti à cet endroit précis: peu importe, l'assertion réelle
  // est que l'invocation du listener ne lève AUCUNE exception après 100 cycles de ré-appel de
  // renderBridgesMap() — un listener orphelin fermé sur un état obsolète serait le symptôme classique
  // d'une fuite, typiquement révélé par un throw au premier vrai déclenchement.
  let threw = false;
  try {
    canvas.dispatch('click', { currentTarget: canvas, clientX: canvas.width / 2, clientY: canvas.height / 2 });
  } catch (e) { threw = true; }
  assert(!threw, 'the surviving click listener must still execute cleanly after 100 render cycles');
});

await test('listener count remains exactly 1 across additional maps/territories (currentMap changes)', async () => {
  // Changer de territoire ne doit pas non plus réattacher un listener: renderBridgesMap() est appelé à
  // nouveau (nouvelles routes affichées) mais bindInteraction() reste idempotent sur le même canvasId.
  game.mapsData.australia = game.mapsData.australia || { btZones: [], terrain: {}, routes: new Set(['5,5']), craters: new Set(), branches: [{ x: 5, y: 5 }], activeBranch: 0 };
  game.currentMap = 'australia';
  for (let i = 0; i < 20; i++) renderBridgesMap(CANVAS_ID);
  assertEqual(stub.getListenerCount(CANVAS_ID, 'click'), 1, 'switching territories 20x must not accumulate listeners');
});

summary('CanvasLifecycle.test.js');
