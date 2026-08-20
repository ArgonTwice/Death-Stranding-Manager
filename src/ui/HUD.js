// AUTO-EXTRACTED MODULE: ui/HUD.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { pauseForMessage, setGameSpeed } from '../core/GameLoop.js';
import { eventBus } from '../core/EventBus.js';
import { DEBUG } from '../core/Debug.js';
import { checkRankUp, currentRankIndex, game, logEvent, runtime } from '../core/GameState.js';
import { RNG } from '../core/RNG.js';
import { BALANCE, DAYS_PER_MONTH, GAME_LENGTH_MONTHS, MAP_HEIGHT, MAP_WIDTH, RANKS, STRUCTURE_MIN_RANK } from '../data/Balance.js';
import { CAMP_TRAIT_LABELS, COUNTRIES, GRADES, JOURNAL_MILESTONES, LEAGUE_TIERS, PCC_TYPES, PORTER_BACKGROUNDS, PORTER_PHOBIAS, PREPPER_ARCHETYPES, RECIPES, RELICS, ROUTE_TYPES, SKILLS, SPONSORS, STRUCTURES, TITLES, TRAITS, cellKey, countryInfo, gradeLevel } from '../data/Constants.js';
import { assaultCamp, convertCampToRelay, defendRelay, engageCatcher, fortifyRelay, sendToIncinerator } from '../engine/CombatEngine.js';
import { acceptVisitorOffer, craft, dismissVisitor, launchQuestFromUI, sendDelivery } from '../engine/DeliveryEngine.js';
import { dominantStructure, setActiveBranch, switchMap } from '../engine/MapEngine.js';
import { computeScore } from '../persistence/SaveManager.js';
import { migratePrepperKnot } from '../persistence/SaveMigrations.js';
import { setAutomationThreshold, toggleAutomation } from '../systems/AutomationManager.js';
import { buildStructure, computeLogisticsDashboard, infraCost, investInfrastructure, shopDiscountMult, signSponsor } from '../systems/EconomySystem.js';
import { repairPCC } from '../systems/NetworkSystem.js';
import { beachJump, equipSlots, equippedCount, forceRest, hire, porterTitle, repairGear, retirePorter } from '../systems/PorterSystem.js';
import { assignPrepperContract, connectKnot, maxPrepperStars, negotiatePrepperContract, prepperStarsLabel, revealedMainKnots, silhouetteMainKnots } from '../systems/PrepperSystem.js';
import { EQUIP_MIN_STARS, ROBOT_BUDDY_MIN_STARS, VEHICLE_MIN_STARS } from '../data/UnlockTree.js';
import { isRobotBuddyUnlocked, robotBuddyCost, robotBuddyCount } from '../systems/RobotBuddySystem.js';
import { porterLeagueTier } from '../systems/PorterLeague.js';
import { generateTelemetryReport } from '../systems/TelemetrySystem.js';
import { currentWeatherLabel, forecastFor } from '../systems/WeatherSystem.js';
import { renderBBPodOverlay, showBBPodAlert } from './BBPodOverlay.js';
import { renderTerminalConsole } from './TerminalConsole.js';
import { renderWalkDrawer } from './WalkDrawer.js';
import { renderRaidTrackingDrawer } from './RaidTrackingDrawer.js';
import { checkTutorialProgress } from './TutorialManager.js';
import { closePanel, isPanelOpen, pushPanel } from '../core/NavigationManager.js';
import { collapseDrawer, openDrawer } from './DrawerManager.js';
import { refreshInspectorIfOpen } from './CanvasInspector.js';
import { renderConvoyPanel } from './ConvoyPanel.js';
import { renderHallOfFamePanel } from './HallOfFamePanel.js';
import { drawMap } from './MapRenderer.js';
import { renderMiniMap } from './MiniMap.js';
import { refreshPorterDrawerIfOpen } from './PorterDrawer.js';
import { renderQuestPanel } from './QuestPanel.js';
import { terminalCardHtml } from './components/TerminalCard.js';
import { terminalStepperHtml } from './components/TerminalStepper.js';
import { rarityBadgeHtml, statusBadgeHtml } from './components/StatusBadge.js';

// V1.0.7 — dirty-check anti-flickering: render() tourne jusqu'à 1x/seconde (chaque jour simulé,
// core/GameLoop.js#startGameClock émet 'render:request'), donc les panneaux de l'onglet Camp
// (structures/sponsors/camps/ressources) étaient réinjectés via innerHTML même quand RIEN n'avait
// changé — détruisant puis recréant les nœuds DOM, ce qui relance leurs animations CSS d'entrée
// (.term-card { animation: cb-slide-up }) et se voit comme un clignotement. setInnerHtmlIfChanged()
// compare le HTML final déjà calculé (jamais une approximation de ses dépendances internes — donc
// aucun risque d'oubli qui laisserait un panneau figé sur du contenu périmé) et n'écrit dans le DOM
// que s'il a réellement changé depuis le dernier appel. Clé = l'élément DOM lui-même (Map), jamais
// une chaîne d'id à maintenir en synchro.
const lastRenderedHtml = new WeakMap();
function setInnerHtmlIfChanged(el, html) {
      if (!el) return false;
      if (lastRenderedHtml.get(el) === html) return false;
      lastRenderedHtml.set(el, html);
      el.innerHTML = html;
      return true;
    }

// V0.7.5 — pont Stepper: même mutation que l'ancien input[type=number] (setAutomationThreshold),
// juste un delta relatif au lieu d'une saisie libre. Purement UI, aucun impact RNG/simulation.
export function adjustAutomationThreshold(key, delta) {
      const current = (game.automation && game.automation[key]) || 0;
      setAutomationThreshold(key, current + delta);
    }

export function showEndScreen(score, scoresList) {
      const totalRoutes = Object.values(game.mapsData).reduce((s, d) => s + d.routes.size, 0);
      const rows = (scoresList || []).map((s, i) =>
        `<div>${i + 1}. ${s.score} pts — $${s.money}, ${s.completed} livraisons, ${s.deaths} pertes (${s.date})</div>`
      ).join('') || 'Aucun score précédent';
      document.getElementById('endScreenBody').innerHTML = `
        Trésorerie finale: $${game.money}<br>
        Livraisons complétées: ${game.completed}<br>
        Néantisations: ${game.deaths}<br>
        Réputation Bridges: ${game.reputation}/100<br>
        Réseau chiral total: ${totalRoutes} cases<br>
        Territoires connectés: ${Object.keys(game.mapsData).length}/${COUNTRIES.length}<br>
        <div style="font-size:20px; margin-top:12px; color:#4ad9e0;">SCORE: ${score}</div>
        <div style="margin-top:16px; font-size:11px; text-align:left; max-width:300px;">
          <div style="text-align:center; color:#ff8c2b; margin-bottom:4px;">🏆 MEILLEURS SCORES (cet appareil)</div>
          ${rows}
        </div>`;
      document.getElementById('endScreen').style.display = 'flex';
    }

export function render() {
      renderStatBar();
      renderMapToggle();
      renderPorters();
      renderStats();
      updateUnlocks();
      renderMainKnots();
      renderSideQuests();
      renderStructures();
      const pccHintEl = document.getElementById('pccModeHint');
      if (pccHintEl) pccHintEl.textContent = runtime.placingPCC ? `🏗️ Clique sur la carte pour poser: ${PCC_TYPES[runtime.placingPCC].name}` : '';
      renderCauldron();
      renderCandidate();
      renderRobotBuddyPanel();
      renderCampInfo();
      renderSponsor();
      renderInfra();
      renderPorterTarget();
      renderAutomationPanel();
      renderLogisticsDashboard();
      renderCommandCenter();
      renderWeatherForecast();
      renderDashboardSynthesis();
      renderMiniMap();
      renderQuestPanel();
      renderConvoyPanel();
      renderTelemetryReport();
      renderHallOfFamePanel();
      renderBBPodOverlay();
      renderTerminalConsole();
      renderWalkDrawer();
      renderRaidTrackingDrawer();
      refreshPorterDrawerIfOpen();
      refreshInspectorIfOpen();
      renderDebugHud();
      checkTutorialProgress(); // V1.0.1 — auto-validation d'étape à chaque render, jamais de RNG ici
      // drawMap tourne en boucle continue (rAF) depuis l'init, pas besoin de la relancer ici
    }

// V0.4.0 — rapport de performance logistique (TelemetrySystem.js): taux de réussite des convois,
// taux d'utilisation des Abris Anti-Timefall, meilleur rendement par type d'itinéraire.
// Tiroirs Télémétrie / Porteurs / Réseau (V0.7.0) — extraits de l'ancien onglet mobile plein écran,
// même pattern nav-aware que les autres tiroirs (QuestPanel.js etc.): apply() ferme visuellement
// sans jamais toucher l'historique, open()/close() délèguent à NavigationManager.
function applyCloseTelemetryDrawer() { collapseDrawer('telemetryDrawer'); }
export function openTelemetryDrawer() {
      pushPanel('telemetryDrawer', applyCloseTelemetryDrawer);
      openDrawer('telemetryDrawer', 'peek');
      renderTelemetryReport();
    }
export function closeTelemetryDrawer() { closePanel('telemetryDrawer'); }
export function toggleTelemetryDrawer() {
      if (isPanelOpen('telemetryDrawer')) closeTelemetryDrawer(); else openTelemetryDrawer();
    }

function applyClosePortersDrawer() { collapseDrawer('portersDrawer'); }
export function openPortersDrawer() {
      pushPanel('portersDrawer', applyClosePortersDrawer);
      openDrawer('portersDrawer', 'full');
      renderPorters();
    }
export function closePortersDrawer() { closePanel('portersDrawer'); }
export function togglePortersDrawer() {
      if (isPanelOpen('portersDrawer')) closePortersDrawer(); else openPortersDrawer();
    }

function applyCloseNetworkDrawer() { collapseDrawer('networkDrawer'); }
export function openNetworkDrawer() {
      pushPanel('networkDrawer', applyCloseNetworkDrawer);
      openDrawer('networkDrawer', 'peek');
      renderStats();
    }
export function closeNetworkDrawer() { closePanel('networkDrawer'); }
export function toggleNetworkDrawer() {
      if (isPanelOpen('networkDrawer')) closeNetworkDrawer(); else openNetworkDrawer();
    }

export function renderTelemetryReport() {
      const el = document.getElementById('telemetryPanel');
      if (!el) return;
      const t = generateTelemetryReport();
      const pct = v => v == null ? '—' : `${v}%`;
      const routeLabel = { express: '🛡️ Chiral-Express', shortcut: '👹 Raccourci Temporel', contraband: '🏴‍☠️ Contrebande', none: '🚶 Hors itinéraire' };
      el.innerHTML = `
        <div class="stat-line"><span class="stat-label">Convois lancés</span><span class="stat-val">${t.convoysLaunched}</span></div>
        <div class="stat-line"><span class="stat-label">Taux réussite convois</span><span class="stat-val">${pct(t.convoySuccessRate)}</span></div>
        <div class="stat-line"><span class="stat-label">Convois partiels</span><span class="stat-val">${t.convoysArrivedPartial}</span></div>
        <div class="stat-line"><span class="stat-label">Utilisation Abris Anti-Timefall</span><span class="stat-val">${pct(t.shelterUtilization)}</span></div>
        <div class="stat-line"><span class="stat-label">Taux réussite livraisons</span><span class="stat-val">${pct(t.deliverySuccessRate)}</span></div>
        <div class="stat-line"><span class="stat-label">Meilleur rendement</span><span class="stat-val">${t.bestRouteType ? routeLabel[t.bestRouteType] : '—'}</span></div>`;
    }

// V0.3.0 — Chiral Forecast: météo actuelle + prévision à N jours du territoire affiché, sur le
// bandeau de statut au-dessus de la carte. Mis à jour aussi par eventBus ('weather:forecastUpdated')
// pour un retour immédiat au changement de météo, sans attendre le prochain render() global.
// V1.16.0 — "Centre de Commande Actionnable": 3 cartes répondant chacune à une question en <5s
// (brief). Purement dérivé de game.* déjà lu ailleurs (mêmes fonctions que renderMainKnots/
// renderMuleCamps/renderWeatherForecast/renderDashboardSynthesis ci-dessous, jamais dupliquées),
// lecture seule — aucune action possible depuis ces cartes, seulement une orientation vers l'onglet
// pertinent (Livraisons/Réseau). Les statistiques passives préexistantes (indicateurs "EN LIGNE"
// décoratifs, prévision météo détaillée, synthèse réseau/MULE) sont déplacées dans le tiroir
// Télémétrie (index.html) plutôt que supprimées — mêmes ids DOM, mêmes fonctions de rendu inchangées.
export function renderCommandCenter() {
      const el = document.getElementById('dashboardCommandCenter');
      if (!el) return;
      const d = game.mapsData[game.currentMap];

      // Carte 1 — Action Prioritaire: la quête urgente la plus proche de l'expiration sur CE
      // territoire, sinon le nombre de porteurs disponibles pour une commande, sinon "rien à faire".
      const urgent = (game.urgentQuests || []).filter(q => q.mapKey === game.currentMap).sort((a, b) => a.expiresDay - b.expiresDay);
      let actionBody;
      if (urgent.length) {
        const q = urgent[0];
        actionBody = `${q.icon} ${q.flavor} — <b>+$${q.reward}</b> · expire J${q.expiresDay}`;
      } else {
        const idleCount = game.porters.filter(p => p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100).length;
        actionBody = idleCount > 0 ? `🚚 ${idleCount} porteur(s) disponible(s) — direction Livraisons` : 'Réseau en ordre — aucune action requise';
      }

      // Carte 2 — Alerte Terrain: prochain Timefall/Tempête Chirale dans la fenêtre de prévision,
      // relais sous attaque (priorité) ou camps MULE hostiles sur ce territoire.
      const forecast = d ? forecastFor(game.currentMap) : [];
      const nextBadIdx = forecast.findIndex(f => f.type !== 'calm');
      const camps = (d && d.muleCamps) || [];
      const hostileCount = camps.filter(c => c.status === 'hostile').length;
      const underAttackCount = camps.filter(c => c.status === 'under_attack').length;
      const terrainParts = [];
      if (nextBadIdx >= 0) terrainParts.push(`${forecast[nextBadIdx].icon} ${forecast[nextBadIdx].name} dans J+${nextBadIdx + 1}`);
      if (underAttackCount > 0) terrainParts.push(`🚨 ${underAttackCount} relais sous attaque`);
      else if (hostileCount > 0) terrainParts.push(`⚠️ ${hostileCount} camp(s) MULE hostile(s)`);
      const terrainBody = terrainParts.length ? terrainParts.join(' · ') : '✅ Aucune alerte';

      // Carte 3 — Progression Réseau: prochain relais à raccorder + étoiles Prepper (déblocages boutique).
      let networkBody = '—';
      if (d) {
        const knots = revealedMainKnots(d);
        const connectedCount = knots.filter(k => d.routes.has(cellKey(k.x, k.y))).length;
        const nextKnot = knots.find(k => !d.routes.has(cellKey(k.x, k.y)));
        const stars = maxPrepperStars(game.currentMap);
        const nextThresholds = [...Object.values(EQUIP_MIN_STARS), ...Object.values(VEHICLE_MIN_STARS), ROBOT_BUDDY_MIN_STARS].filter(s => s > stars);
        const nextThreshold = nextThresholds.length ? Math.min(...nextThresholds) : null;
        networkBody = `${connectedCount}/${(d.mainKnots || []).length} relais raccordés${nextKnot ? ` · prochain: ${nextKnot.name}` : ''}<br>⭐ ${stars}/${BALANCE.prepper.starsMax}${nextThreshold ? ` — encore ${nextThreshold - stars}⭐ pour débloquer plus d'équipement` : ''}`;
      }

      setInnerHtmlIfChanged(el, `
        <div class="term-card cc-card"><div class="cc-card-title">🎯 Action Prioritaire</div><div class="cc-card-body">${actionBody}</div></div>
        <div class="term-card cc-card"><div class="cc-card-title">⚠️ Alerte Terrain</div><div class="cc-card-body">${terrainBody}</div></div>
        <div class="term-card cc-card"><div class="cc-card-title">📡 Progression Réseau</div><div class="cc-card-body">${networkBody}</div></div>
      `);
    }

export function renderWeatherForecast() {
      const el = document.getElementById('weatherForecastStrip');
      if (!el) return;
      const current = currentWeatherLabel(game.currentMap);
      const forecast = forecastFor(game.currentMap);
      el.innerHTML = `<span class="voyant">${current.icon} ${current.name}</span>` +
        forecast.map((f, i) => `<span class="voyant wf-forecast">J+${i + 1} ${f.icon}</span>`).join('');
    }

// V1.1 LOT 2 — Dashboard: "Vue synthétique en lecture seule" (alertes MULE/BT, statut du Réseau
// Chiral, résumé d'expédition). Purement dérivé de game.* déjà lu ailleurs (renderMainKnots/
// renderMuleCamps/RaidTrackingDrawer) — aucun nouvel état, aucune action possible depuis ce bandeau
// (lecture seule, conforme à la règle du brief). Toujours à jour via render() (dirty-check inclus).
export function renderDashboardSynthesis() {
      const el = document.getElementById('dashboardSynthesisStrip');
      if (!el) return;
      const d = game.mapsData[game.currentMap];
      // V1.4.0 — "Brumes de guerre": le dénominateur reflète les Preppers RÉVÉLÉS (raccordés + le
      // plus proche non raccordé), pas le total réel du territoire — sinon "2/4 raccordés" annoncerait
      // 2 villes que le panneau Réseau (renderMainKnots) ne montre pas encore.
      const knots = d ? revealedMainKnots(d) : [];
      const connectedCount = d ? knots.filter(k => d.routes.has(cellKey(k.x, k.y))).length : 0;
      const camps = game.muleCamps || [];
      const hostileCount = camps.filter(c => c.status === 'hostile').length;
      // V1.14.0 — un relais 'under_attack' n'apparaissait dans AUCUN indicateur toujours visible (ni ici
      // ni ailleurs sur le Dashboard): seul un tour manuel dans l'onglet Réseau le révélait. Distingué
      // ici avec sa propre icône plutôt que noyé dans hostileCount (sémantique différente: un relais
      // perdu tombera aux MULEs si ignoré, un camp hostile ne fait qu'attendre d'être assailli).
      const underAttackCount = camps.filter(c => c.status === 'under_attack').length;
      const catcherCount = (game.catchers || []).length;
      const enRoute = (game.deliveries || []).filter(x => x.status !== 'delivered' && x.status !== 'failed').length;
      const raidActive = game.activeRaid && game.activeRaid.status === 'active';
      setInnerHtmlIfChanged(el,
        `<span class="voyant"><span class="dot${connectedCount > 0 ? '' : ' dot-amber'}"></span> RÉSEAU CHIRAL: ${connectedCount}/${knots.length} raccordés</span>` +
        `<span class="voyant"><span class="dot${(hostileCount > 0 || underAttackCount > 0 || catcherCount > 0) ? ' dot-purple' : ''}"></span> ${underAttackCount > 0 ? `🚨 ${underAttackCount} relais sous attaque` : (hostileCount > 0 ? `⚠️ ${hostileCount} camp(s) MULE hostile(s)` : '✅ Aucune menace MULE')}${catcherCount > 0 ? ` · 👹 BT: ${catcherCount} Catcher` : ''}</span>` +
        `<span class="voyant">🚚 ${enRoute} livraison(s) en cours${raidActive ? ' · 🎯 Raid en cours' : ''}</span>`);
    }

// HUD DE DEBUG — overlay discret (coin bas-droit), actif uniquement avec ?debug=1 dans l'URL.
// Affiche la seed RNG courante pour pouvoir reproduire une partie/un bug exactement.
let debugHudEl = null;
export function renderDebugHud() {
      if (!DEBUG) return;
      if (!debugHudEl) {
        debugHudEl = document.createElement('div');
        debugHudEl.id = 'debugHud';
        debugHudEl.style.cssText = 'position:fixed; right:6px; bottom:64px; z-index:900; background:rgba(10,9,7,0.85); border:1px solid rgba(255,140,43,0.3); color:#ff8c2b; font-family:"Share Tech Mono",monospace; font-size:9px; padding:4px 8px; letter-spacing:0.5px; pointer-events:none;';
        document.body.appendChild(debugHudEl);
      }
      debugHudEl.textContent = `RNG seed: ${RNG.getSeed()} · mois ${game.month} j${game.dayInMonth}`;
    }

let lastBarMoney = null;

export function renderStatBar() {
      const moneyEl = document.getElementById('sbMoney');
      if (!moneyEl) return;
      if (lastBarMoney !== null && game.money !== lastBarMoney) {
        const delta = game.money - lastBarMoney;
        const pop = document.createElement('span');
        pop.textContent = (delta >= 0 ? '+$' : '-$') + Math.abs(Math.round(delta));
        pop.className = 'money-pop ' + (delta >= 0 ? 'pop-good' : 'pop-bad');
        document.getElementById('statBarMoney').appendChild(pop);
        setTimeout(() => pop.remove(), 1350);
      }
      lastBarMoney = game.money;
      // V0.7.5 — pill de header compacte: format abrégé (117k) pour ne jamais tronquer/déborder,
      // valeur exacte conservée en title (au survol desktop) — purement présentationnel.
      const m = Math.round(game.money);
      moneyEl.textContent = Math.abs(m) >= 1000 ? `$${(m / 1000).toFixed(1).replace(/\.0$/, '')}k` : `$${m}`;
      moneyEl.title = `$${m.toLocaleString('fr-FR')}`;
      document.getElementById('sbMonth').textContent = `${game.month}/${GAME_LENGTH_MONTHS}`;
      document.getElementById('sbDay').textContent = `${game.dayInMonth}/${DAYS_PER_MONTH}`;
      document.getElementById('sbRep').textContent = game.reputation;
      document.getElementById('sbRank').textContent = RANKS[currentRankIndex()].name;
    }

export function renderPccStatus() {
      const el = document.getElementById('pccStatusPanel');
      if (!el) return;
      const installs = game.pccInstalls || [];
      const headerEl = document.getElementById('pccHeader');
      const critical = installs.filter(p => !p.ghost && (p.durability ?? 100) < 40).length;
      setInnerHtmlIfChanged(headerEl, `PCC POSÉES — ÉTAT${critical > 0 ? `<span class="notif-badge">⚠️${critical}</span>` : ''}`);
      if (!installs.length) { setInnerHtmlIfChanged(el, 'Aucune PCC posée sur ce territoire.'); return; }
      setInnerHtmlIfChanged(el, installs.map(p => {
        const dur = p.durability ?? 100;
        const isGhost = p.ghost;
        const color = dur >= 60 ? 'var(--chiral)' : dur >= 30 ? 'var(--amber)' : 'var(--blood)';
        return `<div style="margin-bottom:4px;">
          ${PCC_TYPES[p.type].icon} ${PCC_TYPES[p.type].name} (${p.x},${p.y})${isGhost ? ' 👻 fantôme' : ''} —
          <span style="color:${color};">${dur}%</span>
          ${!isGhost && dur < 100 ? `<button onclick="repairPCC(${p.x},${p.y})" style="font-size:8px; padding:1px 5px; margin-left:4px;">Réparer ($${Math.ceil((100 - dur) * 4)})</button>` : ''}
        </div>`;
      }).join(''));
    }

export function renderCatcherPanel() {
      const el = document.getElementById('catcherPanel');
      if (!el) return;
      const catchers = game.catchers || [];
      const grenades = game.materials.blood_grenades || 0, bags = game.materials.blood_bags || 0;
      if (!catchers.length) {
        setInnerHtmlIfChanged(el, `Aucun Catcher détecté. Stock: 🩸${grenades} 💉${bags}`);
        return;
      }
      setInnerHtmlIfChanged(el, catchers.map(c => `
        <div class="alert-threat" style="border-left:2px solid var(--bt-purple); padding-left:6px; margin-bottom:6px;">
          👹 Catcher (${c.x},${c.y}) force ${'⚠️'.repeat(c.strength)}<br>
          Stock: 🩸${grenades} 💉${bags}<br>
          <button onclick="engageCatcher('${c.id}')" style="font-size:8px;">⚔️ Engager le combat (2-4 porteurs)</button>
        </div>`).join(''));
    }

export function renderMuleCamps() {
      const el = document.getElementById('muleCampsPanel');
      if (!el) return;
      const camps = game.muleCamps || [];
      if (!camps.length) { setInnerHtmlIfChanged(el, '<div style="font-size:9px; color:var(--text-dim);">Aucun camp détecté sur ce territoire.</div>'); return; }
      setInnerHtmlIfChanged(el, camps.map(c => {
        const strengthBadge = statusBadgeHtml('⚠️'.repeat(c.strength) || 'Force 0', c.strength >= 3 ? 'legendary' : c.strength === 2 ? 'epic' : 'rare');
        if (c.status === 'hostile') {
          return terminalCardHtml({
            title: '🏴‍☠️ Camp hostile', subtitle: `Position (${c.x},${c.y})`, rarity: 'legendary',
            badgesHtml: strengthBadge + statusBadgeHtml('Hostile', 'danger'),
            actionsHtml: `<button class="term-card-action" onclick="assaultCamp('${c.id}','infiltration')">🥷 Infiltration</button>
              <button class="term-card-action danger" onclick="assaultCamp('${c.id}','assault')">💥 Assaut létal</button>`
          });
        }
        if (c.status === 'pacified') {
          return terminalCardHtml({
            title: '🛡️ Camp pacifié', subtitle: `Position (${c.x},${c.y}) · sûr jusqu'au mois ${c.safeUntilMonth}`, rarity: 'rare',
            badgesHtml: strengthBadge,
            actionsHtml: c.needsIncineration
              ? `<button class="term-card-action danger" onclick="sendToIncinerator('${c.id}')">🔥 Incinérer ($300)</button>`
              : `<button class="term-card-action success" onclick="convertCampToRelay('${c.id}')">🏭 Convertir en relais ($1500)</button>`
          });
        }
        if (c.status === 'under_attack') {
          return terminalCardHtml({
            title: '⚠️ Relais sous attaque', subtitle: `Position (${c.x},${c.y}) · tombera aux MULEs si ignoré ce mois-ci`, rarity: 'legendary',
            badgesHtml: statusBadgeHtml('Urgent', 'danger'),
            actionsHtml: `<button class="term-card-action danger" onclick="defendRelay('${c.id}')">🛡️ Défendre le relais</button>`
          });
        }
        return terminalCardHtml({
          title: '🏭 Relais logistique actif', subtitle: `Position (${c.x},${c.y}) · +$${c.strength * 40}/mois`, rarity: c.fortified ? 'epic' : 'common',
          badgesHtml: strengthBadge + (c.fortified ? statusBadgeHtml('Fortifié', 'epic', '🏰') : ''),
          actionsHtml: !c.fortified ? `<button class="term-card-action" onclick="fortifyRelay('${c.id}')">🏰 Fortifier ($600)</button>` : ''
        });
      }).join(''));
    }

export function renderInfra() {
      const el = document.getElementById('infraDisplay');
      if (!el) return;
      if (currentRankIndex() < 3) { setInnerHtmlIfChanged(el, '🔒 Investissement infrastructure (Rang Élite requis)'); return; }
      const cost = infraCost();
      const bonus = (game.infraInvestments * 0.2).toFixed(1);
      setInnerHtmlIfChanged(el, `💰 Investissement Bridges: ${game.infraInvestments}x (+${bonus}% reward permanent)<br>
        <button onclick="investInfrastructure()" ${game.money < cost ? 'disabled' : ''} style="font-size:8px;">Investir ($${cost})</button>`);
    }

export function renderAutomationPanel() {
      const el = document.getElementById('automationPanel');
      if (!el) return;
      const a = game.automation || (game.automation = { autoRest: false, autoRestThreshold: 70, autoRepair: false, autoRepairThreshold: 60, autoReturn: false });
      el.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin:6px 0;">
          <label style="display:flex; align-items:center; gap:8px; font-size:9px; flex:1;">
            <input type="checkbox" ${a.autoRest ? 'checked' : ''} onchange="toggleAutomation('autoRest')"> Auto-Repos si stress ≥
          </label>
          ${terminalStepperHtml({ value: a.autoRestThreshold, suffix: '%', min: 0, max: 100, onDec: "adjustAutomationThreshold('autoRestThreshold', -5)", onInc: "adjustAutomationThreshold('autoRestThreshold', 5)" })}
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin:6px 0;">
          <label style="display:flex; align-items:center; gap:8px; font-size:9px; flex:1;">
            <input type="checkbox" ${a.autoRepair ? 'checked' : ''} onchange="toggleAutomation('autoRepair')"> Auto-Réparation si usure ≥
          </label>
          ${terminalStepperHtml({ value: a.autoRepairThreshold, suffix: '%', min: 0, max: 100, onDec: "adjustAutomationThreshold('autoRepairThreshold', -5)", onInc: "adjustAutomationThreshold('autoRepairThreshold', 5)" })}
        </div>
        <label style="display:flex; align-items:center; gap:8px; font-size:9px; margin:6px 0;">
          <input type="checkbox" ${a.autoReturn ? 'checked' : ''} onchange="toggleAutomation('autoReturn')"> Auto-Retour au dépôt (porteurs disponibles)
        </label>
        <label style="display:flex; align-items:center; gap:8px; font-size:9px; margin:6px 0;">
          <input type="checkbox" ${a.autoBuyEquip ? 'checked' : ''} onchange="toggleAutomation('autoBuyEquip')"> Achats autonomes à la Boutique (porteurs au repos)
        </label>
        <div style="font-size:8px; color:var(--text-dim); margin-top:2px;">Appliqués en fin de mois, coûts identiques aux actions manuelles.</div>`;
    }

export function renderLogisticsDashboard() {
      const el = document.getElementById('logisticsDashboard');
      if (!el) return;
      const dash = computeLogisticsDashboard();
      const netColor = dash.netEstimate >= 0 ? 'var(--chiral)' : 'var(--blood)';
      el.innerHTML = `
        <div class="stat-line"><span class="stat-label">Revenus passifs</span><span class="stat-val">+$${dash.passiveIncome}/mois</span></div>
        <div style="font-size:8px; color:var(--text-dim); margin:-2px 0 4px;">Relais $${dash.relayIncome} · Générateurs $${dash.generatorIncome} · Sponsor $${dash.sponsorIncome} · Filiales $${dash.subsidyIncome}</div>
        <div class="stat-line"><span class="stat-label">Coûts fixes</span><span class="stat-val" style="color:var(--blood);">-$${dash.fixedCosts}/mois</span></div>
        <div style="font-size:8px; color:var(--text-dim); margin:-2px 0 4px;">Salaires $${dash.salaries} · Maintenance véhicules $${dash.vehicleCost}</div>
        <div class="stat-line"><span class="stat-label">Bénéfice net estimé</span><span class="stat-val" style="color:${netColor};">${dash.netEstimate >= 0 ? '+' : ''}$${dash.netEstimate}/mois</span></div>`;
    }

// V0.7.5 — rareté purement présentationnelle, dérivée des mêmes données statiques que l'ancien
// affichage (SPONSORS): aucune valeur de jeu ajoutée, aucun accès RNG.
function sponsorRarity(s) {
      if (s.vip) return 'legendary';
      if (s.monthlyIncome >= 250) return 'epic';
      if (s.monthlyIncome >= 150) return 'rare';
      return 'common';
    }

export function renderSponsor() {
      const el = document.getElementById('sponsorDisplay');
      if (!el) return;
      const tier = porterLeagueTier();
      const label = LEAGUE_TIERS[tier];
      const leagueLine = `<div style="margin-bottom:4px;">${label.icon} Ligue Porteurs: <b>${label.name}</b>${tier < LEAGUE_TIERS.length - 1 ? ` (prochain palier: rép. ${BALANCE.league.tierThresholds[tier + 1].minReputation}, livraisons ${BALANCE.league.tierThresholds[tier + 1].minCompleted})` : ' — palier maximum'}</div>`;
      if (game.sponsor) {
        setInnerHtmlIfChanged(el, leagueLine + terminalCardHtml({
          title: `🤝 ${game.sponsor.name}`,
          subtitle: game.sponsor.desc,
          rarity: 'legendary',
          badgesHtml: statusBadgeHtml('Sous contrat', 'legendary'),
          bodyHtml: `Revenu: <b>+$${game.sponsor.monthlyIncome}/mois</b>`
        }));
        return;
      }
      const cards = SPONSORS.map(s => terminalCardHtml({
        title: s.name,
        subtitle: s.desc,
        rarity: sponsorRarity(s),
        badgesHtml: rarityBadgeHtml(sponsorRarity(s)) + (s.vip ? statusBadgeHtml('VIP', 'legendary', '💠') : ''),
        bodyHtml: `Bonus signature: <b>+$${s.signingBonus}</b> · Revenu: <b>+$${s.monthlyIncome}/mois</b>`,
        actionsHtml: `<button class="term-card-action success" onclick="signSponsor('${s.id}')">🤝 Signer</button>`
      })).join('');
      setInnerHtmlIfChanged(el, leagueLine + '<div style="font-size:9px; color:var(--text-dim); margin-bottom:4px;">Aucun sponsor actif.</div>' + cards);
    }

export function renderCampInfo() {
      // V1.1 LOT 2 — campHeader a migré de l'ex-onglet Camp vers Logistique > Archives & Sponsors;
      // muleCampsPanel/pccStatusPanel/catcherPanel ont migré ailleurs (Réseau/Boutique). Ce libellé
      // reste cohérent avec le nouveau sous-onglet (index.html "◆ ARCHIVES & SPONSORS"). renderMuleCamps/
      // renderPccStatus/renderCatcherPanel restent appelés inconditionnellement (comme avant) — ce sont
      // renderMainKnots()/render() (V1.1 LOT 2) qui gardent muleCampsPanel à jour côté Réseau.
      const headerEl = document.getElementById('campHeader');
      setInnerHtmlIfChanged(headerEl, `◆ ARCHIVES &amp; SPONSORS${game.visitor ? '<span class="notif-badge">🔔</span>' : ''}`);
      renderMuleCamps();
      renderPccStatus();
      renderCatcherPanel();
      const traitEl = document.getElementById('campTraitDisplay');
      if (traitEl) {
        const dom = dominantStructure();
        traitEl.textContent = dom ? `Spécialité: ${CAMP_TRAIT_LABELS[dom]}` : 'Spécialité: aucune (construisez une installation)';
      }
      const festEl = document.getElementById('festivalDisplay');
      if (festEl) {
        festEl.textContent = game.activeFestival
          ? `${game.activeFestival.name} — ${game.activeFestival.desc} (fin mois ${game.activeFestival.endMonth})`
          : '';
      }
      const visEl = document.getElementById('visitorDisplay');
      if (visEl) {
        const v = game.visitor;
        setInnerHtmlIfChanged(visEl, v
          ? `${v.name}: ${v.desc}${v.cost ? ` ($${v.cost})` : ''} · expire mois ${v.expiresMonth}<br>
             <button onclick="acceptVisitorOffer()" style="font-size:8px;">✅ Accepter</button>
             <button onclick="dismissVisitor()" style="font-size:8px;">❌ Ignorer</button>`
          : '');
      }
      const hofEl = document.getElementById('hallOfFamePanel');
      if (hofEl) {
        setInnerHtmlIfChanged(hofEl, game.hallOfFame.length
          ? game.hallOfFame.map(h => `${h.name} (${SKILLS[h.skill].name}, Lv${h.level}, ❤️${h.likes}) — ${h.cause}, mois ${h.month}`).join('<br>')
          : 'Aucun départ pour l\'instant.');
      }
      const activeRelics = RELICS.filter(r => game.activeRelicIds.includes(r.id));
      const collCountEl = document.getElementById('collectionCount');
      if (collCountEl) collCountEl.textContent = `${game.collection.length}/${activeRelics.length}`;
      const collEl = document.getElementById('collectionPanel');
      if (collEl) {
        setInnerHtmlIfChanged(collEl, activeRelics.map(r => game.collection.includes(r.id)
          ? `${r.name} — <i>${r.desc}</i>`
          : `🔒 ???`).join('<br>'));
      }
    }

export function renderCandidate() {
      const el = document.getElementById('candidateDisplay');
      if (!el) return;
      const c = game.scoutedCandidate;
      if (!c) { el.innerHTML = ''; return; }
      el.innerHTML = `${SKILLS[c.skill].name} ${TRAITS[c.trait].name}${c.rare ? ' ⭐ PROMETTEUR (lvl2)' : ''}
        <button onclick="hire(true)" style="font-size:9px; margin-top:2px;">✅ Embaucher ce candidat</button>`;
    }

// V1.8.0 — Pods Robotiques autonomes: visible seulement une fois débloqué (rang + étoiles Prepper),
// jamais un bouton disabled qui laisserait deviner le seuil exact avant de l'avoir approché.
export function renderRobotBuddyPanel() {
      const el = document.getElementById('robotBuddyPanel');
      if (!el) return;
      if (!isRobotBuddyUnlocked()) { el.innerHTML = ''; return; }
      const count = robotBuddyCount();
      const cost = robotBuddyCost();
      const maxed = count >= BALANCE.robotBuddy.maxOwned;
      el.innerHTML = `<button ${maxed ? 'disabled' : ''} onclick="recruitRobotBuddyUI()">🤖 Recruter un Pod Robotique ($${cost}) — ${count}/${BALANCE.robotBuddy.maxOwned}</button>
        <div style="font-size:9px; color:var(--text-dim); margin-top:-2px;">Autonome, aucun salaire — résistance dégâts élevée.</div>`;
    }

export function renderCauldron() {
      const matEl = document.getElementById('materialsDisplay');
      const panelEl = document.getElementById('cauldronPanel');
      if (!matEl || !panelEl) return;
      matEl.textContent = `🔮 Cristaux: ${game.materials.chiral_crystal} · 🔧 Ferraille MULE: ${game.materials.mule_scrap}`;
      if (!game.structures.cauldron) {
        setInnerHtmlIfChanged(panelEl, '<div style="font-size:9px; color:var(--text-dim);">🔒 Construisez le Chaudron chiral</div>');
        return;
      }
      setInnerHtmlIfChanged(panelEl, RECIPES.map(r => {
        const affordable = Object.keys(r.cost).every(m => (game.materials[m] || 0) >= r.cost[m]);
        const costStr = Object.entries(r.cost).map(([m, v]) => `${v}${m === 'chiral_crystal' ? '🔮' : '🔧'}`).join(' + ');
        return `<button ${affordable ? '' : 'disabled'} onclick="craft('${r.id}')" style="font-size:9px;">${r.name} (${costStr}) — ${r.desc}</button>`;
      }).join(''));
    }

export function renderPorterTarget() {
      const el = document.getElementById('porterTarget');
      if (!el) return;
      const alive = p => p.status !== 'dead' && p.status !== 'left';
      const options = game.porters.filter(alive).map(p =>
        `<option value="${p.id}">${p.name} — slots ${equippedCount(p)}/${equipSlots(p)}${p.map !== game.currentMap ? ' (autre carte)' : ''}</option>`
      ).join('');
      el.innerHTML = options || '<option value="">Aucun porteur</option>';
      if (runtime.selectedPorterId != null && game.porters.some(p => p.id === runtime.selectedPorterId && alive(p))) {
        el.value = runtime.selectedPorterId;
      } else {
        runtime.selectedPorterId = el.value === '' ? null : parseInt(el.value);
      }
    }

export function renderStructures() {
      const el = document.getElementById('structuresPanel');
      if (!el) return;
      setInnerHtmlIfChanged(el, Object.keys(STRUCTURES).map(type => {
        const s = STRUCTURES[type];
        const level = game.structures[type] || 0;
        const maxed = level >= s.maxLevel;
        const locked = (STRUCTURE_MIN_RANK[type] || 0) > currentRankIndex();
        const cost = maxed ? 0 : Math.ceil(s.cost * (1 + level * 0.8) * RANKS[currentRankIndex()].costMult * shopDiscountMult());
        const dots = '●'.repeat(level) + '○'.repeat(s.maxLevel - level);
        const label = level > 0 ? s.levelNames[level - 1] : s.name;
        if (locked) return `<button disabled style="font-size:9px;">🔒 ${s.name} (Rang ${RANKS[STRUCTURE_MIN_RANK[type]].name} requis)</button>`;
        return `<button ${maxed ? 'disabled' : ''} onclick="buildStructure('${type}')" style="font-size:9px;">
          ${label} ${dots} ${maxed ? '(MAX)' : `($${cost})`}
        </button>`;
      }).join(''));
    }

export function updateUnlocks() {
      checkRankUp();
      const cryptoEl = document.getElementById('unlock-cryptobiote');
      const expansionEl = document.getElementById('unlock-expansion');
      const knotsEl = document.getElementById('unlock-knots');
      if (cryptoEl) {
        const show = currentRankIndex() >= 1; // Porteur Bridges
        cryptoEl.style.display = show ? 'block' : 'none';
        if (show && !runtime.announcedUnlocks.crypto) {
          runtime.announcedUnlocks.crypto = true;
          logEvent('🔓 Cryptobiotes & Bola gun disponibles');
        }
      }
      if (expansionEl) {
        const show = currentRankIndex() >= 2; // Porteur Certifié
        expansionEl.style.display = show ? 'block' : 'none';
        if (show && !runtime.announcedUnlocks.expansion) {
          runtime.announcedUnlocks.expansion = true;
          logEvent('🔓 Plate Gate disponible — vous pouvez étendre Bridges à l\'international');
        }
      }
      if (knotsEl) {
        const show = currentRankIndex() >= 2; // Porteur Certifié
        knotsEl.style.display = show ? 'block' : 'none';
      }
      // V1.1 LOT 2 — sideQuests a migré de l'onglet Camp (où il partageait unlock-knots avec
      // mainKnots) vers l'onglet Livraisons: même condition de déblocage, second élément séparé
      // (deux ids ne peuvent pas partager le même wrapper une fois sur 2 onglets différents).
      const sideQuestsEl = document.getElementById('unlock-sidequests');
      if (sideQuestsEl) {
        const show = currentRankIndex() >= 2; // Porteur Certifié
        sideQuestsEl.style.display = show ? 'block' : 'none';
      }
      const rank2El = document.getElementById('unlock-rank2gear');
      if (rank2El) {
        const show = currentRankIndex() >= 2;
        rank2El.style.display = show ? 'block' : 'none';
        if (show && !runtime.announcedUnlocks.rank2gear) { runtime.announcedUnlocks.rank2gear = true; logEvent('🔓 Ancre chirale disponible'); }
      }
      const rank3El = document.getElementById('unlock-rank3vehicle');
      if (rank3El) {
        const show = currentRankIndex() >= 3;
        rank3El.style.display = show ? 'block' : 'none';
        if (show && !runtime.announcedUnlocks.rank3vehicle) { runtime.announcedUnlocks.rank3vehicle = true; logEvent('🔓 Trike inversé disponible'); }
      }
    }

export function renderMapToggle() {
      const el = document.getElementById('mapToggle');
      if (!el) return;
      // Secret total de progression (mission "Masquage des territoires"): aucun indice, aucun bouton
      // désactivé pour les territoires non débloqués — ils ne sont ni générés ni injectés dans le DOM
      // tant que game.mapsData[key] n'existe pas (créé par buildExpansion() une fois l'arc précédent
      // entièrement raccordé). Avant V1.11.0 le prochain territoire affichait un indice progressif
      // (lockedHintLabel) et les autres un bouton "Territoire scellé" grisé — supprimé intentionnellement.
      const countryButtons = COUNTRIES.filter(c => !!game.mapsData[c.key]).map(c => {
        const active = game.currentMap === c.key;
        return `<button onclick="switchMap('${c.key}')" style="${active ? 'border-left-color: var(--amber); color: #fff;' : ''}">${c.flag} ${c.name}</button>`;
      }).join('');

      const d = game.mapsData[game.currentMap];
      const branchButtons = d.branches.map((b, i) => `
        <button onclick="setActiveBranch(${i})" style="${d.activeBranch === i ? 'border-left-color: var(--chiral); color: #fff;' : ''} font-size: 9px;">
          🏢 Antenne ${i + 1} (${b.x},${b.y})${d.activeBranch === i ? ' ★' : ''}
        </button>
      `).join('');

      el.innerHTML = `<div style="display:flex; gap:6px; flex-wrap:wrap;">${countryButtons}</div>
        ${d.branches.length > 1 ? `<div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">${branchButtons}</div>` : ''}`;
    }

export function needGaugeHtml(label, value) {
      const color = value >= 80 ? 'var(--blood)' : value >= 50 ? 'var(--amber)' : 'var(--chiral)';
      return `<div class="gauge" style="min-width:0;">
        <div class="gauge-label"><span>${label}</span><span style="color:${color};">${Math.round(value)}%</span></div>
        <div class="gauge-track"><div class="gauge-fill" style="width:${value}%; background:${color};"></div></div>
      </div>`;
    }

export function prepperCardHtml(d, k, i, idlePorters) {
      migratePrepperKnot(k);
      const connected = d.routes.has(cellKey(k.x, k.y));
      const arch = PREPPER_ARCHETYPES[k.archetype];
      if (!connected) {
        return `<div class="item" style="margin-bottom:5px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
            <span style="min-width:0;">🔒 ${k.name} <span style="color:var(--text-dim);">(${arch.icon} ${arch.name})</span></span>
            <button style="font-size:8px; padding:2px 6px; margin:0; width:auto; flex-shrink:0;" onclick="connectKnot(${i})">Raccorder</button>
          </div>
        </div>`;
      }
      const uid = `${game.currentMap}-${i}`;
      const porterOptions = idlePorters.length
        ? idlePorters.map(p => `<option value="${p.id}">${p.name} (${SKILLS[p.skill].name}, HP${Math.ceil(p.health)})</option>`).join('')
        : '<option value="">Aucun porteur disponible</option>';
      const routeOptions = Object.entries(ROUTE_TYPES).map(([k2, r]) => `<option value="${k2}">${r.icon} ${r.name}</option>`).join('');
      const contracts = (k.contracts || []).map(c => `
        <div style="border-left:2px solid ${c.negotiable && !c.negotiated ? 'var(--gold)' : 'var(--chiral-dim)'}; padding-left:5px; margin:4px 0;">
          ${c.flavor}<br>→ +$${c.reward} · expire mois ${c.expiresMonth}
          <div style="display:flex; gap:3px; margin-top:2px; flex-wrap:wrap;">
            <select id="pcp-${uid}-${c.id}" style="flex:1; font-size:8px; background:#1a1712; color:var(--text); border:1px solid #332e24;">${porterOptions}</select>
            <select id="pcr-${uid}-${c.id}" style="flex:1; font-size:8px; background:#1a1712; color:var(--text); border:1px solid #332e24;">${routeOptions}</select>
          </div>
          <div style="display:flex; gap:3px; margin-top:2px; flex-wrap:wrap;">
            <button style="font-size:8px; padding:2px 6px; margin:0; width:auto;" ${idlePorters.length ? '' : 'disabled'}
              onclick="assignPrepperContract(${i}, '${c.id}', parseInt(document.getElementById('pcp-${uid}-${c.id}').value), document.getElementById('pcr-${uid}-${c.id}').value)">🚚 Assigner ce porteur</button>
            ${c.negotiable && !c.negotiated ? `<button style="font-size:8px; padding:2px 6px; margin:0; width:auto;" onclick="negotiatePrepperContract(${i}, '${c.id}')">🗣️ Négocier</button>` : ''}
          </div>
        </div>`).join('');
      return `<div class="item" style="margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <b>${arch.icon} ${k.name} <span class="neon-blue-connected" style="font-size:8px;">🔵 Connecté</span></b>
          <span class="neon-blue-star" style="font-size:9px;">${prepperStarsLabel(k.relation)}</span>
        </div>
        <div style="font-size:9px; color:var(--chiral);">${arch.name} — ${arch.perkDesc}</div>
        <div class="gauge-row" style="margin-top:4px;">
          ${needGaugeHtml('⚕️ Médical', k.needs.medical)}
          ${needGaugeHtml('🍞 Nourriture', k.needs.food)}
          ${needGaugeHtml('🔩 Techno', k.needs.tech)}
        </div>
        ${contracts || '<div style="font-size:9px; color:var(--text-dim); margin-top:3px;">Aucune requête active.</div>'}
      </div>`;
    }

export function renderMainKnots() {
      const el = document.getElementById('mainKnots');
      if (!el) return;
      const d = game.mapsData[game.currentMap];
      if (!d || !d.mainKnots || !d.mainKnots.length) { el.innerHTML = ''; return; }
      const idlePorters = game.porters.filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100);
      // V1.4.0 — "Brumes de guerre": ne rend que les Preppers révélés (raccordés + le plus proche non
      // raccordé). L'index `i` passé à prepperCardHtml() DOIT rester l'index RÉEL dans d.mainKnots
      // (connectKnot(i)/les <select> générés en dépendent) — jamais l'index dans le tableau filtré.
      // V1.6.0 — silhouettes: les villes encore plus lointaines gagnent une carte "?" minimale (aucun
      // nom/archétype révélé) au lieu de disparaître totalement du panneau.
      const silhouetteCardHtml = () => `<div class="item" style="margin-bottom:5px; opacity:0.5;">
        <span>🔍 Ville non découverte — envoyez un Pionnier ou marchez pour la localiser</span>
      </div>`;
      el.innerHTML = revealedMainKnots(d).map(k => prepperCardHtml(d, k, d.mainKnots.indexOf(k), idlePorters)).join('')
        + silhouetteMainKnots(d).map(silhouetteCardHtml).join('');
    }

export function renderSideQuests() {
      const el = document.getElementById('sideQuests');
      if (!el) return;
      const d = game.mapsData[game.currentMap];
      const quests = (d && d.sideQuests) || [];
      const headerEl = document.getElementById('questsHeader');
      if (headerEl) {
        const hasSpecial = quests.some(q => q.special);
        headerEl.innerHTML = `QUÊTES ANNEXES${quests.length ? `<span class="notif-badge">${hasSpecial ? '⭐' : '🔔'}</span>` : ''}`;
      }
      if (!quests.length) { el.innerHTML = '<div style="font-size:9px; color:var(--text-dim);">Aucune quête active</div>'; return; }
      const idlePorters = game.porters.filter(p => p.map === game.currentMap && p.status === 'idle' && p.health > 15 && (p.gearWear || 0) < 100);
      const idleCount = idlePorters.length;
      const squadSize = Math.min(idleCount, 3);
      // Sélection manuelle d'escouade (#Phase2): cases à cocher, synergies calculées selon les compétences cochées.
      // Si rien n'est coché au lancement, l'ancienne auto-sélection (les 3 premiers idle) prend le relais.
      const squadPickerTemplate = idlePorters.length ? `<div style="max-height:64px; overflow-y:auto; margin:3px 0; border:1px solid #221f18; padding:2px;">
        ${idlePorters.map(p => `<label style="display:flex; align-items:center; gap:3px; font-size:8px; cursor:pointer;">
          <input type="checkbox" data-quest-squad="__QID__" value="${p.id}" style="width:auto; margin:0;"> ${p.name} (${SKILLS[p.skill].name})
        </label>`).join('')}
      </div><div style="font-size:8px; color:var(--text-dim);">Cochez pour choisir l'escouade — sinon auto-sélection. Synergies: 🗺️💪 Scout+Frappeur = Escorte Rapide, 👁️🚗 DOOMS+Chauffeur = Convoi Anti-BT.</div>` : '';
      el.innerHTML = quests.map(q => `
        <div class="${q.crisis ? 'alert-crisis' : ''}" style="font-size:9px; margin-bottom:5px; border-left:2px solid ${q.crisis ? 'var(--blood)' : q.special ? '#c76bff' : 'var(--amber)'}; padding-left:4px;">
          ${q.crisis ? '🌌 HAUTE MENACE — ' : q.special ? '⭐ ORDRE SPÉCIAL — ' : ''}${q.flavor}<br>→ (${q.x},${q.y}) +$${q.reward} · expire mois ${q.expiresMonth}<br>
          <select id="route-${q.id}" style="width:100%; font-size:8px; margin-top:2px; background:#1a1712; color:var(--text); border:1px solid #332e24;">
            ${Object.entries(ROUTE_TYPES).map(([k, r]) => `<option value="${k}">${r.icon} ${r.name} — ${r.desc}</option>`).join('')}
          </select>
          ${squadPickerTemplate.split('__QID__').join(q.id)}
          <button style="font-size:8px; padding:2px 6px; margin-top:2px;" ${idleCount >= (q.minSquad || 1) ? '' : 'disabled'} onclick="launchQuestFromUI('${q.id}')">🚛 Lancer ${(q.special || q.crisis) ? `${q.crisis ? 'le contrat' : "l'ordre"} (min. ${q.minSquad})` : `le raid (${squadSize} porteur${squadSize > 1 ? 's' : ''})`}</button>
        </div>`).join('');
    }

export function renderPorters() {
      let onThisMap = game.porters.filter(p => p.map === game.currentMap);
      const sortEl = document.getElementById('rosterSort');
      const filterEl = document.getElementById('rosterFilter');
      const sortMode = sortEl ? sortEl.value : 'default';
      const filterMode = filterEl ? filterEl.value : 'all';

      if (filterMode === 'idle') onThisMap = onThisMap.filter(p => p.status === 'idle');
      else if (filterMode === 'active') onThisMap = onThisMap.filter(p => p.status === 'en route');
      else if (filterMode === 'attention') onThisMap = onThisMap.filter(p =>
        p.status !== 'dead' && p.status !== 'left' && (p.health < 40 || (p.gearWear || 0) >= 50 || p.stress > 80));

      if (sortMode === 'level') onThisMap = [...onThisMap].sort((a, b) => b.level - a.level);
      else if (sortMode === 'likes') onThisMap = [...onThisMap].sort((a, b) => b.likes - a.likes);
      else if (sortMode === 'health') onThisMap = [...onThisMap].sort((a, b) => a.health - b.health);
      else if (sortMode === 'wear') onThisMap = [...onThisMap].sort((a, b) => (b.gearWear || 0) - (a.gearWear || 0));

      const totalActive = game.porters.filter(p => p.status !== 'dead' && p.status !== 'left').length;
      const otherUnlocked = COUNTRIES.filter(c => game.mapsData[c.key] && c.key !== game.currentMap);
      const header = `<div style="font-size: 9px; color: var(--text-dim); margin-bottom: 4px;">${onThisMap.length} affiché(s) / ${totalActive} au total</div>`;
      const html = onThisMap.map(p => `
        <div class="porter-card" style="${p.status === 'dead' || p.status === 'left' ? 'opacity: 0.4;' : ''}">
          <div class="porter-card-head">
            <span class="porter-card-name">${p.name}</span>
            <span class="porter-card-lvl">Lv${p.level} · ${SKILLS[p.skill].name}${p.status === 'left' ? ' (licencié)' : ''}</span>
          </div>
          ${porterTitle(p) ? `<div class="porter-card-title">"${porterTitle(p)}"</div>` : ''}
          <div style="font-size: 9px; color: var(--text-dim);">${TRAITS[p.trait].name} · ❤️ ${p.likes} · 🎒 ${equippedCount(p)}/${equipSlots(p)}${p.phobia && PORTER_PHOBIAS[p.phobia] ? ` · ${PORTER_PHOBIAS[p.phobia].icon}` : ''}${p.background && PORTER_BACKGROUNDS[p.background] ? ` ${PORTER_BACKGROUNDS[p.background].icon}` : ''}</div>
          ${(p.gearWear || 0) > 0 ? `<div style="font-size:9px; color:${p.gearWear >= 70 ? 'var(--blood)' : 'var(--amber-dim)'}; margin-top:2px;">🔧 Usure équip. ${p.gearWear}%${p.gearWear >= 50 ? ' ⚠️' : ''}
            <button onclick="repairGear(${p.id})" style="font-size:8px; padding:2px 6px; margin-left:4px; width:auto; display:inline;">Réparer ($${Math.ceil(p.gearWear * 5)})</button></div>` : ''}

          <div class="porter-equip-row">
            ${Object.keys(GRADES).filter(c => gradeLevel(p, c) > 0).map(c =>
              `<span class="skill-badge">${GRADES[c].name} Lv${gradeLevel(p, c)}</span>`).join('')}
            ${p.equipment.scanner ? '<span class="skill-badge">📡 Scanner</span>' : ''}
            ${p.equipment.exo ? '<span class="skill-badge">💪 Exo</span>' : ''}
            ${p.equipment.boots ? '<span class="skill-badge">👟 Boots</span>' : ''}
            ${p.equipment.cryptobiote ? '<span class="skill-badge">🦠 Cryptobiotes</span>' : ''}
            ${p.equipment.bolagun ? '<span class="skill-badge">🎯 Bola gun</span>' : ''}
            ${p.equipment.cryobox ? '<span class="skill-badge">🧊 Cryobox</span>' : ''}
            ${p.equipment.harness ? '<span class="skill-badge">🎒 Sac</span>' : ''}
            ${p.equipment.climbing_anchor ? '<span class="skill-badge">⛓️ Ancre</span>' : ''}
            ${p.equipment.vehicle ? `<span class="skill-badge">${p.equipment.vehicle === 'truck' ? '🚚' : p.equipment.vehicle === 'trike' ? '🏍️💨' : '🏍️'}</span>` : ''}
          </div>

          <div class="gauge-row">
            <div class="gauge">
              <div class="gauge-label"><span>HP</span><span>${Math.ceil(p.health)}/100</span></div>
              <div class="gauge-track"><div class="gauge-fill hp" style="width:${p.health}%;"></div></div>
            </div>
            <div class="gauge">
              <div class="gauge-label"><span>Stress</span><span style="${p.stress > 80 ? 'color:#ff6b6b; font-weight:bold;' : ''}">${p.stress}${p.stress > 80 ? ' ⚠️' : ''}</span></div>
              <div class="gauge-track"><div class="gauge-fill stress" style="width:${p.stress}%;"></div></div>
            </div>
          </div>

          <div class="porter-actions">
            <button class="full-width" onclick="sendDelivery(${p.id})" ${p.status !== 'idle' || p.health <= 0 ? 'disabled' : ''}>
              Envoyer → (${Math.floor(Math.random() * 10)}, ${Math.floor(Math.random() * 10)})
            </button>
            <button onclick="forceRest(${p.id})" ${p.status !== 'idle' || p.health <= 0 ? 'disabled' : ''}>
              😴 Repos ($${Math.ceil((p.salary / 2) * (1 + p.stress / 100))})
            </button>
            <button class="full-width" onclick="openPorterDrawer(${p.id})">🪪 Fiche du porteur</button>
            ${p.level >= 5 ? `<button onclick="retirePorter(${p.id})" ${p.status !== 'idle' ? 'disabled' : ''}>🎖️ Retraite</button>` : ''}
            ${otherUnlocked.map(c => `
            <button class="full-width" onclick="beachJump(${p.id}, '${c.key}')" ${p.status !== 'idle' || p.health <= 0 ? 'disabled' : ''}>
              🌀 Beach Jump → ${c.flag} ${c.name} ($400)
            </button>`).join('')}
          </div>
        </div>
      `).join('');
      document.getElementById('porters').innerHTML = header + html;
    }

export function renderStats() {
      document.getElementById('budget').textContent = `$${game.money}`;
      document.getElementById('month').textContent = `${game.month}/${GAME_LENGTH_MONTHS}`;
      const dayEl = document.getElementById('dayProgress');
      if (dayEl) dayEl.textContent = `${game.dayInMonth}/${DAYS_PER_MONTH}`;
      const pauseBtn = document.getElementById('pauseBtn');
      if (pauseBtn) pauseBtn.textContent = runtime.paused ? '▶️ Reprendre' : '⏸️ Pause';
      const speedEl = document.getElementById('speedControls');
      if (speedEl) {
        speedEl.innerHTML = game.ngPlus
          ? `<button onclick="setGameSpeed(1)" style="flex:1; ${runtime.gameSpeed === 1 ? 'border-color:var(--chiral);' : ''}">x1</button>
             <button onclick="setGameSpeed(2)" style="flex:1; ${runtime.gameSpeed === 2 ? 'border-color:var(--chiral);' : ''}">x2 (NG+)</button>`
          : '';
      }
      document.getElementById('rep').textContent = game.reputation;
      const rankEl = document.getElementById('rank');
      if (rankEl) {
        const idx = currentRankIndex();
        const next = RANKS[idx + 1];
        rankEl.textContent = next
          ? `${RANKS[idx].name} (→ ${next.name}: ${game.completed}/${next.minCompleted} liv., rep ${game.reputation}/${next.minRep})`
          : `${RANKS[idx].name} (MAX)`;
      }
      const titlesEl = document.getElementById('titles');
      if (titlesEl) titlesEl.textContent = `${game.titles.length}/${TITLES.length}`;
      document.getElementById('stats-completed').textContent = `${game.completed}/${game.deaths}`;
      const coverage = Math.round((game.routes.size / (MAP_WIDTH * MAP_HEIGHT)) * 100);
      document.getElementById('stats-network').textContent = `${coverage}% (${countryInfo(game.currentMap).name})`;
      const scoreEl = document.getElementById('stats-score');
      if (scoreEl) scoreEl.textContent = computeScore();
    }

export function renderLog() {
      const cls = { death: 'death-log', good: 'good-log', warn: 'warn-log' };
      const html = game.log.map(e => `<div class="log-entry ${cls[e.level] || ''}">${e.text}</div>`).join('');
      document.getElementById('log').innerHTML = html;
    }

// --- Abonnements EventBus : c'est ici, et seulement ici (côté ui), que le moteur/les systèmes
// obtiennent un rafraîchissement visuel — jamais par appel direct depuis engine/ ou systems/. ---
eventBus.on('render:request', () => render());
eventBus.on('log:added', () => renderLog());
eventBus.on('game:ended', ({ score, list }) => showEndScreen(score, list));
eventBus.on('screen:hideEndScreen', () => {
  const el = document.getElementById('endScreen');
  if (el) el.style.display = 'none';
});
// V0.3.0
eventBus.on('weather:forecastUpdated', () => renderWeatherForecast());
eventBus.on('quest:urgent', ({ quest }) => {
  renderQuestPanel();
  // V1.14.0 — pause auto seulement pour le territoire actif (une quête générée ailleurs reste
  // invisible tant qu'on n'y regarde pas, cf. QuestSystem.js#generateUrgentQuest qui ne logEvent()
  // déjà que dans ce cas — même garde-fou ici). Pas d'ouverture forcée du tiroir Urgences (pushPanel()
  // -> history.pushState(), indisponible dans l'environnement de test _stubEnv.mjs sans
  // withHistory:true, et generateUrgentQuest() est appelée en boucle par de nombreux tests via
  // advanceDay()/tickUrgentQuestSpawns()) — le badge #questDrawerBadge (déjà mis à jour par
  // renderQuestPanel() ci-dessus) et le journal (logEvent, déjà émis par QuestSystem.js) suffisent à
  // signaler l'urgence pendant que l'horloge est arrêtée.
  if (quest && quest.mapKey === game.currentMap) pauseForMessage();
});
eventBus.on('quest:accepted', () => renderQuestPanel());
eventBus.on('quest:negotiated', () => renderQuestPanel());
eventBus.on('quest:refused', () => renderQuestPanel());
eventBus.on('quest:expired', () => renderQuestPanel());
// V1.14.0 — attaque de relais MULE (engine/CombatEngine.js#checkMuleCamps, déjà filtrée sur le
// territoire actif à l'émission): pause auto, la carte "⚠️ Relais sous attaque" (renderMuleCamps
// ci-dessous) reste l'action normale du joueur une fois la lecture faite.
eventBus.on('mule:relayUnderAttack', () => pauseForMessage());
// V0.4.0
eventBus.on('convoy:created', () => renderConvoyPanel());
eventBus.on('convoy:departed', () => { renderConvoyPanel(); renderTelemetryReport(); });
eventBus.on('convoy:arrived', () => renderTelemetryReport());
// V0.5.0
eventBus.on('porter:fearTriggered', ({ porterId }) => refreshPorterDrawerIfOpen(porterId));
eventBus.on('porter:joyTriggered', ({ porterId }) => refreshPorterDrawerIfOpen(porterId));
eventBus.on('porter:milestoneReached', ({ porterId }) => refreshPorterDrawerIfOpen(porterId));
eventBus.on('porter:traitAcquired', ({ porterId }) => refreshPorterDrawerIfOpen(porterId));
eventBus.on('legacy:legendRecorded', () => renderHallOfFamePanel());
eventBus.on('bbpod:btDetected', (payload) => showBBPodAlert(payload));
eventBus.on('bbpod:stageChanged', () => renderBBPodOverlay());
