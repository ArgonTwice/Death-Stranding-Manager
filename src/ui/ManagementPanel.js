// ui/ManagementPanel.js (V1.0.0) — sous-menu [Gestion] Kairosoft: liste tactile aérée (Porteurs /
// Boutique & Ressources / Flotte de Véhicules), point d'entrée vers les 3 vues de contenu existantes
// (déplacées telles quelles depuis l'ancien onglet "gestion" V0.7.0-V0.9.8 — mêmes ids DOM, mêmes
// onclick, aucune logique changée). Purement présentationnel.
import { game } from '../core/GameState.js';
import { setSubTab } from './NavigationManager.js';

const SUB_ITEMS = [
      { id: 'porters', icon: '🎒', label: 'Porteurs', desc: 'Recrutement, équipement individuel' },
      { id: 'shop', icon: '🛒', label: 'Boutique & Ressources', desc: 'Chaudron chiral, installations, PCC' },
      { id: 'fleet', icon: '🚚', label: 'Flotte de Véhicules', desc: 'Camions, motos, trikes' }
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
