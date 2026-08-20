// tests/resilience/NetworkOnboarding.test.js — suite V1.18.0: régression trouvée en vérifiant
// visuellement le Dashboard après la suppression du bouton manuel "Étendre le réseau ($600)"
// (V1.17.0). Le panneau Preppers (#unlock-knots, systems/PrepperSystem.js#connectKnot — SEUL levier
// interactif de croissance du réseau depuis cette suppression, connectKnot() ajoutant lui-même les
// cases du chemin à game.routes) était caché jusqu'au rang "Porteur Certifié" (200 livraisons,
// data/Balance.js#RANKS[2]) — un joueur FRAÎCHEMENT recruté ne pouvait plus jamais faire grandir son
// réseau avant ce rang, rendant l'étape "network" du tutoriel (data/TutorialScript.js, routes.size>=2)
// et toute progression réseau paisible IMPOSSIBLES avant des dizaines de livraisons. Même style
// zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { connectKnot } = await import('../../src/systems/PrepperSystem.js');
const { updateUnlocks } = await import('../../src/ui/HUD.js');
const { TUTORIAL_STEPS } = await import('../../src/data/TutorialScript.js');

RNG.setSeed(118300);
newGame(false);
game.money = 10000;
hireRaw('scout');

await test('updateUnlocks() runs cleanly at rank 0 (Freelance) on a fresh game — no crash while re-evaluating the Preppers panel gate', async () => {
  // Note: la vérification DIRECTE de #unlock-knots.style.display est impossible avec le stub DOM
  // partagé de _stubEnv.mjs (son Proxy .style ignore tout .set(), get() renvoie toujours '' — même
  // limitation déjà documentée par TutorialCampHardening.test.js, qui teste .classList à la place
  // pour cette raison). Les deux tests suivants vérifient donc la conséquence OBSERVABLE réelle
  // (connectKnot() utilisable, étape tutoriel atteignable) plutôt que l'attribut de style lui-même.
  assertEqual(game.completed, 0, 'sanity: a fresh game has completed 0 deliveries — rank must be Freelance (index 0)');
  updateUnlocks();
});

await test('a brand-new player CAN grow game.routes via connectKnot() well before rank "Porteur Certifié" (200 completed deliveries)', async () => {
  const d = game.mapsData[game.currentMap];
  const before = d.routes.size;
  const knotIdx = d.mainKnots.findIndex(k => !d.routes.has(`${k.x},${k.y}`));
  assert(knotIdx !== -1, 'sanity: at least one unconnected Prepper knot must exist on a fresh map');
  connectKnot(knotIdx);
  assert(d.routes.size > before, 'connectKnot() must actually grow game.routes for a rank-0 player — this is now the primary lever for network growth (autoExpandNetworkByStars, V1.17.0, only kicks in monthly once 1⭐ is reached, which itself requires a connection made THIS way)');
});

await test('the tutorial "network" step (routes.size>=2) is reachable by a fresh player using ONLY connectKnot(), no longer stuck behind the removed manual button', async () => {
  RNG.setSeed(118301);
  newGame(false);
  game.money = 10000;
  hireRaw('scout');
  const networkStep = TUTORIAL_STEPS.find(s => s.id === 'network');
  assert(networkStep, 'sanity: the tutorial script must still define a "network" step');
  assert(!networkStep.isStepSatisfied(game), 'sanity: not yet satisfied on a truly fresh game');
  const d = game.mapsData[game.currentMap];
  // Un joueur au tout début du jeu ne peut agir QUE via connectKnot() désormais (plus de buildRoute()
  // manuel) — raccorde autant de Preppers que nécessaire pour franchir le seuil du script.
  let guard = 0;
  while (!networkStep.isStepSatisfied(game) && guard < d.mainKnots.length) {
    const idx = d.mainKnots.findIndex(k => !d.routes.has(`${k.x},${k.y}`));
    if (idx === -1) break;
    connectKnot(idx);
    guard++;
  }
  assert(networkStep.isStepSatisfied(game), 'the "network" tutorial step must be reachable via connectKnot() alone, without needing to wait for rank "Porteur Certifié" or a monthly auto-expansion tick');
});

summary('NetworkOnboarding.test.js');
