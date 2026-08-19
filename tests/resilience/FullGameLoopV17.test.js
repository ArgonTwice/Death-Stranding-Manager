// tests/resilience/FullGameLoopV17.test.js — suite globale V1.7.0 (Arbre de compétences porteurs):
// garanties vérifiées empiriquement. Même style zéro-dépendance que le reste de tests/resilience/
// (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw, porterCapacity } = await import('../../src/systems/PorterSystem.js');
const { hasTalent, porterTalents, TALENTS } = await import('../../src/systems/PorterTalentTree.js');

RNG.setSeed(1717);
newGame(false);
hireRaw('scout');
const p = game.porters[0];

await test('Talent tree: a fresh porter (grade 0) has no talents unlocked', async () => {
  assertEqual(porterTalents(p).length, 0, 'a brand new porter must start with zero talents — grades begin at 0');
  for (const id of Object.keys(TALENTS)) assertEqual(hasTalent(p, id), false, `${id} must be locked at grade 0`);
});

await test('Talent tree: reaching the max grade level unlocks the matching talent (Charge Lourde / portage)', async () => {
  p.grades.portage = 99; // niveau 3 (floor(99/25)=3) — juste sous le seuil talent, capacité de référence
  const capacityAtLevel3 = porterCapacity(p);
  assertEqual(hasTalent(p, 'heavyCarry'), false, 'sanity: level 3 must not unlock the talent yet');

  p.grades.portage = 100; // niveau max (gradeLevel = floor(100/25) = 4 = BALANCE.talents.minGradeLevelForTalent)
  assertEqual(hasTalent(p, 'heavyCarry'), true, 'heavyCarry must unlock once portage reaches the max grade level');
  assertEqual(hasTalent(p, 'muleStealth'), false, 'unrelated talents (different category) must stay locked');
  const capacityAtLevel4 = porterCapacity(p);
  // Le passage niveau 3 -> 4 apporte à la fois +1 palier de grade normal (capacityGradePortageMult)
  // ET le bonus talent flat (heavyCarryCapacityBonus) — les deux se cumulent, jamais l'un OU l'autre.
  const expectedDelta = BALANCE.porter.capacityGradePortageMult + BALANCE.talents.heavyCarryCapacityBonus;
  assertEqual(capacityAtLevel4, capacityAtLevel3 + expectedDelta, 'porterCapacity() must include BOTH the normal per-grade step AND the flat heavyCarry talent bonus when crossing into the max grade level');
});

await test('Talent tree: below the max grade level, no talent unlocks (partial progress does not count)', async () => {
  p.grades.discretion = 99; // juste sous le seuil (floor(99/25)=3, seuil=4)
  assertEqual(hasTalent(p, 'muleStealth'), false, 'grade 99 must still be level 3, one short of the level-4 threshold');
  p.grades.discretion = 100;
  assertEqual(hasTalent(p, 'muleStealth'), true, 'grade 100 reaches level 4 and unlocks the talent');
});

await test('Talent tree: talents are purely derived, never a stored field (no game.* mutation from hasTalent/porterTalents)', async () => {
  const before = JSON.stringify(p);
  hasTalent(p, 'muleStealth');
  porterTalents(p);
  const after = JSON.stringify(p);
  assertEqual(after, before, 'reading talents must never mutate the porter object — always derived from p.grades');
});

summary('FullGameLoopV17.test.js');
