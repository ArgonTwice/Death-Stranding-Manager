// tests/resilience/MessagePause.test.js — suite V1.13.0 (pause automatique le temps de lire un
// message bloquant: nouvelle réplique Die-Hardman, alerte BB Pod): garanties vérifiées empiriquement.
// Même style zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par
// runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game, runtime } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { pauseForMessage, resumeAfterMessage } = await import('../../src/core/GameLoop.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { checkTutorialProgress, skipTutorial } = await import('../../src/ui/TutorialManager.js');
const { showBBPodAlert, dismissBBPodAlert, respondToBBPodAlertUI } = await import('../../src/ui/BBPodOverlay.js');

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

await test('pauseForMessage()/resumeAfterMessage(): basic pause and resume when the game was NOT already paused', async () => {
  runtime.paused = false;
  runtime.messagePauseActive = false;
  pauseForMessage();
  assertEqual(runtime.paused, true, 'the clock must be paused while the message is up');
  assertEqual(runtime.messagePauseActive, true, 'messagePauseActive must track that OUR pause is the one in effect');
  resumeAfterMessage();
  assertEqual(runtime.paused, false, 'the clock must resume once the message is dismissed');
  assertEqual(runtime.messagePauseActive, false, 'messagePauseActive must clear once resumed');
});

await test('pauseForMessage()/resumeAfterMessage(): a manual pause already in effect before the message must survive it', async () => {
  runtime.paused = true; // le joueur avait déjà mis en pause manuellement (bouton Options)
  runtime.messagePauseActive = false;
  pauseForMessage();
  assertEqual(runtime.paused, true, 'still paused (no visible change) while the message is up');
  resumeAfterMessage();
  assertEqual(runtime.paused, true, 'must restore the PRIOR manual pause, never force-resume a pause the player chose themselves');
  runtime.paused = false; // nettoyage direct (togglePause() émettrait render:request sans partie chargée)
});

await test('pauseForMessage(): a second call while already active never overwrites the remembered pre-message state', async () => {
  runtime.paused = false;
  runtime.messagePauseActive = false;
  pauseForMessage(); // pausedBeforeMessage capturé = false
  runtime.paused = true; // simulateun bidouillage externe entre deux messages (ne doit rien perturber)
  pauseForMessage(); // idempotent: ne doit PAS recapturer pausedBeforeMessage=true
  resumeAfterMessage();
  assertEqual(runtime.paused, false, 'must restore the ORIGINAL pre-message state (false), not whatever paused held mid-sequence');
});

await test('BB Pod alert: showBBPodAlert() pauses the clock, dismissBBPodAlert() resumes it', async () => {
  RNG.setSeed(113113);
  newGame(false);
  assertEqual(runtime.paused, false, 'sanity: a fresh game never starts paused');
  showBBPodAlert({ porterId: 0 });
  assertEqual(runtime.paused, true, 'showBBPodAlert() must pause the clock while the choice is pending');
  dismissBBPodAlert();
  assertEqual(runtime.paused, false, 'dismissBBPodAlert() must resume the clock');
});

await test('BB Pod alert: responding via respondToBBPodAlertUI() also resumes the clock', async () => {
  RNG.setSeed(113114);
  newGame(false);
  showBBPodAlert({ porterId: 0 });
  assertEqual(runtime.paused, true, 'sanity: paused while the alert is up');
  respondToBBPodAlertUI('caution');
  assertEqual(runtime.paused, false, 'answering the alert (Prudence/Continuer) must resume the clock exactly like a plain dismiss');
});

await test('Tutorial: the very first Die-Hardman message of a freshly started game pauses the clock', async () => {
  RNG.setSeed(113115);
  newGame(false);
  checkTutorialProgress();
  await tick(); // pauseForMessage() est différé d'un tick (setTimeout 0) — cf. TutorialManager.js#reconcile
  assertEqual(runtime.paused, true, 'the first tutorial line must pause the clock long enough to be read');
  assertEqual(runtime.messagePauseActive, true, 'messagePauseActive must reflect the tutorial-driven pause');
});

await test('Tutorial: resumeAfterMessage() (as fired by any player click) resumes the clock', async () => {
  RNG.setSeed(113116);
  newGame(false);
  checkTutorialProgress();
  await tick();
  assertEqual(runtime.paused, true, 'sanity: paused after the first message');
  resumeAfterMessage(); // simule le prochain clic du joueur (handleDocumentClick dans l'app réelle)
  assertEqual(runtime.paused, false, 'a later interaction must resume the clock');
});

await test('Tutorial: skipping the tutorial while a message-pause is active still resumes the clock (finishTutorial() safety net)', async () => {
  RNG.setSeed(113117);
  newGame(false);
  checkTutorialProgress();
  await tick();
  assertEqual(runtime.paused, true, 'sanity: paused after the first message');
  skipTutorial();
  assertEqual(runtime.paused, false, 'SKIP must never leave the clock stuck paused, even mid-message');
  assertEqual(runtime.messagePauseActive, false, 'messagePauseActive must be cleared by finishTutorial() regardless of the click-based resume path');
});

await test('Tutorial: starting a brand new game after a stale pre-game render() never leaves messagePauseActive stuck for the real session', async () => {
  // Reproduit le bug empirique corrigé en V1.13.0: un rendu (ui/HUD.js#render -> checkTutorialProgress)
  // survenu AVANT tout newGame() (ex: écran de sélection d'emplacement) consommait à tort la toute
  // première étape pour un game.tutorial "placeholder", laissant la VRAIE session sans highlight/pause
  // pour SA propre étape 0 (déjà considérée "peinte" par erreur) — cf. reconcile()'s lastPaintedTutorialRef.
  checkTutorialProgress(); // rendu "avant tout choix d'emplacement", contre l'état module actuel
  await tick();
  RNG.setSeed(113118);
  newGame(false); // remplace game.tutorial par un TOUT NOUVEL objet + réinitialise explicitement le runtime
  assertEqual(runtime.paused, false, 'newGame() must never inherit a phantom pause from a pre-game render()');
  assertEqual(runtime.messagePauseActive, false, 'newGame() must never inherit a phantom messagePauseActive from a pre-game render()');
  checkTutorialProgress(); // le rendu de LA VRAIE session
  await tick();
  assertEqual(runtime.paused, true, 'the real session\'s own step 0 message must still trigger its own pause (not silently skipped as "already painted")');
});

summary('MessagePause.test.js');
