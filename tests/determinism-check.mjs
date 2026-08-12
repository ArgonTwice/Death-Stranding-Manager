// Runs the exact same N-day simulation twice (fresh process each time) from the same fixed RNG
// seed and asserts the two runs produce byte-for-byte identical outcomes — the core guarantee
// behind core/RNG.js, and a smoke test that the Balance.js extraction didn't change behavior.
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUN_ONCE = path.join(__dirname, 'run-once.mjs');

const SEED = process.argv[2] || '777001';
const DAYS = process.argv[3] || '50';

function runOnce() {
  const out = execFileSync('node', [RUN_ONCE, SEED, DAYS], { encoding: 'utf8' });
  return JSON.parse(out);
}

const run1 = runOnce();
const run2 = runOnce();

const s1 = JSON.stringify(run1);
const s2 = JSON.stringify(run2);

if (s1 !== s2) {
  console.error('❌ DETERMINISM CHECK FAILED — same seed produced different outcomes across two runs.');
  console.error('Run 1:', s1);
  console.error('Run 2:', s2);
  process.exit(1);
}

console.log(`✅ Determinism check passed — ${DAYS} simulated days, seed ${SEED}, two independent processes produced identical state.`);
console.log(`   money=$${run1.money} month=${run1.month} reputation=${run1.reputation} completed=${run1.completed} deaths=${run1.deaths} routes=${run1.routeCount}`);
console.log(`   porters: ${run1.porters.map(p => `${p.name}(Lv${p.level}, ${p.status})`).join(', ')}`);
console.log(`   preppers: ${run1.mainKnots.map(k => `${k.name}[${k.archetype}]=${k.relation}`).join(', ')}`);
