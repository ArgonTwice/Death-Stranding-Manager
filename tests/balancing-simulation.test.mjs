// tests/balancing-simulation.test.mjs (V1.15.0) — simulation headless massive multi-archétypes.
// Suit le même pattern zéro-dépendance que tests/run-once.mjs (stub DOM/localStorage minimal inline,
// aucun canvas/UI réel) mais reste un script AUTONOME (pas auto-découvert par
// tests/resilience/runAll.mjs) — invocation explicite: `node tests/balancing-simulation.test.mjs`.
//
// Objectif: mesurer, sur 300 jours simulés x 4 archétypes de joueur x plusieurs graines RNG, les 4
// familles de métriques du brief (économie/Likes, usure/dégâts cargo, taux de réussite MULE/BT,
// Porter Credits) à partir du VRAI moteur (mêmes fonctions que le jeu réel: advanceDay(), assaultCamp(),
// buyEquip()...) plutôt que d'un modèle séparé — toute correction de data/Balance.js qui en découlerait
// reste donc mécaniquement fidèle au jeu tel qu'il tourne vraiment.
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- Stub DOM/localStorage minimal (identique à tests/run-once.mjs) ---
function makeClassList() {
  const set = new Set();
  return { add(...c) { c.forEach(x => set.add(x)); }, remove(...c) { c.forEach(x => set.delete(x)); }, toggle() {}, contains(c) { return set.has(c); } };
}
const fakeCtx = new Proxy({}, { get(t, p) { if (p in t) return t[p]; return () => fakeCtx; }, set(t, p, v) { t[p] = v; return true; } });
function makeElement(id) {
  return {
    id, value: '', textContent: '', innerHTML: '',
    style: new Proxy({}, { get: () => '', set: () => true }),
    dataset: {}, children: [], classList: makeClassList(), width: 800, height: 400,
    addEventListener() {}, appendChild(c) { this.children.push(c); return c; }, remove() {},
    querySelector() { return makeElement('s'); }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400 }; },
    getContext() { return fakeCtx; }, offsetWidth: 0, offsetHeight: 0
  };
}
const cache = {};
globalThis.document = {
  getElementById(id) { if (!cache[id]) cache[id] = makeElement(id); return cache[id]; },
  querySelectorAll() { return []; }, querySelector() { return makeElement('q'); },
  createElement(t) { return makeElement('c-' + t); }, addEventListener() {},
  body: makeElement('body'), hidden: false
};
globalThis.localStorage = (() => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
})();
globalThis.performance = globalThis.performance || { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;
globalThis.confirm = () => true;
globalThis.window = globalThis;

const SRC = 'file://' + path.join(ROOT, 'src') + '/';
const { game, runtime } = await import(SRC + 'core/GameState.js');
const { RNG } = await import(SRC + 'core/RNG.js');
const { BALANCE } = await import(SRC + 'data/Balance.js');
const { newGame } = await import(SRC + 'persistence/SaveManager.js');
const { advanceDay } = await import(SRC + 'engine/DeliveryEngine.js');
const { hireRaw, hire, forceRest, repairGear } = await import(SRC + 'systems/PorterSystem.js');
const { buyEquip, buyVehicle } = await import(SRC + 'systems/EconomySystem.js');
const { assaultCamp, defendRelay, engageCatcher, buyConsumable } = await import(SRC + 'engine/CombatEngine.js');
const { resolveCatcherEncounter } = await import(SRC + 'systems/raid/CombatResolver.js');
const { toggleAutomation, setAutomationThreshold } = await import(SRC + 'systems/AutomationManager.js');
const { recordSteps } = await import(SRC + 'systems/RealWalkSystem.js');
const { acceptUrgentQuest, refuseUrgentQuest } = await import(SRC + 'systems/QuestSystem.js');
const { dispatchDeliveryManually } = await import(SRC + 'engine/DeliveryEngine.js');
// V1.9.0 Porter Credits: PorterEconomy.js s'abonne à 'delivery:resolved' à l'IMPORT (effet de bord,
// même pattern que systems/MemoryEngine.js) — jamais importé transitivement par les modules ci-dessus
// (tests/run-once.mjs non plus), donc explicitement chargé ici pour que la mesure "Porter Credits"
// reflète le vrai comportement du jeu plutôt qu'un abonnement jamais enregistré.
await import(SRC + 'systems/PorterEconomy.js');

const FAIL = [];
function assert(cond, msg) { if (!cond) FAIL.push(msg); }
function pct(x) { return `${(x * 100).toFixed(1)}%`; }

// ============================================================
// ARCHÉTYPES — chacun fournit setup(seed) et dailyAction(day), rejoue les VRAIES fonctions du jeu
// (aucune nouvelle logique de simulation parallèle: le but est de mesurer le jeu réel, pas un modèle).
// ============================================================
const ARCHETYPES = {
  // Ne touche jamais rien après le lancement: vit entièrement de l'auto-dispatch DV2
  // (engine/DeliveryEngine.js#advanceDay), comme un joueur qui ouvre l'app une fois par semaine.
  casual: {
    setup() {
      game.money = 3000; // V1.18.0 — départ réaliste (DIFFICULTIES.normal.startMoney)
      hireRaw('scout'); hireRaw('hauler');
    },
    dailyAction(day) {
      // Un joueur casual finit quand même par remettre un porteur à zéro s'il traîne (health<=15
      // exclut l'auto-dispatch), et répare vaguement l'équipement le plus abîmé de temps à autre —
      // jamais une gestion fine, mais pas non plus une négligence totale et permanente pendant 300
      // jours (aucun joueur réel n'ignorerait un porteur au sac cassé indéfiniment) — sans jamais
      // toucher à l'automatisation.
      if (day % 10 === 0) {
        game.porters.forEach((p, idx) => { if (p.status === 'idle' && p.health <= 40 && p.health > 0) forceRest(idx); });
      }
      if (day % 15 === 0) {
        game.porters.forEach(p => { if (p.status === 'idle' && (p.gearWear || 0) >= 60) repairGear(p.id); });
      }
    }
  },
  // Automatisation à fond + réinvestissement actif: hire régulier, assaut proactif des camps MULE
  // rentables, accepte les quêtes urgentes disponibles.
  optimiseur: {
    setup() {
      game.money = 3000; // V1.18.0 — départ réaliste (DIFFICULTIES.normal.startMoney)
      ['scout', 'hauler', 'driver', 'dooms'].forEach(s => hireRaw(s));
      toggleAutomation('autoRest'); setAutomationThreshold('autoRestThreshold', 70);
      toggleAutomation('autoRepair'); setAutomationThreshold('autoRepairThreshold', 60);
      toggleAutomation('autoBuyEquip');
    },
    dailyAction(day) {
      if (day % 20 === 0 && game.porters.filter(p => p.status !== 'dead').length < 8 && game.money > BALANCE.porter.hireBaseCost * 3) hire(false);
      // V1.16.0 — un véhicule (maintenance mensuelle x2.5), pour mesurer si ce recalibrage reste
      // un investissement soutenable pour un archétype actif plutôt qu'une ruine silencieuse.
      if (day === 30 && game.porters.some(p => !p.equipment.vehicle)) {
        const p = game.porters.find(p => !p.equipment.vehicle);
        runtime.selectedPorterId = p.id;
        buyVehicle('bike');
      }
      if (day % 7 === 0) {
        for (const c of (game.muleCamps || [])) {
          if (c.status === 'hostile') { assaultCamp(c.id, 'infiltration'); break; } // un seul assaut/semaine, jamais toute l'escouade vidée d'un coup
        }
        for (const c of (game.muleCamps || [])) {
          if (c.status === 'under_attack') { defendRelay(c.id); break; }
        }
      }
      for (const q of (game.urgentQuests || [])) {
        if (q.mapKey !== game.currentMap) continue;
        const idle = game.porters.find(p => p.map === q.mapKey && p.status === 'idle' && p.health > 40);
        if (idle) acceptUrgentQuest(q.id, idle.id, 'shortcut'); else refuseUrgentQuest(q.id); // ne laisse jamais une urgence traîner sans porteur
      }
    }
  },
  // Progression 100% marche IRL, roster volontairement réduit, ne touche jamais à la boutique ni à
  // l'automatisation: mesure ce que RealWalkSystem.js apporte seul.
  realwalk: {
    setup() {
      game.money = 3000; // V1.18.0 — départ réaliste (DIFFICULTIES.normal.startMoney)
      hireRaw('scout'); hireRaw('hauler');
    },
    dailyAction(day) {
      recordSteps(7000); // utilisateur mobile plausible, ~7000 pas/jour — arithmétique pure (aucun RNG.js)
      if (day % 15 === 0) {
        game.porters.forEach(p => { if (p.status === 'idle' && (p.gearWear || 0) >= 60) repairGear(p.id); });
      }
    }
  },
  // Dispatch manuel intégral: choisit lui-même chaque destination AVANT que l'auto-dispatch DV2 ne
  // s'en charge (porteur non-idle au moment où advanceDay() tourne).
  dispatch: {
    setup() {
      game.money = 3000; // V1.18.0 — départ réaliste (DIFFICULTIES.normal.startMoney)
      ['scout', 'hauler', 'driver'].forEach(s => hireRaw(s));
      for (let i = 0; i < 4; i++) game.mapsData.mexico.routes.add(`${i},${i}`); // quelques cases réseau connues comme destinations "voulues"
    },
    dailyAction(day) {
      for (let idx = 0; idx < game.porters.length; idx++) {
        const p = game.porters[idx];
        if (p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100) {
          const dest = [0, 1, 2, 3][idx % 4];
          dispatchDeliveryManually(idx, dest, dest, { route: 'shortcut' });
        }
      }
      if (day % 15 === 0) {
        game.porters.forEach(p => { if (p.status === 'idle' && (p.gearWear || 0) >= 60) repairGear(p.id); });
      }
    }
  }
};

const DAYS = 300;
const SEEDS = [500001, 500002, 500003];

function runArchetype(name, seed, days = DAYS) {
  RNG.setSeed(seed);
  newGame(false);
  ARCHETYPES[name].setup();

  const moneyHistory = [];
  const likesHistory = [];
  let minMoneySince200 = Infinity;

  for (let day = 1; day <= days; day++) {
    ARCHETYPES[name].dailyAction(day);
    advanceDay();
    if (day % 10 === 0) {
      moneyHistory.push(game.money);
      likesHistory.push(game.porters.reduce((s, p) => s + (p.likes || 0), 0));
      if (day >= 200) minMoneySince200 = Math.min(minMoneySince200, game.money);
    }
  }

  const totalLikes = game.porters.reduce((s, p) => s + (p.likes || 0), 0);
  const totalCredits = game.porters.reduce((s, p) => s + (p.credits || 0), 0);
  const avgGearWear = game.porters.length ? game.porters.reduce((s, p) => s + (p.gearWear || 0), 0) / game.porters.length : 0;
  const deadCount = game.porters.filter(p => p.status === 'dead').length;
  const equipBoughtTotal = Object.values(game.equipBought || {}).reduce((s, v) => s + v, 0);

  return {
    seed, day10Likes: likesHistory[0] || 0, finalMoney: game.money, minMoneySince200,
    moneyHistory, likesHistory, totalLikes, totalCredits, avgGearWear, deadCount, equipBoughtTotal,
    porterCount: game.porters.length
  };
}

console.log(`\n=== V1.15.0 SIMULATION D'ÉQUILIBRAGE — ${DAYS} jours x ${SEEDS.length} graines x ${Object.keys(ARCHETYPES).length} archétypes ===\n`);

const results = {};
for (const name of Object.keys(ARCHETYPES)) {
  results[name] = SEEDS.map(seed => runArchetype(name, seed));
  const rs = results[name];
  const avgFinalMoney = Math.round(rs.reduce((s, r) => s + r.finalMoney, 0) / rs.length);
  const avgDay10Likes = Math.round(rs.reduce((s, r) => s + r.day10Likes, 0) / rs.length);
  const avgTotalLikes = Math.round(rs.reduce((s, r) => s + r.totalLikes, 0) / rs.length);
  const avgMinMoney200 = Math.round(rs.reduce((s, r) => s + r.minMoneySince200, 0) / rs.length);
  const avgGearWear = (rs.reduce((s, r) => s + r.avgGearWear, 0) / rs.length).toFixed(1);
  const avgCredits = Math.round(rs.reduce((s, r) => s + r.totalCredits, 0) / rs.length);
  const totalDeaths = rs.reduce((s, r) => s + r.deadCount, 0);
  console.log(`[${name}] argent final moy=$${avgFinalMoney} (min j200-300 moy=$${avgMinMoney200}) · Likes j10 moy=${avgDay10Likes} · Likes total j${DAYS} moy=${avgTotalLikes} · usure gear moy=${avgGearWear}% · Porter Credits total moy=$${avgCredits} · morts cumulées=${totalDeaths}`);

  // --- Économie & Likes ---
  assert(rs.every(r => r.finalMoney >= 0), `[${name}] game.money est passé négatif à un moment donné (faillite non gérée)`);
  assert(avgMinMoney200 > 0 || avgFinalMoney > 500, `[${name}] argent bloqué proche de 0 en fin de partie (j200-300) sans remontée: faillite irrattrapable probable (min moy=$${avgMinMoney200}, final moy=$${avgFinalMoney})`);
  assert(avgDay10Likes < 1000, `[${name}] Likes déjà démesurés au jour 10 (moy=${avgDay10Likes}) — devrait rester de l'ordre de quelques dizaines à ce stade`);
  assert(avgTotalLikes < 100000, `[${name}] Likes totaux après ${DAYS} jours hors de contrôle (moy=${avgTotalLikes})`);

  // --- Fatigue & dégâts cargo ---
  assert(avgGearWear < 95, `[${name}] usure moyenne d'équipement quasi-maximale en permanence (${avgGearWear}%) — aucune marge de gestion, purement frustrant`);

  // --- Porter Credits ---
  if (name === 'optimiseur') assert(avgCredits < BALANCE.porterEconomy.creditsCap * rs[0].porterCount, `[optimiseur] Porter Credits totaux saturés au plafond pour tout le roster — jamais dépensés malgré autoBuyEquip actif`);
}

// ============================================================
// DÉTERMINISME — mêmes graines RNG = mêmes métriques d'équilibrage, pour chaque archétype.
// ============================================================
console.log('\n--- Vérification déterminisme (rejeu de la graine 500001 par archétype) ---');
for (const name of Object.keys(ARCHETYPES)) {
  const a = runArchetype(name, 500001);
  const b = runArchetype(name, 500001);
  const sa = JSON.stringify({ finalMoney: a.finalMoney, totalLikes: a.totalLikes, totalCredits: a.totalCredits, avgGearWear: a.avgGearWear, deadCount: a.deadCount, moneyHistory: a.moneyHistory });
  const sb = JSON.stringify({ finalMoney: b.finalMoney, totalLikes: b.totalLikes, totalCredits: b.totalCredits, avgGearWear: b.avgGearWear, deadCount: b.deadCount, moneyHistory: b.moneyHistory });
  assert(sa === sb, `[${name}] déterminisme rompu: deux runs sur la même graine (500001) produisent des métriques différentes`);
  console.log(`[${name}] déterminisme: ${sa === sb ? 'OK' : 'ÉCHEC'}`);
}

// ============================================================
// TAUX DE RÉUSSITE MULE (CombatEngine.js#assaultCamp/defendRelay) — mesure empirique vs la formule de
// successChance calculée par le moteur lui-même (même code, aucune duplication de formule ici):
// vérifie que la résolution RNG réelle respecte bien la probabilité annoncée, pas qu'elle vaille une
// valeur arbitraire fixée par le brief (aucun "~85/60/30%" codé en dur nulle part dans le projet réel).
// ============================================================
console.log('\n--- Taux de réussite MULE (assaut) — empirique vs formule interne ---');
function measureAssaultWinRate(mode, squadSize, campStrength, trials) {
  RNG.setSeed(910001);
  newGame(false);
  let wins = 0;
  for (let i = 0; i < trials; i++) {
    game.porters = [];
    for (let j = 0; j < squadSize; j++) { hireRaw('scout'); const p = game.porters[game.porters.length - 1]; p.health = 100; p.gearWear = 0; }
    const campId = `sim-camp-${i}`;
    const camp = { id: campId, x: 1, y: 1, status: 'hostile', strength: campStrength };
    game.muleCamps = [camp];
    game.mapsData[game.currentMap].muleCamps = game.muleCamps;
    assaultCamp(campId, mode);
    if (camp.status === 'pacified') wins++;
  }
  return wins / trials;
}
function theoreticalAssaultChance(mode, squadSize, campStrength) {
  const B = BALANCE.combat;
  let c = B.assaultSuccessBase + squadSize * B.assaultSuccessPerSquadMember;
  c += mode === 'assault' ? B.assaultDirectBonus : 0; // approximation basse (ignore bolagun/discretion grade, tous à 0 pour des scouts fraîchement recrutés)
  c = Math.min(B.assaultSuccessCap, c) - (campStrength - 1) * B.assaultStrengthPenaltyMult;
  return c;
}
const TRIALS = 400;
for (const [squadSize, campStrength] of [[1, 1], [2, 2], [3, 1]]) {
  const empirical = measureAssaultWinRate('assault', squadSize, campStrength, TRIALS);
  const theoretical = theoreticalAssaultChance('assault', squadSize, campStrength);
  const delta = Math.abs(empirical - theoretical);
  console.log(`  assaut squad=${squadSize} campStrength=${campStrength}: théorique≈${pct(theoretical)}, empirique(${TRIALS} essais)=${pct(empirical)} (Δ${pct(delta)})`);
  assert(delta < 0.10, `assaultCamp('assault') squad=${squadSize}/strength=${campStrength}: taux empirique (${pct(empirical)}) s'écarte de plus de 10 points de la formule interne (${pct(theoretical)}) — résolution RNG suspecte`);
}

// ============================================================
// V1.16.0 — engageCatcher(): mesure empirique du taux de MORT PERMANENTE d'un porteur sur un échec,
// avant/après le recalibrage catcherDeathChanceBase (0.30 -> 0.15), pour vérifier que le nouveau
// coefficient produit bien le taux voulu via la résolution RNG réelle (resolveCatcherEncounter).
// ============================================================
console.log('\n--- Taux de mort permanente (Catcher BT, en cas d\'échec) — empirique vs formule interne ---');
function measureCatcherDeathRate(squadSize, campStrength, bloodBags, trials) {
  RNG.setSeed(920001);
  newGame(false);
  let deaths = 0, porterDeathOpportunities = 0;
  for (let i = 0; i < trials; i++) {
    game.porters = [];
    for (let j = 0; j < squadSize; j++) { hireRaw('scout'); const p = game.porters[game.porters.length - 1]; p.health = 100; p.gearWear = 0; }
    game.materials.blood_grenades = squadSize * BALANCE.combat.catcherGrenadesPerPorter;
    game.materials.blood_bags = bloodBags;
    const catcherId = `sim-catcher-${i}`;
    game.catchers = [{ id: catcherId, x: 1, y: 1, strength: campStrength }];
    game.mapsData[game.currentMap].catchers = game.catchers;
    engageCatcher(catcherId);
    const anyDied = game.porters.some(p => p.status === 'dead');
    const anySucceeded = !game.mapsData[game.currentMap].catchers.find(c => c.id === catcherId); // retiré de la liste = résolu (succès ou échec, cf. CombatEngine.js)
    if (anySucceeded) { porterDeathOpportunities++; if (anyDied) deaths++; }
  }
  return porterDeathOpportunities > 0 ? deaths / porterDeathOpportunities : 0;
}
const catcherDeathRate = measureCatcherDeathRate(2, 1, 0, 500);
console.log(`  squad=2 campStrength=1 sans poche de sang: au moins 1 mort dans l'escouade sur ${pct(catcherDeathRate)} des rencontres résolues (base configurée: ${pct(BALANCE.combat.catcherDeathChanceBase)}/porteur avant modificateurs)`);
assert(catcherDeathRate < 0.60, `engageCatcher(): taux de mort d'escouade (${pct(catcherDeathRate)}) anormalement élevé même après le recalibrage catcherDeathChanceBase 0.30->0.15 — vérifier resolveCatcherEncounter()`);

// ============================================================
// V1.16.0 — coût de véhicule (maintenance x2.5): vérifie que l'archétype "optimiseur" (qui achète un
// vélo au jour 30, cf. ARCHETYPES.optimiseur.dailyAction) reste solvable — pas une simple relecture des
// résultats déjà agrégés plus haut, une assertion DÉDIÉE pour que l'intention soit explicite.
// ============================================================
const optResults = results.optimiseur;
assert(optResults.every(r => r.finalMoney >= 0), 'archétype "optimiseur" (achète un véhicule au jour 30): argent négatif détecté — la maintenance x2.5 le rend insoutenable');
console.log(`\n--- Coût véhicule x2.5: archétype "optimiseur" (achète un vélo au jour 30) reste solvable: argent final moyen=$${Math.round(optResults.reduce((s, r) => s + r.finalMoney, 0) / optResults.length)} ---`);

// ============================================================
// V1.16.0 — "impossibilité d'atteindre 30M$ au mois 20": horizon étendu (600 jours ≈ mois 20,
// DAYS_PER_MONTH=30) avec l'archétype le PLUS actif économiquement ("optimiseur": automatisation
// complète, hire régulier, assauts MULE hebdomadaires, véhicule) — le scénario le plus favorable à une
// éventuelle inflation. Un plafond à 30M$ n'a de sens que comparé à un résultat RÉEL très en-dessous:
// vérifié une fois, imprimé pour que toute dérive future de data/Balance.js reste visible ici plutôt
// que découverte des mois plus tard par un joueur.
console.log('\n--- Plafond économique long-terme (mois 20, archétype "optimiseur") ---');
const MONTH20_DAYS = 600;
const longRun = runArchetype('optimiseur', 500001, MONTH20_DAYS);
console.log(`  jour ${MONTH20_DAYS} (mois ~${Math.floor(MONTH20_DAYS / 30)}): argent=$${longRun.finalMoney.toLocaleString('fr-FR')}`);
assert(longRun.finalMoney < 30000000, `archétype "optimiseur" atteint $${longRun.finalMoney} au jour ${MONTH20_DAYS} — dépasse le plafond de 30M$ demandé, data/Balance.js a besoin d'un recalibrage supplémentaire`);
assert(longRun.finalMoney < 5000000, `archétype "optimiseur" atteint $${longRun.finalMoney} au jour ${MONTH20_DAYS} — largement sous 30M$ mais déjà un ordre de grandeur suspect pour ce stade de partie (GAME_LENGTH_MONTHS=60)`);

console.log('\n=== RÉSUMÉ ===');
if (FAIL.length === 0) {
  console.log(`✅ Simulation d'équilibrage PASSED — ${DAYS} jours x ${SEEDS.length} graines x ${Object.keys(ARCHETYPES).length} archétypes, aucune anomalie détectée.`);
} else {
  console.log(`❌ Simulation d'équilibrage FAILED — ${FAIL.length} anomalie(s):`);
  FAIL.forEach(m => console.log(`   - ${m}`));
  process.exitCode = 1;
}
