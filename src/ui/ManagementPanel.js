// ui/ManagementPanel.js (V1.1 LOT 2, ex-V1.0.0) — sous-menu [Logistique] Kairosoft (ex-[Gestion]):
// liste tactile aérée (Porteurs / Boutique & Ressources / Flotte de Véhicules / Archives & Sponsors),
// point d'entrée vers les vues de contenu existantes (mêmes ids DOM, mêmes onclick, aucune logique
// changée — seul le 4e sous-onglet "archives" est nouveau, regroupant sponsor/infra/Hall of
// Fame/Musée/Plate Gate, déplacés depuis l'ancien onglet Camp — cf. index.html). Purement
// présentationnel.
import { game } from '../core/GameState.js';
import { setSubTab } from './NavigationManager.js';

const SUB_ITEMS = [
      { id: 'porters', icon: '🎒', label: 'Porteurs', desc: 'Recrutement, équipement individuel' },
      { id: 'shop', icon: '🛒', label: 'Boutique & Ressources', desc: 'Chaudron chiral, installations, PCC' },
      { id: 'fleet', icon: '🚚', label: 'Flotte de Véhicules', desc: 'Camions, motos, trikes' },
      { id: 'archives', icon: '🏆', label: 'Archives & Sponsors', desc: 'Sponsors, Hall of Fame, Musée, Plate Gate' }
    ];

export function renderManagementSubMenu() {
      const el = document.getElementById('managementSubMenu');
      if (!el) return;
      const activeCount = game.porters.filter(p => p.status !== 'dead' && p.status !== 'left').length;
      const badges = { porters: activeCount };
      el.innerHTML = SUB_ITEMS.map(it => `
        <button class="nav-sub-item" onclick="setManagementSubTab('${it.id}')">
          <span class="nav-sub-item-ico">${it.icon}</span>
          <span class="nav-sub-item-text">
            <span class="nav-sub-item-label">${it.label}</span>
            <span class="nav-sub-item-desc">${it.desc}</span>
          </span>
          ${badges[it.id] != null ? `<span class="nav-sub-item-badge">${badges[it.id]}</span>` : ''}
          <span class="nav-sub-item-arrow">›</span>
        </button>`).join('');
    }

export function setManagementSubTab(id) { setSubTab(id); }
