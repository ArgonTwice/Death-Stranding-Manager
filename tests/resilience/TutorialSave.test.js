// tests/resilience/TutorialSave.test.js — parcours complet du tutoriel Die-Hardman, [SKIP] dès
// l'étape 1 (UI libérée, rewardsGranted idempotent), restauration Save/Reload en milieu de tutoriel,
// et le test le plus important: déterminisme strict RNG — Seed X + Tuto joué vs Seed X + Tuto SKIP
// doivent produire un GameState de SIMULATION 100% identique (le sous-objet game.tutorial lui-même
// diffère légitimement entre les deux parcours — ce n'est pas ce que la règle 1 protège).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame, saveGame, loadGame, serializeGame, saveKeyFor } = await import('../../src/persistence/SaveManager.js');
const { advanceDay } = await import('../../src/engine/DeliveryEngine.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { buildRoute } = await import('../../src/engine/DeliveryEngine.js');
const { checkTutorialProgress, skipTutorial } = await import('../../src/ui/TutorialManager.js');
const { TUTORIAL_STEP_COUNT, TUTORIAL_REWARDS } = await import('../../src/data/TutorialScript.js');

function freshFixture(seed) {
      RNG.setSeed(seed);
      newGame(false);
      game.money = 20000;
    }

// ============================================================
// 1. Parcours complet jusqu'à la fin
// ============================================================
await test('full playthrough: recruit -> network -> first delivery -> closing, auto-validated at each step', async () => {
      freshFixture(11);
      assertEqual(game.tutorial.step, 0, 'fresh game starts at step 0');
      checkTutorialProgress();
      assertEqual(game.tutorial.completed, false, 'not completed yet — nothing done');

      hireRaw('scout');
      checkTutorialProgress();
      assertEqual(game.tutorial.step, 1, 'recruiting a porter must auto-advance past step 0 (recruit)');

      // buildRoute() needs money (it has, 20000) and unlocks progressively; call it enough times to
      // reach routes.size >= 2 (starts at 1, "5,5").
      for (let i = 0; i < 5 && game.mapsData.mexico.routes.size < 2; i++) buildRoute();
      checkTutorialProgress();
      assertEqual(game.tutorial.step, 2, 'extending the network must auto-advance past step 1 (network)');

      // Drive days until the first delivery resolves (auto-dispatch assigns the idle porter). Note:
      // DeliveryEngine.js/PorterSystem.js emit 'render:request' on nearly every state change, and
      // HUD.js's render() (auto-subscribed to that event) now also calls checkTutorialProgress() —
      // so in real play (and here, since SaveManager.js transitively imports HUD.js) a step can be
      // satisfied AND the trivially-true closing step consumed within the very same advanceDay(),
      // without needing an extra explicit call. Don't over-specify the exact intermediate step value;
      // assert only the real, meaningful milestones.
      let days = 0;
      while (game.tutorial.step < 3 && days < 60) { advanceDay(); checkTutorialProgress(); days++; }
      assert(game.completed >= 1, 'sanity: at least one delivery must have completed within 60 days');
      assert(game.tutorial.step >= 3, 'first completed delivery must auto-advance at least past step 2 (first-delivery)');

      checkTutorialProgress(); // idempotent no-op if the closing step was already auto-consumed above
      assertEqual(game.tutorial.completed, true, 'reaching the closing step must complete the tutorial');
      assertEqual(game.tutorial.skipped, false, 'a natural completion must never set skipped');
      assertEqual(game.tutorial.rewardsGranted, true, 'completion must grant the one-time reward, same as skip');
    });

// ============================================================
// 2. [SKIP] dès l'étape 1
// ============================================================
await test('[SKIP] at step 1: UI freed, rewardsGranted=true, no double-grant on a second click or a reload', async () => {
      freshFixture(22);
      const moneyBefore = game.money;
      const crystalBefore = game.materials.chiral_crystal || 0;

      skipTutorial();
      assertEqual(game.tutorial.completed, true, 'skip must complete the tutorial immediately');
      assertEqual(game.tutorial.skipped, true, 'skip must record skipped=true');
      assertEqual(game.tutorial.rewardsGranted, true, 'skip must grant the reward');
      assertEqual(game.money, moneyBefore + TUTORIAL_REWARDS.money, 'exact reward amount must be granted exactly once');
      assertEqual(game.materials.chiral_crystal, crystalBefore + TUTORIAL_REWARDS.chiral_crystal, 'exact material reward must be granted exactly once');

      const moneyAfterSkip = game.money;
      skipTutorial(); // second click — must be a strict no-op
      assertEqual(game.money, moneyAfterSkip, 'a second [SKIP] click must never grant the reward again');

      // Reload from a save taken AFTER the skip — rewardsGranted must survive and prevent re-granting.
      await saveGame(true);
      const persistedRaw = localStorage.getItem(saveKeyFor(1));
      newGame(false); // destroys the live runtime, exactly like the save/reload resilience pattern
      localStorage.setItem(saveKeyFor(1), persistedRaw);
      const loaded = await loadGame(1);
      assert(loaded, 'reload must succeed');
      assertEqual(game.tutorial.rewardsGranted, true, 'rewardsGranted must survive save/reload');
      const moneyAfterReload = game.money;
      checkTutorialProgress(); // simulates the next render() tick after resuming
      skipTutorial(); // even a fresh skip call post-reload must be a no-op (already completed)
      assertEqual(game.money, moneyAfterReload, 'no reward must be granted again after a reload of an already-skipped tutorial');
    });

// ============================================================
// 3. Restauration Save/Reload en milieu de tutoriel
// ============================================================
await test('save/reload mid-tutorial restores the exact step and un-satisfied state (no skip forward, no reset backward)', async () => {
      freshFixture(33);
      hireRaw('scout');
      checkTutorialProgress();
      assertEqual(game.tutorial.step, 1, 'sanity: mid-tutorial at step 1 (network)');

      await saveGame(true);
      const persistedRaw = localStorage.getItem(saveKeyFor(1));
      newGame(false);
      localStorage.setItem(saveKeyFor(1), persistedRaw);
      const loaded = await loadGame(1);
      assert(loaded, 'reload must succeed');

      assertEqual(game.tutorial.step, 1, 'step must be restored exactly as it was saved');
      assertEqual(game.tutorial.completed, false, 'must still be in progress after reload');
      assertEqual(game.porters.length, 1, 'the porter recruited before saving must have survived the reload');

      // Resuming play must continue seamlessly from the restored step — not restart from 0.
      for (let i = 0; i < 5 && game.mapsData.mexico.routes.size < 2; i++) buildRoute();
      checkTutorialProgress();
      assertEqual(game.tutorial.step, 2, 'progress must continue from the restored step, not from scratch');
    });

// ============================================================
// 4. Déterminisme strict: Tuto joué vs Tuto SKIP => GameState de simulation identique
// ============================================================
const SEED = 44;
const DAYS = 40;

function runScenario(tutorialOn) {
      freshFixture(SEED);
      if (!tutorialOn) {
        skipTutorial(); // reward granted immediately, before any simulated day
      }
      hireRaw('scout');
      if (tutorialOn) checkTutorialProgress();
      for (let i = 0; i < 5 && game.mapsData.mexico.routes.size < 2; i++) buildRoute();
      if (tutorialOn) checkTutorialProgress();
      for (let d = 0; d < DAYS; d++) {
        advanceDay();
        if (tutorialOn) checkTutorialProgress();
      }
      const s = serializeGame();
      delete s.terminalLastSeen; // horodatage réel, non-déterministe par construction (SaveManager.js)
      delete s.tutorial; // le sous-objet tutorial LUI-MÊME diffère légitimement (step/skipped) — seule
      // la simulation doit être identique, pas la progression du tutoriel qui l'a accompagnée.
      // game.log est exclu pour la même raison que tests/run-once.mjs ne compare jamais que logTail
      // (5 dernières entrées) plutôt que le journal complet: le BILAN mensuel (DeliveryEngine.js
      // #endMonthBookkeeping) attribue TOUT changement net d'argent du mois à "revenus" — un montant
      // fixe accordé un mois différent (immédiat au SKIP vs après complétion réelle du dernier jalon)
      // déplace donc À QUEL MOIS ce texte de log l'attribue, sans que la moindre valeur de jeu
      // (argent final, porteurs, matériaux, réseau...) ne change — un artefact de journalisation
      // préexistant (déjà vrai pour toute relique/sponsor ponctuel), pas une fuite RNG/simulation.
      delete s.log;
      return s;
    }

await test('Seed 44 + Tutorial played through vs Seed 44 + Tutorial SKIPPED: identical simulation GameState', async () => {
      const onResult = runScenario(true);
      const onTutorialCompleted = game.tutorial.completed;
      const onRewardsGranted = game.tutorial.rewardsGranted;

      const offResult = runScenario(false);
      const offTutorialSkipped = game.tutorial.skipped;
      const offRewardsGranted = game.tutorial.rewardsGranted;

      assert(onTutorialCompleted, 'sanity: the ON run must have actually completed the tutorial via real progress');
      assert(onRewardsGranted && offRewardsGranted, 'both runs must have granted the reward exactly once');
      assert(offTutorialSkipped, 'sanity: the OFF run must have genuinely used skip');

      assertEqual(JSON.stringify(onResult), JSON.stringify(offResult), 'RNG.js/GameState.js simulation must be 100% orthogonal to whether the tutorial was played or skipped — any diff means the tutorial leaked into RNG or altered simulation timing');
    });

summary('TutorialSave.test.js');
