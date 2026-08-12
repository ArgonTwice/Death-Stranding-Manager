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

const { game } = await import(SRC + 'core/GameState.js');
const { RNG } = await import(SRC + 'core/RNG.js');
const { newGame } = await import(SRC + 'persistence/SaveManager.js');
const { advanceDay } = await import(SRC + 'engine/DeliveryEngine.js');
const { hireRaw } = await import(SRC + 'systems/PorterSystem.js');

RNG.setSeed(SEED);
newGame(false);
game.money = 20000;
['scout', 'hauler', 'driver', 'dooms'].forEach(s => hireRaw(s));

for (let i = 0; i < DAYS; i++) advanceDay();

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
  porterIdentities: game.porters.map(p => ({ porterSeed: p.porterSeed, background: p.background, phobia: p.phobia, joy: p.joy, doomsLevel: p.doomsLevel, journalCount: (p.journal || []).length, acquiredTraitIds: p.acquiredTraitIds || [] }))
};

process.stdout.write(JSON.stringify(result));
