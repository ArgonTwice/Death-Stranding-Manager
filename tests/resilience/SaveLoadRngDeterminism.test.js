// tests/resilience/SaveLoadRngDeterminism.test.js — suite V1.19.0: persistence/SaveManager.js#
// deserializeGame() appelait rollTrait() (flux RNG PARTAGÉ, core/RNG.js#next) pour reconstituer le
// trait d'un porteur issu d'une vieille sauvegarde sans ce champ, AVANT que ensurePorterIdentity()
// (systems/PorterStorySystem.js) n'ait garanti un porterSeed — charger une sauvegarde décalait donc
// silencieusement la seed globale, cassant la reproductibilité bit-à-bit entre "une partie qui vient
// de charger une sauvegarde" et "une partie identique qui n'en a jamais chargé". Corrigé en dérivant
// le trait manquant depuis data/Constants.js#rollTraitFromSeed(porterSeed) (RNG.deriveGenerator), un
// flux isolé qui ne touche jamais RNG.next(). Même style zéro-dépendance que le reste de
// tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, serializeGame, deserializeGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');

RNG.setSeed(119100);
newGame(false);
hireRaw('scout');
hireRaw('scout');
const snapshot = serializeGame();
// Simule une vieille sauvegarde pré-trait: le champ trait est absent d'un des deux porteurs, mais
// porterSeed (V0.5.0+) est bien présent — cas réel visé par le brief ("trait: null consomme du RNG
// au chargement"), pas une sauvegarde antédiluvienne sans porterSeed non plus (cas déjà couvert par
// ensurePorterIdentity et hors périmètre de ce fix).
delete snapshot.porters[0].trait;

await test('deserializeGame() ne consomme JAMAIS le flux RNG partagé, même quand un trait doit être reconstitué', async () => {
  RNG.setSeed(424242);
  const expected = RNG.next(); // valeur de référence: 1er tirage depuis cette seed, sans aucun chargement

  RNG.setSeed(424242); // ré-arme le flux au même point de départ
  deserializeGame(snapshot);
  const actual = RNG.next(); // 1er tirage APRÈS le chargement d'une sauvegarde avec trait manquant

  assertEqual(actual, expected, 'deserializeGame() a décalé le flux RNG partagé — un chargement de sauvegarde ne doit jamais consommer RNG.next()');
});

await test('un trait manquant est tout de même reconstitué (jamais undefined/null après chargement)', async () => {
  assert(game.porters[0].trait != null, 'le porteur sans trait persisté doit recevoir un trait de secours au chargement');
  assert(game.porters[1].trait === snapshot.porters[1].trait, 'un trait déjà présent dans la sauvegarde ne doit jamais être écrasé');
});

await test('le trait de secours reconstitué est déterministe: rejouer le même chargement produit exactement le même trait', async () => {
  RNG.setSeed(555555);
  deserializeGame(snapshot);
  const first = game.porters[0].trait;

  RNG.setSeed(999999); // seed globale différente: ne doit RIEN changer, le trait dépend du porterSeed stocké, pas du flux partagé
  deserializeGame(snapshot);
  const second = game.porters[0].trait;

  assertEqual(second, first, 'le trait de secours doit être dérivé du porterSeed stocké (déterministe), pas du flux RNG global (qui varie selon la seed courante)');
});

summary('SaveLoadRngDeterminism.test.js');
