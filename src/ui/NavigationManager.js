// ui/NavigationManager.js (V1.0.0) — Routeur UI Kairosoft à 2 niveaux (onglet PRINCIPAL: Dashboard/
// Gestion/Missions/Camp/Options, puis SOUS-onglet pour les principaux qui en ont un: Gestion ouvre une
// liste tactile Porteurs/Boutique/Flotte). Construit AU-DESSUS de core/NavigationManager.js (pile
// history.pushState pour le bouton Retour physique, INCHANGÉE, réutilisée telle quelle: pushPanel()
// reste le seul point d'entrée qui touche history.*, ce module ne fait qu'enregistrer ses propres
// callbacks apply()).
//
// RÈGLE D'ISOLATION (V1.0.0 règle 1): ce module ne touche JAMAIS game.*, ne consomme JAMAIS
// RNG.next(), ne déclenche JAMAIS advanceDay()/tick(). Purement de la plomberie d'affichage
// (classes CSS + historique UI) — au même titre que core/NavigationManager.js.
import { closePanel, isPanelOpen, pushPanel } from '../core/NavigationManager.js';
import { eventBus } from '../core/EventBus.js';

export const MAIN_TABS = ['dashboard', 'gestion', 'missions', 'camp', 'options'];

// Onglets principaux qui s'ouvrent d'abord sur une liste de sous-menu (V1.0.0 règle 2) plutôt que
// directement sur du contenu. Missions/Camp/Options affichent leur contenu directement (Options gère
// ses 2 volets Système/Gestion en interne, cf. OptionsPanel.js — un simple filtre, pas une navigation
// à historiser).
const SUBMENU_TABS = new Set(['gestion']);

let currentMain = 'dashboard';
let currentSub = null;

function applyCloseSub() {
      currentSub = null;
      renderNavState();
    }

function applyCloseMainNav() {
      currentMain = 'dashboard';
      currentSub = null;
      renderNavState();
    }

export function currentMainTab() { return currentMain; }
export function currentSubTab() { return currentSub; }

// Affiche/masque les blocs DOM correspondant à l'état courant + l'onglet actif de la barre basse.
// Convention CSS (voir css/theme.css): tout bloc `.nav-sub-menu`/`.nav-sub-content`/`.nav-main-content`
// est display:none par défaut, `.active` le rend visible — jamais de manipulation directe de style.
function renderNavState() {
      document.querySelectorAll('.mtab-btn[data-tab]').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === currentMain);
      });
      const modal = document.getElementById('mainNavModal');
      if (modal) modal.classList.toggle('open', currentMain !== 'dashboard');

      document.querySelectorAll('.nav-sub-menu').forEach(el => {
        el.classList.toggle('active', el.dataset.main === currentMain && currentSub === null);
      });
      document.querySelectorAll('.nav-sub-content').forEach(el => {
        el.classList.toggle('active', el.dataset.main === currentMain && el.dataset.sub === currentSub);
      });
      document.querySelectorAll('.nav-main-content').forEach(el => {
        el.classList.toggle('active', el.dataset.main === currentMain && !SUBMENU_TABS.has(currentMain));
      });

      const panel = modal && modal.querySelector('.panel');
      if (panel) panel.scrollTop = 0;

      // V1.0.1 — pur événement de plomberie UI (aucune donnée de partie), consommé par
      // TutorialManager.js pour re-cibler son highlight/sa progression à chaque bascule de vue.
      // N'enfreint pas la règle d'isolation: ce module ignore totalement qui écoute et pourquoi.
      eventBus.emit('nav:mainTabChanged', { main: currentMain, sub: currentSub });
    }

// Bascule l'onglet PRINCIPAL. [Dashboard] referme tout et révèle la Carte (comportement "maison" —
// aucun contenu de Dashboard à afficher en plus: la Carte + le journal SONT le tableau de bord).
export function setMainTab(tabId) {
      if (!MAIN_TABS.includes(tabId)) return;
      if (tabId === 'dashboard') { closeMainNav(); return; }
      const wasClosed = currentMain === 'dashboard';
      currentMain = tabId;
      currentSub = null;
      if (wasClosed) pushPanel('mainNav', applyCloseMainNav);
      else if (isPanelOpen('mainNavSub')) closePanel('mainNavSub'); // changer d'onglet referme un sous-menu ouvert (idempotent, ne repousse jamais mainNav)
      renderNavState();
    }

export function closeMainNav() {
      if (currentMain === 'dashboard') return;
      closePanel('mainNav'); // dépile aussi mainNavSub au passage si ouvert (onPopState traverse les 2 apply() dans l'ordre)
    }

// Ouvre un sous-onglet (ex: Gestion -> Porteurs) — historisé: le bouton Retour referme d'abord le
// sous-onglet (retour à la liste), jamais directement au Dashboard.
export function setSubTab(subId) {
      if (currentMain === 'dashboard' || !SUBMENU_TABS.has(currentMain)) return;
      currentSub = subId;
      if (!isPanelOpen('mainNavSub')) pushPanel('mainNavSub', applyCloseSub);
      renderNavState();
    }

export function closeSubTab() {
      if (!isPanelOpen('mainNavSub')) { currentSub = null; renderNavState(); return; }
      closePanel('mainNavSub');
    }

export function initMainNav() {
      renderNavState();
    }
