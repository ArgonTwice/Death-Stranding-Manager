// AUTO-EXTRACTED MODULE: systems/EconomySystem.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent } from '../core/GameState.js';
import { BALANCE, DIFFICULTIES, EQUIP_MIN_RANK, RANKS, STRUCTURE_MIN_RANK, VEHICLE_MAINTENANCE_COST, VEHICLE_MIN_RANK } from '../data/Balance.js';
import { SPONSORS, STRUCTURES } from '../data/Constants.js';
import { festivalValue } from '../engine/DeliveryEngine.js';
import { dominantStructure } from '../engine/MapEngine.js';
import { equipSlots, equippedCount, targetPorter } from './PorterSystem.js';
import { maxPrepperStars, prepperPerkBonus } from './PrepperSystem.js';
import { EQUIP_MIN_STARS, VEHICLE_MIN_STARS } from '../data/UnlockTree.js';

export function shopDiscountMult() {
      return (1 - (dominantStructure() === 'depot' ? BALANCE.economy.depotDominantDiscount : 0)) * (1 - festivalValue('shopDiscount')) * DIFFICULTIES[game.difficulty || 'normal'].costMult;
    }

// V1.5.0 — porterId optionnel: cible un porteur précis au lieu de targetPorter() (runtime.
// selectedPorterId, piloté par l'UI Boutique) — utilisé par systems/PorterAiEngine.js pour l'achat
// autonome et le don d'équipement, qui n'ont aucun rapport avec la sélection courante du joueur. Tous
// les appels existants (buyEquip(type), sans 2e/3e/4e argument) gardent EXACTEMENT le même comportement.
// `silent`: n'émet aucun logEvent d'ÉCHEC (le succès reste toujours loggé) — utilisé par
// PorterAiEngine.js#autoBuyEquipForIdlePorters() qui sonde plusieurs types dans l'ordre jusqu'à en
// trouver un accessible: sans ce mode, chaque type déjà possédé/inaccessible spammerait le journal.
// V1.9.0 — `payFrom` ('money' par défaut, ou 'credits'): paie sur le portefeuille INDIVIDUEL du
// porteur (systems/PorterEconomy.js#p.credits) au lieu du budget de la base — même gating rang/
// étoiles/slots, seule la SOURCE du paiement change.
export function buyEquip(type, porterId, silent, payFrom) {
      const base = BALANCE.economy.equipBaseCosts;
      const target = porterId != null ? game.porters.find(p => p.id === porterId) : targetPorter();
      if (!target) { if (!silent) logEvent('❌ Aucun porteur actif'); return false; }
      if (target.equipment[type] >= BALANCE.economy.equipMaxPerType) { if (!silent) logEvent(`❌ ${target.name} déjà au max (${type})`); return false; }
      if ((EQUIP_MIN_RANK[type] || 0) > currentRankIndex()) { if (!silent) logEvent('❌ Rang Bridges insuffisant'); return false; }
      // V1.5.0 — data/UnlockTree.js: ADDITIF au gate de rang ci-dessus, jamais un remplacement.
      if ((EQUIP_MIN_STARS[type] || 0) > maxPrepperStars(game.currentMap)) { if (!silent) logEvent(`❌ Confiance Prepper insuffisante (${EQUIP_MIN_STARS[type]}⭐ requis) — raccordez et livrez un Prepper d'abord`, 'warn'); return false; }
      // Harness AUGMENTE les slots, il n'en consomme pas — tout le reste doit tenir dans equipSlots()
      if (type !== 'harness' && equippedCount(target) >= equipSlots(target)) {
        if (!silent) logEvent(`❌ ${target.name}: slots pleins (${equippedCount(target)}/${equipSlots(target)}) — achetez un Sac de portage`);
        return false;
      }
      const cost = Math.ceil(base[type] * (1 + game.equipBought[type] * BALANCE.economy.equipCostScalingPerBought) * (1 - (game.structures.depot || 0) * BALANCE.economy.depotStructureDiscountPerLevel) * RANKS[currentRankIndex()].costMult * shopDiscountMult());
      const usesCredits = payFrom === 'credits';
      const available = usesCredits ? (target.credits || 0) : game.money;
      if (available < cost) { if (!silent) logEvent(`❌ Budget ($${cost})`); return false; }
      if (usesCredits) target.credits -= cost; else game.money -= cost;
      game.equipBought[type]++;
      target.equipment[type]++;
      logEvent(`🔧 ${target.name} +${type} (-$${cost}${usesCredits ? ' crédits perso' : ''})`);
      eventBus.emit('render:request');
      return true;
    }

export function buyVehicle(type) {
      const base = BALANCE.economy.vehicleBaseCosts;
      const target = targetPorter();
      if (!target) { logEvent('❌ Aucun porteur actif'); return false; }
      if (target.equipment.vehicle) { logEvent(`❌ ${target.name} a déjà un véhicule`); return false; }
      if ((VEHICLE_MIN_RANK[type] || 0) > currentRankIndex()) { logEvent('❌ Rang Bridges insuffisant'); return false; }
      // V1.5.0 — data/UnlockTree.js: ADDITIF au gate de rang ci-dessus, jamais un remplacement.
      if ((VEHICLE_MIN_STARS[type] || 0) > maxPrepperStars(game.currentMap)) { logEvent(`❌ Confiance Prepper insuffisante (${VEHICLE_MIN_STARS[type]}⭐ requis) — raccordez et livrez un Prepper d'abord`, 'warn'); return false; }
      const cost = Math.ceil(base[type] * (1 + game.equipBought[type] * BALANCE.economy.vehicleCostScalingPerBought) * (1 - (game.structures.depot || 0) * BALANCE.economy.depotStructureDiscountPerLevel) * RANKS[currentRankIndex()].costMult * shopDiscountMult());
      if (game.money < cost) { logEvent(`❌ Budget ($${cost})`); return false; }
      game.money -= cost;
      game.equipBought[type]++;
      target.equipment.vehicle = type;
      logEvent(`🚚 ${target.name} +${type} (-$${cost})`);
      eventBus.emit('render:request');
      return true;
    }

export function infraCost() { return Math.ceil(BALANCE.economy.infraCostBase * Math.pow(BALANCE.economy.infraCostGrowth, game.infraInvestments)); }

export function investInfrastructure() {
      if (currentRankIndex() < BALANCE.economy.infraMinRankIndex) { logEvent('❌ Rang Porteur d\'Élite requis'); return; }
      const cost = infraCost();
      if (game.money < cost) { logEvent(`❌ Budget insuffisant ($${cost})`); return; }
      game.money -= cost;
      game.infraInvestments++;
      logEvent(`🏗️💰 Investissement infrastructure Bridges #${game.infraInvestments} (-$${cost}) — +0.2% reward livraisons, permanent`, 'good');
      eventBus.emit('render:request');
    }

export function checkSubsidiaries() {
      for (const sub of (game.subsidiaries || [])) {
        const monthsSince = game.month - sub.foundedMonth;
        const subsidy = Math.max(0, Math.round(BALANCE.economy.subsidyBase - monthsSince * BALANCE.economy.subsidyDecayPerMonth)); // décroît sur ~33 mois
        if (subsidy > 0) game.money += subsidy;
      }
    }

export function signSponsor(id) {
      const s = SPONSORS.find(x => x.id === id);
      if (!s) return;
      if (game.sponsor && game.sponsor.id === id) { logEvent('❌ Déjà sponsorisé par ce partenaire'); return; }
      game.sponsor = { id: s.id, name: s.name, monthlyIncome: s.monthlyIncome, desc: s.desc };
      // V1.25.9 — bug économique réel trouvé en jouant (exploit confirmé: 20 clics alternant entre
      // seulement 2 sponsors = +$40 000 à partir de $4 000, sans coût ni cooldown): game.sponsor est un
      // objet UNIQUE (pas une liste), donc changer de sponsor N'A JAMAIS été bloqué au-delà du garde
      // "même sponsor déjà actif" ci-dessus — mais le bonus de SIGNATURE (one-shot) était accordé à
      // CHAQUE changement, y compris en revenant vers un sponsor déjà signé plus tôt cette partie.
      // game.sponsorsSignedIds (persisté, jamais réinitialisé en cours de partie — seulement par
      // newGame()) mémorise qui a déjà touché son bonus: le changement de sponsor pour le revenu mensuel
      // reste toujours 100% libre, seul le bonus ponctuel ne se déclenche plus qu'une fois par sponsor.
      game.sponsorsSignedIds = game.sponsorsSignedIds || [];
      const alreadyClaimedBonus = game.sponsorsSignedIds.includes(s.id);
      if (!alreadyClaimedBonus) {
        game.money += s.signingBonus;
        game.sponsorsSignedIds.push(s.id);
        logEvent(`🤝 Nouveau sponsor: ${s.name} (+$${s.signingBonus} de signature, +$${s.monthlyIncome}/mois tant que: ${s.desc})`, 'good');
      } else {
        logEvent(`🤝 Sponsor changé: ${s.name} (+$${s.monthlyIncome}/mois tant que: ${s.desc} — bonus de signature déjà perçu)`, 'good');
      }
      eventBus.emit('render:request');
    }

export function checkSponsor() {
      if (!game.sponsor) return;
      const def = SPONSORS.find(s => s.id === game.sponsor.id);
      if (!def || !def.cond()) {
        logEvent(`📉 ${game.sponsor.name} se retire (condition non remplie)`, 'warn');
        game.sponsor = null;
        return;
      }
      game.money += game.sponsor.monthlyIncome;
    }

export function buildStructure(type) {
      const s = STRUCTURES[type];
      const level = game.structures[type] || 0;
      if (level >= s.maxLevel) { logEvent('❌ Niveau max atteint'); return; }
      if ((STRUCTURE_MIN_RANK[type] || 0) > currentRankIndex()) { logEvent('❌ Rang Bridges insuffisant'); return; }
      const cost = Math.ceil(s.cost * (1 + level * BALANCE.economy.structureCostGrowthPerLevel) * RANKS[currentRankIndex()].costMult * shopDiscountMult() * (1 - prepperPerkBonus('structureDiscount'))); // paliers de plus en plus chers + perk prepper Ingénieur
      if (game.money < cost) { logEvent("❌ Budget"); return; }
      game.money -= cost;
      game.structures[type] = level + 1;
      logEvent(`🏗️ ${s.levelNames[level]} (Niv.${level + 1}/${s.maxLevel}) -$${cost}`);
      eventBus.emit('render:request');
    }

export function computeLogisticsDashboard() {
      const active = game.porters.filter(p => p.status !== 'dead' && p.status !== 'left');
      const salaries = active.reduce((s, p) => s + p.salary, 0);
      const vehicleCost = active.reduce((s, p) => s + (p.equipment.vehicle ? (VEHICLE_MAINTENANCE_COST[p.equipment.vehicle] || 0) : 0), 0);
      let relayIncome = 0, generatorIncome = 0;
      for (const key in game.mapsData) {
        const d = game.mapsData[key];
        relayIncome += (d.muleCamps || []).filter(c => c.status === 'relay').reduce((s, c) => s + c.strength * BALANCE.combat.relayIncomePerStrength, 0);
        generatorIncome += (d.pccInstalls || []).filter(p => p.type === 'generator').length * BALANCE.combat.generatorIncomePerUnit;
      }
      const sponsorIncome = game.sponsor ? game.sponsor.monthlyIncome : 0;
      const subsidyIncome = (game.subsidiaries || []).reduce((s, sub) => s + Math.max(0, Math.round(BALANCE.economy.subsidyBase - (game.month - sub.foundedMonth) * BALANCE.economy.subsidyDecayPerMonth)), 0);
      const passiveIncome = relayIncome + generatorIncome + sponsorIncome + subsidyIncome;
      const fixedCosts = salaries + vehicleCost;
      return { salaries, vehicleCost, relayIncome, generatorIncome, sponsorIncome, subsidyIncome, passiveIncome, fixedCosts, netEstimate: passiveIncome - fixedCosts };
    }
