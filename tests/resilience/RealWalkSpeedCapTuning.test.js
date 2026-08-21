// tests/resilience/RealWalkSpeedCapTuning.test.js — V1.27.0: resserre le plafond de bonus de vitesse
// RealWalk (BALANCE.realWalk.speedBonusCap, 0.15 -> 0.10) pour limiter l'avantage cumulé d'un joueur
// 100% passif IRL (marche seule, aucune gestion active) sur un joueur actif en gestion pure. Mesuré
// via tests/balancing-simulation.test.mjs: l'archétype "realwalk" (setup IDENTIQUE à "casual", seule
// différence: recordSteps(7000)/jour) finissait avec ~2.5x l'argent de "casual" sur 300 jours — la
// majeure partie de l'écart vient en réalité de l'extension réseau gratuite via les pas
// (systems/ReconnaissanceSystem.js#extendNetworkDeterministic, mécanique volontairement DISTINCTE,
// V1.6.0 — non touchée ici), mais speedBonusCap reste le seul levier qui agit sur CHAQUE livraison
// sans dépendre du hasard du réseau déjà découvert — verrouille la nouvelle valeur et vérifie qu'elle
// se propage fidèlement dans le calcul réel (jamais un simple contrôle de la constante isolée).
import { installStubEnv, test, assert, assertEqual, summary } from './_stubEnv.mjs';

installStubEnv();

const { game } = await import('../../src/core/GameState.js');
const { RNG } = await import('../../src/core/RNG.js');
const { BALANCE } = await import('../../src/data/Balance.js');
const { newGame } = await import('../../src/persistence/SaveManager.js');
const { recordSteps, realWalkSpeedBonusMult } = await import('../../src/systems/RealWalkSystem.js');

await test('BALANCE.realWalk.speedBonusCap is locked to the recalibrated value (0.15 -> 0.10)', async () => {
  assertEqual(BALANCE.realWalk.speedBonusCap, 0.10, 'speedBonusCap must stay at the V1.27.0 recalibrated value — any future change here needs a deliberate, verified balancing pass, not an accidental edit');
});

await test('realWalkSpeedBonusMult() never drops below 1 - speedBonusCap, however many steps are recorded', async () => {
  RNG.setSeed(2720);
  newGame(false);
  recordSteps(10_000_000); // un total de pas IRL délibérément absurde — même un joueur ultra-assidu ne doit jamais dépasser le plafond
  const mult = realWalkSpeedBonusMult();
  assert(mult >= 1 - BALANCE.realWalk.speedBonusCap - 1e-9, `realWalkSpeedBonusMult() (${mult}) must never go below 1 - speedBonusCap (${1 - BALANCE.realWalk.speedBonusCap}) regardless of totalSteps`);
  assertEqual(mult, 1 - BALANCE.realWalk.speedBonusCap, 'a huge step count must saturate exactly at the cap, never overshoot it');
});

await test('the speed bonus scales linearly with chiral km walked, capped at exactly the new 0.10 ceiling (not the old 0.15)', async () => {
  RNG.setSeed(2721);
  newGame(false);
  // Calibre un total de pas juste sous le seuil de saturation pour vérifier le calcul linéaire brut
  // (aucun RNG dans ce module — arithmétique pure sur game.totalSteps, cf. RÈGLE 2 du fichier source).
  const kmForOldCap = 0.15 / BALANCE.realWalk.speedBonusPerChiralKm; // ce que l'ANCIEN plafond (0.15) aurait autorisé
  const steps = Math.floor(kmForOldCap * BALANCE.realWalk.stepsPerChiralKm);
  recordSteps(steps);
  const mult = realWalkSpeedBonusMult();
  assert(mult > 1 - 0.15 - 1e-9, `at a step count that would have hit the OLD cap (0.15) exactly, the mult (${mult}) must now be higher (less bonus) thanks to the tighter 0.10 cap`);
  assertEqual(mult, 1 - BALANCE.realWalk.speedBonusCap, 'this step count already exceeds the new, tighter cap — must saturate at 1 - 0.10, not the raw linear value');
});

summary('RealWalkSpeedCapTuning.test.js');
