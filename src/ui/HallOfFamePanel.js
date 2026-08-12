// ui/HallOfFamePanel.js (V0.5.0) — tiroir glissant du Hall of Fame: légendes mémorisées ENTRE les
// parties (LegacySystem.js, stockage séparé des slots) + porteurs retirés/néantisés de la partie en
// cours. Même pattern non-bloquant que QuestPanel.js/ConvoyPanel.js/PorterDrawer.js.
import { game } from '../core/GameState.js';
import { SKILLS } from '../data/Constants.js';
import { loadLegends } from '../systems/LegacySystem.js';

let panelOpen = false;
let cachedLegends = [];

export function openHallOfFamePanel() {
      panelOpen = true;
      const el = document.getElementById('hallOfFameDrawer');
      if (el) el.classList.add('open');
      renderHallOfFamePanel();
      loadLegends().then(list => { cachedLegends = list; renderHallOfFamePanel(); });
    }

export function closeHallOfFamePanel() {
      panelOpen = false;
      const el = document.getElementById('hallOfFameDrawer');
      if (el) el.classList.remove('open');
    }

export function toggleHallOfFamePanel() {
      if (panelOpen) closeHallOfFamePanel(); else openHallOfFamePanel();
    }

export function renderHallOfFamePanel() {
      const bodyEl = document.getElementById('hallOfFameDrawerBody');
      if (!bodyEl) return;
      const runEntries = game.hallOfFame || [];

      const legendHtml = cachedLegends.length
        ? cachedLegends.map(l => `
          <div class="qp-card qp-card-history">
            <div class="qp-card-head">🏆 ${l.name}</div>
            <div class="qp-card-meta">Lv${l.level} · ❤️ ${l.likes} · ${l.cause} — ${l.date}</div>
          </div>`).join('')
        : '<div class="qp-empty">Aucune légende mémorisée entre les parties pour l\'instant.</div>';

      const runHtml = runEntries.length
        ? runEntries.map(h => `
          <div class="qp-card">
            <div class="qp-card-head">${(SKILLS[h.skill] && SKILLS[h.skill].name) || h.skill} ${h.name}</div>
            <div class="qp-card-meta">Lv${h.level} · ❤️ ${h.likes} · ${h.cause} — mois ${h.month}</div>
          </div>`).join('')
        : '<div class="qp-empty">Aucun porteur retiré/néantisé cette partie.</div>';

      bodyEl.innerHTML = `
        <div class="qp-card-head" style="margin-top:0;">🌍 LÉGENDES — TOUTES PARTIES</div>
        ${legendHtml}
        <div class="qp-card-head">📋 CETTE PARTIE</div>
        ${runHtml}`;
    }
