// js/hud/toasts.js — notifications : succès débloqué (parchemin doré)
// et avertissement équipement fragile (cuivre/orangé). Apparition progressive.
import { G, ctx, W } from '../state.js';
import { roundRect } from '../utils.js';
import { HPAL, metalFrame, parchment, engraved } from './frame.js';

// notification de succès débloqué (bandeau doré en haut au centre)
export function drawAchToast() {
  const t = G.achToast;
  if (!t) return;
  const a = Math.min(1, t.t / 0.4, (3.5 - t.t) / 0.3 + 1); // fade in/out
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  // léger soulèvement à l'apparition
  const rise = (1 - Math.min(1, t.t / 0.4)) * -8;
  const label = `SUCCÈS DÉBLOQUÉ : ${t.name}`;
  ctx.font = 'bold 16px Georgia, serif';
  const tw = ctx.measureText(label).width;
  const bw = tw + 76, bh = 42, bx = W / 2 - bw / 2, by = 66 + rise;
  // cadre métal + parchemin derrière le texte
  metalFrame(bx - 3, by - 3, bw + 6, bh + 6, 12, { glow: 'rgba(255,215,64,0.4)' });
  parchment(bx + 8, by + 7, bw - 16, bh - 14, 0.85);
  engraved('✦', bx + 26, by + 28, 20, HPAL.goldLo, 'center', 'Georgia, serif');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3a2a14';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText(label, bx + 46, by + 27);
  ctx.font = '10px Georgia, serif'; ctx.fillStyle = '#6d5a3a';
  ctx.fillText(t.icon || '', bx + 46, by + 40);
  ctx.restore();
}

// avertissement orange (ex. équipement à moins de 20 % de durabilité)
export function drawWarnToast() {
  const t = G.warnToast;
  if (!t) return;
  const a = Math.min(1, t.t / 0.4, (6 - t.t) / 0.3 + 1); // fade in/out
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  const rise = (1 - Math.min(1, t.t / 0.4)) * -8;
  ctx.font = 'bold 15px Inter, sans-serif';
  const tw = ctx.measureText(t.name).width;
  const bw = tw + 56, bh = 36, bx = W / 2 - bw / 2, by = 118 + rise;
  // cuir foncé + filet cuivre
  const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
  bg.addColorStop(0, '#4a2c14'); bg.addColorStop(1, '#2c1a0c');
  ctx.fillStyle = bg;
  roundRect(bx, by, bw, bh, 10); ctx.fill();
  ctx.strokeStyle = '#e08a3c'; ctx.lineWidth = 1.6;
  ctx.shadowColor = 'rgba(224,138,60,0.7)'; ctx.shadowBlur = 10;
  roundRect(bx + 1, by + 1, bw - 2, bh - 2, 9); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd9a8';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText(`⚠ ${t.name}`, bx + bw / 2, by + bh / 2 + 5);
  ctx.restore();
}
