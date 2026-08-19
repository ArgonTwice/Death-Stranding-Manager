// ui/BridgesMap.js (V1.0.0, Canvas responsive refondu V1.0.5) — Carte Holographique Bridges: rendu
// Canvas des nœuds de Relais du territoire actif (data/Routes.js), reliés au QG par des connexions
// néon dont la couleur reflète le statut réseau réel (ChiralNetworkSystem.js —
// LOCKED/NETWORKED/ACTIVE_RAID), avec une icône mobile interpolée le long de la connexion pour
// matérialiser un Raid/Expédition IRL en cours.
//
// RÈGLE D'ISOLATION (V1.0.0 règle 1): module PUREMENT présentationnel — lecture seule de game.*,
// aucun RNG.next(), aucune mutation d'état. Le clic sur un nœud ne fait qu'OUVRIR une modale UI
// existante (RaidSelectionModal.js/ContractBoardModal.js) — jamais d'appel direct à launchRaid()/
// startExpedition() depuis ce fichier.
//
// V1.0.5 — Canvas véritablement responsive (tablette/Galaxy Z Fold déplié): le buffer PHYSIQUE du
// canvas (canvas.width/height, en pixels device réels) est désormais séparé de ses dimensions
// LOGIQUES CSS (taille réellement affichée à l'écran) via syncCanvasBuffer(), synchronisé sur
// devicePixelRatio pour un rendu net à toute densité d'écran. worldToScreen()/screenToWorld() sont
// l'UNIQUE endroit qui connaît la conversion entre la grille logique 0..9 (data/Balance.js
// MAP_WIDTH/MAP_HEIGHT) et l'espace écran en pixels CSS — une simple mise à l'échelle UNIQUE
// (Math.min, jamais x/y indépendants: un nœud ne devient jamais une ellipse) + décalage de
// centrage, strictement inverses l'une de l'autre par construction. rebuildTransform() recalcule
// entièrement cette transformation à chaque frame plutôt que de l'empiler (ctx.setTransform()
// REMPLACE toujours la matrice courante — jamais ctx.scale(), qui la multiplierait au resize
// suivant): aucun risque de dérive cumulative après plusieurs redimensionnements successifs.
import { game } from '../core/GameState.js';
import { routesForMap, DIFFICULTY_COLORS } from '../data/Routes.js';
import { routeStatus, ROUTE_STATUS, revealedRoutes, silhouetteRoutes } from '../systems/raid/ChiralNetworkSystem.js';
import { openRaidSelectionModal } from './RaidSelectionModal.js';
import { openContractBoardModal } from './ContractBoardModal.js';

const STATUS_COLOR = {
      // V1.1 — #FF5555 (hors réseau, mission trust/stars): remplace le gris neutre pour signaler plus
      // clairement qu'une route LOCKED n'a pas assez de couverture réseau. Format "R, G, B" (comme les
      // deux autres statuts) plutôt qu'une chaîne rgba() toute faite: passe par le même chemin de rendu
      // (isRgbTriplet ci-dessous) que NETWORKED/ACTIVE_RAID, l'opacité 0.35 déjà en place est préservée
      // à l'identique. NETWORKED (orange, "raid disponible") et ACTIVE_RAID (#2BB1E6, "raid en cours")
      // restent inchangés — #2BB1E6 est déjà la couleur "connecté" existante d'ACTIVE_RAID; la
      // réutiliser aussi pour NETWORKED effacerait la distinction visuelle entre "réseau disponible" et
      // "raid en transit", qui reste une information utile au joueur.
      [ROUTE_STATUS.LOCKED]: '255, 85, 85', // #FF5555 — hors réseau
      [ROUTE_STATUS.NETWORKED]: '255, 159, 28', // Bridges Orange — connexion active mais aucun raid en cours
      [ROUTE_STATUS.ACTIVE_RAID]: '43, 177, 230', // Chiral Blue #2BB1E6 — raid IRL en transit sur cette route
      [ROUTE_STATUS.BLOCKED]: '201, 162, 39' // V1.6.0 — #c9a227 (--ds-gold existant, tokens.css): aléa de terrain DS2 temporaire, distinct du rouge LOCKED (jamais désynchronisé du réseau, juste impraticable pour quelques jours)
    };

// La composition (grille 0..9, marges, losanges QG/Relais) est authorée pour une "toile de
// référence" 800x420 — c'est la même disposition que l'habillage V1.0.0 d'origine, jamais changée
// ici. Le monde logique (WORLD_GRID) est mappé vers cette toile de référence par worldToReference();
// rebuildTransform() calcule ensuite l'unique mise à l'échelle qui fait tenir CETTE toile entière
// dans le canvas réel SANS JAMAIS LA DÉFORMER — exactement le principe CSS "object-fit: contain".
const REFERENCE_W = 800, REFERENCE_H = 420;
const WORLD_GRID = 9; // grille logique 0..9 (MAP_WIDTH/MAP_HEIGHT = 10, data/Balance.js)
const REF_MARGIN_X = 0.12, REF_MARGIN_Y = 0.18; // marges de la composition de référence, inchangées depuis V1.0.0

function worldToReference(gx, gy) {
      return {
        x: REFERENCE_W * REF_MARGIN_X + (gx / WORLD_GRID) * (REFERENCE_W * (1 - REF_MARGIN_X * 2)),
        y: REFERENCE_H * REF_MARGIN_Y + (gy / WORLD_GRID) * (REFERENCE_H * (1 - REF_MARGIN_Y * 2))
      };
    }

function referenceToWorld(rx, ry) {
      return {
        gx: ((rx - REFERENCE_W * REF_MARGIN_X) / (REFERENCE_W * (1 - REF_MARGIN_X * 2))) * WORLD_GRID,
        gy: ((ry - REFERENCE_H * REF_MARGIN_Y) / (REFERENCE_H * (1 - REF_MARGIN_Y * 2))) * WORLD_GRID
      };
    }

// Reconstruit la transformation référence->écran à partir des dimensions LOGIQUES courantes du
// canvas réel. Échelle UNIQUE — Math.min(largeur du canvas / largeur de la toile de référence,
// hauteur du canvas / hauteur de la toile de référence) — jamais deux facteurs x/y indépendants: un
// nœud ne devient jamais une ellipse, quel que soit le ratio réel du conteneur (large paysage
// historique, presque carré sur tablette/Z Fold déplié, étroit sur mobile portrait). Sur le ratio
// de référence exact (800:420, le cas actuel le plus courant), scale=1 et offset=0: rendu
// PIXEL-IDENTIQUE à l'ancienne implémentation — aucune régression visuelle sur le cas déjà en
// production, seuls les ratios qui en dévient gagnent un léger "letterboxing" plutôt qu'une
// déformation ou un débordement.
function rebuildTransform(dims) {
      const scale = Math.min(dims.width / REFERENCE_W, dims.height / REFERENCE_H);
      return { scale, offsetX: (dims.width - REFERENCE_W * scale) / 2, offsetY: (dims.height - REFERENCE_H * scale) / 2 };
    }

function worldToScreen(gx, gy, transform) {
      const ref = worldToReference(gx, gy);
      return { x: transform.offsetX + ref.x * transform.scale, y: transform.offsetY + ref.y * transform.scale };
    }

// Strict inverse de worldToScreen() — non utilisé en interne aujourd'hui (le hit-test du clic
// compare directement des coordonnées écran à hitNodes, déjà en repère écran), mais exposé pour
// toute future interaction qui aurait besoin de repartir d'un point écran vers une case logique
// (ex: prévisualisation au survol) sans dupliquer la formule de conversion.
export function screenToWorld(sx, sy, transform) {
      const rx = (sx - transform.offsetX) / transform.scale;
      const ry = (sy - transform.offsetY) / transform.scale;
      return referenceToWorld(rx, ry);
    }

function logicalSize(canvas) {
      const rect = canvas.getBoundingClientRect();
      // Filet de sécurité: un canvas pas encore mis en page (display:none, environnement de test sans
      // vraie mise en page) peut renvoyer 0 — retombe sur les attributs width/height bruts plutôt que
      // de tenter de dessiner dans une surface nulle.
      const width = rect.width > 0 ? rect.width : (canvas.width || 800);
      const height = rect.height > 0 ? rect.height : (canvas.height || 420);
      return { width, height };
    }

// Synchronise le buffer PHYSIQUE (canvas.width/height, pixels device réels) sur les dimensions
// LOGIQUES CSS courantes x devicePixelRatio — jamais l'inverse. Ne réaffecte canvas.width/height que
// si la taille a réellement changé: dans un vrai navigateur, toute affectation (même à la valeur
// déjà en place) réinitialise silencieusement tout le contenu du buffer, coûteux et inutile à
// chaque frame si rien n'a bougé.
function syncCanvasBuffer(canvas, logical) {
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      const pw = Math.max(1, Math.round(logical.width * dpr));
      const ph = Math.max(1, Math.round(logical.height * dpr));
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
      return dpr;
    }

// Nœuds hit-testés au dernier rendu (recalculés à chaque frame, consommés par le clic) — coordonnées
// LOGIQUES (pixels CSS), pas d'état métier, uniquement les coordonnées écran nécessaires à
// l'interaction tactile.
let hitNodes = []; // [{ x, y, r, kind: 'hq'|'relay', route? }]
let boundCanvasId = null;
let lastLogicalW = 0, lastLogicalH = 0;

export function renderBridgesMap(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const logical = logicalSize(canvas);
      const dpr = syncCanvasBuffer(canvas, logical);
      // Dessiner en coordonnées CSS logiques ci-dessous, avec cette transformation appliquée, produit
      // un rendu net à n'importe quel devicePixelRatio — setTransform() REMPLACE toujours la matrice
      // courante (jamais de scale() cumulatif d'un appel à l'autre).
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = logical.width, h = logical.height;
      const transform = rebuildTransform(logical);
      const now = performance.now();

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(10, 10, 10, 0.92)';
      ctx.fillRect(0, 0, w, h);

      // Grille de points holographique — texture discrète, jamais une grille de jeu (V1.0.0 règle 3:
      // purement décoratif pour l'ambiance "hologramme").
      ctx.fillStyle = 'rgba(43, 177, 230, 0.08)';
      for (let gx = 0; gx <= WORLD_GRID; gx += 1) {
        for (let gy = 0; gy <= WORLD_GRID; gy += 1) {
          const p = worldToScreen(gx, gy, transform);
          ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }

      const mapKey = game.currentMap;
      const mapD = game.mapsData[mapKey];
      const branch = mapD.branches[mapD.activeBranch] || mapD.branches[0];
      const hq = worldToScreen(branch.x, branch.y, transform);
      // V1.4.0 — "Brumes de guerre": ne dessine que les relais révélés (déjà débloqués + le prochain
      // à débloquer), jamais tout le territoire d'un coup (cf. ChiralNetworkSystem.js#revealedRoutes).
      const routes = revealedRoutes(routesForMap(mapKey));
      const newHitNodes = [{ x: hq.x, y: hq.y, r: 14, kind: 'hq' }];

      const activeRaid = game.activeRaid && game.activeRaid.status === 'active' ? game.activeRaid : null;

      // V1.6.0 — silhouettes holographiques: les relais encore plus lointains que le prochain révélé
      // (ChiralNetworkSystem.js#silhouetteRoutes) ne sont plus totalement invisibles (V1.4.0) mais
      // dessinés comme une position connue sans détail — jamais ajoutés à hitNodes (pas cliquables:
      // une silhouette n'est pas encore une cible d'action valide).
      for (const route of silhouetteRoutes(routesForMap(mapKey))) {
        const target = worldToScreen(route.toX, route.toY, transform);
        ctx.strokeStyle = 'rgba(43, 177, 230, 0.25)';
        ctx.setLineDash([2, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hq.x, hq.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(43, 177, 230, 0.18)';
        ctx.strokeStyle = 'rgba(43, 177, 230, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(target.x, target.y - 9); ctx.lineTo(target.x + 9, target.y);
        ctx.lineTo(target.x, target.y + 9); ctx.lineTo(target.x - 9, target.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = 'rgba(43, 177, 230, 0.55)';
        ctx.textAlign = 'center';
        ctx.fillText('?', target.x, target.y + 3);
      }

      for (const route of routes) {
        const status = routeStatus(route);
        const target = worldToScreen(route.toX, route.toY, transform);
        const rgb = STATUS_COLOR[status] || STATUS_COLOR[ROUTE_STATUS.LOCKED];
        const isRgbTriplet = /^\d/.test(rgb);
        const pulse = status === ROUTE_STATUS.LOCKED ? 0 : 0.35 + Math.sin(now / 500 + route.toX) * 0.25;

        // Connexion néon HQ -> Relais
        ctx.strokeStyle = isRgbTriplet ? `rgba(${rgb}, ${0.35 + pulse * 0.4})` : rgb;
        ctx.lineWidth = status === ROUTE_STATUS.ACTIVE_RAID ? 3 : status === ROUTE_STATUS.LOCKED ? 1 : 2;
        if (status === ROUTE_STATUS.LOCKED) {
          ctx.setLineDash([3, 5]);
        } else if (status === ROUTE_STATUS.ACTIVE_RAID) {
          // V1.2.0 — équivalent Canvas du "stroke-dashoffset SVG animé" demandé: un pattern de tirets
          // dont le décalage avance avec le temps trace un flux chiral qui "coule" le long de la
          // connexion, réservé au Raid IRL réellement en transit (seul cas où un flux directionnel a
          // un sens — NETWORKED garde sa simple pulsation d'opacité existante, inchangée ci-dessus).
          ctx.setLineDash([6, 6]);
          ctx.lineDashOffset = -(now / 40) % 12;
        } else {
          ctx.setLineDash([]);
        }
        if (isRgbTriplet) { ctx.shadowColor = `rgba(${rgb}, 0.7)`; ctx.shadowBlur = status === ROUTE_STATUS.LOCKED ? 0 : 8; }
        ctx.beginPath();
        ctx.moveTo(hq.x, hq.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // Icône mobile: Raid/Expédition IRL en transit sur CETTE route précise (interpolation linéaire
        // HQ->Relais selon la progression réelle des pas, purement une lecture de game.activeRaid).
        if (activeRaid && activeRaid.routeId === route.id) {
          const frac = Math.max(0, Math.min(1, activeRaid.traveledSteps / activeRaid.targetDistanceSteps));
          const mx = hq.x + (target.x - hq.x) * frac;
          const my = hq.y + (target.y - hq.y) * frac;
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#2BB1E6';
          ctx.shadowColor = 'rgba(43, 177, 230, 0.8)'; ctx.shadowBlur = 8;
          ctx.fillText('🚚', mx, my + 5);
          ctx.shadowBlur = 0;
        }

        // Nœud de Relais — losange biseauté, plein si NETWORKED/ACTIVE_RAID
        const nodeColor = isRgbTriplet ? `rgba(${rgb}, ${status === ROUTE_STATUS.LOCKED ? 0.5 : 0.95})` : rgb;
        ctx.strokeStyle = nodeColor;
        ctx.fillStyle = status === ROUTE_STATUS.LOCKED ? 'rgba(30,30,30,0.6)' : nodeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(target.x, target.y - 9); ctx.lineTo(target.x + 9, target.y);
        ctx.lineTo(target.x, target.y + 9); ctx.lineTo(target.x - 9, target.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.font = '9px monospace';
        ctx.fillStyle = DIFFICULTY_COLORS[route.difficulty] || '#d8d2c4';
        ctx.textAlign = 'center';
        ctx.fillText(route.name, target.x, target.y + (route.toY > 5 ? -14 : 22));

        newHitNodes.push({ x: target.x, y: target.y, r: 14, kind: 'relay', route });
      }

      // V1.2.0 — marqueurs de danger: camps MULE hostiles du territoire actif, lecture seule de
      // game.mapsData[mapKey].muleCamps (même source que ui/HUD.js#renderMuleCamps, jamais mutée
      // ici). Losange rouge pulsant façon alerte radar — jamais cliquable depuis cette carte (le
      // clic reste réservé aux nœuds de Relais/QG, cf. handleCanvasClick, comme avant ce changement).
      for (const camp of (mapD.muleCamps || [])) {
        if (camp.status !== 'hostile') continue;
        const p = worldToScreen(camp.x, camp.y, transform);
        const dangerPulse = 0.5 + Math.sin(now / 300 + camp.x + camp.y) * 0.35;
        ctx.strokeStyle = `rgba(231, 76, 60, ${0.5 + dangerPulse * 0.4})`;
        ctx.fillStyle = `rgba(231, 76, 60, ${0.25 + dangerPulse * 0.25})`;
        ctx.shadowColor = 'rgba(231, 76, 60, 0.8)'; ctx.shadowBlur = 6 + dangerPulse * 6;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 7); ctx.lineTo(p.x + 7, p.y + 6); ctx.lineTo(p.x - 7, p.y + 6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(231, 76, 60, 0.95)';
        ctx.fillText('⚠️', p.x, p.y + 4);
      }

      // QG — losange ambre, toujours au centre du réseau logique
      ctx.fillStyle = '#FF9F1C';
      ctx.strokeStyle = '#FF9F1C';
      ctx.shadowColor = 'rgba(255, 159, 28, 0.6)'; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(hq.x, hq.y - 10); ctx.lineTo(hq.x + 10, hq.y);
      ctx.lineTo(hq.x, hq.y + 10); ctx.lineTo(hq.x - 10, hq.y);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#FF9F1C';
      ctx.fillText('QG', hq.x, hq.y - 16);

      hitNodes = newHitNodes;
      lastLogicalW = w; lastLogicalH = h;
      bindInteraction(canvasId);
    }

function handleCanvasClick(evt) {
      const canvas = evt.currentTarget;
      const rect = canvas.getBoundingClientRect();
      // V1.0.5 — hitNodes vit désormais en repère LOGIQUE (pixels CSS), le même que rect: une simple
      // soustraction suffit. L'ancien calcul (canvas.width / rect.width) supposait à tort que le
      // buffer physique et la taille CSS affichée coïncidaient toujours — faux dès que
      // devicePixelRatio != 1, ce qui décalait silencieusement chaque hit-test sur écran haute densité.
      const cx = evt.clientX - rect.left, cy = evt.clientY - rect.top;
      for (const node of hitNodes) {
        const d = Math.hypot(cx - node.x, cy - node.y);
        if (d <= node.r) {
          if (node.kind === 'hq') openContractBoardModal(game.currentMap);
          else openRaidSelectionModal();
          return;
        }
      }
    }

// Idempotent: un seul écouteur 'click' + un seul ResizeObserver par canvas, jamais réattachés à
// chaque frame (renderBridgesMap tourne à chaque ouverture/mise à jour de l'onglet Missions).
function bindInteraction(canvasId) {
      if (boundCanvasId === canvasId) return;
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      canvas.addEventListener('click', handleCanvasClick);
      boundCanvasId = canvasId;

      // V1.0.5 — observe le conteneur PARENT (pas le canvas lui-même: un canvas en width:100%/
      // aspect-ratio se redimensionne EN RÉACTION à son parent, l'observer directement dessus
      // créerait un couplage inutile) pour redessiner net à chaque changement de mise en page
      // (rotation, dépliage du Z Fold, redimensionnement fenêtre). Garde défensive typeof (même motif
      // que TutorialManager.js#ensureHighlightObserver): ResizeObserver n'existe pas dans
      // l'environnement de test Node (tests/resilience/_stubEnv.mjs), jamais de RNG/mutation
      // GameState ici, un simple nouveau rendu à partir de l'état déjà lu par render().
      if (typeof ResizeObserver === 'function' && canvas.parentElement) {
        new ResizeObserver(() => {
          const next = logicalSize(canvas);
          // Ignore les micro-variations sub-pixel (dont le premier déclenchement systématique de
          // ResizeObserver juste après observe(), même sans changement réel) — évite un re-rendu en
          // boucle pour rien.
          if (Math.abs(next.width - lastLogicalW) < 0.5 && Math.abs(next.height - lastLogicalH) < 0.5) return;
          renderBridgesMap(canvasId);
        }).observe(canvas.parentElement);
      }
    }
