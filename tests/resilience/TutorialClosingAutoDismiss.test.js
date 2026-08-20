// tests/resilience/TutorialClosingAutoDismiss.test.js — V1.25.1: fix bug réel signalé ("après avoir
// fini toutes les étapes normalement, la bannière Die-Hardman ne disparaît jamais"). Contrairement
// aux 3 premières étapes, la dernière ('closing', TutorialScript.js) est satisfaite d'office
// (isStepSatisfied toujours vrai) — sa consommation n'attend plus AUCUNE action réelle du joueur, mais
// reconcile() clampe à une transition par appel (V1.0.7): il fallait donc un second passage pour la
// clore, lui-même normalement déclenché par un clic (resumeAfterMessage) ou un tick de jeu (render:
// request). Or l'étape juste avant dit explicitement au joueur de NE RIEN cliquer ("laissez le temps
// s'écouler"), et la pause-message posée sur l'étape de clôture bloque justement les ticks naturels —
// un joueur qui obéit à la consigne restait donc bloqué indéfiniment face à la réplique finale.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { reconcile } = await import('../../src/ui/TutorialManager.js');
const { TUTORIAL_STEP_COUNT } = await import('../../src/data/TutorialScript.js');

function freshFixture(seed) {
  RNG.setSeed(seed);
  newGame(false);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await test('reaching the closing step auto-dismisses the banner after a reading delay, with zero click/tick involved', async () => {
  freshFixture(801);
  // Réunit d'un coup les 3 jalons réels (recruit/network/first-delivery) par mutation directe de
  // GameState — même pattern que TutorialCampHardening.test.js, pour isoler l'arrivée à l'étape de
  // clôture sans dépendre d'actions engine réelles (hireRaw/buildRoute émettent 'render:request', ce
  // qui redéclencherait checkTutorialProgress() en cascade et rendrait le scénario impossible à isoler).
  game.porters.push({ id: 9101, name: 'Test Porter', skill: 'scout', status: 'idle', health: 100, stress: 0, gearWear: 0, map: game.currentMap, level: 1, xp: 0, trait: 'none', likes: 0, grades: { portage: 0, combat: 0, discretion: 0, service: 0, reseau: 0 }, equipment: {} });
  game.mapsData.mexico.routes.add('1,1');
  game.mapsData.mexico.routes.add('2,2');
  game.completed = 1;

  reconcile(game); // recruit -> network
  reconcile(game); // network -> first-delivery
  reconcile(game); // first-delivery -> closing (peint la réplique finale, programme pauseForMessage + l'auto-clôture)
  assertEqual(game.tutorial.step, TUTORIAL_STEP_COUNT - 1, 'sanity: landed exactly on the closing step');
  assertEqual(game.tutorial.completed, false, 'sanity: not completed yet — the closing line must still be readable for a moment');

  const el = document.getElementById('tutorialOverlay');
  assert(el.classList.contains('open'), 'the closing line must be visibly shown, not silently skipped');

  // Aucun clic, aucun reconcile() supplémentaire, aucun tick de jeu simulé ci-dessous — exactement le
  // scénario du joueur qui obéit à la consigne "laissez le temps s'écouler" de l'étape précédente.
  await wait(4400);
  assertEqual(game.tutorial.completed, true, 'the closing step must auto-finish on its own after a reading delay, with no click or tick required');
  assert(el.classList.contains('hidden'), 'the banner must be visually retired (.hidden) once auto-finished, exactly like SKIP/natural completion');
});

await test('the auto-dismiss timer never double-fires when the player DOES click before it elapses', async () => {
  freshFixture(802);
  game.porters.push({ id: 9102, name: 'Test Porter', skill: 'scout', status: 'idle', health: 100, stress: 0, gearWear: 0, map: game.currentMap, level: 1, xp: 0, trait: 'none', likes: 0, grades: { portage: 0, combat: 0, discretion: 0, service: 0, reseau: 0 }, equipment: {} });
  game.mapsData.mexico.routes.add('1,1');
  game.mapsData.mexico.routes.add('2,2');
  game.completed = 1;

  reconcile(game);
  reconcile(game);
  reconcile(game); // arrivée sur la clôture, timer de 4200ms programmé
  reconcile(game); // simule le clic/tick naturel: la clôture est déjà satisfaite (isStepSatisfied toujours vrai) -> finishTutorial() immédiat
  assertEqual(game.tutorial.completed, true, 'sanity: finished via the normal click/tick path, before the auto-dismiss timer');
  const rewardsMoneyAfterFirstFinish = game.money;

  await wait(4400); // laisse le timer différé s'écouler malgré tout
  assertEqual(game.tutorial.completed, true, 'must remain completed — the deferred timer must never un-finish or re-finish it');
  assertEqual(game.money, rewardsMoneyAfterFirstFinish, 'the start-of-game bonus must never be granted twice (grantRewardsOnce guard survives the redundant deferred call)');
});

await test('starting a NEW game within the 4.2s auto-dismiss window never lets the stale timer silently finish the new session\'s tutorial', async () => {
  // V1.25.7 — trouvé par revue de code automatisée: le timer capturait `game.tutorial` (le SINGLETON,
  // relu au moment où le setTimeout FIRE) plutôt que LA session pour laquelle il avait été programmé.
  // newGame()/loadGame() (persistence/SaveManager.js) remplacent game.tutorial par un TOUT NOUVEL
  // objet — un joueur démarrant une nouvelle partie (ou chargeant une sauvegarde) dans cette fenêtre
  // de 4,2s aurait vu le timer de l'ANCIENNE session terminer silencieusement la NOUVELLE: tutoriel
  // jamais affiché, bonus de départ accordé sans avoir joué le tutoriel.
  freshFixture(803);
  game.porters.push({ id: 9103, name: 'Test Porter', skill: 'scout', status: 'idle', health: 100, stress: 0, gearWear: 0, map: game.currentMap, level: 1, xp: 0, trait: 'none', likes: 0, grades: { portage: 0, combat: 0, discretion: 0, service: 0, reseau: 0 }, equipment: {} });
  game.mapsData.mexico.routes.add('1,1');
  game.mapsData.mexico.routes.add('2,2');
  game.completed = 1;

  reconcile(game);
  reconcile(game);
  reconcile(game); // arrivée sur la clôture de LA PREMIÈRE session, timer de 4200ms programmé pour CET OBJET tutorial précis
  const firstSessionTutorial = game.tutorial;
  assertEqual(firstSessionTutorial.completed, false, 'sanity: first session not finished yet');

  // Le joueur démarre une NOUVELLE partie AVANT que le timer ne s'écoule — game.tutorial devient un
  // TOUT NOUVEL objet, distinct de firstSessionTutorial par identité (jamais juste par valeur).
  freshFixture(804);
  const secondSessionTutorial = game.tutorial;
  assert(secondSessionTutorial !== firstSessionTutorial, 'sanity: newGame() must produce a brand new tutorial object, not mutate the old one');
  assertEqual(secondSessionTutorial.step, 0, 'sanity: fresh session starts at step 0');
  assertEqual(secondSessionTutorial.completed, false, 'sanity: fresh session not completed');
  const moneyBeforeStaleTimer = game.money;

  await wait(4400); // laisse le timer DE LA PREMIÈRE session s'écouler, alors que game.tutorial pointe désormais sur la seconde

  assertEqual(game.tutorial, secondSessionTutorial, 'sanity: still the second session\'s tutorial object');
  assertEqual(game.tutorial.completed, false, 'the stale timer must NEVER complete a session it was not scheduled for — the new tutorial must still be waiting at step 0');
  assertEqual(game.tutorial.step, 0, 'the new session\'s progress must be completely untouched by the old timer');
  assertEqual(game.money, moneyBeforeStaleTimer, 'the starter bonus must never be granted to a session that never actually finished its tutorial');
});

summary('TutorialClosingAutoDismiss.test.js');
