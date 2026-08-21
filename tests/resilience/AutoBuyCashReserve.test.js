// tests/resilience/AutoBuyCashReserve.test.js — V1.27.0: corrige un creux de trésorerie réel mesuré
// empiriquement (tests/balancing-simulation.test.mjs, archétype "optimiseur": jusqu'à $1-11 vers les
// jours 46-53, bien plus sévère que le "$700 entre j30-j100" décrit par le brief externe — ce chiffre
// est en réalité le minimum j200-300 déjà mesuré par le test existant, une fenêtre différente).
// systems/PorterAiEngine.js#autoBuyEquipForIdlePorters() n'avait aucune réserve de trésorerie: un
// roster idle nombreux avec l'automatisation "autoBuyEquip" active pouvait dépenser en continu jusqu'à
// quasi $0 juste avant le prélèvement mensuel de salaires (engine/DeliveryEngine.js#
// startMonthBookkeeping, tout le mois prélevé en une seule fois) — un vrai risque de faillite évitable.
// Corrigé: la routine autonome respecte désormais BALANCE.porterAi.autoBuyReserveSalaryMonths mois de
// salaires en réserve sur le budget commun — jamais sur les crédits personnels (hors trésorerie
// commune), jamais sur un achat MANUEL (systems/EconomySystem.js#buyEquip, non modifié).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { buyEquip } = await import('../../src/systems/EconomySystem.js');
const { autoBuyEquipForIdlePorters } = await import('../../src/systems/PorterAiEngine.js');

function freshFixture(seed, money) {
  RNG.setSeed(seed);
  newGame(false);
  const p = hireRaw('scout');
  p.status = 'idle';
  game.money = money;
  return p;
}

await test('autoBuyEquipForIdlePorters() never spends the common budget below one month of active-roster salaries', async () => {
  const p = freshFixture(2710, 200); // au-dessus du coût du 1er item (cryptobiote=$150, achetable sans la réserve) mais SOUS le salaire du porteur ($350) — isole précisément l'effet de la réserve
  const reserve = p.salary * BALANCE.porterAi.autoBuyReserveSalaryMonths;
  assert(game.money < reserve, 'sanity: starting money must sit strictly under the reserve, so ANY base-budget purchase would breach it');
  const moneyBefore = game.money;

  autoBuyEquipForIdlePorters();

  assertEqual(game.money, moneyBefore, 'with money already at/under the reserve, autonomous purchases via the common budget must be fully blocked — game.money must not move');
});

await test('autoBuyEquipForIdlePorters() DOES still spend once money comfortably clears the reserve', async () => {
  const p = freshFixture(2711, 50000); // largement au-dessus de toute réserve plausible pour un seul porteur
  const moneyBefore = game.money;

  autoBuyEquipForIdlePorters();

  assert(game.money < moneyBefore, 'with money far above the reserve, the autonomous routine must still be able to buy equipment as before — this is a floor, not a freeze');
});

await test('the reserve NEVER blocks spending from the porter\'s own personal credits (out of scope of the common-budget reserve)', async () => {
  const p = freshFixture(2712, 0); // budget commun à $0: toute réserve positive bloquerait un achat sur game.money
  p.credits = 100000; // portefeuille personnel largement suffisant
  const moneyBefore = game.money;

  autoBuyEquipForIdlePorters();

  assertEqual(game.money, moneyBefore, 'sanity: game.money must stay untouched (reserve blocks the common-budget path entirely at $0)');
  assert(p.credits < 100000, `personal credits must still be spendable regardless of the common-budget reserve (credits=${p.credits}, expected a purchase to have gone through)`);
});

await test('the reserve NEVER restricts a MANUAL purchase (Boutique) — only the autonomous routine is gated', async () => {
  const p = freshFixture(2713, 250); // sous la réserve ($350), au-dessus du coût de 'boots' ($200, non gaté par rang — cryptobiote l'est dès EQUIP_MIN_RANK=1, non pertinent ici)
  const bought = buyEquip('boots', p.id); // achat manuel direct, comme un joueur cliquant en Boutique
  assert(bought, 'a manual purchase must succeed purely on affordability (game.money >= cost), the autonomous reserve must never apply here');
});

summary('AutoBuyCashReserve.test.js');
