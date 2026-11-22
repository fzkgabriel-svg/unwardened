import { G, ctx, TAU } from '../state.js';
import { shade } from '../utils.js';

export function drawSpaceEnemy(e) {
  const flash = e.attackCooldown > 0.9;
  const bodyColor = e.color, dark = shade(e.color, -40), light = shade(e.color, 50);
    // ================= L'ESPACE : créatures extraterrestres =================
    if (e.type === 'finalBossSpace') {
      // L'ABOMINATION COSMIQUE : masse de matière noire, yeux stellaires,
      // tentacules d'énergie, disque d'accrétion
      // disque d'accrétion
      ctx.save(); ctx.rotate(G.time * 0.6);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        ctx.fillStyle = i % 2 ? 'rgba(179,157,219,0.5)' : 'rgba(64,196,255,0.5)';
        ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 1.35, Math.sin(a) * e.r * 0.4, e.r * 0.1, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // corps : sphère de matière noire avec dégradé
      const g = ctx.createRadialGradient(-e.r * 0.2, -e.r * 0.3, e.r * 0.1, 0, 0, e.r * 1.05);
      g.addColorStop(0, '#3d2a6e'); g.addColorStop(0.6, '#1a1033'); g.addColorStop(1, '#05030f');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 3; ctx.stroke();
      // halo d'énergie
      const hg = ctx.createRadialGradient(0, 0, e.r * 0.8, 0, 0, e.r * 1.6);
      hg.addColorStop(0, 'rgba(179,157,219,0.25)'); hg.addColorStop(1, 'rgba(179,157,219,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 1.6, 0, TAU); ctx.fill();
      // yeux stellaires
      const gl = 0.8 + Math.sin(G.time * 4) * 0.2;
      ctx.fillStyle = `rgba(179,229,252,${gl})`;
      ctx.beginPath(); ctx.ellipse(-e.r * 0.3, -e.r * 0.2, e.r * 0.09, e.r * 0.14, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e.r * 0.3, -e.r * 0.2, e.r * 0.09, e.r * 0.14, 0, 0, TAU); ctx.fill();
      // bouche : vortex
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.35, e.r * 0.35, e.r * 0.2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.35, e.r * 0.35, e.r * 0.2, 0, 0, TAU); ctx.stroke();
      // tentacules d'énergie
      ctx.strokeStyle = 'rgba(179,157,219,0.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + G.time * 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.r * 0.9, Math.sin(a) * e.r * 0.9);
        ctx.quadraticCurveTo(Math.cos(a + 0.5) * e.r * 1.4, Math.sin(a + 0.5) * e.r * 1.4,
          Math.cos(a + 1) * e.r * 1.2, Math.sin(a + 1) * e.r * 1.2);
        ctx.stroke();
      }
    } else if (e.type === 'bossVoid' || e.type === 'overlord') {
      // seigneur stellaire / dominateur : navire-organisme, antennes, cœur
      const big = e.type === 'bossVoid';
      // antennes
      ctx.strokeStyle = '#3949ab'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(s * e.r * 0.4, -e.r * 0.7);
        ctx.quadraticCurveTo(s * e.r * 0.8, -e.r * 1.3, s * e.r * 0.6, -e.r * 1.6); ctx.stroke();
        ctx.fillStyle = '#80d8ff';
        ctx.beginPath(); ctx.arc(s * e.r * 0.6, -e.r * 1.6, e.r * 0.08, 0, TAU); ctx.fill();
      }
      // corps : capsule alien
      const g = ctx.createLinearGradient(0, -e.r, 0, e.r);
      g.addColorStop(0, '#5c6bc0'); g.addColorStop(0.6, '#283593'); g.addColorStop(1, '#1a237e');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, e.r * 0.85, e.r, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#0d1442'; ctx.lineWidth = big ? 3.5 : 2.5; ctx.stroke();
      // plaques
      ctx.strokeStyle = 'rgba(144,202,249,0.4)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const yy = -e.r * 0.6 + i * e.r * 0.4;
        ctx.beginPath(); ctx.moveTo(-e.r * 0.7, yy); ctx.quadraticCurveTo(0, yy + e.r * 0.15, e.r * 0.7, yy); ctx.stroke();
      }
      // cœur lumineux
      const cp = 1 + Math.sin(G.time * 4) * 0.15;
      const cg = ctx.createRadialGradient(0, e.r * 0.1, 2, 0, e.r * 0.1, e.r * 0.5 * cp);
      cg.addColorStop(0, '#e3f2fd'); cg.addColorStop(0.5, '#64b5f6'); cg.addColorStop(1, 'rgba(30,50,150,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(0, e.r * 0.1, e.r * 0.5 * cp, 0, TAU); ctx.fill();
      if (big) { // couronne d'étoiles
        ctx.fillStyle = '#ffd740';
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8 + G.time * 0.4;
          ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 1.1, Math.sin(a) * e.r * 0.5 - e.r * 0.3, e.r * 0.06, 0, TAU); ctx.fill();
        }
      }
    } else if (e.type === 'alien') {
      // alien rampant : corps vert, grosse tête, yeux noirs
      ctx.fillStyle = '#7cb342';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.1, e.r * 0.8, e.r * 0.7, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2; ctx.stroke();
      // tête
      ctx.fillStyle = '#9ccc65';
      ctx.beginPath(); ctx.ellipse(-e.r * 0.55, -e.r * 0.4, e.r * 0.55, e.r * 0.5, 0, 0, TAU); ctx.fill();
      // yeux allongés noirs
      ctx.fillStyle = '#000';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(-e.r * 0.65 + s * e.r * 0.1, -e.r * 0.45, e.r * 0.16, e.r * 0.08, s * 0.4, 0, TAU);
        ctx.fill();
      }
      // pattes
      ctx.strokeStyle = '#558b2f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const st = Math.sin(e.wobble * 3) * e.r * 0.2;
      for (const [lx, ly] of [[-0.3, 0.55], [0.3, 0.55], [-0.2, -0.2], [0.3, -0.15]]) {
        ctx.beginPath(); ctx.moveTo(e.r * lx, e.r * ly); ctx.lineTo(e.r * lx + st * 0.5, e.r * 0.85); ctx.stroke();
      }
    } else if (e.type === 'drone') {
      // drone de chasse : sphère métallique, rotor, canon
      // rotor
      ctx.strokeStyle = 'rgba(200,230,255,0.8)'; ctx.lineWidth = 2;
      const ra = G.time * 20;
      ctx.beginPath(); ctx.moveTo(-e.r * 0.8, -e.r * 0.7); ctx.lineTo(e.r * 0.8, -e.r * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -e.r * 0.85); ctx.lineTo(0, -e.r * 0.55); ctx.stroke();
      // corps
      const g = ctx.createRadialGradient(-e.r * 0.2, -e.r * 0.2, 1, 0, 0, e.r);
      g.addColorStop(0, '#90a4ae'); g.addColorStop(1, '#37474f');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.75, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#102027'; ctx.lineWidth = 2; ctx.stroke();
      // œil
      const bl = 0.7 + Math.sin(G.time * 6) * 0.3;
      ctx.fillStyle = `rgba(128,216,255,${bl})`;
      ctx.beginPath(); ctx.arc(-e.r * 0.3, 0, e.r * 0.14, 0, TAU); ctx.fill();
      // canon
      ctx.fillStyle = '#263238';
      ctx.fillRect(-e.r * 1.15, -e.r * 0.1, e.r * 0.5, e.r * 0.2);
      ctx.strokeStyle = '#102027'; ctx.lineWidth = 1.5;
      ctx.strokeRect(-e.r * 1.15, -e.r * 0.1, e.r * 0.5, e.r * 0.2);
    } else if (e.type === 'tentacule') {
      // tentacule stellaire : masse centrale + tentacules ondulants
      ctx.fillStyle = '#4a148c';
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.7, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1a0033'; ctx.lineWidth = 3; ctx.stroke();
      // cœur
      const cp = 1 + Math.sin(G.time * 3) * 0.15;
      const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, e.r * 0.5 * cp);
      cg.addColorStop(0, '#e1bee7'); cg.addColorStop(0.6, '#8e24aa'); cg.addColorStop(1, 'rgba(40,10,60,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.5 * cp, 0, TAU); ctx.fill();
      // tentacules
      ctx.strokeStyle = '#7b1fa2'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + G.time * 0.5 + e.wobble;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.r * 0.5, Math.sin(a) * e.r * 0.5);
        ctx.quadraticCurveTo(Math.cos(a + 0.4) * e.r * 1.1, Math.sin(a + 0.4) * e.r * 1.1,
          Math.cos(a + 0.8) * e.r * 1.3, Math.sin(a + 0.8) * e.r * 1.3);
        ctx.stroke();
        ctx.fillStyle = '#ce93d8';
        ctx.beginPath(); ctx.arc(Math.cos(a + 0.8) * e.r * 1.3, Math.sin(a + 0.8) * e.r * 1.3, e.r * 0.08, 0, TAU); ctx.fill();
      }
    } else {
      // cristal vivant : prisme facetté, éclats
      const g = ctx.createLinearGradient(0, -e.r, 0, e.r);
      g.addColorStop(0, '#80deea'); g.addColorStop(0.5, '#00838f'); g.addColorStop(1, '#004d40');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -e.r * 1.1);
      ctx.lineTo(e.r * 0.7, -e.r * 0.3);
      ctx.lineTo(e.r * 0.5, e.r * 0.9);
      ctx.lineTo(-e.r * 0.5, e.r * 0.9);
      ctx.lineTo(-e.r * 0.7, -e.r * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#b2ebf2'; ctx.lineWidth = 2; ctx.stroke();
      // facettes
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -e.r * 1.1); ctx.lineTo(0, e.r * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-e.r * 0.7, -e.r * 0.3); ctx.lineTo(e.r * 0.7, -e.r * 0.3); ctx.stroke();
      // nucleus
      const gl = 0.7 + Math.sin(G.time * 5) * 0.3;
      ctx.fillStyle = `rgba(224,247,250,${gl})`;
      ctx.beginPath(); ctx.arc(0, -e.r * 0.1, e.r * 0.15, 0, TAU); ctx.fill();
      // pointes latérales
      ctx.fillStyle = '#4dd0e1';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.7, -e.r * 0.3); ctx.lineTo(s * e.r * 1.1, e.r * 0.1); ctx.lineTo(s * e.r * 0.55, e.r * 0.25);
        ctx.closePath(); ctx.fill();
      }
    }
}
