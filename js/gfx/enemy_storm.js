import { G, ctx, TAU } from '../state.js';
import { shade } from '../utils.js';

// ================= LE ROYAUME DES TEMPÊTES : créatures du vent =================
export function drawStormEnemy(e) {
  const bodyColor = e.color, dark = shade(e.color, -40), light = shade(e.color, 50);
  const t = G.time;

  if (e.type === 'finalBossTempete') {
    // LE SOUVERAIN DES OURAGANS : colosse de nuages sombres, couronne de
    // tornades orbitantes, cœur-tempête, bras de vent et aura électrique
    const pulse = 1 + Math.sin(t * 2.6) * 0.06;
    // tornades orbitantes
    for (let i = 0; i < 5; i++) {
      const a = t * 1.4 + i * TAU / 5;
      const rr = e.r * 1.5 * pulse;
      const tx = Math.cos(a) * rr, ty = Math.sin(a) * rr * 0.55 - e.r * 0.2;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(t * 8 + i);
      ctx.fillStyle = 'rgba(200,230,250,0.4)';
      ctx.beginPath();
      ctx.moveTo(-5, -16); ctx.quadraticCurveTo(-8, -6, -11, 0);
      ctx.quadraticCurveTo(0, 5, 11, 0); ctx.quadraticCurveTo(8, -6, 5, -16);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // corps : masse nuageuse sombre
    const g = ctx.createRadialGradient(-e.r * 0.2, -e.r * 0.4, e.r * 0.15, 0, 0, e.r * 1.05);
    g.addColorStop(0, '#4a6a85'); g.addColorStop(0.55, '#1d3a52'); g.addColorStop(1, '#0a1a28');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, e.r * pulse, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 3.5; ctx.stroke();
    // cirrus sombres sur le corps
    ctx.strokeStyle = 'rgba(160,210,240,0.4)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const yy = -e.r * 0.7 + i * e.r * 0.26;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.8, yy);
      ctx.quadraticCurveTo(0, yy + Math.sin(t * 3 + i) * 6, e.r * 0.8, yy);
      ctx.stroke();
    }
    // cœur-tempête : vortex électrique
    const cp = 1 + Math.sin(t * 5) * 0.15;
    const cg = ctx.createRadialGradient(0, -e.r * 0.15, 2, 0, -e.r * 0.15, e.r * 0.55 * cp);
    cg.addColorStop(0, '#f0f8ff'); cg.addColorStop(0.4, '#4fc3f7'); cg.addColorStop(1, 'rgba(13,43,69,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, -e.r * 0.15, e.r * 0.55 * cp, 0, TAU); ctx.fill();
    // œil central
    ctx.fillStyle = '#e1f5fe';
    ctx.beginPath(); ctx.ellipse(0, -e.r * 0.75, e.r * 0.14, e.r * 0.2, 0, 0, TAU); ctx.fill();
    // couronne de glace/éclair au sommet
    ctx.strokeStyle = '#b3e5fc'; ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      const bx = Math.cos(a) * e.r * 0.9, by = Math.sin(a) * e.r * 0.9 - e.r * 0.3;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a) * e.r * 0.3, by + Math.sin(a) * e.r * 0.3 - e.r * 0.15);
      ctx.stroke();
    }
    // bras de vent
    ctx.strokeStyle = 'rgba(79,195,247,0.65)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const wv = Math.sin(t * 4 + s) * e.r * 0.2;
      ctx.beginPath();
      ctx.moveTo(s * e.r * 0.8, e.r * 0.25);
      ctx.quadraticCurveTo(s * e.r * 1.35, e.r * (0.45 + wv * 0.01), s * e.r * 1.55, e.r * 0.15 + wv);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,230,250,0.5)';
      ctx.beginPath(); ctx.arc(s * e.r * 1.55, e.r * 0.15 + wv, 4, 0, TAU); ctx.fill();
    }
    // éclairs sur le corps
    ctx.strokeStyle = 'rgba(227,242,253,0.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const lx = (Math.sin(t * 1.7 + i * 2.4) * 0.6) * e.r;
      ctx.beginPath();
      ctx.moveTo(lx, -e.r * 0.6);
      ctx.lineTo(lx + 8, -e.r * 0.3);
      ctx.lineTo(lx - 6, -e.r * 0.05);
      ctx.stroke();
    }
  } else if (e.type === 'bossOuragan' || e.type === 'colosse') {
    // typhon céleste / colosse des nuages : bouclier d'air, ailes de nuages
    const big = e.type === 'bossOuragan';
    // ailes de nuage
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1); ctx.rotate(Math.sin(t * 3) * 0.15);
      const wg = ctx.createRadialGradient(e.r * 0.9, -e.r * 0.2, 2, e.r * 0.9, -e.r * 0.2, e.r * 1.1);
      wg.addColorStop(0, 'rgba(190,225,245,0.55)'); wg.addColorStop(1, 'rgba(190,225,245,0)');
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.ellipse(e.r * 1.0, -e.r * 0.3, e.r * 1.0, e.r * 0.55, -0.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // corps : nuage compact
    const g = ctx.createRadialGradient(-e.r * 0.2, -e.r * 0.4, e.r * 0.15, 0, 0, e.r);
    g.addColorStop(0, light); g.addColorStop(0.55, bodyColor); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = i / 12 * TAU;
      const rr = e.r * (0.85 + Math.sin(a * 3 + t * 2) * 0.12);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.9;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = big ? 3.5 : 2.5; ctx.stroke();
    // bouclier d'air : dôme translucide
    ctx.strokeStyle = 'rgba(180,230,255,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.3, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.fillStyle = 'rgba(180,230,255,0.08)';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.3, Math.PI, TAU); ctx.fill();
    // yeux tempétueux
    const gl = 0.8 + Math.sin(t * 5) * 0.2;
    ctx.fillStyle = `rgba(255,255,255,${gl})`;
    ctx.beginPath(); ctx.ellipse(-e.r * 0.25, -e.r * 0.25, e.r * 0.1, e.r * 0.16, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(e.r * 0.25, -e.r * 0.25, e.r * 0.1, e.r * 0.16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0d2b45';
    ctx.beginPath(); ctx.arc(-e.r * 0.25, -e.r * 0.22, e.r * 0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(e.r * 0.25, -e.r * 0.22, e.r * 0.05, 0, TAU); ctx.fill();
    if (big) { // éclairs autour
      ctx.strokeStyle = 'rgba(227,242,253,0.6)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        const lx = Math.cos(a) * e.r * 1.45, ly = Math.sin(a) * e.r * 0.8;
        ctx.beginPath();
        ctx.moveTo(lx, ly); ctx.lineTo(lx + 6, ly + 8); ctx.lineTo(lx - 4, ly + 14);
        ctx.stroke();
      }
    }
  } else if (e.type === 'esprit') {
    // esprit de la brise : forme fluide translucide, noyau lumineux
    const wv = Math.sin(t * 6 + e.wobble) * 0.15;
    const g = ctx.createRadialGradient(0, -e.r * 0.2, 2, 0, 0, e.r);
    g.addColorStop(0, 'rgba(224,247,250,0.9)'); g.addColorStop(0.5, 'rgba(128,222,234,0.55)'); g.addColorStop(1, 'rgba(128,222,234,0.05)');
    ctx.fillStyle = g;
    ctx.save(); ctx.scale(1 + wv, 1 - wv);
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    ctx.restore();
    // queue de vent
    ctx.strokeStyle = 'rgba(180,230,250,0.5)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const yy = e.r * (0.3 + i * 0.25);
      const len = e.r * (0.8 - i * 0.18);
      ctx.beginPath();
      ctx.moveTo(-len * 0.5, yy);
      ctx.quadraticCurveTo(0, yy + Math.sin(t * 8 + i) * 5, len * 0.5, yy - 4);
      ctx.stroke();
    }
    // noyau
    const np = 1 + Math.sin(t * 4) * 0.2;
    ctx.fillStyle = '#e0f7fa';
    ctx.beginPath(); ctx.arc(0, -e.r * 0.15, e.r * 0.3 * np, 0, TAU); ctx.fill();
    ctx.fillStyle = '#00838f';
    ctx.beginPath(); ctx.arc(0, -e.r * 0.15, e.r * 0.15 * np, 0, TAU); ctx.fill();
  } else if (e.type === 'rafale') {
    // rafale vivante : boulet de vent dentelé
    ctx.save(); ctx.rotate(t * 6 + e.wobble);
    const g = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 2, 0, 0, e.r);
    g.addColorStop(0, '#e1f5fe'); g.addColorStop(0.6, bodyColor); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    // étoile à 6 branches
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      const rr = i % 2 ? e.r * 0.55 : e.r;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // traînée de vent
    ctx.strokeStyle = 'rgba(200,235,255,0.4)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const yy = -e.r * 0.4 + i * e.r * 0.4;
      ctx.beginPath();
      ctx.moveTo(-e.r * 1.8, yy);
      ctx.quadraticCurveTo(-e.r * 0.9, yy + Math.sin(t * 9 + i) * 4, -e.r * 0.2, yy);
      ctx.stroke();
    }
    ctx.fillStyle = '#0d2b45';
    ctx.beginPath(); ctx.arc(-e.r * 0.15, -e.r * 0.1, e.r * 0.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(e.r * 0.15, -e.r * 0.1, e.r * 0.1, 0, TAU); ctx.fill();
  } else if (e.type === 'gardien') {
    // gardien de la tempête : masse rocheuse enveloppée de tourbillons
    const g = ctx.createLinearGradient(0, -e.r, 0, e.r);
    g.addColorStop(0, '#78909c'); g.addColorStop(0.6, '#455a64'); g.addColorStop(1, '#263238');
    ctx.fillStyle = g;
    // corps pentagonal
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU - Math.PI / 2;
      const rr = e.r * (i % 2 ? 0.9 : 1.05);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
    // tourbillons d'air autour
    ctx.strokeStyle = 'rgba(79,195,247,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = t * 3 + i * TAU / 4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * e.r * 0.85, Math.sin(a) * e.r * 0.85, e.r * 0.22, a, a + Math.PI * 1.2);
      ctx.stroke();
    }
    // fentes lumineuses
    ctx.strokeStyle = 'rgba(179,229,252,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-e.r * 0.4, -e.r * 0.2); ctx.lineTo(-e.r * 0.1, e.r * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.r * 0.45, -e.r * 0.3); ctx.lineTo(e.r * 0.15, e.r * 0.15); ctx.stroke();
    // œil unique
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.arc(0, -e.r * 0.45, e.r * 0.14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0d2b45';
    ctx.beginPath(); ctx.arc(0, -e.r * 0.45, e.r * 0.06, 0, TAU); ctx.fill();
  } else { // courant : enfant du vent — silhouette filiforme rapide
    ctx.save(); ctx.rotate(Math.atan2(Math.sin(t * 2 + e.wobble), 1) * 0.2);
    const g = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.4, 2, 0, 0, e.r);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    ctx.fillStyle = g;
    // corps en goutte + queue de ruban
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 1.1);
    ctx.quadraticCurveTo(e.r * 0.55, -e.r * 0.3, e.r * 0.45, e.r * 0.5);
    ctx.quadraticCurveTo(0, e.r * 0.95 + Math.sin(t * 10) * 3, -e.r * 0.45, e.r * 0.5);
    ctx.quadraticCurveTo(-e.r * 0.55, -e.r * 0.3, 0, -e.r * 1.1);
    ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    // ruban de vent derrière
    ctx.strokeStyle = 'rgba(200,235,255,0.5)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, e.r * 0.7);
    ctx.quadraticCurveTo(Math.sin(t * 12) * e.r * 0.6, e.r * 1.5, -e.r * 0.9, e.r * 1.9 + Math.sin(t * 8) * 4);
    ctx.stroke();
    // yeux
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-e.r * 0.15, -e.r * 0.35, e.r * 0.09, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(e.r * 0.15, -e.r * 0.35, e.r * 0.09, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
