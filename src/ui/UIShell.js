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

const BOTTOM_SHEET_DRAWERS = [
      ['questDrawer', closeQuestPanel],
      ['convoyDrawer', closeConvoyPanel],
      ['porterDrawer', closePorterDrawer],
      ['hallOfFameDrawer', closeHallOfFamePanel],
      ['terminalDrawer', closeTerminalConsole],
      ['telemetryDrawer', closeTelemetryDrawer],
      ['portersDrawer', closePortersDrawer],
      ['networkDrawer', closeNetworkDrawer]
    ];

export function initUIShell() {
      initNavigation();
      for (const [id, onCloseRequest] of BOTTOM_SHEET_DRAWERS) {
        registerDrawer(id, { onCloseRequest });
      }
    }

// Pont UI pour le tapotement du fond assombri commun (#drawerBackdrop) — ferme tout tiroir ouvert
// via son propre chemin de fermeture (donc via NavigationManager), jamais de fermeture DOM directe.
export function closeAllDrawersUI() {
      closeAllOpenDrawers();
    }
