// js/hud/toasts.js — notifications : succès débloqué (parchemin doré)
// et avertissement équipement fragile (cuivre/orangé). Apparition progressive.
import { G, ctx, W } from '../state.js';
import { roundRect } from '../utils.js';

// notification de succès débloqué (carte élégante en haut au centre)
// t.rar = clé de rareté ('commun'|'rare'|'epique'|'legendaire') si connue
const TOAST_RAR = {
  commun:     { label: 'COMMUN',     color: '#9e9e9e', glow: 'rgba(158,158,158,0.35)' },
  rare:       { label: 'RARE',       color: '#4fc3f7', glow: 'rgba(79,195,247,0.45)' },
  epique:     { label: 'ÉPIQUE',     color: '#ba68c4', glow: 'rgba(186,104,196,0.5)' },
  legendaire: { label: 'LÉGENDAIRE', color: '#ffd740', glow: 'rgba(255,215,64,0.75)' },
};
export function drawAchToast() {
  const t = G.achToast;
  if (!t) return;
  const a = Math.min(1, t.t / 0.4, (3.5 - t.t) / 0.3 + 1); // fade in/out
  const rar = TOAST_RAR[t.rar] || TOAST_RAR.commun;
  const legendary = t.rar === 'legendaire';
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  // léger soulèvement + pulse à l'apparition
  const k = Math.min(1, t.t / 0.4);
  const rise = (1 - k) * -14;
  const pulse = legendary ? 1 + Math.sin(G.time * 6) * 0.02 : 1;
  const label = `SUCCÈS DÉBLOQUÉ`;
  ctx.font = 'bold 15px Georgia, serif';
  const tw = ctx.measureText(label).width;
  const bw = Math.max(tw + 130, 300) * pulse, bh = 56;
  const bx = W / 2 - bw / 2, by = 60 + rise;
  // halo rareté (fort pour les légendaires)
  if (legendary || t.rar === 'epique') {
    ctx.shadowColor = rar.glow; ctx.shadowBlur = legendary ? 26 : 14;
  }
  // carte sombre raffinée
  const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
  bg.addColorStop(0, 'rgba(18,16,26,0.96)'); bg.addColorStop(1, 'rgba(8,8,14,0.96)');
  ctx.fillStyle = bg;
  roundRect(bx, by, bw, bh, 12); ctx.fill();
  ctx.strokeStyle = rar.color; ctx.lineWidth = legendary ? 2 : 1.4;
  roundRect(bx + 1, by + 1, bw - 2, bh - 2, 11); ctx.stroke();
  ctx.shadowBlur = 0;
  // filet supérieur rareté
  const fg = ctx.createLinearGradient(bx + 20, 0, bx + bw - 20, 0);
  fg.addColorStop(0, 'transparent'); fg.addColorStop(0.5, rar.color); fg.addColorStop(1, 'transparent');
  ctx.fillStyle = fg;
  roundRect(bx + 20, by + 2, bw - 40, 3, 1.5); ctx.fill();
  // icône du succès
  ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t.icon || '🏆', bx + 38, by + bh / 2 + 1);
  // textes
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd740';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.fillText(label, bx + 66, by + 24);
  ctx.fillStyle = '#efe8d6';
  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.fillText(t.name.length > 26 ? t.name.slice(0, 25) + '…' : t.name, bx + 66, by + 43);
  // badge rareté à droite
  ctx.textAlign = 'right';
  ctx.font = `bold 11px Inter, sans-serif`;
  ctx.fillStyle = rar.color;
  ctx.fillText('★ ' + rar.label, bx + bw - 16, by + bh / 2 + 4);
  ctx.restore();
}

// notification de niveau global (NIVEAU X + récompense de palier éventuelle)
export function drawLevelToast() {
  const t = G.levelToast;
  if (!t) return;
  const a = Math.min(1, t.t / 0.4, (t.t < 1 ? t.t : 1));
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  const k = Math.min(1, (5 - t.t) / 0.35);
  const rise = (1 - k) * -16;
  ctx.font = 'bold 17px Georgia, serif';
  const label = `✦ NIVEAU ${t.lvl} ✦`;
  const lw = ctx.measureText(label).width;
  const hasRw = t.rewards && t.rewards.length;
  const bw = Math.max(lw + 130, hasRw ? 330 : 260), bh = hasRw ? 92 : 58;
  const bx = W / 2 - bw / 2, by = 60 + rise;
  ctx.shadowColor = 'rgba(255,213,79,0.55)'; ctx.shadowBlur = 22;
  const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
  bg.addColorStop(0, 'rgba(30,24,10,0.97)'); bg.addColorStop(1, 'rgba(12,10,6,0.97)');
  ctx.fillStyle = bg;
  roundRect(bx, by, bw, bh, 12); ctx.fill();
  ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2;
  roundRect(bx + 1, by + 1, bw - 2, bh - 2, 11); ctx.stroke();
  ctx.shadowBlur = 0;
  const fg = ctx.createLinearGradient(bx + 20, 0, bx + bw - 20, 0);
  fg.addColorStop(0, 'transparent'); fg.addColorStop(0.5, '#ffd54f'); fg.addColorStop(1, 'transparent');
  ctx.fillStyle = fg;
  roundRect(bx + 20, by + 2, bw - 40, 3, 1.5); ctx.fill();
  // étoile animée
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw2 = Math.sin(G.time * 5) * 0.15;
  ctx.save();
  ctx.translate(bx + 40, by + bh / 2 - (hasRw ? 10 : 0));
  ctx.rotate(tw2);
  ctx.font = '34px serif';
  ctx.fillText('⭐', 0, 0);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd740';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText(label, bx + 66, by + 30 - (hasRw ? 10 : 0));
  ctx.fillStyle = '#efe8d6';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(t.lvl >= 1000 ? 'Niveau maximum atteint — Transcendant !' : 'Le monde te reconnaît…', bx + 66, by + 48 - (hasRw ? 10 : 0));
  if (hasRw) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('RÉCOMPENSE DÉBLOQUÉE', bx + bw / 2, by + 62);
    ctx.font = '15px serif';
    ctx.fillText(t.rewards.map(r => `${r.icon} ${r.nom}`).join('   '), bx + bw / 2, by + 82);
  }
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
