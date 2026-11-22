// Génération procédurale du monde : plaines, secteurs, bâtiments lootables,
// portails dimensionnels et sauvegarde persistante (localStorage).
import { G, W, H, TAU } from './state.js';
import { addDamageText, spawnParticles } from './effects.js';
import { gainXp } from './player.js';
import { sfxPortal, sfxPickup } from './audio.js';

// ---------- CONFIGURATION CENTRALISÉE ----------
export const CONFIG = {
  worldW: 5400,          // largeur du monde en pixels
  worldH: 3600,          // hauteur du monde
  sectorW: 1200,         // taille d'un secteur
  sectorH: 800,
  buildingDensity: 1.0,  // bâtiments par secteur en moyenne
  minBuildingDist: 560,  // distance minimale entre deux bâtiments
  edgeMargin: 140,       // marge depuis les bords du monde
  portalWave: 50,        // la vague à terminer pour débloquer le portail
  portalDist: 340,       // distance d'apparition du portail
  interactDist: 130,     // distance d'interaction (loot / portail)
};

// ---------- RNG seedé (mulberry32) ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rr = (rng, a, b) => a + rng() * (b - a);
const ri = (rng, a, b) => Math.floor(rr(rng, a, b + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

// ---------- DÉFINITION DES MONDES ----------
export const WORLDS = [
  {
    name: 'Les Terres Oubliées',
    biome: 'plain',
    ground: '#4c6b34', groundDark: '#3a5227', field: '#5d7a3c',
    blobA: 'rgba(90,130,60,0.20)', blobB: 'rgba(60,100,45,0.18)', blobC: 'rgba(120,150,70,0.14)',
    decor: ['grass', 'grass', 'grass', 'flower', 'flower', 'tree', 'tree', 'rock', 'shroom'],
    wall: '#8d6e63', wallDark: '#6d4c41', roof: '#5d4037', roofAlt: '#795548', trim: '#ffd740',
    window: '#ffe082', door: '#4e342e',
  },
  {
    name: 'Le Royaume de Glace',
    biome: 'ice',
    ground: '#7fa8c9', groundDark: '#5d87a8', field: '#9cc3dd',
    blobA: 'rgba(160,210,240,0.22)', blobB: 'rgba(120,180,220,0.18)', blobC: 'rgba(200,230,250,0.15)',
    decor: ['snow', 'snow', 'grass', 'pine', 'pine', 'crystal', 'rock', 'flower'],
    wall: '#eceff1', wallDark: '#b0bec5', roof: '#90caf9', roofAlt: '#64b5f6', trim: '#4fc3f7',
    window: '#b3e5fc', door: '#37474f',
  },
  // ---------- CAMPAGNE 2 : THE FROZEN LAND (mondes 2 et 3) ----------
  {
    name: 'The Frozen Land',
    biome: 'ice',
    ground: '#e8f1f8', groundDark: '#c3d5e4', field: '#f4f9fd',
    blobA: 'rgba(255,255,255,0.30)', blobB: 'rgba(160,200,230,0.20)', blobC: 'rgba(200,225,245,0.22)',
    decor: ['snow', 'snow', 'snow', 'pine', 'pine', 'pine', 'crystal', 'rock', 'crystal'],
    wall: '#eceff1', wallDark: '#b0bec5', roof: '#90caf9', roofAlt: '#64b5f6', trim: '#4fc3f7',
    window: '#b3e5fc', door: '#37474f',
  },
  {
    name: 'Les Profondeurs Gelées',
    biome: 'ice',
    ground: '#dfe9f2', groundDark: '#b8c9d8', field: '#eef4fa',
    blobA: 'rgba(220,238,250,0.28)', blobB: 'rgba(140,185,215,0.20)', blobC: 'rgba(180,210,235,0.20)',
    decor: ['snow', 'snow', 'pine', 'pine', 'crystal', 'crystal', 'rock', 'snow'],
    wall: '#dfe9f2', wallDark: '#a9bccd', roof: '#7fb3d5', roofAlt: '#5b8fb5', trim: '#81d4fa',
    window: '#e1f5fe', door: '#263238',
  },
  // ---------- CAMPAGNE 3 : LES ENFERS (mondes 4 et 5) ----------
  {
    name: 'Les Enfers',
    biome: 'hell',
    ground: '#3d1f1c', groundDark: '#2a1210', field: '#4a2420',
    blobA: 'rgba(160,50,20,0.22)', blobB: 'rgba(120,25,60,0.20)', blobC: 'rgba(200,90,20,0.14)',
    decor: ['crack', 'crack', 'bone', 'bone', 'obsid', 'fire', 'deadwood', 'rock', 'ash', 'fire'],
    wall: '#4a2622', wallDark: '#2e1512', roof: '#6d1f1f', roofAlt: '#8a2a1a', trim: '#ff7043',
    window: '#ffab40', door: '#1a0d0b',
  },
  {
    name: 'Le Trône de Cendres',
    biome: 'hell',
    ground: '#331a18', groundDark: '#200e0d', field: '#3f1d1b',
    blobA: 'rgba(200,60,15,0.25)', blobB: 'rgba(140,20,70,0.22)', blobC: 'rgba(90,20,110,0.16)',
    decor: ['crack', 'crack', 'crack', 'bone', 'obsid', 'obsid', 'fire', 'deadwood', 'ash', 'rock'],
    wall: '#3a1c1a', wallDark: '#241010', roof: '#5c1818', roofAlt: '#7a2418', trim: '#ff5252',
    window: '#ff8a65', door: '#140a09',
  },
];

// ---------- CAMPAGNES : chaque campagne possède 2 mondes (portails internes) ----------
export const CAMPAIGNS = [
  { id: 0, name: 'Les Terres Oubliées', worlds: [0, 1], diff: 'NORMAL' },
  { id: 1, name: 'The Frozen Land',    worlds: [2, 3], diff: 'MOYEN' },
  { id: 2, name: 'Les Enfers',         worlds: [4, 5], diff: 'IMPOSSIBLE' },
];
export function campaignOf(idx) { return idx >= 4 ? 2 : idx >= 2 ? 1 : 0; }
export function campaignStart(c) { return c === 2 ? 4 : c ? 2 : 0; }
export function campaignEnd(c) { return c === 2 ? 6 : c ? 4 : 2; } // borne exclusive

// ---------- BIBLIOTHÈQUE DE BÂTIMENTS ----------
const BUILDING_TYPES = [
  { id: 'cabin',     name: 'Cabane',              cat: 'petite',     rarity: 'commun',     w: 120, h: 90,  weight: 30, loot: 'cabin',     camp: 0 },
  { id: 'house',     name: 'Maison abandonnée',   cat: 'maison',     rarity: 'commun',     w: 175, h: 125, weight: 22, loot: 'house',     camp: 0 },
  { id: 'ruins',     name: 'Ruines',              cat: 'ruine',      rarity: 'commun',     w: 150, h: 110, weight: 16, loot: 'ruins',     camp: 0 },
  { id: 'warehouse', name: 'Entrepôt',            cat: 'industriel', rarity: 'rare',       w: 235, h: 155, weight: 12, loot: 'warehouse', camp: 0 },
  { id: 'factory',   name: 'Usine',               cat: 'industriel', rarity: 'rare',       w: 265, h: 175, weight: 9,  loot: 'factory',   camp: 0 },
  { id: 'gas',       name: 'Station-service',     cat: 'industriel', rarity: 'epique',     w: 205, h: 140, weight: 7,  loot: 'gas',       camp: 0 },
  { id: 'shrine',    name: 'Sanctuaire ancien',   cat: 'rare',       rarity: 'legendaire', w: 145, h: 145, weight: 4,  loot: 'shrine',    camp: 0 },
  // ---------- structures hivernales (campagne 2 uniquement) ----------
  { id: 'chalet',    name: 'Chalet enneigé',      cat: 'maison',     rarity: 'commun',     w: 165, h: 115, weight: 26, loot: 'house',  camp: 1, drawAs: 'house' },
  { id: 'camp',      name: 'Campement de chasse', cat: 'petite',     rarity: 'commun',     w: 110, h: 80,  weight: 22, loot: 'cabin',  camp: 1, drawAs: 'cabin' },
  { id: 'watch',     name: 'Tour de guet glacée', cat: 'industriel', rarity: 'rare',       w: 70,  h: 190, weight: 12, loot: 'warehouse', camp: 1, drawAs: 'factory' },
  { id: 'lab',       name: 'Labo abandonné',      cat: 'industriel', rarity: 'rare',       w: 220, h: 150, weight: 10, loot: 'factory', camp: 1, drawAs: 'warehouse' },
  { id: 'mine',      name: 'Mine gelée',          cat: 'industriel', rarity: 'epique',     w: 240, h: 160, weight: 8,  loot: 'gas',    camp: 1, drawAs: 'gas' },
  { id: 'fort',      name: 'Forteresse gelée',    cat: 'rare',       rarity: 'legendaire', w: 280, h: 190, weight: 5,  loot: 'shrine', camp: 1, drawAs: 'warehouse' },
  { id: 'icearch',   name: 'Arche de glace',      cat: 'ruine',      rarity: 'rare',       w: 190, h: 120, weight: 14, loot: 'ruins',  camp: 1, drawAs: 'ruins' },
  { id: 'grave',     name: 'Cimetière glacé',     cat: 'petite',     rarity: 'commun',     w: 130, h: 95,  weight: 20, loot: 'cabin',  camp: 1, drawAs: 'house' },
  { id: 'relay',     name: 'Relais abandonné',    cat: 'industriel', rarity: 'epique',     w: 95,  h: 210, weight: 7,  loot: 'factory', camp: 1, drawAs: 'factory' },
  { id: 'castle',    name: 'Château enneigé',     cat: 'rare',       rarity: 'legendaire', w: 320, h: 210, weight: 3,  loot: 'shrine',  camp: 1, drawAs: 'castle' },
  // ---------- structures infernales (campagne 3 uniquement) ----------
  { id: 'temple',    name: 'Temple des Braises',  cat: 'ruine',      rarity: 'commun',     w: 160, h: 115, weight: 24, loot: 'ruins',    camp: 2, drawAs: 'ruins' },
  { id: 'forge',     name: 'Forge des Damnés',    cat: 'industriel', rarity: 'commun',     w: 150, h: 105, weight: 22, loot: 'cabin',    camp: 2, drawAs: 'factory' },
  { id: 'mansion',   name: 'Manoir Maudit',       cat: 'maison',     rarity: 'rare',       w: 185, h: 130, weight: 16, loot: 'house',    camp: 2, drawAs: 'house' },
  { id: 'crypt',     name: 'Crypte Ardente',      cat: 'petite',     rarity: 'commun',     w: 125, h: 95,  weight: 20, loot: 'cabin',    camp: 2, drawAs: 'cabin' },
  { id: 'altar',     name: 'Autel de Sang',       cat: 'rare',       rarity: 'epique',     w: 110, h: 110, weight: 12, loot: 'shrine',   camp: 2, drawAs: 'shrine' },
  { id: 'bastion',   name: 'Bastion de Cendres',  cat: 'industriel', rarity: 'epique',     w: 230, h: 150, weight: 9,  loot: 'warehouse', camp: 2, drawAs: 'warehouse' },
  { id: 'helltower', name: 'Tour du Trône',       cat: 'industriel', rarity: 'rare',       w: 75,  h: 200, weight: 10, loot: 'factory',  camp: 2, drawAs: 'factory' },
  { id: 'hellcastle',name: 'Château des Enfers',  cat: 'rare',       rarity: 'legendaire', w: 320, h: 210, weight: 3,  loot: 'shrine',   camp: 2, drawAs: 'castle' },
];
// bonus de fouille : XP garanti + fiole selon la rareté du bâtiment
const LOOT_BONUS = {
  cabin:     { xp: [8, 15],   xpCh: 1, potionCh: 0.10 },
  house:     { xp: [12, 22],  xpCh: 1, potionCh: 0.15 },
  ruins:     { xp: [15, 28],  xpCh: 1, potionCh: 0.20 },
  warehouse: { xp: [25, 45],  xpCh: 1, potionCh: 0.35 },
  factory:   { xp: [35, 60],  xpCh: 1, potionCh: 0.45 },
  gas:       { xp: [40, 70],  xpCh: 1, potionCh: 0.55 },
  shrine:    { xp: [80, 140], xpCh: 1, potionCh: 0.90 },
};
// bonus de butin hivernal : plus généreux (la campagne 2 rapporte davantage)
const LOOT_BONUS_FROZEN = {
  cabin:     { xp: [15, 25],  xpCh: 1, potionCh: 0.18 },
  house:     { xp: [20, 35],  xpCh: 1, potionCh: 0.25 },
  ruins:     { xp: [25, 45],  xpCh: 1, potionCh: 0.30 },
  warehouse: { xp: [40, 65],  xpCh: 1, potionCh: 0.50 },
  factory:   { xp: [55, 85],  xpCh: 1, potionCh: 0.60 },
  gas:       { xp: [60, 100], xpCh: 1, potionCh: 0.70 },
  shrine:    { xp: [120, 200],xpCh: 1, potionCh: 1.0 },
};
// butin des Enfers : le plus généreux des trois campagnes
const LOOT_BONUS_HELL = {
  cabin:     { xp: [25, 40],  xpCh: 1, potionCh: 0.25 },
  house:     { xp: [35, 55],  xpCh: 1, potionCh: 0.35 },
  ruins:     { xp: [40, 70],  xpCh: 1, potionCh: 0.40 },
  warehouse: { xp: [60, 95],  xpCh: 1, potionCh: 0.60 },
  factory:   { xp: [80, 120], xpCh: 1, potionCh: 0.70 },
  gas:       { xp: [90, 140], xpCh: 1, potionCh: 0.80 },
  shrine:    { xp: [160, 260],xpCh: 1, potionCh: 1.0 },
};

export const RARITY_COLOR = { commun: '#9e9e9e', rare: '#4fc3f7', epique: '#ba68c4', legendaire: '#ffd740' };

// ---------- SAUVEGARDE (localStorage, deltas uniquement, par personnage) ----------
import { storeKey } from './chars.js';
const SAVE_KEY = () => storeKey('worlds_v1');
let worldSaves = null;
export function reloadWorlds() { worldSaves = null; } // appelé au changement de personnage
function loadSaves() {
  if (worldSaves) return worldSaves;
  try { worldSaves = JSON.parse(localStorage.getItem(SAVE_KEY())) || { worlds: {} }; }
  catch (e) { worldSaves = { worlds: {} }; }
  worldSaves.worlds = worldSaves.worlds || {};
  return worldSaves;
}
export function saveWorlds() {
  try { localStorage.setItem(SAVE_KEY(), JSON.stringify(worldSaves || loadSaves())); } catch (e) {}
}

// ---------- GÉNÉRATION ----------
const worldCache = {}; // idx -> monde généré (non sérialisé, regén déterministe)

function genDecor(rng, def, count, x0, y0, x1, y1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const type = pick(rng, def.decor);
    out.push({
      type, x: rr(rng, x0, x1), y: rr(rng, y0, y1),
      h: 4 + rng() * 7, s: 0.7 + rng() * 0.7, c: rng(),
      rot: rng() * TAU
    });
  }
  return out;
}

function genSectorBlobs(rng, def, sx, sy) {
  const blobs = [], fields = [];
  const n = ri(rng, 3, 6);
  for (let i = 0; i < n; i++) {
    blobs.push({
      x: sx + rr(rng, 80, CONFIG.sectorW - 80),
      y: sy + rr(rng, 60, CONFIG.sectorH - 60),
      rx: rr(rng, 90, 260), ry: rr(rng, 60, 170),
      color: pick(rng, [def.blobA, def.blobB, def.blobC]),
      rot: rng() * Math.PI
    });
  }
  const nf = ri(rng, 0, 2);
  for (let i = 0; i < nf; i++) {
    fields.push({
      x: sx + rr(rng, 100, CONFIG.sectorW - 260),
      y: sy + rr(rng, 100, CONFIG.sectorH - 200),
      w: rr(rng, 120, 240), h: rr(rng, 90, 170),
      color: def.field, rot: (rng() < 0.5 ? 0 : Math.PI / 2) + rr(rng, -0.06, 0.06)
    });
  }
  return { blobs, fields };
}

// ---------- LACS ----------
// Grandes zones d'eau infranchissables : on ne peut les traverser que par le pont.
// Chaque lac a un pont en bois qui le traverse en son centre.
function genLakes(rng, w, h, spawn, buildings) {
  const lakes = [];
  const n = 3 + (rng() < 0.6 ? 1 : 0); // 3 ou 4 lacs par monde
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 30; t++) {
      const rx = rr(rng, 130, 210), ry = rr(rng, 90, 150);
      const x = rr(rng, CONFIG.edgeMargin + rx + 60, w - CONFIG.edgeMargin - rx - 60);
      const y = rr(rng, CONFIG.edgeMargin + ry + 60, h - CONFIG.edgeMargin - ry - 60);
      if (Math.hypot(x - spawn.x, y - spawn.y) < Math.max(rx, ry) + 260) continue;
      let okc = true;
      for (const b of buildings) {
        if (Math.hypot(x - b.x, y - b.y) < Math.max(rx, ry) + Math.hypot(b.w, b.h) / 2 + 40) { okc = false; break; }
      }
      if (!okc) continue;
      for (const l of lakes) {
        if (Math.hypot(x - l.x, y - l.y) < (Math.max(rx, ry) + Math.max(l.rx, l.ry)) * 0.9) { okc = false; break; }
      }
      if (!okc) continue;
      // pont : traverse le lac en son centre selon un angle aléatoire
      const ang = rng() * Math.PI;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      // rayon de l'ellipse le long de la direction du pont (pour dimensionner la passerelle)
      const rEll = (rx * ry) / Math.sqrt((ry * dx) ** 2 + (rx * dy) ** 2);
      lakes.push({
        x, y, rx, ry, rot: rr(rng, -0.25, 0.25), seed: rng(),
        bridge: { x, y, ang, len: rEll * 2 + 90, wid: 54 },
      });
      break;
    }
  }
  return lakes;
}

// ---------- OBSTACLES (rochers + montagnes) ----------
// RNG dédié : n'altère pas la disposition des bâtiments/décors déjà générés
function genObstacles(rng, w, h, spawn, buildings, lakes) {
  const obs = [];
  const cols = Math.ceil(w / CONFIG.sectorW), rows = Math.ceil(h / CONFIG.sectorH);
  const ok = (x, y, r) => {
    if (x < CONFIG.edgeMargin + r || y < CONFIG.edgeMargin + r ||
        x > w - CONFIG.edgeMargin - r || y > h - CONFIG.edgeMargin - r) return false;
    if (Math.hypot(x - spawn.x, y - spawn.y) < 560) return false;
    for (const b of buildings) {
      if (Math.hypot(x - b.x, y - b.y) < Math.hypot(b.w, b.h) / 2 + r + 55) return false;
    }
    for (const l of lakes || []) {
      if (Math.hypot(x - l.x, y - l.y) < Math.max(l.rx, l.ry) + r + 30) return false;
    }
    for (const o of obs) {
      if (Math.hypot(x - o.x, y - o.y) < (r + o.r) * 0.72) return false;
    }
    return true;
  };
  const place = (type, cx, cy, spread, rMin, rMax) => {
    for (let t = 0; t < 10; t++) {
      const x = cx + rr(rng, -spread, spread), y = cy + rr(rng, -spread * 0.7, spread * 0.7);
      const r = rr(rng, rMin, rMax);
      if (ok(x, y, r)) { obs.push({ type, x, y, r, seed: rng() }); return; }
    }
  };
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const sw = Math.min(CONFIG.sectorW, w - gx * CONFIG.sectorW);
    const sh = Math.min(CONFIG.sectorH, h - gy * CONFIG.sectorH);
    const sx = gx * CONFIG.sectorW, sy = gy * CONFIG.sectorH;
    // groupe de rochers (60 % des secteurs)
    if (rng() < 0.6) {
      const cx = sx + rr(rng, 170, Math.max(171, sw - 170));
      const cy = sy + rr(rng, 140, Math.max(141, sh - 140));
      const n = ri(rng, 2, 4);
      for (let i = 0; i < n; i++) place('rock', cx + rr(rng, -70, 70), cy + rr(rng, -50, 50), 0, 26, 46);
    }
    // montagne ou massif (45 % des secteurs — la carte ne doit pas paraître vide)
    if (rng() < 0.45) {
      const cx = sx + rr(rng, 200, Math.max(201, sw - 200));
      const cy = sy + rr(rng, 170, Math.max(171, sh - 170));
      const n = rng() < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) place('mountain', cx + rr(rng, -90, 90), cy + rr(rng, -70, 70), 0, 58, 95);
    }
  }
  // garantie de répartition : chaque zone 3×3 de la carte a au moins une montagne
  const Z = 3;
  for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) {
    const zx0 = zx * w / Z, zx1 = (zx + 1) * w / Z;
    const zy0 = zy * h / Z, zy1 = (zy + 1) * h / Z;
    const has = obs.some(o => o.type === 'mountain' && o.x > zx0 && o.x < zx1 && o.y > zy0 && o.y < zy1);
    if (!has) place('mountain', (zx0 + zx1) / 2 + rr(rng, -80, 80), (zy0 + zy1) / 2 + rr(rng, -60, 60), 0, 62, 92);
  }
  return obs;
}

// repousse une entité hors des obstacles (rochers, montagnes) et des lacs.
// Les lacs sont infranchissables : seul le pont au centre permet de les traverser.
export function resolveObstacles(e) {
  const w = curWorld();
  if (!w) return;
  const r = e.r || 14;
  for (const o of w.obstacles || []) {
    const dx = e.x - o.x, dy = e.y - o.y;
    const min = r + o.r * 0.8; // hitbox légèrement plus petite que le visuel
    const d2 = dx * dx + dy * dy;
    if (d2 < min * min && d2 > 0.0001) {
      const d = Math.sqrt(d2), push = (min - d) / d;
      e.x += dx * push; e.y += dy * push;
    }
  }
  // ---------- lacs ----------
  for (const l of w.lakes || []) {
    // dans l'ellipse de l'eau ? (tenu compte de la rotation du lac)
    const dx = e.x - l.x, dy = e.y - l.y;
    const cr = Math.cos(-l.rot), sr = Math.sin(-l.rot);
    const eu = dx * cr - dy * sr, ev = dx * sr + dy * cr;
    const un = eu / l.rx, vn = ev / l.ry;
    const norm = Math.sqrt(un * un + vn * vn);
    if (norm >= 1) continue; // à sec : rien à faire
    // dans l'eau : le pont est la seule issue
    const b = l.bridge;
    const c = Math.cos(b.ang), s = Math.sin(b.ang);
    const bx = e.x - b.x, by = e.y - b.y;
    const u = bx * c + by * s;          // position le long du pont
    const v = -bx * s + by * c;         // distance perpendiculaire au pont
    const onBridge = Math.abs(u) <= b.len / 2 + r * 0.4 && Math.abs(v) <= b.wid / 2 + r * 0.6;
    if (onBridge) {
      // SUR LE PONT au-dessus de l'eau : impossible de dérailler sur le côté,
      // la traverse est verrouillée — on ne peut pas tomber dans l'eau
      const maxV = b.wid / 2 - r * 0.4;
      const over = Math.abs(v) - maxV;
      if (over > 0) {
        const sgn = Math.sign(v);
        e.x += sgn * over * s;
        e.y -= sgn * over * c;
      }
      continue;
    }
    // hors du pont : éjection vers le bord de l'ellipse (léger marge pour ne pas tremper)
    let pu, pv;
    if (norm > 0.0001) { const k = 1.04 / norm; pu = eu * k; pv = ev * k; }
    else { pu = 0; pv = -l.ry * 1.06; } // centre exact : éjection vers le haut du lac
    const c2 = Math.cos(l.rot), s2 = Math.sin(l.rot);
    e.x = l.x + pu * c2 - pv * s2;
    e.y = l.y + pu * s2 + pv * c2;
  }
}

function tooClose(x, y, w, h, buildings) {
  for (const b of buildings) {
    const dx = x - b.x, dy = y - b.y;
    const need = CONFIG.minBuildingDist + Math.max(w, h) / 2 + Math.max(b.w, b.h) / 2;
    if (dx * dx + dy * dy < need * need) return true;
  }
  return false;
}

function freeSpot(rng, buildings, worldW, worldH, spawn) {
  for (let t = 0; t < 60; t++) {
    const x = rr(rng, CONFIG.edgeMargin, worldW - CONFIG.edgeMargin);
    const y = rr(rng, CONFIG.edgeMargin, worldH - CONFIG.edgeMargin);
    if (spawn && Math.hypot(x - spawn.x, y - spawn.y) < 500) continue;
    return { x, y };
  }
  return { x: worldW / 2, y: worldH / 2 };
}

function genWorld(idx) {
  const camp = campaignOf(idx);
  const def = WORLDS[idx];
  const saves = loadSaves();
  const saved = saves.worlds[idx];
  const seed = saved && saved.seed ? saved.seed : (Math.random() * 1e9) | 0;
  if (!saved) {
    saves.worlds[idx] = { seed, looted: {}, portalSpawned: false };
    saveWorlds();
  }
  saves.worlds[idx].looted = saves.worlds[idx].looted || {};
  saves.worlds[idx].portalSpawned = !!saves.worlds[idx].portalSpawned;
  const rng = mulberry32(hashSeed(`world${idx}:${seed}`));

  const w = CONFIG.worldW, h = CONFIG.worldH;
  const buildings = [], decor = [], sectors = [];
  const cols = Math.ceil(w / CONFIG.sectorW), rows = Math.ceil(h / CONFIG.sectorH);

  // spawn : point dégagé proche du centre
  const spawn = { x: w / 2 + rr(rng, -300, 300), y: h / 2 + rr(rng, -200, 200) };

  let bid = 0;
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const sx = gx * CONFIG.sectorW, sy = gy * CONFIG.sectorH;
    const { blobs, fields } = genSectorBlobs(rng, def, sx, sy);
    sectors.push({ x: sx, y: sy, blobs, fields });
    // décor : densité proportionnelle à la surface du secteur
    const area = (Math.min(CONFIG.sectorW, w - sx)) * (Math.min(CONFIG.sectorH, h - sy));
    decor.push(...genDecor(rng, def, Math.round(170 * CONFIG.buildingDensity * area / (CONFIG.sectorW * CONFIG.sectorH)), sx + 30, sy + 30, sx + Math.min(CONFIG.sectorW, w - sx) - 30, sy + Math.min(CONFIG.sectorH, h - sy) - 30));
    // bâtiments : 0 à 2 par secteur
    const count = rng() < 0.45 * CONFIG.buildingDensity ? 2 : rng() < 0.75 * CONFIG.buildingDensity ? 1 : 0;
    for (let i = 0; i < count; i++) {
      // choix du type pondéré — les structures hivernales n'existent qu'en campagne 2
      const pool = BUILDING_TYPES.filter(t => t.camp === undefined || t.camp === camp);
      const total = pool.reduce((s, t) => s + t.weight, 0);
      let roll = rng() * total, type = pool[0];
      for (const t of pool) { roll -= t.weight; if (roll <= 0) { type = t; break; } }
      // bâtiments toujours orientés vers le haut (pas de rotation)
      const bw = type.w, bh = type.h;
      // position avec distance minimale
      let pos = null;
      for (let t = 0; t < 40; t++) {
        const x = rr(rng, sx + CONFIG.edgeMargin * 0.4, sx + CONFIG.sectorW - CONFIG.edgeMargin * 0.4);
        const y = rr(rng, sy + CONFIG.edgeMargin * 0.4, sy + CONFIG.sectorH - CONFIG.edgeMargin * 0.4);
        if (x < CONFIG.edgeMargin || y < CONFIG.edgeMargin || x > w - CONFIG.edgeMargin || y > h - CONFIG.edgeMargin) continue;
        if (Math.hypot(x - spawn.x, y - spawn.y) < 420) continue;
        if (!tooClose(x, y, bw, bh, buildings)) { pos = { x, y }; break; }
      }
      if (!pos) continue;
      // récompenses rares : XP et fiole selon la rareté du bâtiment
      const bonus = (camp === 2 ? LOOT_BONUS_HELL : camp === 1 ? LOOT_BONUS_FROZEN : LOOT_BONUS)[type.loot] || { xp: [0, 0], xpCh: 0, potionCh: 0 };
      const xpReward = rng() < bonus.xpCh ? ri(rng, bonus.xp[0], bonus.xp[1]) : 0;
      const potionReward = rng() < bonus.potionCh;
      const b = {
        id: `${idx}-${bid++}`, type: type.id, def: type,
        x: pos.x, y: pos.y, w: bw, h: bh,
        rot: 0,
        loot: [], // les bâtiments ne donnent plus de matériaux : XP garanti + fiole
        xp: xpReward, potion: potionReward,
        looted: !!(saves.worlds[idx].looted && saves.worlds[idx].looted[`${idx}-${bid - 1}`]),
      };
      buildings.push(b);
    }
  }

  // lacs : RNG dédié (layout existant préservé), évite bâtiments et spawn.
  // Les Enfers n'ont pas de lacs : le sol est une croûte de braise.
  const lrng = mulberry32(hashSeed(`lake${idx}:${seed}`));
  const lakes = def.biome === 'hell' ? [] : genLakes(lrng, w, h, spawn, buildings);
  // le décor ne doit pas pousser dans l'eau
  const inLake = (x, y) => (lakes || []).some(l => {
    const dx = x - l.x, dy = y - l.y;
    const cs = Math.cos(-l.rot), sn = Math.sin(-l.rot);
    const u = dx * cs - dy * sn, v = dx * sn + dy * cs;
    return (u / l.rx) ** 2 + (v / l.ry) ** 2 < 1;
  });
  // obstacles : rochers et montagnes (RNG séparé -> layout existant préservé)
  const orng = mulberry32(hashSeed(`obs${idx}:${seed}`));
  const obstacles = genObstacles(orng, w, h, spawn, buildings, lakes);

  // le décor ne pousse ni dans l'eau ni dans/derrière un obstacle (montagnes, rochers)
  const decorClean = decor.filter(d => !inLake(d.x, d.y) &&
    !obstacles.some(o => Math.hypot(d.x - o.x, d.y - o.y) < o.r + 20));

  const world = {
    idx, def, seed, w, h, spawn, buildings, decor: decorClean, sectors, obstacles, lakes,
    // portail retour : seulement s'il reste dans la même campagne
    returnPortal: (idx > 0 && campaignOf(idx - 1) === campaignOf(idx)) ? { x: spawn.x + 160, y: spawn.y - 60 } : null,
    portal: saved && saved.portal ? { x: saved.portal.x, y: saved.portal.y } : null,
  };
  worldCache[idx] = world;
  return world;
}

export function curWorld() {
  if (!G.worldIndex && G.worldIndex !== 0) G.worldIndex = 0;
  if (!worldCache[G.worldIndex]) genWorld(G.worldIndex);
  return worldCache[G.worldIndex];
}
export function worldW() { return curWorld().w; }
export function worldH() { return curWorld().h; }
export function setWorld(idx) {
  G.worldIndex = idx;
  curWorld();
  syncCamera(true);
}
export function initWorlds() { curWorld(); }

// nouvelle partie : nouveau seed -> bâtiments, positions et butin entièrement régénérés
export function regenerateWorld(idx) {
  const saves = loadSaves();
  const s = saves.worlds[idx] || (saves.worlds[idx] = {});
  s.seed = (Math.random() * 1e9) | 0;
  s.looted = {};
  s.portalSpawned = false;
  delete s.portal;
  saveWorlds();
  delete worldCache[idx];
  curWorld();
}

// ---------- CAMÉRA ----------
export function syncCamera(snap = false) {
  const w = curWorld();
  const tx = Math.max(0, Math.min(w.w - W, (G.player ? G.player.x : w.spawn.x) - W / 2));
  const ty = Math.max(0, Math.min(w.h - H, (G.player ? G.player.y : w.spawn.y) - H / 2));
  if (snap || G.camX === undefined) { G.camX = tx; G.camY = ty; }
}
export function updateCamera(dt) {
  const w = curWorld();
  const tx = Math.max(0, Math.min(w.w - W, G.player.x - W / 2));
  const ty = Math.max(0, Math.min(w.h - H, G.player.y - H / 2));
  const k = Math.min(1, dt * 6);
  G.camX += (tx - G.camX) * k;
  G.camY += (ty - G.camY) * k;
}

// ---------- INTERACTION (loot / portails) ----------
function distToBuilding(b, x, y) {
  return Math.hypot(x - b.x, y - b.y) - Math.max(b.w, b.h) * 0.5;
}

// retourne l'élément interactable le plus proche du joueur (coords monde)
export function nearestInteractable() {
  const p = G.player, w = curWorld();
  const dMax = CONFIG.interactDist;
  let best = null, bestD = Infinity;
  for (const b of w.buildings) {
    if (b.looted) continue;
    const d = distToBuilding(b, p.x, p.y);
    if (d < dMax && d < bestD) { best = { kind: 'building', ref: b, d }; bestD = d; }
  }
  for (const po of [w.portal, w.returnPortal]) {
    if (!po) continue;
    const tIdx = po === w.portal ? G.worldIndex + 1 : G.worldIndex - 1;
    if (campaignOf(tIdx) !== campaignOf(G.worldIndex)) continue; // jamais de fuite entre campagnes
    const d = Math.hypot(p.x - po.x, p.y - po.y) - 46;
    if (d < dMax && d < bestD) { best = { kind: 'portal', ref: po, d, target: po === w.portal ? G.worldIndex + 1 : G.worldIndex - 1 }; bestD = d; }
  }
  return best;
}

export function tryInteract() {
  const it = nearestInteractable();
  if (!it) return false;
  G.lastInteract = it.kind; // mémorisé pour le tutoriel
  if (it.kind === 'building') {
    const b = it.ref;
    b.looted = true;
    const sv = loadSaves().worlds[G.worldIndex];
    sv.looted[b.id] = true;
    saveWorlds();
    spawnParticles(b.x, b.y - 20, '#ffd740', 18, 6);
    sfxPickup();
    G.rings.push({ x: b.x, y: b.y, r: 10, maxR: 90, life: 30, maxLife: 30, color: '#ffd740' });
    G.screenShake = Math.max(G.screenShake, 4);
    // récompenses : XP garanti + fiole selon la rareté (aucun matériau)
    if (b.xp > 0) {
      gainXp(b.xp);
      addDamageText(b.x, b.y - 80, `+${b.xp} XP`, '#40c4ff');
    }
    if (b.potion) {
      const p = G.player;
      if (p.potions < p.maxPotions) {
        p.potions++;
        addDamageText(b.x + 24, b.y - 80, '+FIOLE', '#ff80ab');
      } else {
        addDamageText(b.x + 24, b.y - 80, 'FIOLES PLEINES !', '#90a4ae');
      }
    }
    addDamageText(b.x, b.y - 60, `${b.def.name} pillé !`, '#a5d6a7');
    return true;
  }
  // portail : transition vers l'autre monde
  if (it.target >= 0 && it.target < campaignEnd(G.campaign)) enterPortal(it.target);
  return true;
}

// change de monde en préservant inventaire, équipement et progression
export function enterPortal(targetIdx) {
  sfxPortal();
  saveWorlds();
  setWorld(targetIdx);
  const w = curWorld();
  const dest = w.returnPortal || w.spawn;
  const p = G.player;
  p.x = dest.x; p.y = dest.y;
  resolveObstacles(p); // le point d'arrivée peut toucher un rocher
  // purge les entités de l'ancien monde
  G.enemies.length = 0; G.drops.length = 0; G.fireZones.length = 0; G.craters.length = 0;
  G.lightnings.length = 0; G.projectiles.length = 0;
  G.particles.length = 0; G.damageTexts.length = 0; G.rings.length = 0;
  G.spawnTimer = 0.5;
  syncCamera(true);
  // transition : flash blanc-violet + salve de portails
  G.screenFlash = 1; G.screenShake = 10;
  spawnParticles(p.x, p.y, '#ce93d8', 30, 8);
  addDamageText(p.x, p.y - 40, `→ ${w.def.name}`, '#ce93d8');
}

// ---------- PORTAIL DE LA VAGUE 50 ----------
// appelé quand la vague dépasse CONFIG.portalWave : fait apparaître le portail
// une seule fois, à distance raisonnable du joueur, hors des bâtiments
export function checkWavePortal() {
  if (G.wave <= CONFIG.portalWave) return;
  const w = curWorld();
  if (w.portal || w.idx + 1 >= campaignEnd(G.campaign)) return;
  const saves = loadSaves().worlds[w.idx];
  if (saves && saves.portalSpawned) return;
  const p = G.player;
  let pos = null;
  for (let t = 0; t < 50; t++) {
    const a = Math.random() * TAU, d = CONFIG.portalDist + Math.random() * 120;
    const x = Math.max(80, Math.min(w.w - 80, p.x + Math.cos(a) * d));
    const y = Math.max(80, Math.min(w.h - 80, p.y + Math.sin(a) * d));
    let inside = false;
    for (const b of w.buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + 60 && Math.abs(y - b.y) < b.h / 2 + 60) { inside = true; break; }
    }
    for (const o of w.obstacles || []) {
      if (Math.hypot(x - o.x, y - o.y) < o.r + 60) { inside = true; break; }
    }
    for (const l of w.lakes || []) {
      if (Math.hypot(x - l.x, y - l.y) < Math.max(l.rx, l.ry) + 60) { inside = true; break; }
    }
    if (!inside) { pos = { x, y }; break; }
  }
  if (!pos) pos = { x: Math.max(80, Math.min(w.w - 80, p.x + CONFIG.portalDist)), y: Math.max(80, Math.min(w.h - 80, p.y)) };
  w.portal = pos;
  saves.portalSpawned = true;
  saves.portal = pos;
  saveWorlds();
  spawnParticles(pos.x, pos.y, '#e040fb', 40, 9);
  addDamageText(p.x, p.y - 50, '⚠ PORTAIL DIMENSIONNEL !', '#e040fb');
  addDamageText(p.x, p.y - 75, 'Appuyez sur E près du portail', '#ce93d8');
}
