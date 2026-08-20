// systems/raid/RaidSystem.js (V0.9.0) — état du Raid Tactique en cours. Observateur PUR de
// walk:stepDetected (émis par RealWalkSystem.js) — jamais l'inverse: le Real Walk Engine n'importe
// jamais ce module et ignore totalement qu'un raid est en cours (règle 2). La seule consommation de
// RNG.js de tout le pipeline a lieu ICI, une fois, au lancement (raidSeed) — tout le reste
// (RaidEventResolver.js) découle du générateur dérivé de cette seed.
import { eventBus } from '../../core/EventBus.js';
import { game, logEvent } from '../../core/GameState.js';
import { RNG } from '../../core/RNG.js';
import { BALANCE } from '../../data/Balance.js';
import { routeById } from '../../data/Routes.js';
import { isRouteAvailable } from './ChiralNetworkSystem.js';
import { resolveCheckpointEvent, releaseRaidGenerator } from './RaidEventResolver.js';
import { resolveRaidReward } from './RaidRewardResolver.js';
import { recordJournalEntry } from '../PorterStorySystem.js';
import { loadoutCargoDamageReduction, loadoutStepEfficiencyMult, loadoutTimefallResistMult } from '../player/PlayerLoadout.js';

export function activeRaid() { return game.activeRaid; }

export function launchRaid(routeId, porterId) {
      if (game.activeRaid && game.activeRaid.status === 'active') {
        logEvent('❌ Un Raid est déjà en cours — abandonnez-le ou terminez-le avant d\'en lancer un autre.', 'warn');
        return false;
      }
      const route = routeById(routeId);
      if (!route) return false;
      if (!isRouteAvailable(route)) {
        logEvent('🔒 Cette route n\'est pas encore connectée au Réseau Chiral.', 'warn');
        return false;
      }
      const porter = game.porters.find(p => p.id === porterId);
      if (!porter || porter.status !== 'idle' || porter.health <= 0) {
        logEvent('❌ Ce porteur n\'est pas disponible pour un Raid.', 'warn');
        return false;
      }

      const raidSeed = Math.floor(RNG.next() * 4294967296); // SEULE consommation de RNG.js du pipeline raid
      // V0.9.5 — le loadout IRL (bottes/corps/véhicule) module la distance RÉELLE à parcourir pour
      // couvrir la même distance chirale: un multiplicateur >1 réduit le nombre de pas requis. Calculé
      // UNE FOIS au lancement (règle 1: seul RaidSystem.js applique ce modificateur, jamais RealWalkSystem.js).
      const efficiencyMult = loadoutStepEfficiencyMult();
      const targetDistanceSteps = Math.max(1, Math.round(route.baseDistanceSteps / efficiencyMult));
      game.activeRaid = {
        routeId, porterId, raidSeed,
        baseDistanceSteps: route.baseDistanceSteps,
        targetDistanceSteps,
        traveledSteps: 0,
        cargoState: 1.0,
        totalDetourSteps: 0,
        events: [],
        resolvedCheckpoints: [],
        status: 'active',
        startedMonth: game.month
      };
      porter.status = 'en route'; // réservé pour la durée du raid, comme une livraison classique
      logEvent(`🚩 Raid IRL lancé — ${route.name} : ${porter.name} prend la route (${targetDistanceSteps.toLocaleString('fr-FR')} pas${efficiencyMult > 1 ? `, loadout x${efficiencyMult.toFixed(2)}` : ''}).`, 'good');
      eventBus.emit('raid:started', { routeId, porterId, baseDistanceSteps: route.baseDistanceSteps, targetDistanceSteps });
      return true;
    }

export function abandonRaid() {
      const raid = game.activeRaid;
      if (!raid || raid.status !== 'active') return;
      const porter = game.porters.find(p => p.id === raid.porterId);
      if (porter && porter.status === 'en route') porter.status = 'idle';
      raid.status = 'abandoned';
      releaseRaidGenerator(raid.raidSeed);
      logEvent('🚫 Raid IRL abandonné — le cargo reste au dépôt.', 'warn');
      eventBus.emit('raid:abandoned', { routeId: raid.routeId, porterId: raid.porterId });
    }

function applyCheckpointEvent(raid, fraction) {
      const event = resolveCheckpointEvent(raid.raidSeed, fraction);
      raid.events.push(event);
      let appliedDetour = 0;
      if (event.detourSteps > 0) {
        // V1.5.0 — les Bottes équipées atténuent SPÉCIFIQUEMENT un détour Timefall (résistance à la
        // pluie chirale qui ralentit la marche), jamais les autres events (éboulement/BT/embuscade
        // MULE: aucun rapport avec une protection anti-pluie) — RaidEventResolver.js reste pur/
        // déterministe, seul RaidSystem.js combine son résultat brut avec le modificateur de loadout
        // (même principe que loadoutCargoDamageReduction ci-dessous pour le Corps).
        const detourMit = event.id === 'timefall' ? 1 - loadoutTimefallResistMult() : 1;
        appliedDetour = Math.round(event.detourSteps * detourMit);
        raid.targetDistanceSteps += appliedDetour;
        raid.totalDetourSteps += appliedDetour;
      }
      if (event.cargoDamage > 0) {
        // V0.9.5: le corps équipé (Exosquelette) atténue les dégâts cargo — RaidEventResolver.js reste
        // pur/déterministe, seul RaidSystem.js combine son résultat brut avec le modificateur de loadout.
        const mitigatedDamage = event.cargoDamage * (1 - loadoutCargoDamageReduction());
        raid.cargoState = Math.max(BALANCE.raid.cargoStateFloor, raid.cargoState - mitigatedDamage);
      }
      const pct = Math.round(fraction * 100);
      if (event.bad) {
        logEvent(`⚠️ Raid — ${pct}%: ${event.label} (+${appliedDetour} pas, cargo ${Math.round(raid.cargoState * 100)}%)`, 'warn');
      } else {
        logEvent(`✅ Raid — ${pct}%: ${event.label} — aucun contretemps.`, 'good');
      }
      eventBus.emit('raid:event', { fraction, event, raid: { ...raid } });
    }

function completeRaid(raid) {
      const route = routeById(raid.routeId);
      const porter = game.porters.find(p => p.id === raid.porterId);
      const reward = resolveRaidReward(route, raid);

      if (porter) {
        porter.likes = (porter.likes || 0) + reward.likes;
        porter.xp = (porter.xp || 0) + reward.xp;
        porter.status = 'idle';
        if (reward.rank === 'LEGENDARY' || reward.rank === 'S') recordJournalEntry(porter, 'tactical_raid_legend');
      }
      game.materials.chiral_crystal = (game.materials.chiral_crystal || 0) + reward.chiralium;
      game.materials.mule_scrap = (game.materials.mule_scrap || 0) + reward.muleScrap;
      // V1.25.8 — trouvé en jouant un Raid Tactique jusqu'au bout: RaidRewardResolver.js arrondit
      // reward.reputation à 1 décimale (ex: 16.7) pour un affichage précis dans le message de log
      // ci-dessous — mais l'ajouter TEL QUEL à game.reputation laissait ce champ devenir fractionnaire
      // (ex: 66.7/100), alors que TOUTES les 17 autres sources de réputation du projet (grep exhaustif:
      // CombatEngine.js/DeliveryEngine.js/NetworkSystem.js/AbsenceMuseum.js/Constants.js) n'utilisent
      // que des constantes entières — game.reputation n'est affiché nulle part avec arrondi (HUD.js:
      // sbRep/rep/rank, toujours `${game.reputation}` brut), donc ce seul point d'entrée aurait fait
      // apparaître un "66.7/100" incohérent dans le bandeau de stats/le tiroir Réseau/la progression de
      // rang. Arrondi ICI seulement (au moment d'appliquer au stat persistée) — le message de log
      // ci-dessous garde sa précision d'origine (reward.reputation, jamais modifié).
      game.reputation = Math.min(100, Math.round(game.reputation + reward.reputation));

      game.raidHistory = game.raidHistory || [];
      game.raidHistory.unshift({
        routeId: raid.routeId, routeName: route ? route.name : raid.routeId, porterName: porter ? porter.name : '?',
        rank: reward.rank, likes: reward.likes, chiralium: reward.chiralium, month: game.month
      });
      game.raidHistory = game.raidHistory.slice(0, 20);

      raid.status = 'completed';
      raid.rank = reward.rank;
      releaseRaidGenerator(raid.raidSeed);

      logEvent(`🏁 Raid terminé — Rang ${reward.rank} ! +${reward.likes} likes, +${reward.chiralium} chiralium, +${reward.reputation} rép.`, 'good');
      eventBus.emit('raid:completed', { routeId: raid.routeId, porterId: raid.porterId, rank: reward.rank, reward });
    }

// Point d'entrée observateur — appelé UNIQUEMENT via l'abonnement walk:stepDetected ci-dessous,
// jamais directement par RealWalkSystem.js/WalkSession.js (qui n'importent jamais ce module).
function tryAdvanceRaidWithSteps(added) {
      const raid = game.activeRaid;
      if (!raid || raid.status !== 'active') return;
      raid.traveledSteps += added;

      for (const fraction of BALANCE.raid.checkpoints) {
        // V0.9.5: fraction de targetDistanceSteps (pas baseDistanceSteps) — s'adapte au multiplicateur
        // de loadout ET aux détours déjà résolus, plutôt qu'à la distance d'origine non modifiée.
        const thresholdSteps = raid.targetDistanceSteps * fraction;
        if (raid.traveledSteps >= thresholdSteps && !raid.resolvedCheckpoints.includes(fraction)) {
          raid.resolvedCheckpoints.push(fraction);
          applyCheckpointEvent(raid, fraction);
        }
      }

      if (raid.traveledSteps >= raid.targetDistanceSteps) {
        completeRaid(raid);
      } else {
        eventBus.emit('raid:progress', { traveledSteps: raid.traveledSteps, targetDistanceSteps: raid.targetDistanceSteps });
      }
    }

// Abonnement unique — ne réagit qu'à la forme de payload émise par RealWalkSystem.recordSteps()
// ({ totalSteps, added }), pas à celle de WalkSession.js ({ sessionSteps }), pour ne compter chaque
// pas qu'une seule fois quelle que soit sa source (capteur réel, mock, ou commande Terminal STEPS).
eventBus.on('walk:stepDetected', (payload) => {
      if (!payload || typeof payload.added !== 'number') return;
      tryAdvanceRaidWithSteps(payload.added);
    });
