// ui/DrawerManager.js (V0.7.0) — physique des tiroirs tactiles façon "bottom sheet": Collapsed
// (fermé), Peek (30vh, aperçu) et Full (88vh, plein). Poignée (.ds-drawer-handle) glissable au
// doigt pour naviguer entre ces trois états; glisser suffisamment vers le bas depuis Peek ferme le
// tiroir (délègue au callback de fermeture du contrôleur — jamais de logique de jeu ici).
//
// Indépendance totale vis-à-vis du GameState (V0.7.0 règle 1): ce module ne lit/écrit que des
// classes CSS et des styles inline sur des éléments DOM; aucun accès à game.*/RNG.js/tick.
const drawers = new Map(); // id -> { el, state, onCloseRequest, elevatesBackdrop, dragStartY, dragging }

const STATE_OFFSET = { collapsed: '100%', peek: '58vh', full: '0%' };

function backdropEl() { return document.getElementById('drawerBackdrop'); }

// V1.32.0 — bug réel trouvé en jouant une vraie partie (audit libre): #drawerBackdrop.active avait
// un SEUL z-index (205, css/style.css, posé en V1.25.7) appliqué à TOUS les tiroirs sans distinction
// — or ce 205 n'a de sens QUE pour Télémétrie/Terminal/Hall of Fame (z-index propre 210, seuls
// tiroirs pouvant peeker par-dessus une modale .left encore ouverte, z-index 200): pour les 8 AUTRES
// tiroirs standards (z-index 100), 205 > 100 fait que le fond assombri passe PAR-DESSUS le contenu
// du tiroir lui-même, interceptant tous ses clics — confirmé par un clic Playwright RÉEL sur le
// tiroir Quêtes standard (`<div id="drawerBackdrop" class="active"> intercepts pointer events`),
// aucun rapport avec une modale. Passé inaperçu jusqu'ici car la méthodologie de test établie de ce
// projet appelle les fonctions `window.*` directement pour vérifier le comportement (contourne le
// hit-testing réel du navigateur par construction) — seul un vrai `page.click()` le révèle. Fix:
// `.above-modal` (nouvelle classe, css/style.css) ne s'ajoute que si un tiroir marqué
// `elevatesBackdrop` (ui/UIShell.js#BOTTOM_SHEET_DRAWERS, seulement les 3 concernés) est ouvert —
// les 8 autres gardent le fond assombri à son z-index de base (90, sous TOUS les tiroirs standards).
function updateBackdrop() {
      const open = [...drawers.values()].filter(d => d.state !== 'collapsed');
      const bd = backdropEl();
      if (!bd) return;
      // add/remove explicites (pas classList.toggle(cls,bool)) — même convention que
      // setDrawerState() ci-dessous, et testable via le stub DOM minimal des tests (dont le
      // classList.toggle() est un no-op délibéré, cf. tests/resilience/_stubEnv.mjs).
      if (open.length > 0) bd.classList.add('active'); else bd.classList.remove('active');
      if (open.some(d => d.elevatesBackdrop)) bd.classList.add('above-modal'); else bd.classList.remove('above-modal');
    }

export function registerDrawer(id, { onCloseRequest, elevatesBackdrop } = {}) {
      const el = document.getElementById(id);
      if (!el || drawers.has(id)) return;
      const entry = { el, state: 'collapsed', onCloseRequest: onCloseRequest || null, elevatesBackdrop: !!elevatesBackdrop, dragStartY: 0, dragging: false };
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

// V1.36.0 — bug réel trouvé par un vrai geste de glisser Playwright (jamais testé ainsi cette
// session, contrairement à un simple appel direct des fonctions exportées): l'ancien
// `Math.max(0, delta)` mettait TOUJOURS le déplacement visuel à 0 dès que le doigt remontait (delta
// négatif) — quel que soit l'état de départ. Pour un tiroir en 'peek', glisser vers le HAUT (vers
// 'full') ne bougeait donc JAMAIS visuellement pendant tout le geste: le tiroir restait figé à sa
// position de repos et ne basculait qu'au relâchement (delta<-60), comme si le glissement était
// ignoré — confirmé: `--drawer-y` valait `calc(58vh + 0px)` du DÉBUT à la FIN d'un glissement de
// -100px, alors que le sens inverse (glisser vers le bas depuis 'full', delta positif) suivait
// correctement le doigt en temps réel (`calc(0% + 100px)`). Le clamp à 0 n'a de sens QUE pour
// empêcher un tiroir déjà 'full' (baseline 0%) de dépasser visuellement le haut de l'écran si on
// continue à tirer vers le haut — pas pour 'peek'/'collapsed', où un delta négatif doit au contraire
// suivre le doigt normalement (translater VERS 0%). Extrait en fonction pure (même pattern que
// RaidEventResolver.js/CombatResolver.js) pour rester testable sans simuler un vrai geste pointer,
// que le stub DOM minimal des tests ne peut pas reproduire fidèlement.
export function visualDragDelta(state, delta) {
      return state === 'full' ? Math.max(0, delta) : delta;
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
        d.el.style.setProperty('--drawer-y', `calc(${baseline} + ${visualDragDelta(d.state, delta)}px)`);
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
