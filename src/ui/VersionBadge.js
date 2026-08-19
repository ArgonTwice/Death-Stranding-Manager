// ui/VersionBadge.js (V1.0.6 GOLD) — affiche dynamiquement le badge de version (#versionBadge) sous
// le titre de l'écran d'accueil. Source de vérité unique: config/version.js — ce module ne fait que
// peindre cette constante dans le DOM, jamais de chaîne de version codée en dur ici.
//
// RÈGLE D'ISOLATION: purement présentationnel — aucun accès à RNG.js/game.*, aucune mutation d'état
// de simulation. VERSION reste une métadonnée descriptive, jamais lue par la boucle de jeu.
import { VERSION } from '../config/version.js';

export function renderVersionBadge() {
      const el = document.getElementById('versionBadge');
      if (!el) return;
      el.textContent = `V${VERSION}`;
    }
