import { G, ctx, TAU } from '../state.js';
import { shade } from '../utils.js';

export function drawSewerEnemy(e) {
  const flash = e.attackCooldown > 0.9;
  const bodyColor = e.color, dark = shade(e.color, -40), light = shade(e.color, 50);
    // ================= LES ÉGOUTS : créatures souterraines =================
    if (e.type === 'finalBossEgout') {
      // LE TYRAN DES PROFONDEURS : serpent colossal, écailles de vase,
      // crête de champignons,gueule béante, aura toxique
      const g = ctx.createLinearGradient(0, -e.r * 1.1, 0, e.r);
      g.addColorStop(0, '#7cb342'); g.addColorStop(0.5, '#4e6b2f'); g.addColorStop(1, '#26331a');
      ctx.fillStyle = g;
      // corps serpentin en S
      ctx.beginPath();
      ctx.moveTo(0, -e.r * 1.25);
      ctx.quadraticCurveTo(e.r * 1.1, -e.r * 0.9, e.r * 0.9, e.r * 0.1);
      ctx.quadraticCurveTo(e.r * 0.8, e.r * 0.8, 0, e.r);
      ctx.quadraticCurveTo(-e.r * 0.8, e.r * 0.8, -e.r * 0.9, e.r * 0.1);
      ctx.quadraticCurveTo(-e.r * 1.1, -e.r * 0.9, 0, -e.r * 1.25);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a240f'; ctx.lineWidth = 4; ctx.stroke();
      // écailles : arcs verticaux
      ctx.strokeStyle = 'rgba(174,234,0,0.4)'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const yy = -e.r * 0.8 + i * e.r * 0.3;
        ctx.beginPath(); ctx.moveTo(-e.r * 0.55, yy); ctx.quadraticCurveTo(0, yy - e.r * 0.12, e.r * 0.55, yy); ctx.stroke();
      }
      // crête de champignons toxiques sur la tête
      for (let i = 0; i < 5; i++) {
        const cx = (i - 2) * e.r * 0.22, cy = -e.r * 1.05 + Math.abs(i - 2) * e.r * 0.12;
        ctx.fillStyle = i % 2 ? '#c5e1a5' : '#9ccc65';
        ctx.beginPath(); ctx.arc(cx, cy, e.r * 0.09, 0, TAU); ctx.fill();
        ctx.fillStyle = '#33691e';
        ctx.fillRect(cx - 1, cy - e.r * 0.22, 2, e.r * 0.22);
      }
      // yeux jaunes verts luminescents
      const gl = 0.8 + Math.sin(G.time * 5) * 0.2;
      ctx.fillStyle = `rgba(212,255,80,${gl})`;
      ctx.beginPath(); ctx.ellipse(-e.r * 0.28, -e.r * 0.95, e.r * 0.08, e.r * 0.12, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e.r * 0.28, -e.r * 0.95, e.r * 0.08, e.r * 0.12, 0, 0, TAU); ctx.fill();
      // gueule : crocs + langue fourchue
      ctx.fillStyle = '#1a240f';
      ctx.beginPath(); ctx.ellipse(0, -e.r * 0.72, e.r * 0.3, e.r * 0.14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8f5e9';
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(s * (e.r * 0.12 + k * e.r * 0.14) - 2, -e.r * 0.74);
        ctx.lineTo(s * (e.r * 0.12 + k * e.r * 0.14), -e.r * 0.58);
        ctx.lineTo(s * (e.r * 0.12 + k * e.r * 0.14) + 2, -e.r * 0.74);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = '#aed581'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -e.r * 0.62);
      ctx.quadraticCurveTo(e.r * 0.1, -e.r * 0.45, e.r * 0.22, -e.r * 0.5);
      ctx.stroke();
      // aura toxique
      ctx.fillStyle = 'rgba(174,234,0,0.15)';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.95, e.r * 1.35, e.r * 0.4, 0, 0, TAU); ctx.fill();
    } else if (e.type === 'bossEgout' || e.type === 'matriarche') {
      // roi des rats / matrriarche : gros rongeur, armure d'os, queue
      const big = e.type === 'bossEgout';
      const g = ctx.createRadialGradient(-e.r * 0.2, -e.r * 0.3, 2, 0, 0, e.r);
      g.addColorStop(0, '#8d7b68'); g.addColorStop(1, '#3e2f23');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.1, e.r * 0.95, e.r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1c130c'; ctx.lineWidth = big ? 3.5 : 2.5; ctx.stroke();
      // tête + museau
      ctx.fillStyle = '#6d5a48';
      ctx.beginPath(); ctx.arc(-e.r * 0.75, -e.r * 0.45, e.r * 0.48, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d7ccc8';
      ctx.beginPath(); ctx.ellipse(-e.r * 1.05, -e.r * 0.35, e.r * 0.22, e.r * 0.15, 0, 0, TAU); ctx.fill();
      // oreilles
      ctx.fillStyle = '#5d4a3a';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(-e.r * 0.75 + s * e.r * 0.35, -e.r * 0.9, e.r * 0.2, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ec407a';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(-e.r * 0.75 + s * e.r * 0.35, -e.r * 0.9, e.r * 0.1, 0, TAU);
        ctx.fill();
      }
      // yeux rouges
      ctx.fillStyle = '#ff1744';
      ctx.beginPath(); ctx.arc(-e.r * 0.95, -e.r * 0.55, e.r * 0.07, 0, TAU); ctx.fill();
      // crocs
      ctx.fillStyle = '#fff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-e.r * 1.1 + s * e.r * 0.06, -e.r * 0.5); ctx.lineTo(-e.r * 1.1 + s * e.r * 0.06, -e.r * 0.32); ctx.lineTo(-e.r * 1.1 + s * e.r * 0.14, -e.r * 0.5);
        ctx.closePath(); ctx.fill();
      }
      // queue
      ctx.strokeStyle = '#6d5a48'; ctx.lineWidth = big ? 5 : 3.5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e.r * 0.7, e.r * 0.3);
      ctx.quadraticCurveTo(e.r * 1.5, e.r * 0.5, e.r * 1.3, -e.r * 0.4);
      ctx.stroke();
      if (big) { // armure d'os du roi
        ctx.fillStyle = '#eceff1';
        ctx.beginPath(); ctx.arc(0, -e.r * 0.6, e.r * 0.3, Math.PI, 0); ctx.fill();
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(s * e.r * 0.4, -e.r * 0.5); ctx.lineTo(s * e.r * 0.6, -e.r * 0.1); ctx.lineTo(s * e.r * 0.2, -e.r * 0.1); ctx.closePath(); ctx.fill();
        }
      }
    } else if (e.type === 'rat') {
      // rat géant : corps allongé, queue, oreilles
      ctx.fillStyle = '#7a6a55';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.15, e.r * 1.0, e.r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3e3226'; ctx.lineWidth = 2; ctx.stroke();
      // queue
      ctx.strokeStyle = '#8d7b68'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.r * 0.8, e.r * 0.3); ctx.quadraticCurveTo(e.r * 1.6, e.r * 0.6, e.r * 1.5, -e.r * 0.2); ctx.stroke();
      // oreilles + museau
      ctx.fillStyle = '#6d5c48';
      for (const s of [-1, 1]) ctx.beginPath(), ctx.arc(s * e.r * 0.25, -e.r * 0.5, e.r * 0.2, 0, TAU), ctx.fill();
      ctx.fillStyle = '#d7ccc8';
      ctx.beginPath(); ctx.ellipse(-e.r * 0.85, -e.r * 0.1, e.r * 0.2, e.r * 0.12, 0, 0, TAU); ctx.fill();
    } else if (e.type === 'vase') {
      // vase toxique : blob vert translucide, bulles
      const sq = 1 + Math.sin(e.wobble) * 0.1;
      ctx.scale(1 / sq, sq);
      const g = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 2, 0, 0, e.r);
      g.addColorStop(0, '#c5e1a5'); g.addColorStop(0.6, '#7cb342'); g.addColorStop(1, '#33691e');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 2; ctx.stroke();
      // bulles internes
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 3; i++) {
        const bx = Math.sin(e.wobble * 1.5 + i * 2) * e.r * 0.4;
        const by = Math.cos(e.wobble + i) * e.r * 0.3 - i * e.r * 0.15;
        ctx.beginPath(); ctx.arc(bx, by, e.r * 0.1, 0, TAU); ctx.fill();
      }
      // flaques de vase au sol
      ctx.fillStyle = 'rgba(174,234,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.8, e.r * 1.1, e.r * 0.3, 0, 0, TAU); ctx.fill();
    } else if (e.type === 'crapaud') {
      // crapaud des égouts : corps large, bosses, yeux en haut
      ctx.fillStyle = '#5d7a3a';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.2, e.r * 1.05, e.r * 0.75, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2f4518'; ctx.lineWidth = 2.5; ctx.stroke();
      // yeux sur bosses
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#7a9a4a';
        ctx.beginPath(); ctx.arc(s * e.r * 0.4, -e.r * 0.55, e.r * 0.22, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2f4518'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffd740';
        ctx.beginPath(); ctx.arc(s * e.r * 0.4, -e.r * 0.55, e.r * 0.09, 0, TAU); ctx.fill();
      }
      // bouche + verrues
      ctx.fillStyle = '#26331a';
      ctx.beginPath(); ctx.ellipse(0, -e.r * 0.05, e.r * 0.35, e.r * 0.1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7cb342';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc((i - 1.5) * e.r * 0.45, e.r * 0.35 + (i % 2) * e.r * 0.15, e.r * 0.07, 0, TAU); ctx.fill();
      }
    } else if (e.type === 'ver') {
      // ver des profondeurs : corps segmenté qui ondulle
      ctx.strokeStyle = '#8d7b68'; ctx.lineCap = 'round';
      ctx.lineWidth = e.r * 0.55;
      ctx.beginPath();
      ctx.moveTo(e.r * 0.9, 0);
      for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        ctx.lineTo(e.r * 0.9 - t * e.r * 1.6, Math.sin(e.wobble * 1.4 - t * 3) * e.r * 0.3);
      }
      ctx.stroke();
      // tête + mâchoire
      ctx.fillStyle = '#a1887f';
      ctx.beginPath(); ctx.arc(-e.r * 0.7, Math.sin(e.wobble * 1.4 - 3) * e.r * 0.3, e.r * 0.55, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ff5252';
      ctx.beginPath(); ctx.arc(-e.r * 0.85, Math.sin(e.wobble * 1.4 - 3) * e.r * 0.3 - e.r * 0.15, e.r * 0.1, 0, TAU); ctx.fill();
      // segments
      ctx.strokeStyle = 'rgba(62,39,35,0.7)'; ctx.lineWidth = 1.5;
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        const sx = e.r * 0.9 - t * e.r * 1.6, sy = Math.sin(e.wobble * 1.4 - t * 3) * e.r * 0.3;
        ctx.beginPath(); ctx.moveTo(sx - e.r * 0.1, sy - e.r * 0.22); ctx.lineTo(sx + e.r * 0.1, sy + e.r * 0.22); ctx.stroke();
      }
    } else if (e.type === 'chanter') {
      // Chanteur des Profondeurs : prêcheur des égouts — robe en haillon,
      // cage thoracique exposée, gorge amplifiée, antennes à resonateurs.
      // Télégraphie : les notes convergent vers la gorge pendant shotCharge.
      const charging = e.shotCharge > 0;
      const tremble = charging ? Math.sin(G.time * 40) * 1.5 : 0;
      ctx.translate(tremble, 0);
      // robe : haillon asymétrique, ourlet déchiré
      const g = ctx.createLinearGradient(0, -e.r * 1.1, 0, e.r);
      g.addColorStop(0, '#5d4037'); g.addColorStop(0.6, '#3e2723'); g.addColorStop(1, '#241611');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.15, -e.r * 1.15);
      ctx.quadraticCurveTo(e.r * 0.95, -e.r * 0.3, e.r * 0.8, e.r * 0.95);
      ctx.lineTo(e.r * 0.35, e.r * 1.05); // ourlet déchiré
      ctx.lineTo(-e.r * 0.55, e.r * 0.9);
      ctx.lineTo(-e.r * 0.9, e.r * 0.4);
      ctx.quadraticCurveTo(-e.r * 0.95, -e.r * 0.3, -e.r * 0.15, -e.r * 1.15);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#120a06'; ctx.lineWidth = 2.5; ctx.stroke();
      // cage thoracique : arcs osseux verdâtres
      ctx.strokeStyle = 'rgba(200,230,180,0.55)'; ctx.lineWidth = 1.8;
      for (let i = 0; i < 3; i++) {
        const yy = -e.r * 0.55 + i * e.r * 0.22;
        ctx.beginPath(); ctx.moveTo(-e.r * 0.55, yy); ctx.quadraticCurveTo(0, yy - e.r * 0.12, e.r * 0.5, yy); ctx.stroke();
      }
      // gorge amplifiée (sac de résonance)
      const gp = charging ? 1 + Math.sin(G.time * 18) * 0.12 : 1 + Math.sin(G.time * 2.5) * 0.04;
      const gg = ctx.createRadialGradient(0, -e.r * 0.35, 1, 0, -e.r * 0.35, e.r * 0.3 * gp);
      gg.addColorStop(0, charging ? '#fffde7' : '#dcedc8'); gg.addColorStop(0.6, '#9ccc65'); gg.addColorStop(1, 'rgba(51,105,30,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.ellipse(0, -e.r * 0.35, e.r * 0.3 * gp, e.r * 0.26 * gp, 0, 0, TAU); ctx.fill();
      // capuche effondrée + visage larvaire
      ctx.fillStyle = '#4e342e';
      ctx.beginPath(); ctx.ellipse(0, -e.r * 0.62, e.r * 0.42, e.r * 0.36, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = charging ? '#827717' : '#c5e1a5';
      ctx.beginPath(); ctx.ellipse(0, -e.r * 0.58, e.r * 0.24, e.r * 0.3, 0, 0, TAU); ctx.fill();
      // yeux sans pupille, fixes
      ctx.fillStyle = '#1b2e0b';
      ctx.beginPath(); ctx.arc(-e.r * 0.1, -e.r * 0.62, e.r * 0.06, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.1, -e.r * 0.62, e.r * 0.06, 0, TAU); ctx.fill();
      // antennes à resonateurs (symétriques, animées)
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        const sway = Math.sin(G.time * 3 + s) * e.r * 0.12;
        ctx.beginPath(); ctx.moveTo(s * e.r * 0.2, -e.r * 0.95);
        ctx.quadraticCurveTo(s * e.r * 0.55, -e.r * 1.35 + sway, s * e.r * 0.7, -e.r * 1.15 + sway * 1.5); ctx.stroke();
        ctx.fillStyle = charging ? '#f9fbe7' : '#aed581';
        ctx.beginPath(); ctx.arc(s * e.r * 0.7, -e.r * 1.15 + sway * 1.5, charging ? e.r * 0.09 : e.r * 0.06, 0, TAU); ctx.fill();
      }
      // ---- télégraphie du tir : notes qui convergent vers la gorge ----
      if (charging) {
        const k = 1 - e.shotCharge / 0.75; // 0 -> 1
        ctx.strokeStyle = `rgba(200,255,150,${0.35 + k * 0.6})`; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = i * TAU / 6 + G.time * 6;
          const rr = e.r * (1.5 - k * 1.0) * (0.8 + (i % 3) * 0.15);
          const nx = Math.cos(a) * rr, ny = Math.sin(a) * rr * 0.7 - e.r * 0.3;
          ctx.beginPath(); ctx.arc(nx, ny, 3 + k * 2, 0, TAU); ctx.stroke();
        }
        // aura sonore croissante autour de la gorge
        ctx.fillStyle = `rgba(198,230,120,${0.10 + k * 0.22})`;
        ctx.beginPath(); ctx.ellipse(0, -e.r * 0.35, e.r * (0.5 + k * 0.5), e.r * (0.45 + k * 0.45), 0, 0, TAU); ctx.fill();
      } else {
        // notes de chant ambiantes qui s'éloignent
        ctx.fillStyle = 'rgba(165,214,167,0.55)';
        for (let i = 0; i < 3; i++) {
          const nx = Math.sin(G.time * 2 + i * 2) * e.r * 0.5 + e.r * 0.5;
          const ny = -e.r * 1.4 - i * e.r * 0.3 - (G.time * 10 + i * 20) % (e.r * 0.5);
          ctx.beginPath(); ctx.arc(nx, ny, e.r * 0.07, 0, TAU); ctx.fill();
        }
      }
    }
}
