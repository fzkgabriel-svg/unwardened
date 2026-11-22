// Inventaire : matériaux, objets craftés et équipement (persisté en localStorage)
import { storeKey } from './chars.js';

export const MATS = {
  cuir:    { name: 'Cuir',      color: '#a1887f' },
  fer:     { name: 'Fer',       color: '#90a4ae' },
  or:      { name: 'Or',        color: '#ffd740' },
  essence: { name: 'Essence',   color: '#ce93d8' },
  cristal: { name: 'Cristal',   color: '#4fc3f7' },
};

// tables de drop par type d'ennemi (chance par matériau à chaque kill)
export const MATERIAL_DROPS = {
  slime:    { cuir: 0.10, fer: 0.025 },
  bat:      { cuir: 0.08, fer: 0.02 },
  spider:   { cuir: 0.06, fer: 0.025, essence: 0.04 },
  witch:    { cuir: 0.045, essence: 0.06, or: 0.025 },
  brute:    { fer: 0.08, cuir: 0.08, or: 0.025 },
  golem:    { fer: 0.10, cuir: 0.06, or: 0.03 },
  miniboss: { or: 0.08, fer: 0.12, essence: 0.05, cristal: 0.03 },
  boss:     { or: 0.15, cristal: 0.09, essence: 0.09, fer: 0.18 },
  bossFoudre:{ or: 0.15, cristal: 0.09, essence: 0.09, fer: 0.18 },
  bossGivre:{ or: 0.15, cristal: 0.09, essence: 0.09, fer: 0.18 },
  finalBoss:{ or: 0.6, cristal: 0.5, essence: 0.55, fer: 0.6, cuir: 0.4 },
  // The Frozen Land
  yeti:     { cuir: 0.10, fer: 0.05, cristal: 0.03 },
  glacier:  { cristal: 0.14, fer: 0.10, essence: 0.06 },
  crypt:    { essence: 0.12, cristal: 0.08, or: 0.03 },
  hunter:   { cuir: 0.08, fer: 0.04, cristal: 0.04 },
  alpha:    { cristal: 0.15, essence: 0.12, or: 0.06, fer: 0.10 },
  bossGlace:{ cristal: 0.30, essence: 0.25, or: 0.15, fer: 0.20 },
  bossCryo: { cristal: 0.32, essence: 0.28, or: 0.18, fer: 0.22 },
  finalBossGlace:{ cristal: 0.7, essence: 0.65, or: 0.6, fer: 0.6, cuir: 0.5 },
  // Les Enfers
  imp:      { fer: 0.08, essence: 0.05 },
  hound:    { cuir: 0.10, fer: 0.07, essence: 0.04 },
  cultist:  { essence: 0.14, or: 0.05 },
  demon:    { essence: 0.16, or: 0.07, fer: 0.10 },
  golemEnf: { fer: 0.16, or: 0.08, essence: 0.08 },
  bossEnf:  { or: 0.20, essence: 0.18, cristal: 0.12, fer: 0.24 },
  priest:   { essence: 0.18, or: 0.08, cristal: 0.06 },
  finalBossEnfer:{ or: 0.75, cristal: 0.65, essence: 0.8, fer: 0.7, cuir: 0.6 },
};

// objets craftables : 3 par emplacement (arme / armure / talisman)
export const ITEMS = {
  talFer:    { slot: 'weapon', name: 'Talisman de Fer',     icon: '⚔️', desc: '+20% de dégâts',            cost: { fer: 28, cuir: 18 } },
  talOr:     { slot: 'weapon', name: 'Talisman d\'Or',      icon: '⚔️', desc: '+40% de dégâts',            cost: { or: 34, fer: 70, essence: 22 } },
  talEss:    { slot: 'weapon', name: 'Talisman d\'Essence', icon: '⚔️', desc: '+60% de dégâts',            cost: { essence: 46, cristal: 28, or: 46 } },
  ultBraise: { slot: 'weapon', name: 'Réceptacle de Braise',icon: '🔥', desc: 'Ultime : +20% rayon, boss +8%', cost: { fer: 24, cuir: 16 } },
  ultSage:   { slot: 'weapon', name: 'Réceptacle du Sage',  icon: '🔮', desc: 'Ultime : +40% rayon, boss +20%', cost: { or: 34, essence: 26, fer: 60 } },
  ultChaos:  { slot: 'weapon', name: 'Cœur du Cataclysme',  icon: '☢️', desc: 'Ultime : +65% rayon, boss +30%', cost: { essence: 46, cristal: 28, or: 46 } },
  armCuir:   { slot: 'armor',  name: 'Cuirasse de Cuir',    icon: '🛡️', desc: '-15% de dégâts subis',      cost: { cuir: 46, fer: 14 } },
  armFer:    { slot: 'armor',  name: 'Armure de Fer',       icon: '🛡️', desc: '-32% de dégâts subis',      cost: { fer: 74, cuir: 38 } },
  armOr:     { slot: 'armor',  name: 'Armure Royale',       icon: '👑', desc: '-45% de dégâts subis',      cost: { or: 70, fer: 100, essence: 40 } },
  amuGolem:  { slot: 'charm',  name: 'Amulette du Golem',   icon: '🧿', desc: '+40 PV max',                cost: { cuir: 24, fer: 18, essence: 14 } },
  courBoss:  { slot: 'charm',  name: 'Sagesse antique',     icon: '📿', desc: '+40% d\'XP gagnée',         cost: { essence: 40, cristal: 22, or: 34 } },
  patSpider: { slot: 'charm',  name: 'Patte d\'araignée',   icon: '🕷️', desc: '+0,3 de vitesse',           cost: { essence: 40, cristal: 22 } },
  gourdeBasse:{ slot: 'charm',  name: 'Gourde usée',        icon: '🏺', desc: '+20% de soin',                 cost: { fer: 16, cuir: 12 } },
  gourde:    { slot: 'charm',  name: 'Gourde du Herboriste',icon: '🍶', desc: '+1 fiole max, +35% de soin',  cost: { essence: 34, cristal: 20, or: 28 } },
  gourdeHaute:{ slot: 'charm',  name: 'Grande Gourde Sacrée',icon: '🏆', desc: '+2 fioles max, +55% de soin', cost: { essence: 56, cristal: 34, or: 56 } },
  // ---------- BOTTEES (nouvelle catégorie : vitesse de déplacement) ----------
  bottCuir:   { slot: 'boots',  name: 'Semelles de Cuir',      icon: '🥾', desc: '+0,12 de vitesse',                    cost: { cuir: 22 } },
  bottGolem:  { slot: 'boots',  name: 'Sabots du Golem',       icon: '👞', desc: '+0,22 de vitesse',                    cost: { fer: 38, cuir: 26 } },
  bottNuage:  { slot: 'boots',  name: 'Bottes du Nuage',       icon: '☁️', desc: '+0,32 de vitesse',                    cost: { essence: 26, cristal: 16 } },
  bottLievre: { slot: 'boots',  name: 'Pattes du Lièvre',      icon: '🐇', desc: '+0,42 de vitesse',                    cost: { essence: 38, cristal: 22, or: 16 } },
  bottSage:   { slot: 'boots',  name: 'Bottes du Sage Errant', icon: '🥾', desc: '+0,26 vitesse, +15% de soin',         cost: { or: 32, essence: 28, fer: 32 } },
  bottRelique:{ slot: 'boots',  name: 'Relique-Oiseau',        icon: '🪽', desc: '+0,50 de vitesse — le summum',        cost: { essence: 52, cristal: 32, or: 46 } },
};

// effets des objets équipés
const FX = {
  talFer:    { weaponMult: 1.20 },
  talOr:     { weaponMult: 1.40 },
  talEss:    { weaponMult: 1.60 },
  ultBraise: { ultR: 1.20, ultBoss: 0.08 },
  ultSage:   { ultR: 1.40, ultBoss: 0.20 },
  ultChaos:  { ultR: 1.65, ultBoss: 0.30 },
  armCuir:   { armorReduce: 0.15 },
  armFer:    { armorReduce: 0.32 },
  armOr:     { armorReduce: 0.45 },
  amuGolem:  { hp: 40 },
  courBoss:  { xp: 1.40 },
  patSpider: { speed: 0.30 },
  gourdeBasse:{ potions: 0, potionMult: 1.20 },
  gourde:    { potions: 1, potionMult: 1.35 },
  gourdeHaute:{ potions: 2, potionMult: 1.55 },
  bottCuir:   { speed: 0.12 },
  bottGolem:  { speed: 0.22 },
  bottNuage:  { speed: 0.32 },
  bottLievre: { speed: 0.42 },
  bottSage:   { speed: 0.26, potionMult: 1.15 },
  bottRelique:{ speed: 0.50 },
};

// v4 : une sauvegarde par personnage (préfixe rpg2d_c{slot}_)
const KEY = () => storeKey('inv_v3');
export function loadInv() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY()));
    if (d && d.mats && d.items && d.equip) { d.dur = d.dur || {}; d.wmode = d.wmode || {}; return d; }
  } catch (e) {}
  // reset complet : on efface toutes les anciennes sauvegardes d'inventaire
  for (const k of ['rpg2d_inv', 'rpg2d_inv_v2', 'rpg2d_inv_v3', KEY()]) {
    try { localStorage.removeItem(k); } catch (e) {}
  }
  const d = { mats: {}, items: {}, equip: {}, dur: {}, wmode: {} };
  try { localStorage.setItem(KEY(), JSON.stringify(d)); } catch (e) {}
  return d;
}
function saveInv(inv) { if (_noSave) return; try { localStorage.setItem(KEY(), JSON.stringify(inv)); } catch (e) {} }
// le tutoriel joue avec un inventaire jetable : rien n'est écrit sur disque
let _noSave = false;
export function setInvNoSave(v) { _noSave = !!v; }

export function addMaterial(inv, type, n = 1) {
  inv.mats[type] = (inv.mats[type] || 0) + n;
  saveInv(inv);
}

export function canCraft(inv, id) {
  if (inv.items[id]) return false;
  for (const k in ITEMS[id].cost) if ((inv.mats[k] || 0) < ITEMS[id].cost[k]) return false;
  return true;
}

export function craft(inv, id) {
  if (!canCraft(inv, id)) return false;
  for (const k in ITEMS[id].cost) inv.mats[k] -= ITEMS[id].cost[k];
  inv.items[id] = true;
  inv.dur = inv.dur || {};
  inv.dur[id] = 100; // tout objet forgé commence à 100 % de durabilité
  saveInv(inv);
  return true;
}

export function toggleEquip(inv, id) {
  if (getDur(inv, id) <= 0) return false; // un objet cassé ne s'équipe pas
  const slot = ITEMS[id].slot;
  inv.equip[slot] = inv.equip[slot] === id ? null : id;
  saveInv(inv);
  return true;
}

// ---------- DURABILITÉ ----------
// inv.dur[id] = 0-100, persisté avec l'inventaire ; absent = 100 (objets anciens)
export function getDur(inv, id) {
  return inv.dur && inv.dur[id] !== undefined ? inv.dur[id] : 100;
}
function setDur(inv, id, v) {
  inv.dur = inv.dur || {};
  inv.dur[id] = Math.max(0, Math.min(100, v));
}

// usure à chaque coup subi : l'armure trinque le plus, l'arme et le talisman moins.
// Retourne { broken, wear } : nom du premier objet cassé + usure par objet
// (id -> % de durabilité perdue), pour le résumé de fin de partie.
const SLOT_WEAR = { weapon: 1.5, armor: 3.0, charm: 1.0, boots: 0.8 };
export function wearEquipment(inv) {
  if (!inv || !inv.equip) return { broken: null, wear: {} };
  let broken = null;
  const wear = {};
  for (const slot in inv.equip) {
    const id = inv.equip[slot];
    if (!id) continue;
    const d0 = getDur(inv, id);
    const d = d0 - SLOT_WEAR[slot] * (0.75 + Math.random() * 0.5);
    const lost = d0 - Math.max(0, d);
    if (lost > 0) wear[id] = (wear[id] || 0) + lost;
    if (d <= 0) {
      setDur(inv, id, 0);
      inv.equip[slot] = null; // cassé : déséquipé, à réparer à la forge
      broken = broken || (ITEMS[id] ? ITEMS[id].name : id);
    } else setDur(inv, id, d);
  }
  saveInv(inv);
  return { broken, wear };
}

// coût de réparation : ~50 % du coût de forge, proportionnel à l'usure
export function repairCost(inv, id) {
  const missing = 100 - getDur(inv, id);
  if (missing <= 0) return null;
  const cost = {};
  for (const m in ITEMS[id].cost) {
    cost[m] = Math.max(1, Math.ceil(ITEMS[id].cost[m] * (missing / 100) * 0.5));
  }
  return cost;
}
export function canRepair(inv, id) {
  const c = repairCost(inv, id);
  if (!c) return false;
  for (const m in c) if ((inv.mats[m] || 0) < c[m]) return false;
  return true;
}
export function repairItem(inv, id) {
  if (!canRepair(inv, id)) return false;
  const c = repairCost(inv, id);
  for (const m in c) inv.mats[m] -= c[m];
  setDur(inv, id, 100);
  saveInv(inv);
  return true;
}

// ---------- PROGRESSION ÉPÉE / LANCE ----------
// inv.wmode['epee'|'lance'] = { xp } : XP gagnée avec chaque type d'arme
// (attaque de base + rotation pour l'épée, attaque + bouclier pour la lance).
// L'XP requise par niveau augmente fortement : 400 + 350 × niveau^1,5.
// Niveau 1→2 = 750 XP, 10→11 ≈ 11 500, 50→51 ≈ 124 000, 99→100 ≈ 345 000.
// Max 100 niveaux. Chaque niveau : +0,5 % de dégâts pour ce type d'arme.
export const MODE_MAX_LVL = 100;
export function modeNeed(lvl) { return Math.round(400 + 350 * Math.pow(lvl, 1.5)); }
export function modeKey(attackMode) { return attackMode === 3 ? 'lance' : 'epee'; }
export function modeInfo(inv, key) {
  inv.wmode = inv.wmode || {};
  const total = (inv.wmode[key] && inv.wmode[key].xp) || 0;
  let lvl = 1, rem = total;
  while (lvl < MODE_MAX_LVL) {
    const need = modeNeed(lvl);
    if (rem < need) break;
    rem -= need; lvl++;
  }
  const need = lvl < MODE_MAX_LVL ? modeNeed(lvl) : 0;
  return { xp: rem, lvl, need, pct: need ? rem / need : 1 };
}
export function addWmodeXp(inv, key, xp) {
  if (!key || !xp) return;
  inv.wmode = inv.wmode || {};
  const w = inv.wmode[key] = inv.wmode[key] || { xp: 0 };
  w.xp = (w.xp || 0) + xp;
  saveInv(inv);
}
export function modeMult(inv, key) {
  return 1 + 0.005 * (modeInfo(inv, key).lvl - 1); // +0,5 % de dégâts par niveau (max +49,5 % au niv. 100)
}

// bonus dérivés de l'équipement actuel (level = niveau du personnage pour l'enchantement)
export function equipBonuses(inv, level) {
  const b = { weaponMult: 1, armorReduce: 0, hp: 0, speed: 0, xp: 1, potions: 0, potionMult: 1, ultR: 1, ultBoss: 0 };
  for (const slot in inv.equip) {
    const id = inv.equip[slot];
    if (!id || getDur(inv, id) <= 0) continue; // cassé = aucun bonus
    const fx = FX[id];
    if (!fx) continue;
    if (fx.weaponMult) b.weaponMult *= fx.weaponMult;
    if (fx.armorReduce) b.armorReduce += fx.armorReduce;
    if (fx.hp) b.hp += fx.hp;
    if (fx.speed) b.speed += fx.speed;
    if (fx.xp) b.xp *= fx.xp;
    if (fx.potions) b.potions += fx.potions;
    if (fx.potionMult) b.potionMult *= fx.potionMult;
    if (fx.ultR) b.ultR *= fx.ultR;
    if (fx.ultBoss) b.ultBoss += fx.ultBoss;
  }
  return b;
}
