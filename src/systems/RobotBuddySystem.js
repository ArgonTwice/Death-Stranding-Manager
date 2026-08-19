// systems/RobotBuddySystem.js (V1.8.0) — recrutement des Pods Robotiques autonomes ("Robot-Buddies"),
// distinct de hire()/scoutCandidate() (systems/PorterSystem.js): pas de tirage aléatoire de skill/trait
// (toujours skill:'robot', data/Constants.js#SKILLS, jamais tiré par le recrutement humain normal —
// filtré explicitement là-bas), pas de salaire récurrent (autonome, cf. brief), gate ADDITIF rang +
// étoiles Prepper (data/UnlockTree.js, même principe que systems/EconomySystem.js#buyEquip/buyVehicle).
import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';
import { ROBOT_BUDDY_MIN_RANK_INDEX, ROBOT_BUDDY_MIN_STARS } from '../data/UnlockTree.js';
import { hireRaw } from './PorterSystem.js';
import { maxPrepperStars } from './PrepperSystem.js';

export function robotBuddyCount() {
      return game.porters.filter(p => p.skill === 'robot' && p.status !== 'dead' && p.status !== 'left').length;
    }

export function isRobotBuddyUnlocked() {
      return currentRankIndex() >= ROBOT_BUDDY_MIN_RANK_INDEX && maxPrepperStars(game.currentMap) >= ROBOT_BUDDY_MIN_STARS;
    }

export function robotBuddyCost() {
      const B = BALANCE.robotBuddy;
      return Math.ceil(B.recruitCost * (1 + robotBuddyCount() * B.costScalingPerOwned));
    }

export function recruitRobotBuddy() {
      const B = BALANCE.robotBuddy;
      if (!isRobotBuddyUnlocked()) { logEvent(`❌ Pods Robotiques non débloqués (Rang Porteur Certifié + ${ROBOT_BUDDY_MIN_STARS}⭐ Prepper requis)`, 'warn'); return false; }
      if (robotBuddyCount() >= B.maxOwned) { logEvent(`❌ Flotte de Pods Robotiques déjà au maximum (${B.maxOwned})`, 'warn'); return false; }
      const cost = robotBuddyCost();
      if (game.money < cost) { logEvent(`❌ Budget insuffisant ($${cost})`, 'warn'); return false; }
      game.money -= cost;
      // trait fixe 'ironback' (résistance dégâts +15%, cf. data/Constants.js#TRAITS): un Pod Robotique
      // n'a ni phobie ni joie narrativement pertinentes, mais applyIdentityToPorter() (hireRaw) lui en
      // assigne quand même une — déviation mineure acceptée plutôt que de contourner ce pipeline déjà
      // testé (SaveLoadExpedition.test.js/TutorialSave.test.js en dépendent pour tout porteur créé).
      const buddy = hireRaw('robot', 'ironback', false);
      buddy.salary = 0; // autonome — jamais de salaire récurrent, contrairement à un porteur humain
      logEvent(`🤖 Pod Robotique ${buddy.name} déployé (-$${cost}) — aucun salaire, résistance dégâts élevée.`, 'good');
      eventBus.emit('render:request');
      return true;
    }
