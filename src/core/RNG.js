// core/RNG.js — générateur pseudo-aléatoire déterministe (mulberry32), seedable.
// Toute randomisation qui affecte la SIMULATION (génération de contrats, loot, succès des
// livraisons, combat, météo, économie...) doit passer par RNG.next() au lieu de Math.random(),
// pour que deux runs avec la même seed produisent exactement le même déroulé — indispensable
// pour les golden snapshots et les tests de régression.
//
// Volontairement PAS utilisé pour les effets purement cosmétiques (pluie/poussière du canvas,
// détune audio génératif) : ceux-ci tournent au rythme de requestAnimationFrame, dont le nombre
// d'appels dépend des perfs de la machine — les y faire piocher dans ce flux déterministe
// désynchroniserait la seed du contenu réellement affiché entre deux exécutions identiques.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seed par défaut dérivée de l'horloge au chargement du module: parties normales toujours
// différentes les unes des autres tant que personne n'appelle setSeed() explicitement.
let currentSeed = (Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0;
let generator = mulberry32(currentSeed);

function setSeed(seed) {
  currentSeed = seed >>> 0;
  generator = mulberry32(currentSeed);
  return currentSeed;
}

function getSeed() {
  return currentSeed;
}

// Équivalent direct de Math.random(): flottant dans [0, 1)
function next() {
  return generator();
}

// Entier uniforme dans [0, maxExclusive)
function nextInt(maxExclusive) {
  return Math.floor(next() * maxExclusive);
}

// Flottant uniforme dans [min, max)
function nextRange(min, max) {
  return min + next() * (max - min);
}

// V0.5.0 — flux indépendant dérivé d'une seed explicite (porterSeed etc.), sans toucher au flux
// global partagé ci-dessus. Sert à générer une identité procédurale (PorterStorySystem.js) qui ne
// dépend QUE de sa propre seed stockée — reproductible bit-à-bit même si l'ordre des autres tirages
// RNG.next() ailleurs dans la simulation change entre deux versions du code.
function deriveGenerator(seed) {
  const gen = mulberry32(seed >>> 0);
  return {
    next: gen,
    nextInt: (maxExclusive) => Math.floor(gen() * maxExclusive),
    nextRange: (min, max) => min + gen() * (max - min)
  };
}

export const RNG = { setSeed, getSeed, next, nextInt, nextRange, deriveGenerator };
export { setSeed, getSeed, next, nextInt, nextRange, deriveGenerator };
