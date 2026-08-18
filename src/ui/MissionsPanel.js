// ui/MissionsPanel.js (V1.0.0) — onglet principal [Missions] de la nav Kairosoft: centralise la Carte
// Holographique Bridges (BridgesMap.js — nœuds de Relais/connexions/expéditions en transit) et le
// tableau de bord Raids/Expéditions (raidMissionsSectionHtml(), partagé avec RaidTrackingDrawer.js —
// même contenu, pas de duplication). Purement présentationnel: délègue toute mutation à RaidSystem.js/
// ExpeditionSystem.js via les mêmes ponts UI que le reste de l'app (jamais d'accès direct RNG/GameState
// en écriture ici).
import { eventBus } from '../core/EventBus.js';
import { raidMissionsSectionHtml } from './RaidTrackingDrawer.js';
import { renderBridgesMap } from './BridgesMap.js';

export function renderMissionsPanel() {
      const el = document.getElementById('missionsPanelBody');
      if (!el) return;
      el.innerHTML = raidMissionsSectionHtml();
      renderBridgesMap('missionsMapCanvas');
    }

function refreshIfVisible() {
      const el = document.getElementById('missionsPanelBody');
      if (el && el.closest('.nav-main-content.active')) renderMissionsPanel();
    }

eventBus.on('raid:progress', refreshIfVisible);
eventBus.on('raid:event', refreshIfVisible);
eventBus.on('raid:started', refreshIfVisible);
eventBus.on('raid:completed', refreshIfVisible);
eventBus.on('raid:abandoned', refreshIfVisible);
eventBus.on('expedition:started', refreshIfVisible);
eventBus.on('expedition:legAdvanced', refreshIfVisible);
eventBus.on('expedition:completed', refreshIfVisible);
eventBus.on('expedition:abandoned', refreshIfVisible);
