// npm run snapshot:verify — loads tests/snapshots/golden-save-v4.json through the real save/load
// pipeline and asserts no critical state (resources, prepper relations, network routes, porter
// stats...) got corrupted or dropped. Catches regressions in deserializeGame()/migration logic
// without needing to re-run a full (and RNG-seed-fragile) simulation.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// --- Minimal DOM/browser stubs (same shape as the dev simulation harness) ---
function makeClassList() {
  const set = new Set();
  return {
    add(...c) { c.forEach(x => set.add(x)); },
    remove(...c) { c.forEach(x => set.delete(x)); },
    toggle() {},
    contains(c) { return set.has(c); }
  };
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

const { game } = await import(SRC + 'core/GameState.js');
const { deserializeGame } = await import(SRC + 'persistence/SaveManager.js');
const { SKILLS, TRAITS, PREPPER_ARCHETYPES, GRADES } = await import(SRC + 'data/Constants.js');
const { STRUCTURES } = await import(SRC + 'data/Constants.js');

const SNAPSHOT_PATH = path.join(ROOT, 'tests', 'snapshots', 'golden-save-v4.json');

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

function main() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error('❌ Golden snapshot not found:', SNAPSHOT_PATH);
    process.exit(1);
  }
  const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (e) {
    console.error('❌ Golden snapshot is not valid JSON:', e.message);
    process.exit(1);
  }

  try {
    deserializeGame(saved);
  } catch (e) {
    console.error('❌ deserializeGame() threw while loading the golden snapshot:', e.stack || e);
    process.exit(1);
  }

  // --- 1) Round-trip fidelity: top-level scalars must match exactly what was saved ---
  check(game.money === saved.money, `money mismatch: loaded ${game.money}, expected ${saved.money}`);
  check(game.month === saved.month, `month mismatch: loaded ${game.month}, expected ${saved.month}`);
  check(game.reputation === saved.reputation, `reputation mismatch: loaded ${game.reputation}, expected ${saved.reputation}`);
  check(game.completed === saved.completed, `completed mismatch: loaded ${game.completed}, expected ${saved.completed}`);
  check(game.deaths === saved.deaths, `deaths mismatch: loaded ${game.deaths}, expected ${saved.deaths}`);
  check(game.porters.length === saved.porters.length, `porter count mismatch: loaded ${game.porters.length}, expected ${saved.porters.length}`);

  // --- 2) Resources: never negative, never NaN ---
  for (const [mat, qty] of Object.entries(game.materials || {})) {
    check(Number.isFinite(qty) && qty >= 0, `material "${mat}" is corrupted: ${qty}`);
  }
  check(Number.isFinite(game.money) && game.money >= 0, `money is corrupted: ${game.money}`);
  check(Number.isInteger(game.month) && game.month > 0, `month is corrupted: ${game.month}`);
  check(game.reputation >= 0 && game.reputation <= 100, `reputation out of bounds: ${game.reputation}`);

  // --- 3) Porters: every stat within valid bounds, referencing real content ---
  for (const p of game.porters) {
    check(SKILLS[p.skill] != null, `porter "${p.name}" has unknown skill "${p.skill}"`);
    check(TRAITS[p.trait] != null, `porter "${p.name}" has unknown trait "${p.trait}"`);
    check(p.health >= 0 && p.health <= 100, `porter "${p.name}" health out of bounds: ${p.health}`);
    check(p.stress >= 0 && p.stress <= 100, `porter "${p.name}" stress out of bounds: ${p.stress}`);
    check((p.gearWear || 0) >= 0 && (p.gearWear || 0) <= 100, `porter "${p.name}" gearWear out of bounds: ${p.gearWear}`);
    check(p.grades && Object.keys(GRADES).every(g => Number.isFinite(p.grades[g])), `porter "${p.name}" grades corrupted: ${JSON.stringify(p.grades)}`);
    check(p.salary > 0, `porter "${p.name}" has invalid salary: ${p.salary}`);
  }

  // --- 4) Network routes: reconstructed as a real Set, all cells well-formed "x,y" keys ---
  check(game.routes instanceof Set, 'game.routes was not reconstructed as a Set after load');
  for (const cellKey of game.routes) {
    const parts = cellKey.split(',').map(Number);
    check(parts.length === 2 && parts.every(Number.isFinite), `corrupted route cell key: "${cellKey}"`);
  }

  // --- 5) Preppers (mainKnots): archetype/relation/needs/contracts all well-formed ---
  let prepperCount = 0;
  for (const mapKey in game.mapsData) {
    const d = game.mapsData[mapKey];
    for (const k of (d.mainKnots || [])) {
      prepperCount++;
      check(PREPPER_ARCHETYPES[k.archetype] != null, `prepper "${k.name}" has unknown archetype "${k.archetype}"`);
      check(k.relation >= 0 && k.relation <= 100, `prepper "${k.name}" relation out of bounds: ${k.relation}`);
      check(k.needs && ['medical', 'food', 'tech'].every(n => k.needs[n] >= 0 && k.needs[n] <= 100), `prepper "${k.name}" needs out of bounds: ${JSON.stringify(k.needs)}`);
      check(Array.isArray(k.contracts), `prepper "${k.name}" contracts is not an array`);
    }
  }
  check(prepperCount > 0, 'no preppers (mainKnots) found in the golden snapshot — fixture may be stale');

  // --- 6) Structures: levels never exceed their defined maxLevel ---
  for (const [type, level] of Object.entries(game.structures || {})) {
    const def = STRUCTURES[type];
    check(def != null, `unknown structure type in save: "${type}"`);
    if (def) check(level >= 0 && level <= def.maxLevel, `structure "${type}" level out of bounds: ${level}/${def.maxLevel}`);
  }

  // --- 7) Automation state present with sane shape (added post-v2, must survive load) ---
  check(game.automation && typeof game.automation === 'object', 'game.automation missing after load');
  if (game.automation) {
    check(typeof game.automation.autoRestThreshold === 'number', 'automation.autoRestThreshold missing/invalid');
    check(typeof game.automation.autoRepairThreshold === 'number', 'automation.autoRepairThreshold missing/invalid');
  }

  if (failures.length) {
    console.error(`❌ snapshot:verify FAILED — ${failures.length} issue(s):\n`);
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }

  console.log('✅ snapshot:verify passed —', game.porters.length, 'porters,', prepperCount, 'preppers,', game.routes.size, 'route cells, month', game.month, ', $' + game.money);
}

main();
