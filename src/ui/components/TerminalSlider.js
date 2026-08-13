// ui/components/TerminalSlider.js (V0.7.5) — slider ambré custom (piste sombre, curseur doré) pour
// les volumes/options, remplace visuellement les sliders bleus natifs (components.css stylise déjà
// input[type=range] globalement; ce générateur ajoute le label + la bulle de valeur + la mise à jour
// live du remplissage). Purement présentationnel: onInput reste la même fonction gameplay qu'avant.
export function terminalSliderHtml({ id, value, min = 0, max = 100, label = '', onInput, valueSuffix = '' }) {
      const pct = Math.round(((value - min) / (max - min)) * 100);
      const liveFill = `this.style.setProperty('--range-fill', (((this.value-${min})/(${max}-${min}))*100)+'%'); const vEl=document.getElementById('${id}Value'); if(vEl) vEl.textContent=this.value+'${valueSuffix}';`;
      return `<div class="term-slider">
        ${label ? `<div class="term-slider-label">${label}</div>` : ''}
        <div class="term-slider-row">
          <input id="${id}" type="range" min="${min}" max="${max}" value="${value}" style="--range-fill:${pct}%" oninput="${liveFill} ${onInput || ''}">
          <span class="term-slider-value" id="${id}Value">${value}${valueSuffix}</span>
        </div>
      </div>`;
    }
