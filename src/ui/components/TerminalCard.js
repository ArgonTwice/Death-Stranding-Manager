// ui/components/TerminalCard.js (V0.7.5) — carte vitrée du Design System "Bridges Cyber-Terminal":
// ligne néon de rareté en haut, badges, jauges fines, footer d'actions tactiles ≥48px. Générateur de
// chaîne HTML pur (mêmes onclick que les blocs qu'elle remplace — purement présentationnel).
export function terminalCardHtml({ title, subtitle = '', rarity = 'common', badgesHtml = '', bodyHtml = '', gauges = [], actionsHtml = '', radialGauge = null }) {
      const rarityClass = rarity && rarity !== 'common' ? ` term-card-${rarity}` : '';
      const gaugesHtml = gauges.map(g => `
        <div class="term-card-gauge">
          <div class="term-card-gauge-label"><span>${g.label}</span><span>${g.valueLabel != null ? g.valueLabel : g.value + '%'}</span></div>
          <div class="term-card-gauge-track"><div class="term-card-gauge-fill" style="width:${Math.max(0, Math.min(100, g.value))}%;"></div></div>
        </div>`).join('');
      // V0.9.8 — jauge circulaire fine (Cyber-Bridges 2.0), pour un indicateur de progression mis en
      // avant dans l'en-tête (Raid IRL / construction en cours). Purement optionnel: undefined par
      // défaut, aucun appelant existant n'est affecté.
      const radialGaugeHtml = radialGauge
        ? `<div class="cb-radial-gauge" style="--cb-gauge-pct:${Math.max(0, Math.min(100, radialGauge.value))};${radialGauge.color ? `--cb-gauge-color:${radialGauge.color};` : ''}"><span class="cb-radial-gauge-label">${radialGauge.valueLabel != null ? radialGauge.valueLabel : radialGauge.value + '%'}</span></div>`
        : '';
      return `<div class="term-card${rarityClass}">
        <div class="term-card-header">
          <div>
            <div class="term-card-title">${title}</div>
            ${subtitle ? `<div class="term-card-subtitle">${subtitle}</div>` : ''}
          </div>
          ${radialGaugeHtml}
        </div>
        ${badgesHtml ? `<div class="term-card-badges">${badgesHtml}</div>` : ''}
        ${bodyHtml ? `<div class="term-card-body">${bodyHtml}</div>` : ''}
        ${gaugesHtml}
        ${actionsHtml ? `<div class="term-card-footer">${actionsHtml}</div>` : ''}
      </div>`;
    }
