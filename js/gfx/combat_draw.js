import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';

export function drawSlashArc() {
  // lame de feu : visible pendant le cooldown de l'attaque
  const p = G.player;
  if (p.attackCooldown <= 0) return;
  const angle = playerAngle();
  if (p.attackMode === 3) {
    // lance : traînée de perforation effilée + lignes de vitesse (reste ~0,2s)
    if (p.attackCooldown < 0.12) return;
    const t = Math.max(0, Math.min(1, (0.32 - p.attackCooldown) / 0.2));
    const life = 1 - t, R = p.attackRange * 1.5;
    const ex = Math.cos(angle), ey = Math.sin(angle);
    const sx = p.x + ex * p.r, sy = p.y + ey * p.r;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // halo large -> corps doré -> cœur blanc (trois épaisseurs)
    const layers = [
      { w: 18, c: `rgba(255,120,30,${0.16 * life})` },
      { w: 8,  c: `rgba(255,190,80,${0.38 * life})` },
      { w: 2.5,c: `rgba(255,255,255,${0.85 * life})` }
    ];
    ctx.lineCap = 'round';
    for (const L of layers) {
      ctx.strokeStyle = L.c; ctx.lineWidth = L.w;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + ex * R * (0.92 + t * 0.08), sy + ey * R * (0.92 + t * 0.08));
      ctx.stroke();
    }
    // lignes de vitesse perpendiculaires le long de la trajectoire
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * life})`; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const d = R * (0.45 + i * 0.13);
      const off = 9 + i * 5;
      ctx.beginPath();
      ctx.moveTo(sx + ex * d - ey * off, sy + ey * d + ex * off);
      ctx.lineTo(sx + ex * (d + 18) - ey * off, sy + ey * (d + 18) + ex * off);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + ex * d + ey * off, sy + ey * d - ex * off);
      ctx.lineTo(sx + ex * (d + 18) + ey * off, sy + ey * (d + 18) - ex * off);
      ctx.stroke();
    }
    // flash de perforation à la pointe
    const fg2 = ctx.createRadialGradient(sx + ex * R, sy + ey * R, 2, sx + ex * R, sy + ey * R, 26);
    fg2.addColorStop(0, `rgba(255,240,190,${0.7 * life})`);
    fg2.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = fg2;
    ctx.beginPath(); ctx.arc(sx + ex * R, sy + ey * R, 26, 0, TAU); ctx.fill();
    ctx.restore();
    return;
  }
  if (p.attackCooldown < 0.25) return;
  // épée : progression du balayage — le flash épouse la lame (du pommeau à la pointe)
  const t = (0.4 - p.attackCooldown) / 0.15;
  const life = 1 - t;
  const prog = Math.min(1, t * 1.5);
  const a0 = angle - p.attackArc / 2;
  const sweep = p.attackArc * prog;
  const rIn = p.r - 6;          // départ : poignée de l'épée
  const rOut = p.r + 84;        // arrivée : bout de la lame
  const R = p.r + 55;           // rayon médian de la traînée
  // éventail annulaire rempli (la « cicatrice » du coup, à la hauteur de la texture)
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, rOut, a0, a0 + sweep);
  ctx.arc(p.x, p.y, rIn, a0 + sweep, a0, true);
  ctx.closePath();
  const fg = ctx.createRadialGradient(p.x, p.y, rIn, p.x, p.y, rOut);
  fg.addColorStop(0, `rgba(255,255,255,${0.30 * life})`);
  fg.addColorStop(0.55, `rgba(255,215,64,${0.18 * life})`);
  fg.addColorStop(1, 'rgba(255,110,40,0)');
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.restore();
  // tranches superposées le long de la lame : blanc → or → orange
  const cols = ['rgba(255,255,255,', 'rgba(255,233,163,', 'rgba(255,215,64,', 'rgba(255,152,0,', 'rgba(255,87,34,'];
  const widths = [3, 6, 10, 14, 18];
  const radii = [p.r + 14, p.r + 34, p.r + 55, p.r + 72, p.r + 82];
  ctx.lineCap = 'round';
  for (let i = 0; i < cols.length; i++) {
    const back = sweep * i * 0.12;
    const aStart = a0 + back;
    const aEnd = a0 + sweep - back * 0.5;
    if (aEnd <= aStart) continue;
    ctx.strokeStyle = cols[i] + `${(0.85 - i * 0.13) * life})`;
    ctx.lineWidth = widths[i] * (0.6 + 0.4 * life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radii[i], aStart, aEnd);
    ctx.stroke();
  }
  // liseré brillant sur le bord d'attaque (le tranchant)
  ctx.strokeStyle = `rgba(255,255,255,${0.9 * life})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, rOut, a0 + sweep - 0.05, a0 + sweep);
  ctx.stroke();
}

export function drawUltFlash() {
  // flash radial cinématique au point d'impact de la bombe atomique
  const m = G.mushroom;
  if (!m || m.t > 1.1) return;
  const t = m.t / 1.1;
  const R = G.player.ultRadius * (G.equip ? G.equip.ultR : 1);
  // noyau blanc brûlant
  const core = Math.max(0, 1 - t * 1.6);
  if (core > 0) {
    ctx.globalAlpha = core;
    const cg = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, R * 0.45);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.6, '#fff9c4');
    cg.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(m.x, m.y, R * 0.5, 0, TAU); ctx.fill();
  }
  // halo chaud qui s'étend
  ctx.globalAlpha = Math.max(0, 1 - t) * 0.9;
  const gg = ctx.createRadialGradient(m.x, m.y, 10, m.x, m.y, R * (0.6 + t * 0.4));
  gg.addColorStop(0, 'rgba(255,255,255,0.95)');
  gg.addColorStop(0.4, 'rgba(255,140,40,0.7)');
  gg.addColorStop(1, 'rgba(255,40,20,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, TAU); ctx.fill();
  // anneau de décompression
  ctx.globalAlpha = Math.max(0, 1 - t * 1.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 6 * (1 - t) + 1;
  ctx.beginPath(); ctx.arc(m.x, m.y, R * (0.3 + t * 0.9), 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
}
