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
import { dispatchDeliveryManually, estimateNetMarginPreview } from '../engine/DeliveryEngine.js';
import { dispatchPioneer } from '../systems/ReconnaissanceSystem.js';
import { registerView, mountView, destroyView } from '../core/ViewLifecycle.js';
import { revealedMainKnots } from '../systems/PrepperSystem.js';
import { BALANCE } from '../data/Balance.js';

function porterDispatchRowHtml(p) {
      const d = game.mapsData[p.map];
      // V1.4.0 — "Brumes de guerre": le menu de dispatch ne propose que les villes déjà révélées,
      // jamais tout le territoire d'un coup (cf. systems/PrepperSystem.js#revealedMainKnots).
      const knots = d ? revealedMainKnots(d) : [];
      // V1.26.0 — aperçu de marge nette live (docs/ROADMAP_V2.md idée 2, engine/DeliveryEngine.js
      // #estimateNetMarginPreview): recalculé à chaque changement de destination/cargo/route, AVANT le
      // clic "Envoyer" — jusqu'ici la marge n'apparaissait qu'après le départ (QuestPanel.js, livraison
      // déjà en cours).
      const dispatchBlock = knots.length ? `
          <select id="dp-dest-${p.id}" class="qp-select" onchange="updateDeliveryPlanningMarginUI(${p.id})">${knots.map(k => `<option value="${k.x},${k.y}">${k.name}</option>`).join('')}</select>
          <select id="dp-cargo-${p.id}" class="qp-select" onchange="updateDeliveryPlanningMarginUI(${p.id})">${Object.entries(CARGO_TYPES).map(([key, c]) => `<option value="${key}">${c.name}</option>`).join('')}</select>
          <select id="dp-route-${p.id}" class="qp-select" onchange="updateDeliveryPlanningMarginUI(${p.id})">${Object.entries(ROUTE_TYPES).map(([key, r]) => `<option value="${key}">${r.icon} ${r.name}</option>`).join('')}</select>
          <div class="qp-card-meta" id="dp-margin-${p.id}" style="opacity:0.75;"></div>
          <button class="term-card-action success" onclick="dispatchDeliveryPlanningUI(${p.id})">🚚 Envoyer</button>` : '';
      // V1.6.0 — Dispatch Pionnier: gratuit en argent, mobilise ce porteur BALANCE.reconnaissance.
      // pioneerMissionDays jours pour étendre le Réseau Chiral d'une case (systems/
      // ReconnaissanceSystem.js#dispatchPioneer) — toujours proposé, indépendant des villes révélées.
      return `
        <div class="qp-card">
          <div class="qp-card-head">🎯 ${p.name}</div>
          <div class="qp-card-meta">❤️‍🩹 ${Math.ceil(p.health)}/100 · 🔧 usure ${p.gearWear || 0}%</div>
          ${dispatchBlock}
          <button class="term-card-action" onclick="dispatchPioneerUI(${p.id})">🧭 Dispatch Pionnier (${BALANCE.reconnaissance.pioneerMissionDays}j, gratuit)</button>
        </div>`;
    }

export function renderDeliveryPlanningPanel() {
      const el = document.getElementById('deliveryPlanningPanel');
      if (!el) return;
      const idle = game.porters.filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100);
      el.innerHTML = idle.length
        ? idle.map(porterDispatchRowHtml).join('')
        : '<div class="qp-empty">Aucun porteur disponible pour une commande principale — tous en mission ou indisponibles.</div>';
      // Valeur initiale de l'aperçu (dès l'ouverture, pas seulement après une interaction) — le
      // <select> destination arrive déjà pré-sélectionné sur sa 1re <option> par le navigateur.
      idle.forEach(p => updateDeliveryPlanningMarginUI(p.id));
    }

export function updateDeliveryPlanningMarginUI(porterId) {
      const marginEl = document.getElementById(`dp-margin-${porterId}`);
      if (!marginEl) return;
      const destEl = document.getElementById(`dp-dest-${porterId}`);
      if (!destEl || !destEl.value) { marginEl.innerHTML = ''; return; }
      const [destX, destY] = destEl.value.split(',').map(Number);
      const cargoEl = document.getElementById(`dp-cargo-${porterId}`);
      const routeEl = document.getElementById(`dp-route-${porterId}`);
      const porterIdx = game.porters.findIndex(x => x.id === porterId);
      if (porterIdx === -1) { marginEl.innerHTML = ''; return; }
      const margin = estimateNetMarginPreview(porterIdx, destX, destY, cargoEl ? cargoEl.value : undefined, routeEl ? routeEl.value : undefined);
      marginEl.innerHTML = margin
        ? `💰 Marge nette estimée: <b style="color:${margin.net >= 0 ? 'var(--chiral)' : 'var(--blood)'};">${margin.net >= 0 ? '+' : ''}$${margin.net}</b> (brut $${margin.gross} − salaire $${margin.salaryCost}${margin.fuelCost ? ` − carburant $${margin.fuelCost}` : ''} − usure $${margin.wearCost})`
        : '';
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

export function dispatchPioneerUI(porterId) {
      dispatchPioneer(porterId);
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
