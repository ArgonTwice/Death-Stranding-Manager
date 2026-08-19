// systems/raid/CombatResolver.js (V1.2.0) — résolution PURE du combat Catcher BT: extrait de
// engine/CombatEngine.js#engageCatcher la partie qui consomme RNG et décide de l'issue, sans jamais
// muter game.*/DOM/eventBus. Même contrat que RaidEventResolver.js (règle "resolveRaid(context, rng)"
// du brief V1.2): CombatEngine.js reste seul responsable d'appliquer le résultat au GameState — ce
// module ne fait que CALCULER. `rng` est n'importe quel objet {next()} — CombatEngine.js lui passe
// RNG (le flux partagé) pour préserver bit-à-bit l'ordre de tirage existant, tandis que les tests
// headless peuvent lui passer RNG.deriveGenerator(seed) pour un résultat reproductible isolé.
export function resolveCatcherEncounter(context, rng) {
      const { B, squadSize, campStrength, bloodBagsUsed, successChance } = context;
      const success = rng.next() < successChance;
      if (success) {
        const loot = campStrength * (B.catcherLootBase + Math.floor(rng.next() * B.catcherLootRandRange));
        return { success: true, loot, outcomes: [] };
      }
      // Même ordre qu'avant refacto (for...of sur squad): un tirage "meurt ?" par porteur, puis un
      // second tirage "dégâts" UNIQUEMENT si ce porteur survit — jamais l'inverse.
      const outcomes = [];
      for (let i = 0; i < squadSize; i++) {
        const deathChance = B.catcherDeathChanceBase - (bloodBagsUsed / squadSize) * B.catcherDeathChanceBloodBagMult;
        if (rng.next() < deathChance) {
          outcomes.push({ died: true, damage: 0 });
        } else {
          outcomes.push({ died: false, damage: B.catcherFailDamageBase + rng.next() * B.catcherFailDamageRandRange });
        }
      }
      return { success: false, loot: 0, outcomes };
    }
