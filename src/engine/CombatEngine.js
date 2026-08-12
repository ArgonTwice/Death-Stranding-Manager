// AUTO-EXTRACTED MODULE: engine/CombatEngine.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { currentRankIndex, game, logEvent } from '../core/GameState.js';
import { MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';
import { gradeLevel } from '../data/Constants.js';
import { recordHallOfFame } from '../systems/PorterSystem.js';
import { render } from '../ui/HUD.js';

export function assaultCamp(campId, mode) {
      const camp = (game.muleCamps || []).find(c => c.id === campId);
      if (!camp || camp.status !== 'hostile') return;
      const squad = game.porters
        .filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100)
        .slice(0, 3);
      if (squad.length === 0) { logEvent('❌ Aucun porteur disponible ici'); return; }

      // Chance de succès: base + taille d'escouade + stats pertinentes au mode choisi
      let successChance = 0.35 + squad.length * 0.15;
      if (mode === 'infiltration') {
        successChance += squad.filter(p => p.equipment.bolagun).length * 0.08;
        successChance += squad.reduce((s, p) => s + gradeLevel(p, 'discretion'), 0) * 0.03;
      } else {
        successChance += squad.reduce((s, p) => s + gradeLevel(p, 'combat'), 0) * 0.03;
        successChance += 0.15; // l'assaut létal est plus direct, plus fiable à effectif égal
      }
      successChance = Math.min(0.92, successChance) - (camp.strength - 1) * 0.1;

      const success = Math.random() < successChance;
      for (const p of squad) p.status = 'idle'; // ne mobilise pas de délivrance, résolution immédiate

      if (success) {
        camp.status = 'pacified';
        camp.safeUntilMonth = game.month + 3 + Math.floor(Math.random() * 4); // 3-6 mois
        const loot = camp.strength * (2 + Math.floor(Math.random() * 3));
        game.materials.mule_scrap += loot;
        if (mode === 'assault') {
          camp.needsIncineration = true;
          game.reputation = Math.max(0, game.reputation - 5); // violence létale, coût réputation temporaire
          eventBus.emit('sfx:brass', 0.9);
          logEvent(`💥 Camp MULE nettoyé par assaut létal (${squad.length} porteurs) — +${loot} ferraille MULE. Corps à envoyer à l'incinérateur.`, 'good');
        } else {
          eventBus.emit('sfx:brass', 0.7);
          logEvent(`🥷 Camp MULE pacifié par infiltration (${squad.length} porteurs) — +${loot} ferraille MULE, zone sûre ${camp.safeUntilMonth - game.month} mois`, 'good');
        }
      } else {
        const victim = squad[Math.floor(Math.random() * squad.length)];
        const dmg = 15 + Math.random() * 20;
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
      const cost = 300;
      if (game.money < cost) { logEvent(`❌ Budget incinération ($${cost})`); return; }
      game.money -= cost;
      camp.needsIncineration = false;
      logEvent(`🔥 Corps envoyés à l'incinérateur (-$${cost}) — zone assainie`, 'good');
      eventBus.emit('render:request');
    }

export function convertCampToRelay(campId) {
      const camp = (game.muleCamps || []).find(c => c.id === campId);
      if (!camp || camp.status !== 'pacified' || camp.needsIncineration) return;
      const cost = 1500;
      if (game.money < cost) { logEvent(`❌ Budget conversion ($${cost})`); return; }
      game.money -= cost;
      camp.status = 'relay';
      logEvent(`🏭 Camp converti en relais logistique (-$${cost}) — revenu passif permanent`, 'good');
      eventBus.emit('render:request');
    }

export function checkMuleCamps() {
      for (const key in game.mapsData) {
        const camps = game.mapsData[key].muleCamps || [];
        for (const c of camps) {
          if (c.status === 'pacified' && c.safeUntilMonth !== null && game.month >= c.safeUntilMonth && !c.needsIncineration) {
            c.status = 'hostile';
            c.safeUntilMonth = null;
            if (key === game.currentMap) logEvent(`🏴‍☠️ Un camp MULE s'est réinstallé (${c.x},${c.y})`, 'warn');
          }
          // Non-intervention: un relais resté sous attaque un mois entier sans défense retombe aux MULEs
          if (c.status === 'under_attack') {
            c.status = 'hostile';
            c.fortified = false;
            if (key === game.currentMap) logEvent(`💀 Le relais (${c.x},${c.y}) est tombé, faute de défense`, 'death');
          }
          // Contre-attaque MULE: ~8%/mois sur un relais non fortifié
          else if (c.status === 'relay' && !c.fortified && Math.random() < 0.08) {
            c.status = 'under_attack';
            logEvent(`⚠️ ATTENTION — Le relais logistique (${c.x},${c.y}) est sous attaque MULE !`, 'warn');
          }
          if (c.status === 'relay') game.money += c.strength * 40; // revenu passif mensuel
        }
        const generators = (game.mapsData[key].pccInstalls || []).filter(p => p.type === 'generator').length;
        if (generators > 0) game.money += generators * 60; // revenu passif mensuel des générateurs chiraux
      }
    }

export function defendRelay(campId) {
      const camp = (game.muleCamps || []).find(c => c.id === campId);
      if (!camp || camp.status !== 'under_attack') return;
      const squad = game.porters
        .filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100)
        .slice(0, 2);
      if (squad.length === 0) { logEvent('❌ Aucun porteur disponible pour défendre le relais'); return; }

      let successChance = 0.35 + squad.length * 0.2;
      successChance += squad.filter(p => p.equipment.bolagun).length * 0.1;
      successChance += squad.reduce((s, p) => s + gradeLevel(p, 'combat'), 0) * 0.04;
      successChance = Math.min(0.92, successChance) - (camp.strength - 1) * 0.08;

      if (Math.random() < successChance) {
        camp.status = 'relay';
        game.reputation = Math.min(100, game.reputation + 2);
        eventBus.emit('sfx:brass', 0.6);
        logEvent(`🛡️ Relais défendu avec succès (${squad.length} porteur${squad.length > 1 ? 's' : ''}) — +2 réputation`, 'good');
      } else {
        for (const p of squad) {
          const dmg = 10 + Math.random() * 20;
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
      const cost = 600;
      if (game.money < cost) { logEvent(`❌ Budget fortification ($${cost})`); return; }
      game.money -= cost;
      camp.fortified = true;
      logEvent(`🏰 Relais (${camp.x},${camp.y}) fortifié (-$${cost}) — immunisé contre les contre-attaques`, 'good');
      eventBus.emit('render:request');
    }

let catcherIdCounter = 0;

export function generateCatcherEncounter() {
      if (currentRankIndex() < 3) return; // rang Élite requis
      const d = game.mapsData[game.currentMap];
      if (!d.catchers) d.catchers = [];
      if (d.catchers.length > 0) return; // un seul Catcher actif à la fois par territoire
      if (Math.random() > 0.06) return;
      const x = Math.floor(Math.random() * MAP_WIDTH), y = Math.floor(Math.random() * MAP_HEIGHT);
      const strength = 1 + Math.floor(Math.random() * 3);
      d.catchers.push({ id: `catcher-${catcherIdCounter++}`, x, y, strength });
      if (d === game.mapsData[game.currentMap]) game.catchers = d.catchers;
      eventBus.emit('sfx:drum', 'heavy'); // apparition d'un Catcher: impact lourd, menace immédiate
      logEvent(`👹 CATCHER MAJEUR détecté (${x},${y}) — force ${'⚠️'.repeat(strength)}. Préparez grenades hématiques et poches de sang.`, 'warn');
    }

export function buyConsumable(type) {
      const cost = type === 'blood_grenades' ? 200 : 150;
      const label = type === 'blood_grenades' ? 'Grenade hématique' : 'Poche de sang';
      if (game.money < cost) { logEvent(`❌ Budget ($${cost})`); return; }
      game.money -= cost;
      game.materials[type] = (game.materials[type] || 0) + 1;
      logEvent(`🩸 ${label} acquise (-$${cost})`);
      eventBus.emit('render:request');
    }

export function engageCatcher(catcherId) {
      const camp = (game.catchers || []).find(c => c.id === catcherId);
      if (!camp) return;
      const squad = game.porters
        .filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100)
        .slice(0, 4);
      if (squad.length < 2) { logEvent('❌ Minimum 2 porteurs requis pour affronter un Catcher'); return; }
      const grenadesNeeded = squad.length * 2;
      if ((game.materials.blood_grenades || 0) < grenadesNeeded) {
        logEvent(`❌ ${grenadesNeeded} grenades hématiques requises (stock: ${game.materials.blood_grenades || 0})`);
        return;
      }
      game.materials.blood_grenades -= grenadesNeeded;
      const bloodBagsUsed = Math.min(game.materials.blood_bags || 0, squad.length);
      game.materials.blood_bags -= bloodBagsUsed;

      let successChance = 0.3 + squad.length * 0.12 + grenadesNeeded * 0.02 - (camp.strength - 1) * 0.15;
      successChance += squad.reduce((s, p) => s + gradeLevel(p, 'combat'), 0) * 0.03;
      successChance = Math.min(0.9, Math.max(0.1, successChance));

      const success = Math.random() < successChance;
      const d = game.mapsData[game.currentMap];
      d.catchers = d.catchers.filter(c => c.id !== catcherId);
      game.catchers = d.catchers;

      if (success) {
        const loot = camp.strength * (8 + Math.floor(Math.random() * 8));
        game.materials.chiral_crystal += loot;
        game.reputation = Math.min(100, game.reputation + 5);
        eventBus.emit('sfx:brass', 1);
        logEvent(`🏆 CATCHER ABATTU (${squad.length} porteurs, ${bloodBagsUsed} poches de sang) — +${loot} cristaux chiraux, +5 réputation`, 'good');
      } else {
        let deaths = 0;
        for (const p of squad) {
          const deathChance = 0.3 - bloodBagsUsed / squad.length * 0.15;
          if (Math.random() < deathChance) {
            p.status = 'dead';
            game.deaths++;
            deaths++;
            recordHallOfFame(p, 'dévoré par un Catcher');
          } else {
            p.health = Math.max(10, p.health - (25 + Math.random() * 25));
          }
        }
        game.reputation = Math.max(0, game.reputation - 10);
        logEvent(`💀 ÉCHEC face au Catcher — ${deaths > 0 ? `${deaths} porteur(s) perdu(s)` : 'escouade blessée mais repliée'}, -10 réputation`, 'death');
      }
      eventBus.emit('render:request');
    }
