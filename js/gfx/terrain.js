import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, shade, drawFlaskIcon, hexA } from '../utils.js';
import { playerAngle } from '../attacks.js';
import { curWorld, CONFIG, RARITY_COLOR } from '../world.js';

// ---------- Décor : régénéré à chaque partie ----------
let riverPhase = 0, riverBase = H * 0.72;
const riverY = x => riverBase + Math.sin(x * 0.008 + riverPhase) * 55 + Math.sin(x * 0.02 + riverPhase * 2) * 25;
let lake = { x: W * 0.22, y: H * 0.26, rx: 100, ry: 64 };
let riverPts = [];
let rocks = [];
let decor = [];

export function regenerateDecor() {
  // rivière : phase et hauteur de base aléatoires
  riverPhase = Math.random() * TAU;
  riverBase = H * (0.62 + Math.random() * 0.2);
  riverPts = [];
  for (let x = -30; x <= W + 30; x += 40) riverPts.push({ x, y: riverY(x) });

  // lac : position et taille aléatoires (évite les bords)
  lake = {
    x: W * (0.15 + Math.random() * 0.7),
    y: H * (0.14 + Math.random() * 0.22),
    rx: 75 + Math.random() * 55,
    ry: 48 + Math.random() * 32
  };

  // rochers le long de la rivière
  rocks = [];
  for (let i = 0; i < 12; i++) {
    const rx = 60 + Math.random() * (W - 120);
    const side = Math.random() < 0.5 ? -1 : 1;
    rocks.push({
      x: rx,
      y: riverY(rx) + side * (30 + Math.random() * 45),
      r: 5 + Math.random() * 9,
      c: Math.random()
    });
  }

  // herbes, fleurs et arbres
  decor = [];
  for (let i = 0; i < 140; i++) {
    const r = Math.random();
    decor.push({
      x: Math.random() * W, y: Math.random() * H,
      type: r < 0.58 ? 'grass' : r < 0.8 ? 'flower' : r < 0.9 ? 'tree' : 'shroom',
      h: 4 + Math.random() * 7,
      s: 0.7 + Math.random() * 0.7,
      c: Math.random()
    });
  }
}

regenerateDecor(); // décor initial pour l'écran menu

// ---------- MONDE PROCÉDURAL (coordonnées monde, sous la caméra) ----------

// pré-rendu du terrain : sol + champs + blobs + décor figés dans un canvas hors écran.
// Un seul drawImage par frame au lieu de ~3400 appels de dessin (vrai gain de FPS).
function buildTerrainCanvas(w) {
  const c = document.createElement('canvas');
  c.width = w.w; c.height = w.h;
  const g = c.getContext('2d');
  g.fillStyle = w.def.ground;
  g.fillRect(0, 0, w.w, w.h);
  for (const s of w.sectors) {
    for (const f of s.fields) {
      g.save();
      g.translate(f.x, f.y); g.rotate(f.rot);
      g.fillStyle = f.color; g.globalAlpha = 0.45;
      g.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      g.globalAlpha = 0.25;
      g.fillStyle = 'rgba(0,0,0,0.5)';
      for (let r = -f.h / 2 + 12; r < f.h / 2; r += 16) g.fillRect(-f.w / 2, r, f.w, 2);
      g.restore();
    }
    g.globalAlpha = 1;
    for (const b of s.blobs) {
      g.fillStyle = b.color;
      g.beginPath(); g.ellipse(b.x, b.y, b.rx, b.ry, b.rot, 0, TAU); g.fill();
    }
  }
  for (const d of w.decor) drawDecorItem(d, w.def, g);
  // lacs (eau détaillée) puis ponts en bois par-dessus
  for (const l of w.lakes || []) drawLake(g, l, w.def);
  for (const l of w.lakes || []) drawBridge(g, l);
  // bordure du monde connu
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 12;
  g.strokeRect(6, 6, w.w - 12, w.h - 12);
  return c;
}

// ---------- LACS : eau détaillée (figée dans le terrain) ----------
function drawLake(g, l, def) {
  const ice = def.biome === 'ice';
  const seed = l.seed * 1000;
  g.save();
  g.translate(l.x, l.y); g.rotate(l.rot);
  // rive : anneau de terre humique puis bord de sable
  g.fillStyle = ice ? 'rgba(196,220,235,0.85)' : 'rgba(168,140,90,0.55)';
  g.beginPath(); g.ellipse(0, 0, l.rx + 22, l.ry + 20, 0, 0, TAU); g.fill();
  g.fillStyle = ice ? 'rgba(220,238,250,0.9)' : 'rgba(216,188,132,0.9)';
  g.beginPath(); g.ellipse(0, 0, l.rx + 10, l.ry + 9, 0, 0, TAU); g.fill();
  // eau : dégradé profond au centre -> clair sur les bords
  const wg = g.createRadialGradient(-l.rx * 0.22, -l.ry * 0.28, l.rx * 0.1, 0, 0, Math.max(l.rx, l.ry) * 1.05);
  if (ice) {
    wg.addColorStop(0, '#9cc4de'); wg.addColorStop(0.55, '#bcd9ec'); wg.addColorStop(1, '#dcebf7');
  } else {
    wg.addColorStop(0, '#1e4d74'); wg.addColorStop(0.5, '#2f6f9e'); wg.addColorStop(0.85, '#4a93bd'); wg.addColorStop(1, '#7db8d9');
  }
  g.fillStyle = wg;
  g.beginPath(); g.ellipse(0, 0, l.rx, l.ry, 0, 0, TAU); g.fill();
  g.strokeStyle = ice ? 'rgba(240,250,255,0.9)' : 'rgba(190,225,245,0.55)';
  g.lineWidth = 3;
  g.beginPath(); g.ellipse(0, 0, l.rx - 3, l.ry - 3, 0, 0, TAU); g.stroke();
  // ondulations concentriques (arcs discrets)
  g.strokeStyle = ice ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.28)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const k = 0.25 + i * 0.19 + (seed % 0.08);
    g.beginPath();
    g.ellipse((seed % 1 - 0.5) * l.rx * 0.3, (seed % 0.7 - 0.35) * l.ry * 0.3, l.rx * k, l.ry * k, 0, seed % TAU, seed % TAU + 3.6);
    g.stroke();
  }
  // reflets lumineux
  g.fillStyle = ice ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 7; i++) {
    const a = seed * 13 + i * 2.4;
    g.beginPath();
    g.ellipse(Math.cos(a) * l.rx * 0.55, Math.sin(a) * l.ry * 0.5, 8 + (i % 3) * 6, 2.5, a * 0.4, 0, TAU);
    g.fill();
  }
  if (ice) {
    // lac gelé : fissures et poussière de neige sur la rive
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) {
      const a = seed + i * 1.9;
      g.beginPath();
      g.moveTo(Math.cos(a) * l.rx * 0.15, Math.sin(a) * l.ry * 0.12);
      g.lineTo(Math.cos(a + 0.4) * l.rx * 0.5, Math.sin(a + 0.4) * l.ry * 0.45);
      g.lineTo(Math.cos(a - 0.2) * l.rx * 0.75, Math.sin(a - 0.2) * l.ry * 0.7);
      g.stroke();
    }
  } else {
    // nénuphars + fleur de lotus
    for (let i = 0; i < 3; i++) {
      const a = seed * 7 + i * 2.1;
      const lx = Math.cos(a) * l.rx * 0.5, ly = Math.sin(a) * l.ry * 0.45;
      g.fillStyle = 'rgba(76,175,80,0.75)';
      g.beginPath(); g.ellipse(lx, ly, 9, 5.5, a, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,182,193,0.9)';
      g.beginPath(); g.arc(lx + 3, ly - 1, 2.2, 0, TAU); g.fill();
    }
    // roseaux sur la rive
    g.strokeStyle = 'rgba(120,140,70,0.8)'; g.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = seed * 3 + i * 0.63;
      const rr2 = 1.02 + (i % 3) * 0.03;
      const bx = Math.cos(a) * l.rx * rr2, by = Math.sin(a) * l.ry * rr2;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + 3, by - 10, bx + (i % 2 ? 6 : -5), by - 16 - (i % 3) * 3);
      g.stroke();
    }
  }
  g.restore();
}

// ---------- PONT : passerelle en bois traversant le lac ----------
function drawBridge(g, l) {
  const b = l.bridge;
  g.save();
  g.translate(b.x, b.y); g.rotate(b.ang);
  // ombre portée sur l'eau
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.ellipse(0, 7, b.len / 2, b.wid / 2 + 4, 0, 0, TAU); g.fill();
  const half = b.len / 2, hw = b.wid / 2;
  // tablier : lattes de bois alternées + interstices
  for (let u = -half; u < half; u += 12) {
    const shade = ((u / 12) | 0) % 2 ? '#8a6642' : '#9c7a52';
    g.fillStyle = shade;
    g.fillRect(u, -hw + 3, 10, b.wid - 6);
    g.strokeStyle = 'rgba(60,40,20,0.55)'; g.lineWidth = 1;
    g.strokeRect(u, -hw + 3, 10, b.wid - 6);
    // clou / grain
    g.fillStyle = 'rgba(60,40,20,0.6)';
    g.fillRect(u + 4, -hw + 7, 1.5, 2); g.fillRect(u + 4, hw - 9, 1.5, 2);
  }
  // longerons sous le tablier
  g.fillStyle = '#5d4028';
  g.fillRect(-half, -hw + 1, b.len, 4);
  g.fillRect(-half, hw - 5, b.len, 4);
  // garde-corps : lisse + poteaux
  g.strokeStyle = '#6d4c30'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-half + 4, -hw + 8); g.lineTo(half - 4, -hw + 8); g.stroke();
  g.beginPath(); g.moveTo(-half + 4, hw - 8); g.lineTo(half - 4, hw - 8); g.stroke();
  for (let u = -half + 10; u <= half - 4; u += 42) {
    g.fillStyle = '#7a5638';
    g.fillRect(u - 2.5, -hw + 2, 5, 12);
    g.fillRect(u - 2.5, hw - 14, 5, 12);
  }
  // piles d'appui dans l'eau aux deux bouts : poteau + entretoise
  g.fillStyle = '#4e3620';
  for (const end of [-1, 1]) {
    const px = end * (half - 8);
    g.fillRect(px - 4, -hw - 2, 8, b.wid + 4);          // poteau
    g.fillRect(px - b.wid / 2, -hw - 8, b.wid, 7);      // entretoise
    g.fillRect(px - b.wid / 2, hw + 1, b.wid, 7);
  }
  g.restore();
}

// sol de base + taches de couleur des secteurs + champs + décor
export function drawTerrain() {
  const w = curWorld();
  if (!w) return;
  if (!w._terrain) w._terrain = buildTerrainCanvas(w); // régénéré seulement si le monde change
  const cx = G.camX || 0, cy = G.camY || 0;
  // sous la transform caméra : on ne blitte que la fenêtre visible
  ctx.drawImage(w._terrain, cx, cy, W, H, cx, cy, W, H);
}

// g = contexte de rendu (canvas principal ou canvas de pré-rendu hors écran)
function drawDecorItem(d, def, g = ctx) {
  const ctx = g; // tout le corps dessine via `ctx` -> redirigé vers g
  const ice = def.biome === 'ice';
  if (d.type === 'grass') {
    ctx.strokeStyle = ice ? 'rgba(220,240,255,0.55)' : (d.c < 0.5 ? 'rgba(76,175,80,0.5)' : 'rgba(129,199,132,0.45)');
    ctx.lineWidth = 1.5;
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(d.x + b * 3, d.y);
      ctx.quadraticCurveTo(d.x + b * 4, d.y - d.h * 0.6, d.x + b * 5, d.y - d.h);
      ctx.stroke();
    }
  } else if (d.type === 'flower') {
    ctx.fillStyle = d.c < 0.33 ? 'rgba(255,213,79,0.8)' : d.c < 0.66 ? 'rgba(244,143,177,0.8)' : 'rgba(186,104,200,0.8)';
    ctx.beginPath(); ctx.arc(d.x, d.y, 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(d.x, d.y, 1, 0, TAU); ctx.fill();
  } else if (d.type === 'tree') {
    const s = d.s, tx = d.x, ty = d.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(tx, ty + 2, 16 * s, 6 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(tx - 3 * s, ty - 14 * s, 6 * s, 16 * s);
    const greens = ice ? ['#8fb8d8', '#a8cbe8', '#7aa8cc'] : ['#2e7d32', '#388e3c', '#43a047'];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = greens[(d.c * 3 + k) % 3 | 0];
      ctx.beginPath();
      ctx.arc(tx + (k - 1) * 8 * s, ty - 20 * s - (k % 2) * 6 * s, (9 - k * 1.5) * s, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(tx - 4 * s, ty - 26 * s, 5 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'pine') {
    // sapin du biome givré
    const s = d.s, tx = d.x, ty = d.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(tx, ty + 2, 14 * s, 5 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(tx - 2.5 * s, ty - 8 * s, 5 * s, 10 * s);
    const blues = ['#4a7fa5', '#5b8fb8', '#3d6d8f'];
    for (let k = 0; k < 3; k++) {
      const w2 = (16 - k * 4) * s, top = ty - 26 * s + k * 9 * s;
      ctx.fillStyle = blues[k % 3];
      ctx.beginPath();
      ctx.moveTo(tx, top - 12 * s);
      ctx.lineTo(tx - w2, top); ctx.lineTo(tx + w2, top);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(tx - w2 * 0.5, top - 2 * s); ctx.lineTo(tx, top - 8 * s); ctx.lineTo(tx + w2 * 0.5, top - 2 * s);
      ctx.closePath(); ctx.fill();
    }
  } else if (d.type === 'rock') {
    const s = d.s, r = (5 + d.c * 8) * s;
    const rg = ctx.createRadialGradient(d.x - r * 0.3, d.y - r * 0.3, 1, d.x, d.y, r);
    rg.addColorStop(0, ice ? '#cfd8dc' : '#9e9e9e'); rg.addColorStop(1, ice ? '#78909c' : '#455a64');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, r, r * 0.75, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(d.x - r * 0.3, d.y - r * 0.35, r * 0.25, 0, TAU); ctx.fill();
  } else if (d.type === 'shroom') {
    const s = d.s;
    ctx.fillStyle = '#e8dcc8';
    ctx.fillRect(d.x - 2 * s, d.y - 7 * s, 4 * s, 9 * s);
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath(); ctx.arc(d.x, d.y - 7 * s, 6 * s, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(d.x - 2.5 * s, d.y - 9 * s, 1.4 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x + 2 * s, d.y - 8 * s, 1.1 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'crystal') {
    // cristal de glace scintillant
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.fillStyle = 'rgba(79,195,247,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, -12 * s); ctx.lineTo(5 * s, -2 * s); ctx.lineTo(0, 10 * s); ctx.lineTo(-5 * s, -2 * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(0, -12 * s); ctx.lineTo(2.5 * s, -2 * s); ctx.lineTo(0, 4 * s); ctx.lineTo(-1 * s, -2 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (d.type === 'snow') {
    // congère de neige
    const s = d.s;
    ctx.fillStyle = 'rgba(240,248,255,0.9)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 10 * s, 5 * s, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x - 5 * s, d.y - 3 * s, 5 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x + 5 * s, d.y - 3 * s, 5 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(d.x, d.y - 6 * s, 4 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'crack') {
    // fissure de lave : veine incandescente qui serpente dans le sol
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.strokeStyle = 'rgba(255,87,34,0.85)'; ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(-14 * s, 0);
    ctx.lineTo(-5 * s, -4 * s); ctx.lineTo(2 * s, 2 * s); ctx.lineTo(9 * s, -3 * s); ctx.lineTo(15 * s, 1 * s);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,235,150,0.9)'; ctx.lineWidth = 1 * s;
    ctx.stroke();
    ctx.restore();
    // lueur ambiante autour de la fissure
    const cg = ctx.createRadialGradient(d.x, d.y, 1, d.x, d.y, 16 * s);
    cg.addColorStop(0, 'rgba(255,120,40,0.22)'); cg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(d.x, d.y, 16 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'bone') {
    // ossements épars : fémur + cage thoracique stylisée
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.strokeStyle = 'rgba(240,230,210,0.9)'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9 * s, 4 * s); ctx.lineTo(9 * s, -4 * s); ctx.stroke();
    for (const e of [-1, 1]) {
      ctx.beginPath(); ctx.arc(e * 10 * s, -e * 5 * s, 3.4 * s, 0, TAU); ctx.stroke();
    }
    // crâne
    ctx.fillStyle = 'rgba(240,230,210,0.85)';
    ctx.beginPath(); ctx.arc(12 * s, -8 * s, 4.5 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3d1f1c';
    ctx.beginPath(); ctx.arc(10.5 * s, -8.5 * s, 1.1 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(13.5 * s, -8.5 * s, 1.1 * s, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (d.type === 'obsid') {
    // shard d'obsidienne : cristal noir à arêtes rouges
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.fillStyle = '#1a0f0d';
    ctx.beginPath();
    ctx.moveTo(0, -13 * s); ctx.lineTo(6 * s, -2 * s); ctx.lineTo(3 * s, 10 * s); ctx.lineTo(-4 * s, 8 * s); ctx.lineTo(-6 * s, -3 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,82,82,0.7)'; ctx.lineWidth = 1.2 * s; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,150,80,0.5)'; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(0, -13 * s); ctx.lineTo(0, 8 * s); ctx.stroke();
    ctx.restore();
  } else if (d.type === 'fire') {
    // brasier : lit de braises incandescents
    const s = d.s;
    const fl = 0.75 + Math.sin(G.time * 5 + d.c * 20) * 0.25;
    const fg = ctx.createRadialGradient(d.x, d.y, 1, d.x, d.y, 13 * s);
    fg.addColorStop(0, `rgba(255,220,120,${0.55 * fl})`);
    fg.addColorStop(0.5, `rgba(255,110,30,${0.35 * fl})`);
    fg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(d.x, d.y, 13 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,160,60,${0.8 * fl})`;
    for (let i = 0; i < 4; i++) {
      const a = d.c * TAU + i * 1.7;
      ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * 4 * s, d.y + Math.sin(a) * 3 * s, (2.2 - i * 0.3) * s, 0, TAU); ctx.fill();
    }
  } else if (d.type === 'deadwood') {
    // arbre mort : tronc noir dénudé aux branches tordues
    const s = d.s, tx = d.x, ty = d.y;
    ctx.strokeStyle = '#241210'; ctx.lineCap = 'round';
    ctx.lineWidth = 5 * s;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 3 * s, ty - 14 * s, tx - 2 * s, ty - 26 * s); ctx.stroke();
    ctx.lineWidth = 3 * s;
    for (const [bx, by, ex, ey] of [[-1, -14, -9, -22], [1, -18, 8, -26], [-1, -22, -6, -30]]) {
      ctx.beginPath(); ctx.moveTo(tx + bx * 3 * s, ty + by * s); ctx.lineTo(tx + ex * s, ty + ey * s); ctx.stroke();
    }
    // extrémités embrasées
    ctx.fillStyle = 'rgba(255,120,40,0.8)';
    ctx.beginPath(); ctx.arc(tx - 2 * s, ty - 26 * s, 2 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(tx + 8 * s, ty - 26 * s, 1.6 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'ash') {
    // touffe de cendres : anneau gris avec cœur sombre
    const s = d.s;
    ctx.fillStyle = 'rgba(120,105,100,0.5)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 9 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(60,45,40,0.6)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y - 1 * s, 4 * s, 2.4 * s, 0, 0, TAU); ctx.fill();
  }
}
