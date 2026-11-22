import { G, ctx, TAU } from '../state.js';
import { shade } from '../utils.js';

export function drawHellEnemy(e) {
  const flash = e.attackCooldown > 0.9;
  const bodyColor = e.color, dark = shade(e.color, -40), light = shade(e.color, 50);
    // ================= LES ENFERS : créatures infernales =================
    if (e.type === 'finalBossEnfer') {
      // LE BARON DE L'ENFER : démon colossal de braise, couronne de feu,
      // cœur magma pulsé, ailes de cendres
      const g = ctx.createRadialGradient(0, -e.r * 0.3, e.r * 0.2, 0, 0, e.r * 1.15);
      g.addColorStop(0, '#ff7043'); g.addColorStop(0.45, '#b71c1c'); g.addColorStop(1, '#3d0a0a');
      ctx.fillStyle = g;
      // corps démoniaque massif
      ctx.beginPath();
      ctx.moveTo(0, -e.r * 1.2);
      ctx.quadraticCurveTo(e.r * 1.0, -e.r * 0.7, e.r * 0.85, e.r * 0.2);
      ctx.quadraticCurveTo(e.r * 0.65, e.r * 0.95, 0, e.r);
      ctx.quadraticCurveTo(-e.r * 0.65, e.r * 0.95, -e.r * 0.85, e.r * 0.2);
      ctx.quadraticCurveTo(-e.r * 1.0, -e.r * 0.7, 0, -e.r * 1.2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2d0606'; ctx.lineWidth = 4; ctx.stroke();
      // ailes de cendres
      ctx.fillStyle = 'rgba(255,110,40,0.4)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.5, -e.r * 0.6);
        ctx.quadraticCurveTo(s * e.r * 1.7, -e.r * 1.3, s * e.r * 1.9, -e.r * 0.1);
        ctx.quadraticCurveTo(s * e.r * 1.4, e.r * 0.1, s * e.r * 0.8, e.r * 0.3);
        ctx.closePath(); ctx.fill();
      }
      // cornes enflammées
      ctx.fillStyle = '#1a0505';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.42, -e.r * 0.95);
        ctx.quadraticCurveTo(s * e.r * 1.4, -e.r * 1.6, s * e.r * 1.0, -e.r * 1.9);
        ctx.quadraticCurveTo(s * e.r * 0.72, -e.r * 1.1, s * e.r * 0.24, -e.r * 0.78);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffab00';
        ctx.beginPath(); ctx.arc(s * e.r * 0.95, -e.r * 1.75, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1a0505';
      }
      // couronne de braise
      ctx.fillStyle = '#ffab00';
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.5, -e.r * 0.95);
      for (let i = 0; i < 6; i++) {
        const cx = -e.r * 0.5 + i * e.r * 0.2;
        ctx.lineTo(cx + e.r * 0.1, -e.r * 1.3); ctx.lineTo(cx + e.r * 0.2, -e.r * 0.95);
      }
      ctx.closePath(); ctx.fill();
      // cœur de magma pulsé
      const pulse = 1 + Math.sin(G.time * 3.6) * 0.2;
      const mg = ctx.createRadialGradient(0, -e.r * 0.1, 3, 0, -e.r * 0.1, e.r * 0.6 * pulse);
      mg.addColorStop(0, '#fff59d'); mg.addColorStop(0.45, '#ff7043'); mg.addColorStop(1, 'rgba(80,0,0,0)');
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(0, -e.r * 0.1, e.r * 0.6 * pulse, 0, TAU); ctx.fill();
      // yeux flamboyants
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath(); ctx.ellipse(-e.r * 0.26, -e.r * 0.4, e.r * 0.09, e.r * 0.13, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e.r * 0.26, -e.r * 0.4, e.r * 0.09, e.r * 0.13, 0, 0, TAU); ctx.fill();
      // griffes
      ctx.strokeStyle = '#2d0606'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.7, e.r * (0.15 + k * 0.28));
        ctx.lineTo(s * e.r * 1.2, e.r * (0.4 + k * 0.3));
        ctx.stroke();
      }
      // aura de feu au sol
      ctx.fillStyle = 'rgba(255,87,34,0.28)';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.9, e.r * 1.3, e.r * 0.35, 0, 0, TAU); ctx.fill();
    } else if (e.type === 'demon' || e.type === 'bossEnf') {
      // démon / démon seigneur : silhouette rougeoyante, cornes, queue, yeux
      const big = e.type === 'bossEnf';
      const g = ctx.createRadialGradient(-e.r * 0.2, -e.r * 0.3, 2, 0, 0, e.r);
      g.addColorStop(0, '#ff7043'); g.addColorStop(0.55, '#b71c1c'); g.addColorStop(1, '#4a0d0d');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.08, e.r * (big ? 1.0 : 0.8), e.r * 0.9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2d0606'; ctx.lineWidth = big ? 3.5 : 2.5; ctx.stroke();
      // tête
      ctx.fillStyle = big ? '#8e0000' : '#a52a2a';
      ctx.beginPath(); ctx.arc(0, -e.r * 0.75, e.r * 0.45, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2d0606'; ctx.lineWidth = 2; ctx.stroke();
      // cornes
      ctx.fillStyle = '#1a0505';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.22, -e.r * 0.95);
        ctx.quadraticCurveTo(s * e.r * 0.6, -e.r * 1.5, s * e.r * 0.4, -e.r * 1.75);
        ctx.quadraticCurveTo(s * e.r * 0.3, -e.r * 1.05, s * e.r * 0.08, -e.r * 0.85);
        ctx.closePath(); ctx.fill();
      }
      // yeux de braise
      const fl = 0.8 + Math.sin(G.time * 7 + e.wobble) * 0.2;
      ctx.fillStyle = `rgba(255,235,59,${fl})`;
      ctx.beginPath(); ctx.arc(-e.r * 0.16, -e.r * 0.8, e.r * 0.08, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.16, -e.r * 0.8, e.r * 0.08, 0, TAU); ctx.fill();
      // gueule + crocs
      ctx.fillStyle = '#2d0606';
      ctx.beginPath(); ctx.ellipse(0, -e.r * 0.5, e.r * 0.25, e.r * 0.14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.12 - 2.5, -e.r * 0.52); ctx.lineTo(s * e.r * 0.12, -e.r * 0.4); ctx.lineTo(s * e.r * 0.12 + 2.5, -e.r * 0.52);
        ctx.closePath(); ctx.fill();
      }
      // queue
      ctx.strokeStyle = '#7f0000'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e.r * 0.7, e.r * 0.3);
      ctx.quadraticCurveTo(e.r * 1.4, e.r * 0.6, e.r * 1.1, -e.r * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#ffab00';
      ctx.beginPath(); ctx.arc(e.r * 1.1, -e.r * 0.2, 4, 0, TAU); ctx.fill();
      if (big) { // épaulières de braise pour le seigneur
        ctx.fillStyle = '#ffab00';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * e.r * 0.7, -e.r * 0.4); ctx.lineTo(s * e.r * 1.2, -e.r * 0.1); ctx.lineTo(s * e.r * 0.8, e.r * 0.05);
          ctx.closePath(); ctx.fill();
        }
      }
    } else if (e.type === 'hound') {
      // mastiff des enfers : quadrupède noir, gueule de flammes, yeux
      ctx.fillStyle = '#2e1a14';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.15, e.r * 1.0, e.r * 0.55, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#120806'; ctx.lineWidth = 2; ctx.stroke();
      // tête + gueule ouverte (flammes)
      ctx.fillStyle = '#3d2018';
      ctx.beginPath(); ctx.arc(-e.r * 0.85, -e.r * 0.35, e.r * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,${140 + Math.sin(G.time * 9) * 40 | 0},40,0.85)`;
      ctx.beginPath();
      ctx.moveTo(-e.r * 1.15, -e.r * 0.45); ctx.lineTo(-e.r * 1.5, -e.r * 0.1); ctx.lineTo(-e.r * 1.2, -e.r * 0.15);
      ctx.closePath(); ctx.fill();
      // oreilles pointues
      ctx.fillStyle = '#1a0d08';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-e.r * 0.85 + s * e.r * 0.2, -e.r * 0.65);
        ctx.lineTo(-e.r * 0.85 + s * e.r * 0.35, -e.r * 1.0);
        ctx.lineTo(-e.r * 0.85 + s * e.r * 0.4, -e.r * 0.55);
        ctx.closePath(); ctx.fill();
      }
      // yeux rouges
      ctx.fillStyle = '#ff1744';
      ctx.beginPath(); ctx.arc(-e.r * 0.95, -e.r * 0.4, e.r * 0.07, 0, TAU); ctx.fill();
      // pattes
      ctx.strokeStyle = '#120806'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const st = Math.sin(e.wobble * 3) * e.r * 0.15;
      for (const [lx, ly] of [[-0.5, 0.4], [0.1, 0.42], [-0.5, -0.15], [0.1, -0.13]]) {
        ctx.beginPath(); ctx.moveTo(e.r * lx, e.r * ly); ctx.lineTo(e.r * lx + (lx < 0 ? -st : st) * 0.4, e.r * 0.75); ctx.stroke();
      }
      // queue
      ctx.strokeStyle = '#3d2018'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.r * 0.9, e.r * 0.1); ctx.quadraticCurveTo(e.r * 1.3, -e.r * 0.3, e.r * 1.15, -e.r * 0.7); ctx.stroke();
    } else if (e.type === 'cultist' || e.type === 'priest') {
      // acolyte / prêtre : robe sombre, capuche, sceptre à braise
      const big = e.type === 'priest';
      ctx.fillStyle = big ? '#3d0d0d' : '#4a1a1a';
      // robe en triangle
      ctx.beginPath();
      ctx.moveTo(0, -e.r * 0.95);
      ctx.quadraticCurveTo(e.r * 0.85, -e.r * 0.2, e.r * 0.7, e.r * 0.95);
      ctx.lineTo(-e.r * 0.7, e.r * 0.95);
      ctx.quadraticCurveTo(-e.r * 0.85, -e.r * 0.2, 0, -e.r * 0.95);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a0505'; ctx.lineWidth = 2; ctx.stroke();
      // capuche + visage
      ctx.fillStyle = big ? '#5c1212' : '#6d1f1f';
      ctx.beginPath(); ctx.arc(0, -e.r * 0.55, e.r * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = '#120806';
      ctx.beginPath(); ctx.ellipse(0, -e.r * 0.5, e.r * 0.22, e.r * 0.26, 0, 0, TAU); ctx.fill();
      // yeux rouges dans l'ombre
      ctx.fillStyle = '#ff5252';
      ctx.beginPath(); ctx.arc(-e.r * 0.09, -e.r * 0.52, e.r * 0.05, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.09, -e.r * 0.52, e.r * 0.05, 0, TAU); ctx.fill();
      // sceptre à braise
      const sx = e.r * 0.85;
      ctx.strokeStyle = '#3d2018'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, e.r * 0.6); ctx.lineTo(sx, -e.r * 1.05); ctx.stroke();
      const bp = 1 + Math.sin(G.time * 6) * 0.2;
      const bg = ctx.createRadialGradient(sx, -e.r * 1.1, 1, sx, -e.r * 1.1, e.r * 0.22 * bp);
      bg.addColorStop(0, '#fff59d'); bg.addColorStop(0.5, '#ff7043'); bg.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(sx, -e.r * 1.1, e.r * 0.22 * bp, 0, TAU); ctx.fill();
      if (big) { // orbe du prêtre
        ctx.strokeStyle = '#e040fb'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -e.r * 0.55, e.r * 0.62, 0, TAU); ctx.stroke();
      }
    } else if (e.type === 'golemEnf') {
      // golem de braise : bloc basaltique, veines de lave, yeux incandescents
      const g = ctx.createLinearGradient(0, -e.r, 0, e.r);
      g.addColorStop(0, '#6b3a30'); g.addColorStop(0.55, '#4a2620'); g.addColorStop(1, '#2e1512');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU - Math.PI / 2;
        const px = Math.cos(a) * e.r * (i % 2 ? 0.9 : 1), py = Math.sin(a) * e.r * 0.95;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#140806'; ctx.lineWidth = 3; ctx.stroke();
      // veines de lave
      ctx.strokeStyle = 'rgba(255,120,40,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-e.r * 0.5, -e.r * 0.3); ctx.lineTo(-e.r * 0.1, e.r * 0.1); ctx.lineTo(-e.r * 0.4, e.r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.r * 0.55, -e.r * 0.25); ctx.lineTo(e.r * 0.2, e.r * 0.15); ctx.lineTo(e.r * 0.5, e.r * 0.55); ctx.stroke();
      // yeux incandescents
      const gl = 0.7 + Math.sin(G.time * 4) * 0.3;
      ctx.fillStyle = `rgba(255,180,80,${gl})`;
      ctx.beginPath(); ctx.arc(-e.r * 0.25, -e.r * 0.35, e.r * 0.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.25, -e.r * 0.35, e.r * 0.1, 0, TAU); ctx.fill();
    } else {
      // imp : petit diablotin agile — corps rond, ailes membrane, queue
      const sq = 1 + Math.sin(e.wobble * 2) * 0.08;
      ctx.scale(1 / sq, sq);
      const g = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 1, 0, 0, e.r);
      g.addColorStop(0, '#ff8a50'); g.addColorStop(1, '#b71c1c');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#4a0d0d'; ctx.lineWidth = 2; ctx.stroke();
      // ailes membrane
      const flap = Math.sin(e.wobble * 3) * 0.4;
      ctx.fillStyle = 'rgba(255,140,60,0.55)';
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(-0.5 - flap);
        ctx.beginPath(); ctx.ellipse(e.r * 0.9, -e.r * 0.2, e.r * 0.85, e.r * 0.35, 0.4, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // cornes
      ctx.fillStyle = '#3d0d0d';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.3, -e.r * 0.85); ctx.lineTo(s * e.r * 0.5, -e.r * 1.35); ctx.lineTo(s * e.r * 0.55, -e.r * 0.7);
        ctx.closePath(); ctx.fill();
      }
      // yeux jaunes + queue
      ctx.fillStyle = '#fff59d';
      ctx.beginPath(); ctx.arc(-e.r * 0.3, -e.r * 0.25, e.r * 0.14, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.3, -e.r * 0.25, e.r * 0.14, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7f0000'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, e.r * 0.85); ctx.quadraticCurveTo(e.r * 0.5, e.r * 1.3, e.r * 0.2, e.r * 1.5); ctx.stroke();
      ctx.fillStyle = '#ffab00';
      ctx.beginPath(); ctx.arc(e.r * 0.2, e.r * 1.5, 3, 0, TAU); ctx.fill();
    }
}
