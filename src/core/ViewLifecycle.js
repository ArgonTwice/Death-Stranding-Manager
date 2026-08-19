// core/ViewLifecycle.js (V1.1 LOT 2) — contrat de cycle de vue formel: mount(subscribe) -> chaque
// abonnement eventBus.on() fait via subscribe() est mémorisé -> render() -> [vie de la vue] ->
// destroy() désabonne AUTOMATIQUEMENT tout ce qui a été enregistré via subscribe(), sans jamais avoir
// à lister les handlers à la main dans la vue elle-même.
//
// PORTÉE DÉLIBÉRÉMENT ADDITIVE — pas une migration de l'existant: les ~15 modules ui/*.js historiques
// (HUD.js, MissionsPanel.js, RaidTrackingDrawer.js, WalkDrawer.js...) gardent leur unique
// eventBus.on(...) permanent enregistré à l'import du module. Ce n'est pas une fuite: leur DOM n'est
// JAMAIS démonté (toggle CSS .active sur un bloc qui reste dans le document, cf. css/theme.css), donc
// il n'existe aucun cycle mount/destroy réel à leur retirer — un rewrite de ces 15 fichiers pour les
// forcer dans ce contrat n'aurait aucun bénéfice fonctionnel et un risque de régression réel sur un
// jeu déployé et testé. Ce contrat cible les vues qui ONT un vrai cycle mount/destroy dynamique — la
// première à l'utiliser est ui/DeliveryPlanningPanel.js (onglet Livraisons: ne s'abonne à
// 'render:request' QUE pendant que l'onglet est ouvert).
import { eventBus } from './EventBus.js';

const registry = new Map();

export function registerView(id, { mount, render, destroy } = {}) {
  registry.set(id, { mount, render, destroy, unsubscribers: [], mounted: false });
}

export function mountView(id) {
  const v = registry.get(id);
  if (!v || v.mounted) return; // idempotent: un mount() sur une vue déjà montée est un no-op
  v.mounted = true;
  const subscribe = (event, handler) => { v.unsubscribers.push(eventBus.on(event, handler)); };
  if (v.mount) v.mount(subscribe);
  if (v.render) v.render();
}

export function destroyView(id) {
  const v = registry.get(id);
  if (!v || !v.mounted) return; // idempotent: destroy() sur une vue déjà démontée est un no-op
  v.unsubscribers.forEach(unsubscribe => unsubscribe());
  v.unsubscribers = [];
  if (v.destroy) v.destroy();
  v.mounted = false;
}

export function isViewMounted(id) {
  const v = registry.get(id);
  return !!(v && v.mounted);
}
