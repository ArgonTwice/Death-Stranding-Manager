// tests/resilience/AppMainStackingContextTrap.test.js — V1.33.0: bug réel trouvé en jouant une vraie
// partie (audit libre, pas de brief), confirmé empiriquement via document.elementFromPoint/
// elementsFromPoint en navigateur réel (Playwright jetable, cf. commit).
//
// #app-main (css/style.css) portait `position: relative; z-index: 1;` depuis le tout premier commit
// qui a introduit la hiérarchie de z-index globale documentée du projet ("Canvas: 1 · Header: 10 ·
// Boutons: 20 · Drawers: 100 · Modales/Overlays: 200", V0.7.0) — cette valeur visait à représenter le
// tier "Canvas" de cette hiérarchie. Mais poser un z-index NON-auto sur un élément POSITIONNÉ crée un
// NOUVEAU CONTEXTE D'EMPILEMENT CSS: tous les descendants d'#app-main (dont TOUS les .ds-drawer
// z-index:100 et TOUTES les modales .left z-index:200 — ce sont tous des enfants d'#app-main) se
// retrouvent PLAFONNÉS à ce tier "1" quand on les compare à des éléments EXTÉRIEURS à #app-main —
// notamment .mtab-bar (z-index:20, frère d'#app-main, hors de son sous-arbre). Résultat: N'IMPORTE
// QUEL contenu de tiroir/modale qui chevauche géométriquement la zone de .mtab-bar perd TOUJOURS le
// clic face à elle, quel que soit son propre z-index nominal (100 ou 200) — la hiérarchie documentée
// ne s'applique QUE localement entre descendants d'#app-main, jamais contre .mtab-bar/#app-header qui
// vivent hors de ce sous-arbre. Repéré concrètement sur le bouton "Tableau de contrats" du tiroir Raid
// Tactique en mode 'peek' (chevauche .mtab-bar à 1280x720) — confirmé qu'une MODALE (z-index 200,
// #beachModal) chevauchant artificiellement .mtab-bar souffrait du MÊME piège, malgré son z-index 2x
// plus élevé que celui du tiroir: la preuve que c'est bien le contexte d'empilement d'#app-main qui
// plafonne tout, pas une question de magnitude de z-index.
//
// Fix: retrait du `z-index: 1` sur #app-main (position:relative conservé, toujours nécessaire comme
// ancre de positionnement pour d'éventuels descendants absolus) — sans stacking-context local, les
// descendants d'#app-main comparent enfin leur PROPRE z-index directement contre .mtab-bar/
// #app-header, exactement comme le documente la hiérarchie globale du projet depuis toujours.
//
// Test statique (lecture de fichier — aucun moteur de rendu CSS/navigateur nécessaire, zéro
// dépendance comme le reste de tests/resilience/): verrouille qu'aucune règle CSS ne repose de
// z-index NON-auto sur #app-main, qui recréerait ce piège silencieusement. La preuve empirique du
// mécanisme réel (clic bloqué avant fix / débloqué après) a été faite en navigateur réel via
// Playwright jetable (cf. message de commit) — non reproductible ici sans moteur de rendu CSS.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, assert, summary } from './_stubEnv.mjs';

const cssPath = fileURLToPath(new URL('../../css/style.css', import.meta.url));
const source = readFileSync(cssPath, 'utf8');

await test('#app-main must never carry a non-auto z-index (would trap all drawers/modals inside a capped stacking context, cf. commit for the real bug this caused)', () => {
  const ruleMatch = source.match(/#app-main\s*\{([^}]*)\}/);
  assert(ruleMatch, 'sanity: #app-main rule must exist in css/style.css');
  const body = ruleMatch[1];
  assert(!/z-index\s*:/.test(body), '#app-main must not set z-index at all — doing so creates a new stacking context that caps every descendant (.ds-drawer z-index:100, .left modals z-index:200) below any SIBLING of #app-main with a higher z-index (e.g. .mtab-bar at z-index:20), regardless of the descendant\'s own nominal z-index');
});

summary('AppMainStackingContextTrap.test.js');
