// systems/PorterAiEngine.js (V1.5.0) — autonomie des porteurs de la base ("DV2 style": achats
// autonomes lors des cycles de repos) et action "Offrir Équipement" depuis la fiche porteur. Délègue
// TOUTE la validation/le coût à systems/EconomySystem.js#buyEquip (même gating rang + étoiles Prepper
// que la Boutique manuelle, jamais dupliqué ici) — ce module ne fait que décider QUI achète QUOI et
// QUAND, jamais comment calculer un coût ou vérifier un déblocage.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';
import { buyEquip } from './EconomySystem.js';
import { gainConnection } from './MemoryEngine.js';

// Ordre de priorité d'achat FIXE (jamais un tirage RNG — l'automatisation reste 100% déterministe,
// comme AutomationManager.js#runAutomation déjà en place): du moins cher au plus cher, cohérent avec
// data/Balance.js#equipBaseCosts. "de leur niveau" (brief) = le premier type encore accessible que ce
// porteur n'a pas déjà au maximum, jamais un choix aléatoire.
const AUTO_BUY_PRIORITY = ['cryptobiote', 'boots', 'cryobox', 'scanner', 'bolagun', 'climbing_anchor', 'harness', 'exo'];

// Appelée depuis systems/AutomationManager.js#runAutomation() (tick quotidien) si
// game.automation.autoBuyEquip est activé — même pattern que autoRest/autoRepair/autoReturn: un
// porteur idle (donc "au repos", cf. brief) tente au plus autoBuyMaxPerTick achat(s), toujours le
// premier type accessible dans AUTO_BUY_PRIORITY qu'il n'a pas encore.
// V1.9.0 — priorité de paiement: le portefeuille INDIVIDUEL du porteur (systems/PorterEconomy.js#
// p.credits) est tenté EN PREMIER (silent — sonde sans dépenser le budget de base pour rien), puis
// le budget de la base en repli si les credits sont insuffisants. Jamais l'inverse: un porteur qui
// a économisé ses propres gains les dépense avant de puiser dans la caisse commune.
export function autoBuyEquipForIdlePorters() {
      let bought = 0, boughtWithCredits = 0;
      for (const p of game.porters) {
        if (p.status !== 'idle' || p.health <= 0) continue;
        for (const type of AUTO_BUY_PRIORITY) {
          // silent=true: sonde chaque type sans logger les tentatives ratées (déjà possédé, budget
          // insuffisant, gate rang/étoiles...) — un seul log groupé à la fin, cf. AutomationManager.js.
          if (buyEquip(type, p.id, true, 'credits')) { bought++; boughtWithCredits++; break; }
          if (buyEquip(type, p.id, true)) { bought++; break; } // repli sur le budget de la base
        }
      }
      if (bought > 0) logEvent(`🤖 Ordres permanents: ${bought} achat(s) autonome(s) d'équipement à la Boutique (dont ${boughtWithCredits} sur portefeuille personnel)`, 'good');
    }

// Action "Offrir Équipement" (fiche porteur, ui/PorterDrawer.js): achète l'équipement POUR ce porteur
// précis (même coût/mêmes gates que la Boutique — jamais un objet gratuit) puis applique la
// récompense du cadeau (Lien + Likes instantané). La "capacité de charge accrue" du brief découle déjà
// NATURELLEMENT de porterCapacity() pour les objets qui la modifient (boots/exo, cf.
// BALANCE.porter.capacityBootsBonus/capacityExoBonus) — aucun nouveau champ à dupliquer ici.
export function giftEquipmentToPorter(porterId, type) {
      const bought = buyEquip(type, porterId);
      if (!bought) return false;
      const p = game.porters.find(x => x.id === porterId);
      if (!p) return false;
      const B = BALANCE.porterAi;
      gainConnection(porterId, B.giftConnectionGain);
      p.likes = (p.likes || 0) + B.giftLikesGain;
      logEvent(`🎁 ${p.name} a reçu un cadeau — +${B.giftConnectionGain} Lien, +${B.giftLikesGain}❤️`, 'good');
      eventBus.emit('render:request');
      return true;
    }
