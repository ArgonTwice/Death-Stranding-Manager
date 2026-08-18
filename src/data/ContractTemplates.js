// data/ContractTemplates.js (V0.9.5) — templates STATIQUES des types de contrats de Relais. Purement
// des données: la génération elle-même (choix des routes, seed) vit dans
// systems/contracts/ContractGenerator.js. legCount fixe (nombre) ou [min,max] (tiré depuis
// BALANCE.multiStop via le générateur, jamais codé en dur ici).
export const CONTRACT_TYPES = {
      local: { id: 'local', name: 'Ordre Local', icon: '📦', legCount: 1, rewardMult: 1.0 },
      longhaul: { id: 'longhaul', name: 'Long-Courrier', icon: '🛣️', legCount: 1, rewardMult: 1.2 },
      multistop: { id: 'multistop', name: 'Expédition Multi-Étapes', icon: '🧭', legCount: 'multi', rewardMult: 1.0 }
    };

export const CONTRACT_TYPE_LIST = Object.keys(CONTRACT_TYPES);
