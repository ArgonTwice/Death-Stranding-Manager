// tests/resilience/TutorialCampHardening.test.js — V1.0.7: durcissement du tutoriel (clamp
// reconcile() à 1 étape/appel, destruction visuelle complète au SKIP + blocage du réengagement) et
// anti-flickering de l'onglet Camp (dirty-check avant toute écriture innerHTML, cf.
// ui/HUD.js#setInnerHtmlIfChanged).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { buildRoute } = await import('../../src/engine/DeliveryEngine.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { checkTutorialProgress, skipTutorial, reconcile } = await import('../../src/ui/TutorialManager.js');
const { renderTutorialOverlay } = await import('../../src/ui/TutorialOverlay.js');
const { renderMuleCamps } = await import('../../src/ui/HUD.js');

function freshFixture(seed) {
      RNG.setSeed(seed);
      newGame(false);
      game.money = 20000;
    }

// ============================================================
// 1. reconcile() clampée à UNE SEULE étape par appel (plus de boucle while)
// ============================================================
await test('reconcile() advances at most 1 step per call, even when 2 milestones are already satisfied at once', async () => {
      freshFixture(701);
      assertEqual(game.tutorial.step, 0, 'sanity: fresh game starts at step 0');

      // Réunit d'un coup les conditions des étapes 0 (recruit) ET 1 (network) par mutation directe de
      // GameState — jamais via hireRaw()/buildRoute(), qui émettent chacun 'render:request' et
      // déclencheraient donc eux-mêmes des checkTutorialProgress() intermédiaires (HUD.js#render() y
      // est abonné), rendant impossible d'isoler UN SEUL appel à reconcile(). L'ancien reconcile()
      // (V1.0.3-V1.0.6, boucle while) aurait avalé les deux jalons déjà réunis en un seul appel et
      // atterri directement à l'étape 2.
      game.porters.push({ id: 9001, name: 'Test Porter', skill: 'scout', status: 'idle', health: 100, stress: 0, gearWear: 0, map: game.currentMap, level: 1, xp: 0, trait: 'none', likes: 0, grades: { portage: 0, combat: 0, discretion: 0, service: 0, reseau: 0 }, equipment: {} });
      game.mapsData.mexico.routes.add('1,1');
      game.mapsData.mexico.routes.add('2,2');
      assert(game.porters.length >= 1, 'sanity: recruit milestone condition is genuinely met before the call');
      assert(game.mapsData.mexico.routes.size >= 2, 'sanity: network milestone condition is genuinely met before the call');

      reconcile(game);
      assertEqual(game.tutorial.step, 1, 'a single call must advance by exactly ONE step (recruit -> network), never jump straight to step 2');

      reconcile(game);
      assertEqual(game.tutorial.step, 2, 'the SECOND call then advances the second already-satisfied step — one transition per call, not per satisfied milestone');
    });

await test('reconcile() is idempotent: calling it again with no new milestone satisfied does not change the step', async () => {
      freshFixture(702);
      game.porters.push({ id: 9002, name: 'Test Porter', skill: 'scout', status: 'idle', health: 100, stress: 0, gearWear: 0, map: game.currentMap, level: 1, xp: 0, trait: 'none', likes: 0, grades: { portage: 0, combat: 0, discretion: 0, service: 0, reseau: 0 }, equipment: {} });
      reconcile(game);
      assertEqual(game.tutorial.step, 1, 'sanity: advanced to step 1 (network)');
      const stepBefore = game.tutorial.step;
      reconcile(game);
      reconcile(game);
      assertEqual(game.tutorial.step, stepBefore, 'no route milestone was met — repeated reconcile() calls must never advance the step further');
    });

// ============================================================
// 2. SKIP — destruction visuelle complète + blocage du réengagement
// ============================================================
await test('SKIP hides the banner with .hidden (display/height/visibility/pointer-events all locked) and blocks any further re-engagement', async () => {
      freshFixture(703);
      skipTutorial();
      assertEqual(game.tutorial.completed, true, 'skip must complete the tutorial immediately');
      assertEqual(game.tutorial.skipped, true, 'skip must record skipped=true');

      const el = document.getElementById('tutorialOverlay');
      assert(el.classList.contains('hidden'), 'the banner must carry .hidden after SKIP (display:none/height:0/visibility:hidden/pointer-events:none !important in CSS)');
      assert(!el.classList.contains('open'), '.open must be removed — the banner is not just re-styled, it is fully retired');

      // Blocage du réengagement: recréer artificiellement les conditions d'une étape antérieure ne
      // doit plus jamais faire bouger game.tutorial.step une fois completed===true.
      const stepBefore = game.tutorial.step;
      hireRaw('scout');
      for (let i = 0; i < 5 && game.mapsData.mexico.routes.size < 2; i++) buildRoute();
      checkTutorialProgress();
      reconcile(game);
      assertEqual(game.tutorial.step, stepBefore, 'no re-engagement possible after SKIP — step must never move again once completed');
      assertEqual(game.tutorial.completed, true, 'must remain completed');
      assert(el.classList.contains('hidden'), 'the banner must stay hidden across further checkTutorialProgress() calls post-SKIP');
    });

await test('renderTutorialOverlay() re-applied after SKIP keeps the banner hidden (no accidental reopening)', async () => {
      freshFixture(704);
      skipTutorial();
      renderTutorialOverlay(); // simule un appel supplémentaire (ex: un autre module qui redemande un rendu)
      const el = document.getElementById('tutorialOverlay');
      assert(el.classList.contains('hidden'), 'a redundant renderTutorialOverlay() call must never remove .hidden once completed');
      assert(!el.classList.contains('open'), 'a redundant renderTutorialOverlay() call must never re-add .open once completed');
    });

// ============================================================
// 3. Anti-flickering Camp: pas de ré-écriture innerHTML sur un tick sans changement d'état
// ============================================================
function spyOnInnerHtmlWrites(el) {
      let writeCount = 0;
      let value = el.innerHTML;
      Object.defineProperty(el, 'innerHTML', {
        configurable: true,
        get() { return value; },
        set(v) { value = v; writeCount++; }
      });
      return () => writeCount;
    }

await test('renderMuleCamps() does not rewrite the DOM (innerHTML) when game.muleCamps has not changed since the last call', async () => {
      freshFixture(705);
      game.muleCamps = [
        { id: 'm1', x: 1, y: 1, strength: 2, status: 'hostile' },
        { id: 'm2', x: 2, y: 2, strength: 1, status: 'active', fortified: false }
      ];
      game.mapsData[game.currentMap].muleCamps = game.muleCamps;

      const el = document.getElementById('muleCampsPanel');
      const getWriteCount = spyOnInnerHtmlWrites(el);

      renderMuleCamps();
      const afterFirst = getWriteCount();
      assert(afterFirst >= 1, 'sanity: the first call must write the DOM at least once (initial paint)');

      renderMuleCamps();
      renderMuleCamps();
      renderMuleCamps();
      assertEqual(getWriteCount(), afterFirst, 'three more calls with an IDENTICAL game.muleCamps must never touch innerHTML again (no flicker on repeated simulation ticks)');
    });

await test('renderMuleCamps() DOES rewrite the DOM once game.muleCamps genuinely changes (a real update is never silently dropped)', async () => {
      freshFixture(706);
      game.muleCamps = [{ id: 'm1', x: 1, y: 1, strength: 1, status: 'hostile' }];
      game.mapsData[game.currentMap].muleCamps = game.muleCamps;

      const el = document.getElementById('muleCampsPanel');
      const getWriteCount = spyOnInnerHtmlWrites(el);

      renderMuleCamps();
      const afterFirst = getWriteCount();

      renderMuleCamps();
      assertEqual(getWriteCount(), afterFirst, 'sanity: no change yet, no extra write');

      game.muleCamps[0].status = 'pacified'; // changement réel (camp neutralisé)
      renderMuleCamps();
      assert(getWriteCount() > afterFirst, 'a genuine state change must always produce a fresh DOM write — the dirty-check must never mask a real update');
    });

summary('TutorialCampHardening.test.js');
