// ui/ModalService.js (V1.0.3) — remplace les confirm() natifs (bloquants, non stylés, absents de
// certains contextes PWA iOS) par une modale glassmorphic Promise-based, cohérente avec le Design
// System Cyber-Bridges 2.0. Même pile que le reste des modales/tiroirs (core/NavigationManager.js:
// pushPanel/closePanel), donc le bouton Retour physique et un tap sur le fond assombri annulent la
// confirmation exactement comme fermer n'importe quel autre panneau.
//
// RÈGLE D'ISOLATION (même garde-fou que DrawerManager.js/core/NavigationManager.js): ce module ne lit
// ni n'écrit JAMAIS game.*, ne consomme JAMAIS RNG.next(), ne déclenche JAMAIS advanceDay()/tick() —
// il ne peint que du DOM et résout une Promise<boolean> selon l'interaction de l'utilisateur.
import { closePanel, pushPanel } from '../core/NavigationManager.js';

const MODAL_ID = 'dsConfirmModal';

let els = null; // { root, title, message, cancelBtn, confirmBtn }
let pendingResolve = null;
let resolvedValue = null;

function build() {
      if (els) return els;
      const root = document.createElement('div');
      root.id = MODAL_ID;
      root.className = 'ds-modal-backdrop';
      root.innerHTML = `
        <div class="ds-modal-confirm" role="alertdialog" aria-modal="true">
          <div class="ds-modal-title"></div>
          <div class="ds-modal-message"></div>
          <div class="ds-modal-actions">
            <button type="button" class="ds-modal-cancel"></button>
            <button type="button" class="ds-modal-confirm-btn"></button>
          </div>
        </div>`;
      document.body.appendChild(root);
      const cancelBtn = root.querySelector('.ds-modal-cancel');
      const confirmBtn = root.querySelector('.ds-modal-confirm-btn');
      root.addEventListener('click', (evt) => { if (evt.target === root) requestClose(false); });
      cancelBtn.addEventListener('click', () => requestClose(false));
      confirmBtn.addEventListener('click', () => requestClose(true));
      els = { root, title: root.querySelector('.ds-modal-title'), message: root.querySelector('.ds-modal-message'), cancelBtn, confirmBtn };
      return els;
    }

// Callback enregistré auprès de core/NavigationManager.js (pushPanel) — appelé à la fermeture,
// QU'ELLE VIENNE de requestClose() (bouton ✕/Annuler/Confirmer/backdrop) OU du bouton Retour physique
// (popstate direct, sans passer par requestClose). C'est donc le SEUL endroit qui résout réellement la
// Promise, garantissant qu'aucun chemin de fermeture ne la laisse jamais pendante — un Retour physique
// non traité ici équivaudrait à une annulation silencieuse (resolvedValue reste `null` -> false).
function applyClose() {
      if (els) els.root.classList.remove('open');
      if (pendingResolve) {
        const resolve = pendingResolve;
        const result = resolvedValue === true;
        pendingResolve = null;
        resolvedValue = null;
        resolve(result);
      }
    }

// Ne fait jamais elle-même de pushState()/history.back() au-delà de ce seul closePanel() (règle
// anti-boucle de core/NavigationManager.js): la fermeture visuelle réelle et la résolution de la
// Promise se produisent toujours dans applyClose(), retombée du popstate déclenché par closePanel().
function requestClose(result) {
      resolvedValue = result;
      closePanel(MODAL_ID);
    }

/**
 * confirmModal({ title, message, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
 * Une seule confirmation à la fois: un appel concurrent résout silencieusement la précédente à
 * `false` plutôt que d'empiler deux dialogues invisibles l'un sur l'autre.
 */
export function confirmModal({ title = 'Confirmation', message = '', confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false } = {}) {
      const { root, title: titleEl, message: messageEl, cancelBtn, confirmBtn } = build();
      if (pendingResolve) { const prev = pendingResolve; pendingResolve = null; prev(false); }
      return new Promise((resolve) => {
        pendingResolve = resolve;
        resolvedValue = null;
        titleEl.textContent = title;
        messageEl.textContent = message;
        cancelBtn.textContent = cancelLabel;
        confirmBtn.textContent = confirmLabel;
        confirmBtn.classList.toggle('danger', !!danger);
        root.classList.add('open');
        pushPanel(MODAL_ID, applyClose);
      });
    }
