// ui/OptionsPanel.js (V1.0.0) — Options scindé en 2 volets clairs (règle 2): Paramètres Système
// (Audio, Affichage) vs Paramètres de Gestion (vitesse/pause, automatisation, tableau de bord
// logistique). Bascule locale légère — un FILTRE d'affichage comme les qp-tabs des autres panneaux,
// PAS un niveau de navigation historisé: le bouton Retour physique doit refermer directement au
// Dashboard depuis Options, jamais s'arrêter sur un volet intermédiaire.
let activeVolet = 'system';

export function setOptionsVolet(id) {
      activeVolet = id;
      renderOptionsPanel();
    }

export function renderOptionsPanel() {
      document.querySelectorAll('.opt-volet-tab').forEach(el => el.classList.toggle('active', el.dataset.volet === activeVolet));
      document.querySelectorAll('.opt-volet-content').forEach(el => el.classList.toggle('active', el.dataset.volet === activeVolet));
    }

// V1.0.0 règle 3 (Affichage/Graphismes) — réglage réel et minimal: désactive les animations CSS
// décoratives (fade/slide/pulse, cf. css/theme.css) pour les appareils bas de gamme ou les
// préférences d'accessibilité. Persisté en localStorage (préférence d'appareil, pas une donnée de
// partie — ne transite jamais par SaveManager.js/GameState.js).
const REDUCED_MOTION_KEY = 'dsm_reducedMotion';

export function setReducedMotion(enabled) {
      document.body.classList.toggle('cb-reduced-motion', enabled);
      try { localStorage.setItem(REDUCED_MOTION_KEY, enabled ? '1' : '0'); } catch (e) {}
    }

export function initOptionsPanel() {
      let stored = '0';
      try { stored = localStorage.getItem(REDUCED_MOTION_KEY) || '0'; } catch (e) {}
      const enabled = stored === '1';
      document.body.classList.toggle('cb-reduced-motion', enabled);
      const checkbox = document.getElementById('reducedMotionToggle');
      if (checkbox) checkbox.checked = enabled;
      renderOptionsPanel();
    }
