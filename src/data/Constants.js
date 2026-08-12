// AUTO-EXTRACTED MODULE: data/Constants.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { currentRankIndex, game } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { HQ } from './Balance.js';
import { hireRaw } from '../systems/PorterSystem.js';

export const SKILLS = {
      driver: { name: '🚗 Chauffeur', dmg: -0.3, speed: 0.2, equip: 'vehicle' },
      scout: { name: '🗺️ Scout', speed: 0.3, range: 0.25, equip: 'scanner' },
      hauler: { name: '💪 Frappeur', carry: 0.4, dmg_resist: 0.2, equip: 'exo' },
      dooms: { name: '👁️ DOOMS', dmg: -0.1, sense: 0.35, equip: 'scanner' } // canon: sensibilité aux BT
    };

export const TRAITS = {
      ironback:        { name: '💪 Increvable', dmg_resist: 0.15 },
      clumsy:          { name: '🤕 Maladroit', dmg_resist: -0.15 },
      early_riser:     { name: '🌅 Lève-tôt', time_mult: 0.9 },
      nervous:         { name: '😰 Nerveux', stress_mult: 1.3 },
      chiral_affinity: { name: '✨ Affinité Chirale', xp_mult: 1.15 }
    };

export function rollTrait() {
      const keys = Object.keys(TRAITS);
      return keys[Math.floor(RNG.next() * keys.length)];
    }

export const STRUCTURES = {
      training: { name: 'Camp d\'entraînement', cost: 1500, maxLevel: 3, levelNames: ['Camp Basique', 'Camp Avancé', 'Centre d\'Excellence'] },
      shelter:  { name: 'Abri anti-BT', cost: 2000, maxLevel: 3, levelNames: ['Abri de fortune', 'Abri renforcé', 'Bunker chiral'] },
      depot:    { name: 'Dépôt chiral', cost: 1000, maxLevel: 3, levelNames: ['Dépôt local', 'Hub régional', 'Terminal chiral'] },
      zipline:  { name: 'Zipline chirale', cost: 2500, maxLevel: 3, levelNames: ['Zipline légère', 'Zipline renforcée', 'Réseau de ziplines'] },
      cauldron: { name: 'Chaudron chiral', cost: 1800, maxLevel: 1, levelNames: ['Chaudron actif'] },
      insurance: { name: 'Bureau d\'assurance chirale', cost: 1200, maxLevel: 3, levelNames: ['Bureau local', 'Bureau régional', 'Bureau international'] }
    };

export const GRADES = {
      portage:    { name: '📦 Portage' },
      combat:     { name: '⚔️ Combat' },
      discretion: { name: '👻 Discrétion' },
      service:    { name: '🤝 Service' },
      reseau:     { name: '🌐 Réseau' }
    };

export function gradeLevel(p, cat) { return Math.floor((p.grades[cat] || 0) / 25) + ((p.prestigeBonus && p.prestigeBonus[cat]) || 0); }

export const COUNTRIES = [
      { key: 'mexico', name: 'Mexique', flag: '🌎', bg: '#060504', grid: 'rgba(74,217,224,0.06)' },
      { key: 'australia', name: 'Australie', flag: '🌏', bg: '#1a0f08', grid: 'rgba(217,130,74,0.08)' },
      { key: 'france', name: 'France', flag: '🇫🇷', bg: '#0a0d16', grid: 'rgba(120,150,220,0.08)' },
      { key: 'japon', name: 'Japon', flag: '🇯🇵', bg: '#140a0c', grid: 'rgba(230,120,150,0.08)' }
    ];

export function countryInfo(key) { return COUNTRIES.find(c => c.key === key); }

export const EVENTS = [
      { id: 'bt', name: '👹 Gazers — présence BT', risk: 0.7, dmg: [14, 28], stress: 30, reward: -50 },
      { id: 'storm', name: '⛈️ Frappe Temporelle sauvage', risk: 0.5, dmg: [6, 13], stress: 20, reward: -30 },
      { id: 'equipment_fail', name: '⚠️ Corrosion timefall (équip.)', risk: 0.4, dmg: [10, 16], stress: 15, reward: -20 },
      { id: 'safe', name: '✅ Raccourci Chiral trouvé', risk: -0.3, dmg: 0, stress: -10, reward: 50 },
      { id: 'shelter_found', name: '🏠 Waystation providentielle', risk: -0.2, dmg: 0, stress: -15, reward: 0 },
      { id: 'ambush', name: '💥 Embuscade MULEs (vol de cargo)', risk: 0.8, dmg: [24, 40], stress: 40, reward: -70 }
    ];

export const CARGO_TYPES = {
      standard: { name: '📦 Standard', weight: 55, mass: 50, rewardMult: 1, timeMult: 1, riskMod: 0 },
      fragile:  { name: '🧊 Fragile', weight: 20, mass: 25, rewardMult: 1.25, timeMult: 1, riskMod: 0 },
      urgent:   { name: '⏱️ Urgent', weight: 15, mass: 20, rewardMult: 1.4, timeMult: 0.8, riskMod: 0.05 },
      heavy:    { name: '🏋️ Lourd', weight: 10, mass: 90, rewardMult: 1.55, timeMult: 1.25, riskMod: 0.05 }
    };

export const CARGO_COLORS = { standard: '#ff8c2b', fragile: '#7fd9ff', urgent: '#ffd23f', heavy: '#c76b4a' };

export const VEHICLE_SPEED = { truck: 0.7, bike: 0.7, trike: 0.55 };

export const VEHICLE_CAPACITY = { truck: 150, bike: 80, trike: 50 };

export function pickCargoType() {
      const entries = Object.entries(CARGO_TYPES);
      const total = entries.reduce((s, [, c]) => s + c.weight, 0);
      let r = RNG.next() * total;
      for (const [key, c] of entries) { r -= c.weight; if (r <= 0) return key; }
      return 'standard';
    }

export const TITLES = [
      { id: 'first_blood',  name: 'Premier Contact',      cond: g => g.completed >= 1,  reward: 200,  desc: 'Première livraison réussie' },
      { id: 'network_50',   name: 'Bâtisseur de Routes',  cond: g => Object.values(g.mapsData).reduce((s, d) => s + d.routes.size, 0) >= 50, reward: 500, desc: '50 cases de réseau chiral' },
      { id: 'survivor_y1',  name: 'Increvable',           cond: g => g.deaths === 0 && g.month >= 12, reward: 800, desc: '0 néantisation en 1 an' },
      { id: 'explorer',     name: 'Explorateur Chiral',   cond: g => Object.keys(g.mapsData).length >= 3, reward: 700, desc: '3 territoires connectés' },
      { id: 'legend_rank',  name: 'Légende Vivante',      cond: g => currentRankIndex() >= 4, reward: 1000, desc: 'Rang Légende du Rivage atteint' },
      { id: 'magnat',       name: 'Magnat Bridges',       cond: g => g.money >= 1000000, reward: 0, desc: '$1 000 000 en trésorerie' }
    ];

export const RECIPES = [
      { id: 'legendary_exo', name: '⚗️ Exo Légendaire', cost: { chiral_crystal: 5, mule_scrap: 3 }, needsPorter: true,
        effect: p => { p.legendaryBoost = (p.legendaryBoost || 0) + 0.1; }, desc: '+10% résistance dégâts, aucun slot consommé' },
      { id: 'rep_elixir',    name: '⚗️ Élixir de Réputation', cost: { chiral_crystal: 8 }, needsPorter: false,
        effect: () => { game.reputation = Math.min(100, game.reputation + 15); }, desc: '+15 réputation Bridges' },
      { id: 'scrap_cash',    name: '⚗️ Prime Chirale', cost: { mule_scrap: 6 }, needsPorter: false,
        effect: () => { game.money += 2000; }, desc: '+$2000' },
      // #Phase5 — 3 nouvelles recettes
      { id: 'chiral_battery', name: '🔋 Batterie Chirale', cost: { chiral_crystal: 4 }, needsPorter: false,
        effect: () => { const d = game.mapsData[game.currentMap]; (d.pccInstalls || []).forEach(p => { if (!p.ghost) p.durability = Math.min(100, (p.durability ?? 100) + 30); }); },
        desc: '+30% durabilité de toutes les PCC de la carte affichée' },
      { id: 'mule_decoy',     name: '🎭 Leurre MULE', cost: { mule_scrap: 4 }, needsPorter: false,
        effect: () => { const d = game.mapsData[game.currentMap]; (d.muleCamps || []).forEach(c => { if (c.status === 'hostile') c.strength = Math.max(1, c.strength - 1); }); },
        desc: '-1 force à tous les camps MULE hostiles de la carte (min. 1)' },
      { id: 'stamina_elixir', name: '💊 Élixir de Stamina', cost: { chiral_crystal: 2, mule_scrap: 2 }, needsPorter: true,
        effect: p => { p.health = 100; p.stress = 0; }, desc: 'Soigne complètement et réinitialise le stress du porteur ciblé' }
    ];

export const FESTIVALS = [
      { id: 'chiral_fest',  name: '🎉 Festival du Réseau Chiral', desc: '+30% reward quêtes/raids', effect: 'questMult', value: 1.3 },
      { id: 'safety_drive', name: '🛡️ Campagne de Sécurité Bridges', desc: '-20% risque BT/MULE', effect: 'riskCut', value: 0.2 },
      { id: 'trade_fair',   name: '💰 Foire commerciale', desc: '-15% coûts boutique', effect: 'shopDiscount', value: 0.15 },
      { id: 'moon_festival',name: '🌕 Veillée du Rivage', desc: '+20 réputation immédiate', effect: 'repBoost', value: 20 },
      { id: 'harvest_fest', name: '🌾 Récolte chirale', desc: '+15 réputation immédiate', effect: 'repBoost', value: 15 },
      { id: 'flash_sale',   name: '⚡ Braderie chirale éclair', desc: '-25% coûts boutique', effect: 'shopDiscount', value: 0.25 },
      { id: 'vigil_night',  name: '🕯️ Nuit de veille collective', desc: '-15% risque BT/MULE', effect: 'riskCut', value: 0.15 }
    ];

export const VISITOR_OFFERS = [
      { id: 'cheap_gear', name: '🧳 Marchand itinérant', desc: 'Cède un lot de matériaux contre $800', cost: 800,
        effect: () => { game.materials.chiral_crystal += 3; game.materials.mule_scrap += 2; } },
      { id: 'mercenary',  name: '🥾 Porteur en cavale', desc: 'Rejoint Bridges contre $600 (moins cher qu\'un recrutement classique)', cost: 600,
        effect: () => { hireRaw(); } },
      { id: 'buyback',    name: '♻️ Acheteur de ferraille', desc: 'Rachète toute ta ferraille MULE à bon prix', cost: 0,
        effect: () => { game.money += game.materials.mule_scrap * 150; game.materials.mule_scrap = 0; } },
      { id: 'rep_favor',  name: '🤝 Émissaire Bridges', desc: 'Coup de pouce réputation contre $500', cost: 500,
        effect: () => { game.reputation = Math.min(100, game.reputation + 10); } },
      { id: 'medic',      name: '⚕️ Médecin itinérant', desc: 'Soigne tout le roster contre $700', cost: 700,
        effect: () => { for (const p of game.porters) if (p.status !== 'dead' && p.status !== 'left') { p.health = 100; p.stress = 0; } } },
      { id: 'smuggler',   name: '🕶️ Contrebandier discret', desc: 'Vend un lot de cristaux chiraux contre $900', cost: 900,
        effect: () => { game.materials.chiral_crystal += 5; } },
      { id: 'informant',  name: '🗺️ Informateur', desc: 'Révèle une zone sûre, +10 réputation contre $400', cost: 400,
        effect: () => { game.reputation = Math.min(100, game.reputation + 8); } },
      { id: 'trainer',    name: '🏋️ Entraîneur itinérant', desc: 'Boost XP immédiat à tout le roster contre $650', cost: 650,
        effect: () => { for (const p of game.porters) if (p.status !== 'dead' && p.status !== 'left') p.xp += 30; } }
    ];

export const CAMP_TRAIT_LABELS = {
      training: '🏋️ Camp d\'Entraînement Intensif (+5% XP)',
      shelter:  '🛡️ Bastion Anti-BT (-3% risque)',
      depot:    '📦 Plaque Tournante Logistique (-3% coûts)',
      zipline:  '🌀 Hub Chiral (-3% temps réseau)',
      cauldron: '⚗️ Atelier Alchimique (+10% chance de butin)'
    };

export const FIRST_NAMES = [
      'Kael', 'Mira', 'Denny', 'Ilse', 'Cass', 'Renjiro', 'Nadia', 'Theo', 'Priya', 'Otis',
      'Sable', 'Ezra', 'Wren', 'Lucía', 'Bram', 'Odalys', 'Cassius', 'Ingrid', 'Tobias', 'Amara',
      'Rurik', 'Selby', 'Vesna', 'Idris', 'Marlow', 'Petra', 'Achille', 'Nkechi', 'Gideon', 'Saoirse'
    ];

export const LAST_NAMES = [
      'Ashford', 'Solheim', 'Okafor', 'Vantongeren', 'Whitlock', 'Sato', 'Brekhus', 'Marchetti', 'Ravindran', 'Cronqvist',
      'Duquette', 'Halvorsen', 'Adebayo', 'Ferreira', 'Steenkamp', 'Njoku', 'Solberg', 'Kwan', 'Diallo', 'Nystrom',
      'Okonkwo', 'Kovač', 'Larsen', 'Tanaka', 'Vilhjalmsdottir', 'Moreau', 'Osei', 'Reyes', 'Byrne', 'Yamamoto'
    ];

export function pickN(pool, n) {
      const copy = [...pool];
      const picked = [];
      for (let i = 0; i < n && copy.length; i++) {
        picked.push(copy.splice(Math.floor(RNG.next() * copy.length), 1)[0]);
      }
      return picked;
    }

export function cellKey(x, y) { return `${x},${y}`; }

export const KNOT_CITY_NAMES = [
      'Capital Knot City', 'South Knot City', 'Lake Knot City', 'Mountain Knot City',
      'Edge Knot City', 'Weather Station', 'Distribution Center', 'Waystation',
      "Chiral Artist's Studio", "Craftsman's Machine", 'Junk Dealer Camp', 'Prepper Shelter'
    ];

export const PREPPER_ARCHETYPES = {
      engineer: { name: 'Ingénieur', icon: '🔧', likesCargo: ['standard', 'heavy'], perk: 'structureDiscount', perkValue: 0.1,
        perkDesc: '-10% coût installations (relation ≥60⭐)' },
      medic:    { name: 'Médecin', icon: '⚕️', likesCargo: ['urgent'], perk: 'fastHeal', perkValue: 4,
        perkDesc: '+4 HP/mois pour les porteurs au repos (relation ≥60⭐)' },
      botanist: { name: 'Botaniste', icon: '🌱', likesCargo: ['fragile', 'standard'], perk: 'materialBonus', perkValue: 0.12,
        perkDesc: '+12% chance de butin (relation ≥60⭐)' },
      hermit:   { name: 'Ermite', icon: '🥾', likesCargo: [], perk: 'rareTech', perkValue: 1,
        perkDesc: 'Don mensuel de cristal chiral rare (relation ≥80⭐)' }
    };

export const NEED_LABELS = { medical: 'matériel médical', food: 'vivres', tech: 'pièces technologiques' };

export const QUEST_SUBJECTS = [
      'Un prepper isolé', 'Un ex-porteur Bridges', 'Une antenne isolée', 'Un fabricant local', 'Un poste MULE désaffecté',
      'Un chercheur du réseau chiral', 'Une caravane isolée', 'Un abri reculé', 'Un vétérinaire itinérant', 'Une famille de preppers',
      'Un ancien employé Bridges', 'Un artiste solitaire', 'Une station météo autonome', 'Un braconnier repenti', 'Un groupe de survivants',
      'Un ingénieur chiral', 'Une chapelle isolée', 'Un cartographe indépendant', 'Un médecin de fortune', 'Une colonie souterraine',
      'Un vieux gardien de phare', 'Une secte du Rivage', 'Un négociant clandestin', 'Une école improvisée'
    ];

export const QUEST_VERBS = ['réclame', 'demande', 'a besoin de', 'commande', 'sollicite', 'exige', 'implore', 'négocie'];

export const QUEST_OBJECTS = [
      'un colis urgent', 'des données chirales', 'des cryptobiotes', 'une pièce rare', 'un réapprovisionnement complet',
      'une livraison discrète', 'du matériel médical', 'des graines pour une serre', 'un prototype fragile',
      'des fournitures pour une veillée', 'des relevés cartographiques', 'un lot de pièces détachées',
      'des vivres pour l\'hiver', 'un générateur de secours', 'des BB Pods', 'un antidote expérimental'
    ];

export const QUEST_REASONS = [
      'contre BB Pods', 'avant la prochaine Frappe Temporelle', 'pour tenir encore un mois',
      'en échange d\'informations sur le réseau', 'discrètement, loin des regards',
      'avant que les MULEs ne reviennent', 'contre une bonne récompense', ''
    ];

export const ORDER_SUBJECTS = [
      'Le Direktor', 'Bridges HQ', 'Un porteur légendaire disparu', 'Une cellule de recherche chirale',
      'Le commandement régional', 'Une unité de reconnaissance', 'L\'archive centrale Bridges', 'Un réseau d\'informateurs'
    ];

export const ORDER_ACTIONS = [
      'réclame une extraction prioritaire', 'exige une livraison sous haute sécurité', 'commandite une opération coordonnée',
      'demande une reconnaissance immédiate', 'ordonne une escorte renforcée', 'sollicite une intervention d\'urgence'
    ];

export const ORDER_CONTEXTS = [
      'vers un bunker isolé', 'à travers un territoire hostile', 'dans une zone chirale instable',
      'avant que la fenêtre ne se referme', 'sous couverture totale', 'malgré les risques élevés de contact BT'
    ];

export const ROUTE_TYPES = {
      express:    { name: 'Route Chiral-Express', icon: '🛡️', desc: 'Sûre, plus longue', timeMult: 1.3, riskMod: -0.15 },
      shortcut:   { name: 'Raccourci Temporel', icon: '👹', desc: 'Rapide, zone BT', timeMult: 0.7, riskMod: 0.15 },
      contraband: { name: 'Passage Contrebande', icon: '🏴‍☠️', desc: 'Modéré, zone MULE', timeMult: 0.85, riskMod: 0.10 }
    };

export const PCC_TYPES = {
      generator: { name: 'Générateur Chiral', icon: '⚡', cost: 800, desc: '+revenu passif mensuel' },
      bridge:    { name: 'Pont PCC', icon: '🌉', cost: 700, desc: 'annule la pénalité rivière à proximité' },
      zipline:   { name: 'Tyrolienne PCC', icon: '🔗', cost: 900, desc: '-20% temps à proximité' }
    };

export const GHOST_NAMES = ['Sam-99', 'Fragile-Express', 'Deadman-Relay', 'Heartman-Loop', 'Higgs-Ghost', 'Mama-Line', 'Lou-Carrier'];

export const CRISIS_FLAVORS = [
      "Une poche de corruption chirale menace d'engloutir un hub entier",
      "Un porteur isolé signale une brèche BT incontrôlable",
      "Le Direktor exige une extraction immédiate avant collapse du réseau local",
      "Une cargaison de Chiralium pur doit être mise en sécurité avant la prochaine Frappe"
    ];

export const SQUAD_SYNERGIES = [
      { id: 'fast_escort',    name: '🗺️💪 Escorte Rapide',        need: ['scout', 'hauler'], desc: '-15% temps de trajet',      timeMult: 0.85 },
      { id: 'anti_bt_convoy', name: '👁️🚗 Convoi Anti-BT',        need: ['dooms', 'driver'], desc: '-20% risque BT',            riskCut: 0.2 },
      { id: 'strike_team',    name: '💪👁️ Équipe de Choc',        need: ['hauler', 'dooms'], desc: '+15% reward de raid',       rewardMult: 0.15 },
      { id: 'ghost_recon',    name: '🗺️🚗 Reconnaissance Fantôme', need: ['scout', 'driver'], desc: '-10% risque, trajet furtif', riskCut: 0.1 }
    ];

export const GRADE_TITLES = {
      portage: 'Porteur d\'Élite', combat: 'Vétéran de Guerre', discretion: 'Ombre du Rivage',
      service: 'Ambassadeur Bridges', reseau: 'Architecte du Réseau'
    };

export const RELICS = [
      { id: 'bb_pod_shard',       name: '🥚 Fragment de BB Pod', desc: 'Résonne faiblement au toucher.' },
      { id: 'higgs_mask_piece',   name: '🎭 Éclat de masque doré', desc: 'Une texture presque organique.' },
      { id: 'timefall_crystal',  name: '🌧️ Cristal de Timefall figé', desc: 'Ne vieillit jamais, contrairement à tout le reste.' },
      { id: 'mule_insignia',     name: '🏴 Insigne MULE rouillé', desc: 'Le symbole d\'un clan oublié.' },
      { id: 'presidential_seal', name: '🦅 Sceau présidentiel fragmenté', desc: 'Un vestige de l\'Amérique unifiée.' },
      { id: 'chiral_thread',     name: '🧵 Fil chiral tressé', desc: 'Vibre doucement en présence du réseau.' },
      { id: 'porters_ledger',    name: '📓 Registre d\'un porteur disparu', desc: 'Des noms, des dates, plus rien après une certaine page.' },
      { id: 'odradek_lens',      name: '🔮 Lentille d\'Odradek brisée', desc: 'Elle semble encore chercher quelque chose.' },
      { id: 'ashen_dogtag',      name: '🪖 Plaque militaire cendrée', desc: 'Illisible, sauf un prénom.' },
      { id: 'beach_shell',       name: '🐚 Coquillage du Rivage', desc: 'Il n\'y a pourtant pas d\'océan ici.' }
    ];

export const CAMP_EVENTS = [
      { id: 'flu', name: '🤒 Une grippe passe au camp', effect: () => {
        const actives = game.porters.filter(p => p.status !== 'dead' && p.status !== 'left');
        if (actives.length) {
          const sick = actives[Math.floor(RNG.next() * actives.length)];
          sick.health = Math.max(10, sick.health - 15);
        }
      } },
      { id: 'party', name: '🎊 Petite fête improvisée au camp', effect: () => {
        for (const p of game.porters) if (p.status !== 'dead' && p.status !== 'left') p.stress = Math.max(0, p.stress - 15);
      } },
      { id: 'equip_fail', name: '🔧 Panne d\'équipement mineure (réparation)', effect: () => { game.money = Math.max(0, game.money - 200); } },
      { id: 'lucky_find', name: '🍀 Trouvaille chanceuse dans les décombres', effect: () => { game.money += 400; } },
      { id: 'forgotten_pkg', name: '📦 Un colis oublié refait surface', effect: () => { game.materials.chiral_crystal += 1; } },
      { id: 'calm_weather', name: '🌧️ Une accalmie inhabituelle du Timefall', effect: () => { game.reputation = Math.min(100, game.reputation + 3); } },
      { id: 'howls', name: '🐺 Des hurlements distants inquiètent le camp', effect: () => {
        for (const p of game.porters) if (p.status !== 'dead' && p.status !== 'left') p.stress = Math.min(100, p.stress + 8);
      } },
      { id: 'radio_signal', name: '📻 Une vieille fréquence radio capte un message codé', effect: () => { game.materials.mule_scrap += 1; } },
      { id: 'tinkering', name: '🛠️ Un porteur bricole une amélioration de fortune', effect: () => {
        const idle = game.porters.filter(p => p.status === 'idle');
        if (idle.length) idle[Math.floor(RNG.next() * idle.length)].xp += 20;
      } },
      { id: 'sprout', name: '🌱 Une pousse improbable perce le sol chiral', effect: () => { game.reputation = Math.min(100, game.reputation + 1); game.money += 150; } }
    ];

export const SPONSORS = [
      { id: 'bridges_hq',   name: 'Bridges HQ', signingBonus: 1000, monthlyIncome: 100,
        cond: () => true, desc: 'Aucune condition (sponsor de base)' },
      { id: 'general_elec', name: 'Générale Électrique Chirale', signingBonus: 3000, monthlyIncome: 200,
        cond: () => game.reputation >= 40, desc: 'Maintenir réputation ≥ 40' },
      { id: 'chiral_corp',  name: 'Chiral Corp', signingBonus: 4000, monthlyIncome: 300,
        cond: () => currentRankIndex() >= 2, desc: 'Rang Bridges Certifié minimum' },
      { id: 'mule_repenti', name: 'Syndicat discret (ex-MULE repenti)', signingBonus: 5000, monthlyIncome: 50,
        cond: () => game.materials.mule_scrap >= 2, desc: 'Conserver ≥ 2 ferraille MULE en stock' }
    ];

export const SPLASH_TICKER_LINES = [
      'RÉSEAU CHIRAL: SYNCHRONISATION...',
      'DÉTECTION BT: SCANNER ODRADEK ACTIF',
      'STATUT PRÉPPERS: EN ATTENTE DE LIVRAISON',
      'ALERTE: FRAPPE TEMPORELLE POSSIBLE',
      'PONT AMÉRICAIN CHIRAL: EN CONSTRUCTION',
      'BB POD: SIGNAL STABLE',
      'BUREAU DU DIREKTOR: EN LIGNE',
      'AUCUNE TRACE DE MULES DÉTECTÉE'
    ];
