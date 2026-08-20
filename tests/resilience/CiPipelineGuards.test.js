// tests/resilience/CiPipelineGuards.test.js — suite V1.24.0: verrouille que le workflow GitHub Actions
// (.github/workflows/deploy.yml) exécute bien la suite de résilience, le check de déterminisme strict
// et la vérification du snapshot doré AVANT `npm run build` — jusqu'ici le pipeline CI ne faisait QUE
// builder (`npm run build`), sans aucun garde-fou automatisé, malgré ce protocole déjà suivi
// manuellement à chaque mission. Test statique (lecture du fichier YAML, pas d'exécution — aucun
// interpréteur YAML nécessaire, une recherche d'ordre de sous-chaînes suffit) pour empêcher toute
// régression future qui retirerait ces étapes. Même style zéro-dépendance que le reste de
// tests/resilience/ (_stubEnv.mjs), auto-découvert par runAll.mjs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, assert, summary } from './_stubEnv.mjs';

const workflowPath = fileURLToPath(new URL('../../.github/workflows/deploy.yml', import.meta.url));
const source = readFileSync(workflowPath, 'utf8');

await test('deploy.yml runs the resilience test suite (npm test) before npm run build', async () => {
  assert(source.includes('npm test'), 'deploy.yml must run `npm test` (tests/resilience/runAll.mjs) as a CI gate');
  assert(source.indexOf('npm test') < source.indexOf('npm run build'), '`npm test` must run BEFORE `npm run build`, otherwise a failing suite would not block deployment');
});

await test('deploy.yml runs the strict determinism check before npm run build', async () => {
  assert(source.includes('tests/determinism-check.mjs'), 'deploy.yml must run tests/determinism-check.mjs as a CI gate');
  assert(source.indexOf('tests/determinism-check.mjs') < source.indexOf('npm run build'), 'determinism-check.mjs must run BEFORE `npm run build`, otherwise a determinism regression would not block deployment');
});

await test('deploy.yml runs the golden snapshot verification before npm run build', async () => {
  assert(source.includes('npm run snapshot:verify'), 'deploy.yml must run `npm run snapshot:verify` as a CI gate');
  assert(source.indexOf('npm run snapshot:verify') < source.indexOf('npm run build'), 'snapshot:verify must run BEFORE `npm run build`, otherwise a save/load regression would not block deployment');
});

await test('deploy.yml still installs dependencies (npm ci) before any of the above', async () => {
  assert(source.includes('npm ci'), 'sanity: deploy.yml must still install dependencies via npm ci');
  assert(source.indexOf('npm ci') < source.indexOf('npm test'), 'npm ci must run before npm test (dependencies must be installed first)');
});

summary('CiPipelineGuards.test.js');
