// js/hud/frame.js — primitives « médiéval fantastique » du HUD.
// Métal doré vieilli, bois, cuir, parchemin, gemmes, rivets et runes.
import { G, ctx, TAU } from '../state.js';
import { roundRect } from '../utils.js';

// ---------- palette ----------
export const HPAL = {
  ink: '#241708',        // brun foncé (contours)
  wood: '#4a3a26',
  woodD: '#33261a',
  leather: '#6b4a2f',
  leatherD: '#4e3421',
  gold: '#d4a84b',       // or ancien
  goldHi: '#f0d488',
  goldLo: '#8a6a2f',
  parch: '#d8c49a',      // beige parchemin
  parchD: '#b8a077',
  red: '#a02334',        // rouge profond
  redHi: '#d95f5f',
  blue: '#3a6ea5',       // bleu magique
  blueHi: '#7db4e8',
  green: '#3e7d4f',      // émeraude
  greenHi: '#7cc48a',
  violet: '#6a4a8a',     // mystique
  violetHi: '#b388ff',
  steel: '#8d8578',
  steelD: '#5a5348'
};

// ---------- cadre métallique orné ----------
// corps en bois sombre, liseré or dégradé, rivets aux coins, reflet superior
export function metalFrame(x, y, w, h, r = 8, opts = {}) {
  const { glow = null, alpha = 1 } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  // ombre portée douce
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(x + 2, y + 3, w, h, r); ctx.fill();
  // corps : dégradé bois -> cuir
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#3d2f1e'); bg.addColorStop(0.5, '#2c2013'); bg.addColorStop(1, '#1e150c');
  ctx.fillStyle = bg;
  roundRect(x, y, w, h, r); ctx.fill();
  // liseré extérieur or ancien (2 passes : large sombre + fine claire)
  ctx.strokeStyle = HPAL.goldLo; ctx.lineWidth = 3;
  roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1); ctx.stroke();
  ctx.strokeStyle = HPAL.gold; ctx.lineWidth = 1.2;
  roundRect(x + 3.5, y + 3.5, w - 7, h - 7, r - 2.5); ctx.stroke();
  // reflet supérieur (lumière rasante sur le métal)
  ctx.save();
  roundRect(x + 3.5, y + 3.5, w - 7, h - 7, r - 2.5); ctx.clip();
  const sh = ctx.createLinearGradient(x, y, x, y + h * 0.5);
  sh.addColorStop(0, 'rgba(240,212,136,0.16)'); sh.addColorStop(1, 'rgba(240,212,136,0)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h * 0.5);
  ctx.restore();
  // rivets aux 4 coins
  rivet(x + 9, y + 9); rivet(x + w - 9, y + 9);
  rivet(x + 9, y + h - 9); rivet(x + w - 9, y + h - 9);
  // lueur optionnelle (ex. boss en combat, panneau actif)
  if (glow) {
    ctx.shadowColor = glow; ctx.shadowBlur = 12;
    ctx.strokeStyle = glow; ctx.lineWidth = 1.5;
    roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function rivet(x, y) {
  const g = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, 3.4);
  g.addColorStop(0, '#f5e3b0'); g.addColorStop(0.6, HPAL.gold); g.addColorStop(1, HPAL.goldLo);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,10,0.8)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.stroke();
}

// ---------- gemme ornementale (scintille doucement) ----------
export function gem(x, y, r, color, phase = 0) {
  const tw = 0.75 + Math.sin(((G.time || 0) * 2.2) + phase) * 0.25;
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 6 * tw;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, color); g.addColorStop(1, shade(color, -40));
  ctx.fillStyle = g;
  ctx.beginPath();
  // losange facetté
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  ctx.stroke();
  // facette intérieure
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x + r * 0.4, y); ctx.lineTo(x, y + r * 0.5); ctx.lineTo(x - r * 0.4, y); ctx.closePath(); ctx.stroke();
  ctx.restore();
}

// ---------- rune ornementale (barre de pictos qui s'illumine) ----------
// glyphs : petites marques verticales/diagonales style runes nordiques
export function runeStrip(x, y, w, color = HPAL.gold, lit = 1) {
  const n = Math.max(3, Math.floor(w / 14));
  const rw = w / n;
  ctx.save();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.85 * lit; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const rx = x + i * rw + rw / 2;
    const kind = i % 3;
    ctx.beginPath();
    ctx.moveTo(rx, y - 3);
    ctx.lineTo(rx, y + 3);
    if (kind === 0) { ctx.moveTo(rx - 2.5, y - 1.5); ctx.lineTo(rx + 2.5, y + 1.5); }
    else if (kind === 1) { ctx.moveTo(rx + 2.5, y - 1.5); ctx.lineTo(rx - 2.5, y + 1.5); }
    else { ctx.moveTo(rx, y - 3); ctx.lineTo(rx + 2, y); ctx.lineTo(rx, y + 3); }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- panneau parchemin ----------
export function parchment(x, y, w, h, alpha = 0.92) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#e2d2ab'); g.addColorStop(0.55, HPAL.parch); g.addColorStop(1, HPAL.parchD);
  ctx.fillStyle = g;
  roundRect(x, y, w, h, 6); ctx.fill();
  // fibres du parchemin
  ctx.strokeStyle = 'rgba(140,110,70,0.18)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 4; i++) {
    const fy = y + 6 + i * (h - 12) / 4 + Math.sin(i * 7) * 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, fy);
    ctx.bezierCurveTo(x + w * 0.3, fy + 2, x + w * 0.6, fy - 2, x + w - 6, fy + 1);
    ctx.stroke();
  }
  // bord brûlé
  ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.lineWidth = 1.4;
  roundRect(x + 1, y + 1, w - 2, h - 2, 6); ctx.stroke();
  ctx.restore();
}

// ---------- barre de statut médiévale ----------
// canal creusé + remplissage dégradé + liseré or + valeur optionnelle
// ghost : fraction "dégât récent" affichée en traînée claire (barre de vie classique)
export function medBar(x, y, w, h, frac, ghost, c1, c2, opts = {}) {
  frac = Math.max(0, Math.min(1, frac));
  const { glow = null, label = null, value = null } = opts;
  // canal
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(x - 1.5, y - 1.5, w + 3, h + 3, h / 2 + 2); ctx.fill();
  ctx.fillStyle = '#191008';
  roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.save();
  roundRect(x, y, w, h, h / 2); ctx.clip();
  // traînée de dégât (ghost > frac : la partie récemment perdue reste claire un instant)
  if (ghost !== undefined && ghost !== null && ghost > frac) {
    const gg = ctx.createLinearGradient(x, y, x, y + h);
    gg.addColorStop(0, 'rgba(255,240,200,0.85)'); gg.addColorStop(1, 'rgba(255,220,160,0.5)');
    ctx.fillStyle = gg;
    ctx.fillRect(x + w * frac, y, w * (Math.min(1, ghost) - frac), h);
  }
  if (frac > 0.004) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * frac, h);
    // reflet supérieur de la jauge
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, w * frac, h * 0.38);
  }
  ctx.restore();
  // liseré or fin
  ctx.strokeStyle = HPAL.goldLo; ctx.lineWidth = 1;
  roundRect(x, y, w, h, h / 2); ctx.stroke();
  if (glow && frac > 0.02) {
    ctx.shadowColor = glow; ctx.shadowBlur = 8;
    ctx.strokeStyle = glow; ctx.lineWidth = 1;
    roundRect(x, y, w, h, h / 2); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (label || value) {
    ctx.textAlign = 'left'; ctx.font = `bold ${Math.max(9, h - 2)}px Consolas, monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    if (label) { ctx.fillText(label, x + 6, y + h - 2); }
    if (value) { ctx.textAlign = 'right'; ctx.fillText(value, x + w - 6, y + h - 2); }
  }
}

// ---------- texte gravé (lettrage parchemin) ----------
export function engraved(text, x, y, size = 12, color = HPAL.parch, align = 'left', font = 'Georgia, serif') {
  ctx.save();
  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------- assombrir une couleur hex ----------
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
