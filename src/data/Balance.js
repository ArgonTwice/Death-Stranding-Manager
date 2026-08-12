// AUTO-EXTRACTED MODULE: data/Balance.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

export const RANKS = [
      { name: 'Freelance',        minCompleted: 0,    minRep: 0,  questMult: 1,    costMult: 1 },
      { name: 'Porteur Bridges',  minCompleted: 30,   minRep: 40, questMult: 1.15, costMult: 0.97 },
      { name: 'Porteur Certifié', minCompleted: 200,  minRep: 55, questMult: 1.3,  costMult: 0.94 },
      { name: 'Porteur d\'Élite', minCompleted: 900,  minRep: 65, questMult: 1.5,  costMult: 0.90 },
      { name: 'Légende du Rivage',minCompleted: 2800, minRep: 75, questMult: 1.75, costMult: 0.85 }
    ];

export const EQUIP_MIN_RANK = { cryptobiote: 1, bolagun: 1, cryobox: 1, climbing_anchor: 2 };

export const VEHICLE_MIN_RANK = { trike: 3 };

export const STRUCTURE_MIN_RANK = { zipline: 3 };

export const GAME_LENGTH_MONTHS = 60;

export const MAP_WIDTH = 10;

export const MAP_HEIGHT = 10;

export const GRID_SIZE = 60;

export const HQ = { x: 5, y: 5 };

export const DIFFICULTIES = {
      easy:   { label: '🟢 Facile', costMult: 0.85, riskMult: 0.85, startMoney: 13000 },
      normal: { label: '🟡 Normal', costMult: 1, riskMult: 1, startMoney: 10000 },
      hard:   { label: '🔴 Difficile', costMult: 1.15, riskMult: 1.15, startMoney: 8000 }
    };

export const DAY_MS = 1000;

export const DAYS_PER_MONTH = 30;

export const VEHICLE_MAINTENANCE_COST = { truck: 80, bike: 40, trike: 60 };
