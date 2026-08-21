// ui/UIShell.js (V0.7.0) — point de composition de la structure UI: initialise la pile de navigation
// (NavigationManager.js), enregistre chaque tiroir tactile auprès de DrawerManager.js (poignée
// glissable, backdrop commun) et câble le fond assombri. Appelé une seule fois au boot (main.js).
//
// Indépendance totale vis-à-vis du GameState (V0.7.0 règle 1): ce module ne fait que de la
// plomberie DOM/navigation, jamais d'accès à game.*/RNG.js/tick.
import { initNavigation } from '../core/NavigationManager.js';
import { closeAllOpenDrawers, registerDrawer } from './DrawerManager.js';
import { closeConvoyPanel } from './ConvoyPanel.js';
import { closeHallOfFamePanel } from './HallOfFamePanel.js';
import { closeNetworkDrawer, closePortersDrawer, closeTelemetryDrawer } from './HUD.js';
import { closePorterDrawer } from './PorterDrawer.js';
import { closeQuestPanel } from './QuestPanel.js';
import { closeTerminalConsole } from './TerminalConsole.js';
import { closeWalkDrawer } from './WalkDrawer.js';
import { closeRaidTrackingDrawer } from './RaidTrackingDrawer.js';
import { closeBuildActionDrawer } from './BuildActionDrawer.js';

// V1.32.0 — 3e champ (elevatesBackdrop): SEULS Télémétrie/Terminal/Hall of Fame ont besoin que le
// fond assombri partagé (#drawerBackdrop) passe au-dessus de leur propre z-index standard — cf.
// commentaire détaillé sur DrawerManager.js#updateBackdrop pour le mécanisme et le bug que ça corrige.
const BOTTOM_SHEET_DRAWERS = [
      ['questDrawer', closeQuestPanel],
      ['convoyDrawer', closeConvoyPanel],
      ['porterDrawer', closePorterDrawer],
      ['hallOfFameDrawer', closeHallOfFamePanel, true],
      ['terminalDrawer', closeTerminalConsole, true],
      ['telemetryDrawer', closeTelemetryDrawer, true],
      ['portersDrawer', closePortersDrawer],
      ['networkDrawer', closeNetworkDrawer],
      ['walkDrawer', closeWalkDrawer],
      ['raidTrackingDrawer', closeRaidTrackingDrawer],
      ['buildActionDrawer', closeBuildActionDrawer]
    ];

// V1.29.0 — bug réel trouvé en jouant une vraie partie (audit libre, pas de brief): responsive.css
// (>=768px, chargé après layout.css) remet body.padding-bottom à 0 pour recentrer #app-shell, mais
// aucune règle ne restaure ensuite une réserve pour .mtab-bar (position:fixed, bottom:0) — sur TOUT
// écran >=768px de large (donc la quasi-totalité du desktop/tablette), le bas de .map-container
// (donc .map-action-bar, poussé tout en bas via margin-top:auto) se retrouve physiquement recouvert
// par la barre d'onglets fixe, sans le moindre débordement détectable (.map-container elle-même
// n'overflow jamais, donc jamais de scrollbar pour compenser) — Quêtes/Convois/Porteurs/Statut/
// Porteur IRL/Raid Tactique totalement inatteignables. Plutôt que redevine une valeur fixe (58/70/80px
// selon les endroits, déjà en dérive avec la vraie hauteur rendue de .mtab-bar depuis que
// min-height:44px/icône+libellé ont été calibrés, V1.11.0+), même pattern déjà établi pour
// --tutorial-h (ui/TutorialOverlay.js): mesurer la hauteur RÉELLE via ResizeObserver, jamais un
// nombre magique à resynchroniser manuellement à chaque futur changement de style de .mtab-bar.
function ensureMtabBarHeightVar() {
      if (typeof document === 'undefined') return;
      const el = document.querySelector('.mtab-bar');
      const root = document.documentElement;
      if (!el || !root || !root.style || typeof root.style.setProperty !== 'function') return;
      const update = () => root.style.setProperty('--mtabbar-h', el.offsetHeight + 'px');
      update();
      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(update).observe(el);
      }
    }

export function initUIShell() {
      initNavigation();
      for (const [id, onCloseRequest, elevatesBackdrop] of BOTTOM_SHEET_DRAWERS) {
        registerDrawer(id, { onCloseRequest, elevatesBackdrop });
      }
      ensureMtabBarHeightVar();
    }

// Pont UI pour le tapotement du fond assombri commun (#drawerBackdrop) — ferme tout tiroir ouvert
// via son propre chemin de fermeture (donc via NavigationManager), jamais de fermeture DOM directe.
export function closeAllDrawersUI() {
      closeAllOpenDrawers();
    }
