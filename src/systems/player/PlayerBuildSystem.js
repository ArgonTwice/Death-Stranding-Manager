// systems/player/PlayerBuildSystem.js (V0.9.5) — validation des BuildRequests pendant un Raid IRL:
// exige un Raid actif ET un kit PCC équipé (PlayerLoadout.js), consomme des matériaux, persiste la
// structure dans game.world.structures (règle 4). Jamais d'accès à RNG.js: coûts/durabilités fixes,
// entièrement issus de Balance.js (règle 3) — aucun nombre magique ici.
import { eventBus } from '../../core/EventBus.js';
import { game, logEvent } from '../../core/GameState.js';
import { BALANCE } from '../../data/Balance.js';
import { routeById } from '../../data/Routes.js';
import { hasPccKitEquipped } from './PlayerLoadout.js';

export const FIELD_STRUCTURE_TYPES = {
      shelter: { id: 'shelter', name: 'Abri de terrain', icon: '⛺', durability: () => BALANCE.building.shelterDurability, cost: () => ({ chiral_crystal: BALANCE.building.pccMaterialCost.chiral_crystal }) },
      relay: { id: 'relay', name: 'Relais de terrain', icon: '📡', durability: () => BALANCE.building.relayDurability, cost: () => ({ chiral_crystal: BALANCE.building.pccMaterialCost.chiral_crystal * 2 }) },
      generator: { id: 'generator', name: 'Générateur Chiral', icon: '⚡', durability: () => BALANCE.building.generatorDurability, cost: () => ({ chiral_crystal: BALANCE.building.pccMaterialCost.chiral_crystal * 3 }) }
    };

function worldState() {
      game.world = game.world || { structures: [], nextStructureId: 0 };
      game.world.structures = game.world.structures || [];
      game.world.nextStructureId = game.world.nextStructureId || 0;
      return game.world;
    }

export function worldStructures() { return worldState().structures; }

export function structuresForMap(mapKey) {
      return worldStructures().filter(s => s.mapKey === mapKey && s.durability > 0);
    }

function canAfford(cost) {
      return Object.entries(cost).every(([mat, qty]) => (game.materials[mat] || 0) >= qty);
    }
function spend(cost) {
      Object.entries(cost).forEach(([mat, qty]) => { game.materials[mat] = (game.materials[mat] || 0) - qty; });
    }

// Point d'entrée UNIQUE des BuildRequests en Raid IRL — appelé par BuildActionDrawer.js. Retourne
// false sans rien muter si la requête est invalide (pas de raid actif, pas de kit, matériaux
// insuffisants, quota de structures atteint sur cette route).
export function requestFieldBuild(structureType) {
      const raid = game.activeRaid;
      if (!raid || raid.status !== 'active') {
        logEvent('❌ Aucun Raid IRL en cours — impossible de construire.', 'warn');
        return false;
      }
      if (!hasPccKitEquipped()) {
        logEvent('❌ Aucun kit PCC équipé — préparez votre Loadout avant de partir.', 'warn');
        return false;
      }
      const def = FIELD_STRUCTURE_TYPES[structureType];
      if (!def) return false;

      const route = routeById(raid.routeId);
      const mapKey = route ? route.mapKey : null;
      const existingOnRoute = worldStructures().filter(s => s.routeId === raid.routeId);
      if (existingOnRoute.length >= BALANCE.building.maxFieldStructuresPerRoute) {
        logEvent('❌ Cette route a déjà atteint son quota de structures de terrain.', 'warn');
        return false;
      }
      const cost = def.cost();
      if (!canAfford(cost)) {
        logEvent('❌ Matériaux insuffisants pour cette construction.', 'warn');
        return false;
      }
      spend(cost);

      const world = worldState();
      const structure = {
        id: world.nextStructureId++,
        type: structureType, routeId: raid.routeId, mapKey,
        durability: def.durability(), builtMonth: game.month
      };
      world.structures.push(structure);

      logEvent(`🏗️ ${def.icon} ${def.name} déployé sur le terrain — bonus passif actif pour les porteurs de cette route.`, 'good');
      eventBus.emit('build:fieldStructurePlaced', { structure });
      return true;
    }
