// ui/DrawerManager.js (V0.7.0) — physique des tiroirs tactiles façon "bottom sheet": Collapsed
// (fermé), Peek (30vh, aperçu) et Full (88vh, plein). Poignée (.ds-drawer-handle) glissable au
// doigt pour naviguer entre ces trois états; glisser suffisamment vers le bas depuis Peek ferme le
// tiroir (délègue au callback de fermeture du contrôleur — jamais de logique de jeu ici).
//
// Indépendance totale vis-à-vis du GameState (V0.7.0 règle 1): ce module ne lit/écrit que des
// classes CSS et des styles inline sur des éléments DOM; aucun accès à game.*/RNG.js/tick.
const drawers = new Map(); // id -> { el, state, onCloseRequest, dragStartY, dragging }

const STATE_OFFSET = { collapsed: '100%', peek: '58vh', full: '0%' };

function backdropEl() { return document.getElementById('drawerBackdrop'); }

function updateBackdrop() {
      const anyOpen = [...drawers.values()].some(d => d.state !== 'collapsed');
      const bd = backdropEl();
      if (bd) bd.classList.toggle('active', anyOpen);
    }

export function registerDrawer(id, { onCloseRequest } = {}) {
      const el = document.getElementById(id);
      if (!el || drawers.has(id)) return;
      const entry = { el, state: 'collapsed', onCloseRequest: onCloseRequest || null, dragStartY: 0, dragging: false };
      drawers.set(id, entry);
      el.classList.add('ds-drawer', 'state-collapsed');
      const handle = el.querySelector('.ds-drawer-handle');
      if (handle) attachSwipe(id, handle);
    }

export function setDrawerState(id, state) {
      const d = drawers.get(id);
      if (!d) return;
      d.state = state;
      d.el.classList.remove('state-collapsed', 'state-peek', 'state-full');
      d.el.classList.add('state-' + state);
      d.el.style.removeProperty('--drawer-y');
      updateBackdrop();
    }

export function openDrawer(id, state = 'peek') { setDrawerState(id, state); }
export function collapseDrawer(id) { setDrawerState(id, 'collapsed'); }
export function drawerState(id) { const d = drawers.get(id); return d ? d.state : 'collapsed'; }

// Tapoter le fond assombri (backdrop) ferme le(s) tiroir(s) ouvert(s) — délègue au close du
// contrôleur (donc à NavigationManager.closePanel), jamais de fermeture DOM directe ici.
export function closeAllOpenDrawers() {
      for (const d of drawers.values()) {
        if (d.state !== 'collapsed' && d.onCloseRequest) d.onCloseRequest();
      }
    }

function attachSwipe(id, handle) {
      const d = drawers.get(id);
      const onDown = (e) => {
        d.dragging = true;
        d.dragStartY = e.clientY;
        d.el.classList.add('dragging');
        handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
      };
      const onMove = (e) => {
        if (!d.dragging) return;
        const delta = e.clientY - d.dragStartY;
        const baseline = STATE_OFFSET[d.state];
        d.el.style.setProperty('--drawer-y', `calc(${baseline} + ${Math.max(0, delta)}px)`);
        d.lastDelta = delta;
      };
      const onUp = () => {
        if (!d.dragging) return;
        d.dragging = false;
        d.el.classList.remove('dragging');
        d.el.style.removeProperty('--drawer-y');
        const delta = d.lastDelta || 0;
        d.lastDelta = 0;
        if (d.state === 'full' && delta > 80) {
          setDrawerState(id, 'peek');
        } else if (d.state === 'peek' && delta > 60) {
          if (d.onCloseRequest) d.onCloseRequest();
        } else if (d.state === 'peek' && delta < -60) {
          setDrawerState(id, 'full');
        }
      };
      handle.addEventListener('pointerdown', onDown);
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    }
