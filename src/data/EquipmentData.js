// data/EquipmentData.js (V0.9.5, bonus RealWalk V1.5.0) — base de données STATIQUE du loadout IRL du
// joueur (Bottes, Corps, Kit PCC). Purement des données: aucune logique ici (cf.
// systems/player/PlayerLoadout.js pour les calculs). weightKg compte contre
// BALANCE.loadout.maxWeightKg ; stepEfficiencyMult multiplie la distance chirale couverte par pas IRL
// (appliqué exclusivement par RaidSystem.js, jamais ici). V1.5.0 ajoute timefallResistMult (Bottes —
// atténue les détours Timefall d'un Raid IRL, cf. systems/player/PlayerLoadout.js#
// loadoutTimefallResistMult, consommé par RaidSystem.js#applyCheckpointEvent). Un bonus de
// "réduction de fatigue par pas" générique a été envisagé pour RealWalkSystem.js mais volontairement
// écarté: ce module documente explicitement "jamais importé par RealWalkSystem.js/WalkSession.js
// (règle 1)" — contrainte architecturale respectée plutôt que contournée (déviation documentée dans
// le rapport de mission V1.5.0). Absente de "none": aucun bonus sans équipement.
export const BOOTS_DATA = {
      none: { id: 'none', slot: 'boots', name: 'Pieds nus', icon: '🦶', weightKg: 0, stepEfficiencyMult: 1.0, timefallResistMult: 0, cost: 0 },
      reinforced: { id: 'reinforced', slot: 'boots', name: 'Bottes renforcées', icon: '👢', weightKg: 1.5, stepEfficiencyMult: 1.08, timefallResistMult: 0.1, cost: 200 },
      chiral: { id: 'chiral', slot: 'boots', name: 'Bottes Chirales', icon: '✨', weightKg: 1.2, stepEfficiencyMult: 1.18, timefallResistMult: 0.25, cost: 600 }
    };

export const BODY_DATA = {
      none: { id: 'none', slot: 'body', name: 'Tenue légère', icon: '👕', weightKg: 0, stepEfficiencyMult: 1.0, cargoDamageReduction: 0, cost: 0 },
      exo: { id: 'exo', slot: 'body', name: 'Exosquelette', icon: '💪', weightKg: 6, stepEfficiencyMult: 1.05, cargoDamageReduction: 0.15, cost: 400 },
      exo_adv: { id: 'exo_adv', slot: 'body', name: 'Exosquelette Avancé', icon: '🦾', weightKg: 8, stepEfficiencyMult: 1.1, cargoDamageReduction: 0.3, cost: 900 }
    };

export const PCC_KIT_DATA = {
      none: { id: 'none', slot: 'pcc', name: 'Aucun kit PCC', icon: '📦', weightKg: 0, enablesBuild: false, cost: 0 },
      field_kit: { id: 'field_kit', slot: 'pcc', name: 'Kit PCC de terrain', icon: '🏗️', weightKg: 8, enablesBuild: true, cost: 800 }
    };

export function equipmentTableFor(slot) {
      return { boots: BOOTS_DATA, body: BODY_DATA, pcc: PCC_KIT_DATA }[slot] || null;
    }
