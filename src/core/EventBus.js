// core/EventBus.js — découplage inter-modules (canon architecture: engine/systems ne doivent jamais
// appeler ui/audio directement ; ils émettent un événement, et ui/audio s'y abonnent).
// Émission synchrone (listeners appelés immédiatement, dans l'ordre d'abonnement) — préserve
// exactement le timing du monolithe d'origine où render()/playX() étaient appelés en ligne.
class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }
  emit(event, payload) {
    const list = this.listeners.get(event);
    if (!list) return;
    // Copie défensive: un handler peut s'abonner/se désabonner pendant l'émission
    for (const handler of [...list]) handler(payload);
  }
}

export const eventBus = new EventBus();
