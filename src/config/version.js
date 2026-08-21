// config/version.js (V1.31.0) — SOURCE DE VÉRITÉ UNIQUE pour le numéro de version affiché de
// l'application. Toute chaîne de version ailleurs dans le codebase (UI, GameState.meta.version,
// badge de l'écran d'accueil...) DOIT importer VERSION depuis ce fichier plutôt que de la recopier
// en dur — un seul endroit à modifier à chaque nouvelle version.
//
// RÈGLE D'ISOLATION: VERSION est une métadonnée purement DESCRIPTIVE — jamais lue par RNG.js, jamais
// consommée par la boucle de simulation (core/GameLoop.js, engine/*, systems/*). Un changement de
// VERSION ne doit jamais altérer le déterminisme d'une partie.
export const VERSION = "1.31.0";
