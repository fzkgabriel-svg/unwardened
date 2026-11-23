// js/menu/campaign.js — CARTE DU MONDE DE CAMPAGNE (refonte totale)
// Six territoires reliés par des sentiers et des portails :
// Terre, Glace, Enfer, Égouts, Espace. Survol lumineux, zoom de caméra
// à la sélection, particules d'ambiance par biome, fiche détaillée
// animée, emblèmes de victoire et animation de déblocage.
import { G, ctx, W, H, TAU } from '../state.js';
import { roundRect, hexA } from '../utils.js';
import { campaignUnlocked, tutorialRequired, inR, UI, SERIF, C_TEXT, C_MUTED } from './common.js';
import { sfxClick, sfxPortal } from '../audio.js';
import { startGame } from './flow.js';
import { DIFFS, diffProg, diffPlayable } from '../difficulty.js';

// ---------- données ----------
const INFO = [
  { icon: '🌿', diff: '★ NORMAL',        diffCol: '#69f0ae', waves: 20,
    desc: 'Les Terres Oubliées : plaines verdoyantes, villages abandonnés et la sombre tanière du Seigneur Oublié.',
    boss: 'Seigneur Oublié', reward: 'Débloque la campagne Terre Gelée' },
  { icon: '❄', diff: '★★ MOYEN',         diffCol: '#4fc3f7', waves: 25,
    desc: 'La Terre Gelée : montagnes enneigées, glaciers et créatures des grottes. Le Souverain de Glace règne au sommet.',
    boss: 'Souverain de Glace', reward: 'Pluie de Glace (ultime glaciale) + coffre' },
  { icon: '🔥', diff: '★★★ DIFFICILE',    diffCol: '#ff7043', waves: 30,
    desc: 'Les Enfers : braise, damnation et golems de lave. Le Baron de l\'Enfer attend sur son trône de cendres.',
    boss: 'Le Baron de l\'Enfer', reward: 'Colère Infernale (ultime volcanique) + titan' },
  { icon: '🧪', diff: '★★★★ TRÈS DIFFICILE', diffCol: '#dce775', waves: 35,
    desc: 'Les Égouts : tunnels putrides, rats géants et le Tyran des Profondeurs dans les flots d\'acide.',
    boss: 'Le Tyran des Profondeurs', reward: 'Système de Modules + emplacements passifs' },
  { icon: '🛸', diff: '★★★★★ EXPERT',     diffCol: '#b388ff', waves: 40,
    desc: 'L\'Espace : avant-poste perdu à des années-lumière. L\'Abomination Cosmique dévore les étoiles.',
    boss: 'L\'Abomination Cosmique', reward: 'Arc Cinétique Cosmique' },
  { icon: '🌪️', diff: '★★★★★★ LÉGENDAIRE', diffCol: '#4fc3f7', waves: 45,
    desc: 'Le Royaume des Tempêtes : falaises suspendues au-dessus des nuages, tornades géantes et le Souverain des Ouragans.',
    boss: 'Le Souverain des Ouragans', reward: '2ᵉ emplacement passif + victoire ultime' },
];
const NAMES = ['LES TERRES OUBLIÉES', 'LA TERRE GELÉE', 'LES ENFERS', 'LES ÉGOUTS', 'L\'ESPACE', 'LE ROYAUME DES TEMPÊTES'];
// territoires : position, rayon, palette, façon de remplir le blob (graine fixe)
const TERR = [
  { x: 185, y: 345, r: 96,  c1: '#7ec850', c2: '#2f5d22', rim: '#a8e063', part: '#d8f7a8', dark: '#1c3310', kind: 'terre' },
  { x: 350, y: 185, r: 96,  c1: '#a8dcf2', c2: '#3d7ea6', rim: '#cdeffd', part: '#eefaff', dark: '#0d2438', kind: 'glace' },
  { x: 530, y: 350, r: 100, c1: '#e8704a', c2: '#6e1d10', rim: '#ffab70', part: '#ffc38a', dark: '#260a04', kind: 'enfer' },
  { x: 700, y: 185, r: 96,  c1: '#b8cc3f', c2: '#3d5218', rim: '#d7e86a', part: '#ecf7a0', dark: '#141f05', kind: 'egout' },
  { x: 870, y: 350, r: 100, c1: '#9a86d8', c2: '#2a1650', rim: '#c9b3f5', part: '#d9ccff', dark: '#0c0620', kind: 'espace' },
  { x: 1035, y: 175, r: 92, c1: '#7fb8d8', c2: '#2c4a63', rim: '#a8d8f0', part: '#cfeaff', dark: '#0d1a26', kind: 'tempete' },
];
// blob organique déterministe par territoire (12 sommets)
function blobPts(c) {
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * TAU;
    const rr = c.r * (0.8 + ((Math.sin(i * 12.9898 + c.x) * 43758.5453) % 1 + 1) % 1 * 0.28);
    pts.push([c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr * 0.86]);
  }
  return pts;
}
const BLOBS = TERR.map(blobPts);
function inTerr(c, x, y) {
  // test point-dans-polygone
  const pts = BLOBS[c]; let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside || Math.hypot(x - TERR[c].x, y - TERR[c].y) < TERR[c].r * 0.55;
}
function terrAt(x, y) { for (let c = 0; c < 6; c++) if (inTerr(c, x, y)) return c; return -1; }

// sentiers animés entre territoires (courbes vers le haut)
function pathCurve(a, b) {
  const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 60;
  return { mx, my };
}

// ---------- particules d'ambiance ----------
function campParts() { return G._campParts = G._campParts || []; }
function spawnCampPart() {
  const ps = campParts();
  if (ps.length > 110) return;
  const c = (Math.random() * 6) | 0, t = TERR[c];
  const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * t.r * 0.9;
  ps.push({
    x: t.x + Math.cos(a) * rr, y: t.y + Math.sin(a) * rr * 0.85,
    vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 8 - (c === 2 || c === 4 ? 12 : c === 1 ? 16 : c === 5 ? 26 : -4),
    life: 4 + Math.random() * 4, max: 8, col: Math.random() < 0.5 ? t.part : t.rim,
    r: 1 + Math.random() * 2.2, tw: Math.random() * TAU, c,
  });
}
function updateCampParts(dt) {
  const ps = campParts();
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.tw += dt * 3;
    if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) ps.splice(i, 1);
  }
  if (Math.random() < dt * 40) spawnCampPart();
}

// ---------- caméra : zoom doux vers le territoire sélectionné ----------
function campCam(dt) {
  const cam = G._campCam = G._campCam || { z: 1, cx: W / 2, cy: H / 2 };
  const sel = G.campaignSel === undefined || G.campaignSel === null ? -1 : G.campaignSel;
  const tgt = sel >= 0 ? { z: 1.07, cx: TERR[sel].x, cy: TERR[sel].y - 30 } : { z: 1, cx: W / 2, cy: H / 2 - 20 };
  const k = Math.min(1, dt * 4);
  cam.z += (tgt.z - cam.z) * k; cam.cx += (tgt.cx - cam.cx) * k; cam.cy += (tgt.cy - cam.cy) * k;
}

// ---------- déblocages : animation à la transition ----------
function checkUnlockFx() {
  if (!G._campSeen) { // première visite : état initial silencieux, pas de faux déblocages
    G._campSeen = [0, 1, 2, 3, 4, 5].map(c => campaignUnlocked(c));
    return;
  }
  const seen = G._campSeen;
  for (let c = 0; c < 6; c++) {
    const u = campaignUnlocked(c);
    if (u && !seen[c]) {
      seen[c] = true;
      G._campUnlockFx = { c, t: G.time || 0 };
      if (G.time > 1) sfxPortal();
    } else if (!u) seen[c] = false;
  }
}

// ---------- fiche + boutons (géométrie partagée dessin/clic) ----------
export function campaignFiche() { return { x: W / 2 - 410, y: H - 258, w: 820, h: 252 }; }
// vagues de base de chaque campagne (campagne -> vague finale en NORMAL)
const BASE_WAVES = [20, 25, 30, 35, 40, 45];
export function campaignWaves(c, d) { return BASE_WAVES[c] + (DIFFS[d] ? DIFFS[d].waveBonus : 0); }
// les trois cartes de difficulté : Normal / Difficile / Expert
export function campaignDiffCards(c) {
  const f = campaignFiche();
  const cw = (f.w - 40 - 24) / 3, ch = 104, gap = 12;
  const y = f.y + f.h - ch - 12;
  const x0 = f.x + 20;
  return DIFFS.map((d, i) => ({ d: d.id, x: x0 + i * (cw + gap), y, w: cw, h: ch }));
}
function backBtn() { return { x: 30, y: H - 60, w: 160, h: 40 }; }

export function campaignClickAt(x, y) {
  if (inR(backBtn(), x, y)) { G.menuView = 'main'; return 'back'; }
  const c = G.campaignSel;
  if (c !== null && c !== undefined && campaignUnlocked(c)) {
    G.campaignSel = c;
    // clic sur une carte de difficulté : lance le niveau dans cette difficulté
    for (const cd of campaignDiffCards(c)) {
      if (inR(cd, x, y)) {
        const d = cd.d;
        if (!diffPlayable(c, d)) { sfxClick(); return 'locked'; }
        G.campaign = c;
        G.difficulty = d;
        startGame();
        return 'play';
      }
    }
  }
  const t = terrAt(x, y);
  if (t >= 0) { G.campaignSel = t; sfxClick(); return 'select'; }
  return null;
}

// ---------- décor vectoriel d'un territoire ----------
function drawTerrDecor(kind, cx, cy, r, t, unlocked) {
  ctx.save();
  ctx.globalAlpha = unlocked ? 0.9 : 0.3;
  const items = [
    [-0.55, -0.25], [-0.2, -0.5], [0.15, -0.35], [0.5, -0.15], [-0.4, 0.15], [0.05, 0.1], [0.45, 0.3], [-0.05, 0.45], [0.3, -0.55], [-0.6, 0.4],
  ];
  items.forEach(([ox, oy], i) => {
    const px = cx + ox * r * 1.7, py = cy + oy * r * 1.5;
    const bob = Math.sin(t * 1.6 + i * 2.1) * 2;
    ctx.save(); ctx.translate(px, py + bob);
    switch (kind) {
      case 'terre': // pins + maison + fleurs
        if (i % 3 === 0) { // pin
          ctx.fillStyle = '#2e5c22';
          ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-7, 4); ctx.lineTo(7, 4); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#4a3421'; ctx.fillRect(-1.5, 4, 3, 5);
        } else if (i % 3 === 1) { // fleur
          ctx.fillStyle = ['#ff8a80', '#ffd54f', '#f48fb1'][i % 3];
          ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#3f6b2a'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.stroke();
        } else { // rocher
          ctx.fillStyle = '#6d7f5a';
          ctx.beginPath(); ctx.ellipse(0, 0, 6, 4, 0, 0, TAU); ctx.fill();
        }
        break;
      case 'glace': // pics enneigés + cristaux
        if (i % 2 === 0) {
          ctx.fillStyle = '#dff2ff';
          ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(-8, 5); ctx.lineTo(8, 5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#8fd4f5';
          ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(180,235,255,0.85)';
          ctx.save(); ctx.rotate(0.6);
          ctx.fillRect(-1.5, -9, 3, 14); ctx.restore();
          ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-3, -13); ctx.lineTo(3, -13); ctx.closePath(); ctx.fill();
        }
        break;
      case 'enfer': // volcan + flammes + os
        if (i % 3 === 0) { // volcan miniature
          ctx.fillStyle = '#4a2018';
          ctx.beginPath(); ctx.moveTo(-11, 6); ctx.lineTo(0, -12); ctx.lineTo(11, 6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ff7043';
          ctx.beginPath(); ctx.arc(0, -10, 3 + Math.sin(t * 6 + i) * 1, 0, TAU); ctx.fill();
        } else if (i % 3 === 1) { // flamme
          const f = 6 + Math.sin(t * 7 + i * 1.7) * 2;
          ctx.fillStyle = 'rgba(255,140,50,0.9)';
          ctx.beginPath(); ctx.moveTo(0, -f); ctx.quadraticCurveTo(5, -2, 0, 3); ctx.quadraticCurveTo(-5, -2, 0, -f); ctx.fill();
        } else { // ossements
          ctx.strokeStyle = '#d7c9a8'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(5, -2); ctx.stroke();
          ctx.beginPath(); ctx.arc(-5, 2, 2.4, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.arc(5, -2, 2.4, 0, TAU); ctx.stroke();
        }
        break;
      case 'egout': // tuyaux + champignons + bulles
        if (i % 3 === 0) { // tuyau
          ctx.fillStyle = '#5a6a42';
          ctx.fillRect(-9, -3, 18, 6);
          ctx.fillStyle = '#7a8a5a';
          ctx.beginPath(); ctx.arc(-9, 0, 3.4, 0, TAU); ctx.arc(9, 0, 3.4, 0, TAU); ctx.fill();
        } else if (i % 3 === 1) { // champignon
          ctx.fillStyle = '#c5e1a5'; ctx.fillRect(-1.5, 0, 3, 6);
          ctx.fillStyle = '#9ccc65';
          ctx.beginPath(); ctx.arc(0, 0, 5.5, Math.PI, 0); ctx.closePath(); ctx.fill();
        } else { // bulle
          ctx.strokeStyle = 'rgba(200,255,150,0.8)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(0, -2, 3 + Math.sin(t * 3 + i) * 0.8, 0, TAU); ctx.stroke();
        }
        break;
      case 'espace': // planète + étoiles + cristal + monolithe
        if (i % 4 === 0) { // planète
          const pg = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
          pg.addColorStop(0, '#c9b8ff'); pg.addColorStop(1, '#5a3fa0');
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(200,180,255,0.7)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(0, 0, 11, 3.6, -0.4, 0, TAU); ctx.stroke();
        } else if (i % 4 === 1) { // étoile scintillante
          const s = 3 + Math.sin(t * 5 + i) * 1.2;
          ctx.fillStyle = '#e8e4ff';
          ctx.beginPath();
          ctx.moveTo(0, -s); ctx.quadraticCurveTo(0.8, -0.8, s, 0); ctx.quadraticCurveTo(0.8, 0.8, 0, s);
          ctx.quadraticCurveTo(-0.8, 0.8, -s, 0); ctx.quadraticCurveTo(-0.8, -0.8, 0, -s);
          ctx.fill();
        } else if (i % 4 === 2) { // cristal
          ctx.fillStyle = 'rgba(24,255,255,0.75)';
          ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(4, 0); ctx.lineTo(0, 8); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
        } else { // monolithe
          ctx.fillStyle = '#4a4170';
          ctx.fillRect(-3, -11, 6, 17);
          ctx.fillStyle = 'rgba(24,255,255,0.5)';
          ctx.fillRect(-1, -9, 2, 13);
        }
        break;
      case 'tempete': // tornade + nuages + éclairs + moulins
        if (i % 4 === 0) { // tornade miniature
          ctx.fillStyle = 'rgba(200,230,250,0.55)';
          ctx.beginPath();
          ctx.moveTo(0, -14);
          ctx.quadraticCurveTo(-5, -6, -8, 0);
          ctx.quadraticCurveTo(0, 5, 8, 0);
          ctx.quadraticCurveTo(5, -6, 0, -14);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(240,250,255,0.8)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(5, -4); ctx.moveTo(-4, -6); ctx.lineTo(4, -1); ctx.stroke();
        } else if (i % 4 === 1) { // nuage
          ctx.fillStyle = 'rgba(230,242,252,0.8)';
          ctx.beginPath(); ctx.arc(-3, 2, 4.5, 0, TAU); ctx.arc(2, 0, 5.5, 0, TAU); ctx.arc(6, 3, 3.5, 0, TAU); ctx.fill();
        } else if (i % 4 === 2) { // éclair
          const s = 0.6 + 0.4 * Math.abs(Math.sin(t * 4 + i * 2));
          ctx.strokeStyle = `rgba(227,242,253,${0.5 * s + 0.3})`; ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -12); ctx.lineTo(3, -6); ctx.lineTo(-2, -3); ctx.lineTo(3, 4);
          ctx.stroke();
        } else { // moulin
          ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -8); ctx.stroke();
          ctx.save(); ctx.translate(0, -8); ctx.rotate(t * 2 + i);
          ctx.fillStyle = '#eceff1';
          ctx.fillRect(-1.5, -9, 3, 9); ctx.fillRect(-9, -1.5, 9, 3);
          ctx.restore();
        }
        break;
    }
    ctx.restore();
  });
  ctx.restore();
}

// ---------- aperçu animé du monde (fiche) ----------
function drawPreview(c, x, y, s, t) {
  const kind = TERR[c].kind;
  ctx.save();
  ctx.translate(x, y); ctx.scale(s / 120, s / 120);
  ctx.beginPath(); ctx.arc(0, 0, 58, 0, TAU); ctx.clip();
  const g = ctx.createLinearGradient(0, -58, 0, 58);
  g.addColorStop(0, TERR[c].c1); g.addColorStop(1, TERR[c].dark);
  ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120);
  // horizon + silhouettes animées
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.moveTo(-60, 20);
  for (let i = 0; i <= 8; i++) ctx.lineTo(-60 + i * 15, 20 + Math.sin(i * 1.7 + c) * 8);
  ctx.lineTo(60, 60); ctx.lineTo(-60, 60); ctx.closePath(); ctx.fill();
  switch (kind) {
    case 'terre':
      ctx.fillStyle = '#1e4015';
      for (const [tx, th] of [[-30, 22], [-5, 30], [20, 18], [42, 14]]) {
        ctx.beginPath(); ctx.moveTo(tx, 20 - th); ctx.lineTo(tx - 8, 20); ctx.lineTo(tx + 8, 20); ctx.closePath(); ctx.fill();
      }
      break;
    case 'glace':
      ctx.fillStyle = '#eaf7ff';
      for (const [tx, th] of [[-30, 30], [0, 40], [30, 26]]) {
        ctx.beginPath(); ctx.moveTo(tx, 20 - th); ctx.lineTo(tx - 10, 20); ctx.lineTo(tx + 10, 20); ctx.closePath(); ctx.fill();
      }
      break;
    case 'enfer':
      ctx.fillStyle = '#3a140c';
      ctx.beginPath(); ctx.moveTo(-45, 20); ctx.lineTo(-10, -18); ctx.lineTo(10, -18); ctx.lineTo(45, 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,${100 + Math.sin(t * 6) * 60 | 0},40,0.95)`;
      ctx.beginPath(); ctx.arc(-10, -16, 4 + Math.sin(t * 8) * 1.4, 0, TAU); ctx.fill();
      break;
    case 'egout':
      ctx.fillStyle = '#26331a';
      ctx.fillRect(-50, 8, 100, 12);
      ctx.fillStyle = '#4a5a3a'; ctx.fillRect(-50, 4, 100, 6);
      for (let i = 0; i < 5; i++) {
        const by = 2 - ((t * 20 + i * 13) % 26);
        ctx.strokeStyle = 'rgba(200,255,150,0.7)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(-40 + i * 20, by, 2.5, 0, TAU); ctx.stroke();
      }
      break;
    case 'espace':
      for (let i = 0; i < 8; i++) {
        const sx = Math.sin(i * 7.3) * 45, sy = Math.cos(i * 5.1) * 40;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i * 2));
        ctx.fillStyle = `rgba(230,220,255,${tw})`;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.fillStyle = '#8a6fd0';
      ctx.beginPath(); ctx.arc(0, -4, 16, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,180,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -4, 24, 7, -0.35, 0, TAU); ctx.stroke();
      break;
    case 'tempete':
      // ciel orageux + tornade animée + embruns
      const pg2 = ctx.createLinearGradient(0, -58, 0, 20);
      pg2.addColorStop(0, '#33506b'); pg2.addColorStop(1, '#7fa8c4');
      ctx.fillStyle = pg2; ctx.fillRect(-60, -60, 120, 46);
      // nuages sombres
      ctx.fillStyle = 'rgba(70,95,120,0.8)';
      for (const [nx, ny, nr] of [[-30, -20, 16], [10, -26, 20], [40, -14, 14]]) {
        ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.arc(nx + nr * 0.7, ny + 4, nr * 0.7, 0, TAU); ctx.fill();
      }
      // tornade centrale
      ctx.save(); ctx.translate(0, 14);
      ctx.fillStyle = 'rgba(210,235,252,0.85)';
      ctx.beginPath();
      ctx.moveTo(-6, -58); ctx.quadraticCurveTo(-10, -20, -16, 6);
      ctx.quadraticCurveTo(0, 12, 16, 6); ctx.quadraticCurveTo(10, -20, 6, -58);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let s = 0; s < 18; s++) {
        const a2 = s * 0.5 + t * 7;
        const rr2 = 14 * (0.2 + s * 0.022);
        const xx = Math.cos(a2) * rr2 * 0.55, yy = -rr2 * 0.8 + s * 3.4;
        s === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.restore();
      // embruns
      for (let i = 0; i < 6; i++) {
        const ex = -50 + ((t * 130 + i * 41) % 100);
        const ey = -30 + Math.sin(t * 2 + i) * 8 + i * 6;
        ctx.strokeStyle = 'rgba(230,245,255,0.6)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + 14, ey); ctx.stroke();
      }
      // éclairs
      if (Math.sin(t * 0.9) > 0.92) {
        ctx.strokeStyle = 'rgba(240,250,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(28, -50); ctx.lineTo(32, -36); ctx.lineTo(26, -30); ctx.lineTo(34, -14);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
  // anneau
  ctx.strokeStyle = hexA(TERR[c].rim, 0.7); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, s / 2, 0, TAU); ctx.stroke();
}

// ---------- territoire : ombre, blob, décor, portails, emblèmes ----------
function drawTerritory(c, t, dt) {
  const terr = TERR[c], info = INFO[c], unlocked = campaignUnlocked(c);
  const done = !!(G.stats.campaignDone && G.stats.campaignDone[c]);
  const sel = G.campaignSel === c;
  const hov = G._campHover === c;
  const pts = BLOBS[c];

  // halo d'ambiance
  const hg = ctx.createRadialGradient(terr.x, terr.y, terr.r * 0.3, terr.x, terr.y, terr.r * 1.7);
  hg.addColorStop(0, hexA(terr.c1, unlocked ? (sel ? 0.4 : 0.2) : 0.07));
  hg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(terr.x, terr.y, terr.r * 1.7, 0, TAU); ctx.fill();

  // ombre portée
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  pts.forEach(([px, py], i) => i ? ctx.lineTo(px + 6, py + 9) : ctx.moveTo(px + 6, py + 9));
  ctx.closePath(); ctx.fill();

  // continent : dégradé vertical + texture interne
  const bg = ctx.createLinearGradient(terr.x, terr.y - terr.r, terr.x, terr.y + terr.r);
  bg.addColorStop(0, unlocked ? terr.c1 : '#23262c');
  bg.addColorStop(1, unlocked ? terr.c2 : '#14161a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
  ctx.closePath(); ctx.fill();
  // halo intérieur lumineux (côte)
  ctx.strokeStyle = unlocked ? hexA(terr.rim, hov || sel ? 0.95 : 0.55) : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = hov || sel ? 3.5 : 2;
  ctx.stroke();
  // relief : anneaux concentriques subtils
  if (unlocked) {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(terr.x, terr.y + terr.r * 0.32, terr.r * 0.66, terr.r * 0.3, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(terr.x, terr.y - terr.r * 0.3, terr.r * 0.5, terr.r * 0.2, 0, 0, TAU); ctx.stroke();
  }
  drawTerrDecor(terr.kind, terr.x, terr.y, terr.r, t, unlocked);

  // portail tourbillonnant si débloqué (anneau à la périphérie)
  if (unlocked) {
    const pa = t * 1.8 + c;
    const pr = terr.r * 1.06;
    const ppx = terr.x + Math.cos(pa) * pr, ppy = terr.y + Math.sin(pa) * pr * 0.86;
    ctx.save();
    ctx.translate(ppx, ppy);
    ctx.strokeStyle = hexA(terr.part, 0.85); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, 9 + Math.sin(t * 5 + c) * 1.6, pa * 2, pa * 2 + TAU * 0.72); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 4, -pa * 3, -pa * 3 + TAU * 0.6); ctx.stroke();
    ctx.restore();
  }

  // emblème de victoire
  if (done) {
    const vx = terr.x + terr.r * 0.62, vy = terr.y - terr.r * 0.58;
    const pulse = 0.75 + Math.sin(t * 3 + c) * 0.25;
    ctx.save();
    ctx.translate(vx, vy);
    ctx.fillStyle = `rgba(255,215,64,${0.9 * pulse})`;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#3d2c00'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('✓', 0, 5);
    ctx.restore();
  }

  // cadenas si verrouillé
  if (!unlocked) {
    ctx.font = '26px serif'; ctx.textAlign = 'center';
    ctx.fillText('🔒', terr.x, terr.y - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = `600 10px ${UI}`;
    ctx.fillText(`TERMINER LA CAMPAGNE ${c}`, terr.x, terr.y + terr.r * 0.86 + 14);
  }

  // nom + difficulté
  ctx.textAlign = 'center';
  ctx.font = `700 15px ${UI}`; ctx.fillStyle = unlocked ? '#fff' : 'rgba(255,255,255,0.35)';
  // biome non découvert : le nom du territoire reste secret
  ctx.fillText(unlocked ? NAMES[c] : '••• TERRITOIRE INCONNU •••', terr.x, terr.y - terr.r * 0.86 - 26);
  ctx.font = `700 11px ${UI}`; ctx.fillStyle = unlocked ? info.diffCol : 'rgba(255,255,255,0.25)';
  ctx.fillText(info.diff, terr.x, terr.y + terr.r * 0.86 + (unlocked ? 14 : 30));

  // sélection : anneau doré + étiquette
  if (sel) {
    ctx.strokeStyle = '#ffd740'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach(([px, py], i) => i ? ctx.lineTo(px + 7, py + 7) : ctx.moveTo(px + 7, py + 7));
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#ffd740'; ctx.font = `700 12px ${UI}`;
    ctx.fillText('▼', terr.x, terr.y + terr.r * 0.86 + 32);
  } else if (hov) {
    ctx.strokeStyle = hexA(terr.rim, 0.8); ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.closePath(); ctx.stroke();
  }

  // animation de déblocage : onde + burst
  const fx = G._campUnlockFx;
  if (fx && fx.c === c) {
    const k = (t - fx.t) / 1.6;
    if (k < 1) {
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(terr.x, terr.y, terr.r * (0.3 + k * 1.6), 0, TAU); ctx.stroke();
      ctx.strokeStyle = hexA(terr.part, 0.9 * (1 - k)); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(terr.x, terr.y, terr.r * (0.2 + k * 1.3), 0, TAU); ctx.stroke();
    }
  }
}

// ---------- décor d'arrière-plan : océan, vagues, boussole ----------
function drawMapBG(t) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1622'); bg.addColorStop(0.55, '#0d1f2b'); bg.addColorStop(1, '#081420');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // lignes de latitude douces
  ctx.strokeStyle = 'rgba(120,180,220,0.05)'; ctx.lineWidth = 1;
  for (let y = 60; y < H - 40; y += 70) {
    ctx.beginPath(); ctx.moveTo(0, y + Math.sin(t * 0.4 + y) * 2); ctx.lineTo(W, y); ctx.stroke();
  }
  // vagues scintillantes le long du bas
  for (let i = 0; i < 14; i++) {
    const wx = (i * 137 + t * 18) % (W + 120) - 60;
    const wy = H - 46 - (i % 3) * 14 + Math.sin(t * 1.2 + i) * 3;
    ctx.strokeStyle = `rgba(140,200,240,${0.10 + (i % 3) * 0.03})`; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(wx, wy, 26 + (i % 4) * 8, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  // boussole décorative en haut à droite
  ctx.save();
  ctx.translate(W - 90, 92); ctx.rotate(t * 0.15);
  ctx.strokeStyle = 'rgba(255,215,64,0.28)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(7, 6); ctx.lineTo(0, 2); ctx.lineTo(-7, 6); ctx.closePath();
  ctx.fillStyle = 'rgba(255,215,64,0.4)'; ctx.fill();
  ctx.restore();
}

// ---------- carte de difficulté (dessin + survol partagés) ----------
function drawDiffCard(cd, c, t) {
  const d = DIFFS[cd.d], unlocked = campaignUnlocked(c);
  const playable = unlocked && diffPlayable(c, cd.d);
  const prog = diffProg(c);
  const done = cd.d === 0 ? !!prog.n : cd.d === 1 ? !!prog.h : !!prog.e;
  const hov = playable && inR(cd, G.mouse.x, G.mouse.y);
  // fond : sobre pour Normal, sombre rouille pour Difficile, mystique pour Expert
  const bg = !playable ? 'rgba(30,32,38,0.72)'
    : cd.d === 0 ? 'rgba(30,58,40,0.80)'
    : cd.d === 1 ? 'rgba(66,26,16,0.82)'
    : 'rgba(44,26,66,0.84)';
  ctx.fillStyle = bg;
  roundRect(cd.x, cd.y, cd.w, cd.h, 10); ctx.fill();
  ctx.strokeStyle = !playable ? 'rgba(255,255,255,0.12)'
    : hov ? d.color : hexA(d.color, done ? 0.8 : 0.4);
  ctx.lineWidth = hov ? 2.2 : 1.3;
  if (hov || done) { ctx.shadowColor = hexA(d.color, 0.5); ctx.shadowBlur = 12; }
  roundRect(cd.x, cd.y, cd.w, cd.h, 10); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  // en-tête : icône + nom + nombre de vagues
  ctx.font = `700 13px ${UI}`;
  ctx.fillStyle = playable ? d.color : 'rgba(255,255,255,0.35)';
  ctx.fillText(`${d.icon} ${d.name}`, cd.x + cd.w / 2, cd.y + 20);
  ctx.font = `600 9px ${UI}`;
  ctx.fillStyle = playable ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)';
  ctx.fillText(`${campaignWaves(c, cd.d)} vagues`, cd.x + cd.w / 2, cd.y + 33);
  // description courte + récompenses
  ctx.font = `500 9.5px ${UI}`;
  ctx.fillStyle = playable ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.3)';
  ctx.fillText(d.foes, cd.x + cd.w / 2, cd.y + 50, cd.w - 16);
  ctx.fillStyle = playable ? hexA(d.color, 0.95) : 'rgba(255,255,255,0.3)';
  ctx.font = `700 9.5px ${UI}`;
  ctx.fillText(d.rew, cd.x + cd.w / 2, cd.y + 64, cd.w - 16);
  // statut : verrouillé / terminé / jouable
  const sy = cd.y + cd.h - 15;
  if (!playable) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = `600 9px ${UI}`;
    ctx.fillText(`🔒 ${d.lock || 'Verrouillé'}`, cd.x + cd.w / 2, sy, cd.w - 14);
  } else if (done) {
    ctx.fillStyle = '#ffd740'; ctx.font = `700 10px ${UI}`;
    ctx.fillText('✓ TERMINÉ — REJOUER', cd.x + cd.w / 2, sy);
  } else {
    ctx.fillStyle = hov ? '#fff' : d.color; ctx.font = `700 10.5px ${UI}`;
    ctx.fillText(hov ? '▶ JOUER' : '▶ CLIQUER POUR JOUER', cd.x + cd.w / 2, sy);
  }
  // liseré supérieur coloré de la difficulté
  ctx.fillStyle = playable ? hexA(d.color, 0.5) : 'rgba(255,255,255,0.08)';
  roundRect(cd.x + 8, cd.y + 2, cd.w - 16, 2.5, 1.5); ctx.fill();
}

// ---------- fiche détaillée ----------
function drawFiche(c, t) {
  const info = INFO[c], unlocked = campaignUnlocked(c);
  const prog = diffProg(c);
  const f = campaignFiche();
  ctx.save();
  ctx.fillStyle = 'rgba(6,12,20,0.82)';
  roundRect(f.x, f.y, f.w, f.h, 16); ctx.fill();
  ctx.strokeStyle = hexA(TERR[c].rim, unlocked ? 0.65 : 0.2); ctx.lineWidth = 1.6;
  roundRect(f.x, f.y, f.w, f.h, 16); ctx.stroke();
  // coins tech
  ctx.strokeStyle = hexA(TERR[c].rim, 0.6); ctx.lineWidth = 1.4;
  const cl = 12;
  [[f.x, f.y, 1, 1], [f.x + f.w, f.y, -1, 1], [f.x, f.y + f.h, 1, -1], [f.x + f.w, f.y + f.h, -1, -1]]
    .forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(cx + sx * cl, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * cl); ctx.stroke();
    });
  // aperçu animé
  drawPreview(c, f.x + 74, f.y + f.h / 2 - 40, 110, t);
  // textes
  const tx = f.x + 150;
  ctx.textAlign = 'left';
  ctx.font = `700 19px ${UI}`; ctx.fillStyle = unlocked ? C_TEXT : 'rgba(255,255,255,0.4)';
  // biome non découvert : nom masqué dans la fiche aussi
  ctx.fillText(unlocked ? `${info.icon}  ${NAMES[c]}` : '❓  BIOME INCONNU', tx, f.y + 34);
  ctx.font = `700 11px ${UI}`; ctx.fillStyle = info.diffCol;
  ctx.fillText(info.diff, tx, f.y + 54);
  const doneN = !!prog.n;
  if (doneN) { ctx.fillStyle = '#ffd740'; ctx.font = `700 11px ${UI}`; ctx.fillText('★ NIVEAU TERMINÉ', tx + 150, f.y + 54); }
  // boss + récompense + description — masqués tant que le biome n'est pas débloqué
  if (unlocked) {
    ctx.fillStyle = '#7d8fa3';
    ctx.font = `11px ${UI}`;
    ctx.fillText(`Boss : ${info.boss}  ·  ${BASE_WAVES[c]} vagues (Normal)`, tx, f.y + 96);
    ctx.fillStyle = hexA(TERR[c].part, 0.95);
    ctx.font = `600 11px ${UI}`;
    ctx.fillText(`🎁 ${info.reward}`, tx, f.y + 114);
    ctx.fillStyle = '#8fa3b8';
    ctx.font = `10.5px ${UI}`;
    wrapFiche(info.desc, tx, f.y + 108, f.x + f.w - 60 - tx, 12, 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `600 11px ${UI}`;
    ctx.fillText('🔒  BIOME INEXPLORÉ — terminez la campagne précédente pour découvrir ses secrets', tx, f.y + 116);
  }
  // les trois cartes de difficulté
  for (const cd of campaignDiffCards(c)) drawDiffCard(cd, c, t);
  ctx.restore();
}
function wrapFiche(text, x, y, maxW, lh, maxLines) {
  const words = text.split(' '); let line = '', yy = y, n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); line = w; yy += lh;
      if (maxLines && ++n >= maxLines) return;
    } else line = test;
  }
  if (line && (!maxLines || n < maxLines)) ctx.fillText(line, x, yy);
}

// ---------- vue principale ----------
export function drawCampaign() {
  const t = G.time || 0, dt = 1 / 60;
  updateCampParts(dt);
  campCam(dt);
  checkUnlockFx();
  // sélection par défaut : campagne en cours ou première débloquée
  if (G.campaignSel === undefined || G.campaignSel === null) {
    G.campaignSel = campaignUnlocked(G.campaign || 0) ? (G.campaign || 0) : 0;
  }
  // survol
  G._campHover = G.mouse && G.state === 'menu' ? terrAt(G.mouse.x, G.mouse.y) : -1;

  drawMapBG(t);

  // ---- sentiers animés (sous les territoires) ----
  for (let c = 0; c < 5; c++) {
    const a = TERR[c], b = TERR[c + 1];
    const unlocked = campaignUnlocked(c + 1);
    const { mx, my } = pathCurve(a, b);
    ctx.strokeStyle = unlocked ? 'rgba(255,215,64,0.5)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = unlocked ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
    // marqueur de progression sur le sentier
    if (unlocked) {
      ctx.fillStyle = '#ffd740'; ctx.font = 'bold 17px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('›', mx, my + 6);
    }
  }

  // ---- territoires sous la caméra zoomée ----
  const cam = G._campCam;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.cx, -cam.cy);
  for (let c = 0; c < 6; c++) drawTerritory(c, t, dt);
  ctx.restore();

  // ---- particules d'ambiance (espace écran) ----
  ctx.save();
  for (const p of campParts()) {
    const tw = 0.55 + 0.45 * Math.sin(p.tw);
    ctx.fillStyle = hexA(p.col, Math.min(1, p.life / 2) * tw);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // ---- titre ----
  ctx.textAlign = 'center';
  ctx.font = `600 40px ${SERIF}`; ctx.letterSpacing = '3px';
  ctx.fillStyle = C_TEXT;
  ctx.shadowColor = 'rgba(255,215,64,0.35)'; ctx.shadowBlur = 16;
  ctx.fillText('LA CARTE DES TERRES', W / 2, 62);
  ctx.shadowBlur = 0; ctx.letterSpacing = '0px';
  ctx.font = `italic 13.5px ${UI}`; ctx.fillStyle = C_MUTED;
  ctx.fillText('Survolez les territoires — cliquez pour explorer un monde', W / 2, 88);

  // bannière : le tutoriel est obligatoire avant la première campagne
  if (tutorialRequired()) {
    ctx.font = `700 14px ${UI}`;
    const msg = '✦ LE TUTORIEL EST OBLIGATOIRE — RETOURNE AU MENU ET CHOISIS « TUTORIEL » ✦';
    const tw = ctx.measureText(msg).width + 44;
    ctx.fillStyle = 'rgba(212,175,55,0.12)';
    roundRect(W / 2 - tw / 2, 104, tw, 32, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(212,175,55,0.55)'; ctx.lineWidth = 1.4;
    roundRect(W / 2 - tw / 2 + 0.5, 104.5, tw - 1, 31, 16); ctx.stroke();
    ctx.fillStyle = '#ffd740';
    ctx.fillText(msg, W / 2, 125);
  }

  // ---- fiche + boutons ----
  const c = G.campaignSel === undefined || G.campaignSel === null ? 0 : G.campaignSel;
  drawFiche(c, t);

  // bouton retour
  const back = backBtn();
  const bhov = inR(back, G.mouse.x, G.mouse.y);
  ctx.fillStyle = bhov ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)';
  roundRect(back.x, back.y, back.w, back.h, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.4;
  roundRect(back.x, back.y, back.w, back.h, 9); ctx.stroke();
  ctx.fillStyle = '#e0e0e0'; ctx.font = `700 13px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText('← MENU', back.x + back.w / 2, back.y + 26);

  // aide clavier (au-dessus de la fiche)
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.font = `600 10.5px ${UI}`;
  ctx.fillText('← → naviguer · cliquez une difficulté pour jouer', W / 2, campaignFiche().y - 10);
}
