import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { drawFrozenEnemy } from './enemy_ice.js';
import { drawHellEnemy } from './enemy_hell.js';
import { drawSewerEnemy } from './enemy_sewer.js';
import { drawSpaceEnemy } from './enemy_space.js';
import { drawStormEnemy } from './enemy_storm.js';


export function drawShadow(x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r * 0.9, r * 0.35, 0, 0, TAU); ctx.fill();
}

export function drawEnemy(e) {
  const p = G.player;
  const isFinal = e.type === 'finalBoss' || e.type === 'finalBossGlace' || e.type === 'finalBossEnfer'
    || e.type === 'finalBossEgout' || e.type === 'finalBossSpace' || e.type === 'finalBossTempete';
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
    const sewer = e.type === 'finalBossEgout';
    const space = e.type === 'finalBossSpace';
    const storm = e.type === 'finalBossTempete';
    const tcol = frozen ? '129,212,250' : hell ? '255,171,0' : sewer ? '174,234,0' : space ? '179,157,219' : storm ? '79,195,247' : '255,112,67';
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
    const col = frozen ? '#80d8ff' : e.type === 'finalBossEnfer' ? '#ffab00'
      : e.type === 'finalBossEgout' ? '#aeea00' : e.type === 'finalBossSpace' ? '#b388ff'
      : e.type === 'finalBossTempete' ? '#4fc3f7' : '#e040fb';
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
    const col = e.type === 'finalBossGlace' ? '129,212,250' : e.type === 'finalBossEnfer' ? '255,171,0'
      : e.type === 'finalBossEgout' ? '174,234,0' : e.type === 'finalBossSpace' ? '179,157,219'
      : e.type === 'finalBossTempete' ? '79,195,247' : '224,64,251';
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
    ctx.closePath(); ctx.fill();  } else if (e.type === 'yeti' || e.type === 'hunter' || e.type === 'alpha' ||
             e.type === 'glacier' || e.type === 'crypt' ||
             e.type === 'bossGlace' || e.type === 'bossCryo' || e.type === 'finalBossGlace') {
    drawFrozenEnemy(e);
  } else if (['imp', 'hound', 'cultist', 'demon', 'golemEnf', 'bossEnf', 'priest', 'finalBossEnfer'].includes(e.type)) {
    drawHellEnemy(e);
  } else if (['rat', 'vase', 'crapaud', 'ver', 'chanter', 'matriarche', 'bossEgout', 'finalBossEgout'].includes(e.type)) {
    drawSewerEnemy(e);
  } else if (['alien', 'drone', 'tentacule', 'cristal', 'overlord', 'bossVoid', 'finalBossSpace'].includes(e.type)) {
    drawSpaceEnemy(e);
  } else if (['courant', 'rafale', 'esprit', 'gardien', 'colosse', 'bossOuragan', 'finalBossTempete'].includes(e.type)) {
    drawStormEnemy(e);
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
    const col = e.type === 'finalBossGlace' ? '129,212,250' : e.type === 'finalBossEnfer' ? '255,171,0'
      : e.type === 'finalBossEgout' ? '174,234,0' : e.type === 'finalBossSpace' ? '179,157,219'
      : e.type === 'finalBossTempete' ? '79,195,247' : '224,64,251';
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
