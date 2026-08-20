// tests/resilience/UrgentEventPause.test.js — suite V1.14.0 (pause automatique sur événements
// urgents: quête urgente sur le territoire actif, attaque de relais MULE) + synthèse Dashboard qui
// distingue désormais un relais 'under_attack' d'un simple camp 'hostile'. Même style zéro-dépendance
// que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game, runtime } = await import('../../src/core/GameState.js');
const { eventBus } = await import('../../src/core/EventBus.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { renderDashboardSynthesis } = await import('../../src/ui/HUD.js'); // charge aussi les eventBus.on(...) de V1.14.0

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

await test('quest:urgent on the ACTIVE map pauses the clock', async () => {
  RNG.setSeed(114101);
  newGame(false);
  assertEqual(runtime.paused, false, 'sanity: fresh game never starts paused');
  eventBus.emit('quest:urgent', { quest: { mapKey: game.currentMap, flavor: 'test' } });
  assertEqual(runtime.paused, true, 'a new urgent quest on the territory the player is currently viewing must pause the clock');
});

await test('quest:urgent on a DIFFERENT (background) map never pauses the clock', async () => {
  RNG.setSeed(114102);
  newGame(false);
  assertEqual(runtime.paused, false, 'sanity');
  eventBus.emit('quest:urgent', { quest: { mapKey: 'a-territory-the-player-is-not-looking-at', flavor: 'test' } });
  assertEqual(runtime.paused, false, 'an event on a territory the player cannot currently see must never freeze their session');
});

await test('mule:relayUnderAttack pauses the clock (CombatEngine.js#checkMuleCamps already gates the emission to the active map)', async () => {
  RNG.setSeed(114103);
  newGame(false);
  assertEqual(runtime.paused, false, 'sanity');
  eventBus.emit('mule:relayUnderAttack', { x: 3, y: 3, campId: 'test-camp' });
  assertEqual(runtime.paused, true, 'a relay falling under MULE attack must pause the clock long enough to notice');
});

await test('a player click resumes the clock after an urgent-event pause, exactly like a tutorial-message pause', async () => {
  RNG.setSeed(114104);
  newGame(false);
  eventBus.emit('mule:relayUnderAttack', { x: 1, y: 1, campId: 'test-camp-2' });
  assertEqual(runtime.paused, true, 'sanity: paused after the alert');
  // _stubEnv.mjs's document has no real click dispatch machinery; call the resume path directly
  // instead (the exact same call a real click triggers via TutorialManager.js#handleDocumentClick).
  const { resumeAfterMessage } = await import('../../src/core/GameLoop.js');
  resumeAfterMessage();
  assertEqual(runtime.paused, false, 'the next interaction must resume the clock, regardless of which system requested the pause');
});

await test('Dashboard synthesis distinguishes an under_attack relay from a merely hostile camp', async () => {
  RNG.setSeed(114105);
  newGame(false);
  game.mapsData[game.currentMap].mainKnots = [];
  game.muleCamps = [{ id: 'c1', x: 2, y: 2, status: 'under_attack', strength: 1 }];
  game.mapsData[game.currentMap].muleCamps = game.muleCamps;
  renderDashboardSynthesis();
  const html = document.getElementById('dashboardSynthesisStrip').innerHTML;
  assert(html.includes('relais sous attaque'), 'an under_attack relay must be surfaced distinctly on the always-visible Dashboard, not silently folded into the hostile-camp count');
  assert(!html.includes('camp(s) MULE hostile'), 'must not ALSO report it as a plain hostile camp (different, more urgent status)');
});

await tick(); // laisse le temps à un éventuel setTimeout(pauseForMessage,0) tutoriel en attente de s'éteindre proprement

summary('UrgentEventPause.test.js');
