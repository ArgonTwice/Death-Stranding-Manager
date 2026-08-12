// engine/RiskEngine.js (V0.4.0) — calcule la "Signature Chirale" d'une livraison ou d'un convoi:
// plus elle est élevée, plus elle attire l'attention (BT/MULEs). Poids du cargo, vitesse (véhicule)
// et technologie embarquée (équipement "actif" — scanner/bolagun/cryobox/ancre) l'augmentent tous.
// Pur calcul, aucun état mutable, aucun accès DOM/EventBus — ConvoySystem.js consomme son résultat.
import { BALANCE } from '../data/Balance.js';

// Nombre de pièces d'équipement "technologique" portées par un porteur — plus il y en a, plus le
// convoi émet de signal chiral détectable (canon: la technologie Bridges laisse une trace).
function techPieceCount(porter) {
      const eq = porter.equipment || {};
      return ['scanner', 'bolagun', 'cryobox', 'climbing_anchor'].reduce((n, k) => n + (eq[k] ? 1 : 0), 0);
    }

// Signature Chirale d'un seul porteur (utilisée pour une livraison individuelle classique).
export function porterSignature(porter, cargoMass) {
      const B = BALANCE.risk;
      let sig = B.baseSignature + (cargoMass || 0) * B.weightSignatureMult + techPieceCount(porter) * B.techSignatureMult;
      if (porter.equipment && porter.equipment.vehicle) sig += B.vehicleSignatureBonus;
      return Math.max(0, sig);
    }

// Signature Chirale agrégée d'un convoi entier (véhicule + escortes) — le poids du cargo de masse
// domine, chaque escorte/pièce de tech additionnelle empile un peu de signal.
export function convoySignature(squadPorters, cargoMass, strategy) {
      const B = BALANCE.risk;
      let sig = squadPorters.reduce((s, p) => s + porterSignature(p, 0), 0) + (cargoMass || 0) * B.weightSignatureMult;
      const strategyMult = (BALANCE.convoy.strategies[strategy] || {}).signatureMult || 1;
      sig *= strategyMult;
      return Math.max(0, sig);
    }

// Convertit une signature en contribution au risque d'événement (même échelle 0-1 que le reste de
// la formule de risque dans DeliveryEngine.generateEvent — voir riskMod).
export function signatureToRiskMod(signature) {
      return signature * BALANCE.risk.signatureRiskMult;
    }
