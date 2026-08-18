// Helper for determinism-check.mjs: runs ONE deterministic simulation in an isolated process and
// prints the resulting state as JSON on stdout. Kept as a separate process (not just a function)
// so each run gets a truly fresh module graph — no cross-run state leakage to worry about.
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function makeClassList() {
  const set = new Set();
  return { add(...c) { c.forEach(x => set.add(x)); }, remove(...c) { c.forEach(x => set.delete(x)); }, toggle() {}, contains(c) { return set.has(c); } };
}
const fakeCtx = new Proxy({}, {
  get(t, p) { if (p in t) return t[p]; return () => fakeCtx; },
  set(t, p, v) { t[p] = v; return true; }
});
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
const SEED = parseInt(process.argv[2] || '777001', 10);
const DAYS = parseInt(process.argv[3] || '50', 10);
const INJECT_STEPS = parseInt(process.argv[4] || '0', 10); // V0.8.0 — total de pas simulés répartis sur DAYS jours
const LAUNCH_RAID = process.argv[5] === '1'; // V0.9.0 — lance un Raid Tactique avant l'injection de pas ci-dessus

const { game } = await import(SRC + 'core/GameState.js');
const { RNG } = await import(SRC + 'core/RNG.js');
const { newGame } = await import(SRC + 'persistence/SaveManager.js');
const { advanceDay } = await import(SRC + 'engine/DeliveryEngine.js');
const { hireRaw } = await import(SRC + 'systems/PorterSystem.js');
const { createMockMotionAdapter } = await import(SRC + 'sensors/MockMotionAdapter.js');
const { recordSteps } = await import(SRC + 'systems/RealWalkSystem.js');
const { launchRaid } = await import(SRC + 'systems/raid/RaidSystem.js'); // l'import seul enregistre déjà l'abonnement walk:stepDetected (effet de bord au chargement)

RNG.setSeed(SEED);
newGame(false);
game.money = 20000;
['scout', 'hauler', 'driver', 'dooms'].forEach(s => hireRaw(s));

// V0.9.0 — fixture de test: construit directement une couverture réseau suffisante (au lieu de
// jouer buildRoute() plusieurs fois) pour déverrouiller mexico_south, puis lance le raid AVANT
// l'injection de pas ci-dessous — les mêmes pas alimentent alors RealWalkSystem ET RaidSystem,
// exactement comme en jeu réel (RaidSystem n'est qu'un observateur de walk:stepDetected).
if (LAUNCH_RAID) {
  for (let i = 0; i < 10; i++) game.mapsData.mexico.routes.add(`${i},0`);
  launchRaid('mexico_south', game.porters[0].id);
}

// V0.8.0 — passe systématiquement par le pipeline MockMotionAdapter -> StepDetector plutôt que
// d'appeler recordSteps() directement: exerce le même chemin de code qu'un vrai capteur (règle 1),
// avec des timestamps synthétiques (jamais Date.now()) donc instantané et 100% reproductible.
const mockAdapter = createMockMotionAdapter({ onStep: (n) => recordSteps(n) });
const stepsPerDay = DAYS > 0 ? Math.floor(INJECT_STEPS / DAYS) : 0;
let stepsInjected = 0;

for (let i = 0; i < DAYS; i++) {
  if (stepsPerDay > 0) stepsInjected += mockAdapter.simulateSteps(stepsPerDay);
  advanceDay();
}
// reliquat de la division (ex: 10000/100 tombe juste, mais reste générique pour tout DAYS/INJECT_STEPS)
const remainder = INJECT_STEPS - stepsInjected;
if (remainder > 0) mockAdapter.simulateSteps(remainder);

const d = game.mapsData[game.currentMap];
const result = {
  seed: RNG.getSeed(),
  money: game.money,
  month: game.month,
  dayInMonth: game.dayInMonth,
  reputation: game.reputation,
  completed: game.completed,
  deaths: game.deaths,
  materials: game.materials,
  porters: game.porters.map(p => ({ name: p.name, health: p.health, stress: p.stress, level: p.level, xp: p.xp, status: p.status })),
  mainKnots: (d.mainKnots || []).map(k => ({ name: k.name, archetype: k.archetype, relation: k.relation, needs: k.needs })),
  routeCount: game.routes.size,
  logTail: game.log.slice(0, 5).map(e => e.text),
  // V0.3.0 — couvre explicitement le déterminisme des nouveaux systèmes (météo/quêtes/loyauté)
  loyalty: game.loyalty,
  urgentQuestsActive: (game.urgentQuests || []).length,
  urgentQuestHistoryCount: (game.urgentQuestHistory || []).length,
  currentWeather: (d.weather && d.weather.type) || 'calm',
  forecast: d.forecast || [],
  // V0.4.0 — couvre le déterminisme des convois/télémétrie (auto-dispatch peut composer des convois via RNG)
  telemetry: game.telemetry || null,
  convoysActive: (game.convoys || []).length,
  // V0.5.0 — couvre le déterminisme de l'identité procédurale (porterSeed) et du journal de bord
  porterIdentities: game.porters.map(p => ({ porterSeed: p.porterSeed, background: p.background, phobia: p.phobia, joy: p.joy, doomsLevel: p.doomsLevel, journalCount: (p.journal || []).length, acquiredTraitIds: p.acquiredTraitIds || [] })),
  // V0.8.0 — couvre le déterminisme de la conversion pas IRL -> ressources (RealWalkSystem.js)
  totalSteps: game.totalSteps || 0,
  bbPodStress: (game.bbPod && game.bbPod.stress) || 0,
  gratitudeTrace: game.gratitudeTrace || 0,
  chiralCrystal: (game.materials && game.materials.chiral_crystal) || 0,
  // V0.9.0 — couvre le déterminisme du pipeline de Raid Tactique (raidSeed dérivé, événements aux
  // checkpoints, récompense finale)
  activeRaid: game.activeRaid ? { status: game.activeRaid.status, traveledSteps: game.activeRaid.traveledSteps, targetDistanceSteps: game.activeRaid.targetDistanceSteps, cargoState: game.activeRaid.cargoState, events: game.activeRaid.events, rank: game.activeRaid.rank || null } : null,
  raidHistory: game.raidHistory || []
};

process.stdout.write(JSON.stringify(result));
