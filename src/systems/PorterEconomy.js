// systems/PorterEconomy.js (V1.9.0) — portefeuille individuel par porteur ("Porter Credits"),
// observateur passif de delivery:resolved (même pattern que systems/MemoryEngine.js: s'abonne à un
// event déjà émis, ne mute que le porteur concerné, jamais de pénalité sur un échec — règle 1 déjà
// établie). ADDITIF au budget de la base (game.money): jamais un remplacement — un porteur sans
// credits suffisants retombe simplement sur le budget de la base via
// systems/PorterAiEngine.js#autoBuyEquipForIdlePorters.
import { eventBus } from '../core/EventBus.js';
import { game } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';

export function gainPorterCredits(porterId, reward) {
      if (porterId == null || !(reward > 0)) return;
      const p = game.porters.find(x => x.id === porterId);
      if (!p) return;
      const B = BALANCE.porterEconomy;
      p.credits = Math.min(B.creditsCap, (p.credits || 0) + Math.ceil(reward * B.creditsGainRate));
    }

eventBus.on('delivery:resolved', ({ success, porterId, reward }) => {
      if (success) gainPorterCredits(porterId, reward);
    });
