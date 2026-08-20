// tests/resilience/BlueprintGating.test.js — suite V1.18.0: engine/DeliveryEngine.js#craft() gate
// désormais chaque "blueprint" du Chaudron chiral par un palier d'étoiles Prepper
// (data/UnlockTree.js#RECIPE_MIN_STARS), même principe additif que buyEquip()/buyVehicle()
// (EconomySystem.js) pour la Boutique. Même style zéro-dépendance que le reste de
// tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game, runtime } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { RECIPE_MIN_STARS } = await import('../../src/data/UnlockTree.js');
const { RECIPES } = await import('../../src/data/Constants.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { craft } = await import('../../src/engine/DeliveryEngine.js');
const { cellKey } = await import('../../src/data/Constants.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');

function giveMaterialsFor(recipeId) {
  const r = RECIPES.find(x => x.id === recipeId);
  for (const mat in r.cost) game.materials[mat] = (game.materials[mat] || 0) + r.cost[mat] * 5;
}

RNG.setSeed(118200);
newGame(false);
game.structures.cauldron = 1; // requis par craft() pour tout accès au Chaudron
const testPorter = hireRaw('scout'); // certaines recettes (needsPorter:true) exigent une cible sélectionnée
runtime.selectedPorterId = testPorter.id;

await test('a recipe gated above the current Prepper stars (0 on a fresh game) refuses to craft, even with materials in stock', async () => {
  const gatedId = Object.keys(RECIPE_MIN_STARS).find(id => RECIPE_MIN_STARS[id] >= 2);
  assert(gatedId, 'sanity: at least one recipe must require >=2 stars for this test to mean anything');
  giveMaterialsFor(gatedId);
  const materialsBefore = { ...game.materials };
  craft(gatedId);
  assertEqual(JSON.stringify(game.materials), JSON.stringify(materialsBefore), 'craft() must never consume materials for a recipe still locked by Prepper stars');
});

await test('a recipe whose star requirement is already met crafts normally', async () => {
  // Raccorde le premier Prepper du territoire (n'importe quelle relation connectée donne AU MOINS
  // 1⭐, cf. systems/PrepperSystem.js#prepperStars: Math.max(1, ...)) pour sortir de l'état "0⭐"
  // d'une partie fraîche — sinon même une recette à seuil 1⭐ resterait verrouillée.
  const d = game.mapsData[game.currentMap];
  const knot = d.mainKnots[0];
  d.routes.add(cellKey(knot.x, knot.y));
  const freeId = Object.keys(RECIPE_MIN_STARS).find(id => RECIPE_MIN_STARS[id] <= 1);
  assert(freeId, 'sanity: at least one recipe must require <=1 star for this test to mean anything');
  giveMaterialsFor(freeId);
  const materialsBefore = { ...game.materials };
  craft(freeId);
  assert(JSON.stringify(game.materials) !== JSON.stringify(materialsBefore), `craft() must actually consume materials once the star requirement (${RECIPE_MIN_STARS[freeId] || 0}⭐) is already met`);
});

await test('every RECIPE_MIN_STARS entry refers to a real recipe id (no stale/fictional blueprint)', async () => {
  const realIds = new Set(RECIPES.map(r => r.id));
  for (const id of Object.keys(RECIPE_MIN_STARS)) {
    assert(realIds.has(id), `RECIPE_MIN_STARS references "${id}", which does not exist in data/Constants.js#RECIPES`);
  }
});

summary('BlueprintGating.test.js');
