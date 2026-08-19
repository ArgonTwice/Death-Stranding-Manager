// AUTO-EXTRACTED MODULE: systems/PorterSystem.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { game, logEvent, runtime } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, DIFFICULTIES } from '../data/Balance.js';
import { FIRST_NAMES, GRADES, GRADE_TITLES, LAST_NAMES, RELICS, SKILLS, TRAITS, VEHICLE_CAPACITY, countryInfo, gradeLevel, rollTrait } from '../data/Constants.js';
import { recordLegendIfEligible } from './LegacySystem.js';
import { acquiredTraitDmgResist, applyIdentityToPorter } from './PorterStorySystem.js';
import { hasTalent } from './PorterTalentTree.js';

export function gearEffectiveness(p) {
      const wear = p.gearWear || 0;
      return wear <= BALANCE.porter.gearEffectivenessWearThreshold ? 1 : Math.max(BALANCE.porter.gearEffectivenessMin, 1 - (wear - BALANCE.porter.gearEffectivenessWearThreshold) / BALANCE.porter.gearEffectivenessWearRange);
    }

export function repairGear(porterId) {
      const p = game.porters.find(x => x.id === porterId);
      if (!p) return;
      const wear = p.gearWear || 0;
      if (wear <= 0) { logEvent('❌ Équipement déjà en parfait état'); return; }
      const cost = Math.ceil(wear * BALANCE.porter.repairCostPerWearPoint);
      if (game.money < cost) { logEvent(`❌ Budget réparation ($${cost})`); return; }
      game.money -= cost;
      p.gearWear = 0;
      logEvent(`🔧 Équipement de ${p.name} réparé (-$${cost})`, 'good');
      eventBus.emit('render:request');
    }

export function porterCapacity(p) {
      return BALANCE.porter.capacityBase + p.equipment.exo * BALANCE.porter.capacityExoBonus + p.equipment.boots * BALANCE.porter.capacityBootsBonus
        + (SKILLS[p.skill].carry || 0) * BALANCE.porter.capacitySkillCarryMult
        + (VEHICLE_CAPACITY[p.equipment.vehicle] || 0)
        + gradeLevel(p, 'portage') * BALANCE.porter.capacityGradePortageMult // Porter Grade Portage (#4)
        + (hasTalent(p, 'heavyCarry') ? BALANCE.talents.heavyCarryCapacityBonus : 0); // V1.7.0 — Talent "Charge Lourde" (portage au niveau max)
    }

export function pickPorterName() {
      const used = new Set(game.porters.map(p => p.name));
      let name, tries = 0;
      do {
        name = `${FIRST_NAMES[Math.floor(RNG.next() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(RNG.next() * LAST_NAMES.length)]}`;
        tries++;
      } while (used.has(name) && tries < 20);
      return name;
    }

export function equipSlots(p) {
      return BALANCE.porter.equipSlotsBase + (p.skill === 'hauler' ? BALANCE.porter.equipSlotsHaulerBonus : 0) + Math.floor(p.level / BALANCE.porter.equipSlotsPerLevel) + (p.equipment.harness || 0);
    }

export function porterResist(p) {
      return Math.min(BALANCE.porter.resistCap, (SKILLS[p.skill].dmg_resist || 0) + (TRAITS[p.trait].dmg_resist || 0) + gradeLevel(p, 'combat') * BALANCE.porter.resistGradeCombatMult + (p.legendaryBoost || 0) + acquiredTraitDmgResist(p));
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
      p.health = Math.min(100, p.health + BALANCE.porter.forceRestHealthRestore);
      logEvent(`😴 ${p.name} repos forcé (-$${cost}) stress→0`);
      eventBus.emit('render:request');
    }

export function beachJump(porterIdx, destKey) {
      // Canon DS2: transponder / Plate Gate — téléportation d'un territoire à l'autre
      const p = game.porters[porterIdx];
      if (p.status !== "idle" || p.health <= 0 || !game.mapsData[destKey] || destKey === p.map) return;
      const cost = BALANCE.porter.beachJumpCost;
      if (game.money < cost) { logEvent(`❌ Budget Beach Jump ($${cost})`); return; }
      game.money -= cost;
      p.map = destKey;
      const d = game.mapsData[destKey];
      const spawn = d.branches[d.activeBranch] || d.branches[0];
      p.x = spawn.x; p.y = spawn.y;
      p.stress = Math.min(100, p.stress + BALANCE.porter.beachJumpStressIncrease);
      logEvent(`🌀 ${p.name} — Beach Jump → ${countryInfo(destKey).flag} ${countryInfo(destKey).name} (-$${cost})`);
      eventBus.emit('render:request');
    }

// V1.8.0 — jamais 'robot' dans le pool aléatoire de hireRaw()/scoutCandidate() ci-dessous: un Pod
// Robotique s'obtient UNIQUEMENT via systems/RobotBuddySystem.js#recruitRobotBuddy(), jamais un
// recrutement/scoutisme normal (qui restent 100% skills humains, comportement inchangé). Calculé
// PARESSEUSEMENT (jamais au niveau module): data/Constants.js importe hireRaw() d'ici (cycle DÉJÀ
// existant avant V1.8.0) — lire SKILLS au chargement du module échouerait tant que Constants.js n'a
// pas fini de s'initialiser (TDZ), vérifié empiriquement (ReferenceError avant ce correctif).
function randomHireSkillKeys() { return Object.keys(SKILLS).filter(k => k !== 'robot'); }

export function hireRaw(skill, trait, rare) {
      const id = game.porters.length;
      const skillKeys = randomHireSkillKeys();
      const s = skill || skillKeys[Math.floor(RNG.next() * skillKeys.length)];
      const t = trait || rollTrait();
      const branches = game.mapsData[game.currentMap].branches;
      const spawn = branches[game.mapsData[game.currentMap].activeBranch] || branches[0];
      game.porters.push({
        id, name: pickPorterName(), skill: s, trait: t, likes: 0,
        grades: { portage: 0, combat: 0, discretion: 0, service: 0, reseau: 0 }, map: game.currentMap,
        x: spawn.x, y: spawn.y, xp: rare ? BALANCE.porter.hireRareXp : 0, level: rare ? BALANCE.porter.hireRareLevel : 1, salary: Math.round((BALANCE.porter.hireBaseSalary + (rare ? BALANCE.porter.hireRareSalaryBonus : 0)) * DIFFICULTIES[game.difficulty || 'normal'].costMult),
        health: 100, stress: 0, status: "idle", gearWear: 0, connection: 0, credits: 0, // V1.9.0 — Porter Credits (systems/PorterEconomy.js)
        equipment: { boots: 0, exo: 0, scanner: 0, cryptobiote: 0, bolagun: 0, cryobox: 0, harness: 0, climbing_anchor: 0, vehicle: null }
      });
      applyIdentityToPorter(game.porters[id]); // V0.5.0: identité procédurale (background/phobie/joie/DOOMS/talent)
      return game.porters[id];
    }

export function scoutCandidate() {
      const activeCount = game.porters.filter(p => p.status !== "dead" && p.status !== "left").length;
      const fee = BALANCE.porter.scoutBaseFee + activeCount * BALANCE.porter.scoutFeePerActivePorter;
      if (game.money < fee) { logEvent(`❌ Budget scoutisme ($${fee})`); return; }
      game.money -= fee;
      const skillKeys = randomHireSkillKeys();
      const skill = skillKeys[Math.floor(RNG.next() * skillKeys.length)];
      const trait = rollTrait();
      const rare = RNG.next() < BALANCE.porter.scoutRareChance; // Kairosoft: chance de candidat "prometteur"
      game.scoutedCandidate = { skill, trait, rare };
      logEvent(`🔍 Candidat repéré: ${SKILLS[skill].name} ${TRAITS[trait].name}${rare ? ' ⭐ PROMETTEUR' : ''} (-$${fee})`);
      eventBus.emit('render:request');
    }

export function hire(fromScout) {
      const activeCount = game.porters.filter(p => p.status !== "dead" && p.status !== "left").length;
      const cost = BALANCE.porter.hireBaseCost + activeCount * BALANCE.porter.hireCostPerActivePorter; // scale sur effectif actif: licencier fait rebaisser le coût
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
      game.hallOfFame = game.hallOfFame.slice(0, 20); // garde les 20 plus récents (cette partie)
      recordLegendIfEligible(p, cause); // V0.5.0: mémorisation entre les parties (Hall of Fame interactif)
    }

export function retirePorter(id) {
      const p = game.porters.find(x => x.id === id);
      if (!p || p.status !== 'idle') { logEvent('❌ Le porteur doit être disponible (idle) pour partir à la retraite'); return; }
      if (p.level < BALANCE.porter.retireMinLevel) { logEvent(`❌ Niveau ${BALANCE.porter.retireMinLevel} requis pour la retraite`); return; }
      recordHallOfFame(p, 'retraité (légende)');
      game.legacyBonus = (game.legacyBonus || 0) + BALANCE.porter.retireLegacyBonusPerRetire; // +1% XP global, permanent, cumulatif

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
          heir.prestigeBonus[bestCat] = (heir.prestigeBonus[bestCat] || 0) + Math.max(1, Math.ceil(bestLvl / BALANCE.porter.retireHeirPrestigeDivisor));
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
      return bestLevel >= BALANCE.porter.titleMinGradeLevel ? GRADE_TITLES[best] : null; // titre affiché dès le niveau 2 (50 points)
    }

export function rollRelic() {
      if (RNG.next() > BALANCE.porter.relicDiscoveryChance) return;
      const notFound = RELICS.filter(r => game.activeRelicIds.includes(r.id) && !game.collection.includes(r.id));
      if (!notFound.length) return;
      const r = notFound[Math.floor(RNG.next() * notFound.length)];
      game.collection.push(r.id);
      game.money += BALANCE.porter.relicMoneyReward;
      logEvent(`🏺 RELIQUE DÉCOUVERTE: ${r.name} — ${r.desc} (+$${BALANCE.porter.relicMoneyReward})`, 'good');
    }
