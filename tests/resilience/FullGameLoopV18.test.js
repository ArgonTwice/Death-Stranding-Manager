// tests/resilience/FullGameLoopV18.test.js — suite globale V1.8.0 (Pods Robotiques autonomes /
// Robot-Buddies): garanties vérifiées empiriquement. Même style zéro-dépendance que le reste de
// tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hire, hireRaw, scoutCandidate } = await import('../../src/systems/PorterSystem.js');
const { recruitRobotBuddy, isRobotBuddyUnlocked, robotBuddyCount } = await import('../../src/systems/RobotBuddySystem.js');
const { connectKnot } = await import('../../src/systems/PrepperSystem.js');

RNG.setSeed(1818);
newGame(false);
game.money = 50000;

await test('Robot-Buddy: never obtainable from a normal hire/scout (skill pool excludes "robot")', async () => {
  for (let i = 0; i < 40; i++) hireRaw(); // tirage aléatoire du skill à chaque appel
  assertEqual(game.porters.some(p => p.skill === 'robot'), false, 'random hiring must never produce a robot skill, even across many draws');
});

await test('Robot-Buddy: recruitment is locked before rank + Prepper stars requirements are met', async () => {
  assertEqual(isRobotBuddyUnlocked(), false, 'sanity: a fresh game (rank 0, 0 stars) must not unlock Robot-Buddies');
  const result = recruitRobotBuddy();
  assertEqual(result, false, 'recruitRobotBuddy() must refuse while locked');
  assertEqual(robotBuddyCount(), 0, 'no robot must have been added while locked');
});

await test('Robot-Buddy: recruitment succeeds once rank + stars are met, costs money, grants zero salary', async () => {
  const d = game.mapsData[game.currentMap];
  connectKnot(0);
  d.mainKnots[0].relation = 100; // 5 étoiles, largement au-dessus du seuil ROBOT_BUDDY_MIN_STARS (3)
  game.completed = 999; // force un rang élevé via currentRankIndex() (basé sur completed + reputation)
  game.reputation = 100;
  assertEqual(isRobotBuddyUnlocked(), true, 'rank + stars requirements must now be met');
  const moneyBefore = game.money;
  const result = recruitRobotBuddy();
  assertEqual(result, true, 'recruitRobotBuddy() must succeed once unlocked with sufficient budget');
  assertEqual(robotBuddyCount(), 1, 'exactly one robot buddy must now exist');
  const buddy = game.porters.find(p => p.skill === 'robot');
  assertEqual(buddy.salary, 0, 'a freshly recruited Robot-Buddy must have zero salary');
  assert(game.money < moneyBefore, 'recruitment must cost money');
});

await test('Robot-Buddy: fleet is capped at BALANCE.robotBuddy.maxOwned', async () => {
  game.money = 1000000;
  for (let i = 0; i < BALANCE.robotBuddy.maxOwned + 3; i++) recruitRobotBuddy();
  assertEqual(robotBuddyCount(), BALANCE.robotBuddy.maxOwned, 'the fleet must never exceed the configured cap, regardless of available budget');
});

summary('FullGameLoopV18.test.js');
