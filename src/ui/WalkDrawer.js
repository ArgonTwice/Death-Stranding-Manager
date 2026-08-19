// ui/WalkDrawer.js (V0.8.0) — tiroir tactile "Porteur IRL / Podomètre Chiral", même pattern
// nav-aware que les autres tiroirs (QuestPanel.js/TerminalConsole.js): NavigationManager pour le
// bouton Retour, DrawerManager pour la physique bottom-sheet. Design System V0.7.5 (TerminalCard,
// StatusBadge, jauges fines, boutons ≥48px). Purement présentationnel: délègue toute la logique de
// conversion à WalkSession.js/RealWalkSystem.js, jamais d'accès direct à game.*/RNG.js ici.
import { game } from '../core/GameState.js';
import { BALANCE } from '../data/Balance.js';
import { eventBus } from '../core/EventBus.js';
import { closePanel, isPanelOpen, pushPanel } from '../core/NavigationManager.js';
import { collapseDrawer, openDrawer } from './DrawerManager.js';
import { activateRealWalk, deactivateRealWalk, walkSessionState } from '../systems/WalkSession.js';
import { recordSteps, realWalkSpeedBonusMult, totalChiralKm } from '../systems/RealWalkSystem.js';
import { bbPodState } from '../systems/BBPodSystem.js';
import { terminalCardHtml } from './components/TerminalCard.js';
import { statusBadgeHtml } from './components/StatusBadge.js';

function applyCloseWalkDrawer() {
      collapseDrawer('walkDrawer');
    }

export function openWalkDrawer() {
      pushPanel('walkDrawer', applyCloseWalkDrawer);
      openDrawer('walkDrawer', 'peek');
      renderWalkDrawer();
    }

export function closeWalkDrawer() { closePanel('walkDrawer'); }

export function toggleWalkDrawer() {
      if (isPanelOpen('walkDrawer')) closeWalkDrawer(); else openWalkDrawer();
    }

const SENSOR_STATUS_LABEL = {
      idle: { label: 'Capteur inactif', tone: 'common', icon: '⏸️' },
      active: { label: 'Capteur actif', tone: 'legendary', icon: '👟' },
      denied: { label: 'Permission refusée', tone: 'danger', icon: '🚫' },
      unsupported: { label: 'Capteur indisponible', tone: 'common', icon: '💻' }
    };

// Pont UI: demande explicite de permission ("Activer le mode Porteur"), jamais automatique
// (règle 4 — opt-in total). useMock réservé aux tests (jamais déclenché depuis un vrai bouton UI).
export async function requestRealWalkActivation() {
      await activateRealWalk(false);
      renderWalkDrawer();
    }

export function stopRealWalk() {
      deactivateRealWalk();
      renderWalkDrawer();
    }

// Boost manuel (règle 4: un joueur sédentaire/PC peut tout faire sans capteur) — ajoute un petit lot
// de pas d'un tap, exactement comme la commande Terminal STEPS mais accessible en un geste tactile.
export function addManualWalkBoost(amount) {
      recordSteps(amount);
      renderWalkDrawer();
    }

function sensorCardHtml() {
      const s = walkSessionState();
      const info = SENSOR_STATUS_LABEL[s.sensorStatus] || SENSOR_STATUS_LABEL.idle;
      const active = s.sensorStatus === 'active';
      // V1.1 — le moteur (systems/WalkSession.js#activateRealWalk) refuse déjà de démarrer si
      // !game.progression.realWalk.unlocked; ce garde ne fait que refléter ce même verrou dans l'UI
      // (bouton désactivé + message clair) plutôt que de laisser le joueur cliquer dans le vide.
      const unlocked = !!(game.progression && game.progression.realWalk && game.progression.realWalk.unlocked);
      if (!active && !unlocked) {
        return terminalCardHtml({
          title: '📡 Capteur de mouvement',
          subtitle: 'Raccordez un premier nœud au Réseau Chiral (onglet Camp) pour débloquer le mode Porteur IRL.',
          rarity: 'common',
          badgesHtml: statusBadgeHtml('🔒 Verrouillé', 'common', '🔒'),
          actionsHtml: `<button class="term-card-action" disabled>👟 Activer le mode Porteur</button>`
        });
      }
      return terminalCardHtml({
        title: '📡 Capteur de mouvement',
        subtitle: active ? 'Vos pas réels alimentent le réseau chiral.' : 'Optionnel — le jeu reste 100% jouable sans capteur.',
        rarity: active ? 'legendary' : 'common',
        badgesHtml: statusBadgeHtml(info.label, info.tone, info.icon),
        actionsHtml: active
          ? `<button class="term-card-action danger" onclick="stopRealWalkUI()">⏹️ Désactiver</button>`
          : `<button class="term-card-action success" onclick="requestRealWalkActivationUI()">👟 Activer le mode Porteur</button>`
      });
    }

function statsCardHtml() {
      const s = walkSessionState();
      const total = game.totalSteps || 0;
      const km = totalChiralKm();
      const B = BALANCE.realWalk;
      const nextMilestone = (Math.floor(total / B.milestoneStepInterval) + 1) * B.milestoneStepInterval;
      const progressPct = ((total % B.milestoneStepInterval) / B.milestoneStepInterval) * 100;
      const speedBonusPct = Math.round((1 - realWalkSpeedBonusMult()) * 100);
      return terminalCardHtml({
        title: '👟 Podomètre Chiral',
        subtitle: `${total.toLocaleString('fr-FR')} pas cumulés · ${km} km chiraux`,
        rarity: 'epic',
        badgesHtml: statusBadgeHtml(`Session: ${s.sessionSteps}`, 'rare') + (speedBonusPct > 0 ? statusBadgeHtml(`Livraisons +${speedBonusPct}% rapides`, 'epic', '🚀') : ''),
        gauges: [{ label: `Prochain palier (${nextMilestone} pas)`, value: progressPct, valueLabel: `${total % B.milestoneStepInterval}/${B.milestoneStepInterval}` }],
        actionsHtml: `
          <button class="term-card-action" onclick="addManualWalkBoostUI(50)">+50 pas (boost manuel)</button>
          <button class="term-card-action" onclick="addManualWalkBoostUI(500)">+500 pas (boost manuel)</button>`
      });
    }

function bbPodCardHtml() {
      const pod = bbPodState();
      return terminalCardHtml({
        title: '🎒 BB Pod — Apaisement',
        subtitle: 'Marcher IRL réduit le stress du BB Pod (règle poétique V0.8.0).',
        rarity: 'rare',
        gauges: [{ label: 'Stress BB Pod', value: pod.stress, valueLabel: `${Math.round(pod.stress)}/100` }],
        bodyHtml: `Chaque ${BALANCE.realWalk.stressReductionStepInterval} pas retire ${BALANCE.realWalk.stressReductionPct} points de stress.`
      });
    }

export function renderWalkDrawer() {
      const el = document.getElementById('walkDrawer');
      if (!el) return;
      const bodyEl = document.getElementById('walkDrawerBody');
      if (!bodyEl) return;
      bodyEl.innerHTML = sensorCardHtml() + statsCardHtml() + bbPodCardHtml();

      // Badge compact du header (pill V0.7.5) — mis à jour ici plutôt qu'à chaque pas individuel:
      // walk:stepDetected est throttled par le cooldown capteur (300ms mini), donc déjà loin d'un
      // spam 60Hz, mais on évite quand même de re-render tout le HUD à chaque appel.
      const badgeEl = document.getElementById('sbSteps');
      if (badgeEl) badgeEl.textContent = (game.totalSteps || 0).toLocaleString('fr-FR');
    }

// Rafraîchit uniquement si le tiroir est ouvert (évite du travail DOM inutile en arrière-plan) —
// même pattern que refreshPorterDrawerIfOpen/refreshInspectorIfOpen.
export function refreshWalkDrawerIfOpen() {
      const el = document.getElementById('walkDrawer');
      if (el && !el.classList.contains('state-collapsed')) renderWalkDrawer();
    }

export function requestRealWalkActivationUI() { requestRealWalkActivation(); }
export function stopRealWalkUI() { stopRealWalk(); }
export function addManualWalkBoostUI(amount) { addManualWalkBoost(amount); }

// Toujours tenir le badge du header à jour même tiroir fermé, et rafraîchir le tiroir s'il est ouvert
// — les deux événements sont déjà throttled en amont (StepDetector: cooldown 300ms ; RealWalkSystem:
// walk:milestone tous les 100 pas), jamais un flot brut d'échantillons accéléromètre.
eventBus.on('walk:stepDetected', () => {
      const badgeEl = document.getElementById('sbSteps');
      if (badgeEl) badgeEl.textContent = ((typeof game !== 'undefined' && game.totalSteps) || 0).toLocaleString('fr-FR');
      refreshWalkDrawerIfOpen();
    });
eventBus.on('walk:milestone', () => refreshWalkDrawerIfOpen());
eventBus.on('walk:sensorStatusChanged', () => refreshWalkDrawerIfOpen());
