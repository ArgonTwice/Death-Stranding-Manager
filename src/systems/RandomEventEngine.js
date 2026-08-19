// systems/RandomEventEngine.js (V1.4.0) — résolution PURE du tirage d'événement de parcours (Averse
// Timefall, présence BT, embuscade MULE, raccourci chanceux, Waystation providentielle...), extraite
// de engine/DeliveryEngine.js#generateEvent. Ne calcule PAS le risque contextuel (dépend de trop de
// systèmes — équipement, structures, météo, difficulté: reste dans generateEvent, la couche qui les
// connaît déjà tous) — uniquement le TIRAGE à partir d'un risque déjà résolu, même contrat que
// systems/raid/RaidEventResolver.js/systems/raid/CombatResolver.js: une fonction pure {events, rng} ->
// résultat, jamais de mutation game.*/DOM, testable headless en isolation totale.
//
// `rng` est n'importe quel objet {next()} — DeliveryEngine.js lui passe RNG (le flux partagé) pour
// préserver bit-à-bit l'ordre de tirage existant (deux appels next(): pool puis index, INCHANGÉ). Un
// sous-générateur dédié et déterministe (RNG.deriveGenerator(seed), même primitive que
// RaidEventResolver.js/ContractGenerator.js — jamais un nouveau champ game.rng.eventSeed inventé,
// aucune API de ce nom n'existe dans core/RNG.js) peut aussi lui être passé pour un tirage reproductible
// isolé du flux partagé, sans jamais le décaler d'un seul draw: voir le test d'isolation dédié.
export function rollDeliveryEvent(events, risk, rng) {
      const badEvents = events.filter(e => e.risk >= 0);
      const goodEvents = events.filter(e => e.risk < 0);
      const pool = rng.next() < risk ? badEvents : goodEvents;
      return pool[Math.floor(rng.next() * pool.length)];
    }
