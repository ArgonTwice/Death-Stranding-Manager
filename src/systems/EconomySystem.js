// AUTO-EXTRACTED MODULE: systems/EconomySystem.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent } from '../core/GameState.js';
import { DIFFICULTIES, EQUIP_MIN_RANK, RANKS, STRUCTURE_MIN_RANK, VEHICLE_MAINTENANCE_COST, VEHICLE_MIN_RANK } from '../data/Balance.js';
import { SPONSORS, STRUCTURES } from '../data/Constants.js';
import { festivalValue } from '../engine/DeliveryEngine.js';
import { dominantStructure } from '../engine/MapEngine.js';
import { equipSlots, equippedCount, targetPorter } from './PorterSystem.js';
import { prepperPerkBonus } from './PrepperSystem.js';
import { render } from '../ui/HUD.js';

export function shopDiscountMult() {
      return (1 - (dominantStructure() === 'depot' ? 0.03 : 0)) * (1 - festivalValue('shopDiscount')) * DIFFICULTIES[game.difficulty || 'normal'].costMult;
    }

export function buyEquip(type) {
      const base = { boots: 200, exo: 400, scanner: 300, cryptobiote: 150, bolagun: 350, cryobox: 250, harness: 350, climbing_anchor: 300 };
      const target = targetPorter();
      if (!target) { logEvent('❌ Aucun porteur actif'); return; }
      if (target.equipment[type] >= 2) { logEvent(`❌ ${target.name} déjà au max (${type})`); return; }
      if ((EQUIP_MIN_RANK[type] || 0) > currentRankIndex()) { logEvent('❌ Rang Bridges insuffisant'); return; }
      // Harness AUGMENTE les slots, il n'en consomme pas — tout le reste doit tenir dans equipSlots()
      if (type !== 'harness' && equippedCount(target) >= equipSlots(target)) {
        logEvent(`❌ ${target.name}: slots pleins (${equippedCount(target)}/${equipSlots(target)}) — achetez un Sac de portage`);
        return;
      }
      const cost = Math.ceil(base[type] * (1 + game.equipBought[type] * 0.2) * (1 - (game.structures.depot || 0) * 0.05) * RANKS[currentRankIndex()].costMult * shopDiscountMult());
      if (game.money < cost) { logEvent(`❌ Budget ($${cost})`); return; }
      game.money -= cost;
      game.equipBought[type]++;
      target.equipment[type]++;
      logEvent(`🔧 ${target.name} +${type} (-$${cost})`);
      eventBus.emit('render:request');
    }

export function buyVehicle(type) {
      const base = { truck: 2000, bike: 1500, trike: 1800 };
      const target = targetPorter();
      if (!target) { logEvent('❌ Aucun porteur actif'); return; }
      if (target.equipment.vehicle) { logEvent(`❌ ${target.name} a déjà un véhicule`); return; }
      if ((VEHICLE_MIN_RANK[type] || 0) > currentRankIndex()) { logEvent('❌ Rang Bridges insuffisant'); return; }
      const cost = Math.ceil(base[type] * (1 + game.equipBought[type] * 0.25) * (1 - (game.structures.depot || 0) * 0.05) * RANKS[currentRankIndex()].costMult * shopDiscountMult());
      if (game.money < cost) { logEvent(`❌ Budget ($${cost})`); return; }
      game.money -= cost;
      game.equipBought[type]++;
      target.equipment.vehicle = type;
      logEvent(`🚚 ${target.name} +${type} (-$${cost})`);
      eventBus.emit('render:request');
    }

export function infraCost() { return Math.ceil(50000 * Math.pow(1.18, game.infraInvestments)); }

export function investInfrastructure() {
      if (currentRankIndex() < 3) { logEvent('❌ Rang Porteur d\'Élite requis'); return; }
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
        const subsidy = Math.max(0, Math.round(500 - monthsSince * 15)); // décroît sur ~33 mois
        if (subsidy > 0) game.money += subsidy;
      }
    }

export function signSponsor(id) {
      const s = SPONSORS.find(x => x.id === id);
      if (!s) return;
      if (game.sponsor && game.sponsor.id === id) { logEvent('❌ Déjà sponsorisé par ce partenaire'); return; }
      game.sponsor = { id: s.id, name: s.name, monthlyIncome: s.monthlyIncome, desc: s.desc };
      game.money += s.signingBonus;
      logEvent(`🤝 Nouveau sponsor: ${s.name} (+$${s.signingBonus} de signature, +$${s.monthlyIncome}/mois tant que: ${s.desc})`, 'good');
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
      const cost = Math.ceil(s.cost * (1 + level * 0.8) * RANKS[currentRankIndex()].costMult * shopDiscountMult() * (1 - prepperPerkBonus('structureDiscount'))); // paliers de plus en plus chers + perk prepper Ingénieur
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
        relayIncome += (d.muleCamps || []).filter(c => c.status === 'relay').reduce((s, c) => s + c.strength * 40, 0);
        generatorIncome += (d.pccInstalls || []).filter(p => p.type === 'generator').length * 60;
      }
      const sponsorIncome = game.sponsor ? game.sponsor.monthlyIncome : 0;
      const subsidyIncome = (game.subsidiaries || []).reduce((s, sub) => s + Math.max(0, Math.round(500 - (game.month - sub.foundedMonth) * 15)), 0);
      const passiveIncome = relayIncome + generatorIncome + sponsorIncome + subsidyIncome;
      const fixedCosts = salaries + vehicleCost;
      return { salaries, vehicleCost, relayIncome, generatorIncome, sponsorIncome, subsidyIncome, passiveIncome, fixedCosts, netEstimate: passiveIncome - fixedCosts };
    }
