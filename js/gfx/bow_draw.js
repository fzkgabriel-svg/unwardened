// js/gfx/bow_draw.js — rendu de l'ARC CINÉTIQUE COSMIQUE.
// Arme extraterrestre : branches asymétriques en alliage sombre, fragments
// de météorite, cristaux orbitaux, corde d'énergie, noyau pulsant.
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { bowUnlocked } from '../bow.js';

const VIOLET = '#7b1fa2', VIOLET_HI = '#b388ff';
const CYAN = '#00e5ff', BLUE = '#2979ff', SILVER = '#e8eaf6';

// ---------- ARC (espace joueur, pointe vers le curseur) ----------
//Dessine l'arc centré à l'origine, orienté +x. `charge` 0..1 tend la corde.
export function drawCosmicBow(charge = 0, recoil = 0) {
  const t = G.time || 0;
  const pull = 4 + charge * 9;          // corde : plus elle est tendue, plus elle est courte
  const flex = charge * 7;              // les branches se déforment sous pression
  const pulse = 0.75 + Math.sin(t * 6) * 0.25;

  ctx.save();
  ctx.translate(-recoil * 7, 0); // recul vers l'arrière

  // --- halo d'énergie ambiant ---
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hg = ctx.createRadialGradient(0, 0, 4, 0, 0, 60 + charge * 30);
  hg.addColorStop(0, `rgba(124,77,255,${0.16 + charge * 0.2})`);
  hg.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, 0, 60 + charge * 30, 0, TAU); ctx.fill();
  ctx.restore();

  // --- fragments de météorite orbitaux (contour de l'arc) ---
  for (let i = 0; i < 3; i++) {
    const oa = t * (0.7 + i * 0.23) + i * TAU / 3;
    const ox = Math.cos(oa) * 44, oy = Math.sin(oa) * 22 - 6;
    ctx.save();
    ctx.translate(ox, oy); ctx.rotate(oa * 1.7);
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.moveTo(-5, -4); ctx.lineTo(5, -2); ctx.lineTo(4, 5); ctx.lineTo(-4, 3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(179,136,255,${0.5 + pulse * 0.3})`; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = `rgba(0,229,255,${0.4 * pulse})`;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  // --- cristaux cosmiques qui gravitent ---
  for (let i = 0; i < 4; i++) {
    const oa = -t * (1.1 + i * 0.15) + i * TAU / 4 + 0.6;
    const cx = 14 + Math.cos(oa) * (30 - charge * 12);
    const cy = Math.sin(oa) * (16 - charge * 5);
    const cr = 2.4 + Math.sin(t * 8 + i * 2) * 0.8;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(oa);
    ctx.fillStyle = i % 2 ? 'rgba(179,136,255,0.9)' : 'rgba(0,229,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, -cr * 1.6); ctx.lineTo(cr, 0); ctx.lineTo(0, cr * 1.6); ctx.lineTo(-cr, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // --- branches asymétriques : superior courte/effilée, inférieure longue/lourde ---
  const limb = (sy, len, thick, curve) => {
    const tipX = len, tipY = sy * (len / 52) + curve;
    // matériau : dégradé sombre -> violet -> liseré cyan
    const g = ctx.createLinearGradient(-6, sy * 0.4, tipX, tipY);
    g.addColorStop(0, '#0b0b12'); g.addColorStop(0.55, '#1c1030');
    g.addColorStop(0.85, VIOLET); g.addColorStop(1, CYAN);
    ctx.strokeStyle = g; ctx.lineWidth = thick; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, sy * 0.35);
    ctx.bezierCurveTo(len * 0.3, sy * 0.5 + curve * 0.4, len * 0.7, tipY * 0.7, tipX, tipY);
    ctx.stroke();
    // nervures lumineuses internes (énergie qui circule)
    ctx.strokeStyle = `rgba(0,229,255,${0.35 + pulse * 0.3})`; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, sy * 0.35);
    ctx.bezierCurveTo(len * 0.3, sy * 0.5 + curve * 0.4, len * 0.7, tipY * 0.7, tipX - 3, tipY);
    ctx.stroke();
    // éclat à la pointe
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(0,229,255,${0.5 + pulse * 0.4})`;
    ctx.beginPath(); ctx.arc(tipX, tipY, 2.6 + pulse * 1.4, 0, TAU); ctx.fill();
    ctx.restore();
    return { x: tipX, y: tipY };
  };
  const topTip = limb(-16 - flex * 0.4, 46 - flex, 4.6, -6 - flex * 0.5);
  const botTip = limb(18 + flex * 0.5, 56 - flex * 0.7, 5.6, 10 + flex * 0.6);

  // --- poignée + protège-main ---
  ctx.fillStyle = '#14101c';
  roundRect(-16, -7, 16, 14, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(179,136,255,0.4)'; ctx.lineWidth = 1;
  roundRect(-16, -7, 16, 14, 4); ctx.stroke();
  // gravures extraterrestres (points + arcs)
  ctx.strokeStyle = `rgba(0,229,255,${0.4 + pulse * 0.3})`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(-8, 0, 4, 0.4, TAU - 0.8); ctx.stroke();
  ctx.fillStyle = `rgba(179,136,255,${0.5 + pulse * 0.4})`;
  ctx.fillRect(-11, -1, 2, 2); ctx.fillRect(-6, -1, 2, 2);

  // --- noyau central (source d'énergie cosmique) ---
  const coreR = 5.5 + charge * 4 + Math.sin(t * 7) * 0.8;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(2, 0, 1, 2, 0, coreR * 2.6);
  cg.addColorStop(0, `rgba(255,255,255,${0.75 + charge * 0.25})`);
  cg.addColorStop(0.35, `rgba(179,136,255,${0.6 + charge * 0.3})`);
  cg.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(2, 0, coreR * 2.6, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(2, 0, coreR * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = VIOLET_HI;
  ctx.beginPath(); ctx.arc(2, 0, coreR * 0.4, 0, TAU); ctx.fill();

  // --- corde énergétique (se tend avec la charge) ---
  const strX = 2 + pull; // ancrage vers l'avant
  ctx.strokeStyle = `rgba(0,229,255,${0.55 + charge * 0.4})`;
  ctx.lineWidth = 1.4 + charge * 0.8;
  ctx.beginPath();
  ctx.moveTo(topTip.x - 4, topTip.y);
  ctx.quadraticCurveTo(strX - 6, 0, botTip.x - 5, botTip.y);
  ctx.stroke();
  // vibrance de la corde chargée
  if (charge > 0.05) {
    ctx.strokeStyle = `rgba(255,255,255,${charge * 0.7})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const wob = Math.sin(t * 30) * charge * 1.6;
    ctx.moveTo(topTip.x - 4, topTip.y + wob);
    ctx.quadraticCurveTo(strX - 6, wob, botTip.x - 5, botTip.y - wob);
    ctx.stroke();
  }

  // --- flèche énergétique en cours de charge (nockée) ---
  if (charge > 0.12) {
    const nx = strX - 8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createRadialGradient(nx, 0, 1, nx, 0, 10 + charge * 12);
    fg.addColorStop(0, `rgba(255,255,255,${0.5 + charge * 0.5})`);
    fg.addColorStop(0.5, `rgba(${charge > 0.55 ? '179,136,255' : '64,196,255'},${0.5 + charge * 0.3})`);
    fg.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(nx, 0, 10 + charge * 12, 0, TAU); ctx.fill();
    ctx.restore();
    // ailettes de la flèche
    ctx.strokeStyle = `rgba(232,234,246,${0.7 + charge * 0.3})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(nx, 0); ctx.lineTo(nx + 7, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(nx, 0); ctx.lineTo(nx + 7, 4); ctx.stroke();
  }

  ctx.restore();
}

// ---------- projectiles ----------
export function drawBowShots() {
  if (!G.bowShots) return;
  const t = G.time || 0;
  for (const s of G.bowShots) {
    // traînée : segments dégradés
    const tr = s.trail;
    if (tr.length > 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const col = s.type === 'sing' ? '124,77,255' : s.type === 'charged' ? '179,136,255' : '64,196,255';
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length;
        ctx.strokeStyle = `rgba(${col},${k * k * 0.55})`;
        ctx.lineWidth = s.r * 1.5 * k;
        ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
      }
      ctx.restore();
    }
    // corps du projectile
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (s.type === 'sing') {
      // singularité : cœur sombre + anneau d'énergie + distorsion
      const pu = 0.8 + Math.sin(t * 14) * 0.2;
      const rg = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, s.r * 2.6);
      rg.addColorStop(0, 'rgba(0,0,0,0.9)');
      rg.addColorStop(0.4, `rgba(76,29,149,${0.75 * pu})`);
      rg.addColorStop(0.75, `rgba(179,136,255,${0.4 * pu})`);
      rg.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.6, 0, TAU); ctx.fill();
      // anneau de photons
      ctx.strokeStyle = `rgba(0,229,255,${0.7 * pu})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.5, t * 4, t * 4 + TAU * 0.8); ctx.stroke();
      ctx.strokeStyle = `rgba(224,64,251,${0.5 * pu})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.1, -t * 6, -t * 6 + TAU * 0.7); ctx.stroke();
    } else {
      const charged = s.type === 'charged';
      const pu = 0.8 + Math.sin(t * 18 + s.x * 0.1) * 0.2;
      const core = charged ? '179,136,255' : '64,196,255';
      const rg = ctx.createRadialGradient(s.x, s.y, 0.5, s.x, s.y, s.r * (charged ? 3 : 2.2));
      rg.addColorStop(0, `rgba(255,255,255,${0.95 * pu})`);
      rg.addColorStop(0.35, `rgba(${core},${0.8 * pu})`);
      rg.addColorStop(1, 'rgba(0,229,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (charged ? 3 : 2.2), 0, TAU); ctx.fill();
      // étincelles orbitant le projectile chargé
      if (charged) {
        for (let i = 0; i < 3; i++) {
          const a = t * 9 + i * TAU / 3;
          ctx.fillStyle = `rgba(224,64,251,${0.7 * pu})`;
          ctx.beginPath();
          ctx.arc(s.x + Math.cos(a) * s.r * 1.4, s.y + Math.sin(a) * s.r * 1.4, 1.6, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}

// ---------- zones de singularité (implosion + vortex) ----------
export function drawSingZones() {
  if (!G.singZones) return;
  const t = G.time || 0;
  for (const z of G.singZones) {
    const k = 1 - z.t / z.dur;         // 1 -> 0
    const grow = Math.min(1, z.t / 0.35);
    const r = z.r * (0.4 + 0.6 * grow) * (0.9 + Math.sin(t * 5) * 0.05);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // disque de distorsion : dégradé sombre au centre vers liseré violet
    const dg = ctx.createRadialGradient(z.x, z.y, r * 0.1, z.x, z.y, r);
    dg.addColorStop(0, `rgba(10,4,30,${0.55 * k})`);
    dg.addColorStop(0.55, `rgba(76,29,149,${0.30 * k})`);
    dg.addColorStop(0.85, `rgba(124,77,255,${0.28 * k})`);
    dg.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, TAU); ctx.fill();
    // anneaux d'implosion spiralés
    for (let i = 0; i < 3; i++) {
      const rr = r * (0.35 + i * 0.28) * (1 - (z.t * 0.12 % 1) * 0.3);
      ctx.strokeStyle = `rgba(${i === 1 ? '224,64,251' : '0,229,255'},${(0.4 - i * 0.1) * k})`;
      ctx.lineWidth = 2 - i * 0.4;
      ctx.beginPath();
      ctx.arc(z.x, z.y, rr, t * (2 + i) + i, t * (2 + i) + i + TAU * 0.75);
      ctx.stroke();
    }
    // étoile à 4 branches au centre (singularité)
    const cr = 12 + Math.sin(t * 16) * 3;
    ctx.strokeStyle = `rgba(224,64,251,${0.8 * k})`; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(z.x - cr * 2, z.y); ctx.lineTo(z.x + cr * 2, z.y);
    ctx.moveTo(z.x, z.y - cr * 2); ctx.lineTo(z.x, z.y + cr * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- icône HUD / carte de sélection ----------
export function drawBowIcon(x, y, s = 1, alpha = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  // silhouette simplifiée : deux branches + corde + noyau
  ctx.strokeStyle = '#7b1fa2'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.quadraticCurveTo(6, 0, -8, 10); ctx.stroke();
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.moveTo(-8, 10); ctx.lineTo(8, 10); ctx.stroke();
  ctx.strokeStyle = '#e8eaf6'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(8, 10); ctx.stroke();
  const pu = 0.6 + Math.sin((G.time || 0) * 6) * 0.3;
  ctx.fillStyle = `rgba(179,136,255,${pu})`;
  ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------- animation de révélation (victoire monde 9) ----------
// arc qui se matérialise : fragments convergents -> noyau -> onde d'énergie
export function drawBowReveal() {
  const rv = G.bowReveal;
  if (!rv) return;
  const t = G.time - rv;
  if (t < 0 || t > 5.2) { if (t > 5.2) G.bowReveal = null; return; }
  const fadeOut = t > 4.4 ? (5.2 - t) / 0.8 : 1;
  const A = Math.min(1, t * 1.6) * fadeOut;

  ctx.save();
  ctx.globalAlpha = A;
  // fond spatial profond
  ctx.fillStyle = 'rgba(4,2,12,0.94)'; ctx.fillRect(0, 0, W, H);
  // champ d'étoiles dérivant
  for (let i = 0; i < 90; i++) {
    const sx = ((i * 197 + t * (6 + (i % 5) * 3)) % (W + 60)) - 30;
    const sy = (i * 131) % H;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + (i % 3) * 0.4) + i));
    ctx.fillStyle = i % 4 === 0 ? `rgba(179,136,255,${0.5 * tw})` : `rgba(180,210,255,${0.35 * tw})`;
    ctx.fillRect(sx, sy, i % 7 === 0 ? 2.4 : 1.4, i % 7 === 0 ? 2.4 : 1.4);
  }
  // nébuleuse violette
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ng = ctx.createRadialGradient(W / 2, H * 0.44, 40, W / 2, H * 0.44, W * 0.4);
  ng.addColorStop(0, 'rgba(76,29,149,0.30)'); ng.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const cx = W / 2, cy = H * 0.44;
  // les fragments convergent vers le centre puis l'arc se forme
  const assemble = Math.min(1, t / 1.4);
  const ea = 1 - Math.pow(1 - assemble, 3);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(4.2 * (0.6 + 0.4 * ea), 4.2 * (0.6 + 0.4 * ea));
  ctx.globalAlpha = A * (0.25 + 0.75 * ea);
  // rotation d'entrée
  ctx.rotate((1 - ea) * -0.9);
  drawCosmicBow(0.25 + 0.35 * Math.sin(t * 3), 0);
  ctx.restore();

  // particules convergentes pendant l'assemblage
  if (assemble < 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const a = i * 2.4 + t * 0.5;
      const rr = (1 - ea) * (140 + (i % 5) * 50) + 20;
      const px2 = cx + Math.cos(a) * rr, py2 = cy + Math.sin(a) * rr * 0.7;
      ctx.fillStyle = i % 3 ? `rgba(179,136,255,${0.7 * (1 - ea)})` : `rgba(0,229,255,${0.7 * (1 - ea)})`;
      ctx.beginPath(); ctx.arc(px2, py2, 1.6 + (i % 3), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // onde énergétique traversant l'arc (~1.6s)
  if (t > 1.4 && t < 2.6) {
    const k = (t - 1.4) / 1.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(0,229,255,${(1 - k) * 0.8})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 60 + k * W * 0.5, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(224,64,251,${(1 - k) * 0.5})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 40 + k * W * 0.42, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // textes
  ctx.textAlign = 'center';
  ctx.globalAlpha = A * Math.min(1, Math.max(0, (t - 1.5) / 0.5)) * fadeOut;
  ctx.fillStyle = '#b388ff'; ctx.font = 'bold 20px Georgia, serif';
  ctx.fillText('— ARME LÉGENDAIRE DÉCOUVERTE —', cx, cy + 190);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('ARC CINÉTIQUE COSMIQUE', cx, cy + 230);
  ctx.fillStyle = '#80d8ff'; ctx.font = 'italic 15px Inter, sans-serif';
  ctx.fillText('L\'héritage de l\'Abomination Cosmique — clé X pour l\'équiper', cx, cy + 258);
  ctx.restore();
}
