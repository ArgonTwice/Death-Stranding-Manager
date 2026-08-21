// tests/resilience/LegendStorageRace.test.js — V1.31.0: bug réel trouvé par revue de code (audit
// libre, pas de brief), même famille que game.beachSession/beachQueue (V1.29.0) mais côté I/O storage
// plutôt qu'état mémoire. DeliveryEngine.tick() peut appeler recordHallOfFame() pour PLUSIEURS
// porteurs dans le MÊME tick synchrone (2+ morts simultanées, ex: raid/BT wipe). Chaque mort éligible
// (systems/LegacySystem.js#recordLegendIfEligible) lançait sa propre IIFE fire-and-forget indépendante
// (load -> unshift -> save) vers le stockage cross-parties (Hall of Fame persisté, distinct de
// game.hallOfFame en mémoire) — 2 appels concurrents lisaient la MÊME liste de départ avant que l'un
// ou l'autre n'ait sauvegardé, donc le 2e à finir écrasait silencieusement le 1er. Fix: une chaîne de
// promesses (legendWriteChain) sérialise toujours load->modify->save d'un appel au suivant.
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { recordLegendIfEligible, loadLegends, saveLegends } = await import('../../src/systems/LegacySystem.js');

function eligiblePorter(name) {
  return { name, level: 20, likes: 999, background: 'x', phobia: 'x', joy: 'x', acquiredTraitIds: [] };
}

async function flush() {
  // laisse toutes les micro-tâches en attente (chaîne de promesses) se résoudre
  await new Promise(r => setTimeout(r, 20));
}

await test('2 eligible deaths in the same synchronous tick must BOTH survive in persisted legends, not overwrite each other', async () => {
  await saveLegends([]);
  recordLegendIfEligible(eligiblePorter('Sam'), 'néantisé');
  recordLegendIfEligible(eligiblePorter('Fragile'), 'néantisé');
  await flush();

  const legends = await loadLegends();
  const names = legends.map(l => l.name);
  assertEqual(legends.length, 2, `both concurrent deaths must be persisted, not just the last one to finish writing (got: ${JSON.stringify(names)})`);
  assert(names.includes('Sam') && names.includes('Fragile'), `both porters must appear in the persisted Hall of Fame, got: ${JSON.stringify(names)}`);
});

await test('5 eligible deaths in the same synchronous tick must all survive, in reverse-call (unshift) order', async () => {
  await saveLegends([]);
  for (const name of ['A', 'B', 'C', 'D', 'E']) recordLegendIfEligible(eligiblePorter(name), 'test');
  await flush();

  const legends = await loadLegends();
  assertEqual(legends.map(l => l.name).join(','), 'E,D,C,B,A', 'all 5 must survive in strict reverse-call order (each unshift must apply to the state left by the previous write, never a stale snapshot)');
});

await test('a single death (the common case) behaves exactly as before this fix', async () => {
  await saveLegends([]);
  recordLegendIfEligible(eligiblePorter('Solo'), 'retraite');
  await flush();

  const legends = await loadLegends();
  assertEqual(legends.length, 1, 'a single eligible death must persist normally');
  assertEqual(legends[0].name, 'Solo', 'the persisted entry must match the single porter');
});

summary('LegendStorageRace.test.js');
