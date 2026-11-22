// js/menu/forge_fx.js — environnement de forge vivant (FORGE 2.0)
// Scène plein écran derrière le panneau de craft : foyer en pierre, feu
// multi-couches animé, braises, étincelles, fumée de cheminée, chaînes
// suspendues, lanterne vacillante, poussière dans les rais de lumière,
// éclairage dynamique synchronisé sur l'intensité des flammes.
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect } from '../utils.js';

// ---------- état des particules (persisté sur G entre les frames) ----------
function fx() {
  if (!G.forgeFx) {
    G.forgeFx = {
      lastT: G.time || 0,
      embers: [], sparks: [], smoke: [], motes: [],
      nextSpark: 0, nextPuff: 0, nextBurst: 0,
    };
    // poussière ambiante : positions fixes + dérive lente
    for (let i = 0; i < 26; i++) {
      G.forgeFx.motes.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.6 + Math.random() * 1.8, ph: Math.random() * TAU,
        sp: 2 + Math.random() * 7, tw: 0.5 + Math.random() * 2.2,
      });
    }
  }
  return G.forgeFx;
}

// position du foyer et de la cheminée (coordonnées scène)
const FIRE = () => ({ x: W * 0.20, y: H * 0.60, w: W * 0.16 });
const CHIMNEY = () => ({ x: W * 0.20, y: H * 0.16 });

// intensité globale du feu : somme de sinusoïdes non corrélées -> jamais de boucle visible
function fireLevel(t) {
  return 0.62
    + Math.sin(t * 2.1) * 0.10
    + Math.sin(t * 4.7 + 1.3) * 0.08
    + Math.sin(t * 9.3 + 4.1) * 0.06
    + Math.sin(t * 15.7 + 0.7) * 0.05
    + Math.sin(t * 27.1 + 2.9) * 0.04;
}

// ---- mise à jour des particules (appelée une fois par frame) ----
function updateFx(f, dt, glow) {
  const t = G.time;
  const fire = FIRE(), ch = CHIMNEY();

  // braises : naissent dans le foyer, montent avec oscillage, certaines sont éjectées
  if (f.embers.length < 46 && Math.random() < dt * (6 + glow * 26)) {
    const ex = fire.x + (Math.random() - 0.5) * fire.w * 0.7;
    f.embers.push({
      x: ex, y: fire.y - 6,
      vx: (Math.random() - 0.5) * 14,
      vy: -(26 + Math.random() * 55) * (0.7 + glow * 0.6),
      ph: Math.random() * TAU, life: 0, max: 2.2 + Math.random() * 2.6,
      r: 1 + Math.random() * 2.2, hot: Math.random(),
      spit: Math.random() < 0.22,
    });
  }
  for (let i = f.embers.length - 1; i >= 0; i--) {
    const e = f.embers[i];
    e.life += dt;
    const k = e.life / e.max;
    if (k >= 1) { f.embers.splice(i, 1); continue; }
    // oscillation latérale + léger ralentissement en montant
    e.x += (e.vx + Math.sin(t * 3 + e.ph) * 16) * dt;
    e.y += e.vy * (1 - k * 0.45) * dt;
    if (e.spit && k > 0.15) e.vy += 60 * dt; // les braises projetées retombent
    if (e.y < ch.y + 30) { e.vy = Math.abs(e.vy) * 0.2; } // plafond de fumée
  }

  // gerbes d'étincelles : rafales périodiques depuis le foyer et l'enclume
  if (t > f.nextBurst) {
    f.nextBurst = t + 0.5 + Math.random() * 0.9;
    const bx = Math.random() < 0.6 ? fire.x + (Math.random() - 0.5) * fire.w * 0.6 : W * 0.30;
    const by = Math.random() < 0.6 ? fire.y - 30 : H * 0.52;
    const n = 4 + (Math.random() * 6 | 0);
    for (let i = 0; i < n && f.sparks.length < 70; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const sp = 90 + Math.random() * 240;
      f.sparks.push({
        x: bx, y: by, px: bx, py: by,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: 0.35 + Math.random() * 0.55,
      });
    }
  }
  for (let i = f.sparks.length - 1; i >= 0; i--) {
    const s = f.sparks[i];
    s.life += dt;
    if (s.life >= s.max) { f.sparks.splice(i, 1); continue; }
    s.px = s.x; s.py = s.y;
    s.vy += 620 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.vx *= (1 - 1.6 * dt); // traînée qui s'éteint
  }

  // fumée : panaches depuis la cheminée, densité liée au feu
  if (f.smoke.length < 30 && Math.random() < dt * (2 + glow * 7)) {
    f.smoke.push({
      x: ch.x + (Math.random() - 0.5) * 26, y: ch.y,
      vx: 6 + Math.random() * 14 + glow * 12, vy: -(24 + Math.random() * 26),
      r: 12 + Math.random() * 8, grow: 9 + Math.random() * 12,
      life: 0, max: 3.6 + Math.random() * 2.4, ph: Math.random() * TAU,
      warm: Math.random(),
    });
  }
  for (let i = f.smoke.length - 1; i >= 0; i--) {
    const s = f.smoke[i];
    s.life += dt;
    const k = s.life / s.max;
    if (k >= 1) { f.smoke.splice(i, 1); continue; }
    // tourbillon doux + dérive de vent + accélération ascendante
    s.x += (s.vx + Math.sin(t * 0.9 + s.ph) * 12) * dt;
    s.y += s.vy * (1 - k * 0.3) * dt;
    s.r += s.grow * dt;
    s.vy -= 4 * dt;
  }
}

// ---- rendu d'une langue de flamme (couche unique) ----
// forme en pétale de flamme : large à la base, pointue au sommet,
// déformée par 3 sinusoïdes non corrélées -> mouvement organique sans boucle
function flameTongue(bx, by, w, h, t, seed, lean, spread, alpha, stops) {
  const sway = Math.sin(t * 3.1 + seed) * 0.35 + Math.sin(t * 7.7 + seed * 2.3) * 0.18;
  const hh = h * (0.72 + 0.16 * Math.sin(t * 5.3 + seed * 1.7) + 0.12 * Math.sin(t * 11.9 + seed));
  const ww = w * (0.85 + 0.2 * Math.sin(t * 4.3 + seed * 3.1));
  const tipX = bx + (lean + sway) * hh * 0.55;
  const l = bx - ww / 2, r = bx + ww / 2;
  const ctx2 = ctx;
  const g = ctx2.createLinearGradient(0, by, 0, by - hh);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx2.fillStyle = g;
  ctx2.globalAlpha = alpha;
  ctx2.beginPath();
  ctx2.moveTo(l, by);
  ctx2.bezierCurveTo(l - ww * 0.18, by - hh * 0.34, bx - ww * (0.42 + spread * 0.1), by - hh * 0.72, tipX, by - hh);
  ctx2.bezierCurveTo(bx + ww * (0.42 + spread * 0.1), by - hh * 0.72, r + ww * 0.18, by - hh * 0.34, r, by);
  ctx2.closePath();
  ctx2.fill();
  ctx2.globalAlpha = 1;
}

// ---- scène complète ----
export function drawForgeScene() {
  const f = fx();
  const t = G.time || 0;
  const dt = Math.min(0.05, Math.max(0.001, t - f.lastT));
  f.lastT = t;
  const glow = fireLevel(t);
  updateFx(f, dt, glow);

  const fire = FIRE(), ch = CHIMNEY();
  const px = W / 2, py = H / 2; // centre du panneau (repère lumière)

  ctx.save();

  // ================= FOND : intérieur de forge en pierre =================
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0c0a09'); bg.addColorStop(0.55, '#14100c'); bg.addColorStop(1, '#1c130c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // briques du mur : motif déterministe (hachures pseudo-aléatoires stables)
  const bh = 46, bw = 118;
  for (let row = 0; row * bh < H; row++) {
    const off = (row % 2) * bw * 0.5;
    for (let col = -1; col * bw < W + bw; col++) {
      const bx = col * bw + off, by = row * bh;
      const h = ((row * 73856093) ^ (col * 19349663)) >>> 0;
      const v = 8 + (h % 9);
      ctx.fillStyle = `rgb(${v + 10},${v + 7},${v + 5})`;
      ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
      // reflet chaleureux sur les briques proches du foyer
      const dFire = Math.hypot(bx + bw / 2 - fire.x, by - fire.y);
      if (dFire < W * 0.5) {
        ctx.fillStyle = `rgba(255,110,30,${(1 - dFire / (W * 0.5)) * 0.10 * glow})`;
        ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
      }
    }
  }
  // sombre vers les bords (vignette douce)
  const vg = ctx.createRadialGradient(px, py, H * 0.3, px, py, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // ================= SOL : dalles + reflets =================
  const floorY = H * 0.80;
  const fl = ctx.createLinearGradient(0, floorY, 0, H);
  fl.addColorStop(0, '#241a12'); fl.addColorStop(1, '#120c08');
  ctx.fillStyle = fl; ctx.fillRect(0, floorY, W, H - floorY);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const y = floorY + Math.pow(i / 8, 1.6) * (H - floorY);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath(); ctx.moveTo(px + i * 90, floorY); ctx.lineTo(px + i * 320, H); ctx.stroke();
  }
  // mare de lumière chaude sous le foyer (reflet du feu sur le sol)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pool = ctx.createRadialGradient(fire.x, floorY + 26, 10, fire.x, floorY + 26, fire.w * 2.6);
  pool.addColorStop(0, `rgba(255,120,30,${0.30 * glow})`);
  pool.addColorStop(0.6, `rgba(200,60,10,${0.12 * glow})`);
  pool.addColorStop(1, 'rgba(120,30,0,0)');
  ctx.fillStyle = pool;
  ctx.beginPath(); ctx.ellipse(fire.x, floorY + 30, fire.w * 2.6, 60, 0, 0, TAU); ctx.fill();
  ctx.restore();

  // ================= STRUCTURE : foyer + cheminée =================
  // corps de pierre du foyer (arche)
  const fx0 = fire.x - fire.w * 1.15, fw = fire.w * 2.3, ftop = fire.y - fire.w * 1.5, fbot = floorY + 10;
  const stoneG = ctx.createLinearGradient(fx0, 0, fx0 + fw, 0);
  stoneG.addColorStop(0, '#2a211a'); stoneG.addColorStop(0.5, '#3a2d20'); stoneG.addColorStop(1, '#241b14');
  ctx.fillStyle = stoneG;
  ctx.beginPath();
  ctx.moveTo(fx0, fbot);
  ctx.lineTo(fx0, ftop + fw * 0.5);
  ctx.quadraticCurveTo(fire.x, ftop - fw * 0.28, fx0 + fw, ftop + fw * 0.5);
  ctx.lineTo(fx0 + fw, fbot);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.stroke();
  // claveaux de l'arche
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(fire.x + i * fw * 0.11, fbot);
    ctx.lineTo(fire.x + i * fw * 0.16, ftop + fw * 0.42);
    ctx.stroke();
  }
  // intérieur du foyer (creuset sombre)
  ctx.fillStyle = '#0a0503';
  ctx.beginPath();
  ctx.moveTo(fx0 + fw * 0.16, fbot);
  ctx.lineTo(fx0 + fw * 0.16, ftop + fw * 0.62);
  ctx.quadraticCurveTo(fire.x, ftop + fw * 0.30, fx0 + fw * 0.84, ftop + fw * 0.62);
  ctx.lineTo(fx0 + fw * 0.84, fbot);
  ctx.closePath(); ctx.fill();
  // sole du foyer : barreaux
  ctx.strokeStyle = '#1a120c'; ctx.lineWidth = 5;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(fire.x + i * fw * 0.09, fbot - 4);
    ctx.lineTo(fire.x + i * fw * 0.11, fbot - 26);
    ctx.stroke();
  }
  // cheminée
  ctx.fillStyle = '#241c15';
  ctx.fillRect(ch.x - 34, ch.y - 60, 68, 70);
  ctx.fillStyle = '#17110d';
  ctx.fillRect(ch.x - 44, ch.y - 78, 88, 22);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  ctx.strokeRect(ch.x - 34, ch.y - 60, 68, 70);

  // ================= FEU : halo + couches de flammes =================
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // grand halo ambiant
  const halo = ctx.createRadialGradient(fire.x, fire.y - 40, 10, fire.x, fire.y - 40, fire.w * 3.4);
  halo.addColorStop(0, `rgba(255,140,40,${0.34 * glow})`);
  halo.addColorStop(0.4, `rgba(220,70,15,${0.16 * glow})`);
  halo.addColorStop(1, 'rgba(140,40,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(fire.x, fire.y - 40, fire.w * 3.4, 0, TAU); ctx.fill();

  // flammes de fond (larges, lentes, très translucides)
  for (let i = 0; i < 7; i++) {
    const seed = i * 3.7 + 1;
    const bx = fire.x + (i - 3) * fire.w * 0.21;
    flameTongue(bx, fire.y + 8, fire.w * (0.34 + (i % 3) * 0.05), fire.w * (1.5 + (i % 2) * 0.4),
      t, seed, (i - 3) * 0.05, 0.3, 0.16 * glow,
      [[0, 'rgba(255,90,20,0.9)'], [0.6, 'rgba(255,60,10,0.45)'], [1, 'rgba(200,30,0,0)']]);
  }
  // flammes moyennes
  for (let i = 0; i < 11; i++) {
    const seed = i * 5.1 + 11;
    const bx = fire.x + (i - 5) * fire.w * 0.145 + Math.sin(t * 1.8 + i) * 6;
    const hMul = 0.8 + 0.35 * Math.sin(t * 2.9 + seed) + 0.15 * Math.sin(t * 8.1 + seed * 2);
    flameTongue(bx, fire.y + 10, fire.w * 0.16, fire.w * 1.15 * hMul,
      t, seed, Math.sin(seed) * 0.12, 0.5, 0.5 * glow,
      [[0, 'rgba(255,170,50,0.95)'], [0.55, 'rgba(255,95,15,0.8)'], [1, 'rgba(230,50,0,0)']]);
  }
  // flammes internes (petites, brillantes, rapides)
  for (let i = 0; i < 8; i++) {
    const seed = i * 7.9 + 31;
    const bx = fire.x + (i - 3.5) * fire.w * 0.11 + Math.sin(t * 3.4 + seed) * 5;
    flameTongue(bx, fire.y + 12, fire.w * 0.075, fire.w * (0.75 + 0.3 * Math.sin(t * 6.3 + seed)) ,
      t, seed, Math.sin(seed * 1.3) * 0.1, 0.7, 0.85 * glow,
      [[0, 'rgba(255,240,170,0.95)'], [0.5, 'rgba(255,190,60,0.85)'], [1, 'rgba(255,120,20,0)']]);
  }
  // micro-flammes secondaires qui clignotent au bord du foyer
  for (let i = 0; i < 6; i++) {
    const seed = i * 11.3 + 51;
    const on = Math.sin(t * (2.2 + i * 0.37) + seed) > -0.2;
    if (!on) continue;
    const bx = fire.x + (i % 2 ? 1 : -1) * fire.w * (0.85 + 0.1 * Math.sin(t + i));
    flameTongue(bx, fire.y + 4, fire.w * 0.05, fire.w * (0.4 + 0.25 * Math.sin(t * 9 + i)),
      t, seed, (i % 2 ? 1 : -1) * 0.25, 0.9, 0.5 * glow,
      [[0, 'rgba(255,200,90,0.9)'], [1, 'rgba(255,110,20,0)']]);
  }
  ctx.restore();

  // ================= BRAISES =================
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of f.embers) {
    const k = e.life / e.max;
    const a = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    const heat = e.hot;
    ctx.fillStyle = heat > 0.6 ? `rgba(255,220,140,${a * 0.9})` : `rgba(255,${Math.round(120 + heat * 80)},40,${a * 0.85})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * (1 - k * 0.5), 0, TAU);
    ctx.fill();
    if (e.r > 1.6) { // halo des grosses braises
      ctx.fillStyle = `rgba(255,120,30,${a * 0.18})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3, 0, TAU); ctx.fill();
    }
  }
  // ================= ÉTINCELLES (lignes de traînée) =================
  for (const s of f.sparks) {
    const k = s.life / s.max;
    ctx.strokeStyle = `rgba(255,${Math.round(230 - k * 160)},${Math.round(160 - k * 120)},${(1 - k) * 0.95})`;
    ctx.lineWidth = 1.8 * (1 - k) + 0.4;
    ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
  }
  ctx.restore();

  // ================= FUMÉE =================
  for (const s of f.smoke) {
    const k = s.life / s.max;
    const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    const warm = (1 - k) * s.warm * 0.5;
    const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.15, s.x, s.y, s.r);
    g.addColorStop(0, `rgba(${Math.round(70 + warm * 60)},${Math.round(64 + warm * 30)},${Math.round(60 + warm * 10)},${0.16 * a})`);
    g.addColorStop(0.7, `rgba(60,56,52,${0.10 * a})`);
    g.addColorStop(1, 'rgba(50,48,46,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }

  // ================= CHAÎNES SUSPENDUES =================
  const chains = [
    { x: W * 0.10, y0: 0, len: H * 0.30, ph: 0.0, amp: 0.05 },
    { x: W * 0.335, y0: 0, len: H * 0.22, ph: 2.1, amp: 0.065 },
    { x: W * 0.72, y0: 0, len: H * 0.34, ph: 4.0, amp: 0.045 },
  ];
  for (const c of chains) {
    const sway = Math.sin(t * 0.9 + c.ph) * c.amp + Math.sin(t * 1.7 + c.ph * 2) * c.amp * 0.4;
    const n = 11;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const lx = c.x + Math.sin(sway * (1 + k * 2)) * c.len * k * 0.9;
      const ly = c.y0 + c.len * k;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(sway * (1 + k) + (i % 2 ? Math.PI / 2 : 0));
      ctx.strokeStyle = i % 3 === 0 ? '#54432f' : '#3a2f24';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 7, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // crochet + poids au bout
    ctx.fillStyle = '#2e251c';
    ctx.beginPath();
    ctx.arc(c.x + Math.sin(sway * 3) * c.len * 0.9, c.len, 7, 0, TAU);
    ctx.fill();
  }

  // ================= LANTERNE (droite) =================
  const lx = W * 0.70, ly = H * 0.20;
  const lsway = Math.sin(t * 1.1 + 1.2) * 0.09 + Math.sin(t * 2.3) * 0.03;
  ctx.save();
  ctx.translate(lx, 0); ctx.rotate(lsway);
  // potence
  ctx.strokeStyle = '#241c15'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, ly - 66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, ly - 66); ctx.lineTo(54, ly - 40); ctx.stroke();
  // chaîne courte
  ctx.strokeStyle = '#3a2f24'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(54, ly - 40); ctx.lineTo(54, ly - 18); ctx.stroke();
  // lanterne : cage + flamme interne vacillante
  const lf = 0.75 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23 + 1) * 0.08 + Math.sin(t * 5.7) * 0.07;
  ctx.save();
  ctx.translate(54, ly - 6);
  ctx.fillStyle = '#1c1510';
  ctx.beginPath(); ctx.moveTo(-13, -26); ctx.lineTo(13, -26); ctx.lineTo(9, 14); ctx.lineTo(-9, 14); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = `rgba(255,${Math.round(140 + lf * 90)},40,${0.55 + lf * 0.3})`;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.bezierCurveTo(-7 * lf, -8, -5 * lf, 2, 0, 6);
  ctx.bezierCurveTo(5 * lf, 2, 7 * lf, -8, 0, -18);
  ctx.fill();
  ctx.restore();
  // halo de la lanterne
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createRadialGradient(54, ly - 4, 4, 54, ly - 4, 130);
  lg.addColorStop(0, `rgba(255,150,50,${0.20 * lf})`);
  lg.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(54, ly - 4, 130, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();

  // ================= RÂS DE LUMIÈRE (poussière) =================
  // rayon froid depuis une lucarne en haut à droite (contraste avec le feu)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const shaft = ctx.createLinearGradient(W * 0.78, 0, W * 0.55, H);
  shaft.addColorStop(0, 'rgba(140,170,220,0.05)');
  shaft.addColorStop(1, 'rgba(140,170,220,0)');
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(W * 0.86, 0); ctx.lineTo(W * 0.98, 0);
  ctx.lineTo(W * 0.62, H); ctx.lineTo(W * 0.48, H);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  for (const m of f.motes) {
    m.y -= m.sp * 0.016; // dérive vers le haut très lente
    m.x += Math.sin(t * 0.4 + m.ph) * 0.12;
    if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
    const tw = 0.35 + 0.65 * (0.5 + Math.sin(t * m.tw + m.ph) * 0.5);
    const nearShaft = m.x > W * 0.45 && m.x < W * 0.95;
    ctx.fillStyle = nearShaft
      ? `rgba(190,210,240,${0.28 * tw})`
      : `rgba(255,180,90,${0.16 * tw * glow})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
  }

  // ================= CHALEUR : bandes d'air au-dessus du feu =================
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const yy = fire.y - fire.w * (0.9 + i * 0.55);
    const hh = fire.w * 0.32;
    ctx.strokeStyle = `rgba(255,160,60,${0.028 * glow * (1 - i * 0.18)})`;
    ctx.lineWidth = 7 + i * 3;
    ctx.beginPath();
    for (let x = fire.x - fire.w * 1.4; x <= fire.x + fire.w * 1.4; x += 26) {
      const yo = Math.sin(x * 0.02 + t * (2.4 + i * 0.5) + i * 2) * (4 + i * 3);
      if (x === fire.x - fire.w * 1.4) ctx.moveTo(x, yy + yo); else ctx.lineTo(x, yy + yo);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ================= OUTILS & DÉCOR LATÉRAUX =================
  // Established silhouette : enclume décorative devant le feu (à droite du foyer)
  const ax2 = fire.x + fire.w * 1.55, ay2 = fire.y + fire.w * 0.28;
  ctx.fillStyle = '#191310';
  ctx.fillRect(ax2 - 10, ay2, 20, 34); // pied
  ctx.fillStyle = '#221a14';
  ctx.beginPath(); // corps trapèze
  ctx.moveTo(ax2 - 52, ay2 - 8); ctx.lineTo(ax2 - 34, ay2 - 42);
  ctx.lineTo(ax2 + 34, ay2 - 42); ctx.lineTo(ax2 + 52, ay2 - 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2c231a'; // face
  roundRect(ax2 - 58, ay2 - 52, 116, 13, 4); ctx.fill();
  // reflet de feu sur l'arête gauche de l'enclume
  ctx.strokeStyle = `rgba(255,140,50,${0.35 * glow})`; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(ax2 - 57, ay2 - 50); ctx.lineTo(ax2 - 20, ay2 - 50); ctx.stroke();
  // braise sous l'enclume (petit foyer secondaire)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hg2 = ctx.createRadialGradient(ax2, ay2 + 42, 4, ax2, ay2 + 42, 70);
  hg2.addColorStop(0, `rgba(255,110,30,${0.22 * glow})`);
  hg2.addColorStop(1, 'rgba(255,80,10,0)');
  ctx.fillStyle = hg2;
  ctx.beginPath(); ctx.arc(ax2, ay2 + 42, 70, 0, TAU); ctx.fill();
  ctx.restore();

  // présentoir d'armes à droite : lames sombres avec fil de lumière
  const rx = W * 0.86;
  ctx.strokeStyle = '#201812'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(rx - 90, H * 0.34); ctx.lineTo(rx + 110, H * 0.34); ctx.stroke();
  const blades = [
    { dx: -60, len: 90, tilt: -0.06 }, { dx: -25, len: 110, tilt: 0.02 },
    { dx: 15, len: 95, tilt: -0.03 }, { dx: 55, len: 120, tilt: 0.05 },
  ];
  for (const b of blades) {
    const bx = rx + b.dx, by = H * 0.34;
    ctx.save();
    ctx.translate(bx, by); ctx.rotate(b.tilt);
    ctx.strokeStyle = '#14100c'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 26); ctx.stroke(); // garde
    ctx.fillStyle = '#1d1712';
    ctx.beginPath(); // lame
    ctx.moveTo(-4, 8); ctx.lineTo(4, 8); ctx.lineTo(2, b.len); ctx.lineTo(-2, b.len);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(255,150,60,${0.14 * glow})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-1.5, 10); ctx.lineTo(-1, b.len - 4); ctx.stroke();
    ctx.restore();
  }

  // ================= ÉCLAIRAGE GLOBAL DYNAMIQUE =================
  // le feu projette une lueur chaude sur toute la scène, modulée par les flammes
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const amb = ctx.createRadialGradient(fire.x, fire.y, 20, fire.x, fire.y, W * 0.75);
  amb.addColorStop(0, `rgba(255,120,30,${0.16 * glow})`);
  amb.addColorStop(0.5, `rgba(200,70,15,${0.07 * glow})`);
  amb.addColorStop(1, 'rgba(150,50,0,0)');
  ctx.fillStyle = amb;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // teinte chaude très subtile sur les zones proches du foyer
  ctx.fillStyle = `rgba(255,90,20,${0.05 * glow})`;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
  return glow; // intensité exposée pour les overlays (bordures de panneau etc.)
}

// petite flamme animée pour les titres / icônes (réutilise le moteur de langues)
export function drawMiniFlame(x, y, s = 1) {
  const t = G.time || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  const g = 0.8 + Math.sin(t * 9) * 0.15 + Math.sin(t * 17) * 0.1;
  flameTongue(0, 2 * s, 7 * s, 15 * s * g, t, 3.3, 0.1, 0.6, 0.9,
    [[0, 'rgba(255,230,150,0.95)'], [0.55, 'rgba(255,140,40,0.9)'], [1, 'rgba(255,60,10,0)']]);
  flameTongue(0, 2 * s, 4 * s, 10 * s * g, t, 8.8, -0.08, 0.7, 0.7,
    [[0, 'rgba(255,200,80,0.8)'], [1, 'rgba(255,90,15,0)']]);
  ctx.restore();
}
