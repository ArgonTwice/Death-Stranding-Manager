// AUTO-EXTRACTED MODULE: ui/Modals.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { closePanel, pushPanel } from '../core/NavigationManager.js';

function applyCloseTabModal() {
      const modal = document.getElementById('tabModal');
      if (modal) modal.classList.remove('open');
      document.querySelectorAll('.mtab-btn').forEach(el => el.classList.remove('active'));
    }

export function setMobileTab(tab) {
      document.querySelectorAll('.mtab-section').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
      document.querySelectorAll('.mtab-btn').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
      const modal = document.getElementById('tabModal');
      if (modal) { modal.classList.add('open'); modal.querySelector('.panel').scrollTop = 0; }
      pushPanel('tabModal', applyCloseTabModal); // idempotent: changer d'onglet en place ne repousse pas l'historique
    }

export function closeTabModal() {
      closePanel('tabModal');
    }

export function checkMobileMode() {
      document.body.classList.add('mtab-mode'); // onglets universels: desktop ET mobile
    }

window.addEventListener('resize', checkMobileMode);
