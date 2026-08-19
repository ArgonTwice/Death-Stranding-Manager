// AUTO-EXTRACTED MODULE: systems/AutomationManager.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';
import { autoBuyEquipForIdlePorters } from './PorterAiEngine.js';
import { restCostMult } from './PorterSystem.js';

export function toggleAutomation(key) {
      if (!game.automation) game.automation = {};
      game.automation[key] = !game.automation[key];
      eventBus.emit('render:request');
    }

export function setAutomationThreshold(key, value) {
      if (!game.automation) game.automation = {};
      game.automation[key] = Math.max(0, Math.min(100, parseInt(value) || 0));
      eventBus.emit('render:request');
    }

export function runAutomation() {
      const auto = game.automation || (game.automation = { autoRest: false, autoRestThreshold: 70, autoRepair: false, autoRepairThreshold: 60, autoReturn: false, autoBuyEquip: false });
      // V1.5.0 — "achats autonomes DV2 style lors des cycles de repos" (brief): un porteur idle EST
      // par définition au repos entre deux missions (même condition que autoRest/autoRepair
      // ci-dessous) — appelé indépendamment des 3 autres flags, sur son propre toggle dédié.
      if (auto.autoBuyEquip) autoBuyEquipForIdlePorters();
      if (!auto.autoRest && !auto.autoRepair && !auto.autoReturn) return;
      let rested = 0, repaired = 0, returned = 0;
      for (const p of game.porters) {
        if (p.status !== 'idle' || p.health <= 0) continue;
        if (auto.autoRepair && (p.gearWear || 0) >= auto.autoRepairThreshold) {
          const cost = Math.ceil((p.gearWear || 0) * BALANCE.porter.repairCostPerWearPoint);
          if (game.money >= cost) { game.money -= cost; p.gearWear = 0; repaired++; }
        }
        if (auto.autoRest && p.stress >= auto.autoRestThreshold) {
          const cost = Math.ceil((p.salary / 2) * (1 + p.stress / 100) * restCostMult()); // V1.10.0 — Chambre Privée dominante
          if (game.money >= cost) { game.money -= cost; p.stress = 0; p.health = Math.min(100, p.health + BALANCE.porter.forceRestHealthRestore); rested++; }
        }
        if (auto.autoReturn) {
          const d = game.mapsData[p.map];
          const spawn = d && (d.branches[d.activeBranch] || d.branches[0]);
          if (spawn && (p.x !== spawn.x || p.y !== spawn.y)) { p.x = spawn.x; p.y = spawn.y; returned++; }
        }
      }
      // Un seul log groupé par catégorie: évite le spam qu'un log par porteur produirait
      if (rested > 0) logEvent(`🤖 Ordres permanents: ${rested} porteur(s) mis au repos automatiquement`, 'good');
      if (repaired > 0) logEvent(`🤖 Ordres permanents: ${repaired} équipement(s) réparé(s) automatiquement`, 'good');
      if (returned > 0) logEvent(`🤖 Ordres permanents: ${returned} porteur(s) rappelé(s) au dépôt`, 'good');
    }
