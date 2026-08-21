// ui/BeachPanel.js (V0.6.0) — séquence textuelle immersive plein écran (langage visuel .left, comme
// les autres modales tactiques), déclenchée automatiquement par TheBeachEngine.triggerBeachSequence()
// à la mort d'un porteur. Révèle les lignes poétiques une à une puis propose le choix Souvenir/Relique.
// Ne bloque le jeu que le temps de la lecture — se ferme après résolution, comme les autres modales.
import { eventBus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { resolveBeachChoice } from '../systems/TheBeachEngine.js';
import { closePanel, pushPanel } from '../core/NavigationManager.js';

let revealTimer = null;

function el() { return document.getElementById('beachModal'); }
function bodyEl() { return document.getElementById('beachModalBody'); }

function renderLines(session, revealCount) {
      const body = bodyEl();
      if (!body) return;
      const lines = session.lines.slice(0, revealCount)
        .map(l => `<div class="beach-line">${l}</div>`).join('');
      const done = revealCount >= session.lines.length;
      body.innerHTML = `
        <div class="beach-caption">— ${session.porterName} —</div>
        ${lines}
        ${done ? `
          <div class="beach-relic-hint">${session.relicDescription}</div>
          <div class="beach-choices">
            <button class="qp-action-btn success" onclick="resolveBeachChoiceUI('memory')">🌊 Laisser le souvenir libre</button>
            <button class="qp-action-btn" onclick="resolveBeachChoiceUI('relic')">🏛️ Sceller une relique</button>
          </div>` : ''}
      `;
    }

// apply(): fermeture visuelle pure (bouton Retour OU résolution du choix) — ne touche jamais
// game.beachSession elle-même (TheBeachEngine.resolveBeachChoice s'en charge séparément), et ne fait
// jamais de pushState/history.back (règle anti-boucle V0.7.0).
function applyCloseBeachPanel() {
      clearTimeout(revealTimer);
      const modal = el();
      if (modal) modal.classList.remove('open');
    }

export function openBeachPanel(session) {
      const modal = el();
      if (!modal) return;
      modal.classList.add('open');
      pushPanel('beachModal', applyCloseBeachPanel);
      clearTimeout(revealTimer);
      let revealed = 0;
      const step = () => {
        revealed++;
        renderLines(session, revealed);
        if (revealed < session.lines.length) revealTimer = setTimeout(step, 1800);
      };
      renderLines(session, 0);
      revealTimer = setTimeout(step, 600);
    }

// Fermeture "physique" du Retour Android laisse simplement la modale disparaître (aucune conséquence
// de jeu — repêcher un souvenir/une relique reste un choix actif, jamais un défaut silencieux).
export function closeBeachPanel() {
      closePanel('beachModal');
    }

// Pont UI: délègue à TheBeachEngine puis ferme la modale (la mort reste définitive, ce n'est qu'un
// dernier geste — cf. TheBeachEngine.js).
//
// V1.29.0 — ne ferme QUE s'il n'y a plus rien à montrer. Si une 2e session était en attente
// (game.beachQueue, 2 porteurs morts dans le même tick), resolveBeachChoice() l'a déjà dépilée dans
// game.beachSession et réémis 'beach:triggered' de façon SYNCHRONE — le listener de ce module a donc
// déjà rafraîchi #beachModal EN PLACE (openBeachPanel réutilise le même panneau déjà ouvert,
// pushPanel est idempotent au sommet de la pile: aucune nouvelle entrée d'historique). Fermer ici
// quand même déclencherait closePanel -> history.back(), qui est ASYNCHRONE (popstate différé) et
// finirait par escamoter ce contenu tout juste réaffiché sans que le joueur l'ait jamais vu — même
// famille de piège que "setTimeout capturant un objet remplaçable" (cf. bug tutoriel V1.25.7): un
// signal différé doit toujours revérifier l'état courant avant d'agir, jamais supposer qu'il est
// encore valide au moment où il se déclenche réellement.
export function resolveBeachChoiceUI(choice) {
      resolveBeachChoice(choice);
      if (!game.beachSession) closeBeachPanel();
    }

eventBus.on('beach:triggered', (session) => openBeachPanel(session));
