// data/UnlockTree.js (V1.5.0) — table STATIQUE des seuils d'étoiles Prepper (maxPrepperStars,
// systems/PrepperSystem.js) requis pour débloquer l'équipement/les véhicules LOURDS de la Boutique du
// Camp (systems/EconomySystem.js#buyEquip/buyVehicle). Purement des données, aucune logique ici.
// ADDITIF au système de rang existant (EQUIP_MIN_RANK/VEHICLE_MIN_RANK, data/Balance.js): les deux
// conditions doivent être remplies, ni l'une ni l'autre ne remplace l'autre.
//
// Portée volontairement limitée à cette Boutique: le loadout IRL du joueur
// (systems/player/PlayerLoadout.js, data/EquipmentData.js — Bottes/Corps/Kit PCC du Raid IRL, dont
// l'Exosquelette "exo"/"exo_adv" DE CE système-là) est un choix gratuit parmi une liste fixe, jamais
// un achat — aucune "boutique" à gater là, ce n'est pas le même système que l'Exosquelette de
// porter.equipment ci-dessous malgré le nom partagé.
//
// Un type absent de cette table n'a AUCUN seuil d'étoiles (0) — c'est le cas de tout l'équipement
// léger déjà accessible dès le début (boots/scanner/cryptobiote/bolagun/cryobox/harness/
// climbing_anchor): le brief ne demande de verrouiller QUE "les véhicules/exosquelettes", pas de
// refaire toute l'économie déjà équilibrée par le rang.
export const EQUIP_MIN_STARS = {
      exo: 1
    };

// "bike" reste hors de cette table (léger, le moins cher des 3 — pas un "équipement lourd" au sens
// du brief) — vérifié empiriquement contre tests/resilience/AntiSpamTransaction.test.js, qui l'achète
// dès le tout début de partie sans aucun Prepper raccordé pour tester une propriété indépendante
// (protection anti-double-clic), pas le gating par étoiles.
export const VEHICLE_MIN_STARS = {
      truck: 1,
      trike: 2
    };
