// systems/raid/RaidEventResolver.js (V0.9.0) — résolution déterministe des événements de Raid aux
// checkpoints de progression (25/50/75%, cf. BALANCE.raid.checkpoints). Ne touche JAMAIS RNG.js: ne
// consomme que le générateur DÉRIVÉ de la raidSeed déjà stockée sur le raid (RNG.deriveGenerator),
// donc reproductible bit-à-bit à partir de cette seule valeur, indépendamment du flux partagé.
import { RNG } from '../../core/RNG.js';
import { BALANCE } from '../../data/Balance.js';

const RAID_EVENTS = [
      { id: 'timefall', label: '🌧️ Timefall soudain', bad: true },
      { id: 'rockslide', label: '🪨 Éboulement sur le sentier', bad: true },
      { id: 'bt_zone', label: '👻 Zone BT détectée', bad: true },
      { id: 'mule_ambush', label: '🏴‍☠️ Embuscade MULE', bad: true },
      { id: 'shortcut', label: '✅ Raccourci chiral trouvé', bad: false }
    ];

// Un générateur dérivé unique par raid (jamais recréé entre deux checkpoints du même raid — chaque
// appel consécutif avance le MÊME flux, garantissant que checkpoint 2 dépend bien du tirage du
// checkpoint 1, comme un vrai déroulé narratif) — géré par un petit cache clé sur raidSeed.
const generatorCache = new Map();
function generatorFor(raidSeed) {
      if (!generatorCache.has(raidSeed)) generatorCache.set(raidSeed, RNG.deriveGenerator(raidSeed));
      return generatorCache.get(raidSeed);
    }

// Résout l'événement d'un checkpoint donné: retourne { id, label, bad, detourSteps, cargoDamage }.
// Ne mute rien — à charge de l'appelant (RaidSystem.js) d'appliquer le résultat au RaidState.
export function resolveCheckpointEvent(raidSeed, checkpointFraction) {
      const gen = generatorFor(raidSeed);
      const B = BALANCE.raid;
      const event = RAID_EVENTS[gen.nextInt(RAID_EVENTS.length)];
      if (!event.bad) {
        return { id: event.id, label: event.label, bad: false, checkpointFraction, detourSteps: 0, cargoDamage: 0 };
      }
      const detourSteps = Math.round(B.detourStepsMin + gen.next() * (B.detourStepsMax - B.detourStepsMin));
      return { id: event.id, label: event.label, bad: true, checkpointFraction, detourSteps, cargoDamage: B.cargoDamagePerBadEvent };
    }

// Nettoie le cache de générateurs pour une seed donnée (raid terminé/abandonné) — évite une fuite
// mémoire si de nombreux raids sont lancés au fil d'une longue partie.
export function releaseRaidGenerator(raidSeed) {
      generatorCache.delete(raidSeed);
    }
