// systems/ReconnaissanceSystem.js (V1.6.0) — 2 voies additives d'extension du Réseau Chiral, en plus
// de engine/DeliveryEngine.js#buildRoute() (paiement direct, inchangé): le Dispatch Pionnier
// (mobilise un porteur quelques jours, gratuit en argent) et la marche IRL (RealWalkSystem.js, tous
// les N pas). Les deux réutilisent DeliveryEngine.js#networkExpansionCandidates plutôt que dupliquer
// la recherche de cases adjacentes. Gère aussi les aléas de terrain DS2 (éboulement/inondation)
// bloquant temporairement une route déjà déverrouillée (game.terrainHazards, jamais une mutation de
// data/Routes.js#RAID_ROUTES — donnée STATIQUE partagée par toutes les parties du process).
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE } from '../data/Balance.js';
import { RAID_ROUTES } from '../data/Routes.js';
import { networkExpansionCandidates } from '../engine/MapEngine.js';
import { routeStatus, ROUTE_STATUS } from './raid/ChiralNetworkSystem.js';

function extendNetwork(mapKey, pick) {
      const d = game.mapsData[mapKey];
      if (!d || !pick) return false;
      d.routes.add(pick);
      if (mapKey === game.currentMap) game.routes = d.routes;
      return true;
    }

// Dispatch Pionnier: mobilise un porteur idle pendant BALANCE.reconnaissance.pioneerMissionDays,
// gratuit en argent (le coût est la mobilisation elle-même — le porteur ne peut rien faire d'autre
// pendant ce temps). Choix du candidat par RNG.next() (flux partagé): ce module n'a aucune règle
// d'isolation stricte comme RealWalkSystem.js, cohérent avec buildRoute() qui tire déjà ainsi.
export function dispatchPioneer(porterId) {
      const p = game.porters.find(x => x.id === porterId);
      if (!p || p.status !== 'idle' || p.health <= 15) { logEvent('❌ Ce porteur n\'est pas disponible pour une mission de reconnaissance.', 'warn'); return false; }
      const { candidates, blockedByCrater } = networkExpansionCandidates(p.map);
      if (!candidates.length) {
        logEvent(blockedByCrater > 0 ? "❌ Cratères bloquent l'extension — réseau encerclé" : '❌ Réseau déjà complet sur ce territoire', 'warn');
        return false;
      }
      game.pioneerMissions = game.pioneerMissions || [];
      const pick = candidates[Math.floor(RNG.next() * candidates.length)];
      game.pioneerMissions.push({ porterId, mapKey: p.map, target: pick, daysRemaining: BALANCE.reconnaissance.pioneerMissionDays });
      p.status = 'en route';
      logEvent(`🧭 ${p.name} part en Dispatch Pionnier — reconnaissance du territoire (${BALANCE.reconnaissance.pioneerMissionDays} jours).`, 'good');
      eventBus.emit('render:request');
      return true;
    }

// Appelée depuis engine/DeliveryEngine.js#tick() (tick quotidien) — même pattern que les autres
// tickXxx() déjà en place (checkMuleCamps, updatePrepperNeeds...).
export function tickPioneerMissions() {
      game.pioneerMissions = game.pioneerMissions || [];
      if (!game.pioneerMissions.length) return;
      const remaining = [];
      for (const mission of game.pioneerMissions) {
        mission.daysRemaining--;
        if (mission.daysRemaining > 0) { remaining.push(mission); continue; }
        const p = game.porters.find(x => x.id === mission.porterId);
        if (p && p.status === 'en route') p.status = 'idle';
        const extended = extendNetwork(mission.mapKey, mission.target);
        if (extended) logEvent(`🧭 ${p ? p.name : 'Le pionnier'} a cartographié une nouvelle zone — réseau étendu (${mission.target}).`, 'good');
      }
      game.pioneerMissions = remaining;
    }

// V1.6.0 — Aléas de terrain DS2: chaque route NETWORKED (jamais LOCKED/déjà BLOCKED/en Raid actif —
// pas la peine d'aggraver une route déjà indisponible ou d'interrompre un raid en transit) a une
// petite chance quotidienne d'être bloquée quelques jours. Consomme RNG.js (flux partagé, comme
// WeatherEngine.js/CombatEngine.js#checkMuleCamps déjà établis pour ce type d'aléa périodique).
const HAZARD_TYPES = [
      { id: 'rockslide', label: '🪨 Éboulement' },
      { id: 'flood', label: '🌊 Inondation' }
    ];

// Itère RAID_ROUTES au complet (toutes cartes), jamais routesForMap(game.currentMap): appelée depuis
// engine/DeliveryEngine.js#advanceDay() APRÈS le bloc d'auto-dispatch qui peut laisser
// game.currentMap sur la carte du DERNIER porteur traité (restauré à viewMap seulement en toute fin
// de advanceDay()) — se fier à game.currentMap ici ciblerait la mauvaise carte selon l'ordre des
// porteurs. game.mapsData[route.mapKey] peut être absent (territoire jamais visité/débloqué): ignoré.
export function checkTerrainHazards() {
      const B = BALANCE.reconnaissance;
      game.terrainHazards = game.terrainHazards || {};
      // Nettoyage des aléas expirés (mois révolu)
      for (const routeId in game.terrainHazards) {
        if (game.month > game.terrainHazards[routeId].untilMonth) delete game.terrainHazards[routeId];
      }
      for (const route of RAID_ROUTES) {
        if (!game.mapsData[route.mapKey]) continue; // territoire jamais initialisé (pas encore débloqué)
        if (game.terrainHazards[route.id]) continue; // déjà bloquée, pas de double aléa
        if (routeStatus(route) !== ROUTE_STATUS.NETWORKED) continue; // LOCKED/ACTIVE_RAID: jamais de nouvel aléa
        if (RNG.next() > B.hazardSpawnChance) continue;
        const type = HAZARD_TYPES[Math.floor(RNG.next() * HAZARD_TYPES.length)];
        const days = B.hazardBlockDaysMin + Math.floor(RNG.next() * (B.hazardBlockDaysMax - B.hazardBlockDaysMin + 1));
        game.terrainHazards[route.id] = { type: type.id, untilMonth: game.month + Math.max(1, Math.ceil(days / 30)) };
        logEvent(`${type.label} — ${route.name} temporairement impraticable (~${days} jours).`, 'warn');
        eventBus.emit('terrain:hazard', { routeId: route.id, type: type.id });
      }
    }

// Consommée exclusivement par systems/RealWalkSystem.js#recordSteps: choix de candidat DÉTERMINISTE
// (premier trouvé, ordre stable — jamais RNG.next()) pour respecter la règle d'isolation stricte de ce
// module ("AUCUN appel à RNG.js ici"). Un franchissement de seuil de pas IRL est un événement
// PARFAITEMENT déterministe (fonction pure de game.totalSteps déjà persisté) — utiliser le flux RNG
// partagé ici romprait cette pureté sans nécessité: contrairement au Dispatch Pionnier ci-dessus, il
// n'y a pas besoin de variété, juste d'un résultat reproductible.
export function extendNetworkDeterministic(mapKey) {
      const { candidates } = networkExpansionCandidates(mapKey);
      if (!candidates.length) return false;
      return extendNetwork(mapKey, candidates[0]);
    }
