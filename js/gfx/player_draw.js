import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';
import { drawShadow } from './enemies_draw.js';

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

// bulle de vase toxique dont le héros sort (Égouts) : le blob vert se
// déchire et éclate en gouttes pendant que le héros grandit
function drawSewerSpawn(x, y, prog) {
  const p = G.player;
  const R = p.r * 1.5 * (1.2 - prog * 0.45);
  let alpha = 0.9;
  if (prog > 0.5) alpha *= Math.max(0, 1 - (prog - 0.5) / 0.45);
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  const sq = 1 + Math.sin(prog * 18) * 0.08;
  ctx.scale(1 / sq, sq);
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, 4, 0, 0, R);
  g.addColorStop(0, '#c5e1a5'); g.addColorStop(0.55, '#7cb342'); g.addColorStop(1, '#33691e');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.9, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 3; ctx.stroke();
  // reflets visqueux
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.ellipse(-R * 0.35, -R * 0.4, R * 0.22, R * 0.13, -0.5, 0, TAU); ctx.fill();
  // bulles internes
  ctx.fillStyle = 'rgba(220,231,117,0.5)';
  for (let i = 0; i < 4; i++) {
    const bx = Math.sin(prog * 12 + i * 2.4) * R * 0.5;
    const by = Math.cos(prog * 9 + i * 1.8) * R * 0.35;
    ctx.beginPath(); ctx.arc(bx, by, R * 0.08, 0, TAU); ctx.fill();
  }
  // éclats toxiques en fin de percée
  if (prog > 0.55) {
    const dp = (prog - 0.55) / 0.45;
    ctx.fillStyle = `rgba(212,255,80,${0.8 * (1 - dp * 0.4)})`;
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + 0.4;
      const dx = Math.cos(a) * (R * 0.7 + dp * 70);
      const dy = Math.sin(a) * (R * 0.6 + dp * 55);
      ctx.beginPath(); ctx.arc(dx, dy, 3.5 * (1 - dp * 0.5), 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// capsule de stase dont le héros sort (Espace) : dalle violette, rayon
// d'énergie montant, le héros matérialisé sous le faisceau
function drawSpaceSpawn(x, y, prog) {
  const p = G.player;
  // rayon d'énergie vertical
  const beamH = p.r * 6;
  const bg = ctx.createLinearGradient(x, y - beamH, x, y);
  bg.addColorStop(0, 'rgba(179,157,219,0)');
  bg.addColorStop(0.7, `rgba(179,157,219,${0.4 * (1 - prog * 0.5)})`);
  bg.addColorStop(1, `rgba(227,190,231,${0.55 * (1 - prog * 0.3)})`);
  ctx.fillStyle = bg;
  ctx.fillRect(x - 30, y - beamH, 60, beamH);
  // points d'énergie qui montent dans le rayon
  for (let i = 0; i < 8; i++) {
    const ph = (prog * 0.9 + i * 0.13) % 1;
    const yy = y - ph * beamH;
    const xx = x + Math.sin(i * 3.7 + prog * 8) * 18 * (1 - ph * 0.5);
    ctx.globalAlpha = (1 - prog * 0.4) * 0.8;
    ctx.fillStyle = i % 2 ? '#e1bee7' : '#80d8ff';
    ctx.beginPath(); ctx.arc(xx, yy, 2.4 - ph, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // dalle de la capsule (s'estompe)
  let alpha = 0.9;
  if (prog > 0.4) alpha *= Math.max(0, 1 - (prog - 0.4) / 0.5);
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  const R = p.r * 1.35;
  // dalle octogonale
  ctx.fillStyle = '#1a1033';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + TAU / 16;
    const rr = R * (i % 2 ? 0.82 : 1);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.9;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 3; ctx.stroke();
  // fenêtre lumineuse centrale
  const wg = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 0.5);
  wg.addColorStop(0, '#e1bee7'); wg.addColorStop(0.6, '#7e57c2'); wg.addColorStop(1, 'rgba(74,20,140,0)');
  ctx.fillStyle = wg;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, TAU); ctx.fill();
  // joints de la dalle
  ctx.strokeStyle = 'rgba(179,157,219,0.6)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + TAU / 8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.72); ctx.stroke();
  }
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
    } else if (camp === 3) {
      // LA BULLE DE VASE : le héros sort d'une poche de vase toxique
      introScale = 0.45 + 0.55 * e;
      drawSewerSpawn(p.x, p.y, prog);
    } else if (camp === 4) {
      // LA CAPSULE DE STASE : le héros descend sous un rayon d'énergie
      fall = -(1 - e) * 130;
      drawSpaceSpawn(p.x, p.y + fall, prog);
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

