import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';

function drawShadow(x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r * 0.9, r * 0.35, 0, 0, TAU); ctx.fill();
}

export function drawEnemy(e) {
  const p = G.player;
  const isFinal = e.type === 'finalBoss' || e.type === 'finalBossGlace' || e.type === 'finalBossEnfer';
  drawShadow(e.x, e.y, e.r);
  // aura pour les mini-boss et boss
  if (e.isBoss || e.isMini) {
    const ag = ctx.createRadialGradient(e.x, e.y, e.r * 0.5, e.x, e.y, e.r * 1.9);
    ag.addColorStop(0, e.isBoss ? 'rgba(255,40,40,0.28)' : 'rgba(255,160,50,0.22)');
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.9, 0, TAU); ctx.fill();
  }
  // bulle de grâce pendant l'invulnérabilité (événement des brutes)
  if (e.graceT > 0 && !isFinal) {
    ctx.globalAlpha = 0.3 + Math.sin(G.time * 8) * 0.12;
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.4, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,64,0.08)';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.4, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // émergence du boss final : anneau de terre qui s'ouvre sous ses pieds
  if (isFinal && e.graceT > 0) {
    const k = Math.max(0, 1 - e.graceT / 2.4);
    ctx.strokeStyle = `rgba(141,110,99,${0.9 - k * 0.5})`; ctx.lineWidth = 5 - k * 3;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.55, e.r * (0.6 + k * 0.9), e.r * (0.3 + k * 0.45), 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(224,64,251,${0.7 * (1 - k)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.55, e.r * (0.4 + k * 0.8), e.r * (0.2 + k * 0.4), 0, 0, TAU); ctx.stroke();
  }
  // boss final enfoui : monticule de terre, il n'est plus visible
  if (e.burrow && e.burrow.phase !== 'rise') {
    ctx.fillStyle = 'rgba(62,39,35,0.92)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.45, e.r * 1.2, e.r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(141,110,99,0.7)';
    ctx.beginPath(); ctx.ellipse(e.x - e.r * 0.4, e.y + e.r * 0.3, e.r * 0.3, e.r * 0.14, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(e.x + e.r * 0.45, e.y + e.r * 0.35, e.r * 0.25, e.r * 0.12, 0, 0, TAU); ctx.fill();
    return;
  }
  // télégraphe d'un mouvement signature : cercle qui se referme sur la cible
  if (e.bossMove && e.bossMove.track && e.bossMove.dur > 0) {
    const m = e.bossMove;
    const prog = Math.min(1, 1 - Math.max(0, m.t) / m.dur);
    const frozen = e.type === 'finalBossGlace';
    const hell = e.type === 'finalBossEnfer';
    const tcol = frozen ? '129,212,250' : hell ? '255,171,0' : '255,112,67';
    ctx.strokeStyle = `rgba(${tcol},${0.3 + prog * 0.6})`;
    ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(m.tx, m.ty, 55 + prog * 45, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${tcol},0.12)`;
    ctx.beginPath(); ctx.arc(m.tx, m.ty, 55 + prog * 45, 0, TAU); ctx.fill();
    // second anneau qui se referme en sens inverse + réticule central
    ctx.strokeStyle = `rgba(${tcol},${0.55 + prog * 0.45})`;
    ctx.lineWidth = 2; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.arc(m.tx, m.ty, 110 - prog * 62, G.time * 3, G.time * 3 + TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${tcol},${0.4 + prog * 0.6})`;
    ctx.beginPath(); ctx.arc(m.tx, m.ty, 4 + prog * 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${tcol},0.5)`; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.tx - 14, m.ty); ctx.lineTo(m.tx + 14, m.ty);
    ctx.moveTo(m.tx, m.ty - 14); ctx.lineTo(m.tx, m.ty + 14);
    ctx.stroke();
  }
  const flash = e.attackCooldown > 0.9;
  const bodyColor = e.color, dark = shade(e.color, -40), light = shade(e.color, 50);

  ctx.save();
  ctx.translate(e.x, e.y);
  // apparition : le monstre grandit depuis le portail
  if (e.spawnT > 0 && e.spawnMax > 0) {
    const s = Math.max(0.01, 1 - e.spawnT / e.spawnMax);
    ctx.scale(s, s);
  }
  // boss final : il sort de terre en grandissant depuis le sol
  if (isFinal && e.graceT > 0) {
    const k = Math.max(0, 1 - e.graceT / 2.4);
    ctx.translate(0, (1 - k) * 85);
    const sc = 0.55 + 0.45 * k;
    ctx.scale(sc, sc);
  }
  // agonie du boss final : le corps s'affaisse dans le sol et s'estompe
  if (e.bossDying) {
    const k = Math.max(0, e.bossDying / 2.4); // 1 -> 0
    ctx.translate(0, (1 - k) * e.r * 1.3);
    ctx.rotate((1 - k) * 0.9);
    ctx.globalAlpha = 0.25 + k * 0.75;
  }

  // contour sombre pour détacher le monstre du décor
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.arc(0, 0, e.r * 1.12, 0, TAU); ctx.fill();

  // boss final enragé (phase 2/3) : aura tournante + étincelles
  if (isFinal && e.phase > 0 && !e.bossDying) {
    const frozen = e.type === 'finalBossGlace';
    const col = frozen ? '#80d8ff' : e.type === 'finalBossEnfer' ? '#ffab00' : '#e040fb';
    const pulse = 1 + Math.sin(G.time * (4 + e.phase * 3)) * 0.08;
    ctx.strokeStyle = col; ctx.globalAlpha = 0.5 + e.phase * 0.15; ctx.lineWidth = 3;
    ctx.setLineDash([14 + e.phase * 6, 10]);
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.35 * pulse, G.time * (2 + e.phase), G.time * (2 + e.phase) + TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // pointes d'énergie qui fusent
    for (let i = 0; i < 4 + e.phase * 3; i++) {
      const a = G.time * 3 + i * (TAU / (4 + e.phase * 3)) + e.wobble;
      const rr = e.r * (1.3 + 0.25 * Math.sin(G.time * 6 + i));
      ctx.fillStyle = col; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.7, 3 + e.phase, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // bouclier de phase : dôme hexagonal scintillant (10 s après chaque changement de phase)
  if (e.shieldT > 0 && !e.bossDying) {
    const pulse = 0.75 + Math.sin(G.time * 8) * 0.15;
    const col = e.type === 'finalBossGlace' ? '129,212,250' : e.type === 'finalBossEnfer' ? '255,171,0' : '224,64,251';
    ctx.strokeStyle = `rgba(${col},${0.85 * pulse})`;
    ctx.fillStyle = `rgba(${col},${0.10 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.5, 0, TAU); ctx.fill(); ctx.stroke();
    // hexagone tournant à l'intérieur
    ctx.strokeStyle = `rgba(${col},${0.6 * pulse})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = G.time * 2.4 + i * (TAU / 6);
      const rr = e.r * 1.28;
      i === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.stroke();
    // anneau de compte à rebours discret
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * pulse})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * (e.shieldT / 10)); ctx.stroke();
  }

  if (e.type === 'slime') {
    const sq = 1 + Math.sin(e.wobble) * 0.08;
    ctx.scale(1 / sq, sq);
    const g = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 2, 0, 0, e.r);
    g.addColorStop(0, light); g.addColorStop(1, bodyColor);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    // reflet
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-e.r * 0.35, -e.r * 0.4, e.r * 0.22, e.r * 0.14, -0.5, 0, TAU); ctx.fill();
    // taches internes + goutte au sol
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.arc(e.r * 0.4, e.r * 0.35, e.r * 0.13, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-e.r * 0.35, e.r * 0.5, e.r * 0.09, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(0, e.r * 0.85, e.r * 0.3, e.r * 0.12, 0, 0, TAU); ctx.fill();
    // reflet Specular en arc
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.82, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
  } else if (e.type === 'bat') {
    const flap = Math.sin(e.wobble * 2) * 0.5;
    ctx.fillStyle = dark;
    // ailes
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1); ctx.rotate(-0.4 - flap * 0.4);
      ctx.beginPath(); ctx.ellipse(e.r * 0.9, -e.r * 0.3, e.r * 0.9, e.r * 0.4, 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    const g = ctx.createRadialGradient(-3, -3, 2, 0, 0, e.r);
    g.addColorStop(0, light); g.addColorStop(1, bodyColor);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    // oreilles pointues
    ctx.fillStyle = bodyColor;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * e.r * 0.15, -e.r * 0.75);
      ctx.lineTo(s * e.r * 0.55, -e.r * 1.25);
      ctx.lineTo(s * e.r * 0.5, -e.r * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // crocs
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * e.r * 0.18, e.r * 0.55);
      ctx.lineTo(s * e.r * 0.32, e.r * 0.88);
      ctx.lineTo(s * e.r * 0.05, e.r * 0.78);
      ctx.closePath(); ctx.fill();
    }
  } else if (e.type === 'witch') {
    // sorcière : robe violette + chapeau pointu
    const g = ctx.createRadialGradient(-3, -4, 2, 0, 0, e.r);
    g.addColorStop(0, '#8e24aa'); g.addColorStop(1, '#3d0a52');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1a0030'; ctx.lineWidth = 2; ctx.stroke();
    // chapeau : bord + cône
    ctx.fillStyle = '#311b92';
    ctx.beginPath(); ctx.ellipse(0, -e.r * 0.5, e.r * 1.05, e.r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.6, -e.r * 0.55);
    ctx.lineTo(0, -e.r * 1.65);
    ctx.lineTo(e.r * 0.6, -e.r * 0.55);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1a0030'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -e.r * 0.5, e.r * 1.05, e.r * 0.3, 0, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.6, -e.r * 0.55); ctx.lineTo(0, -e.r * 1.65); ctx.lineTo(e.r * 0.6, -e.r * 0.55);
    ctx.closePath(); ctx.stroke();
    // bande du chapeau
    ctx.fillStyle = '#ffd740';
    ctx.fillRect(-e.r * 0.45, -e.r * 0.72, e.r * 0.9, 3);
    // aura magique
    ctx.fillStyle = 'rgba(206,147,216,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.25, 0, TAU); ctx.fill();
  } else if (e.type === 'spider') {
    // araignée : 8 pattes animées, corps en 2 segments, marque rouge
    ctx.strokeStyle = dark; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const fy = -e.r * 0.55 + k * e.r * 0.38;
        const phase = Math.sin(e.wobble * 4 + k * 1.9 + (s > 0 ? Math.PI : 0));
        const fx = s * (e.r * 1.45 + phase * e.r * 0.15);
        const fy2 = fy + (k % 2 ? e.r * 0.18 : -e.r * 0.18) + phase * e.r * 0.08;
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.3, fy * 0.55);
        ctx.quadraticCurveTo(s * e.r * 1.05, fy + phase * e.r * 0.1, fx, fy2);
        ctx.stroke();
      }
    }
    // abdomen (arrière) + céphalothorax
    const ag = ctx.createRadialGradient(-3, -3, 2, 0, 0, e.r);
    ag.addColorStop(0, light); ag.addColorStop(1, bodyColor);
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.ellipse(e.r * 0.25, e.r * 0.3, e.r * 0.72, e.r * 0.6, 0.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(-e.r * 0.3, -e.r * 0.2, e.r * 0.55, 0, TAU); ctx.fill();
    ctx.stroke();
    // marque en sablier sur l'abdomen
    ctx.fillStyle = 'rgba(229,57,53,0.85)';
    ctx.beginPath();
    ctx.moveTo(e.r * 0.05, e.r * 0.1); ctx.lineTo(e.r * 0.45, e.r * 0.1);
    ctx.lineTo(e.r * 0.32, e.r * 0.42); ctx.lineTo(e.r * 0.18, e.r * 0.42);
    ctx.closePath(); ctx.fill();
    // pré-abdomen strié
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(e.r * 0.25, e.r * 0.3, e.r * (0.72 - i * 0.14), e.r * (0.6 - i * 0.12), 0.3, -0.6, 0.6);
      ctx.stroke();
    }
  } else if (e.type === 'finalBoss') {
    // Seigneur Oublié : démon des profondeurs — silhouette noire, cornes,
    // noyau violet pulsé, griffes et aura d'ombre
    const g = ctx.createRadialGradient(-6, -8, 4, 0, 0, e.r);
    g.addColorStop(0, '#8e24aa'); g.addColorStop(0.5, '#4a148c'); g.addColorStop(1, '#160029');
    ctx.fillStyle = g;
    // corps : silhouette démoniaque effilée vers le bas
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 1.15);
    ctx.quadraticCurveTo(e.r * 0.95, -e.r * 0.7, e.r * 0.78, e.r * 0.15);
    ctx.quadraticCurveTo(e.r * 0.6, e.r * 0.9, 0, e.r);
    ctx.quadraticCurveTo(-e.r * 0.6, e.r * 0.9, -e.r * 0.78, e.r * 0.15);
    ctx.quadraticCurveTo(-e.r * 0.95, -e.r * 0.7, 0, -e.r * 1.15);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0d0021'; ctx.lineWidth = 3; ctx.stroke();
    // cornes recourbées
    ctx.fillStyle = '#1a0030';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * e.r * 0.4, -e.r * 0.95);
      ctx.quadraticCurveTo(s * e.r * 1.35, -e.r * 1.5, s * e.r * 0.95, -e.r * 1.8);
      ctx.quadraticCurveTo(s * e.r * 0.7, -e.r * 1.05, s * e.r * 0.22, -e.r * 0.78);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4a148c'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // aura d'ombre au sol
    ctx.fillStyle = 'rgba(74,20,140,0.3)';
    ctx.beginPath(); ctx.ellipse(0, e.r * 0.85, e.r * 1.15, e.r * 0.35, 0, 0, TAU); ctx.fill();
    // noyau violet pulsé
    const pulse = 1 + Math.sin(G.time * 3.2) * 0.15;
    const ng = ctx.createRadialGradient(0, -e.r * 0.1, 2, 0, -e.r * 0.1, e.r * 0.55 * pulse);
    ng.addColorStop(0, '#f3e5f5'); ng.addColorStop(0.4, '#e040fb'); ng.addColorStop(1, 'rgba(74,20,140,0)');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.arc(0, -e.r * 0.1, e.r * 0.55 * pulse, 0, TAU); ctx.fill();
    // griffes
    ctx.strokeStyle = '#0d0021'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.7, e.r * (0.15 + k * 0.28));
        ctx.lineTo(s * e.r * 1.15, e.r * (0.35 + k * 0.3));
        ctx.stroke();
      }
    }
    // fissures d'ombre lumineuses
    ctx.strokeStyle = 'rgba(224,64,251,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-e.r * 0.5, -e.r * 0.4); ctx.lineTo(-e.r * 0.1, e.r * 0.1); ctx.lineTo(-e.r * 0.35, e.r * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.r * 0.55, -e.r * 0.35); ctx.lineTo(e.r * 0.15, e.r * 0.15); ctx.lineTo(e.r * 0.45, e.r * 0.6); ctx.stroke();
    //-runic forehead mark
    ctx.fillStyle = '#e040fb';
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 0.95); ctx.lineTo(e.r * 0.12, -e.r * 0.75); ctx.lineTo(0, -e.r * 0.6); ctx.lineTo(-e.r * 0.12, -e.r * 0.75);
    ctx.closePath(); ctx.fill();
  } else if (e.type === 'yeti' || e.type === 'hunter' || e.type === 'alpha' ||
             e.type === 'glacier' || e.type === 'crypt' ||
             e.type === 'bossGlace' || e.type === 'bossCryo' || e.type === 'finalBossGlace') {
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
  } else if (['imp', 'hound', 'cultist', 'demon', 'golemEnf', 'bossEnf', 'priest', 'finalBossEnfer'].includes(e.type)) {
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
  } else { // golem / mini-boss / boss
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, e.r);
    g.addColorStop(0, light); g.addColorStop(1, bodyColor);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU - Math.PI / 2;
      const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
    // noyau
    ctx.fillStyle = flash ? '#ff5252' : (e.isBoss ? '#ff1744' : '#ffb300');
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.35, 0, TAU); ctx.fill();
    // couronne du boss / cornes du mini-boss
    if (e.isBoss || e.isMini) {
      ctx.fillStyle = e.isBoss ? '#ffd740' : '#ffb300';
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.5, -e.r * 0.7);
      for (let i = 0; i < 5; i++) {
        const cx = -e.r * 0.5 + i * e.r * 0.25;
        const top = e.isBoss ? -e.r * 1.0 : -e.r * 0.95;
        ctx.lineTo(cx + e.r * 0.12, top);
        ctx.lineTo(cx + e.r * 0.25, -e.r * 0.7);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = e.isBoss ? '#b8860b' : '#e65100'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // fissures
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-e.r * 0.6, -e.r * 0.2); ctx.lineTo(-e.r * 0.1, e.r * 0.15); ctx.lineTo(-e.r * 0.4, e.r * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.r * 0.55, -e.r * 0.3); ctx.lineTo(e.r * 0.2, e.r * 0.1); ctx.stroke();
    // sourcils méchants
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-e.r * 0.6, -e.r * 0.6); ctx.lineTo(-e.r * 0.2, -e.r * 0.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.r * 0.6, -e.r * 0.6); ctx.lineTo(e.r * 0.2, -e.r * 0.45); ctx.stroke();
    // reflet métallique en arc
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.88, Math.PI * 1.15, Math.PI * 1.6); ctx.stroke();
    // rivets
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const [rx, ry] of [[-0.55, -0.35], [0.55, -0.35], [0, -0.6]]) {
      ctx.beginPath(); ctx.arc(e.r * rx, e.r * ry, e.r * 0.07, 0, TAU); ctx.fill();
    }
    // emblème spécifique au type de boss
    if (e.type === 'bossFoudre') {
      // antenne + orbe électrique
      ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, -e.r * 0.8); ctx.lineTo(0, -e.r * 1.2); ctx.stroke();
      ctx.fillStyle = '#e1bee7';
      ctx.beginPath(); ctx.arc(0, -e.r * 1.28, e.r * 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, -e.r * 1.28, e.r * 0.24, 0, TAU); ctx.stroke();
    } else if (e.type === 'bossGivre') {
      // flocon de givre sur la carapace
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * e.r * 0.45, e.r * 0.1 - Math.sin(a) * e.r * 0.45);
        ctx.lineTo(Math.cos(a) * e.r * 0.45, e.r * 0.1 + Math.sin(a) * e.r * 0.45);
        ctx.stroke();
      }
      ctx.fillStyle = '#e1f5fe';
      ctx.beginPath(); ctx.arc(0, e.r * 0.1, e.r * 0.12, 0, TAU); ctx.fill();
    }
    // pics d'épaule pour le boss
    if (e.isBoss) {
      ctx.fillStyle = dark;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * e.r * 0.75, -e.r * 0.55);
        ctx.lineTo(s * e.r * 1.25, -e.r * 0.15);
        ctx.lineTo(s * e.r * 0.8, -e.r * 0.05);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }

  // petites pattes animées pour les monstres marcheurs
  // (exclus : slime = blob, chauve-souris = volante, araignée = 8 pattes)
  if (!['slime', 'bat', 'spider'].includes(e.type)) {
    const step = Math.sin(e.wobble * 2.2) * e.r * 0.14;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * e.r * 0.36, e.r * 0.8 + (s > 0 ? step : -step) * 0.5, e.r * 0.17, e.r * 0.13, 0, 0, TAU);
      ctx.fill();
    }
  }

  // Yeux (tous types) — regardent vers le joueur
  const lookX = Math.sign(p.x - e.x) * 2, lookY = Math.sign(p.y - e.y) * 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-e.r * 0.3 + lookX, -e.r * 0.25 + lookY, e.r * 0.18, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(e.r * 0.3 + lookX, -e.r * 0.25 + lookY, e.r * 0.18, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(-e.r * 0.3 + lookX * 1.6, -e.r * 0.25 + lookY * 1.6, e.r * 0.09, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(e.r * 0.3 + lookX * 1.6, -e.r * 0.25 + lookY * 1.6, e.r * 0.09, 0, TAU); ctx.fill();
  ctx.restore();

  // teinte bleue quand ralenti
  if (e.slow > 0) {
    ctx.globalAlpha = Math.min(0.5, e.slow * 0.4);
    ctx.fillStyle = '#40c4ff';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // flash blanc à chaque coup subi (surtout visible sur les boss)
  if (e.hitFlash > 0) {
    ctx.globalAlpha = Math.min(0.5, e.hitFlash * 4);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.05, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // pilier d'âme : colonne d'énergie qui s'élève pendant l'agonie du boss final
  if (e.bossDying) {
    const k = Math.max(0, e.bossDying / 2.4);
    const col = e.type === 'finalBossGlace' ? '129,212,250' : e.type === 'finalBossEnfer' ? '255,171,0' : '224,64,251';
    const h = e.r * (3.4 - k * 1.5);
    const g = ctx.createLinearGradient(0, e.y - h, 0, e.y + e.r * 0.6);
    g.addColorStop(0, `rgba(${col},0)`);
    g.addColorStop(0.45, `rgba(${col},${0.3 * k})`);
    g.addColorStop(1, `rgba(${col},${0.65 * k})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(e.x - e.r * 0.18 * k - 3, e.y + e.r * 0.6);
    ctx.lineTo(e.x - e.r * 0.6 * k - 4, e.y - h * 0.55);
    ctx.lineTo(e.x, e.y - h);
    ctx.lineTo(e.x + e.r * 0.6 * k + 4, e.y - h * 0.55);
    ctx.lineTo(e.x + e.r * 0.18 * k + 3, e.y + e.r * 0.6);
    ctx.closePath(); ctx.fill();
  }

  // Barre de vie
  const bw = e.r * 2.2;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(e.x - bw / 2, e.y - e.r - 13, bw, 5, 2); ctx.fill();
  ctx.fillStyle = '#e53935';
  roundRect(e.x - bw / 2, e.y - e.r - 13, bw * Math.max(0, e.hp / e.maxHp), 5, 2); ctx.fill();
  if (e.isBoss || e.isMini) {
    ctx.fillStyle = e.isBoss ? '#ff5252' : '#ffb300';
    ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(e.isBoss ? 'BOSS' : 'MINI-BOSS', e.x, e.y - e.r - 18);
  }
}

// Animation de l'attaque rotative : anneaux, traînées circulaires et épées orbitales
function drawSpinAnim() {
  const p = G.player;
  const prog = 1 - p.spinDuration / 0.35; // 0 -> 1
  const fade = p.spinDuration / 0.35;
  const rot = prog * TAU * 2.5; // 2,5 tours pendant l'animation

  // double anneau d'onde
  for (let i = 0; i < 2; i++) {
    const rr = p.spinRadius * (0.45 + i * 0.55) * (0.5 + prog * 0.5);
    ctx.strokeStyle = `rgba(255,${150 - i * 50},0,${0.55 * fade})`;
    ctx.lineWidth = 5 - i * 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.stroke();
  }

  // traînées circulaires en éventail
  ctx.strokeStyle = `rgba(255,205,90,${0.65 * fade})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const a0 = rot + i * TAU / 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.spinRadius * 0.8, a0, a0 + 1.2); ctx.stroke();
  }

  // 3 épées qui orbitent le joueur
  for (let i = 0; i < 3; i++) {
    const a = rot + i * TAU / 3;
    const sx = p.x + Math.cos(a) * p.spinRadius * 0.55;
    const sy = p.y + Math.sin(a) * p.spinRadius * 0.55;
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.moveTo(-3, -13); ctx.lineTo(3, -13); ctx.lineTo(1.5, 11); ctx.lineTo(-1.5, 11);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#455a64'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffd740'; ctx.fillRect(-4.5, 8, 9, 3.5);
    ctx.restore();
  }
}

// ---------- APPARITIONS DE DÉPART (selon la campagne) ----------
// gros glacon de glace dont le héros sort : le bloc rétrécit, se fissure
// et fond en gouttes pendant que le héros grandit hors de lui
function drawIceSpawn(x, y, prog) {
  const R = 82 * (1.25 - prog * 0.5); // le glacon rétrécit en fondant
  let alpha = 0.92;
  if (prog > 0.45) alpha *= Math.max(0, 1 - (prog - 0.45) / 0.5);
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  // cristal : hexaedre irrégulier
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + 0.3;
    const rr = R * (0.85 + ((i * 37) % 10) / 40);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.92]);
  }
  const g = ctx.createLinearGradient(-R, -R, R, R);
  g.addColorStop(0, '#e1f5fe'); g.addColorStop(0.5, '#7ec8f0'); g.addColorStop(1, '#0277bd');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.stroke();
  // facettes internes
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[4][0], pts[4][1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[5][0], pts[5][1]); ctx.stroke();
  // fissures qui apparaissent en fin de fonte
  if (prog > 0.3) {
    const ca = Math.min(1, (prog - 0.3) / 0.4);
    ctx.strokeStyle = `rgba(2,60,100,${0.7 * ca})`; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-R * 0.4, -R * 0.5); ctx.lineTo(-R * 0.1, -R * 0.1); ctx.lineTo(-R * 0.3, R * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.35, -R * 0.55); ctx.lineTo(R * 0.15, -R * 0.15); ctx.lineTo(R * 0.4, R * 0.15); ctx.stroke();
  }
  // gouttes de fonte qui tombent
  if (prog > 0.45) {
    const dp = (prog - 0.45) / 0.55;
    ctx.fillStyle = `rgba(179,229,252,${0.8 * (1 - dp * 0.5)})`;
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * R * 0.55;
      const dy = R * 0.7 + dp * (60 + i * 18);
      ctx.beginPath(); ctx.ellipse(dx, dy, 3.5, 6, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// volcan en éruption : cône de roche, cratère incandescent, braises et
// panache de fumée — le héros en est projeté vers le haut
function drawVolcanoSpawn(x, y, prog) {
  const p = G.player;
  ctx.save();
  ctx.translate(x, y);
  const baseY = p.r * 1.15;
  // lueur de lave au sol
  const lg = ctx.createRadialGradient(0, baseY, 4, 0, baseY, p.r * 4.6);
  const flick = 0.45 + Math.sin(prog * 34) * 0.15;
  lg.addColorStop(0, `rgba(255,120,30,${flick})`);
  lg.addColorStop(0.5, 'rgba(255,80,20,0.2)');
  lg.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.ellipse(0, baseY, p.r * 4.6, p.r * 1.5, 0, 0, TAU); ctx.fill();
  // cône volcanique
  ctx.fillStyle = '#2a1512';
  ctx.beginPath();
  ctx.moveTo(-p.r * 3.4, baseY + p.r * 0.6);
  ctx.quadraticCurveTo(-p.r * 1.1, baseY - p.r * 2.4, 0, baseY - p.r * 2.7);
  ctx.quadraticCurveTo(p.r * 1.1, baseY - p.r * 2.4, p.r * 3.4, baseY + p.r * 0.6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#120806'; ctx.lineWidth = 2.5; ctx.stroke();
  // lèvre du cratère + lave qui bouillonne
  ctx.fillStyle = '#ff7043';
  ctx.beginPath(); ctx.ellipse(0, baseY - p.r * 2.45, p.r * 1.15, p.r * 0.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd740';
  ctx.beginPath(); ctx.ellipse(0, baseY - p.r * 2.5, p.r * 0.68, p.r * 0.24, 0, 0, TAU); ctx.fill();
  // braises qui montent (positions déterministes, fonction de prog)
  for (let i = 0; i < 18; i++) {
    const speed = 0.7 + (i % 5) * 0.16;
    const ph = (prog * speed + i * 0.37) % 1;
    const ex = Math.sin(i * 7.3 + prog * 9) * p.r * (0.6 + ph * 1.5);
    const ey = baseY - p.r * 2.5 - ph * p.r * 5.6;
    ctx.globalAlpha = (1 - ph) * 0.9;
    ctx.fillStyle = i % 3 === 0 ? '#ffd740' : '#ff7043';
    ctx.beginPath(); ctx.arc(ex, ey, 2.6 - ph, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // panache de fumée sombre
  for (let i = 0; i < 6; i++) {
    const ph = (prog * 0.5 + i * 0.22) % 1;
    const sx = Math.sin(i * 4.1 + prog * 6) * p.r * 1.1 * ph;
    ctx.globalAlpha = ph * 0.35 * (1 - prog * 0.4);
    ctx.fillStyle = '#3e2723';
    ctx.beginPath(); ctx.ellipse(sx, baseY - p.r * 2.7 - ph * p.r * 6.5, p.r * (0.7 + ph * 1.1), p.r * (0.45 + ph * 0.75), 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawPlayer() {
  const p = G.player;
  // cinématique de mort : le héros bascule puis s'effondre en s'estompant
  const dying = !p.alive;
  const dk = dying ? Math.min(1, Math.max(0, 1 - G.deathT / 1.8)) : 0;
  const angle = playerAngle();

  // apparition selon la campagne : chute céleste (Terres Oubliées),
  // glacon qui fond (Terre Gelée), volcan en éruption (Les Enfers)
  const intro = G.state === 'intro';
  const camp = G.campaign || 0;
  // TITAN DE FEU : transformation de l'ultime infernale (10 s)
  const titan = !dying && !intro && p.ultActive > 0;
  let fall = 0, introScale = 1, introProg = 0;
  if (intro) {
    introProg = Math.min(1, 1 - G.cloudT / 3);
    const prog = introProg;
    const e = 1 - Math.pow(1 - prog, 3); // easeOutCubic : arrive doucement
    if (camp === 1) {
      // LE GLACON : le héros grandit hors d'un bloc de glace qui fond
      introScale = 0.4 + 0.6 * e;
      drawIceSpawn(p.x, p.y, prog);
    } else if (camp === 2) {
      // LE VOLCAN : le héros est projeté hors du cratère puis retombe
      fall = -Math.sin(prog * Math.PI) * 170;
      drawVolcanoSpawn(p.x, p.y, prog);
      G.screenShake = Math.max(G.screenShake, 3 + Math.sin(prog * 40) * 2);
    } else {
      fall = -(1 - e) * (H * 0.95);
    // colonne de lumière dorée reliant le ciel au héros
    const beamEnd = Math.max(0, p.y + fall);
    const bg = ctx.createLinearGradient(p.x, 0, p.x, beamEnd);
    bg.addColorStop(0, `rgba(255,230,150,${0.28 * (1 - prog * 0.4)})`);
    bg.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(p.x - 26, 0, 52, beamEnd);
    // nuages traînants qui l'entourent pendant la chute
    for (let i = 0; i < 4; i++) {
      const a = prog * TAU * 2 + i * TAU / 4;
      const cx = p.x + Math.cos(a) * (26 + i * 11);
      const cy = p.y + fall + Math.sin(a) * 16 + 15;
      ctx.globalAlpha = 0.5 * (1 - prog * 0.35);
      ctx.fillStyle = '#eef2f6';
      ctx.beginPath(); ctx.ellipse(cx, cy, 15 - i * 2, 7 - i, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // poussière d'atterrissage en toute fin de chute
    if (prog > 0.82) {
      const lp = (prog - 0.82) / 0.18;
      ctx.globalAlpha = 0.55 * (1 - lp);
      ctx.fillStyle = '#d7ccc8';
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * (16 + lp * 48), p.y + 12 + lp * 9, 9 * (1 - lp) + 3, 4.5, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    }
  }

  // ombre au sol (s'estompe pendant la chute)
  if (fall > -30) drawShadow(p.x, p.y, p.r * (1 + fall / H * 2));

  // dôme de bouclier : bulle d'énergie bleutée pendant 2,5s
  if (!dying && p.shieldT > 0) {
    const prog = p.shieldT / 3; // 1 -> 0
    const R = 105;
    const dg = ctx.createRadialGradient(p.x, p.y, p.r, p.x, p.y, R);
    dg.addColorStop(0, `rgba(79,195,247,${0.05 + prog * 0.05})`);
    dg.addColorStop(0.8, `rgba(79,195,247,${0.12 + prog * 0.1})`);
    dg.addColorStop(1, `rgba(79,195,247,${0.28 * prog})`);
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
    // arc du dôme + liseré lumineux
    ctx.strokeStyle = `rgba(179,229,252,${0.35 + prog * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * prog})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, R - 4, 0, TAU); ctx.stroke();
    // mini bouclier flottant au sommet du dôme
    ctx.save();
    ctx.translate(p.x, p.y - R - 6 + Math.sin(G.time * 3) * 3);
    ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
    ctx.restore();
  }

  // attaque rotative en cours
  if (!dying && p.spinDuration > 0) drawSpinAnim();

  // teinte bleue quand le joueur est ralenti
  if (!dying && p.slowT > 0) {
    ctx.globalAlpha = Math.min(0.5, p.slowT * 0.4);
    ctx.fillStyle = '#40c4ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(p.x, p.y + fall);
  if (titan) ctx.scale(1.62, 1.62); // le titan est plus massif
  // glacon : le héros grandit depuis le bloc de glace (pieds ancrés)
  if (introScale !== 1) {
    ctx.translate(0, p.r * 0.9); ctx.scale(introScale, introScale); ctx.translate(0, -p.r * 0.9);
  }
  // volcan : le héros se matérialise hors de la fumée pendant sa projection
  if (intro && camp === 2) ctx.globalAlpha = Math.min(1, introProg * 6);
  if (dying) {
    // pivot aux pieds : le héros bascule sur le côté puis s'enfonce et s'efface
    ctx.translate(0, p.r * 0.9);
    ctx.rotate(dk * Math.PI * 0.48 * (G.deathDir || 1));
    ctx.translate(0, -p.r * 0.9 + dk * 10);
    ctx.globalAlpha = dk < 0.55 ? 1 : Math.max(0, 1 - (dk - 0.55) / 0.45);
  }

  // bottes du héros : toujours visibles, animées en marchant, pose idle sinon
  {
    const k = G.keys;
    const moving = !dying && !intro && (k['z'] || k['s'] || k['q'] || k['d'] ||
      k['arrowup'] || k['arrowdown'] || k['arrowleft'] || k['arrowright']);
    if (!dying && !intro) {
      const step = moving ? Math.sin(G.time * 11) * 3 : Math.sin(G.time * 2.2) * 0.8;
      ctx.fillStyle = '#0d1b33';
      for (const s of [-1, 1]) {
        const fx = s * 7, fy = p.r * 0.82 + (s > 0 ? step : -step) * 0.6;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 6.5, 8.5, 0, 0, TAU); ctx.fill();
        // revers doré
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(fx - 6.5, fy - 4, 13, 2.4);
        ctx.fillStyle = '#0d1b33';
      }
    }
  }

  // TITAN DE FEU : aura incandescente + flammes qui s'élèvent du corps
  if (titan) {
    const pulse = 0.8 + Math.sin(G.time * 6) * 0.2;
    // grande aura de braise
    const ag = ctx.createRadialGradient(0, 0, p.r * 0.4, 0, 0, p.r * 3.0);
    ag.addColorStop(0, `rgba(255,140,40,${0.5 * pulse})`);
    ag.addColorStop(0.45, `rgba(255,70,15,${0.28 * pulse})`);
    ag.addColorStop(0.75, `rgba(200,40,5,${0.12 * pulse})`);
    ag.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(0, 0, p.r * 3.0, 0, TAU); ctx.fill();
    // anneau de runes incandescantes qui tourne autour du titan
    ctx.save();
    ctx.rotate(G.time * 1.4);
    ctx.strokeStyle = `rgba(255,160,60,${0.5 + Math.sin(G.time * 6) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath(); ctx.arc(0, 0, p.r * 1.7, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      const rx = Math.cos(a) * p.r * 1.7, ry = Math.sin(a) * p.r * 1.7;
      ctx.fillStyle = '#ffd740';
      ctx.save();
      ctx.translate(rx, ry); ctx.rotate(a + Math.PI / 2);
      ctx.fillRect(-2.5, -5, 5, 10);
      ctx.restore();
    }
    ctx.restore();
    // flammes imposantes autour du corps
    for (let i = 0; i < 9; i++) {
      const a = G.time * 2.2 + i * TAU / 9;
      const fx = Math.cos(a) * p.r * 0.95, fy = Math.sin(a) * p.r * 0.55 - p.r * 0.5;
      const fh = 14 + Math.sin(G.time * 9 + i * 2) * 6;
      const fg = ctx.createLinearGradient(fx, fy, fx, fy - fh);
      fg.addColorStop(0, 'rgba(255,87,34,0.85)');
      fg.addColorStop(0.6, 'rgba(255,171,64,0.7)');
      fg.addColorStop(1, 'rgba(255,235,140,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fx - 6, fy);
      ctx.quadraticCurveTo(fx - 2, fy - fh * 0.6, fx, fy - fh);
      ctx.quadraticCurveTo(fx + 2, fy - fh * 0.6, fx + 6, fy);
      ctx.closePath(); ctx.fill();
    }
    // sueur de lave : braises qui s'échappent
    if (Math.random() < 0.7) {
      G.particles.push({
        x: p.x + (Math.random() - 0.5) * p.r * 1.4, y: p.y - p.r * 0.7,
        vx: (Math.random() - 0.5) * 2, vy: -2.5 - Math.random() * 3,
        life: 26, maxLife: 26,
        color: Math.random() < 0.55 ? '#ff7043' : '#ffd740',
        r: 2 + Math.random() * 2.5
      });
    }
  }

  // corps : armure de chevalier dégradé acier -> bleu nuit
  // (en titan de feu : magma -> braise -> charbon)
  const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, p.r + 4);
  if (titan) {
    g.addColorStop(0, '#ffcc80'); g.addColorStop(0.45, '#ff5722'); g.addColorStop(1, '#5d1303');
  } else {
    g.addColorStop(0, '#a8d0f0'); g.addColorStop(0.45, '#4a7ec2'); g.addColorStop(1, '#16386e');
  }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
  // craquelures de magma incandescantes sur le corps du titan
  if (titan) {
    ctx.strokeStyle = 'rgba(255,120,30,0.85)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const a0 = i * 1.9 + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * p.r * 0.25, Math.sin(a0) * p.r * 0.25 - p.r * 0.1);
      ctx.lineTo(Math.cos(a0 + 0.35) * p.r * 0.55, Math.sin(a0 + 0.35) * p.r * 0.55);
      ctx.lineTo(Math.cos(a0 + 0.15) * p.r * 0.85, Math.sin(a0 + 0.15) * p.r * 0.85);
      ctx.stroke();
      // lueur au fond des craquelures
      ctx.strokeStyle = 'rgba(255,220,120,0.9)'; ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,30,0.85)'; ctx.lineWidth = 1.6;
    }
    // cœur de lave pulsé au centre
    const core = ctx.createRadialGradient(0, p.r * 0.1, 1, 0, p.r * 0.1, p.r * 0.55);
    core.addColorStop(0, `rgba(255,235,140,${0.75 + Math.sin(G.time * 8) * 0.2})`);
    core.addColorStop(0.5, 'rgba(255,110,30,0.4)');
    core.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, p.r * 0.1, p.r * 0.55, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = '#0a2a55'; ctx.lineWidth = 2.5; ctx.stroke();
  // bordure dorée fine
  ctx.strokeStyle = 'rgba(255,215,64,0.55)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, p.r - 2, 0, TAU); ctx.stroke();
  // reflet d'armure
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(-4, -6, p.r * 0.45, p.r * 0.28, -0.6, 0, TAU); ctx.fill();
  // ceinture dorée (ceinture de braise pour le titan)
  ctx.fillStyle = titan ? '#ff7043' : '#ffd740';
  ctx.fillRect(-p.r, p.r * 0.25, p.r * 2, 4);
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(-3, p.r * 0.25, 6, 4); // boucle

  // épaulières (avant la rotation de l'épée)
  for (const s of [-1, 1]) {
    const px2 = s * p.r * 0.72, py2 = p.r * 0.05;
    const pg = ctx.createRadialGradient(px2 - 2, py2 - 2, 1, px2, py2, 7);
    pg.addColorStop(0, '#eceff1'); pg.addColorStop(1, '#78909c');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(px2, py2, 6.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // couronne royale (flamme royale géante pour le titan)
  ctx.save();
  ctx.translate(0, -p.r * 0.92);
  if (titan) {
    // bande de braise incandescente
    ctx.fillStyle = '#ff5722';
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.5;
    ctx.fillRect(-9, -3, 18, 7);
    ctx.strokeRect(-9, -3, 18, 7);
    // 5 flammes de feu au lieu des pics
    for (let i = -2; i <= 2; i++) {
      const fx = i * 3.6;
      const fh = 10 + (2 - Math.abs(i)) * 3 + Math.sin(G.time * 8 + i) * 2;
      const fg = ctx.createLinearGradient(fx, -3, fx, -3 - fh);
      fg.addColorStop(0, '#ff5722'); fg.addColorStop(0.6, '#ffb74d'); fg.addColorStop(1, '#fff9c4');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fx - 3.4, -3);
      ctx.quadraticCurveTo(fx - 1, -3 - fh * 0.65, fx, -3 - fh);
      ctx.quadraticCurveTo(fx + 1, -3 - fh * 0.65, fx + 3.4, -3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,64,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // gemme de feu
    ctx.fillStyle = '#ffd740';
    ctx.beginPath(); ctx.arc(0, 1, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff3d00';
    ctx.beginPath(); ctx.arc(0, 1, 1.6, 0, TAU); ctx.fill();
    ctx.restore();
  } else {
  ctx.fillStyle = titan ? '#ff7043' : '#ffd740';
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1;
  // bande
  ctx.fillRect(-8, -2, 16, 6);
  ctx.strokeRect(-8, -2, 16, 6);
  // 3 pics
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 6 - 3, -2); ctx.lineTo(i * 6, -9); ctx.lineTo(i * 6 + 3, -2);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // gemme centrale
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.arc(0, 1, 2.2, 0, TAU); ctx.fill();
  ctx.restore();
  }

  // yeux vers le curseur (flamboyants pour le titan)
  const ex = Math.cos(angle) * 3, ey = Math.sin(angle) * 3;
  if (titan) {
    // lueur de feu autour des yeux
    ctx.fillStyle = 'rgba(255,140,30,0.55)';
    ctx.beginPath(); ctx.arc(-5 + ex, -2 + ey, 5.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(5 + ex, -2 + ey, 5.6, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = titan ? '#fff59d' : '#fff';
  ctx.beginPath(); ctx.arc(-5 + ex, -2 + ey, 3.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(5 + ex, -2 + ey, 3.4, 0, TAU); ctx.fill();
  ctx.fillStyle = titan ? '#ff3d00' : '#111';
  ctx.beginPath(); ctx.arc(-5 + ex * 1.5, -2 + ey * 1.5, 1.7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(5 + ex * 1.5, -2 + ey * 1.5, 1.7, 0, TAU); ctx.fill();

  // bouclier (mode 3 : tank) — sur le bras gauche, ne pivote pas
  if (p.attackMode === 3) {
    const bx = -p.r * 0.72, by = p.r * 0.4;
    const sg = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 9);
    sg.addColorStop(0, '#eceff1'); sg.addColorStop(1, '#546e7a');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(bx, by, 8.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2; ctx.stroke();
    // croix du bouclier
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx - 5, by); ctx.lineTo(bx + 5, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by - 5); ctx.lineTo(bx, by + 5); ctx.stroke();
    ctx.fillStyle = '#1565c0';
    ctx.beginPath(); ctx.arc(bx, by, 2, 0, TAU); ctx.fill();
  }

  // arme : épée ou lance selon le mode, pointe vers le curseur
  // (absente pendant l'intro céleste et pour le titan : il frappe au laser)
  if (!intro && !titan) {
  let swordAngle = angle;
  if (p.attackMode !== 3 && p.attackCooldown > 0.25) {
    const t = 1 - (p.attackCooldown - 0.25) / 0.15; // 0->1
    swordAngle = angle - p.attackArc / 2 + p.attackArc * Math.min(1, t);
  }
  ctx.rotate(swordAngle);
  if (p.attackMode === 3) {
    // lance : jaillit vers l'avant pendant l'estoc (extension = cooldown restant)
    const ext = p.attackCooldown > 0 ? Math.min(1, p.attackCooldown / 0.32) : 0;
    ctx.save();
    ctx.translate(ext * 18, 0);
    // hampe : dégradé bois -> acier avec cerclages dorés
    const shaftG = ctx.createLinearGradient(p.r - 8, -4, p.r + 64, 4);
    shaftG.addColorStop(0, '#4e342e'); shaftG.addColorStop(0.45, '#8d6e63');
    shaftG.addColorStop(0.8, '#90a4ae'); shaftG.addColorStop(1, '#cfd8dc');
    ctx.strokeStyle = shaftG; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.r - 10, 0); ctx.lineTo(p.r + 64, 0); ctx.stroke();
    // viroles dorées
    ctx.fillStyle = '#ffd740';
    ctx.fillRect(p.r + 6, -3.4, 3.4, 6.8);
    ctx.fillRect(p.r + 38, -3.4, 3.4, 6.8);
    // douille + pointe de lance effilée et lumineuse
    const tipG = ctx.createLinearGradient(p.r + 60, -7, p.r + 82, 0);
    tipG.addColorStop(0, '#78909c'); tipG.addColorStop(0.55, '#eceff1'); tipG.addColorStop(1, '#ffffff');
    ctx.fillStyle = tipG;
    ctx.beginPath();
    ctx.moveTo(p.r + 62, -5); ctx.lineTo(p.r + 80, 0); ctx.lineTo(p.r + 62, 5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#546e7a'; ctx.lineWidth = 1; ctx.stroke();
    // lueur de la pointe (s'intensifie pendant l'estoc)
    ctx.fillStyle = `rgba(255,236,160,${0.55 + ext * 0.45})`;
    ctx.beginPath(); ctx.arc(p.r + 76, 0, 2.6 + ext * 2.4, 0, TAU); ctx.fill();
    // petit fanion rouge au bout de la hampe
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.r + 14, 0); ctx.lineTo(p.r + 14, -15); ctx.stroke();
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.moveTo(p.r + 14, -15); ctx.lineTo(p.r + 29, -11.5); ctx.lineTo(p.r + 14, -8); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else {
  // lame : fuller central + liseré doré
  const bladeLen = 56;
  const bg = ctx.createLinearGradient(p.r, 0, p.r + bladeLen, 0);
  bg.addColorStop(0, '#546e7a'); bg.addColorStop(0.4, '#f5f7fa'); bg.addColorStop(0.7, '#eceff1'); bg.addColorStop(1, '#90a4ae');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(p.r - 4, -4.5); ctx.lineTo(p.r + bladeLen, -3);
  ctx.lineTo(p.r + bladeLen + 12, 0); ctx.lineTo(p.r + bladeLen, 3);
  ctx.lineTo(p.r - 4, 4.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.5; ctx.stroke();
  // fuller (rainure centrale)
  ctx.strokeStyle = 'rgba(55,71,79,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(p.r + 2, 0); ctx.lineTo(p.r + bladeLen + 6, 0); ctx.stroke();
  // liseré doré sur le tranchant
  ctx.strokeStyle = 'rgba(255,215,64,0.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(p.r - 2, -4); ctx.lineTo(p.r + bladeLen + 9, -1.8); ctx.stroke();
  // garde ornée + poignée + pommeau
  ctx.fillStyle = '#ffd740';
  ctx.beginPath();
  ctx.moveTo(p.r - 9, -8); ctx.lineTo(p.r - 4, -8); ctx.lineTo(p.r - 4, 8); ctx.lineTo(p.r - 9, 8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1; ctx.stroke();
  // gemme de la garde
  ctx.fillStyle = '#1565c0';
  ctx.beginPath(); ctx.arc(p.r - 6.5, 0, 2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5d4037'; ctx.fillRect(p.r - 17, -3, 8, 6);
  ctx.fillStyle = '#ffd740';
  ctx.beginPath(); ctx.arc(p.r - 19, 0, 3, 0, TAU); ctx.fill();
  } // fin arme épée
  } // fin bloc arme (masqué pendant l'intro)
  ctx.restore();
}

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
