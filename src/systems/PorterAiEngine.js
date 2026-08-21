// systems/PorterAiEngine.js (V1.5.0) — autonomie des porteurs de la base ("DV2 style": achats
// autonomes lors des cycles de repos) et action "Offrir Équipement" depuis la fiche porteur. Délègue
// TOUTE la validation/le coût à systems/EconomySystem.js#buyEquip (même gating rang + étoiles Prepper
// que la Boutique manuelle, jamais dupliqué ici) — ce module ne fait que décider QUI achète QUOI et
// QUAND, jamais comment calculer un coût ou vérifier un déblocage.
import { eventBus } from '../core/EventBus.js';
import { game, logEvent } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';
import { buyEquip, equipCost } from './EconomySystem.js';
import { gainConnection } from './MemoryEngine.js';
import { activeSalaryTotal } from './PorterSystem.js';

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
// V1.27.0 — réserve de trésorerie: cette routine autonome ne descend plus jamais le budget commun
// (game.money) sous un plancher tenant compte de la PROCHAINE échéance de salaires (engine/
// DeliveryEngine.js#startMonthBookkeeping, tout le mois prélevé en une seule fois) — corrige un creux
// de trésorerie réel mesuré empiriquement (tests/balancing-simulation.test.mjs, archétype
// "optimiseur": jusqu'à $1-11 vers les jours 46-53, un roster idle nombreux avec autoBuyEquip actif
// dépensait en continu jusqu'à quasi $0 juste avant le prélèvement suivant). Ne s'applique JAMAIS aux
// crédits personnels (p.credits, tentés en premier ci-dessous, hors trésorerie commune) ni à un achat
// MANUEL à la Boutique (systems/EconomySystem.js#buyEquip, jamais modifié) — un joueur reste toujours
// libre de dépenser lui-même sa propre trésorerie, seule cette routine autonome est bridée.
export function autoBuyEquipForIdlePorters() {
      const reserve = activeSalaryTotal() * BALANCE.porterAi.autoBuyReserveSalaryMonths;
      let bought = 0, boughtWithCredits = 0;
      for (const p of game.porters) {
        if (p.status !== 'idle' || p.health <= 0) continue;
        for (const type of AUTO_BUY_PRIORITY) {
          // silent=true: sonde chaque type sans logger les tentatives ratées (déjà possédé, budget
          // insuffisant, gate rang/étoiles...) — un seul log groupé à la fin, cf. AutomationManager.js.
          if (buyEquip(type, p.id, true, 'credits')) { bought++; boughtWithCredits++; break; }
          // V1.27.0 (revue de code) — vérifie le solde APRÈS l'achat (game.money - equipCost(type)),
          // pas juste AVANT: un simple `game.money > reserve` laissait un item cher (ex: exo, $400)
          // faire passer game.money sous la réserve d'un coup si le solde initial était juste au-dessus
          // — exactement le scénario que cette réserve est censée empêcher. equipCost() (systems/
          // EconomySystem.js, factorisée hors de buyEquip) garantit que ce calcul ne peut jamais
          // diverger du coût réellement facturé.
          if (game.money - equipCost(type) >= reserve && buyEquip(type, p.id, true)) { bought++; break; } // repli sur le budget de la base, jamais sous la réserve de salaires
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
