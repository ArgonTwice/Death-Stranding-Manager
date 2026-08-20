// tests/resilience/SaveManagerLayering.test.js — suite V1.20.0: verrouille le retrait d'un import
// mort (`import { render } from '../ui/HUD.js'`, jamais réellement appelé — le pattern établi passe
// déjà par eventBus.emit('render:request')) qui créait une dépendance circulaire réelle
// persistence/SaveManager.js <-> ui/HUD.js (HUD.js importe `computeScore` en retour depuis
// SaveManager.js). La suppression a fait passer `npx madge --circular` de 39 à 24 cycles détectés
// sans toucher à aucun comportement (render() n'était jamais appelé via cet import). Ne verrouille
// QUE cette dépendance précise, pas tout import ui/* — SaveManager.js importe légitimement
// ui/ModalService.js (confirmModal, pour newGame()) et ui/HUD.js n'importe rien de ce module en
// retour, donc ce n'est pas une dépendance circulaire. Test statique (lecture du fichier source, pas
// d'exécution) pour empêcher toute régression future de cette dépendance précise.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, assert, summary } from './_stubEnv.mjs';

const saveManagerPath = fileURLToPath(new URL('../../src/persistence/SaveManager.js', import.meta.url));
const source = readFileSync(saveManagerPath, 'utf8');

await test("persistence/SaveManager.js never imports from ui/HUD.js (recréerait le cycle SaveManager<->HUD éliminé en V1.20.0)", async () => {
  const hudImportLines = source.split('\n').filter(l => /^\s*import\b.*from\s+['"]\.\.\/ui\/HUD\.js['"]/.test(l));
  assert(hudImportLines.length === 0, `persistence/SaveManager.js importe depuis ui/HUD.js, ce qui recrée le cycle éliminé en V1.20.0: ${JSON.stringify(hudImportLines)}`);
});

summary('SaveManagerLayering.test.js');
