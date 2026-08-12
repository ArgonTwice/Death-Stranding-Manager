// ui/TerminalConsole.js (V0.6.0) — console rétro pour dialoguer avec le Terminal (TerminalSoul.js):
// commandes SING/STAY/LISTEN/REMEMBER/FORGET, plus lecture du Journal (souvenirs majeurs) et de la
// Mémoire Chirale cumulée. Tiroir glissant (même langage visuel que QuestPanel/PorterDrawer), boutons
// de commande ≥48x48px pour rester jouable au tactile sans clavier (règle 5).
import { game } from '../core/GameState.js';
import { processTerminalCommand, TERMINAL_COMMAND_LIST } from '../systems/TerminalSoul.js';

let panelOpen = false;
const history = []; // { role: 'you'|'terminal', text }

export function openTerminalConsole() {
      panelOpen = true;
      const el = document.getElementById('terminalDrawer');
      if (el) el.classList.add('open');
      renderTerminalConsole();
    }

export function closeTerminalConsole() {
      panelOpen = false;
      const el = document.getElementById('terminalDrawer');
      if (el) el.classList.remove('open');
    }

export function toggleTerminalConsole() {
      if (panelOpen) closeTerminalConsole(); else openTerminalConsole();
    }

export function sendTerminalCommand(cmd) {
      history.push({ role: 'you', text: cmd });
      history.push({ role: 'terminal', text: processTerminalCommand(cmd) });
      if (history.length > 40) history.splice(0, history.length - 40);
      renderTerminalConsole();
    }

export function sendTerminalInput() {
      const input = document.getElementById('terminalInput');
      if (!input || !input.value.trim()) return;
      sendTerminalCommand(input.value);
      input.value = '';
    }

function historyLineHtml(h) {
      return h.role === 'you'
        ? `<div class="term-line term-line-you">&gt; ${h.text}</div>`
        : `<div class="term-line term-line-terminal">${h.text}</div>`;
    }

export function renderTerminalConsole() {
      const el = document.getElementById('terminalDrawer');
      if (!el) return;

      const memCount = (game.majorMemories || []).length;
      const statsEl = document.getElementById('terminalStats');
      if (statsEl) statsEl.textContent = `💠 Mémoire Chirale: ${game.chiralMemory || 0} · 📖 Souvenirs: ${memCount}`;

      const buttonsEl = document.getElementById('terminalButtons');
      if (buttonsEl && !buttonsEl.dataset.built) {
        buttonsEl.innerHTML = TERMINAL_COMMAND_LIST.map(c => `<button class="qp-action-btn term-cmd-btn" onclick="sendTerminalCommandUI('${c}')">${c}</button>`).join('');
        buttonsEl.dataset.built = '1';
      }

      const bodyEl = document.getElementById('terminalHistory');
      if (!bodyEl) return;
      bodyEl.innerHTML = history.length
        ? history.map(historyLineHtml).join('')
        : '<div class="term-line term-line-terminal">Le Terminal attend. Essaie LISTEN, ou REMEMBER.</div>';
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

export function sendTerminalCommandUI(cmd) { sendTerminalCommand(cmd); }
