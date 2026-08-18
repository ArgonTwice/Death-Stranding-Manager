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
  },
  // V0.5.0 — Legends & Procedural Soul Update
  story: {
    phobiaStressPerDay: 6, // par jour où la phobie du porteur est "déclenchée" par son environnement
    joyStressReliefPerDay: 4, // par jour où sa joie est satisfaite
    doomsDetectionMultPerLevel: 0.12, // par niveau de DOOMS (0-3), réduit la vitesse de détection BT
    talentGradeBonus: 3, // bonus de départ dans la catégorie de grade tirée par le talent initial
    journalHistoryCap: 15,
    milestoneCountForAcquiredTrait: 3 // nb de faits marquants du même type requis pour débloquer un Trait Acquis
  },
  league: {
    // 4 échelons Bronze/Argent/Or/Élite Chirale, seuils cumulatifs sur réputation + livraisons totales
    tierThresholds: [
      { minReputation: 0, minCompleted: 0 },
      { minReputation: 45, minCompleted: 15 },
      { minReputation: 65, minCompleted: 60 },
      { minReputation: 80, minCompleted: 180 }
    ],
    vipContractMinTier: 2, // Or minimum pour débloquer les contrats VIP des sponsors de prestige
    vipContractRewardMult: 2.2,
    vipContractSpawnChance: 0.1
  },
  regionalNetwork: {
    cost: 2500,
    bonusRewardMultPerRelay: 0.03, // cumulatif, plafonné à maxRelaysCounted
    bonusRiskCutPerRelay: 0.015,
    maxRelaysCounted: 5
  },
  legacy: {
    structureCarryOverFraction: 0.5, // NG+: fraction du niveau des installations reportée (schémas)
    hardcoreTimefallWeightMult: 1.6, // NG+ "Hardcore Timefall": multiplie les poids Timefall/Tempête Chirale du forecast
    legendMinLevel: 3, // seuil pour qu'un porteur du Hall of Fame devienne une "légende" persistée entre parties
    legendMinLikes: 20,
    hallOfFameCap: 25
  },
  // V0.6.0 — The Ultimate Memory Engine & Legacy Update
  memory: {
    significanceThreshold: 70, // en-dessous: l'événement reste un simple log, jamais un "souvenir majeur"
    scoreSRank: 40,
    scoreRaidSurvived: 30,
    scoreConvoyFullSuccess: 45,
    scorePorterDeath: 85,
    scoreLoyaltyUnlock: 35,
    scoreLegendRecorded: 90,
    scoreTraitAcquired: 30,
    chiralMemoryGainMajor: 5, // gagné à chaque souvenir majeur (score >= threshold)
    chiralMemoryGainMinor: 1, // petites contributions (ex: gratitude fantômes, cf. ChiralTraceSystem)
    connectionGainMajor: 8, // "Lien" du porteur concerné
    connectionGainMinor: 2,
    connectionCap: 100,
    majorMemoryHistoryCap: 20
  },
  terminal: {
    slowdownAfterMs: 10800000, // 3h de session continue -> ralentissement poétique ("Tu devrais dormir...")
    slowdownSpeedCap: 1, // vitesse de jeu plafonnée pendant le ralentissement
    longAbsenceMs: 21600000 // 6h d'absence réelle -> message d'accueil dédié
  },
  bbpod: {
    stressGainPerBtExposure: 10,
    stressDecayPerDayCalm: 4,
    connectionGainPerDelivery: 1,
    connectionGainPerMajorMemory: 6,
    louStageConnectionThreshold: 65, // au-delà: le BB Pod "devient" Lou (évolution narrative)
    detectionWarningExposureThreshold: 2, // btExposure à partir duquel bbpod:btDetected s'émet
    cautionDmgMult: 0.7, // choix "Prudence" sur l'alerte BB Pod: -30% dégâts si l'event se déclenche, +stress
    cautionStressCost: 5
  },
  museum: {
    slotCount: 5, // EXACTEMENT 5 — scellé pour toujours, jamais configurable en jeu
    reputationBonusPerRelic: 0.4 // impact mécanique volontairement minime (~90% narratif/émotionnel, cf. règle 3)
  },
  beach: {
    memoryConnectionBonus: 10, // choix "souvenir": Lien du porteur perdu figé dans la mémoire du réseau
    sequenceLineIntervalMs: 1800 // rythme d'apparition des lignes poétiques (cosmétique, jamais lu par la simulation)
  },
  worldAging: {
    pccDecayPerMonth: 3, // usure passive supplémentaire des PCC, indépendante des intempéries
    routeHistoricThreshold: 15, // livraisons cumulées sur une case pour devenir "Route Historique"
    historicRewardMult: 1.12,
    historicMuleAttentionAdd: 0.06
  },
  chiralTrace: {
    offlineLikesPerShelterPerDay: 1, // fantômes du réseau "utilisant" un abri hors-ligne
    gratitudeToChiralMemoryDivisor: 5,
    pilgrimGratitudeThreshold: 40,
    pilgrimRewardMult: 2.5,
    pilgrimSpawnChance: 0.15
  },
  memoryStorm: {
    cycleDays: 12,
    warningDaysBefore: 3,
    durabilityDamageBase: 25 // dégâts de durabilité PCC au pic de la tempête, atténués par la protection (couverture + musée)
  },
  narrativeLog: {
    telemetryChancePerTick: 0.06 // par tick de livraison solo (hors raid/convoi/quête), chance d'une ligne poétique
  },
  realWalk: {
    // V0.8.0 — conversion EXCLUSIVEMENT arithmétique (aucun RNG.js) des pas IRL validés en
    // ressources de jeu: franchissements de seuils sur game.totalSteps, jamais de valeur aléatoire.
    stepsPerChiralKm: 1250,
    stressReductionStepInterval: 500,
    stressReductionPct: 5, // points fixes retirés au stress BB Pod (échelle 0-100), pas un pourcentage multiplicatif
    chiraliumStepInterval: 5000,
    chiraliumPerInterval: 1,
    gratitudeStepInterval: 10000,
    gratitudePerInterval: 1,
    speedBonusPerChiralKm: 0.002, // -0.2% de temps de trajet par km chiral marché IRL, cumulatif
    speedBonusCap: 0.15, // jamais plus de -15% de temps, quel que soit le total de pas
    milestoneStepInterval: 100, // émet walk:milestone (toast UI) tous les 100 pas
    checkpointSaveStepInterval: 100, // sauvegarde silencieuse tous les 100 pas, jamais à chaque pas
    stepCooldownMs: 300, // anti-triche: délai minimal entre deux pas validés (StepDetector.js)
    maxPlausibleStepsPerMinute: 220 // au-delà: secouage frénétique, pas ignorés (StepDetector.js)
  },
  raid: {
    // V0.9.0 — Le Voyage du Porteur & Raids Tactiques. Un raidSeed unique est tiré du flux RNG.js
    // PARTAGÉ au lancement (Math.floor(RNG.next()*4294967296), même geste que porterSeed) — c'est la
    // SEULE consommation de RNG.js de tout le pipeline. Tout le reste (événements, détours) découle
    // exclusivement du générateur DÉRIVÉ de cette seed (RNG.deriveGenerator), jamais du flux partagé.
    checkpoints: [0.25, 0.5, 0.75], // fractions de baseDistanceSteps (fixe, ne bouge jamais) déclenchant un événement
    detourStepsMin: 200,
    detourStepsMax: 800,
    detourBonusCap: 0.25, // plafond anti-exploit: le bonus de récompense lié aux détours ne dépasse jamais +25%
    cargoDamagePerBadEvent: 0.15, // fraction d'intégrité cargo perdue par événement défavorable
    cargoStateFloor: 0.25, // l'intégrité cargo ne descend jamais sous ce plancher (toujours livrable)
    likesPerScorePoint: 0.08,
    chiraliumPerScorePoint: 0.004,
    muleScrapPerScorePoint: 0.002,
    reputationPerScorePoint: 0.006,
    xpPerScorePoint: 0.05,
    // Rang = detourBonusMult(<=1+detourBonusCap) x cargoState(>=cargoStateFloor) — indépendant de la
    // distance, donc comparable entre routes courtes et longues. Sinon: rang D.
    rankThresholds: { LEGENDARY: 1.15, S: 1.0, A: 0.85, B: 0.65, C: 0.45 }
  },
  // V0.9.5 — Relay Contract Boards, Personal Loadout & Field Construction. Tous les coefficients
  // d'équilibrage de la mise à jour vivent ici (règle 3) — aucun nombre magique dans les systèmes.
  loadout: {
    slots: ['boots', 'body', 'vehicle', 'pcc'],
    maxWeightKg: 40, // plafond du sac à dos (véhicule exclu, on le conduit/pousse, on ne le porte pas)
    cargoDamageReductionCap: 0.6 // jamais plus de -60% de dégâts cargo, toutes sources confondues (anti-exploit)
  },
  vehicles: {
    maxStepEfficiencyMult: 3.0 // plafond anti-exploit toutes sources confondues (bottes + corps + véhicule)
  },
  building: {
    pccMaterialCost: { chiral_crystal: 3 }, // coût de base (Abri); Relais/Générateur = multiples de ce coût
    shelterDurability: 100,
    relayDurability: 100,
    generatorDurability: 100,
    maxFieldStructuresPerRoute: 3, // anti-exploit: pas de mur de structures sur une seule route
    rewardMultPerFieldStructure: 0.03 // bonus passif de récompense par structure de terrain active sur la carte (porteurs PNJ)
  },
  multiStop: {
    contractsPerRelay: 3, // taille du tableau de contrats généré par relais/mois (ContractGenerator.js)
    legCountLocal: 1,
    legCountMultiStopMin: 2,
    legCountMultiStopMax: 3,
    rewardMultPerExtraLeg: 0.15 // bonus cumulatif de récompense finale d'expédition par étape au-delà de la première
  }
};
