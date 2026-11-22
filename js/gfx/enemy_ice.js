import { G, ctx, TAU } from '../state.js';
import { shade } from '../utils.js';

export function drawFrozenEnemy(e) {
  const flash = e.attackCooldown > 0.9;
  const bodyColor = e.color, dark = shade(e.color, -40), light = shade(e.color, 50);
    // ================= THE FROZEN LAND : créatures gelées =================
    if (e.type === 'finalBossGlace') {
      // Souverain de Glace : golem de glacier couronné, cœur de glace pulsé
      const g = ctx.createLinearGradient(0, -e.r, 0, e.r);
      g.addColorStop(0, '#e1f5fe'); g.addColorStop(0.5, '#4fc3f7'); g.addColorStop(1, '#0277bd');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU - Math.PI / 2;
        const px = Math.cos(a) * e.r * (i % 2 ? 0.85 : 1), py = Math.sin(a) * e.r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#01579b'; ctx.lineWidth = 4; ctx.stroke();
      // pics de glace
      ctx.fillStyle = 'rgba(224,245,254,0.9)';
      for (const s of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.4 - 8, -e.r * 0.8);
        ctx.lineTo(s * e.r * 0.4, -e.r * 1.5);
        ctx.lineTo(s * e.r * 0.4 + 8, -e.r * 0.8);
        ctx.closePath(); ctx.fill();
      }
      // couronne de glace
      ctx.fillStyle = '#b3e5fc';
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.45, -e.r * 0.85);
      for (let i = 0; i < 5; i++) {
        const cx = -e.r * 0.45 + i * e.r * 0.225;
        ctx.lineTo(cx + e.r * 0.1, -e.r * 1.15); ctx.lineTo(cx + e.r * 0.2, -e.r * 0.85);
      }
      ctx.closePath(); ctx.fill();
      // cœur de glace pulsé
      const pulse = 1 + Math.sin(G.time * 2.8) * 0.18;
      const cg = ctx.createRadialGradient(0, 0, 3, 0, 0, e.r * 0.5 * pulse);
      cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.5, '#4fc3f7'); cg.addColorStop(1, 'rgba(1,87,155,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.5 * pulse, 0, TAU); ctx.fill();
      // yeux glacés
      ctx.fillStyle = '#e1f5fe';
      ctx.beginPath(); ctx.arc(-e.r * 0.28, -e.r * 0.3, e.r * 0.09, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.28, -e.r * 0.3, e.r * 0.09, 0, TAU); ctx.fill();
    } else if (e.type === 'glacier' || e.type === 'bossGlace' || e.type === 'bossCryo') {
      // géant / roi de glace : bloc de glace facetté + fissures lumineuses
      const g = ctx.createLinearGradient(-e.r, -e.r, e.r, e.r);
      g.addColorStop(0, '#e1f5fe'); g.addColorStop(0.55, '#81d4fa'); g.addColorStop(1, '#0277bd');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.9, e.r * 0.6); ctx.lineTo(-e.r * 0.7, -e.r * 0.7);
      ctx.lineTo(0, -e.r); ctx.lineTo(e.r * 0.75, -e.r * 0.65); ctx.lineTo(e.r * 0.95, e.r * 0.5);
      ctx.lineTo(e.r * 0.4, e.r); ctx.lineTo(-e.r * 0.5, e.r * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#01579b'; ctx.lineWidth = 3; ctx.stroke();
      // reflets de facettes
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-e.r * 0.5, -e.r * 0.4); ctx.lineTo(0, e.r * 0.2); ctx.lineTo(e.r * 0.5, -e.r * 0.3); ctx.stroke();
      // yeux
      ctx.fillStyle = e.isBoss ? '#ff5252' : '#80deea';
      ctx.beginPath(); ctx.arc(-e.r * 0.25, -e.r * 0.45, e.r * 0.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.25, -e.r * 0.45, e.r * 0.1, 0, TAU); ctx.fill();
      if (e.isBoss) { // couronne de pics pour les boss de glace
        ctx.fillStyle = '#b3e5fc';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * e.r * 0.6, -e.r * 0.7); ctx.lineTo(s * e.r * 1.1, -e.r * 1.2); ctx.lineTo(s * e.r * 0.8, -e.r * 0.6);
          ctx.closePath(); ctx.fill();
        }
      }
    } else if (e.type === 'crypt') {
      // créature des grottes : masse sombre, yeux phosphorescents, gueule
      ctx.fillStyle = '#102027';
      ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#80deea'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * 0.85, 0, 0, TAU); ctx.stroke();
      // yeux phosphorescents
      const blink = Math.sin(G.time * 3) > -0.9 ? 1 : 0.2;
      ctx.fillStyle = '#80deea';
      ctx.beginPath(); ctx.ellipse(-e.r * 0.3, -e.r * 0.25, e.r * 0.16, e.r * 0.1 * blink, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(e.r * 0.3, -e.r * 0.25, e.r * 0.16, e.r * 0.1 * blink, 0, 0, TAU); ctx.fill();
      // gueule dentelée
      ctx.fillStyle = '#0a1418';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.35, e.r * 0.4, e.r * 0.22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b3e5fc';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * e.r * 0.14 - 3, e.r * 0.2); ctx.lineTo(i * e.r * 0.14, e.r * 0.32); ctx.lineTo(i * e.r * 0.14 + 3, e.r * 0.2);
        ctx.closePath(); ctx.fill();
      }
    } else if (e.type === 'hunter') {
      // chasseur gelé : silhouette élancée, lame de glace, posture féline
      ctx.fillStyle = '#78909c';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.1, e.r * 0.7, e.r * 0.8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#37474f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.1, e.r * 0.7, e.r * 0.8, 0, 0, TAU); ctx.stroke();
      // tête + oreilles
      ctx.fillStyle = '#eceff1';
      ctx.beginPath(); ctx.arc(0, -e.r * 0.75, e.r * 0.42, 0, TAU); ctx.fill();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.25, -e.r * 0.95); ctx.lineTo(s * e.r * 0.42, -e.r * 1.35); ctx.lineTo(s * e.r * 0.5, -e.r * 0.9);
        ctx.closePath(); ctx.fill();
      }
      // yeux fauves
      ctx.fillStyle = '#ffab40';
      ctx.beginPath(); ctx.arc(-e.r * 0.15, -e.r * 0.78, e.r * 0.07, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.15, -e.r * 0.78, e.r * 0.07, 0, TAU); ctx.fill();
      // lame de glace
      ctx.strokeStyle = '#e1f5fe'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.r * 0.7, e.r * 0.2); ctx.lineTo(e.r * 1.15, -e.r * 0.5); ctx.stroke();
    } else {
      // yeti / alpha : masse blanche poilue, crocs, aura de froid
      const big = e.type === 'alpha';
      ctx.fillStyle = big ? '#ffffff' : '#eceff1';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.1, e.r * (big ? 1.05 : 0.85), e.r * 0.9, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.1, e.r * (big ? 1.05 : 0.85), e.r * 0.9, 0, 0, TAU); ctx.stroke();
      // fourrure : touffes irrégulières
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + 0.4;
        ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.8, Math.sin(a) * e.r * 0.75 + e.r * 0.1, e.r * 0.16, 0, TAU); ctx.fill();
      }
      // tête + museau
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, -e.r * 0.8, e.r * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = '#cfd8dc';
      ctx.beginPath(); ctx.ellipse(0, -e.r * 0.68, e.r * 0.22, e.r * 0.16, 0, 0, TAU); ctx.fill();
      // yeux rouges (alpha) ou sombres (yeti)
      ctx.fillStyle = big ? '#ff1744' : '#263238';
      ctx.beginPath(); ctx.arc(-e.r * 0.15, -e.r * 0.85, e.r * 0.07, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.15, -e.r * 0.85, e.r * 0.07, 0, TAU); ctx.fill();
      // crocs
      ctx.fillStyle = '#fff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.12 - 3, -e.r * 0.58); ctx.lineTo(s * e.r * 0.12, -e.r * 0.44); ctx.lineTo(s * e.r * 0.12 + 3, -e.r * 0.58);
        ctx.closePath(); ctx.fill();
      }
      // aura de froid au sol
      ctx.fillStyle = 'rgba(179,229,252,0.25)';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.9, e.r * 1.2, e.r * 0.35, 0, 0, TAU); ctx.fill();
    }
}
