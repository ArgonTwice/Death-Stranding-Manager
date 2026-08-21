// tests/resilience/DrawerDragVisualFeedback.test.js — V1.36.0: bug réel trouvé par un vrai geste de
// glisser Playwright (mouse.down/move/up simulant un vrai drag pointer), jamais testé ainsi cette
// session (contrairement à un simple appel direct des fonctions exportées de DrawerManager.js, qui
// contourne entièrement ce mécanisme). L'ancien `Math.max(0, delta)` dans attachSwipe()#onMove
// mettait TOUJOURS le déplacement visuel (--drawer-y) à 0 dès que le doigt remontait (delta < 0) —
// quel que soit l'état de départ du tiroir. Pour un tiroir en 'peek' ou 'collapsed', glisser vers le
// HAUT ne bougeait donc JAMAIS visuellement le tiroir pendant tout le geste: il restait figé à sa
// position de repos, ne basculant qu'au relâchement (delta<-60 pour peek->full) — un geste qui
// semblait totalement ignoré jusqu'au lâcher. Confirmé empiriquement: --drawer-y valait
// `calc(58vh + 0px)` du DÉBUT à la FIN d'un glissement de -100px depuis 'peek', alors que le sens
// inverse (glisser vers le bas depuis 'full', delta positif) suivait déjà correctement le doigt en
// temps réel (`calc(0% + 100px)`). Le clamp à 0 n'a de sens QUE pour empêcher un tiroir déjà 'full'
// (baseline 0%, le sommet) de dépasser visuellement le haut de l'écran si on continue à tirer vers
// le haut — jamais pour 'peek'/'collapsed', où un delta négatif doit suivre le doigt normalement.
//
// Extrait en fonction pure (visualDragDelta) pour rester testable sans simuler un vrai geste
// pointer, que le stub DOM minimal de ce fichier ne peut pas reproduire fidèlement (getPropertyValue
// stub retourne toujours '', setProperty est un no-op — cf. _stubEnv.mjs) — ce test verrouille donc
// la LOGIQUE de calcul exacte, la vérification du geste réel en navigateur reste dans le message de
// commit (Playwright jetable).
import { installStubEnv, test, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { visualDragDelta } = await import('../../src/ui/DrawerManager.js');

await test('dragging UP (negative delta) from "peek" must track the finger in real time, never clamp to 0', () => {
  assertEqual(visualDragDelta('peek', -100), -100, 'the visual offset must follow an upward drag from peek, not freeze at the resting position (the real bug: it silently zeroed out here)');
});

await test('dragging UP (negative delta) from "collapsed" must also track the finger in real time', () => {
  assertEqual(visualDragDelta('collapsed', -40), -40, 'same bug family — collapsed is not a real-world drag target (handle is off-screen), but the pure function must stay correct for it regardless');
});

await test('dragging DOWN (positive delta) from any state must always track the finger in real time (already correct pre-fix, must stay so)', () => {
  assertEqual(visualDragDelta('peek', 100), 100, 'downward drag from peek must be unaffected by this fix');
  assertEqual(visualDragDelta('full', 100), 100, 'downward drag from full must be unaffected by this fix');
});

await test('dragging UP (negative delta) while already "full" must clamp to 0 — the ONE case the original clamp correctly protected', () => {
  assertEqual(visualDragDelta('full', -50), 0, 'a drawer already fully open must never visually overshoot past the top of the screen when dragged further up');
});

await test('zero delta (no movement yet) is a no-op in every state', () => {
  assertEqual(visualDragDelta('peek', 0), 0);
  assertEqual(visualDragDelta('full', 0), 0);
  assertEqual(visualDragDelta('collapsed', 0), 0);
});

summary('DrawerDragVisualFeedback.test.js');
