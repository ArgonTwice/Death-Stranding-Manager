// systems/PorterStorySystem.js (V0.5.0) — identité procédurale, psychologie et journal de bord des
// porteurs. Génération 100% déterministe: une seule valeur (porterSeed) est tirée du flux RNG
// partagé au recrutement, puis TOUT le reste de l'identité dérive d'un flux RNG indépendant
// (RNG.deriveGenerator(porterSeed)) — reproductible bit-à-bit à partir de cette seule seed stockée.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE } from '../data/Balance.js';
import { GRADES, JOURNAL_MILESTONES, PORTER_BACKGROUNDS, PORTER_JOYS, PORTER_PHOBIAS } from '../data/Constants.js';
import { isPositionSheltered } from './ShelterSystem.js';

const DOOMS_LEVEL_MAX = 3;

// Appelée une fois par recrutement (PorterSystem.hireRaw). Tire porterSeed depuis le flux partagé,
// puis génère tout le reste depuis un flux dérivé indépendant.
export function generatePorterIdentity() {
      const porterSeed = Math.floor(RNG.next() * 4294967296);
      const gen = RNG.deriveGenerator(porterSeed);
      const backgroundKeys = Object.keys(PORTER_BACKGROUNDS);
      const phobiaKeys = Object.keys(PORTER_PHOBIAS);
      const joyKeys = Object.keys(PORTER_JOYS);
      const background = backgroundKeys[gen.nextInt(backgroundKeys.length)];
      const phobia = phobiaKeys[gen.nextInt(phobiaKeys.length)];
      const joy = joyKeys[gen.nextInt(joyKeys.length)];
      const doomsLevel = gen.nextInt(DOOMS_LEVEL_MAX + 1);
      const talent = PORTER_BACKGROUNDS[background].talentGrade;
      return { porterSeed, background, phobia, joy, doomsLevel, talent, journal: [], acquiredTraitIds: [] };
    }

// Applique l'identité générée à un porteur fraîchement recruté (talent = petit bonus de départ dans
// une catégorie de grade, cohérent avec son background).
export function applyIdentityToPorter(porter) {
      const identity = generatePorterIdentity();
      Object.assign(porter, identity);
      if (identity.talent && porter.grades[identity.talent] != null) {
        porter.grades[identity.talent] += BALANCE.story.talentGradeBonus;
      }
      return porter;
    }

// V0.5.0 — backfill déterministe pour les porteurs chargés depuis une sauvegarde pré-V0.5.0 (aucune
// identité stockée): on leur en génère une à la volée au chargement, comme pickPorterName()/rollTrait()
// le font déjà pour trait/gearWear manquants dans SaveManager.deserializeGame().
export function ensurePorterIdentity(porter) {
      if (porter.porterSeed != null) return porter;
      return applyIdentityToPorter(porter);
    }

export function recordJournalEntry(porter, milestoneType) {
      if (!porter || !JOURNAL_MILESTONES[milestoneType]) return;
      porter.journal = porter.journal || [];
      porter.journal.unshift({ type: milestoneType, month: game.month });
      if (porter.journal.length > BALANCE.story.journalHistoryCap) porter.journal.length = BALANCE.story.journalHistoryCap;
      eventBus.emit('porter:milestoneReached', { porterId: porter.id, milestoneType });
      checkAcquiredTrait(porter, milestoneType);
    }

function checkAcquiredTrait(porter, milestoneType) {
      porter.acquiredTraitIds = porter.acquiredTraitIds || [];
      if (porter.acquiredTraitIds.includes(milestoneType)) return;
      const count = porter.journal.filter(j => j.type === milestoneType).length;
      if (count >= BALANCE.story.milestoneCountForAcquiredTrait) {
        porter.acquiredTraitIds.push(milestoneType);
        const def = JOURNAL_MILESTONES[milestoneType];
        logEvent(`📖 ${porter.name} débloque le Trait Acquis: ${def.acquiredTraitName}`, 'good');
        eventBus.emit('porter:traitAcquired', { porterId: porter.id, milestoneType });
      }
    }

// Bonus cumulés des Traits Acquis — mêmes dimensions que TRAITS (dmg_resist additif, stress_mult
// multiplicatif), lus par PorterSystem.porterResist() et DeliveryEngine.tick().
export function acquiredTraitDmgResist(porter) {
      return (porter.acquiredTraitIds || []).reduce((s, id) => s + (JOURNAL_MILESTONES[id].dmg_resist || 0), 0);
    }

export function acquiredTraitStressMult(porter) {
      return (porter.acquiredTraitIds || []).reduce((m, id) => m * (JOURNAL_MILESTONES[id].stress_mult || 1), 1);
    }

// Multiplicateur de vitesse de détection BT selon le niveau de DOOMS (0-3): plus il est élevé, plus
// le porteur "sent" les BT venir tôt et échappe à la détection.
export function doomsDetectionMult(porter) {
      return Math.max(0, 1 - (porter.doomsLevel || 0) * BALANCE.story.doomsDetectionMultPerLevel);
    }

function activeDeliveryFor(porter) {
      return game.deliveries.find(d => game.porters[d.porter] === porter);
    }

// Tick quotidien (DeliveryEngine.advanceDay): phobie + environnement augmente le stress, joie/abri le
// réduit. Purement basé sur l'état courant — aucun RNG consommé, donc sans risque pour le déterminisme.
export function applyPsychologyDailyEffects() {
      const B = BALANCE.story;
      for (const p of game.porters) {
        if (p.status === 'dead' || p.status === 'left' || !p.phobia) continue;
        const mapKey = p.map || game.currentMap;
        const d = game.mapsData[mapKey];
        const weatherType = d && d.weather ? d.weather.type : null;
        const del = activeDeliveryFor(p);

        let feared = false, joyed = false;
        if (p.phobia === 'timefall' && (weatherType === 'timefall' || weatherType === 'duststorm')) feared = true;
        if (p.phobia === 'bt' && del && del.btExposure > 0) feared = true;
        if (p.phobia === 'isolation' && del && !del.raidId && !(del.quest && del.quest.convoyId)) feared = true;
        if (p.phobia === 'heights' && del && del.destTerrain === 'mountain') feared = true;

        if (p.joy === 'shelter' && isPositionSheltered(mapKey, p.x, p.y)) joyed = true;
        if (p.joy === 'convoy' && del && del.quest && del.quest.convoyId) joyed = true;
        if (p.joy === 'solitude' && del && !del.raidId && !(del.quest && del.quest.convoyId)) joyed = true;
        if (p.joy === 'company' && del && (del.raidId || (del.quest && del.quest.convoyId))) joyed = true;

        if (feared) {
          p.stress = Math.min(100, p.stress + B.phobiaStressPerDay);
          eventBus.emit('porter:fearTriggered', { porterId: p.id, phobia: p.phobia });
        }
        if (joyed) {
          p.stress = Math.max(0, p.stress - B.joyStressReliefPerDay);
          eventBus.emit('porter:joyTriggered', { porterId: p.id, joy: p.joy });
        }
      }
    }

// Résumé "3 secondes" pour PorterDrawer.js: une ligne de conseil actionnable dérivée de la
// psychologie du porteur (ex: "⚠️ Hydrophobe -> Éviter Timefall").
export function porterQuickSummary(porter) {
      if (!porter.phobia) return null;
      const phobiaLabels = { timefall: 'Craint le Timefall — éviter les trajets sous Timefall/Tempête Chirale',
        bt: 'Craint les BT — éviter les zones BT/cargos exposés', isolation: 'Craint la solitude — préférer convois/raids en groupe',
        heights: 'Craint l\'altitude — éviter les destinations montagneuses' };
      return phobiaLabels[porter.phobia] || null;
    }
