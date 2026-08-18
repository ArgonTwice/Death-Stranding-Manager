// AUTO-EXTRACTED MODULE: core/GameState.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { RANKS } from '../data/Balance.js';
import { CAMP_EVENTS, FESTIVALS, RELICS, VISITOR_OFFERS } from '../data/Constants.js';
import { eventBus } from './EventBus.js';

export function currentRankIndex() {
      for (let i = RANKS.length - 1; i >= 0; i--) {
        if (game.completed >= RANKS[i].minCompleted && game.reputation >= RANKS[i].minRep) return i;
      }
      return 0;
    }

export function checkRankUp() {
      const idx = currentRankIndex();
      if (idx > runtime.announcedRank) {
        runtime.announcedRank = idx;
        logEvent(`🏅 Rang Bridges → ${RANKS[idx].name} (meilleures quêtes/boutiques débloquées)`, 'good');
      }
    }

export const game = {
      money: 10000,
      month: 1,
      reputation: 50,
      completed: 0,
      deaths: 0,
      porters: [],
      deliveries: [],
      structures: {},
      currentMap: 'mexico',
      mapsData: {}, // { mexico: {btZones,terrain,routes,craters}, australia: ... }
      // Alias vers la carte active — mis à jour par loadMapData()
      routes: null,
      btZones: null,
      craters: null,
      terrain: null,
      voidouts: [], // néantisations actives {x,y,start} (anim temporaire, toutes cartes confondues)
      log: [],
      materials: { chiral_crystal: 0, mule_scrap: 0, blood_grenades: 0, blood_bags: 0 }, // butin BT/MULE + consommables Catcher
      titles: [], // ids des titres obtenus (Dungeon Village 2: hauts faits cachés)
      scoutedCandidate: null, // profil scouté en attente d'embauche (#A)
      activeFestival: null, // festival temporaire en cours (cycles saisonniers)
      hallOfFame: [], // porteurs morts/licenciés, snapshot au moment du départ
      visitor: null, // visiteur itinérant avec offre limitée dans le temps
      bonds: {}, // camaraderie: "id1-id2" -> nb de raids faits ensemble
      legacyBonus: 0, // bonus XP permanent cumulé via les retraites de porteurs vétérans
      collection: [], // ids des reliques rares trouvées (musée)
      duos: [], // paires "id1-id2" formellement partenaires (bond >= 8 raids ensemble)
      sponsor: null, // sponsor actuel (nom, revenu mensuel, condition)
      automation: { autoRest: false, autoRestThreshold: 70, autoRepair: false, autoRepairThreshold: 60, autoReturn: false }, // ordres permanents (#Phase4)
      ngPlus: false, // Nouvelle Partie+ active — seul mode où x2 est disponible
      infraInvestments: 0, // nb d'investissements infrastructure Bridges (sink économique répétable, coût géométrique)
      loyalty: 50, // V0.3.0 — loyauté globale du réseau (0-100), distincte de reputation: gérée par QuestSystem (accept/negotiate/refuse)
      urgentQuests: [], // V0.3.0 — quêtes narratives urgentes actives (QuestSystem.js), déclenchées par météo/réputation
      urgentQuestHistory: [], // V0.3.0 — historique borné (succès/échec/refus/expiration) pour l'onglet "Terminées" de QuestPanel.js
      convoys: [], // V0.4.0 — convois lourds en transit (ConvoySystem.js). Éphémère comme game.deliveries: jamais persisté.
      telemetry: { convoysLaunched: 0, convoysArrivedFull: 0, convoysArrivedPartial: 0, sheltersProtectedCount: 0, sheltersExposedTotal: 0, deliveriesResolved: 0, deliveriesSucceeded: 0, rewardByRouteType: { express: 0, shortcut: 0, contraband: 0, none: 0 } }, // V0.4.0 — rapport de performance logistique cumulé (TelemetrySystem.js), persisté
      hardcoreTimefall: false, // V0.5.0 — modificateur NG+ (LegacySystem.js): météo Timefall/Tempête Chirale plus fréquente
      chiralMemory: 0, // V0.6.0 — Mémoire Chirale cumulée (MemoryEngine.js + ChiralTraceSystem.js)
      majorMemories: [], // V0.6.0 — souvenirs majeurs (score >= significanceThreshold), bornés
      terminalLastSeen: null, // V0.6.0 — horodatage réel de la dernière sauvegarde (TerminalSoul.js), jamais utilisé par la simulation déterministe
      bbPod: { connection: 0, stress: 0, stage: 'pod' }, // V0.6.0 — copilote (BBPodSystem.js)
      absenceMuseum: [], // V0.6.0 — EXACTEMENT 5 emplacements max, scellés pour toujours (AbsenceMuseum.js)
      gratitudeTrace: 0, // V0.6.0 — Likes cumulés du réseau fantôme (ChiralTraceSystem.js), déclenche les Pèlerins
      beachSession: null, // V0.6.0 — séquence de la Plage en cours (TheBeachEngine.js). Éphémère, jamais persisté, comme game.deliveries.
      totalSteps: 0, // V0.8.0 — pas IRL cumulés validés (RealWalkSystem.js), persisté, jamais affecté par RNG.js
      activeRaid: null, // V0.9.0 — Raid Tactique en cours (RaidSystem.js), persisté: peut s'étaler sur plusieurs sessions IRL
      raidHistory: [], // V0.9.0 — historique borné des raids achevés (rang, récompense), affiché dans RaidTrackingDrawer.js
      // --- Propriétés repliées depuis d'anciennes variables top-level module-scope (refacto ES Modules) ---
      gameEnded: false,
      quarterSnapshot: { completed: 0, deaths: 0, money: 10000 },
      dayInMonth: 0,
      monthState: { viewMap: null, moneyBeforeOps: 0, salaryCost: 0 },
      equipBought: { boots: 0, exo: 0, scanner: 0, cryptobiote: 0, bolagun: 0, cryobox: 0, harness: 0, climbing_anchor: 0, truck: 0, bike: 0, trike: 0 },
      activeRelicIds: [] // valeur réelle affectée après la déclaration de RELICS, plus bas dans le fichier
    };

export const runtime = {
      selectedPorterId: null,
      placingPCC: null,
      paused: false,
      gameSpeed: 1, // x1 par défaut, x2 uniquement débloqué en Nouvelle Partie+
      mapDirty: true, // calque statique du canvas à redessiner
      timefallUntil: 0, // timestamp ms: pluie temporelle active jusque là
      duststormUntil: 0, // timestamp ms: Duststorm DS2 (Australie) active jusque là
      rainDrops: [],
      dustParticles: [],
      announcedRank: 0,
      announcedLeagueTier: 0, // V0.5.0 — même garde-fou que announcedRank, pour league:promoted
      announcedUnlocks: {},
      currentSlot: 1,
      activeCampEvents: [], // valeur réelle affectée après la déclaration de CAMP_EVENTS, plus bas
      activeVisitorOffers: [], // idem VISITOR_OFFERS
      activeFestivalsPool: [] // idem FESTIVALS
    };

runtime.activeFestivalsPool = FESTIVALS;

runtime.activeVisitorOffers = VISITOR_OFFERS;

export function logEvent(msg, level = 'info') {
      game.log.unshift({ text: `[${game.month}] ${msg}`, level });
      if (game.log.length > 25) game.log.pop();
      eventBus.emit('log:added');
    }

game.activeRelicIds = RELICS.map(r => r.id);

runtime.activeCampEvents = CAMP_EVENTS;
