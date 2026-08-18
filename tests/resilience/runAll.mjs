// tests/resilience/runAll.mjs — exécute chaque *.test.js de resilience/ dans son PROPRE processus
// Node (comme tests/determinism-check.mjs le fait déjà pour run-once.mjs): garantit une isolation
// totale entre fichiers de test malgré les singletons game/runtime partagés en interne à chaque
// module — zéro fuite d'état possible d'un fichier à l'autre. Invoqué par `npm run test`.
import { execFileSync } from 'child_process';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .sort();

console.log(`Running ${files.length} resilience test files...\n`);

let allOk = true;
const timings = [];

for (const file of files) {
  const full = path.join(__dirname, file);
  const start = Date.now();
  console.log(`\n=== ${file} ===`);
  try {
    const out = execFileSync('node', [full], { encoding: 'utf8', stdio: 'pipe' });
    process.stdout.write(out);
  } catch (e) {
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    allOk = false;
  }
  timings.push({ file, ms: Date.now() - start });
}

console.log('\n\n=== Timings ===');
for (const t of timings) console.log(`  ${t.file}: ${t.ms}ms`);

console.log(allOk ? '\n✅ ALL RESILIENCE TESTS PASSED' : '\n❌ SOME RESILIENCE TESTS FAILED');
process.exit(allOk ? 0 : 1);
