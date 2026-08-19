// ui/DeliveryPlanningPanel.js (V1.1 LOT 2) — vue "Commandes Principales" de l'onglet Livraisons: liste
// consolidée de tous les porteurs idle du territoire actif, chacun avec un sélecteur destination/
// cargo/route, pour ne pas avoir à ouvrir chaque fiche porteur individuellement comme c'était le cas
// pour le dispatch manuel V1.1 LOT 1 (ui/PorterDrawer.js#manualDispatchHtml, toujours en place et
// inchangé — ceci est une vue supplémentaire sur le même mécanisme, pas un remplacement). Délègue
// toute la validation/création au même point d'entrée: engine/DeliveryEngine.js#dispatchDeliveryManually
// — aucune logique de jeu dupliquée ici.
//
// Première vue du jeu à utiliser le contrat formel core/ViewLifecycle.js (mount/subscribe/render/
// destroy): ne s'abonne à 'render:request' QUE pendant que l'onglet Livraisons est réellement ouvert
// (mounted via l'événement 'nav:mainTabChanged', plomberie UI pure émise par ui/NavigationManager.js),
// désabonnement automatique à la fermeture — jamais de re-rendu ni d'accumulation de listeners une
// fois l'onglet quitté.
import { game } from '../core/GameState.js';
import { eventBus } from '../core/EventBus.js';
import { CARGO_TYPES, ROUTE_TYPES } from '../data/Constants.js';
import { dispatchDeliveryManually } from '../engine/DeliveryEngine.js';
import { registerView, mountView, destroyView } from '../core/ViewLifecycle.js';

function porterDispatchRowHtml(p) {
      const d = game.mapsData[p.map];
      const knots = (d && d.mainKnots) || [];
      if (!knots.length) return '';
      const destOptions = knots.map(k => `<option value="${k.x},${k.y}">${k.name}</option>`).join('');
      const cargoOptions = Object.entries(CARGO_TYPES).map(([key, c]) => `<option value="${key}">${c.name}</option>`).join('');
      const routeOptions = Object.entries(ROUTE_TYPES).map(([key, r]) => `<option value="${key}">${r.icon} ${r.name}</option>`).join('');
      return `
        <div class="qp-card">
          <div class="qp-card-head">🎯 ${p.name}</div>
          <div class="qp-card-meta">❤️‍🩹 ${Math.ceil(p.health)}/100 · 🔧 usure ${p.gearWear || 0}%</div>
          <select id="dp-dest-${p.id}" class="qp-select">${destOptions}</select>
          <select id="dp-cargo-${p.id}" class="qp-select">${cargoOptions}</select>
          <select id="dp-route-${p.id}" class="qp-select">${routeOptions}</select>
          <button class="term-card-action success" onclick="dispatchDeliveryPlanningUI(${p.id})">🚚 Envoyer</button>
        </div>`;
    }

export function renderDeliveryPlanningPanel() {
      const el = document.getElementById('deliveryPlanningPanel');
      if (!el) return;
      const idle = game.porters.filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100);
      el.innerHTML = idle.length
        ? idle.map(porterDispatchRowHtml).join('')
        : '<div class="qp-empty">Aucun porteur disponible pour une commande principale — tous en mission ou indisponibles.</div>';
    }

export function dispatchDeliveryPlanningUI(porterId) {
      const destEl = document.getElementById(`dp-dest-${porterId}`);
      if (!destEl || !destEl.value) return;
      const [destX, destY] = destEl.value.split(',').map(Number);
      const cargoEl = document.getElementById(`dp-cargo-${porterId}`);
      const routeEl = document.getElementById(`dp-route-${porterId}`);
      const porterIdx = game.porters.findIndex(x => x.id === porterId);
      if (porterIdx === -1) return;
      dispatchDeliveryManually(porterIdx, destX, destY, { cargoType: cargoEl ? cargoEl.value : undefined, route: routeEl ? routeEl.value : undefined });
      renderDeliveryPlanningPanel();
    }

registerView('deliveryPlanning', {
      mount(subscribe) { subscribe('render:request', renderDeliveryPlanningPanel); },
      render: renderDeliveryPlanningPanel
    });

// Unique écouteur permanent de ce module (plomberie UI pure, même catégorie que TutorialManager.js) —
// c'est lui, pas le rendu, qui reste abonné en continu ; il ne fait que (dé)monter la vue.
eventBus.on('nav:mainTabChanged', ({ main }) => {
      if (main === 'livraisons') mountView('deliveryPlanning');
      else destroyView('deliveryPlanning');
    });
