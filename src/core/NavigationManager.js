// core/NavigationManager.js (V0.7.0) — pile de navigation UI basée sur history.pushState/popstate,
// pour intercepter le bouton Retour physique du smartphone (Android/iOS) et fermer séquentiellement
// les panneaux ouverts (drawers, modales) au lieu de quitter l'application web.
//
// RÈGLE D'INDÉPENDANCE (V0.7.0 règle 1): ce module ne touche JAMAIS game.*, ne consomme jamais de
// RNG.next(), et ne déclenche jamais advanceDay()/tick(). Il ne manipule que l'historique du
// navigateur et une pile en mémoire de callbacks purement UI (ajout/retrait de classes CSS).
//
// RÈGLE ANTI-BOUCLE (V0.7.0 règle 4): pushPanel() est le SEUL point d'entrée qui appelle
// history.pushState(). closePanel() ne fait JAMAIS de pushState() — il déclenche history.back()
// (ou l'équivalent), ce qui fait toujours retomber sur popstate → apply(). apply() (le callback
// enregistré par chaque contrôleur) ne fait JAMAIS lui-même de pushState()/history.back(): il se
// contente d'appliquer l'état (fermer visuellement le panneau). Ce sens unique évite toute boucle
// push→pop→push.
let stack = []; // [{ id, apply }] — apply() ferme visuellement le panneau, jamais d'appel history.*
let initialized = false;

// V1.0.3 règle 2 — point de centralisation UNIQUE pour body.modal-open: pushPanel()/onPopState() sont
// déjà le seul chemin par lequel TOUTE modale/tiroir/ModalService de l'app s'ouvre ou se ferme (17
// fichiers ui/* passent par ici), donc poser la classe ici l'applique gratuitement partout plutôt que
// de dupliquer un toggle dans chaque module. css/theme.css lit body.modal-open pour bloquer le
// rubber-band/overscroll d'arrière-plan tant qu'au moins un panneau reste ouvert.
function syncModalOpenClass() {
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.toggle('modal-open', stack.length > 0);
      }
    }

export function initNavigation() {
      if (initialized) return;
      initialized = true;
      if (!history.state || !history.state.__nav) {
        history.replaceState({ __nav: true, depth: 0 }, '');
      }
      window.addEventListener('popstate', onPopState);
    }

// Ouvre un panneau: ajoute une entrée d'historique. Idempotent si ce panneau est déjà au sommet de
// la pile (évite d'empiler plusieurs entrées pour un simple changement d'onglet interne).
export function pushPanel(id, apply) {
      if (stack.length && stack[stack.length - 1].id === id) return;
      stack.push({ id, apply });
      history.pushState({ __nav: true, depth: stack.length }, '');
      syncModalOpenClass();
    }

// Fermeture demandée par l'UI (bouton ✕, ou fermeture programmatique après une action) — jamais par
// le bouton Retour physique (qui passe par popstate). Ne touche jamais le DOM directement: dépile
// via history.back(), qui déclenche popstate → apply() (fermeture visuelle réelle).
export function closePanel(id) {
      const idx = stack.findIndex(p => p.id === id);
      if (idx === -1) return; // déjà fermé / jamais ouvert — no-op défensif, comme les anciens closeX()
      const stepsBack = stack.length - idx;
      for (let i = 0; i < stepsBack; i++) history.back();
    }

export function isPanelOpen(id) {
      return stack.some(p => p.id === id);
    }

function onPopState(event) {
      const targetDepth = (event.state && event.state.__nav) ? event.state.depth : 0;
      while (stack.length > targetDepth) {
        const panel = stack.pop();
        panel.apply();
      }
      syncModalOpenClass();
    }
