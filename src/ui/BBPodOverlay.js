// ui/BBPodOverlay.js (V0.6.0) — overlay léger sur l'écran principal (jamais un tiroir plein écran):
// un badge de statut toujours visible (Connexion/Stress/Stade) + une bannière d'alerte transitoire
// quand un BT est détecté à l'avance par le BB Pod, avec un choix "Prudence"/"Continuer" — vrai choix
// de risque, sans jamais bloquer l'automatisation si le joueur l'ignore.
import { pauseForMessage, resumeAfterMessage } from '../core/GameLoop.js';
import { bbPodState, respondToBBPodAlert } from '../systems/BBPodSystem.js';

let activeAlertPorterId = null;

export function renderBBPodOverlay() {
      const el = document.getElementById('bbPodOverlay');
      if (!el) return;
      const pod = bbPodState();
      const stageIcon = pod.stage === 'lou' ? '👶' : '🥚';
      el.innerHTML = `
        <div class="bbpod-badge">
          <span>${stageIcon} ${pod.stage === 'lou' ? 'Lou' : 'BB Pod'}</span>
          <span class="bbpod-stat">🔗 ${Math.round(pod.connection)}</span>
          <span class="bbpod-stat ${pod.stress > 70 ? 'bbpod-stat-warn' : ''}">😣 ${Math.round(pod.stress)}</span>
        </div>`;
    }

export function showBBPodAlert({ porterId }) {
      activeAlertPorterId = porterId;
      const el = document.getElementById('bbPodAlert');
      if (!el) return;
      el.classList.add('open');
      el.innerHTML = `
        <div class="bbpod-alert-text">⚠️ Le BB Pod s'agite — présence BT détectée à l'avance.</div>
        <div class="bbpod-alert-actions">
          <button class="qp-action-btn success" onclick="respondToBBPodAlertUI('caution')">🛡️ Prudence</button>
          <button class="qp-action-btn" onclick="dismissBBPodAlert()">➡️ Continuer</button>
        </div>`;
      // V1.13.0 — laisse au joueur le temps de lire/choisir sans que l'horloge n'avance sous ses pieds;
      // le délai de 8s ci-dessous reste le filet de sécurité qui évite un blocage indéfini si ignoré.
      pauseForMessage();
      setTimeout(dismissBBPodAlert, 8000); // n'attend jamais indéfiniment une réponse — l'automatisation continue
    }

export function dismissBBPodAlert() {
      const el = document.getElementById('bbPodAlert');
      if (el) { el.classList.remove('open'); el.innerHTML = ''; }
      activeAlertPorterId = null;
      resumeAfterMessage();
    }

export function respondToBBPodAlertUI(choice) {
      if (activeAlertPorterId != null) respondToBBPodAlert(activeAlertPorterId, choice);
      dismissBBPodAlert();
    }
