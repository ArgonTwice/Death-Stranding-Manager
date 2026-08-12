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

// BALANCE — valeurs d'équilibrage numériques extraites de engine/ et systems/ (coûts, taux, seuils,
// multiplicateurs). Regroupées par système pour que chaque fichier n'importe que sa propre section.
// Les constantes purement structurelles (tailles de grille, formats de sauvegarde...) restent au-dessus.
export const BALANCE = {
  porter: {
    gearEffectivenessWearThreshold: 50, // au-delà de cette usure %, l'équipement perd en efficacité
    gearEffectivenessMin: 0.3,
    gearEffectivenessWearRange: 70,
    repairCostPerWearPoint: 5,
    capacityBase: 60,
    capacityExoBonus: 20,
    capacityBootsBonus: 8,
    capacitySkillCarryMult: 100,
    capacityGradePortageMult: 5,
    equipSlotsBase: 3,
    equipSlotsHaulerBonus: 1,
    equipSlotsPerLevel: 3,
    resistCap: 0.85,
    resistGradeCombatMult: 0.03,
    forceRestHealthRestore: 25,
    beachJumpCost: 400,
    beachJumpStressIncrease: 15,
    hireBaseSalary: 300,
    hireRareSalaryBonus: 70,
    hireRareXp: 100,
    hireRareLevel: 2,
    scoutBaseFee: 150,
    scoutFeePerActivePorter: 20,
    scoutRareChance: 0.15,
    hireBaseCost: 500,
    hireCostPerActivePorter: 250,
    retireMinLevel: 5,
    retireLegacyBonusPerRetire: 0.01,
    retireHeirPrestigeDivisor: 2,
    titleMinGradeLevel: 2,
    relicDiscoveryChance: 0.05,
    relicMoneyReward: 300
  },
  prepper: {
    startRelationBase: 25,
    startRelationRandRange: 15,
    startNeedBase: 20,
    startNeedRandRange: 30,
    needsGrowthBase: 3,
    needsGrowthRandRange: 4,
    needsCriticalThreshold: 90,
    needsCriticalRelationDecay: 2,
    contractMaxSimultaneous: 2,
    contractBaseChance: 0.2,
    contractHighRelationBonusChance: 0.1,
    contractHighRelationThreshold: 60,
    contractRewardBase: 250,
    contractRewardRandRange: 350,
    contractRewardRelationDivisor: 150,
    contractExpiryBaseMonths: 2,
    contractExpiryRandRangeMonths: 2,
    contractNegotiableChance: 0.4,
    hermitGiftRelationThreshold: 80,
    perkRelationThreshold: 60,
    relationGainMin: 2,
    relationGainLikesMult: 0.6,
    relationGainNoRating: 4,
    relationLossOnFailure: 8,
    contractNeedFulfillBase: 50,
    contractNeedFulfillRandRange: 20,
    negotiateBaseChance: 0.4,
    negotiateRelationDivisor: 200,
    negotiateBonusBase: 0.15,
    negotiateBonusRandRange: 0.15,
    negotiateFailRelationLoss: 3,
    connectKnotCostPerCell: 300,
    assignContractRiskCut: 0.05,
    starsRelationDivisor: 20,
    starsMax: 5
  },
  weather: {
    timefallDurationMs: 4000,
    timefallDropCount: 120,
    timefallGearWearBase: 6,
    timefallGearWearRandRange: 6,
    timefallPccDegradeBase: 8,
    timefallPccDegradeRandRange: 8,
    duststormDurationMs: 4000,
    duststormParticleCount: 90,
    duststormPccDegradeBase: 5,
    duststormPccDegradeRandRange: 6,
    muleCampEmboldenChance: 0.3,
    muleCampEmboldenStrengthCap: 3,
    riskModTimefall: 0.12,
    riskModDuststorm: 0.08,
    weatherDurationMonths: 1,
    needMultTimefallMedical: 2.5,
    needMultTimefallOther: 1.3,
    needMultDuststormTech: 1.8,
    needMultDuststormOther: 1.2
  },
  combat: {
    assaultSquadMaxSize: 3,
    assaultSuccessBase: 0.35,
    assaultSuccessPerSquadMember: 0.15,
    infiltrationBolagunBonus: 0.08,
    infiltrationDiscretionGradeMult: 0.03,
    assaultCombatGradeMult: 0.03,
    assaultDirectBonus: 0.15,
    assaultSuccessCap: 0.92,
    assaultStrengthPenaltyMult: 0.1,
    pacifySafeMonthsBase: 3,
    pacifySafeMonthsRandRange: 4,
    assaultLootBase: 2,
    assaultLootRandRange: 3,
    lethalAssaultReputationLoss: 5,
    assaultFailDamageBase: 15,
    assaultFailDamageRandRange: 20,
    incineratorCost: 300,
    relayConversionCost: 1500,
    relayCounterAttackChance: 0.08,
    relayIncomePerStrength: 40,
    generatorIncomePerUnit: 60,
    defendSquadMaxSize: 2,
    defendSuccessBase: 0.35,
    defendSuccessPerSquadMember: 0.2,
    defendBolagunBonus: 0.1,
    defendCombatGradeMult: 0.04,
    defendSuccessCap: 0.92,
    defendStrengthPenaltyMult: 0.08,
    defendReputationGain: 2,
    defendFailDamageBase: 10,
    defendFailDamageRandRange: 20,
    fortifyRelayCost: 600,
    catcherMinRank: 3,
    catcherSpawnChance: 0.06,
    catcherStrengthBase: 1,
    catcherStrengthRandRange: 3,
    bloodGrenadeCost: 200,
    bloodBagCost: 150,
    catcherSquadMaxSize: 4,
    catcherSquadMinSize: 2,
    catcherGrenadesPerPorter: 2,
    catcherSuccessBase: 0.3,
    catcherSuccessPerSquadMember: 0.12,
    catcherSuccessPerGrenade: 0.02,
    catcherStrengthPenaltyMult: 0.15,
    catcherCombatGradeMult: 0.03,
    catcherSuccessCapMax: 0.9,
    catcherSuccessCapMin: 0.1,
    catcherLootBase: 8,
    catcherLootRandRange: 8,
    catcherWinReputationGain: 5,
    catcherDeathChanceBase: 0.3,
    catcherDeathChanceBloodBagMult: 0.15,
    catcherFailDamageBase: 25,
    catcherFailDamageRandRange: 25,
    catcherFailReputationLoss: 10
  },
  map: {
    expansionCostBase: 2500,
    expansionCostGrowth: 1.7,
    subsidiaryCostMult: 0.7,
    subsidiaryLegacyBonus: 0.005,
    branchCostBase: 2500,
    branchCostGrowth: 1.6,
    branchMinDistance: 3,
    branchMaxTries: 25,
    mountainChanceThreshold: 0.10,
    riverChanceThreshold: 0.18,
    btZoneChance: 0.15,
    muleCampCountBase: 2,
    muleCampCountRandRange: 2,
    muleCampMaxTries: 200,
    muleCampMinDistanceFromHQ: 3,
    muleCampMinDistanceBetween: 3,
    muleCampStrengthBase: 1,
    muleCampStrengthRandRange: 3,
    hostileCampProximityRadius: 1.3,
    shelterBtNeutralizeRadiusMult: 2,
    mainKnotCount: 4,
    mainKnotMaxTries: 300,
    mainKnotMinDistanceFromHQ: 2.5,
    mainKnotMinDistanceBetween: 2.5,
    pathfindingBtZoneCostMult: 2.5
  },
  network: {
    pccProximityRadius: 1.5,
    pccCostScalingPerExisting: 0.4,
    pccRepairCostPerDurabilityPoint: 4,
    ghostSpawnMinRank: 1,
    ghostSpawnChance: 0.1,
    ghostTypeBridgeChance: 0.5,
    ghostExpiryBaseMonths: 2,
    ghostExpiryRandRangeMonths: 3,
    lostCargoSpawnChance: 0.12,
    lostCargoRewardBase: 150,
    lostCargoRewardRandRange: 250,
    lostCargoExpiryMonths: 3,
    communityDonationChance: 0.25,
    asyncLikesChance: 0.3,
    asyncLikesBase: 3,
    asyncLikesRandRange: 8,
    asyncReputationGain: 1
  },
  economy: {
    depotDominantDiscount: 0.03,
    depotStructureDiscountPerLevel: 0.05,
    equipMaxPerType: 2,
    equipCostScalingPerBought: 0.2,
    vehicleCostScalingPerBought: 0.25,
    equipBaseCosts: { boots: 200, exo: 400, scanner: 300, cryptobiote: 150, bolagun: 350, cryobox: 250, harness: 350, climbing_anchor: 300 },
    vehicleBaseCosts: { truck: 2000, bike: 1500, trike: 1800 },
    infraCostBase: 50000,
    infraCostGrowth: 1.18,
    infraMinRankIndex: 3,
    subsidyBase: 500,
    subsidyDecayPerMonth: 15,
    structureCostGrowthPerLevel: 0.8
  },
  delivery: {
    voidoutCrystalBonusBase: 200,
    voidoutCrystalBonusRepMult: 3,
    buildRouteBaseCost: 600,
    buildRouteCostPerRouteCell: 0.15,
    specialOrderMinRank: 2,
    specialOrderSpawnChance: 0.08,
    specialOrderRewardBase: 1200,
    specialOrderRewardRandRange: 800,
    specialOrderExpiryMonths: 2,
    specialOrderMinSquad: 2,
    sideQuestBaseMaxQuests: 2,
    sideQuestMaxQuestsRankDivisor: 2,
    sideQuestSpawnChance: 0.35,
    sideQuestRewardBase: 300,
    sideQuestRewardRandRange: 300,
    sideQuestReputationDivisor: 150,
    sideQuestExpiryBaseMonths: 3,
    sideQuestExpiryRandRangeMonths: 3,
    squadBonusPerMember: 0.2,
    squadRiskCutCap: 0.3,
    squadRiskCutPerMember: 0.1,
    crisisMinRank: 3,
    crisisSpawnChance: 0.05,
    crisisRewardBase: 2500,
    crisisRewardRandRange: 1500,
    crisisChiralBonusBase: 15,
    crisisChiralBonusRandRange: 20,
    crisisExpiryMonths: 1,
    crisisMinSquad: 3,
    festivalMonthInterval: 4,
    festivalSpawnChance: 0.5,
    festivalDurationBase: 2,
    festivalDurationRandRange: 2,
    visitorSpawnChance: 0.2,
    visitorExpiryMonths: 2,
    bondPerRaidBonus: 0.02,
    bondBonusCap: 10,
    duoRewardBonus: 0.1,
    duoRiskCutBonus: 0.05,
    duoFormationThreshold: 8,
    campEventSpawnChance: 0.15,
    riskBase: 0.24,
    riskDistanceDivisor: 15,
    riskDistanceMult: 0.32,
    scannerRiskMult: 0.15,
    exoRiskMult: 0.1,
    discretionGradeRiskMult: 0.04,
    skillDmgRiskMult: 0.1,
    cryptobioteRiskMult: 0.05,
    shelterRiskMultPerLevel: 0.15,
    btZoneRiskAdd: 0.35,
    muleCampRiskAdd: 0.15,
    onRouteRiskCut: 0.15,
    riskFloor: 0.08,
    riskCeil: 1,
    serviceGradeRewardMult: 0.05,
    rewardDistanceMult: 100,
    reputationRewardDivisor: 100,
    vehicleRewardMult: 1.5,
    infraRewardMultPerInvestment: 0.002,
    overloadThreshold: 0.9,
    overloadRiskMult: 0.6,
    shelterDominantRiskCut: 0.03,
    onRouteTimeBase: 0.7,
    onRouteTimeFloor: 0.4,
    onRouteReseauGradeMult: 0.03,
    ziplineStructureTimeMultPerLevel: 0.08,
    ziplineDominantTimeMult: 0.97,
    ziplinePccTimeMult: 0.8,
    heavyCargoNoVehicleTimeMult: 1.15,
    overloadTimeMult: 0.5,
    mountainTimeMult: 0.35,
    riverTimeMult: 0.2,
    terrainAnchorMitigation: 0.5,
    maxStepsDistanceMult: 2,
    ghostPccProximityRadius: 1.5,
    tickGearWearBase: 1,
    tickGearWearRandRange: 2,
    bolagunDmgMult: 0.5,
    heavyCargoDmgMult: 1.2,
    conditionDmgMult: 0.8,
    btLootChance: 0.4,
    ambushLootChance: 0.35,
    fragileInsuranceMitPerLevel: 0.15,
    fragileCryoboxShield: 0.1,
    fragileLossMult: 0.4,
    fragileConditionLoss: 30,
    urgentInsuranceRewardMult: 0.25,
    cryptobioteStressMitPerUnit: 8,
    detectionRatePerExposure: 8,
    detectionScannerMult: 0.3,
    detectionDiscretionGradeMult: 0.1,
    detectionThreshold: 100,
    detectionDmgBase: 10,
    detectionDmgRandRange: 15,
    detectionExoMult: 0.7,
    detectionConditionMult: 0.6,
    deathReputationLoss: 15,
    successStressRecover: 20,
    successHealthRecover: 10,
    cargoFailedXpGain: 5,
    cargoFailedReputationLoss: 3,
    xpGainBase: 15,
    xpGainRandRange: 10,
    trainingXpMultPerLevel: 0.15,
    trainingDominantXpMult: 1.05,
    onRouteXpMult: 1.5,
    highStressXpMult: 0.8,
    highStressThreshold: 80,
    sRankReputationGain: 2,
    deliveryReputationGain: 3,
    levelUpXpPerLevel: 50,
    levelUpSalaryIncrease: 70,
    firingReputationLoss: 10,
    idleHealRate: 6,
    timefallChance: 0.2,
    duststormChanceUpper: 0.32,
    ratingSGradeThreshold: 90,
    ratingAGradeThreshold: 70,
    ratingBGradeThreshold: 40,
    ratingSLikes: 25,
    ratingALikes: 15,
    ratingBLikes: 8,
    ratingCLikes: 3
  },
  // V0.3.0 — Survival & Narrative Loop Update
  weatherSystem: {
    forecastDays: 3, // jours de prévision Chiral affichés au joueur, toujours exacts (canon DS)
    calmWeight: 55,
    timefallWeight: 30,
    chiralStormWeight: 15 // "Tempête Chirale" ⛈️ — habillage de la Duststorm existante
  },
  timefall: {
    speedPenaltyUnsheltered: 0.35, // +35% temps de trajet si arrivée non protégée pendant un Timefall actif
    medicalDemandMult: 1.8, // +80% demande médicale prepper Médecin pendant le Timefall
    botanistDemandMult: 1.4 // +40% demande botaniste (graines/culture fragilisées par la corrosion)
  },
  shelter: {
    protectionRadius: 1.5, // rayon (cases) dans lequel un Abri Anti-Timefall protège porteurs/PCC
    // V0.4.0 — Abri Chiral Avancé: même protection Timefall que l'abri de base, + réparation auto
    advancedCost: 1800,
    advancedProtectionRadius: 2,
    advancedRepairPerDay: 8 // réduction d'usure/jour pour les porteurs (véhicule compris) dans le rayon
  },
  quest: {
    maxActiveUrgent: 3,
    weatherSpawnChance: 0.35, // chance qu'une quête urgente apparaisse à l'arrivée d'un Timefall/Tempête Chirale
    reputationSpawnChanceBase: 0.05, // chance quotidienne indépendante de la météo
    reputationSpawnThreshold: 60, // au-delà de cette réputation, la chance de base augmente
    reputationSpawnBonusChance: 0.06,
    expiryDaysBase: 4,
    expiryDaysRandRange: 4,
    rewardBase: 400,
    rewardRandRange: 500,
    rewardReputationDivisor: 150,
    negotiateRewardBonusBase: 0.2,
    negotiateRewardBonusRandRange: 0.25,
    negotiateTimeCutBase: 0.12,
    negotiateTimeCutRandRange: 0.13,
    negotiateRiskAddBase: 0.06,
    negotiateRiskAddRandRange: 0.08,
    acceptLoyaltyGain: 2,
    successLoyaltyGain: 6,
    failLoyaltyLoss: 8,
    refuseLoyaltyLoss: 4,
    refuseUrgentMedicalLoyaltyLoss: 12,
    loyaltySchemaUnlockThreshold: 70
  },
  // V0.4.0 — Heavy Logistics & Convoys Update
  risk: {
    baseSignature: 0.05, // signature chirale plancher, même pour un porteur seul à vide
    weightSignatureMult: 0.0012, // par unité de masse de cargo (cargo.mass)
    vehicleSignatureBonus: 0.06, // un véhicule est plus visible/bruyant qu'un porteur à pied
    techSignatureMult: 0.025, // par pièce d'équipement "actif" (scanner/bolagun/cryobox/ancre)
    signatureRiskMult: 1 // conversion signature -> contribution au risque (même échelle 0-1 que riskMod)
  },
  convoy: {
    maxEscorts: 3, // + 1 porteur-véhicule = 4 membres max
    rewardSharePerEscort: 0.16, // même logique que squadBonusPerMember (DeliveryEngine)
    riskCutPerEscort: 0.07,
    riskCutCap: 0.21,
    strategies: {
      fast:     { timeMult: 0.85, gearWearMult: 1.2 },                  // 🚚 Rapide: +15% vitesse, +20% usure
      secure:   { timeMult: 1.1, dmgMult: 0.6, riskCut: 0.18 },          // 🛡️ Sécurisé: -10% vitesse, moins de dégâts/embuscades
      economic: { rewardMult: 1.35, signatureMult: 1.5 }                // 💰 Économique: +35% récompense, signature maximale
    }
  },
  telemetry: {
    historyCap: 30
  }
};
