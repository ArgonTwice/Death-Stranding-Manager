// ui/BeachPanel.js (V0.6.0) — séquence textuelle immersive plein écran (langage visuel .left, comme
// les autres modales tactiques), déclenchée automatiquement par TheBeachEngine.triggerBeachSequence()
// à la mort d'un porteur. Révèle les lignes poétiques une à une puis propose le choix Souvenir/Relique.
// Ne bloque le jeu que le temps de la lecture — se ferme après résolution, comme les autres modales.
import { eventBus } from '../core/EventBus.js';
import { resolveBeachChoice } from '../systems/TheBeachEngine.js';

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

export function openBeachPanel(session) {
      const modal = el();
      if (!modal) return;
      modal.classList.add('open');
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

export function closeBeachPanel() {
      clearTimeout(revealTimer);
      const modal = el();
      if (modal) modal.classList.remove('open');
    }

// Pont UI: délègue à TheBeachEngine puis ferme la modale (la mort reste définitive, ce n'est qu'un
// dernier geste — cf. TheBeachEngine.js).
export function resolveBeachChoiceUI(choice) {
      resolveBeachChoice(choice);
      closeBeachPanel();
    }

eventBus.on('beach:triggered', (session) => openBeachPanel(session));
