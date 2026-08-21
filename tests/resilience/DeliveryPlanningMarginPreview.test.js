// tests/resilience/DeliveryPlanningMarginPreview.test.js — suite V1.26.0 (docs/ROADMAP_V2.md idée 2):
// verrouille engine/DeliveryEngine.js#estimateNetMarginPreview, l'aperçu de marge nette live appelé
// depuis ui/DeliveryPlanningPanel.js AVANT le clic "Envoyer". Trois garanties, dans l'ordre de risque
// décroissant: (1) l'aperçu et le dispatch réel (createDelivery, via dispatchDeliveryManually)
// partagent la MÊME formule (computeDeliveryEconomics factorisée) — ne peuvent jamais diverger;
// (2) l'aperçu ne consomme JAMAIS RNG.next() — sinon rien qu'OUVRIR l'onglet Livraisons déciderait
// silencieusement le tirage d'un futur événement/loot, cassant le déterminisme; (3) l'aperçu PEEK une
// cargaison perdue proche sans jamais la SPLICER (collectNearbyLostCargo() le fait, lui, au dispatch
// réel) — sinon afficher l'aperçu "consommerait" un pickup sans jamais envoyer le porteur.
// Même style zéro-dépendance que le reste de tests/resilience/ (_stubEnv.mjs), auto-découvert par
// runAll.mjs.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { hireRaw } = await import('../../src/systems/PorterSystem.js');
const { dispatchDeliveryManually, estimateNetMarginPreview, estimateNetMargin } = await import('../../src/engine/DeliveryEngine.js');

await test('estimateNetMarginPreview returns null for an unknown porter index (defensive, no crash)', async () => {
  RNG.setSeed(2600);
  newGame(false);
  assertEqual(estimateNetMarginPreview(999, 5, 5, 'standard', undefined), null, 'an out-of-range porterIdx must yield null, never throw');
});

await test('estimateNetMarginPreview matches the margin of the delivery actually dispatched with the same porter/dest/cargo/route', async () => {
  RNG.setSeed(2601);
  newGame(false);
  const p = hireRaw('scout');
  const porterIdx = game.porters.findIndex(x => x.id === p.id);
  const destX = Math.min(9, p.x + 4), destY = p.y;

  const preview = estimateNetMarginPreview(porterIdx, destX, destY, 'standard', undefined);
  assert(preview, 'sanity: preview must resolve for a valid idle porter');

  const ok = dispatchDeliveryManually(porterIdx, destX, destY, { cargoType: 'standard' });
  assert(ok, 'sanity: dispatch must succeed right after computing the preview for the same parameters');
  const d = game.deliveries[0];
  const actual = estimateNetMargin(d);

  assertEqual(preview.net, actual.net, `preview.net (${preview.net}) must equal the real dispatched delivery's net margin (${actual.net}) — the two must share one formula, never drift`);
  assertEqual(preview.gross, actual.gross, 'preview.gross must equal the real dispatched delivery reward');
  assertEqual(preview.salaryCost, actual.salaryCost, 'preview.salaryCost must equal the real dispatched delivery salary cost');
});

await test('estimateNetMarginPreview never consumes RNG.next() — calling it any number of times must not shift the shared RNG stream', async () => {
  RNG.setSeed(2602);
  newGame(false);
  const p = hireRaw('scout');
  const porterIdx = game.porters.findIndex(x => x.id === p.id);
  const destX = Math.min(9, p.x + 3), destY = p.y;

  estimateNetMarginPreview(porterIdx, destX, destY, 'standard', undefined);
  estimateNetMarginPreview(porterIdx, destX, destY, 'heavy', 'safe');
  estimateNetMarginPreview(porterIdx, destX, destY, 'standard', undefined);
  const afterPreviews = RNG.next();

  // Rejoue EXACTEMENT la même séquence d'appels consommant du RNG (setSeed -> newGame -> hireRaw),
  // sans les 3 appels preview, pour isoler leur consommation propre — comparer contre un newGame() nu
  // sans hireRaw() donnerait un faux positif de divergence (hireRaw() consomme lui-même du RNG pour la
  // génération procédurale du porteur).
  RNG.setSeed(2602);
  newGame(false);
  hireRaw('scout');
  const freshFirstNext = RNG.next();

  assertEqual(afterPreviews, freshFirstNext, 'three preview calls must leave the RNG stream exactly where it was — any deviation means the preview accidentally consumed randomness');
});

await test('estimateNetMarginPreview peeks a nearby lost-cargo bonus without splicing it — the real dispatch still collects it afterwards', async () => {
  RNG.setSeed(2603);
  newGame(false);
  const p = hireRaw('scout');
  const porterIdx = game.porters.findIndex(x => x.id === p.id);
  const destX = Math.min(9, p.x + 4), destY = p.y;
  const mapData = game.mapsData[p.map];
  mapData.lostCargo = [{ x: destX, y: destY, reward: 250, expiresMonth: game.month + 1 }];

  const preview1 = estimateNetMarginPreview(porterIdx, destX, destY, 'standard', undefined);
  assertEqual(mapData.lostCargo.length, 1, 'a first preview call must NOT splice the lost-cargo entry out of mapsData');
  const preview2 = estimateNetMarginPreview(porterIdx, destX, destY, 'standard', undefined);
  assertEqual(preview1.gross, preview2.gross, 'repeated preview calls must be idempotent (same peeked bonus every time)');
  assertEqual(mapData.lostCargo.length, 1, 'a second preview call must still not have consumed the lost-cargo entry');

  const ok = dispatchDeliveryManually(porterIdx, destX, destY, { cargoType: 'standard' });
  assert(ok, 'sanity: dispatch must succeed');
  assertEqual(mapData.lostCargo.length, 0, 'the REAL dispatch must still collect (splice) the lost cargo — only the preview is non-mutating');
  const d = game.deliveries[0];
  assertEqual(d.lostCargoBonus, 250, 'the dispatched delivery must carry the actual lost-cargo bonus collected at dispatch time');
});

summary('DeliveryPlanningMarginPreview.test.js');
