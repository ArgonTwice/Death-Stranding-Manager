// AUTO-EXTRACTED MODULE: systems/PorterSystem.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { game, logEvent, runtime } from '../core/GameState.js';
import { DIFFICULTIES } from '../data/Balance.js';
import { FIRST_NAMES, GRADES, GRADE_TITLES, LAST_NAMES, RELICS, SKILLS, TRAITS, VEHICLE_CAPACITY, countryInfo, gradeLevel, rollTrait } from '../data/Constants.js';
import { render } from '../ui/HUD.js';

export function gearEffectiveness(p) {
      const wear = p.gearWear || 0;
      return wear <= 50 ? 1 : Math.max(0.3, 1 - (wear - 50) / 70);
    }

export function repairGear(porterId) {
      const p = game.porters.find(x => x.id === porterId);
      if (!p) return;
      const wear = p.gearWear || 0;
      if (wear <= 0) { logEvent('❌ Équipement déjà en parfait état'); return; }
      const cost = Math.ceil(wear * 5);
      if (game.money < cost) { logEvent(`❌ Budget réparation ($${cost})`); return; }
      game.money -= cost;
      p.gearWear = 0;
      logEvent(`🔧 Équipement de ${p.name} réparé (-$${cost})`, 'good');
      eventBus.emit('render:request');
    }

export function porterCapacity(p) {
      return 60 + p.equipment.exo * 20 + p.equipment.boots * 8
        + (SKILLS[p.skill].carry || 0) * 100
        + (VEHICLE_CAPACITY[p.equipment.vehicle] || 0)
        + gradeLevel(p, 'portage') * 5; // Porter Grade Portage (#4)
    }

export function pickPorterName() {
      const used = new Set(game.porters.map(p => p.name));
      let name, tries = 0;
      do {
        name = `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
        tries++;
      } while (used.has(name) && tries < 20);
      return name;
    }

export function equipSlots(p) {
      return 3 + (p.skill === 'hauler' ? 1 : 0) + Math.floor(p.level / 3) + (p.equipment.harness || 0);
    }

export function porterResist(p) {
      return Math.min(0.85, (SKILLS[p.skill].dmg_resist || 0) + (TRAITS[p.trait].dmg_resist || 0) + gradeLevel(p, 'combat') * 0.03 + (p.legendaryBoost || 0));
    }

export function equippedCount(p) {
      return p.equipment.boots + p.equipment.exo + p.equipment.scanner
        + p.equipment.cryptobiote + p.equipment.bolagun + p.equipment.cryobox + p.equipment.climbing_anchor;
    }

export function forceRest(porterIdx) {
      const p = game.porters[porterIdx];
      if (p.status !== "idle" || p.health <= 0) return;
      const cost = Math.ceil((p.salary / 2) * (1 + p.stress / 100)); // + cher si stress élevé
      if (game.money < cost) { logEvent(`❌ Budget repos ($${cost})`); return; }
      game.money -= cost;
      p.stress = 0;
      p.health = Math.min(100, p.health + 25);
      logEvent(`😴 ${p.name} repos forcé (-$${cost}) stress→0`);
      eventBus.emit('render:request');
    }

export function beachJump(porterIdx, destKey) {
      // Canon DS2: transponder / Plate Gate — téléportation d'un territoire à l'autre
      const p = game.porters[porterIdx];
      if (p.status !== "idle" || p.health <= 0 || !game.mapsData[destKey] || destKey === p.map) return;
      const cost = 400;
      if (game.money < cost) { logEvent(`❌ Budget Beach Jump ($${cost})`); return; }
      game.money -= cost;
      p.map = destKey;
      const d = game.mapsData[destKey];
      const spawn = d.branches[d.activeBranch] || d.branches[0];
      p.x = spawn.x; p.y = spawn.y;
      p.stress = Math.min(100, p.stress + 15);
      logEvent(`🌀 ${p.name} — Beach Jump → ${countryInfo(destKey).flag} ${countryInfo(destKey).name} (-$${cost})`);
      eventBus.emit('render:request');
    }

export function hireRaw(skill, trait, rare) {
      const id = game.porters.length;
      const skillKeys = Object.keys(SKILLS);
      const s = skill || skillKeys[Math.floor(Math.random() * skillKeys.length)];
      const t = trait || rollTrait();
      const branches = game.mapsData[game.currentMap].branches;
      const spawn = branches[game.mapsData[game.currentMap].activeBranch] || branches[0];
      game.porters.push({
        id, name: pickPorterName(), skill: s, trait: t, likes: 0,
        grades: { portage: 0, combat: 0, discretion: 0, service: 0, reseau: 0 }, map: game.currentMap,
        x: spawn.x, y: spawn.y, xp: rare ? 100 : 0, level: rare ? 2 : 1, salary: Math.round((300 + (rare ? 70 : 0)) * DIFFICULTIES[game.difficulty || 'normal'].costMult),
        health: 100, stress: 0, status: "idle", gearWear: 0,
        equipment: { boots: 0, exo: 0, scanner: 0, cryptobiote: 0, bolagun: 0, cryobox: 0, harness: 0, climbing_anchor: 0, vehicle: null }
      });
      return game.porters[id];
    }

export function scoutCandidate() {
      const activeCount = game.porters.filter(p => p.status !== "dead" && p.status !== "left").length;
      const fee = 150 + activeCount * 20;
      if (game.money < fee) { logEvent(`❌ Budget scoutisme ($${fee})`); return; }
      game.money -= fee;
      const skillKeys = Object.keys(SKILLS);
      const skill = skillKeys[Math.floor(Math.random() * skillKeys.length)];
      const trait = rollTrait();
      const rare = Math.random() < 0.15; // Kairosoft: chance de candidat "prometteur"
      game.scoutedCandidate = { skill, trait, rare };
      logEvent(`🔍 Candidat repéré: ${SKILLS[skill].name} ${TRAITS[trait].name}${rare ? ' ⭐ PROMETTEUR' : ''} (-$${fee})`);
      eventBus.emit('render:request');
    }

export function hire(fromScout) {
      const activeCount = game.porters.filter(p => p.status !== "dead" && p.status !== "left").length;
      const cost = 500 + activeCount * 250; // scale sur effectif actif: licencier fait rebaisser le coût
      if (game.money < cost) { logEvent(`❌ Budget insuffisant ($${cost})`); return; }
      if (fromScout && !game.scoutedCandidate) { logEvent('❌ Aucun candidat scouté'); return; }
      game.money -= cost;
      let skill, trait, rare = false;
      if (fromScout) {
        ({ skill, trait, rare } = game.scoutedCandidate);
        game.scoutedCandidate = null;
      }
      const p = hireRaw(skill, trait, rare);
      logEvent(`✅ ${SKILLS[p.skill].name} ${TRAITS[p.trait].name} ${rare ? '⭐ ' : ''}${p.name} (-$${cost})`);
      eventBus.emit('render:request');
    }

export function targetPorter() {
      const alive = p => p.status !== 'dead' && p.status !== 'left';
      if (runtime.selectedPorterId != null) {
        const p = game.porters.find(x => x.id === runtime.selectedPorterId && alive(x));
        if (p) return p;
      }
      return game.porters.find(p => alive(p) && p.map === game.currentMap) || game.porters.find(alive) || null;
    }

export function recordHallOfFame(p, cause) {
      game.hallOfFame.unshift({
        name: p.name, skill: p.skill, trait: p.trait, likes: p.likes, level: p.level,
        grades: { ...p.grades }, cause, month: game.month
      });
      game.hallOfFame = game.hallOfFame.slice(0, 20); // garde les 20 plus récents
    }

export function retirePorter(id) {
      const p = game.porters.find(x => x.id === id);
      if (!p || p.status !== 'idle') { logEvent('❌ Le porteur doit être disponible (idle) pour partir à la retraite'); return; }
      if (p.level < 5) { logEvent('❌ Niveau 5 requis pour la retraite'); return; }
      recordHallOfFame(p, 'retraité (légende)');
      game.legacyBonus = (game.legacyBonus || 0) + 0.01; // +1% XP global, permanent, cumulatif

      // Legs de prestige: le porteur actif le plus apprécié hérite de la moitié du grade dominant du retraité
      const heir = game.porters
        .filter(x => x.id !== p.id && x.status !== 'dead' && x.status !== 'left')
        .sort((a, b) => b.likes - a.likes)[0];
      let legacyMsg = '';
      if (heir) {
        let bestCat = null, bestLvl = 0;
        for (const c in GRADES) { const lvl = gradeLevel(p, c); if (lvl > bestLvl) { bestLvl = lvl; bestCat = c; } }
        if (bestCat && bestLvl > 0) {
          heir.prestigeBonus = heir.prestigeBonus || {};
          heir.prestigeBonus[bestCat] = (heir.prestigeBonus[bestCat] || 0) + Math.max(1, Math.ceil(bestLvl / 2));
          legacyMsg = ` — lègue son expertise ${GRADES[bestCat].name} à ${heir.name}`;
        }
      }
      p.status = 'left';
      logEvent(`🎖️ ${p.name} prend sa retraite${legacyMsg} — bonus permanent du camp +1% XP (total +${Math.round(game.legacyBonus * 100)}%)`, 'good');
      eventBus.emit('render:request');
    }

export function porterTitle(p) {
      let best = null, bestLevel = 0;
      for (const c in GRADES) {
        const lvl = gradeLevel(p, c);
        if (lvl > bestLevel) { bestLevel = lvl; best = c; }
      }
      return bestLevel >= 2 ? GRADE_TITLES[best] : null; // titre affiché dès le niveau 2 (50 points)
    }

export function rollRelic() {
      if (Math.random() > 0.05) return;
      const notFound = RELICS.filter(r => game.activeRelicIds.includes(r.id) && !game.collection.includes(r.id));
      if (!notFound.length) return;
      const r = notFound[Math.floor(Math.random() * notFound.length)];
      game.collection.push(r.id);
      game.money += 300;
      logEvent(`🏺 RELIQUE DÉCOUVERTE: ${r.name} — ${r.desc} (+$300)`, 'good');
    }
