// data/ContractTemplates.js (V0.9.5) — templates STATIQUES des types de contrats de Relais. Purement
// des données: la génération elle-même (choix des routes, seed) vit dans
// systems/contracts/ContractGenerator.js. legCount fixe (nombre) ou [min,max] (tiré depuis
// BALANCE.multiStop via le générateur, jamais codé en dur ici).
// routeBias: influence UNIQUEMENT le choix de route parmi celles déjà connectables au territoire
// (contractsForRelay ci-contre trie routesForMap par regionMult, proxy existant de difficulté/risque
// — data/Routes.js — et pioche dans la moitié basse/haute selon ce biais) — jamais une nouvelle
// mécanique de temps/expiration greffée sur le pipeline ExpeditionSystem.js/RaidSystem.js existant.
export const CONTRACT_TYPES = {
      local: { id: 'local', name: 'Ordre Local', icon: '📦', legCount: 1, rewardMult: 1.0, routeBias: 'any' },
      longhaul: { id: 'longhaul', name: 'Long-Courrier', icon: '🛣️', legCount: 1, rewardMult: 1.2, routeBias: 'any' },
      multistop: { id: 'multistop', name: 'Expédition Multi-Étapes', icon: '🧭', legCount: 'multi', rewardMult: 1.0, routeBias: 'any' },
      // V1.3.0 — end-game: 2 types additifs qui varient récompense ET zone de risque réelle (pas
      // seulement cosmétique), pour le contenu procédural une fois les mainKnots tous raccordés.
      express: { id: 'express', name: 'Livraison Express', icon: '⚡', legCount: 1, rewardMult: 1.15, routeBias: 'low' },
      highrisk: { id: 'highrisk', name: 'Cargaison Sensible', icon: '🔥', legCount: 1, rewardMult: 1.45, routeBias: 'high' }
    };

export const CONTRACT_TYPE_LIST = Object.keys(CONTRACT_TYPES);
