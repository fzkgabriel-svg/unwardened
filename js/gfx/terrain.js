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
  // texture du sol : millions de micro-grains déterministes (herbe, gravier, cendres)
  {
    const iceT = w.def.biome === 'ice', hellT = w.def.biome === 'hell', spaceT = w.def.biome === 'space';
    const darkC = iceT ? 'rgba(90,130,170,0.20)' : hellT ? 'rgba(0,0,0,0.30)' : spaceT ? 'rgba(20,24,40,0.28)' : 'rgba(20,40,15,0.18)';
    const liteC = iceT ? 'rgba(255,255,255,0.22)' : hellT ? 'rgba(255,120,60,0.12)' : spaceT ? 'rgba(140,160,255,0.14)' : 'rgba(200,230,140,0.16)';
    let seedT = (w.idx * 7919 + 13) >>> 0;
    const rnd = () => { seedT = (seedT * 1664525 + 1013904223) >>> 0; return seedT / 4294967296; };
    const nSp = Math.floor(w.w * w.h / 2600);
    for (let i = 0; i < nSp; i++) {
      const px = rnd() * w.w, py = rnd() * w.h;
      const lite = rnd() < 0.4;
      g.fillStyle = lite ? liteC : darkC;
      if (rnd() < 0.75) { g.fillRect(px, py, 1 + rnd() * 2, 1); }
      else { g.fillRect(px, py, 1, 1 + rnd() * 3); } // micro-brins
    }
    // traînées d'herbe/fougères : courts segments colorés regroupés
    if (!hellT && !spaceT) {
      const bladeC = iceT ? 'rgba(230,245,255,0.20)' : 'rgba(140,200,90,0.18)';
      for (let i = 0; i < nSp / 3; i++) {
        const px = rnd() * w.w, py = rnd() * w.h;
        g.strokeStyle = bladeC; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + (rnd() - 0.5) * 3, py - 2 - rnd() * 3); g.stroke();
      }
    }
  }
  for (const d of w.decor) if (!d.sway) drawDecorItem(d, w.def, g);
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
  // sous la transform caméra : on ne blitte que la fenêtre visible.
  // Filtre : couleurs plus saturées et contrastées (identité visuelle MAP 4.0).
  ctx.save();
  ctx.filter = 'saturate(1.32) contrast(1.07) brightness(1.03)';
  ctx.drawImage(w._terrain, cx, cy, W, H, cx, cy, W, H);
  ctx.restore();
}

// ---------- SECRETS : petits sites cachés (cercles, puits, tombes, autels) ----------
function drawSecretItem(s, def, g) {
  const ctx = g;
  const ice = def.biome === 'ice', hell = def.biome === 'hell', sewer = def.biome === 'sewer', space = def.biome === 'space';
  const stoneCol = ice ? '#b8c9d8' : hell ? '#4a2a24' : sewer ? '#4c5c3a' : space ? '#3d4556' : '#8d8578';
  const mossCol = ice ? 'rgba(200,230,250,0.7)' : hell ? 'rgba(255,120,50,0.5)' : sewer ? 'rgba(140,220,110,0.7)' : space ? 'rgba(140,180,255,0.7)' : 'rgba(129,199,132,0.7)';
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.rot);
  if (s.type === 'stonecircle' || s.type === 'bonecircle') {
    // cercle de pierres dressées ou d'ossements
    const n = s.type === 'bonecircle' ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n;
      const px = Math.cos(a) * 34, py = Math.sin(a) * 22;
      if (s.type === 'bonecircle') {
        ctx.strokeStyle = 'rgba(230,220,195,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(px - 3, py - 8); ctx.lineTo(px + 3, py + 8); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py - 11, 4, 0, TAU); ctx.stroke();
      } else {
        ctx.fillStyle = stoneCol;
        ctx.beginPath();
        ctx.moveTo(px - 4, py + 6); ctx.lineTo(px - 3, py - 9 - (i % 3) * 3); ctx.lineTo(px + 3, py - 8 - (i % 2) * 4); ctx.lineTo(px + 4, py + 6);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = mossCol;
        ctx.beginPath(); ctx.arc(px - 1, py - 6, 1.6, 0, TAU); ctx.fill();
      }
    }
    // dalle centrale
    ctx.fillStyle = stoneCol;
    ctx.beginPath(); ctx.ellipse(0, 2, 12, 7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
    if (s.type === 'stonecircle') {
      ctx.strokeStyle = mossCol; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 15, 0, 0, TAU); ctx.stroke();
    }
  } else if (s.type === 'well') {
    // puits à souhaits : cercle de pierres + toit de bois + seau
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 4, 20, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = stoneCol;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1e3a52';
    ctx.beginPath(); ctx.ellipse(0, -1, 13, 6.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(180,220,245,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(-3, -2, 5, 2, -0.3, 0, TAU); ctx.stroke();
    // poteaux + toit
    ctx.strokeStyle = '#6d4c30'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-12, -22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(12, -22); ctx.stroke();
    ctx.fillStyle = '#5d4037';
    ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(0, -34); ctx.lineTo(16, -22); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    // treuil + seau
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(12, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -8); ctx.stroke();
    ctx.fillStyle = '#795548';
    ctx.fillRect(-4, -8, 8, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(-4, -8, 8, 7);
  } else if (s.type === 'campfire') {
    // feu de camp : pierres + bûches + flammes + braises
    ctx.fillStyle = stoneCol;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 13, Math.sin(a) * 7, 3.5, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(8, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(8, 4); ctx.stroke();
    const fl = 0.8 + Math.sin(G.time * 6 + s.seed * 40) * 0.2;
    const fg = ctx.createRadialGradient(0, -6, 1, 0, -6, 14);
    fg.addColorStop(0, `rgba(255,220,120,${0.7 * fl})`);
    fg.addColorStop(0.6, `rgba(255,120,40,${0.5 * fl})`);
    fg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(0, -6, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,180,60,${0.85 * fl})`;
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(4, -8, 0, -2); ctx.quadraticCurveTo(-4, -8, 0, -16); ctx.fill();
  } else if (s.type === 'icetomb') {
    // tombe gelée : dalle penchée + neige + fleur de glace
    ctx.save();
    ctx.rotate(-0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 6, 14, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#dfe9f2';
    ctx.beginPath();
    ctx.moveTo(-9, 6); ctx.lineTo(-9, -10); ctx.quadraticCurveTo(0, -18, 9, -10); ctx.lineTo(9, 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,210,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(0, -8, 6, 4, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(240,248,255,0.9)';
    ctx.beginPath(); ctx.ellipse(0, 7, 16, 5, 0, 0, TAU); ctx.fill();
    // croix de glace
    ctx.strokeStyle = 'rgba(190,225,245,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -19); ctx.lineTo(5, -19); ctx.stroke();
  } else if (s.type === 'sacrifice') {
    // autel de sacrifice : dalle + rune + offrandes
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 22, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a1c18';
    ctx.fillRect(-16, -4, 32, 14);
    ctx.fillStyle = '#4a2622';
    ctx.fillRect(-18, -8, 36, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(-16, -4, 32, 14);
    // rune incandescente
    const pulse = 0.7 + Math.sin(G.time * 3 + s.seed * 30) * 0.3;
    ctx.strokeStyle = `rgba(255,100,50,${pulse})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(0, -12); ctx.lineTo(6, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -4); ctx.stroke();
    // offrandes : crâne + os
    ctx.fillStyle = 'rgba(230,215,190,0.85)';
    ctx.beginPath(); ctx.arc(-20, -10, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(20, -10, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0d0b';
    ctx.beginPath(); ctx.arc(-21, -11, 1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(19, -11, 1, 0, TAU); ctx.fill();
  } else if (s.type === 'sump') {
    // puisard d'égout : cadre de pierre + eau stagnante + grille
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 3, 24, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3d4c2f';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a2a1a';
    ctx.beginPath(); ctx.ellipse(0, -1, 17, 6.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(120,180,140,0.5)';
    ctx.beginPath(); ctx.ellipse(-4, -2, 7, 2.5, -0.2, 0, TAU); ctx.fill();
    // barreaux
    ctx.strokeStyle = '#5a7048'; ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 5, -8); ctx.lineTo(i * 5, 6); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(18, -2); ctx.stroke();
    // mousse
    ctx.fillStyle = mossCol;
    ctx.beginPath(); ctx.arc(-14, -6, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(15, -7, 2.4, 0, TAU); ctx.fill();
  } else if (s.type === 'cisternmini') {
    // petite citerne : cuve en pierre + canal + eau
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 26, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3d4c2f';
    ctx.fillRect(-20, -14, 40, 22);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(-20, -14, 40, 22);
    ctx.fillStyle = '#16220f';
    ctx.fillRect(-17, -11, 34, 16);
    ctx.fillStyle = 'rgba(110,190,80,0.5)';
    ctx.fillRect(-17, -4, 34, 9);
    // canal de trop-plein
    ctx.fillStyle = '#2a381f';
    ctx.fillRect(20, 2, 14, 6);
    ctx.fillStyle = 'rgba(120,180,140,0.6)';
    ctx.fillRect(20, 4, 14, 2);
    // mousse
    ctx.fillStyle = mossCol;
    ctx.beginPath(); ctx.arc(-10, -16, 3.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -17, 2.8, 0, TAU); ctx.fill();
  } else if (s.type === 'artifact') {
    // artefact alien : monolithe flottant + anneaux d'énergie
    const bob = Math.sin(G.time * 1.4 + s.seed * 20) * 4;
    ctx.save();
    ctx.translate(0, bob);
    const ag = ctx.createLinearGradient(-8, 0, 8, 0);
    ag.addColorStop(0, '#3d4a6a'); ag.addColorStop(0.5, '#6a7bab'); ag.addColorStop(1, '#232a40');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.moveTo(0, -26); ctx.lineTo(8, -10); ctx.lineTo(6, 12); ctx.lineTo(-6, 12); ctx.lineTo(-8, -10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(160,200,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    // runes lumineuses
    const pulse = 0.6 + Math.sin(G.time * 3 + s.seed * 25) * 0.4;
    ctx.strokeStyle = `rgba(140,220,255,${pulse})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(4, -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(3, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(4, 2); ctx.stroke();
    // anneaux
    ctx.strokeStyle = `rgba(180,160,255,${0.4 * pulse})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 7, -0.3, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 9, 0.4, 0, TAU); ctx.stroke();
    ctx.restore();
    const lg = ctx.createRadialGradient(0, bob, 2, 0, bob, 30);
    lg.addColorStop(0, 'rgba(140,180,255,0.3)'); lg.addColorStop(1, 'rgba(140,180,255,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, bob, 30, 0, TAU); ctx.fill();
  } else if (s.type === 'viewpoint') {
    // point de vue : banc + rambarde + petite table d'observation
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 6, 30, 8, 0, 0, TAU); ctx.fill();
    const wood = ice ? '#7a94a8' : hell ? '#4a2a20' : sewer ? '#4c5c3a' : space ? '#4a5570' : '#7a5c3e';
    const woodD = ice ? '#5a7a90' : hell ? '#3a1e16' : sewer ? '#3a4a2c' : space ? '#3a4458' : '#5d4530';
    // banc
    ctx.fillStyle = wood;
    ctx.fillRect(-20, 2, 40, 5);
    ctx.fillRect(-20, -3, 40, 4);
    ctx.fillStyle = woodD;
    ctx.fillRect(-18, 7, 4, 6); ctx.fillRect(14, 7, 4, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    ctx.strokeRect(-20, -3, 40, 10);
    // rambarde (côté "falaise" : en haut)
    ctx.strokeStyle = wood; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-26, -14); ctx.lineTo(26, -14); ctx.stroke();
    for (const px of [-26, -13, 0, 13, 26]) {
      ctx.beginPath(); ctx.moveTo(px, -14); ctx.lineTo(px, -4); ctx.stroke();
    }
    // petite borne/panneau
    ctx.fillStyle = woodD;
    ctx.fillRect(16, -22, 3, 14);
    ctx.fillStyle = ice ? '#cfe4f5' : hell ? '#ffb74d' : sewer ? '#a4d68a' : space ? '#9fd0ff' : '#ffe082';
    ctx.fillRect(12, -26, 11, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    ctx.strokeRect(12, -26, 11, 8);
    // marque de vue : petite touffe d'herbe au bord
    ctx.strokeStyle = mossCol; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-24, 8); ctx.lineTo(-26, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, 8); ctx.lineTo(-21, 1); ctx.stroke();
  } else if (s.type === 'ruinmini') {
    // mini-ruine alien : arc brisé + dalle + gravures
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 4, 26, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2e3444';
    // deux piliers + linteau brisé
    ctx.fillRect(-22, -18, 8, 22);
    ctx.fillRect(14, -22, 8, 26);
    ctx.fillStyle = '#3d4556';
    ctx.beginPath();
    ctx.moveTo(-24, -18); ctx.lineTo(-10, -26); ctx.lineTo(16, -22); ctx.lineTo(24, -16); ctx.lineTo(24, -12); ctx.lineTo(-24, -12);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(-22, -18, 8, 22); ctx.strokeRect(14, -22, 8, 26);
    // gravures
    ctx.strokeStyle = `rgba(120,200,255,${0.5 + Math.sin(G.time * 2 + s.seed * 20) * 0.3})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(-18, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -12); ctx.lineTo(18, -5); ctx.stroke();
    // dalle centrale
    ctx.fillStyle = '#232833';
    ctx.beginPath(); ctx.ellipse(0, 2, 10, 5, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// végétation animée par le vent : sous-ensemble du décor rendu par frame
const SWAY_AMP = { grass: 0.4, flower: 0.36, fern: 0.28, bush: 0.12, frozenbush: 0.12,
  firegrass: 0.42, alienflora: 0.3, glowshroom: 0.2, mush: 0.2, shroom: 0.16,
  tree: 0.085, bigtree: 0.075, pine: 0.1, cosmictree: 0.13, crystal: 0.07,
  energycrystal: 0.1 };
export function drawSwayDecor() {
  const w = curWorld();
  if (!w || !w.decor) return;
  const x0 = (G.camX || 0) - 140, y0 = (G.camY || 0) - 160, x1 = x0 + W + 280, y1 = y0 + H + 240;
  const t = G.time;
  for (const d of w.decor) {
    if (!d.sway) continue;
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
    const amp = SWAY_AMP[d.type] || 0.05;
    const a = Math.sin(t * 1.9 + d.x * 0.013 + d.y * 0.011) * amp
            + Math.sin(t * 3.1 + d.c * 9) * amp * 0.35;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(a); ctx.translate(-d.x, -d.y);
    drawDecorItem(d, w.def, ctx);
    ctx.restore();
  }
}

// reflets animés sur les lacs : glints qui scintillent et dérivent (coords monde)
export function drawLakeGlints() {
  const w = curWorld();
  if (!w || !w.lakes || !w.lakes.length) return;
  const x0 = (G.camX || 0) - 100, y0 = (G.camY || 0) - 100, x1 = x0 + W + 200, y1 = y0 + H + 200;
  const t = G.time;
  const ice = w.def.biome === 'ice';
  ctx.save();
  for (const l of w.lakes) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    const seed = l.seed * 1000;
    ctx.save();
    ctx.translate(l.x, l.y); ctx.rotate(l.rot);
    // 5 reflets principaux qui pulsent et glissent lentement
    for (let i = 0; i < 5; i++) {
      const a = seed * 13 + i * 2.4;
      const drift = Math.sin(t * 0.7 + i * 1.9 + seed) * l.rx * 0.25;
      const gx = Math.cos(a) * l.rx * 0.55 + drift;
      const gy = Math.sin(a) * l.ry * 0.5 + Math.cos(t * 0.5 + i) * 6;
      const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 2.6 + seed * 3);
      ctx.globalAlpha = 0.18 + tw * 0.42;
      ctx.fillStyle = ice ? '#ffffff' : '#eaf7ff';
      ctx.beginPath();
      ctx.ellipse(gx, gy, (10 + (i % 3) * 7) * (0.7 + tw * 0.5), 2 + tw * 1.6, a * 0.4, 0, TAU);
      ctx.fill();
    }
    // micro-étincelles à la surface
    ctx.fillStyle = ice ? 'rgba(255,255,255,0.8)' : 'rgba(220,245,255,0.7)';
    for (let i = 0; i < 14; i++) {
      const a2 = seed * 29 + i * 1.71;
      const rr3 = 0.25 + ((i * 37 + ((t * 8) | 0)) % 100) / 100 * 0.6;
      const sx = Math.cos(a2 + t * 0.15) * l.rx * rr3;
      const sy = Math.sin(a2 + t * 0.11) * l.ry * rr3;
      const tw2 = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i * 1.3));
      ctx.globalAlpha = tw2 * 0.55;
      ctx.beginPath(); ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// lumières dynamiques : halos vacillants autour des éléments luminescents du décor
const LIGHT_TYPES = {
  lantern:      { c: '255,213,79',  r: 68,  a: 0.24 },
  fire:         { c: '255,112,67',  r: 80,  a: 0.26 },
  glowshroom:   { c: '156,204,101', r: 60,  a: 0.22 },
  energycrystal:{ c: '77,208,225',  r: 74,  a: 0.24 },
  holo:         { c: '100,181,246', r: 76,  a: 0.20 },
  crystal:      { c: '179,229,252', r: 54,  a: 0.17 },
};
export function drawDecorLights() {
  const w = curWorld();
  if (!w || !w.decor) return;
  const x0 = (G.camX || 0) - 120, y0 = (G.camY || 0) - 160, x1 = x0 + W + 240, y1 = y0 + H + 240;
  const t = G.time;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const d of w.decor) {
    const L = LIGHT_TYPES[d.type];
    if (!L) continue;
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
    const fl = 0.75 + Math.sin(t * 6 + d.c * 40) * 0.18 + Math.sin(t * 13 + d.x) * 0.07;
    const r = L.r * (0.85 + d.s * 0.3);
    const g2 = ctx.createRadialGradient(d.x, d.y - 8, 2, d.x, d.y - 8, r);
    g2.addColorStop(0, `rgba(${L.c},${L.a * fl})`);
    g2.addColorStop(0.55, `rgba(${L.c},${L.a * fl * 0.4})`);
    g2.addColorStop(1, `rgba(${L.c},0)`);
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(d.x, d.y - 8, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// secrets rendus par frame (leurs éléments sont animés : feu, artefact, autel)
export function drawSecrets() {
  const w = curWorld();
  if (!w || !w.secrets) return;
  const x0 = (G.camX || 0) - 120, y0 = (G.camY || 0) - 160, x1 = x0 + W + 240, y1 = y0 + H + 240;
  for (const s of w.secrets) {
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    drawSecretItem(s, w.def, ctx);
  }
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
  } else if (d.type === 'slime') {
    // flaque de vase : luisance verdâtre au sol
    const s = d.s;
    const pulse = 0.7 + Math.sin(G.time * 3 + d.c * 30) * 0.3;
    const gg = ctx.createRadialGradient(d.x, d.y, 1, d.x, d.y, 14 * s);
    gg.addColorStop(0, `rgba(180,255,120,${0.5 * pulse})`);
    gg.addColorStop(0.6, `rgba(110,190,60,${0.35 * pulse})`);
    gg.addColorStop(1, 'rgba(90,150,50,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 14 * s, 8 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(200,255,140,${0.6 * pulse})`;
    ctx.beginPath(); ctx.arc(d.x - 3 * s, d.y - 1 * s, 2 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'bones') {
    // squelette d'égout : cage thoracique + fémurs croisés
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.strokeStyle = 'rgba(225,215,190,0.75)'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8 * s, 6 * s); ctx.quadraticCurveTo(0, -8 * s, 8 * s, 6 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6 * s, -2 * s); ctx.lineTo(6 * s, -2 * s); ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(i * 4.5 * s, 2 * s); ctx.lineTo(i * 4.5 * s, 7 * s); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(230,220,200,0.6)'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(-9 * s, -6 * s); ctx.lineTo(5 * s, 6 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9 * s, -7 * s); ctx.lineTo(-4 * s, 5 * s); ctx.stroke();
    ctx.restore();
  } else if (d.type === 'pipe') {
    // tuyau d'égout : tronçon cylindrique avec anneaux de renfort
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 5 * s, 22 * s, 6 * s, 0, 0, TAU); ctx.fill();
    const pg = ctx.createLinearGradient(0, -8 * s, 0, 8 * s);
    pg.addColorStop(0, '#5c7a52'); pg.addColorStop(0.5, '#3e5533'); pg.addColorStop(1, '#26381f');
    ctx.fillStyle = pg;
    ctx.fillRect(-20 * s, -7 * s, 40 * s, 14 * s);
    ctx.fillStyle = '#2c3f24';
    ctx.fillRect(-24 * s, -8 * s, 5 * s, 16 * s);
    ctx.fillRect(19 * s, -8 * s, 5 * s, 16 * s);
    ctx.fillStyle = 'rgba(140,90,40,0.4)';
    ctx.beginPath(); ctx.ellipse(-8 * s, 3 * s, 4 * s, 2 * s, 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10 * s, -2 * s, 3 * s, 1.6 * s, -0.3, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (d.type === 'grate') {
    // grille d'égout : cadre + barreaux
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.fillStyle = '#1a2415';
    ctx.fillRect(-16 * s, -12 * s, 32 * s, 24 * s);
    ctx.strokeStyle = '#5a7048'; ctx.lineWidth = 2 * s;
    ctx.strokeRect(-16 * s, -12 * s, 32 * s, 24 * s);
    ctx.lineWidth = 1.4 * s;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * 4.2 * s, -10 * s); ctx.lineTo(i * 4.2 * s, 10 * s); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-15 * s, 0); ctx.lineTo(15 * s, 0); ctx.stroke();
    ctx.restore();
  } else if (d.type === 'mush') {
    // champignon toxique géant des égouts
    const s = d.s;
    const pulse = 0.8 + Math.sin(G.time * 2.5 + d.c * 20) * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 10 * s, 4 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c8d8b0';
    ctx.fillRect(d.x - 3 * s, d.y - 12 * s, 6 * s, 13 * s);
    const mg = ctx.createRadialGradient(d.x - 3 * s, d.y - 15 * s, 1, d.x, d.y - 14 * s, 11 * s);
    mg.addColorStop(0, `rgba(190,255,140,${pulse})`);
    mg.addColorStop(1, `rgba(80,160,60,${0.9 * pulse})`);
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(d.x, d.y - 14 * s, 10 * s, Math.PI, 0); ctx.fill();
    ctx.fillStyle = `rgba(220,255,170,${pulse})`;
    ctx.beginPath(); ctx.arc(d.x - 3 * s, d.y - 17 * s, 1.4 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x + 3 * s, d.y - 15 * s, 1.1 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'rat') {
    // nids de rats : petit tas sombre + queue qui dépasse
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2 * s, 8 * s, 4 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a4238';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 7 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(d.x + 6 * s, d.y + 1 * s); ctx.quadraticCurveTo(d.x + 14 * s, d.y + 6 * s, d.x + 17 * s, d.y - 2 * s); ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(d.x - 3 * s, d.y - 1 * s, 1.2 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'water') {
    // flaque d'eau usée : reflet verdâtre aux reflets irisés
    const s = d.s;
    const gg = ctx.createRadialGradient(d.x - 2 * s, d.y - 2 * s, 1, d.x, d.y, 15 * s);
    gg.addColorStop(0, 'rgba(140,180,120,0.5)');
    gg.addColorStop(0.7, 'rgba(80,110,70,0.35)');
    gg.addColorStop(1, 'rgba(60,80,50,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 15 * s, 9 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,230,150,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(d.x - 2 * s, d.y - 1 * s, 6 * s, 2.5 * s, -0.3, 0, TAU); ctx.stroke();
  } else if (d.type === 'crater') {
    // cratère lunaire : anneau d'éjecta + fond ombragé
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 16 * s, 9 * s, 0, 0, TAU); ctx.fill();
    const cg = ctx.createRadialGradient(d.x, d.y - 2 * s, 1, d.x, d.y, 15 * s);
    cg.addColorStop(0, '#171a21'); cg.addColorStop(0.7, '#3a4150'); cg.addColorStop(1, '#565e70');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 13 * s, 7.5 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,175,200,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 13 * s, 7.5 * s, 0, 0, TAU); ctx.stroke();
  } else if (d.type === 'debris') {
    // débris de station : tôle froissée + boulons
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.fillStyle = '#3d4556';
    ctx.beginPath();
    ctx.moveTo(-12 * s, 6 * s); ctx.lineTo(-8 * s, -8 * s); ctx.lineTo(4 * s, -10 * s); ctx.lineTo(12 * s, -2 * s); ctx.lineTo(8 * s, 8 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#59637a'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6 * s, -5 * s); ctx.lineTo(8 * s, -6 * s); ctx.stroke();
    ctx.restore();
  } else if (d.type === 'meteor') {
    // météorite : rocher noir creusé + traînée calcinée
    const s = d.s;
    ctx.strokeStyle = 'rgba(255,140,60,0.4)'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(d.x + 16 * s, d.y + 10 * s); ctx.lineTo(d.x + 5 * s, d.y + 3 * s); ctx.stroke();
    const mg = ctx.createRadialGradient(d.x - 3 * s, d.y - 3 * s, 1, d.x, d.y, 11 * s);
    mg.addColorStop(0, '#4a4038'); mg.addColorStop(0.7, '#241d18'); mg.addColorStop(1, '#0d0a08');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(d.x, d.y, 10 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,50,0.5)';
    ctx.beginPath(); ctx.arc(d.x - 2 * s, d.y - 2 * s, 2 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'star') {
    // plante cristalline lunaire : faisceau de pointes bleutées
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 - Math.PI / 2;
      ctx.fillStyle = i % 2 ? 'rgba(140,190,255,0.75)' : 'rgba(190,225,255,0.85)';
      ctx.save(); ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(3 * s, -10 * s); ctx.lineTo(-3 * s, -10 * s);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(220,240,255,0.9)';
    ctx.beginPath(); ctx.arc(0, 0, 2.4 * s, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (d.type === 'shard') {
    // éclat de verre spatial : prisme violet
    const s = d.s;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.fillStyle = 'rgba(120,90,200,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -12 * s); ctx.lineTo(7 * s, 2 * s); ctx.lineTo(0, 12 * s); ctx.lineTo(-7 * s, 2 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,255,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -12 * s); ctx.lineTo(0, 10 * s); ctx.stroke();
    ctx.restore();
  } else if (d.type === 'bigtree') {
    // chêne géant : tronc large, branches, racines apparentes
    const s = d.s * 1.6, tx = d.x, ty = d.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(tx, ty + 3, 26 * s, 9 * s, 0, 0, TAU); ctx.fill();
    // racines
    ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
    for (const a of [-0.7, -0.35, 0.35, 0.7]) {
      ctx.beginPath(); ctx.moveTo(tx, ty - 6 * s);
      ctx.quadraticCurveTo(tx + Math.sin(a) * 14 * s, ty - 2 * s, tx + Math.sin(a) * 22 * s, ty + 4 * s);
      ctx.stroke();
    }
    // tronc cannelé
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.moveTo(tx - 6 * s, ty); ctx.quadraticCurveTo(tx - 4 * s, ty - 30 * s, tx - 2 * s, ty - 42 * s);
    ctx.lineTo(tx + 2 * s, ty - 42 * s); ctx.quadraticCurveTo(tx + 4 * s, ty - 30 * s, tx + 6 * s, ty);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 1.5 * s; ctx.stroke();
    // branches
    ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(tx - 1 * s, ty - 34 * s); ctx.quadraticCurveTo(tx - 12 * s, ty - 44 * s, tx - 18 * s, ty - 50 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx + 1 * s, ty - 36 * s); ctx.quadraticCurveTo(tx + 13 * s, ty - 45 * s, tx + 19 * s, ty - 51 * s); ctx.stroke();
    // frondaison en 3 étages
    const greens = ice ? ['#8fb8d8', '#a8cbe8', '#7aa8cc'] : ['#2e7d32', '#388e3c', '#43a047', '#1b5e20'];
    for (let k = 0; k < 4; k++) {
      const cy2 = ty - (44 + k * 8) * s, cr = (22 - k * 3.5) * s;
      ctx.fillStyle = greens[(d.c * 4 + k) % 4 | 0];
      ctx.beginPath(); ctx.arc(tx + (k % 2 ? 6 : -6) * s, cy2, cr, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.arc(tx - 8 * s, ty - 58 * s, 8 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'bush') {
    // buisson feuillu : 3 boules + baies
    const s = d.s;
    const cols = ice ? ['#b8d4e8', '#cfe4f2', '#a4c6de'] : ['#558b2f', '#7cb342', '#9ccc65'];
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 12 * s, 4 * s, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = cols[(d.c * 3 + k) % 3 | 0];
      ctx.beginPath(); ctx.arc(d.x + (k - 1) * 7 * s, d.y - (k === 1 ? 6 : 3) * s, (7 - k * 1.4) * s, 0, TAU); ctx.fill();
    }
    if (!ice) {
      ctx.fillStyle = '#ff8a65';
      for (let k = 0; k < 3; k++) {
        const a = d.c * TAU + k * 2.1;
        ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * 8 * s, d.y - 5 * s + Math.sin(a) * 4 * s, 1.4 * s, 0, TAU); ctx.fill();
      }
    }
  } else if (d.type === 'fern') {
    // fougère :eventail de folioles
    const s = d.s;
    ctx.strokeStyle = ice ? 'rgba(200,230,250,0.8)' : 'rgba(76,175,80,0.85)';
    ctx.lineWidth = 1.4 * s; ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.32 + d.rot * 0.2;
      ctx.beginPath(); ctx.moveTo(d.x, d.y);
      ctx.quadraticCurveTo(d.x + Math.sin(a) * 8 * s, d.y - 8 * s, d.x + Math.sin(a) * 14 * s, d.y - Math.cos(a) * 6 * s - 8 * s);
      ctx.stroke();
    }
  } else if (d.type === 'stump') {
    // souche : tronc coupé + cernes + mousse
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 9 * s, 4 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath(); ctx.ellipse(d.x, d.y - 3 * s, 8 * s, 9 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a1887f';
    ctx.beginPath(); ctx.ellipse(d.x, d.y - 3 * s, 6.5 * s, 7 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1 * s;
    for (const rr2 of [2.5, 4.5]) {
      ctx.beginPath(); ctx.ellipse(d.x, d.y - 3 * s, rr2 * s, rr2 * 1.05 * s, 0, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = ice ? 'rgba(230,242,252,0.8)' : 'rgba(129,199,132,0.8)';
    ctx.beginPath(); ctx.ellipse(d.x - 3 * s, d.y - 8 * s, 4 * s, 2.5 * s, -0.4, 0, TAU); ctx.fill();
  } else if (d.type === 'fence') {
    // clôture en bois : 3 piquets + 2 lisses
    const s = d.s;
    ctx.strokeStyle = '#6d4c30'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const px = d.x + (i - 1) * 10 * s;
      ctx.beginPath(); ctx.moveTo(px, d.y); ctx.lineTo(px + (i % 2 ? 2 : -2) * s, d.y - 14 * s); ctx.stroke();
    }
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(d.x - 10 * s, d.y - 10 * s); ctx.lineTo(d.x + 10 * s, d.y - 8 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x - 10 * s, d.y - 5 * s); ctx.lineTo(d.x + 10 * s, d.y - 4 * s); ctx.stroke();
  } else if (d.type === 'lantern') {
    // lanterne sur poteau : lueur chaude
    const s = d.s;
    ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y - 18 * s); ctx.stroke();
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(d.x - 4 * s, d.y - 26 * s, 8 * s, 9 * s);
    const flick = 0.8 + Math.sin(G.time * 6 + d.c * 30) * 0.2;
    const lg = ctx.createRadialGradient(d.x, d.y - 21.5 * s, 1, d.x, d.y - 21.5 * s, 12 * s);
    lg.addColorStop(0, `rgba(255,220,140,${0.8 * flick})`); lg.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(d.x, d.y - 21.5 * s, 12 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,240,190,${flick})`;
    ctx.fillRect(d.x - 2.5 * s, d.y - 24.5 * s, 5 * s, 5 * s);
  } else if (d.type === 'barrel') {
    // tonneau : corps bombé + cerclages
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 1, 9 * s, 3.5 * s, 0, 0, TAU); ctx.fill();
    const bg = ctx.createLinearGradient(d.x - 8 * s, 0, d.x + 8 * s, 0);
    bg.addColorStop(0, '#5d4037'); bg.addColorStop(0.5, '#8d6e63'); bg.addColorStop(1, '#4e342e');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(d.x, d.y - 6 * s, 8 * s, 8 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3e2723';
    ctx.beginPath(); ctx.ellipse(d.x, d.y - 6 * s, 8 * s, 3 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#263238'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.ellipse(d.x, d.y - 6 * s, 8 * s, 8 * s, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x - 8 * s, d.y - 10 * s); ctx.lineTo(d.x + 8 * s, d.y - 10 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x - 8 * s, d.y - 2 * s); ctx.lineTo(d.x + 8 * s, d.y - 2 * s); ctx.stroke();
  } else if (d.type === 'path') {
    // chemin pavé : dalles irrégulières
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 16 * s, 7 * s, d.rot, 0, TAU); ctx.fill();
    const stones = ['#9e9e9e', '#8d8d8d', '#a5a5a5', '#7f8c8d'];
    for (let k = 0; k < 4; k++) {
      const a = d.c * TAU + k * 1.6;
      const sx2 = d.x + Math.cos(a) * 6 * s, sy2 = d.y + Math.sin(a) * 3 * s;
      ctx.fillStyle = stones[(d.c * 4 + k) % 4 | 0];
      ctx.beginPath(); ctx.ellipse(sx2, sy2, (4.5 - k % 2) * s, (3.5 - k % 2) * s, a, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    }
  } else if (d.type === 'icicle') {
    // stalactite de glace : cluster de glaçons
    const s = d.s;
    ctx.fillStyle = 'rgba(160,210,240,0.9)';
    for (let k = 0; k < 4; k++) {
      const ox = (k - 1.5) * 5 * s, len = (8 + (k % 2) * 6 + d.c * 4) * s;
      ctx.beginPath();
      ctx.moveTo(d.x + ox - 2.5 * s, d.y); ctx.lineTo(d.x + ox + 2.5 * s, d.y);
      ctx.lineTo(d.x + ox, d.y + len); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y - 1, 12 * s, 4 * s, 0, 0, TAU); ctx.fill();
  } else if (d.type === 'icecliff') {
    // falaise de glace : paroi bleutée stratifiée
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, 18 * s, 6 * s, 0, 0, TAU); ctx.fill();
    const ig = ctx.createLinearGradient(d.x, d.y - 30 * s, d.x, d.y);
    ig.addColorStop(0, '#e8f4fc'); ig.addColorStop(0.5, '#b8d9ee'); ig.addColorStop(1, '#8fb8d8');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.moveTo(d.x - 16 * s, d.y);
    ctx.lineTo(d.x - 10 * s, d.y - 18 * s); ctx.lineTo(d.x - 4 * s, d.y - 26 * s);
    ctx.lineTo(d.x + 3 * s, d.y - 20 * s); ctx.lineTo(d.x + 9 * s, d.y - 28 * s);
    ctx.lineTo(d.x + 15 * s, d.y - 12 * s); ctx.lineTo(d.x + 16 * s, d.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.moveTo(d.x - 12 * s + k * 10 * s, d.y - 4 * s); ctx.lineTo(d.x - 10 * s + k * 10 * s, d.y - 16 * s - (k % 2) * 6 * s); ctx.stroke();
    }
  } else if (d.type === 'frozenbush') {
    // buisson enneigé : silhouette verte sous la neige
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 11 * s, 4 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a7fa5';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(d.x + (k - 1) * 7 * s, d.y - (k === 1 ? 5 : 2) * s, (6.5 - k * 1.3) * s, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#eef6fc';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(d.x + (k - 1) * 7 * s, d.y - (k === 1 ? 7 : 4) * s, (5 - k * 1.2) * s, 0, TAU); ctx.fill();
    }
  } else if (d.type === 'snowdrift') {
    // congère importante : masse de neige bombée
    const s = d.s * 1.3;
    const sg = ctx.createRadialGradient(d.x - 4 * s, d.y - 6 * s, 2, d.x, d.y, 18 * s);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#c8dce8');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(d.x, d.y, 18 * s, 9 * s, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x - 8 * s, d.y - 4 * s, 8 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x + 8 * s, d.y - 4 * s, 8 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x, d.y - 8 * s, 7 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,200,230,0.5)';
    ctx.beginPath(); ctx.ellipse(d.x - 3 * s, d.y - 2 * s, 8 * s, 3 * s, -0.2, 0, TAU); ctx.fill();
  } else if (d.type === 'icearch') {
    // arche de glace naturelle : pont glacé
    const s = d.s;
    ctx.strokeStyle = 'rgba(200,230,248,0.95)'; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(d.x, d.y + 8 * s, 16 * s, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(d.x, d.y + 8 * s, 16 * s, Math.PI, 0); ctx.stroke();
    // stalactites sous l'arche
    ctx.fillStyle = 'rgba(180,220,245,0.9)';
    for (const k of [-0.5, 0, 0.5]) {
      const ax = d.x + k * 24 * s;
      ctx.beginPath(); ctx.moveTo(ax - 2 * s, d.y + 8 * s - Math.sqrt(Math.max(0, 256 - (k * 24) ** 2)) * s);
      ctx.lineTo(ax + 2 * s, d.y + 8 * s - Math.sqrt(Math.max(0, 256 - (k * 24) ** 2)) * s);
      ctx.lineTo(ax, d.y + 8 * s - Math.sqrt(Math.max(0, 256 - (k * 24) ** 2)) * s + 7 * s);
      ctx.closePath(); ctx.fill();
    }
  } else if (d.type === 'basalt') {
    // colonnes de basalte : orgues hexagonales
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 16 * s, 5 * s, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 4; k++) {
      const ox = (k - 1.5) * 7 * s, hgt = (14 + (k % 3) * 5) * s;
      const bg = ctx.createLinearGradient(d.x + ox - 4 * s, 0, d.x + ox + 4 * s, 0);
      bg.addColorStop(0, '#3a2a28'); bg.addColorStop(0.5, '#5c4038'); bg.addColorStop(1, '#2a1c1a');
      ctx.fillStyle = bg;
      ctx.fillRect(d.x + ox - 3.5 * s, d.y - hgt, 7 * s, hgt);
      ctx.fillStyle = 'rgba(255,120,50,0.7)';
      ctx.fillRect(d.x + ox - 3.5 * s, d.y - hgt, 7 * s, 1.5 * s);
    }
  } else if (d.type === 'magmavein') {
    // veine de magma : fissure large avec cœur incandescent
    const s = d.s * 1.4;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.strokeStyle = 'rgba(120,30,10,0.9)'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-18 * s, 0);
    ctx.lineTo(-8 * s, -5 * s); ctx.lineTo(2 * s, 3 * s); ctx.lineTo(12 * s, -4 * s); ctx.lineTo(18 * s, 2 * s);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,110,30,0.95)'; ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,140,0.9)'; ctx.lineWidth = 1.2 * s;
    ctx.stroke();
    ctx.restore();
    const cg = ctx.createRadialGradient(d.x, d.y, 1, d.x, d.y, 20 * s);
    cg.addColorStop(0, 'rgba(255,140,40,0.3)'); cg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(d.x, d.y, 20 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'sulfur') {
    // cristaux de soufre : aiguilles jaune vif
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 10 * s, 4 * s, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.4 + d.rot * 0.3;
      const len = (8 + (k % 3) * 4) * s;
      ctx.strokeStyle = k % 2 ? '#fff176' : '#fdd835'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + Math.cos(a) * len, d.y + Math.sin(a) * len); ctx.stroke();
      ctx.fillStyle = '#fffde7';
      ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * len, d.y + Math.sin(a) * len, 1.5 * s, 0, TAU); ctx.fill();
    }
  } else if (d.type === 'firegrass') {
    // herbe de feu : touffe de flammes naines
    const s = d.s;
    const fl = 0.75 + Math.sin(G.time * 7 + d.c * 25) * 0.25;
    for (let k = 0; k < 4; k++) {
      const ox = (k - 1.5) * 4 * s, hgt = (7 + (k % 3) * 3) * s * fl;
      const fg = ctx.createLinearGradient(d.x + ox, d.y, d.x + ox, d.y - hgt);
      fg.addColorStop(0, 'rgba(255,80,20,0.9)'); fg.addColorStop(1, `rgba(255,220,100,${0.7 * fl})`);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(d.x + ox - 2 * s, d.y);
      ctx.quadraticCurveTo(d.x + ox - 3 * s, d.y - hgt * 0.6, d.x + ox + Math.sin(G.time * 9 + k) * 2 * s, d.y - hgt);
      ctx.quadraticCurveTo(d.x + ox + 3 * s, d.y - hgt * 0.6, d.x + ox + 2 * s, d.y);
      ctx.closePath(); ctx.fill();
    }
  } else if (d.type === 'skull') {
    // tas de crânes : 2 crânes + ossements
    const s = d.s;
    ctx.fillStyle = 'rgba(240,230,210,0.9)';
    for (const [ox, oy, r2] of [[-6, 0, 5], [5, -3, 4.2]]) {
      ctx.beginPath(); ctx.arc(d.x + ox * s, d.y + oy * s, r2 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3d1f1c';
      ctx.beginPath(); ctx.arc(d.x + (ox - 1.8) * s, d.y + (oy - 1) * s, 1.1 * s, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(d.x + (ox + 1.8) * s, d.y + (oy - 1) * s, 1.1 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(240,230,210,0.9)';
    }
    ctx.strokeStyle = 'rgba(240,230,210,0.7)'; ctx.lineWidth = 1.8 * s;
    ctx.beginPath(); ctx.moveTo(d.x + 8 * s, d.y + 3 * s); ctx.lineTo(d.x + 14 * s, d.y + 6 * s); ctx.stroke();
    ctx.beginPath(); ctx.arc(d.x + 15 * s, d.y + 6.5 * s, 2 * s, 0, TAU); ctx.stroke();
  } else if (d.type === 'roots') {
    // racines qui percent : tentacules sombres depuis le sol
    const s = d.s;
    ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = d.c * TAU + k * 1.7;
      const bx = d.x + Math.cos(a) * 12 * s, by = d.y + Math.sin(a) * 6 * s;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(a + 1) * 6 * s, by - 10 * s, bx + Math.cos(a) * 3 * s, by - (14 + k * 3) * s);
      ctx.stroke();
      ctx.strokeStyle = '#54402c'; ctx.lineWidth = 1.2 * s;
      ctx.stroke(); ctx.lineWidth = 3 * s; ctx.strokeStyle = '#3a2a1c';
    }
    ctx.fillStyle = 'rgba(140,200,90,0.7)';
    ctx.beginPath(); ctx.arc(d.x - 4 * s, d.y - 12 * s, 2 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'drip') {
    // stalactite suintante : racine + goutte
    const s = d.s;
    ctx.strokeStyle = '#4a5a3a'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 2 * s, d.y + 8 * s); ctx.stroke();
    const pulse = 0.6 + Math.sin(G.time * 2 + d.c * 20) * 0.4;
    ctx.fillStyle = `rgba(140,200,160,${0.5 + pulse * 0.4})`;
    ctx.beginPath(); ctx.ellipse(d.x + 2 * s, d.y + 12 * s, 1.8 * s, 3 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(200,240,220,0.8)';
    ctx.beginPath(); ctx.arc(d.x + 2 * s - 0.6 * s, d.y + 11 * s, 0.7 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'pipe2') {
    // colonne de tuyaux : verticaux avec vannes
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 3, 12 * s, 4 * s, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 3; k++) {
      const px = d.x + (k - 1) * 7 * s, ph = (16 + (k % 2) * 8) * s;
      const pg = ctx.createLinearGradient(px - 3 * s, 0, px + 3 * s, 0);
      pg.addColorStop(0, '#2c3f24'); pg.addColorStop(0.5, '#5c7a52'); pg.addColorStop(1, '#1a2415');
      ctx.fillStyle = pg;
      ctx.fillRect(px - 3 * s, d.y - ph, 6 * s, ph);
      ctx.fillStyle = '#26381f';
      ctx.fillRect(px - 4 * s, d.y - ph - 2 * s, 8 * s, 3 * s);
    }
    // roue de vanne
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.8 * s;
    ctx.beginPath(); ctx.arc(d.x + 8 * s, d.y - 10 * s, 4 * s, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x + 4 * s, d.y - 10 * s); ctx.lineTo(d.x + 12 * s, d.y - 10 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x + 8 * s, d.y - 14 * s); ctx.lineTo(d.x + 8 * s, d.y - 6 * s); ctx.stroke();
  } else if (d.type === 'cage') {
    // cage suspendue : barreaux + chaîne
    const s = d.s;
    ctx.strokeStyle = '#5a5048'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(d.x, d.y - 20 * s); ctx.lineTo(d.x, d.y - 8 * s); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(d.x - 7 * s, d.y - 8 * s, 14 * s, 10 * s);
    ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = 1.8 * s;
    ctx.strokeRect(d.x - 7 * s, d.y - 8 * s, 14 * s, 10 * s);
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(d.x + k * 3 * s, d.y - 8 * s); ctx.lineTo(d.x + k * 3 * s, d.y + 2 * s); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(d.x - 7 * s, d.y - 4 * s); ctx.lineTo(d.x + 7 * s, d.y - 4 * s); ctx.stroke();
  } else if (d.type === 'banner') {
    // bannière rapiécée : tissu déchiré au bout d'une poutre
    const s = d.s;
    ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(d.x - 10 * s, d.y - 22 * s); ctx.lineTo(d.x + 10 * s, d.y - 22 * s); ctx.stroke();
    ctx.fillStyle = '#5a4a6a';
    ctx.beginPath();
    ctx.moveTo(d.x - 8 * s, d.y - 22 * s);
    ctx.lineTo(d.x + 8 * s, d.y - 22 * s);
    ctx.lineTo(d.x + 8 * s, d.y - 6 * s);
    ctx.lineTo(d.x + 4 * s, d.y - 10 * s); ctx.lineTo(d.x, d.y - 5 * s);
    ctx.lineTo(d.x - 4 * s, d.y - 11 * s); ctx.lineTo(d.x - 8 * s, d.y - 7 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#9ccc65';
    ctx.beginPath(); ctx.arc(d.x, d.y - 16 * s, 2.5 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'glowshroom') {
    // champignon bioluminescent géant
    const s = d.s * 1.5;
    const pulse = 0.7 + Math.sin(G.time * 2 + d.c * 25) * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 12 * s, 5 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8e8c8';
    ctx.fillRect(d.x - 4 * s, d.y - 16 * s, 8 * s, 17 * s);
    const mg = ctx.createRadialGradient(d.x, d.y - 18 * s, 1, d.x, d.y - 16 * s, 16 * s);
    mg.addColorStop(0, `rgba(160,255,190,${pulse})`); mg.addColorStop(1, `rgba(50,180,90,${0.85 * pulse})`);
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(d.x, d.y - 16 * s, 14 * s, Math.PI, 0); ctx.fill();
    ctx.fillStyle = `rgba(220,255,230,${pulse})`;
    for (const [ox, oy] of [[-5, -19], [3, -21], [6, -16]]) {
      ctx.beginPath(); ctx.arc(d.x + ox * s, d.y + oy * s, 1.6 * s, 0, TAU); ctx.fill();
    }
    const lg = ctx.createRadialGradient(d.x, d.y - 14 * s, 2, d.x, d.y - 14 * s, 24 * s);
    lg.addColorStop(0, `rgba(140,255,170,${0.25 * pulse})`); lg.addColorStop(1, 'rgba(140,255,170,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(d.x, d.y - 14 * s, 24 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'tunnel') {
    // arche de tunnel : entrée sombre dans la paroi
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, 20 * s, 7 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a2415';
    ctx.beginPath();
    ctx.moveTo(d.x - 16 * s, d.y + 4 * s);
    ctx.lineTo(d.x - 16 * s, d.y - 8 * s);
    ctx.quadraticCurveTo(d.x, d.y - 26 * s, d.x + 16 * s, d.y - 8 * s);
    ctx.lineTo(d.x + 16 * s, d.y + 4 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a5a3a'; ctx.lineWidth = 3 * s; ctx.stroke();
    // briques autour
    ctx.strokeStyle = 'rgba(120,150,90,0.4)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(d.x - 16 * s + k * 8 * s, d.y + 4 * s); ctx.lineTo(d.x - 16 * s + k * 8 * s, d.y - 6 * s); ctx.stroke();
    }
  } else if (d.type === 'floatrock') {
    // rocher flottant : suspendu avec lueur sous-jacente
    const s = d.s;
    const bob = Math.sin(G.time * 1.5 + d.c * 20) * 3 * s;
    const fy = d.y + bob;
    const lg = ctx.createRadialGradient(d.x, fy + 12 * s, 1, d.x, fy + 12 * s, 14 * s);
    lg.addColorStop(0, 'rgba(140,180,255,0.5)'); lg.addColorStop(1, 'rgba(140,180,255,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(d.x, fy + 12 * s, 14 * s, 0, TAU); ctx.fill();
    const rg = ctx.createRadialGradient(d.x - 3 * s, fy - 4 * s, 1, d.x, fy, 10 * s);
    rg.addColorStop(0, '#6a7490'); rg.addColorStop(1, '#2e3444');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(d.x - 9 * s, fy + 3 * s); ctx.lineTo(d.x - 5 * s, fy - 6 * s);
    ctx.lineTo(d.x + 2 * s, fy - 9 * s); ctx.lineTo(d.x + 8 * s, fy - 2 * s);
    ctx.lineTo(d.x + 6 * s, fy + 4 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(180,200,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
  } else if (d.type === 'cosmictree') {
    // arbre cosmique : tronc violet + cimes lumineuses
    const s = d.s * 1.3;
    const bob = Math.sin(G.time * 1.2 + d.c * 15) * 2 * s;
    const ty = d.y + bob;
    const lg = ctx.createRadialGradient(d.x, ty + 14 * s, 1, d.x, ty + 14 * s, 16 * s);
    lg.addColorStop(0, 'rgba(200,140,255,0.4)'); lg.addColorStop(1, 'rgba(200,140,255,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(d.x, ty + 14 * s, 16 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a3060'; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(d.x, ty + 10 * s); ctx.quadraticCurveTo(d.x - 2 * s, ty, d.x + 1 * s, ty - 14 * s); ctx.stroke();
    const tips = ['#e040fb', '#7c4dff', '#18ffff', '#ff4081'];
    for (let k = 0; k < 4; k++) {
      const a = d.c * TAU + k * 1.6;
      const tx2 = d.x + Math.cos(a) * 8 * s, ty2 = ty - (10 + (k % 2) * 6) * s + Math.sin(a) * 4 * s;
      ctx.strokeStyle = '#5a4080'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.moveTo(d.x, ty - 12 * s); ctx.lineTo(tx2, ty2); ctx.stroke();
      const pulse = 0.7 + Math.sin(G.time * 3 + k * 2 + d.c * 10) * 0.3;
      ctx.fillStyle = tips[k % 4]; ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.beginPath(); ctx.arc(tx2, ty2, (2.5 + pulse) * s, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else if (d.type === 'energycrystal') {
    // grand cristal d'énergie : monolithe facetté pulsant
    const s = d.s * 1.4;
    const pulse = 0.75 + Math.sin(G.time * 2.5 + d.c * 20) * 0.25;
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    const cg = ctx.createLinearGradient(0, -20 * s, 0, 14 * s);
    cg.addColorStop(0, `rgba(140,220,255,${0.95 * pulse})`); cg.addColorStop(1, `rgba(60,120,220,${0.85 * pulse})`);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(0, -20 * s); ctx.lineTo(7 * s, -8 * s); ctx.lineTo(5 * s, 12 * s);
    ctx.lineTo(-5 * s, 12 * s); ctx.lineTo(-7 * s, -8 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(220,245,255,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -20 * s); ctx.lineTo(0, 10 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7 * s, -8 * s); ctx.lineTo(7 * s, -8 * s); ctx.stroke();
    ctx.restore();
    const lg = ctx.createRadialGradient(d.x, d.y - 4 * s, 2, d.x, d.y - 4 * s, 22 * s);
    lg.addColorStop(0, `rgba(120,200,255,${0.3 * pulse})`); lg.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(d.x, d.y - 4 * s, 22 * s, 0, TAU); ctx.fill();
  } else if (d.type === 'holo') {
    // pylône holographique : colonne d'énergie + anneaux
    const s = d.s;
    const pulse = 0.7 + Math.sin(G.time * 3 + d.c * 20) * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 3, 10 * s, 4 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2e3444';
    ctx.fillRect(d.x - 4 * s, d.y - 4 * s, 8 * s, 8 * s);
    ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 1.5;
    ctx.strokeRect(d.x - 4 * s, d.y - 4 * s, 8 * s, 8 * s);
    // faisceau
    const bg = ctx.createLinearGradient(d.x, d.y - 4 * s, d.x, d.y - 34 * s);
    bg.addColorStop(0, `rgba(100,200,255,${0.5 * pulse})`); bg.addColorStop(1, 'rgba(100,200,255,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(d.x - 5 * s, d.y - 34 * s, 10 * s, 30 * s);
    // anneaux orbitaux
    for (let k = 0; k < 2; k++) {
      const a = G.time * (1.5 + k * 0.7) + d.c * TAU + k * Math.PI;
      const rx = 10 * s + k * 4 * s;
      ctx.strokeStyle = `rgba(140,220,255,${0.5 * pulse})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(d.x + Math.cos(a) * 4 * s, d.y - 18 * s + Math.sin(a) * 3 * s, rx * 0.5, rx * 0.2, a, 0, TAU); ctx.stroke();
    }
  } else if (d.type === 'alienflora') {
    // flore alien : tiges avec pointes lumineuses
    const s = d.s;
    const cols = ['#ff4081', '#7c4dff', '#00e5ff', '#76ff03'];
    for (let k = 0; k < 4; k++) {
      const a = d.c * TAU + k * 1.8;
      const tx2 = d.x + Math.cos(a) * 7 * s, ty2 = d.y - (8 + (k % 3) * 5) * s;
      const sway = Math.sin(G.time * 2 + k + d.c * 10) * 1.5 * s;
      ctx.strokeStyle = '#3a4a6a'; ctx.lineWidth = 1.8 * s;
      ctx.beginPath(); ctx.moveTo(d.x, d.y);
      ctx.quadraticCurveTo(d.x + Math.cos(a) * 5 * s, d.y - 8 * s, tx2 + sway, ty2); ctx.stroke();
      const pulse = 0.6 + Math.sin(G.time * 4 + k * 1.7 + d.c * 10) * 0.4;
      ctx.fillStyle = cols[(d.c * 4 + k) % 4]; ctx.globalAlpha = 0.6 + pulse * 0.4;
      ctx.beginPath(); ctx.arc(tx2 + sway, ty2, (2 + pulse) * s, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else if (d.type === 'ruinpillar') {
    // pilier de ruine alien : colonne brisée gravée
    const s = d.s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 3, 10 * s, 4 * s, 0, 0, TAU); ctx.fill();
    const pg = ctx.createLinearGradient(d.x - 7 * s, 0, d.x + 7 * s, 0);
    pg.addColorStop(0, '#3a4150'); pg.addColorStop(0.5, '#5a6272'); pg.addColorStop(1, '#232833');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(d.x - 7 * s, d.y + 3 * s); ctx.lineTo(d.x - 6 * s, d.y - 14 * s);
    ctx.lineTo(d.x - 2 * s, d.y - 18 * s); ctx.lineTo(d.x + 3 * s, d.y - 13 * s);
    ctx.lineTo(d.x + 6 * s, d.y - 16 * s); ctx.lineTo(d.x + 7 * s, d.y + 3 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    // gravures lumineuses
    ctx.strokeStyle = `rgba(120,200,255,${0.5 + Math.sin(G.time * 2 + d.c * 20) * 0.3})`; ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.moveTo(d.x - 3 * s, d.y - (6 + k * 4) * s); ctx.lineTo(d.x + 3 * s, d.y - (6 + k * 4) * s); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160,200,255,0.9)';
    ctx.beginPath(); ctx.arc(d.x, d.y - 10 * s, 2 * s, 0, TAU); ctx.fill();
  }
}
