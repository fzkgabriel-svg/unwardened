import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';

// Intro cinématique : les nuages s'ouvrent en 3 couches pour révéler le monde
export function drawClouds() {
  if (G.cloudT <= 0 || G.state === 'menu') return;
  const DUR = 3;
  const prog = Math.min(1, 1 - G.cloudT / DUR); // 0 -> 1
  const ease = t => 1 - Math.pow(1 - t, 3);    // easeOutCubic

  // l'apparition change selon la campagne : brume givrée ou fumée infernale
  const camp = G.campaign || 0;
  if (camp === 1) { drawIceVeil(prog, ease); return; }
  if (camp === 2) { drawHellVeil(prog, ease); return; }

  // voile assombrissant le monde pendant l'ouverture
  ctx.fillStyle = `rgba(5,8,15,${0.45 * (1 - prog)})`;
  ctx.fillRect(0, 0, W, H);

  // halo central doré qui grandit à mesure que les nuages s'écartent
  const glowR = 120 + prog * 520;
  const gg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, glowR);
  gg.addColorStop(0, `rgba(255,225,150,${0.5 * prog})`);
  gg.addColorStop(0.6, `rgba(255,200,100,${0.18 * prog})`);
  gg.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, glowR, 0, TAU); ctx.fill();

  // 9 nuages à 3 profondeurs : petit/lointain part vite, grand/proche part lentement
  for (let i = 0; i < 9; i++) {
    const depth = i % 3;                    // 0 proche, 1 moyen, 2 lointain
    const stagger = depth * 0.12 + (i % 3) * 0.03;
    const t = Math.max(0, Math.min(1, (prog - stagger) / (1 - stagger)));
    if (t <= 0) continue;
    const e = ease(t);
    const dir = (i % 2 === 0 ? -1 : 1) * (depth === 2 ? 0.7 : 1); // les lointains partent moins loin
    const cx = W / 2 + dir * e * (560 + depth * 120) + Math.sin(i * 2.7) * 40 * (1 - e);
    const cy = H * (0.1 + ((i * 37) % 80) / 100) + (depth - 1) * 30;
    const s = (0.55 + depth * 0.35) * (1 + e * 0.3);
    const alpha = Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (1 - Math.pow(e, 3) * 0.85);

    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate((i % 2 ? 1 : -1) * e * 0.08);
    ctx.globalAlpha = alpha;

    // dégradé radial : cœur blanc -> bords transparents (nuage feutré)
    const ng = ctx.createRadialGradient(0, -10, 10, 0, 0, 110);
    ng.addColorStop(0, 'rgba(255,255,255,0.95)');
    ng.addColorStop(0.55, 'rgba(235,242,248,0.85)');
    ng.addColorStop(1, 'rgba(210,222,235,0)');
    ctx.fillStyle = ng;
    // amas de 5 ellipses
    ctx.beginPath(); ctx.ellipse(0, 0, 80, 36, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-52, 8, 48, 26, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(52, 8, 48, 26, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-25, -18, 45, 26, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(28, -16, 48, 28, 0, 0, TAU); ctx.fill();
    // ombre bleutée sous le nuage
    ctx.fillStyle = 'rgba(140,155,175,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 30, 85, 14, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------- Voiles d'intro par campagne ----------
// campagne 2 (Terre Gelée) : brumes blanches qui s'écartent + neige
function drawIceVeil(prog, ease) {
  ctx.fillStyle = `rgba(214,235,250,${0.55 * (1 - prog)})`;
  ctx.fillRect(0, 0, W, H);
  // halo central glacé qui grandit
  const glowR = 140 + prog * 480;
  const gg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, glowR);
  gg.addColorStop(0, `rgba(190,230,255,${0.5 * prog})`);
  gg.addColorStop(1, 'rgba(160,210,250,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, glowR, 0, TAU); ctx.fill();
  // bancs de brume à 3 profondeurs qui s'écartent
  for (let i = 0; i < 8; i++) {
    const depth = i % 3;
    const stagger = depth * 0.12 + (i % 3) * 0.03;
    const t = Math.max(0, Math.min(1, (prog - stagger) / (1 - stagger)));
    if (t <= 0) continue;
    const e2 = ease(t);
    const dir = (i % 2 === 0 ? -1 : 1) * (depth === 2 ? 0.6 : 1);
    const cx = W / 2 + dir * e2 * (520 + depth * 110) + Math.sin(i * 2.3) * 50 * (1 - e2);
    const cy = H * (0.12 + ((i * 41) % 75) / 100) + (depth - 1) * 40;
    const s = (0.7 + depth * 0.35) * (1 + e2 * 0.25);
    const alpha = Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (1 - Math.pow(e2, 3) * 0.85);
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.globalAlpha = alpha;
    const ng = ctx.createRadialGradient(0, -8, 10, 0, 0, 120);
    ng.addColorStop(0, 'rgba(255,255,255,0.9)');
    ng.addColorStop(0.6, 'rgba(220,240,255,0.75)');
    ng.addColorStop(1, 'rgba(200,225,245,0)');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.ellipse(0, 0, 95, 40, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-55, 10, 50, 26, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(55, 10, 50, 26, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // flocons de neige qui tourbillonnent pendant l'ouverture
  for (let i = 0; i < 60; i++) {
    const fx = (i * 173.3) % W;
    const fy = (i * 97.7 + prog * 260 * (1 + (i % 3) * 0.3)) % H;
    ctx.globalAlpha = (1 - prog * 0.6) * (0.4 + ((i * 13) % 10) / 14);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(fx, fy, 1.4 + ((i * 7) % 3) * 0.5, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// campagne 3 (Les Enfers) : nappes de fumée sombre + braises montantes
function drawHellVeil(prog, ease) {
  ctx.fillStyle = `rgba(12,4,2,${0.6 * (1 - prog)})`;
  ctx.fillRect(0, 0, W, H);
  // lueur du volcan depuis le bas de l'écran
  const gg = ctx.createRadialGradient(W / 2, H * 0.95, 20, W / 2, H * 0.8, 520);
  gg.addColorStop(0, `rgba(255,120,30,${0.4 * prog + 0.15})`);
  gg.addColorStop(0.5, `rgba(200,60,10,${0.15 * prog})`);
  gg.addColorStop(1, 'rgba(120,20,0,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, 0, W, H);
  // nappes de fumée qui montent et s'écartent
  for (let i = 0; i < 9; i++) {
    const depth = i % 3;
    const stagger = depth * 0.12 + (i % 3) * 0.03;
    const t = Math.max(0, Math.min(1, (prog - stagger) / (1 - stagger)));
    if (t <= 0) continue;
    const e2 = ease(t);
    const dir = (i % 2 === 0 ? -1 : 1) * (depth === 2 ? 0.6 : 1);
    const cx = W / 2 + dir * e2 * (480 + depth * 100) + Math.sin(i * 3.1) * 45 * (1 - e2);
    const cy = H * 1.02 - ((i * 29) % 60) / 100 - e2 * (H * 0.5 + depth * 60);
    const s = (0.7 + depth * 0.35) * (1 + e2 * 0.3);
    const alpha = Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (0.5 + prog * 0.3);
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.globalAlpha = alpha * 0.8;
    const ng = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
    ng.addColorStop(0, 'rgba(50,25,15,0.95)');
    ng.addColorStop(0.6, 'rgba(35,15,10,0.8)');
    ng.addColorStop(1, 'rgba(20,8,5,0)');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.ellipse(0, 0, 90, 42, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-50, 8, 48, 24, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(50, 8, 48, 24, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // braises qui montent vers le ciel
  for (let i = 0; i < 50; i++) {
    const fx = (i * 211.7) % W;
    const rise = prog * H * 1.2 * (0.6 + ((i * 11) % 10) / 12);
    const fy = H + 20 - ((i * 67.3 + rise) % (H + 80));
    const flick = 0.5 + Math.sin(prog * 40 + i) * 0.5;
    ctx.globalAlpha = (1 - prog * 0.55) * flick * 0.9;
    ctx.fillStyle = i % 4 === 0 ? '#ffd740' : '#ff7043';
    ctx.beginPath(); ctx.arc(fx, fy, 1.3 + ((i * 5) % 3) * 0.6, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- Cinématique de l'ultime : B-2 Spirit + bombe atomique ----------
// L'avion et la bombe sont dessinés en coordonnées ÉCRAN (le ciel au-dessus du monde)
export function drawBomber() {
  const b = G.bomber;
  if (!b) return;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir, 1);
  // B-2 Spirit : aile volante furtive, silhouette noire
  ctx.fillStyle = '#14161c';
  ctx.beginPath();
  ctx.moveTo(98, 0);              // nez
  ctx.lineTo(20, -9);             // dos vers l'aile
  ctx.lineTo(-56, -30);           // extrémité de l'aile
  ctx.lineTo(-94, -7);            // queue
  ctx.lineTo(-94, 7);
  ctx.lineTo(-56, 30);
  ctx.lineTo(20, 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2c3140'; ctx.lineWidth = 1.5; ctx.stroke();
  // verrière
  ctx.fillStyle = '#123a5c';
  ctx.beginPath(); ctx.ellipse(52, -3, 13, 4.5, -0.12, 0, TAU); ctx.fill();
  // lignes de panneaux
  ctx.strokeStyle = 'rgba(90,110,140,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(70, -6); ctx.lineTo(10, -22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(70, 6); ctx.lineTo(10, 22); ctx.stroke();
  // post-combustion des réacteurs (faible lueur bleutée)
  const flick = 0.6 + Math.sin(G.time * 32) * 0.4;
  ctx.fillStyle = `rgba(120,200,255,${0.45 * flick})`;
  ctx.beginPath(); ctx.ellipse(-96, -3, 5, 2.4, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-96, 3, 5, 2.4, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // la bombe en chute : ogive détaillée, ailerons, gyrophare, vapeur
  const bd = b.bomb;
  if (b.phase !== 'fly' && bd) {
    ctx.save();
    ctx.translate(bd.x, bd.y);
    ctx.rotate(Math.sin(bd.w) * 0.1); // léger tangage en chute
    const blink = Math.sin(G.time * 18) > 0;
    // halo de vapeur autour de l'ogive
    const vg = ctx.createRadialGradient(0, -2, 2, 0, -2, 30);
    vg.addColorStop(0, 'rgba(255,255,255,0.32)');
    vg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = vg;
    ctx.beginPath(); ctx.ellipse(0, -2, 18, 26, 0, 0, TAU); ctx.fill();
    // lignes de vitesse au-dessus
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const ox of [-8, 0, 8]) {
      ctx.beginPath(); ctx.moveTo(ox, -38); ctx.lineTo(ox * 0.5, -24); ctx.stroke();
    }
    // ogive : nez en bas (sens de la chute), corps metallic gradient
    const bg2 = ctx.createLinearGradient(-9, 0, 9, 0);
    bg2.addColorStop(0, '#37474f'); bg2.addColorStop(0.5, '#90a4ae'); bg2.addColorStop(1, '#263238');
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.moveTo(0, 17);                    // nez
    ctx.quadraticCurveTo(8, 9, 8, -2);
    ctx.lineTo(8, -13); ctx.lineTo(-8, -13); ctx.lineTo(-8, -2);
    ctx.quadraticCurveTo(-8, 9, 0, 17);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0d1b24'; ctx.lineWidth = 1.5; ctx.stroke();
    // joint de ceinture + hachures de danger (pas de marquage type visée)
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(-8, -7, 16, 3.6);
    ctx.save();
    ctx.beginPath(); ctx.rect(-7, 0, 14, 7); ctx.clip();
    ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2.4;
    for (let i = -2; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * 6 - 2, 8); ctx.lineTo(i * 6 + 8, -1); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#212121'; ctx.lineWidth = 1;
    ctx.strokeRect(-7, 0, 14, 7);
    // gyrophare clignotant en queue
    if (blink) {
      ctx.fillStyle = '#ff1744';
      ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(0, -16, 2.8, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // ailerons de queue
    ctx.fillStyle = '#455a64';
    ctx.beginPath(); ctx.moveTo(-8, -13); ctx.lineTo(-15, -22); ctx.lineTo(-8, -18); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(15, -22); ctx.lineTo(8, -18); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3, -13); ctx.lineTo(-5, -24); ctx.lineTo(1, -24); ctx.lineTo(4, -13); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// position des nuages de la tempête (même formule que attacks.js)
function stormCloudXY(s, i, t) {
  const defs = [
    { ox: -0.42, oy: -0.80, sc: 1.0, sp: 0.45 },
    { ox: 0.05,  oy: -0.95, sc: 1.3, sp: 0.30 },
    { ox: 0.50,  oy: -0.72, sc: 0.85, sp: 0.55 }
  ];
  const d = defs[i % defs.length];
  return {
    x: s.x + d.ox * s.r + Math.sin(t * d.sp + i * 2.1) * s.r * 0.06,
    y: s.y + d.oy * s.r + Math.cos(t * d.sp * 0.8 + i) * s.r * 0.03,
    s: d.sc
  };
}

// ---------- ULTIME : PLUIE DE GLACE (coords monde) ----------
// zone glacée qui pulse + pics de glace en chute + sol enneigé + nuages
export function drawIceStorm() {
  const s = G.iceStorm;
  if (!s && !G.iceSpikes.length && !G.iceWalls.length && !G.shockwaves.length && !G.skyIcicles.length && !G.snowPatches.length) return;
  // SOL EN NEIGE : nappes blanches laissées par la Pluie de Glace (~25 s)
  for (const sp of G.snowPatches) {
    if (sp.life <= 0) continue;
    const a = Math.min(1, sp.life / 4) * 0.85; // fade en fin de vie
    ctx.save();
    ctx.globalAlpha = a;
    // nappe de neige : ellipse blanche à bordure bleutée
    const sg = ctx.createRadialGradient(sp.x, sp.y, sp.r * 0.3, sp.x, sp.y, sp.r);
    sg.addColorStop(0, '#f4faff');
    sg.addColorStop(0.75, '#dff1fc');
    sg.addColorStop(1, '#b8ddf2');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y, sp.r, sp.r * 0.62, 0, 0, TAU); ctx.fill();
    // congères : accumulateurs de neige aux bords
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 10; i++) {
      const ang = i * TAU / 10 + sp.x * 0.01;
      const dx = Math.cos(ang) * sp.r * 0.88, dy = Math.sin(ang) * sp.r * 0.55;
      const dr = 8 + ((i * 37 + sp.x) % 13);
      ctx.beginPath(); ctx.arc(sp.x + dx, sp.y + dy, dr, 0, TAU); ctx.fill();
    }
    // étincelles de givre (scintillements déterministes)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 22; i++) {
      const ang = i * 2.4 + sp.x;
      const dd = (i % 7) / 7 * sp.r * 0.85 + 8;
      const tw = 0.5 + 0.5 * Math.sin(G.time * 4 + i * 1.7);
      if (tw < 0.55) continue;
      ctx.beginPath();
      ctx.arc(sp.x + Math.cos(ang) * dd, sp.y + Math.sin(ang) * dd * 0.6, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // NUAGES de la tempête : masses blanches/bleues qui pleuvent sur la zone
  if (s) {
    for (let i = 0; i < 3; i++) {
      const c = stormCloudXY(s, i, G.time);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.s, c.s);
      // panache : 4 bouffées dégradées blanc -> bleu glacier
      const puff = (px, py, pr, shade) => {
        const cg2 = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.35, 2, px, py, pr);
        cg2.addColorStop(0, shade ? '#e3f4ff' : '#ffffff');
        cg2.addColorStop(0.7, shade ? '#b3dcf7' : '#dff0fc');
        cg2.addColorStop(1, 'rgba(179,220,247,0)');
        ctx.fillStyle = cg2;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
      };
      puff(-52, 6, 34, true); puff(0, -8, 42, false); puff(52, 4, 32, true); puff(18, 12, 30, false);
      // base bleutée + frange de pluie sous le nuage
      ctx.fillStyle = 'rgba(120,180,230,0.35)';
      ctx.beginPath(); ctx.ellipse(0, 22, 62, 10, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  if (s) {
    // dôme de givre : halo bleuté qui respire + bordure de glace
    const pulse = 0.10 + Math.sin(G.time * 3) * 0.04;
    const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.2, s.x, s.y, s.r);
    g.addColorStop(0, `rgba(179,229,252,${pulse})`);
    g.addColorStop(0.85, `rgba(79,195,247,${pulse * 0.7})`);
    g.addColorStop(1, 'rgba(129,212,250,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(224,242,254,${0.35 + Math.sin(G.time * 5) * 0.15})`;
    ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // compte à rebours de la tempête
    ctx.fillStyle = '#e1f5fe'; ctx.font = 'bold 15px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(`❄ ${Math.ceil(s.t)}s`, s.x, s.y - s.r - 14);
  }
  // pics de glace : lames allongées avec reflet
  for (const sp of G.iceSpikes) {
    const h = sp.r * 3.2;
    ctx.save();
    ctx.translate(sp.x, sp.y);
    const g2 = ctx.createLinearGradient(-sp.r, 0, sp.r, 0);
    g2.addColorStop(0, '#0277bd'); g2.addColorStop(0.5, '#b3e5fc'); g2.addColorStop(1, '#0288d1');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(0, -h); ctx.lineTo(sp.r * 0.55, 0); ctx.lineTo(-sp.r * 0.55, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, -h * 0.25); ctx.stroke();
    ctx.restore();
  }
  // STALACTITES GÉANTES : lames de glace facettées qui dévalent le ciel
  for (const c of G.skyIcicles) {
    const h = c.r * 5.2;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    // traînée glacée
    const tg = ctx.createLinearGradient(0, -h * 0.4, 0, h * 0.4);
    tg.addColorStop(0, 'rgba(179,229,252,0)');
    tg.addColorStop(1, 'rgba(179,229,252,0.4)');
    ctx.fillStyle = tg;
    ctx.fillRect(-c.r * 0.4, -h * 0.4, c.r * 0.8, h * 0.9);
    // corps : prisme allongé facetté
    const g4 = ctx.createLinearGradient(-c.r, 0, c.r, 0);
    g4.addColorStop(0, '#01579b'); g4.addColorStop(0.35, '#4fc3f7');
    g4.addColorStop(0.65, '#b3e5fc'); g4.addColorStop(1, '#0277bd');
    ctx.fillStyle = g4;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(c.r * 0.8, -h * 0.1);
    ctx.lineTo(c.r * 0.45, h * 0.28);
    ctx.lineTo(-c.r * 0.45, h * 0.28);
    ctx.lineTo(-c.r * 0.8, -h * 0.1);
    ctx.closePath(); ctx.fill();
    // facettes internes + reflet
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, h * 0.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-c.r * 0.8, -h * 0.1); ctx.lineTo(c.r * 0.8, -h * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-c.r * 0.45, h * 0.28); ctx.lineTo(c.r * 0.45, h * 0.28); ctx.stroke();
    // lueur au sommet
    ctx.fillStyle = 'rgba(224,242,254,0.9)';
    ctx.beginPath(); ctx.arc(0, -h * 0.92, c.r * 0.28, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // murs de glace du Souverain : dalles cristallines bleutées
  for (const wl of G.iceWalls) {
    const fade = Math.min(1, wl.life / 1.2); // apparaît et disparaît en fondu
    const bob = Math.sin(G.time * 2 + wl.x) * 2;
    ctx.save();
    ctx.globalAlpha = 0.55 + fade * 0.4;
    // bloc de glace facetté
    const g3 = ctx.createLinearGradient(wl.x - wl.r, wl.y, wl.x + wl.r, wl.y);
    g3.addColorStop(0, '#0277bd'); g3.addColorStop(0.5, '#b3e5fc'); g3.addColorStop(1, '#0288d1');
    ctx.fillStyle = g3;
    ctx.beginPath();
    ctx.moveTo(wl.x, wl.y - wl.r * 1.5 + bob);
    ctx.lineTo(wl.x + wl.r * 0.8, wl.y - wl.r * 0.3 + bob);
    ctx.lineTo(wl.x + wl.r * 0.6, wl.y + wl.r * 0.8);
    ctx.lineTo(wl.x - wl.r * 0.6, wl.y + wl.r * 0.8);
    ctx.lineTo(wl.x - wl.r * 0.8, wl.y - wl.r * 0.3 + bob);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    // facettes internes
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(wl.x, wl.y - wl.r * 1.5 + bob); ctx.lineTo(wl.x, wl.y + wl.r * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wl.x - wl.r * 0.8, wl.y - wl.r * 0.3 + bob); ctx.lineTo(wl.x + wl.r * 0.8, wl.y - wl.r * 0.3 + bob); ctx.stroke();
    ctx.restore();
  }
  // ondes de choc au sol : anneaux de débris qui s'étendent
  for (const s of G.shockwaves) {
    const a = Math.max(0, 1 - s.r / s.maxR);
    ctx.save();
    ctx.globalAlpha = 0.15 + a * 0.5;
    ctx.strokeStyle = s.color; ctx.lineWidth = 8 * a + 2;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.55, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 0.92, s.r * 0.5, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

// Champignon nuageux : dessiné en coordonnées MONDE (à l'impact)
export function drawMushroom() {
  const m = G.mushroom;
  if (!m) return;
  const t = m.t;
  const grow = Math.min(1, t / 1.3);
  const fade = t > 2.0 ? Math.max(0, 1 - (t - 2.0) / 0.8) : 1;
  const fire = Math.max(0, 1 - t / 0.9); // phase incandescente initiale
  const ease = 1 - Math.pow(1 - grow, 3);
  const capH = 95 * ease, capW = 150 * ease, stemH = 120 * ease, stemW = 42 * ease;
  ctx.save();
  ctx.globalAlpha = fade;
  const cy = m.y - stemH;
  // tige
  const sg = ctx.createLinearGradient(m.x, m.y, m.x, cy);
  sg.addColorStop(0, fire > 0 ? '#ffab91' : '#546e7a');
  sg.addColorStop(1, fire > 0 ? '#ffd740' : '#78909c');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(m.x - stemW / 2, m.y);
  ctx.quadraticCurveTo(m.x - stemW * 0.75, m.y - stemH * 0.6, m.x - stemW * 0.45, cy);
  ctx.lineTo(m.x + stemW * 0.45, cy);
  ctx.quadraticCurveTo(m.x + stemW * 0.75, m.y - stemH * 0.6, m.x + stemW / 2, m.y);
  ctx.closePath(); ctx.fill();
  // chapeau : choux-fleurs — dôme + bouffées irrégulières autour du bord
  const cg = ctx.createRadialGradient(m.x - capW * 0.15, cy - capH * 0.45, 8, m.x, cy, capW / 2);
  cg.addColorStop(0, fire > 0 ? '#fff9c4' : '#f4f7fa');
  cg.addColorStop(0.5, fire > 0 ? '#ffb74d' : '#c3ccd4');
  cg.addColorStop(1, fire > 0 ? '#ff5722' : '#78909c');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(m.x, cy, capW / 2, capH * 0.85, 0, 0, TAU); ctx.fill();
  // bouffées du chapeau (texture chou-fleur)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.35;
    const bx = m.x + Math.cos(a) * capW * 0.34;
    const by = cy + Math.sin(a) * capH * 0.5 - capH * 0.15;
    const br = capW * (0.1 + (i % 3) * 0.045) * ease;
    if (br < 2) continue;
    const bg2 = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, 1, bx, by, br);
    bg2.addColorStop(0, fire > 0 ? '#ffe082' : '#eceff1');
    bg2.addColorStop(1, fire > 0 ? '#ff7043' : '#90a4ae');
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
  }
  // dôme sommital
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(m.x, cy - capH * 0.5, capW * 0.34, capH * 0.45, 0, 0, TAU); ctx.fill();
  // sous-face ombrée du chapeau
  ctx.fillStyle = `rgba(40,30,20,${0.35 * fade})`;
  ctx.beginPath(); ctx.ellipse(m.x, cy + capH * 0.28, capW * 0.42, capH * 0.3, 0, 0, Math.PI); ctx.fill();
  // anneaux de la tige (segments de condensation)
  ctx.strokeStyle = fire > 0 ? 'rgba(255,220,150,0.6)' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    const ry2 = stemH * (i / 4.2);
    ctx.beginPath();
    ctx.ellipse(m.x, m.y - ry2, stemW * 0.55 * (1 - i * 0.12), 4.5, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}
