// AUTO-EXTRACTED MODULE: engine/CombatEngine.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';
import { gradeLevel } from '../data/Constants.js';
import { recordHallOfFame } from '../systems/PorterSystem.js';
import { resolveCatcherEncounter } from '../systems/raid/CombatResolver.js';

export function assaultCamp(campId, mode) {
      const B = BALANCE.combat;
      const camp = (game.muleCamps || []).find(c => c.id === campId);
      if (!camp || camp.status !== 'hostile') return;
      const squad = game.porters
        .filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100)
        .slice(0, B.assaultSquadMaxSize);
      if (squad.length === 0) { logEvent('❌ Aucun porteur disponible ici'); return; }

      // Chance de succès: base + taille d'escouade + stats pertinentes au mode choisi
      let successChance = B.assaultSuccessBase + squad.length * B.assaultSuccessPerSquadMember;
      if (mode === 'infiltration') {
        successChance += squad.filter(p => p.equipment.bolagun).length * B.infiltrationBolagunBonus;
        successChance += squad.reduce((s, p) => s + gradeLevel(p, 'discretion'), 0) * B.infiltrationDiscretionGradeMult;
      } else {
        successChance += squad.reduce((s, p) => s + gradeLevel(p, 'combat'), 0) * B.assaultCombatGradeMult;
        successChance += B.assaultDirectBonus; // l'assaut létal est plus direct, plus fiable à effectif égal
      }
      successChance = Math.min(B.assaultSuccessCap, successChance) - (camp.strength - 1) * B.assaultStrengthPenaltyMult;

      const success = RNG.next() < successChance;
      for (const p of squad) p.status = 'idle'; // ne mobilise pas de délivrance, résolution immédiate

      if (success) {
        camp.status = 'pacified';
        camp.safeUntilMonth = game.month + B.pacifySafeMonthsBase + Math.floor(RNG.next() * B.pacifySafeMonthsRandRange); // 3-6 mois
        const loot = camp.strength * (B.assaultLootBase + Math.floor(RNG.next() * B.assaultLootRandRange));
        game.materials.mule_scrap += loot;
        if (mode === 'assault') {
          camp.needsIncineration = true;
          game.reputation = Math.max(0, game.reputation - B.lethalAssaultReputationLoss); // violence létale, coût réputation temporaire
          eventBus.emit('sfx:brass', 0.9);
          logEvent(`💥 Camp MULE nettoyé par assaut létal (${squad.length} porteurs) — +${loot} ferraille MULE. Corps à envoyer à l'incinérateur.`, 'good');
        } else {
          eventBus.emit('sfx:brass', 0.7);
          logEvent(`🥷 Camp MULE pacifié par infiltration (${squad.length} porteurs) — +${loot} ferraille MULE, zone sûre ${camp.safeUntilMonth - game.month} mois`, 'good');
        }
      } else {
        const victim = squad[Math.floor(RNG.next() * squad.length)];
        const dmg = B.assaultFailDamageBase + RNG.next() * B.assaultFailDamageRandRange;
        victim.health = Math.max(0, victim.health - dmg);
        if (victim.health <= 0) {
          victim.status = 'dead';
          game.deaths++;
          recordHallOfFame(victim, 'tombé au combat (camp MULE)');
          logEvent(`💀 ${victim.name} tombé lors de l'assaut du camp MULE — échec de l'opération`, 'death');
        } else {
          logEvent(`❌ Échec de l'opération contre le camp MULE — ${victim.name} blessé (-${Math.ceil(dmg)} HP)`, 'warn');
        }
      }
      eventBus.emit('render:request');
    }

export function sendToIncinerator(campId) {
      const camp = (game.muleCamps || []).find(c => c.id === campId);
      if (!camp || !camp.needsIncineration) return;
      const cost = BALANCE.combat.incineratorCost;
      if (game.money < cost) { logEvent(`❌ Budget incinération ($${cost})`); return; }
      game.money -= cost;
      camp.needsIncineration = false;
      logEvent(`🔥 Corps envoyés à l'incinérateur (-$${cost}) — zone assainie`, 'good');
      eventBus.emit('render:request');
    }

export function convertCampToRelay(campId) {
      const camp = (game.muleCamps || []).find(c => c.id === campId);
      if (!camp || camp.status !== 'pacified' || camp.needsIncineration) return;
      const cost = BALANCE.combat.relayConversionCost;
      if (game.money < cost) { logEvent(`❌ Budget conversion ($${cost})`); return; }
      game.money -= cost;
      camp.status = 'relay';
      logEvent(`🏭 Camp converti en relais logistique (-$${cost}) — revenu passif permanent`, 'good');
      eventBus.emit('render:request');
    }

export function checkMuleCamps() {
      const B = BALANCE.combat;
      for (const key in game.mapsData) {
        const camps = game.mapsData[key].muleCamps || [];
        for (const c of camps) {
          if (c.status === 'pacified' && c.safeUntilMonth !== null && game.month >= c.safeUntilMonth && !c.needsIncineration) {
            c.status = 'hostile';
            c.safeUntilMonth = null;
            if (key === game.currentMap) {
              logEvent(`🏴‍☠️ Un camp MULE s'est réinstallé (${c.x},${c.y})`, 'warn');
              eventBus.emit('mule:campReactivated', { x: c.x, y: c.y }); // V1.3.0 — audio/SoundEngine.js#playAlert()
            }
          }
          // Non-intervention: un relais resté sous attaque un mois entier sans défense retombe aux MULEs
          if (c.status === 'under_attack') {
            c.status = 'hostile';
            c.fortified = false;
            if (key === game.currentMap) logEvent(`💀 Le relais (${c.x},${c.y}) est tombé, faute de défense`, 'death');
          }
          // Contre-attaque MULE: ~8%/mois sur un relais non fortifié
          else if (c.status === 'relay' && !c.fortified && RNG.next() < B.relayCounterAttackChance) {
            c.status = 'under_attack';
            logEvent(`⚠️ ATTENTION — Le relais logistique (${c.x},${c.y}) est sous attaque MULE !`, 'warn');
          }
          if (c.status === 'relay') game.money += c.strength * B.relayIncomePerStrength; // revenu passif mensuel
        }
        const generators = (game.mapsData[key].pccInstalls || []).filter(p => p.type === 'generator').length;
        if (generators > 0) game.money += generators * B.generatorIncomePerUnit; // revenu passif mensuel des générateurs chiraux
      }
    }

export function defendRelay(campId) {
      const B = BALANCE.combat;
      const camp = (game.muleCamps || []).find(c => c.id === campId);
      if (!camp || camp.status !== 'under_attack') return;
      const squad = game.porters
        .filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100)
        .slice(0, B.defendSquadMaxSize);
      if (squad.length === 0) { logEvent('❌ Aucun porteur disponible pour défendre le relais'); return; }

      let successChance = B.defendSuccessBase + squad.length * B.defendSuccessPerSquadMember;
      successChance += squad.filter(p => p.equipment.bolagun).length * B.defendBolagunBonus;
      successChance += squad.reduce((s, p) => s + gradeLevel(p, 'combat'), 0) * B.defendCombatGradeMult;
      successChance = Math.min(B.defendSuccessCap, successChance) - (camp.strength - 1) * B.defendStrengthPenaltyMult;

      if (RNG.next() < successChance) {
        camp.status = 'relay';
        game.reputation = Math.min(100, game.reputation + B.defendReputationGain);
        eventBus.emit('sfx:brass', 0.6);
        logEvent(`🛡️ Relais défendu avec succès (${squad.length} porteur${squad.length > 1 ? 's' : ''}) — +${B.defendReputationGain} réputation`, 'good');
      } else {
        for (const p of squad) {
          const dmg = B.defendFailDamageBase + RNG.next() * B.defendFailDamageRandRange;
          p.health = Math.max(0, p.health - dmg);
          if (p.health <= 0) { p.status = 'dead'; game.deaths++; recordHallOfFame(p, 'tombé en défendant un relais'); }
        }
        logEvent(`❌ Défense du relais (${camp.x},${camp.y}) repoussée — porteurs blessés`, 'warn');
      }
      eventBus.emit('render:request');
    }

export function fortifyRelay(campId) {
      const camp = (game.muleCamps || []).find(c => c.id === campId);
      if (!camp || camp.status !== 'relay') return;
      if (camp.fortified) { logEvent('❌ Relais déjà fortifié'); return; }
      const cost = BALANCE.combat.fortifyRelayCost;
      if (game.money < cost) { logEvent(`❌ Budget fortification ($${cost})`); return; }
      game.money -= cost;
      camp.fortified = true;
      logEvent(`🏰 Relais (${camp.x},${camp.y}) fortifié (-$${cost}) — immunisé contre les contre-attaques`, 'good');
      eventBus.emit('render:request');
    }

let catcherIdCounter = 0;

export function generateCatcherEncounter() {
      const B = BALANCE.combat;
      if (currentRankIndex() < B.catcherMinRank) return; // rang Élite requis
      const d = game.mapsData[game.currentMap];
      if (!d.catchers) d.catchers = [];
      if (d.catchers.length > 0) return; // un seul Catcher actif à la fois par territoire
      if (RNG.next() > B.catcherSpawnChance) return;
      const x = Math.floor(RNG.next() * MAP_WIDTH), y = Math.floor(RNG.next() * MAP_HEIGHT);
      const strength = B.catcherStrengthBase + Math.floor(RNG.next() * B.catcherStrengthRandRange);
      d.catchers.push({ id: `catcher-${catcherIdCounter++}`, x, y, strength });
      if (d === game.mapsData[game.currentMap]) game.catchers = d.catchers;
      eventBus.emit('sfx:drum', 'heavy'); // apparition d'un Catcher: impact lourd, menace immédiate
      logEvent(`👹 CATCHER MAJEUR détecté (${x},${y}) — force ${'⚠️'.repeat(strength)}. Préparez grenades hématiques et poches de sang.`, 'warn');
    }

export function buyConsumable(type) {
      const cost = type === 'blood_grenades' ? BALANCE.combat.bloodGrenadeCost : BALANCE.combat.bloodBagCost;
      const label = type === 'blood_grenades' ? 'Grenade hématique' : 'Poche de sang';
      if (game.money < cost) { logEvent(`❌ Budget ($${cost})`); return; }
      game.money -= cost;
      game.materials[type] = (game.materials[type] || 0) + 1;
      logEvent(`🩸 ${label} acquise (-$${cost})`);
      eventBus.emit('render:request');
    }

export function engageCatcher(catcherId) {
      const B = BALANCE.combat;
      const camp = (game.catchers || []).find(c => c.id === catcherId);
      if (!camp) return;
      const squad = game.porters
        .filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100)
        .slice(0, B.catcherSquadMaxSize);
      if (squad.length < B.catcherSquadMinSize) { logEvent(`❌ Minimum ${B.catcherSquadMinSize} porteurs requis pour affronter un Catcher`); return; }
      const grenadesNeeded = squad.length * B.catcherGrenadesPerPorter;
      if ((game.materials.blood_grenades || 0) < grenadesNeeded) {
        logEvent(`❌ ${grenadesNeeded} grenades hématiques requises (stock: ${game.materials.blood_grenades || 0})`);
        return;
      }
      game.materials.blood_grenades -= grenadesNeeded;
      const bloodBagsUsed = Math.min(game.materials.blood_bags || 0, squad.length);
      game.materials.blood_bags -= bloodBagsUsed;

      let successChance = B.catcherSuccessBase + squad.length * B.catcherSuccessPerSquadMember + grenadesNeeded * B.catcherSuccessPerGrenade - (camp.strength - 1) * B.catcherStrengthPenaltyMult;
      successChance += squad.reduce((s, p) => s + gradeLevel(p, 'combat'), 0) * B.catcherCombatGradeMult;
      successChance = Math.min(B.catcherSuccessCapMax, Math.max(B.catcherSuccessCapMin, successChance));

      // V1.2.0 — décision/résolution déterministe déléguée à CombatResolver.js (fonction pure,
      // headless-testable): CombatEngine.js ne fait plus que passer le contexte, consommer RNG.js via
      // ce même flux partagé (ordre de tirage inchangé bit-à-bit), puis appliquer le résultat.
      const result = resolveCatcherEncounter({ B, squadSize: squad.length, campStrength: camp.strength, bloodBagsUsed, successChance }, RNG);
      const d = game.mapsData[game.currentMap];
      d.catchers = d.catchers.filter(c => c.id !== catcherId);
      game.catchers = d.catchers;

      if (result.success) {
        game.materials.chiral_crystal += result.loot;
        game.reputation = Math.min(100, game.reputation + B.catcherWinReputationGain);
        eventBus.emit('sfx:brass', 1);
        logEvent(`🏆 CATCHER ABATTU (${squad.length} porteurs, ${bloodBagsUsed} poches de sang) — +${result.loot} cristaux chiraux, +${B.catcherWinReputationGain} réputation`, 'good');
      } else {
        let deaths = 0;
        squad.forEach((p, i) => {
          const outcome = result.outcomes[i];
          if (outcome.died) {
            p.status = 'dead';
            game.deaths++;
            deaths++;
            recordHallOfFame(p, 'dévoré par un Catcher');
          } else {
            p.health = Math.max(10, p.health - outcome.damage);
          }
        });
        game.reputation = Math.max(0, game.reputation - B.catcherFailReputationLoss);
        logEvent(`💀 ÉCHEC face au Catcher — ${deaths > 0 ? `${deaths} porteur(s) perdu(s)` : 'escouade blessée mais repliée'}, -${B.catcherFailReputationLoss} réputation`, 'death');
      }
      eventBus.emit('render:request');
    }
