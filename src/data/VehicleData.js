// data/VehicleData.js (V0.9.5) — statistiques STATIQUES des véhicules du loadout IRL. weightKg reste
// à 0 pour tous (on conduit un véhicule, on ne le porte pas dans le sac — n'affecte jamais
// BALANCE.loadout.maxWeightKg). stepEfficiencyMult multiplie la distance chirale couverte par pas
// IRL, appliqué exclusivement par RaidSystem.js — jamais lu directement par RealWalkSystem.js.
export const VEHICLES_DATA = {
      none: { id: 'none', name: 'À pied', icon: '🚶', weightKg: 0, stepEfficiencyMult: 1.0, cargoCapacityBonusKg: 0, cost: 0 },
      bike: { id: 'bike', name: 'Moto tout-terrain', icon: '🏍️', weightKg: 0, stepEfficiencyMult: 1.6, cargoCapacityBonusKg: 10, cost: 1500 },
      truck: { id: 'truck', name: 'Camion cargo', icon: '🚚', weightKg: 0, stepEfficiencyMult: 1.35, cargoCapacityBonusKg: 40, cost: 2000 },
      trike: { id: 'trike', name: 'Trike inversé', icon: '🏍️💨', weightKg: 0, stepEfficiencyMult: 1.9, cargoCapacityBonusKg: 5, cost: 1800 },
      chiral_truck: { id: 'chiral_truck', name: 'Truck Chiral', icon: '🛻', weightKg: 0, stepEfficiencyMult: 2.2, cargoCapacityBonusKg: 60, cost: 5000 }
    };
