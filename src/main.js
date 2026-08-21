// AUTO-EXTRACTED MODULE: main.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).
// Composition root: seul fichier autorisé à tout importer (audio, ui, engine, systems, persistence)
// pour câbler l'application ; les autres couches ne se voient jamais entre elles hors de leur tier.

import { setMusicVolume, toggleMusic } from './audio/SoundEngine.js';
import { eventBus } from './core/EventBus.js';
import { setGameSpeed, setTickFn, startGameClock, togglePause } from './core/GameLoop.js';
import { game, logEvent, runtime } from './core/GameState.js';
import { GAME_LENGTH_MONTHS } from './data/Balance.js';
import { SPLASH_TICKER_LINES } from './data/Constants.js';
import { assaultCamp, buyConsumable, convertCampToRelay, defendRelay, engageCatcher, fortifyRelay, reconCatcher, sendToIncinerator } from './engine/CombatEngine.js';
import { acceptVisitorOffer, advanceDay, buildRoute, craft, dismissVisitor, launchQuestFromUI, sendDelivery } from './engine/DeliveryEngine.js';
import { buildExpansion, foundBranch, setActiveBranch, switchMap } from './engine/MapEngine.js';
import { computeScore, loadGame, loadScores, newGame, peekSlot, saveGame, startNewGamePlus } from './persistence/SaveManager.js';
import { confirmModal } from './ui/ModalService.js';
import { setAutomationThreshold, toggleAutomation } from './systems/AutomationManager.js';
import { buildStructure, buyEquip, buyVehicle, investInfrastructure, signSponsor } from './systems/EconomySystem.js';
import { cancelPlacingPCC, canvasClickToCell, placePCCAt, repairPCC, startPlacingPCC } from './systems/NetworkSystem.js';
import { beachJump, dismissCandidate, forceRest, hire, repairGear, retirePorter, scoutCandidate } from './systems/PorterSystem.js';
import { recruitRobotBuddy } from './systems/RobotBuddySystem.js';
import { assignPrepperContract, connectKnot, negotiatePrepperContract } from './systems/PrepperSystem.js';
import { negotiateUrgentQuest, refuseUrgentQuest } from './systems/QuestSystem.js';
import { closeInspector, inspectMapCell } from './ui/CanvasInspector.js';
import { dismissBBPodAlert, respondToBBPodAlertUI } from './ui/BBPodOverlay.js';
import { resolveBeachChoiceUI } from './ui/BeachPanel.js';
import { closeConvoyPanel, launchConvoyFromUI, renderConvoyEscortList, toggleConvoyPanel, updateConvoyPreview } from './ui/ConvoyPanel.js';
import { closeHallOfFamePanel, toggleHallOfFamePanel } from './ui/HallOfFamePanel.js';
import { render, renderPorters, showEndScreen, openTelemetryDrawer, closeTelemetryDrawer, toggleTelemetryDrawer, openPortersDrawer, closePortersDrawer, togglePortersDrawer, openNetworkDrawer, closeNetworkDrawer, toggleNetworkDrawer } from './ui/HUD.js';
import { closeAllDrawersUI, initUIShell } from './ui/UIShell.js';
import { addManualWalkBoostUI, closeWalkDrawer, openWalkDrawer, requestRealWalkActivationUI, stopRealWalkUI, toggleWalkDrawer } from './ui/WalkDrawer.js';
import './systems/raid/RaidSystem.js'; // enregistre l'abonnement walk:stepDetected (effet de bord au chargement du module)
import './systems/expedition/ExpeditionSystem.js'; // enregistre les abonnements raid:completed/raid:abandoned (effet de bord au chargement du module)
import './ui/FeedbackFX.js'; // V1.2.0 — enregistre les abonnements success-glow/star-animate/timefall-alert/neon-pulse (effet de bord au chargement du module)
import './systems/PorterEconomy.js'; // V1.9.0 — enregistre l'abonnement delivery:resolved -> Porter Credits (effet de bord au chargement du module)
import { closeRaidSelectionModal, launchRaidFromUI, openRaidSelectionModal } from './ui/RaidSelectionModal.js';
import { abandonRaidUI, closeRaidTrackingDrawer, openContractBoardModalUI, openLoadoutPanelModalUI, openRaidSelectionModalUI, openRaidTrackingDrawer, toggleRaidTrackingDrawer } from './ui/RaidTrackingDrawer.js';
import { closeContractBoardModal, launchContractFromUI, openContractBoardModal, setContractBoardFilter } from './ui/ContractBoardModal.js';
import { closeLoadoutPanelModal, equipItemFromUI, openLoadoutPanelModal } from './ui/LoadoutPanelModal.js';
import { closeBuildActionDrawer, openBuildActionDrawer, requestFieldBuildUI, toggleBuildActionDrawer } from './ui/BuildActionDrawer.js';
import { drawMap } from './ui/MapRenderer.js';
import { closeMiniMapFullscreen, toggleMiniMapFullscreen } from './ui/MiniMap.js';
import { closeMainNav, closeSubTab, initMainNav, setMainTab, setSubTab } from './ui/NavigationManager.js';
import { renderManagementSubMenu, setManagementSubTab } from './ui/ManagementPanel.js';
import { initOptionsPanel, renderOptionsPanel, setOptionsVolet, setReducedMotion } from './ui/OptionsPanel.js';
import { renderMissionsPanel } from './ui/MissionsPanel.js';
import { initTutorial, skipTutorial } from './ui/TutorialManager.js';
import { toggleTutorialCompact } from './ui/TutorialOverlay.js';
import { initAudioManager } from './audio/AudioManager.js';
import { renderVersionBadge } from './ui/VersionBadge.js';
import { closePorterDrawer, dispatchDeliveryManuallyUI, giftEquipmentToPorterUI, openPorterDrawer, setPorterDrawerTab } from './ui/PorterDrawer.js';
import { dispatchDeliveryPlanningUI, dispatchPioneerUI, updateDeliveryPlanningMarginUI } from './ui/DeliveryPlanningPanel.js';
import { acceptUrgentQuestFromUI, closeQuestPanel, setQuestPanelTab, toggleQuestPanel } from './ui/QuestPanel.js';
import { closeTerminalConsole, sendTerminalCommandUI, sendTerminalInput, toggleTerminalConsole } from './ui/TerminalConsole.js';
import { checkTerminalSlowdown } from './systems/TerminalSoul.js';

// Câble l'horloge générique (core/GameLoop.js) sur la simulation réelle du jeu — GameLoop reste
// agnostique du contenu, seul main.js (composition root) connaît advanceDay().
setTickFn(advanceDay);

let splashTickerIdx = 0;

export function initSplash() {
      const canvas = document.getElementById('splashCanvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        resize();
        window.addEventListener('resize', resize);
        const drops = Array.from({ length: 90 }, () => ({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          speed: 2 + Math.random() * 4, len: 10 + Math.random() * 22
        }));
        function frame() {
          if (!document.getElementById('splashScreen')) return; // stoppe dès le splash retiré
          ctx.fillStyle = 'rgba(5,4,3,0.25)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = 'rgba(180,190,200,0.15)';
          ctx.lineWidth = 1;
          for (const d of drops) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x, d.y + d.len);
            ctx.stroke();
            d.y += d.speed;
            if (d.y > canvas.height) { d.y = -d.len; d.x = Math.random() * canvas.width; }
          }
          requestAnimationFrame(frame);
        }
        frame();
      }
      const tickerEl = document.getElementById('splashTicker');
      if (tickerEl) {
        setInterval(() => {
          splashTickerIdx = (splashTickerIdx + 1) % SPLASH_TICKER_LINES.length;
          tickerEl.style.animation = 'none';
          tickerEl.offsetHeight; // force reflow pour relancer l'animation CSS
          tickerEl.textContent = SPLASH_TICKER_LINES[splashTickerIdx];
          tickerEl.style.animation = 'splash-ticker 4s ease-in-out infinite';
        }, 4000);
      }
    }

export function dismissSplash() {
      const el = document.getElementById('splashScreen');
      if (!el) return;
      el.style.transition = 'opacity 0.8s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 850);
    }

export async function renderSlotMenu() {
      for (const slot of [1, 2]) {
        const info = await peekSlot(slot);
        const el = document.getElementById('slotCard' + slot);
        if (!el) continue;
        const label = slot === 1 ? 'EMPLACEMENT I' : 'EMPLACEMENT II';
        if (!info) {
          el.innerHTML = `
            <div class="slot-title">${label}</div>
            <div class="slot-empty">— VIDE —</div>
            <button onclick="chooseSlot(${slot}, 'new')">🆕 Nouvelle Partie</button>`;
        } else {
          el.innerHTML = `
            <div class="slot-title">${label}</div>
            <div class="slot-preview">Mois <span class="chiral-txt">${info.month}</span>/${GAME_LENGTH_MONTHS} · $${info.money}<br>${info.rank}${info.gameEnded ? ' · TERMINÉ' : ''}</div>
            <button onclick="chooseSlot(${slot}, 'continue')">▶ Continuer</button>
            <button class="danger" onclick="chooseSlot(${slot}, 'new')">🗑️ Effacer &amp; recommencer</button>`;
        }
      }
    }

export async function chooseSlot(slot, mode) {
      if (mode === 'new') {
        const info = await peekSlot(slot);
        if (info && !(await confirmModal({ title: 'Écraser l\'emplacement', message: 'Cet emplacement contient une partie en cours. L\'écraser et recommencer ?', confirmLabel: 'Écraser', cancelLabel: 'Annuler', danger: true }))) return;
      }
      runtime.currentSlot = slot;
      // V1.0.0 règle 5: plus de musique/chime auto-déclenchés ici — audio silencieux par défaut,
      // l'AudioContext s'initialise en tâche de fond (audio/AudioManager.js) et la musique ne démarre
      // que si l'utilisateur la bascule lui-même dans Options > Paramètres Système.
      dismissSplash();
      if (mode === 'continue') {
        const loaded = await loadGame(slot);
        if (loaded) {
          logEvent('💾 Partie chargée — reprise du réseau chiral');
          if (game.gameEnded) { const list = await loadScores(); showEndScreen(computeScore(), list); }
        } else {
          newGame(false, slot);
          logEvent('🎮 Bridges Delivery Network — Chiral Network ONLINE (UCA)');
        }
      } else {
        newGame(false, slot);
        logEvent('🎮 Bridges Delivery Network — Chiral Network ONLINE (UCA)');
      }
      render();
      initTutorial(); // V1.0.1 — démarre ou reprend le tutoriel (fast-forward des étapes déjà acquises)
      drawMap(); // démarre la boucle d'animation continue (auto-planifiée via rAF)
      startGameClock(); // 1 sec réelle = 1 jour, pause auto si onglet caché (#temps réel)
    }

// V0.6.0 — vérifie périodiquement l'absence prolongée à l'écran (temps réel, jamais le temps simulé):
// ne touche que runtime.gameSpeed/runtime.terminalSlowdownWarned, jamais game.* ni le déterminisme.
setInterval(checkTerminalSlowdown, 60000);

(async () => {
      initMainNav(); // V1.0.0: routeur Kairosoft 2 niveaux (Dashboard/Gestion/Missions/Camp/Options)
      initOptionsPanel(); // V1.0.0: volet Système/Gestion par défaut + préférence "animations réduites"
      initAudioManager(); // V1.0.0 règle 5: AudioContext silencieux dès la 1ère interaction, aucune lecture auto
      initUIShell(); // V0.7.0: pile de navigation (bouton Retour) + physique des tiroirs — indépendant du GameState
      initSplash();
      renderVersionBadge(); // V1.0.6 GOLD: badge de version de l'écran d'accueil, jamais codé en dur (config/version.js)
      const mapCanvas = document.getElementById('gameMap');
      if (mapCanvas) mapCanvas.addEventListener('click', (evt) => {
        const cell = canvasClickToCell(evt);
        if (!runtime.placingPCC) { inspectMapCell(cell.x, cell.y); return; }
        placePCCAt(cell.x, cell.y);
      });
      await renderSlotMenu();
    })();


// --- Pont window.* : les handlers onclick="..." inline (HTML historique, conservés tels quels
// pour ne rien changer au gameplay) référencent ces fonctions comme des globales. ---
window.game = game;
window.runtime = runtime;
window.eventBus = eventBus;
window.acceptUrgentQuestFromUI = acceptUrgentQuestFromUI;
window.negotiateUrgentQuest = negotiateUrgentQuest;
window.refuseUrgentQuest = refuseUrgentQuest;
window.toggleQuestPanel = toggleQuestPanel;
window.closeQuestPanel = closeQuestPanel;
window.setQuestPanelTab = setQuestPanelTab;
window.toggleMiniMapFullscreen = toggleMiniMapFullscreen;
window.closeMiniMapFullscreen = closeMiniMapFullscreen;
window.toggleConvoyPanel = toggleConvoyPanel;
window.closeConvoyPanel = closeConvoyPanel;
window.renderConvoyEscortList = renderConvoyEscortList;
window.updateConvoyPreview = updateConvoyPreview;
window.launchConvoyFromUI = launchConvoyFromUI;
window.openPorterDrawer = openPorterDrawer;
window.closePorterDrawer = closePorterDrawer;
window.setPorterDrawerTab = setPorterDrawerTab;
window.dispatchDeliveryManuallyUI = dispatchDeliveryManuallyUI;
window.giftEquipmentToPorterUI = giftEquipmentToPorterUI;
window.toggleHallOfFamePanel = toggleHallOfFamePanel;
window.closeHallOfFamePanel = closeHallOfFamePanel;
window.respondToBBPodAlertUI = respondToBBPodAlertUI;
window.dismissBBPodAlert = dismissBBPodAlert;
window.resolveBeachChoiceUI = resolveBeachChoiceUI;
window.toggleTerminalConsole = toggleTerminalConsole;
window.closeTerminalConsole = closeTerminalConsole;
window.sendTerminalCommandUI = sendTerminalCommandUI;
window.sendTerminalInputUI = sendTerminalInput;
window.openTelemetryDrawer = openTelemetryDrawer;
window.closeTelemetryDrawer = closeTelemetryDrawer;
window.toggleTelemetryDrawer = toggleTelemetryDrawer;
window.openPortersDrawer = openPortersDrawer;
window.closePortersDrawer = closePortersDrawer;
window.togglePortersDrawer = togglePortersDrawer;
window.openNetworkDrawer = openNetworkDrawer;
window.closeNetworkDrawer = closeNetworkDrawer;
window.toggleNetworkDrawer = toggleNetworkDrawer;
window.closeAllDrawersUI = closeAllDrawersUI;
window.openWalkDrawer = openWalkDrawer;
window.closeWalkDrawer = closeWalkDrawer;
window.toggleWalkDrawer = toggleWalkDrawer;
window.requestRealWalkActivationUI = requestRealWalkActivationUI;
window.stopRealWalkUI = stopRealWalkUI;
window.addManualWalkBoostUI = addManualWalkBoostUI;
window.openRaidSelectionModal = openRaidSelectionModal;
window.closeRaidSelectionModal = closeRaidSelectionModal;
window.launchRaidFromUI = launchRaidFromUI;
window.openRaidTrackingDrawer = openRaidTrackingDrawer;
window.closeRaidTrackingDrawer = closeRaidTrackingDrawer;
window.toggleRaidTrackingDrawer = toggleRaidTrackingDrawer;
window.abandonRaidUI = abandonRaidUI;
window.openRaidSelectionModalUI = openRaidSelectionModalUI;
window.openContractBoardModalUI = openContractBoardModalUI;
window.openLoadoutPanelModalUI = openLoadoutPanelModalUI;
window.closeContractBoardModal = closeContractBoardModal;
window.launchContractFromUI = launchContractFromUI;
window.openContractBoardModal = openContractBoardModal;
window.setContractBoardFilter = setContractBoardFilter;
window.closeLoadoutPanelModal = closeLoadoutPanelModal;
window.equipItemFromUI = equipItemFromUI;
window.openLoadoutPanelModal = openLoadoutPanelModal;
window.closeBuildActionDrawer = closeBuildActionDrawer;
window.openBuildActionDrawer = openBuildActionDrawer;
window.requestFieldBuildUI = requestFieldBuildUI;
window.toggleBuildActionDrawer = toggleBuildActionDrawer;
window.acceptVisitorOffer = acceptVisitorOffer;
window.advanceDay = advanceDay;
window.assaultCamp = assaultCamp;
window.assignPrepperContract = assignPrepperContract;
window.beachJump = beachJump;
window.buildExpansion = buildExpansion;
window.buildRoute = buildRoute;
window.buildStructure = buildStructure;
window.buyConsumable = buyConsumable;
window.buyEquip = buyEquip;
window.buyVehicle = buyVehicle;
window.cancelPlacingPCC = cancelPlacingPCC;
window.chooseSlot = chooseSlot;
window.closeInspector = closeInspector;
window.setMainTabUI = (id) => {
      setMainTab(id);
      if (id === 'logistique') renderManagementSubMenu();
      else if (id === 'livraisons') renderMissionsPanel();
      else if (id === 'options') renderOptionsPanel();
    };
window.closeMainNavUI = closeMainNav;
window.dispatchDeliveryPlanningUI = dispatchDeliveryPlanningUI;
window.dispatchPioneerUI = dispatchPioneerUI;
window.updateDeliveryPlanningMarginUI = updateDeliveryPlanningMarginUI;
window.setManagementSubTab = setManagementSubTab;
window.closeSubTabUI = closeSubTab;
window.skipTutorialUI = () => { skipTutorial(); render(); };
window.toggleTutorialUI = () => { toggleTutorialCompact(); }; // V1.0.2 — pur affichage, ne touche jamais game.*
window.setOptionsVoletUI = setOptionsVolet;
window.setReducedMotionUI = setReducedMotion;
window.connectKnot = connectKnot;
window.convertCampToRelay = convertCampToRelay;
window.craft = craft;
window.defendRelay = defendRelay;
window.dismissVisitor = dismissVisitor;
window.engageCatcher = engageCatcher;
window.reconCatcher = reconCatcher;
window.forceRest = forceRest;
window.fortifyRelay = fortifyRelay;
window.foundBranch = foundBranch;
window.hire = hire;
window.investInfrastructure = investInfrastructure;
window.launchQuestFromUI = launchQuestFromUI;
window.negotiatePrepperContract = negotiatePrepperContract;
window.newGame = newGame;
window.renderPorters = renderPorters;
window.repairGear = repairGear;
window.repairPCC = repairPCC;
window.retirePorter = retirePorter;
window.saveGame = saveGame;
window.scoutCandidate = scoutCandidate;
window.dismissCandidate = dismissCandidate;
window.recruitRobotBuddyUI = recruitRobotBuddy;
window.sendDelivery = sendDelivery;
window.sendToIncinerator = sendToIncinerator;
window.setActiveBranch = setActiveBranch;
window.setAutomationThreshold = setAutomationThreshold;
window.setGameSpeed = setGameSpeed;
window.setMusicVolume = setMusicVolume;
window.signSponsor = signSponsor;
window.startNewGamePlus = startNewGamePlus;
window.startPlacingPCC = startPlacingPCC;
window.switchMap = switchMap;
window.toggleAutomation = toggleAutomation;
window.toggleMusic = toggleMusic;
window.togglePause = togglePause;
