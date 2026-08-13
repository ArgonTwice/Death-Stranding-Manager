// ui/components/TerminalStepper.js (V0.7.5) — stepper +/- tactile custom, remplace les
// input[type=number] bruts pour les valeurs numériques (seuils d'automatisation, %). Générateur de
// chaîne HTML pur: onDec/onInc sont des chaînes JS déjà prêtes pour l'attribut onclick (mêmes
// fonctions gameplay qu'avant — ce composant est purement présentationnel, règle 2 de la mission).
export function terminalStepperHtml({ onDec, onInc, value, suffix = '', min = null, max = null }) {
      const decDisabled = min != null && value <= min ? 'disabled' : '';
      const incDisabled = max != null && value >= max ? 'disabled' : '';
      return `<span class="term-stepper">
        <button type="button" class="term-stepper-btn" ${decDisabled} onclick="${onDec}">−</button>
        <span class="term-stepper-value">${value}${suffix}</span>
        <button type="button" class="term-stepper-btn" ${incDisabled} onclick="${onInc}">+</button>
      </span>`;
    }
