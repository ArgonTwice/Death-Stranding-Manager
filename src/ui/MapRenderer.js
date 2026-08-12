// AUTO-EXTRACTED MODULE: ui/MapRenderer.js
// Généré depuis le monolithe index.html original (refacto ES Modules, comportement inchangé).

import { eventBus } from '../core/EventBus.js';
import { game, runtime } from '../core/GameState.js';
import { GRID_SIZE, HQ, MAP_HEIGHT, MAP_WIDTH } from '../data/Balance.js';
import { CARGO_COLORS, CARGO_TYPES, PCC_TYPES, cellKey, countryInfo } from '../data/Constants.js';
import { isBTZone, nearestRouteInfo } from '../engine/MapEngine.js';

const staticLayer = document.createElement('canvas');

staticLayer.width = 800;

staticLayer.height = 400;

const staticCtx = staticLayer.getContext('2d');

export function markMapDirty() { runtime.mapDirty = true; }

export function renderStaticLayer() {
      const ctx = staticCtx;
      const cInfo = countryInfo(game.currentMap);

      ctx.fillStyle = cInfo.bg;
      ctx.fillRect(0, 0, staticLayer.width, staticLayer.height);

      ctx.strokeStyle = cInfo.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= MAP_WIDTH; i++) {
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, staticLayer.height);
      }
      for (let i = 0; i <= MAP_HEIGHT; i++) {
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(staticLayer.width, i * GRID_SIZE);
      }
      ctx.stroke();

      // Terrain canon: montagnes (chevrons gris) et rivières (vagues bleues)
      for (let key in game.terrain) {
        const [tx, ty] = key.split(',').map(Number);
        const px0 = tx * GRID_SIZE, py0 = ty * GRID_SIZE;
        if (game.terrain[key] === 'mountain') {
          ctx.strokeStyle = 'rgba(160, 150, 130, 0.3)';
          ctx.lineWidth = 1.5;
          for (let s = 0; s < 3; s++) {
            const sy = py0 + 14 + s * 14;
            ctx.beginPath();
            ctx.moveTo(px0 + 10, sy + 8);
            ctx.lineTo(px0 + GRID_SIZE / 2, sy - 4);
            ctx.lineTo(px0 + GRID_SIZE - 10, sy + 8);
            ctx.stroke();
          }
        } else if (game.terrain[key] === 'river') {
          ctx.strokeStyle = 'rgba(80, 150, 200, 0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let s = 0; s <= 4; s++) {
            const wx = px0 + (s / 4) * GRID_SIZE;
            const wy = py0 + GRID_SIZE / 2 + Math.sin(s * 1.5) * 8;
            if (s === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
          }
          ctx.stroke();
        }
      }

      // Cratères permanents: cicatrices calcinées des néantisations passées
      for (let key of game.craters) {
        const [cx, cy] = key.split(',').map(Number);
        const px = cx * GRID_SIZE + GRID_SIZE / 2, py = cy * GRID_SIZE + GRID_SIZE / 2;
        ctx.fillStyle = 'rgba(10, 8, 6, 0.85)';
        ctx.beginPath();
        ctx.arc(px, py, GRID_SIZE * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 40, 40, 0.5)';
        ctx.lineWidth = 1;
        for (let a = 0; a < 5; a++) {
          const ang = (a / 5) * Math.PI * 2 + (cx * 13 + cy * 7);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(ang) * GRID_SIZE * 0.38, py + Math.sin(ang) * GRID_SIZE * 0.38);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(125, 90, 166, 0.25)';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      runtime.mapDirty = false;
    }

let mapFrameSkip = false;

export function drawMap() {
      // Throttle à ~30fps: les animations (pulses BT/Catcher/camps) sont lentes, 60fps est du gaspillage
      // CPU pur sur mobile. Divise par 2 le coût de TOUTE la boucle (paths, dégradés, texte) sans rien changer visuellement.
      mapFrameSkip = !mapFrameSkip;
      if (mapFrameSkip) { requestAnimationFrame(drawMap); return; }

      const canvas = document.getElementById('gameMap');
      const ctx = canvas.getContext('2d');
      const now = performance.now();

      // Calque statique (fond/grille/terrain/cratères): 1 seul drawImage() au lieu de tout redessiner
      if (runtime.mapDirty) renderStaticLayer();
      ctx.drawImage(staticLayer, 0, 0);

      const cInfo = countryInfo(game.currentMap);

      // Zones BT: tache organique violacée avec léger pulse + texture "tar"
      const btPulse = 0.18 + Math.sin(now / 900) * 0.05;
      for (let key of game.btZones) {
        const [zx, zy] = key.split(',').map(Number);
        if (isBTZone(zx, zy)) {
          const cx = zx * GRID_SIZE + GRID_SIZE / 2;
          const cy = zy * GRID_SIZE + GRID_SIZE / 2;
          const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, GRID_SIZE * 0.75);
          grad.addColorStop(0, `rgba(125, 90, 166, ${btPulse + 0.15})`);
          grad.addColorStop(1, 'rgba(20, 10, 25, 0.05)');
          ctx.fillStyle = grad;
          ctx.fillRect(zx * GRID_SIZE, zy * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        }
      }

      // PCC posés: icône selon le type (fantômes en semi-transparence pulsante)
      for (const pcc of (game.pccInstalls || [])) {
        const px = pcc.x * GRID_SIZE + GRID_SIZE / 2;
        const py = pcc.y * GRID_SIZE + GRID_SIZE / 2;
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = pcc.ghost ? `rgba(200,220,255,${0.4 + Math.sin(now / 350) * 0.3})` : 'rgba(255,255,255,0.9)';
        ctx.fillText(PCC_TYPES[pcc.type].icon, px, py + 5);
      }

      // Cargaisons perdues: petit colis clignotant, à récupérer au passage
      for (const c of (game.lostCargo || [])) {
        const px = c.x * GRID_SIZE + GRID_SIZE / 2;
        const py = c.y * GRID_SIZE + GRID_SIZE / 2;
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(232,199,137,${0.5 + Math.sin(now / 250) * 0.4})`;
        ctx.fillText('📦', px, py + 5);
      }

      // Catcher majeur: icône imposante, pulse violet menaçant
      for (const c of (game.catchers || [])) {
        const cx = c.x * GRID_SIZE + GRID_SIZE / 2;
        const cy = c.y * GRID_SIZE + GRID_SIZE / 2;
        const pulse2 = 0.4 + Math.sin(now / 300) * 0.25;
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, GRID_SIZE * 0.9);
        grad.addColorStop(0, `rgba(125, 90, 166, ${pulse2 + 0.35})`);
        grad.addColorStop(1, 'rgba(125, 90, 166, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, GRID_SIZE * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(230, 210, 255, 0.9)`;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('👹', cx, cy + 6);
      }

      // Camps MULEs: pastille colorée selon statut (hostile=rouge pulsant, pacifié=or, relais=cyan)
      for (const camp of (game.muleCamps || [])) {
        const cx = camp.x * GRID_SIZE + GRID_SIZE / 2;
        const cy = camp.y * GRID_SIZE + GRID_SIZE / 2;
        const color = camp.status === 'hostile' ? '201,56,56' : camp.status === 'under_attack' ? '230,160,40' : camp.status === 'relay' ? '74,217,224' : '232,199,137';
        const campPulse = camp.status === 'hostile' ? (0.5 + Math.sin(now / 400) * 0.3) : camp.status === 'under_attack' ? (0.55 + Math.sin(now / 220) * 0.4) : 0.6;
        ctx.fillStyle = `rgba(${color}, ${campPulse})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 9);
        ctx.lineTo(cx + 8, cy + 6);
        ctx.lineTo(cx - 8, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(${color}, 0.9)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Réseau chiral: lignes cyan pulsantes
      const pulse = 0.5 + Math.sin(now / 500) * 0.5;
      ctx.strokeStyle = `rgba(74, 217, 224, ${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(74, 217, 224, 0.6)';
      ctx.shadowBlur = 6;
      const routeArr = Array.from(game.routes);
      for (let key of routeArr) {
        const [rx, ry] = key.split(',').map(Number);
        for (let [dx, dy] of [[1,0],[0,1]]) {
          const nkey = cellKey(rx + dx, ry + dy);
          if (game.routes.has(nkey)) {
            ctx.beginPath();
            ctx.moveTo(rx * GRID_SIZE + GRID_SIZE/2, ry * GRID_SIZE + GRID_SIZE/2);
            ctx.lineTo((rx+dx) * GRID_SIZE + GRID_SIZE/2, (ry+dy) * GRID_SIZE + GRID_SIZE/2);
            ctx.stroke();
          }
        }
      }
      ctx.shadowBlur = 0;


      // Plate Gate: portail vers un autre territoire (canon DS2), coin haut-droit
      if (Object.keys(game.mapsData).length > 1) {
        const gx2 = canvas.width - 35, gy2 = 35;
        const spin2 = (now / 500) % (Math.PI * 2);
        for (let r = 0; r < 3; r++) {
          ctx.strokeStyle = `rgba(74, 217, 224, ${0.6 - r * 0.15})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(gx2, gy2, 14 - r * 3, spin2 + r, spin2 + r + Math.PI * 1.4);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PLATE GATE', gx2, gy2 + 24);
      }

      // Antennes (HQ + succursales): losange ambre, l'antenne active brille plus fort
      const mapD = game.mapsData[game.currentMap];
      mapD.branches.forEach((b, i) => {
        const bCx = b.x * GRID_SIZE + GRID_SIZE/2, bCy = b.y * GRID_SIZE + GRID_SIZE/2;
        const isActive = i === mapD.activeBranch;
        ctx.fillStyle = isActive ? '#ff8c2b' : 'rgba(255, 140, 43, 0.55)';
        ctx.beginPath();
        ctx.moveTo(bCx, bCy - 7); ctx.lineTo(bCx + 7, bCy);
        ctx.lineTo(bCx, bCy + 7); ctx.lineTo(bCx - 7, bCy);
        ctx.closePath(); ctx.fill();
      });

      // Villes principales: hexagone doré, plein une fois raccordées au réseau chiral
      (mapD.mainKnots || []).forEach(k => {
        const kCx = k.x * GRID_SIZE + GRID_SIZE/2, kCy = k.y * GRID_SIZE + GRID_SIZE/2;
        const connected = mapD.routes.has(cellKey(k.x, k.y));

        // Distance restante: ligne pointillée depuis le point de réseau le plus proche
        if (!connected) {
          const { cell } = nearestRouteInfo(k.x, k.y);
          const nCx = cell[0] * GRID_SIZE + GRID_SIZE/2, nCy = cell[1] * GRID_SIZE + GRID_SIZE/2;
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(255, 210, 63, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nCx, nCy);
          ctx.lineTo(kCx, kCy);
          ctx.stroke();
          ctx.restore();
        }

        ctx.strokeStyle = connected ? '#ffd23f' : 'rgba(255, 210, 63, 0.45)';
        ctx.fillStyle = connected ? '#ffd23f' : 'rgba(255, 210, 63, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2 - Math.PI / 2;
          const kx = kCx + Math.cos(ang) * 9, ky = kCy + Math.sin(ang) * 9;
          if (a === 0) ctx.moveTo(kx, ky); else ctx.lineTo(kx, ky);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.font = '8px monospace';
        ctx.fillStyle = connected ? '#ffd23f' : 'rgba(216,210,196,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(k.name, kCx, kCy - 13);
      });

      // Livraisons en cours: cible colorée selon cargo (uniquement celles de la carte affichée)
      for (let d of game.deliveries) {
        if (d.map !== game.currentMap) continue;
        const dx = d.destX * GRID_SIZE + GRID_SIZE/2, dy = d.destY * GRID_SIZE + GRID_SIZE/2;
        const cColor = CARGO_COLORS[d.cargoType] || CARGO_COLORS.standard;
        ctx.strokeStyle = cColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(dx, dy, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fillStyle = cColor; ctx.fill();
        const icon = (CARGO_TYPES[d.cargoType] || CARGO_TYPES.standard).name.split(' ')[0];
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(icon, dx, dy - 14);

        // Deadline dure (urgent): jauge radiale du temps restant, rouge si critique
        if (d.cargoType === 'urgent') {
          const frac = Math.max(0, Math.min(1, d.timeRemaining / d.maxSteps));
          ctx.strokeStyle = frac > 0.4 ? '#ffd23f' : '#ff3b3b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(dx, dy, 14, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
          ctx.stroke();
        }
      }

      // Porteurs: silhouette pod (uniquement ceux de la carte affichée)
      for (let p of game.porters) {
        if (p.map !== game.currentMap) continue;
        const px = p.x * GRID_SIZE + GRID_SIZE/2, py = p.y * GRID_SIZE + GRID_SIZE/2;
        let color;
        if (p.status === 'dead') color = '#3a3530';
        else if (p.status === 'left') color = '#4a453a';
        else if (p.status === 'idle') color = '#4ad9e0';
        else color = '#ff8c2b';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();
        // cargo pack
        ctx.fillRect(px - 4, py - 16, 8, 7);

        ctx.fillStyle = '#060504';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.id + 1, px, py + 3);

        // Odradek: radar rotatif au-dessus des porteurs équipés scanner
        if (p.equipment.scanner && p.status !== 'dead' && p.status !== 'left') {
          const sweepAngle = (now / 400) % (Math.PI * 2);
          ctx.strokeStyle = 'rgba(74, 217, 224, 0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(px, py - 20, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px, py - 20);
          ctx.lineTo(px + Math.cos(sweepAngle) * 6, py - 20 + Math.sin(sweepAngle) * 6);
          ctx.stroke();
        }

        // Chiral Allergy canon: larme quand le stress est critique
        if (p.stress > 80 && p.status !== 'dead' && p.status !== 'left') {
          const dropOffset = (now / 300) % 10;
          ctx.fillStyle = 'rgba(120, 190, 230, 0.7)';
          ctx.beginPath();
          ctx.arc(px + 5, py - 4 + dropOffset, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- Frappe Temporelle (pluie) ---
      if (now < runtime.timefallUntil) {
        ctx.strokeStyle = 'rgba(180, 200, 90, 0.35)';
        ctx.lineWidth = 1;
        for (let drop of runtime.rainDrops) {
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - 2, drop.y + drop.len);
          ctx.stroke();
          drop.y += drop.speed;
          drop.x -= 0.4;
          if (drop.y > canvas.height) { drop.y = -20; drop.x = Math.random() * canvas.width; }
        }
        // teinte verdâtre de dégradation chirale
        ctx.fillStyle = 'rgba(120, 140, 60, 0.04)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // --- Duststorm (DS2 Australie) ---
      if (now < runtime.duststormUntil) {
        ctx.fillStyle = 'rgba(190, 130, 60, 0.5)';
        for (let d of runtime.dustParticles) {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
          d.x += d.vx; d.y += d.vy;
          if (d.x > canvas.width) { d.x = -10; d.y = Math.random() * canvas.height; }
        }
        ctx.fillStyle = 'rgba(180, 120, 50, 0.08)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // --- Néantisations: onde de choc + Le Rivage ---
      game.voidouts = game.voidouts.filter(v => now - v.start < 2600);
      for (let v of game.voidouts) {
        const elapsed = now - v.start;
        const vx = v.x * GRID_SIZE + GRID_SIZE/2, vy = v.y * GRID_SIZE + GRID_SIZE/2;

        // Onde de choc (0-1200ms): anneaux qui s'étendent
        if (elapsed < 1200) {
          const t = elapsed / 1200;
          for (let ring = 0; ring < 3; ring++) {
            const ringT = Math.max(0, t - ring * 0.15);
            if (ringT <= 0) continue;
            const radius = ringT * 140;
            ctx.strokeStyle = `rgba(201, 56, 56, ${(1 - ringT) * 0.7})`;
            ctx.lineWidth = 3 - ringT * 2;
            ctx.beginPath();
            ctx.arc(vx, vy, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          // Flash central
          ctx.fillStyle = `rgba(255, 200, 180, ${(1 - t) * 0.5})`;
          ctx.beginPath(); ctx.arc(vx, vy, 20 * (1 - t) + 5, 0, Math.PI * 2); ctx.fill();
        }

        // Le Rivage: brume grise qui envahit tout l'écran (800-2600ms)
        if (elapsed > 800) {
          const beachT = Math.min(1, (elapsed - 800) / 900);
          const fadeOut = elapsed > 1900 ? 1 - (elapsed - 1900) / 700 : 1;
          const alpha = beachT * fadeOut * 0.55;
          if (alpha > 0.01) {
            const fog = ctx.createRadialGradient(vx, vy, 10, vx, vy, 500);
            fog.addColorStop(0, `rgba(140, 140, 130, ${alpha})`);
            fog.addColorStop(1, `rgba(10, 10, 10, ${alpha * 0.8})`);
            ctx.fillStyle = fog;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = `rgba(200, 195, 180, ${alpha})`;
            ctx.font = 'italic 13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('— le rivage —', canvas.width / 2, canvas.height / 2);
          }
        }
      }

      // Légende
      ctx.fillStyle = 'rgba(216, 210, 196, 0.5)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('◆ idle  ◆ transit  ◆ hors service  ◇ cible  ◈ HQ  ▬ réseau  ░ zone BT  ● cratère  ▲ montagne  〜 rivière', 10, canvas.height - 8);

      requestAnimationFrame(drawMap);
    }

// --- Abonnement EventBus : la bannière NÉANTISATION est un effet visuel, déclenché depuis
// l'engine (DeliveryEngine.triggerVoidout) sans jamais toucher le DOM directement. ---
eventBus.on('voidout:banner', () => {
  const banner = document.getElementById('voidoutBanner');
  if (!banner) return;
  banner.classList.remove('flash');
  void banner.offsetWidth; // force reflow pour relancer l'animation
  banner.classList.add('flash');
});
