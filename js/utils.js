import { ctx } from './state.js';

export function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// Icône de matériau texturée (remplace les ronds de couleur unis)
export function drawMatIcon(m, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  if (m === 'cuir') {
    // pièce de cuir : forme organique + surpiqûres
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.82, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,235,205,0.5)'; ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.65, r * 0.5, 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.3, r * 0.18, 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (m === 'fer') {
    // lingot de fer : trapèze métallisé + reflet
    ctx.fillStyle = '#78909c';
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.4); ctx.lineTo(-r * 0.7, -r * 0.5);
    ctx.lineTo(r * 0.7, -r * 0.5); ctx.lineTo(r, r * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#455a64'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.4); ctx.lineTo(-r * 0.2, -r * 0.4);
    ctx.lineTo(-r * 0.55, r * 0.3); ctx.lineTo(-r * 0.8, r * 0.3);
    ctx.closePath(); ctx.fill();
  } else if (m === 'or') {
    // pièce d'or : anneau + étoile + éclat
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, '#fff59d'); g.addColorStop(0.6, '#ffd740'); g.addColorStop(1, '#b8860b');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8d6e00'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const px = Math.cos(a) * r * 0.4, py = Math.sin(a) * r * 0.4;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.4, r * 0.16, 0, Math.PI * 2); ctx.fill();
  } else if (m === 'essence') {
    // flamme d'essence : goutte violette + cœur lumineux
    const g = ctx.createRadialGradient(0, r * 0.2, 1, 0, 0, r);
    g.addColorStop(0, '#f3e5f5'); g.addColorStop(0.5, '#ce93d8'); g.addColorStop(1, '#6a1b9a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.8, -r * 0.1, r * 0.55, r * 0.55);
    ctx.quadraticCurveTo(0, r * 1.05, -r * 0.55, r * 0.55);
    ctx.quadraticCurveTo(-r * 0.8, -r * 0.1, 0, -r);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.28, 0, Math.PI * 2); ctx.fill();
  } else if (m === 'cristal') {
    // cristal : gemme facettée + reflet
    ctx.fillStyle = 'rgba(79,195,247,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, -r * 0.25); ctx.lineTo(r * 0.45, r * 0.8);
    ctx.lineTo(-r * 0.45, r * 0.8); ctx.lineTo(-r * 0.7, -r * 0.25);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0277bd'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.25); ctx.lineTo(r * 0.7, -r * 0.25); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.25, -r * 0.3); ctx.lineTo(0, -r * 0.1); ctx.lineTo(-r * 0.2, -r * 0.35); ctx.closePath(); ctx.fill();
  } else if (m === 'emeraude') {
    // émeraude : gemme facettée vert vif + éclat central + monture dorée
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#a5f0b8'); g.addColorStop(0.45, '#2ecc71'); g.addColorStop(1, '#0e7a3d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.72, -r * 0.2); ctx.lineTo(r * 0.5, r * 0.85);
    ctx.lineTo(-r * 0.5, r * 0.85); ctx.lineTo(-r * 0.72, -r * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#065f2e'; ctx.lineWidth = 1; ctx.stroke();
    // facettes
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.72, -r * 0.2); ctx.lineTo(r * 0.72, -r * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.4); ctx.lineTo(r * 0.3, r * 0.4); ctx.stroke();
    // éclat central
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.18, -r * 0.1); ctx.lineTo(0, r * 0.15); ctx.lineTo(-r * 0.15, -r * 0.12); ctx.closePath(); ctx.fill();
    // monture dorée (serti)
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-r * 0.85, r * 0.95); ctx.lineTo(-r * 0.35, r * 0.55); ctx.lineTo(r * 0.35, r * 0.55); ctx.lineTo(r * 0.85, r * 0.95); ctx.stroke();
  }
  ctx.restore();
}

// couleur de rareté d'un objet forgé : champ `rar` explicite, sinon déduit des matériaux
const RAR_COLOR = { commun: '#b0bec5', rare: '#4fc3f7', epique: '#ce93d8', legendaire: '#ffd740' };
export function itemTier(it) {
  if (it.rar && RAR_COLOR[it.rar]) return RAR_COLOR[it.rar];
  const c = it.cost || {};
  if (c.cristal) return '#4fc3f7';
  if (c.essence) return '#ce93d8';
  if (c.or) return '#ffd740';
  return '#90a4ae';
}

// Tuile d'équipement stylée : dégradé sombre, bordure de rareté, icône emoji
export function drawItemIcon(it, x, y, s) {
  const tier = itemTier(it);
  ctx.save();
  ctx.translate(x, y);
  // halo de rareté
  if (it.rareGlow !== false) {
    ctx.shadowColor = tier; ctx.shadowBlur = 8;
  }
  // tuile
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, 'rgba(40,44,60,0.95)'); g.addColorStop(1, 'rgba(16,18,26,0.95)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s + 4, -s); ctx.lineTo(s - 4, -s); ctx.quadraticCurveTo(s, -s, s, -s + 4);
  ctx.lineTo(s, s - 4); ctx.quadraticCurveTo(s, s, s - 4, s);
  ctx.lineTo(-s + 4, s); ctx.quadraticCurveTo(-s, s, -s, s - 4);
  ctx.lineTo(-s, -s + 4); ctx.quadraticCurveTo(-s, -s, -s + 4, -s);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = tier; ctx.lineWidth = 1.5; ctx.stroke();
  // reflet supérieur
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(-s + 4, -s + 1); ctx.lineTo(s - 4, -s + 1); ctx.lineTo(s - 6, -s * 0.2); ctx.lineTo(-s + 6, -s * 0.2);
  ctx.closePath(); ctx.fill();
  // icône
  ctx.font = `${Math.round(s * 1.15)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(it.icon, 0, 1);
  ctx.restore();
}

// Icône de fiole (utilisée par les drops au sol et le HUD)
export function drawFlaskIcon(x, y, s, filled = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = filled ? '#ff80ab' : 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.arc(0, 3, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-3.5, -6, 7, 10);
  ctx.fillStyle = filled ? '#ad1457' : 'rgba(255,255,255,0.2)';
  ctx.fillRect(-2, -11, 4, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-4, 0, 2.5, 4);
  ctx.restore();
}
