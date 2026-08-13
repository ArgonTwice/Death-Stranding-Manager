// ui/components/StatusBadge.js (V0.7.5) — badges de rareté et puces de statut du Design System
// "Bridges Cyber-Terminal". Générateur de chaîne HTML pur (aucun DOM/état): s'intègre au pattern
// innerHTML existant du reste de l'UI, sans jamais toucher game.*/RNG.js.
const RARITY_LABELS = { common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire' };

export function statusBadgeHtml(label, tone = 'common', icon = '') {
      return `<span class="status-badge status-badge-${tone}">${icon ? icon + ' ' : ''}${label}</span>`;
    }

export function rarityBadgeHtml(rarity = 'common') {
      return statusBadgeHtml(RARITY_LABELS[rarity] || RARITY_LABELS.common, rarity);
    }
