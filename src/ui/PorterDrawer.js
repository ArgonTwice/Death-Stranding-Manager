// ui/PorterDrawer.js (V0.5.0) — fiche de porteur mobile, tiroir glissant (même pattern non-bloquant
// que QuestPanel.js/ConvoyPanel.js). Onglet "Résumé" pensé pour une lecture en 3 secondes: un conseil
// actionnable immédiat (ex: "⚠️ Hydrophobe -> Éviter Timefall") avant tout détail. Onglets
// Psychologie/Journal dépliables pour qui veut creuser. Cibles tactiles ≥48x48px.
import { game } from '../core/GameState.js';
import { CARGO_TYPES, JOURNAL_MILESTONES, PORTER_BACKGROUNDS, PORTER_JOYS, PORTER_PHOBIAS, ROUTE_TYPES, SKILLS } from '../data/Constants.js';
import { porterQuickSummary } from '../systems/PorterStorySystem.js';
import { dispatchDeliveryManually } from '../engine/DeliveryEngine.js';
import { closePanel, pushPanel } from '../core/NavigationManager.js';
import { collapseDrawer, openDrawer } from './DrawerManager.js';

let openPorterId = null;
let activeTab = 'resume';

function applyClosePorterDrawer() {
      openPorterId = null;
      collapseDrawer('porterDrawer');
    }

export function openPorterDrawer(porterId) {
      openPorterId = porterId;
      activeTab = 'resume';
      pushPanel('porterDrawer', applyClosePorterDrawer);
      openDrawer('porterDrawer', 'full'); // fiche détaillée: plein par défaut, plus lisible
      renderPorterDrawer();
    }

export function closePorterDrawer() {
      closePanel('porterDrawer');
    }

export function setPorterDrawerTab(tab) {
      activeTab = tab;
      renderPorterDrawer();
    }

function doomsStars(level) { return '👁️'.repeat(level) + '·'.repeat(3 - level); }

// V1.1 — dispatch manuel d'une livraison principale: le joueur choisit la destination (un des
// preppers connus du territoire actuel du porteur), le cargo et la route AVANT de l'envoyer, plutôt
// que de laisser advanceDay() tirer une destination aléatoire. Visible uniquement pour un porteur
// idle et en état de partir (mêmes conditions que l'auto-dispatch, cf. engine/DeliveryEngine.js).
function manualDispatchHtml(p) {
      if (p.status !== 'idle' || p.health <= 15 || (p.gearWear || 0) >= 100) return '';
      const d = game.mapsData[p.map];
      const knots = (d && d.mainKnots) || [];
      if (!knots.length) return '';
      const destOptions = knots.map(k => `<option value="${k.x},${k.y}">${k.name}</option>`).join('');
      const cargoOptions = Object.entries(CARGO_TYPES).map(([key, c]) => `<option value="${key}">${c.name}</option>`).join('');
      const routeOptions = Object.entries(ROUTE_TYPES).map(([key, r]) => `<option value="${key}">${r.icon} ${r.name}</option>`).join('');
      return `
        <div class="qp-card">
          <div class="qp-card-head">🎯 Dispatch manuel</div>
          <div class="qp-card-meta">Choisissez la destination, le cargo et la route de cette livraison — sinon l'auto-dispatch quotidien s'en chargera à votre place.</div>
          <select id="dispatch-dest-${p.id}" class="qp-select">${destOptions}</select>
          <select id="dispatch-cargo-${p.id}" class="qp-select">${cargoOptions}</select>
          <select id="dispatch-route-${p.id}" class="qp-select">${routeOptions}</select>
          <button class="term-card-action success" onclick="dispatchDeliveryManuallyUI(${p.id})">🚚 Envoyer</button>
        </div>`;
    }

function summaryTabHtml(p) {
      const advice = porterQuickSummary(p);
      const bg = PORTER_BACKGROUNDS[p.background];
      return `
        <div class="qp-card">
          <div class="qp-card-head">${bg ? bg.icon : '🧑'} ${p.name} — ${bg ? bg.name : '?'}</div>
          <div class="qp-card-meta">Lv${p.level} · ${SKILLS[p.skill].name} · ❤️ ${p.likes || 0} · DOOMS ${doomsStars(p.doomsLevel || 0)}</div>
          ${advice ? `<div class="porter-drawer-advice">⚠️ ${advice}</div>` : '<div class="porter-drawer-advice porter-drawer-advice-ok">✅ Aucune vulnérabilité connue en jeu actuellement</div>'}
          <div class="convoy-preview-row"><span>❤️‍🩹 Santé</span><span>${Math.ceil(p.health)}/100</span></div>
          <div class="convoy-preview-row"><span>😰 Stress</span><span class="${p.stress > 80 ? 'convoy-risk-high' : ''}">${p.stress}/100</span></div>
          <div class="convoy-preview-row"><span>🔧 Usure équip.</span><span>${p.gearWear || 0}%</span></div>
        </div>
        ${manualDispatchHtml(p)}`;
    }

function psychologyTabHtml(p) {
      const phobia = PORTER_PHOBIAS[p.phobia];
      const joy = PORTER_JOYS[p.joy];
      const traits = (p.acquiredTraitIds || []).map(id => JOURNAL_MILESTONES[id]);
      return `
        <div class="qp-card">
          <div class="qp-card-head">${phobia ? phobia.icon : '❓'} Phobie</div>
          <div class="qp-card-meta">${phobia ? `${phobia.name} — ${phobia.desc}` : 'Aucune donnée (porteur pré-V0.5.0)'}</div>
        </div>
        <div class="qp-card">
          <div class="qp-card-head">${joy ? joy.icon : '❓'} Joie</div>
          <div class="qp-card-meta">${joy ? `${joy.name} — ${joy.desc}` : 'Aucune donnée'}</div>
        </div>
        <div class="qp-card">
          <div class="qp-card-head">📖 Traits Acquis</div>
          ${traits.length ? traits.map(t => `<div class="qp-card-meta">✦ ${t.acquiredTraitName}</div>`).join('') : '<div class="qp-empty">Aucun trait acquis pour l\'instant.</div>'}
        </div>`;
    }

function journalTabHtml(p) {
      const journal = p.journal || [];
      if (!journal.length) return '<div class="qp-empty">Journal de bord vide — aucun fait marquant enregistré.</div>';
      return journal.map(entry => {
        const def = JOURNAL_MILESTONES[entry.type];
        return `<div class="qp-card qp-card-history"><div class="qp-card-head">${def ? def.icon : '📖'} ${def ? def.name : entry.type}</div><div class="qp-card-meta">mois ${entry.month}</div></div>`;
      }).join('');
    }

export function renderPorterDrawer() {
      const el = document.getElementById('porterDrawer');
      if (!el || openPorterId == null) return;
      const p = game.porters.find(x => x.id === openPorterId);
      const bodyEl = document.getElementById('porterDrawerBody');
      if (!bodyEl) return;
      if (!p) { bodyEl.innerHTML = '<div class="qp-empty">Porteur introuvable.</div>'; return; }

      document.querySelectorAll('.porter-drawer-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.pdTab === activeTab));

      if (activeTab === 'resume') bodyEl.innerHTML = summaryTabHtml(p);
      else if (activeTab === 'psychologie') bodyEl.innerHTML = psychologyTabHtml(p);
      else bodyEl.innerHTML = journalTabHtml(p);
    }

// Rafraîchit la fiche ouverte si elle correspond au porteur concerné par l'événement — appelé par
// HUD.js sur porter:fearTriggered/joyTriggered/milestoneReached/traitAcquired.
export function refreshPorterDrawerIfOpen(porterId) {
      if (openPorterId != null && (porterId == null || porterId === openPorterId)) renderPorterDrawer();
    }

// Pont UI (V1.1): lit les <select> de la carte "Dispatch manuel" au moment du clic — jamais un état
// intermédiaire conservé entre deux rendus — et délègue la validation/création de la livraison à
// engine/DeliveryEngine.js#dispatchDeliveryManually(), jamais de mutation game.* directe ici.
export function dispatchDeliveryManuallyUI(porterId) {
      const destEl = document.getElementById(`dispatch-dest-${porterId}`);
      if (!destEl || !destEl.value) return;
      const [destX, destY] = destEl.value.split(',').map(Number);
      const cargoEl = document.getElementById(`dispatch-cargo-${porterId}`);
      const routeEl = document.getElementById(`dispatch-route-${porterId}`);
      const porterIdx = game.porters.findIndex(x => x.id === porterId);
      if (porterIdx === -1) return;
      dispatchDeliveryManually(porterIdx, destX, destY, { cargoType: cargoEl ? cargoEl.value : undefined, route: routeEl ? routeEl.value : undefined });
      renderPorterDrawer();
    }
